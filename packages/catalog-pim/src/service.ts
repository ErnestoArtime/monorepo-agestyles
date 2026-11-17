import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import type {
  CatalogFamilySummary,
  CatalogFamilyVersion,
  CatalogField,
} from "@agestyles/domain/catalog-pim" with { "resolution-mode": "import" }
import CatalogFamily from "./models/catalog-family"
import CatalogFamilyVersionModel from "./models/catalog-family-version"
import {
  CatalogFieldValidationError,
  normalizeFamilyHandle,
  validateCatalogFields,
} from "./validation"

export type CreateCatalogFamilyInput = {
  handle: string
  name: string
  category_id: string
  description?: string | null
  fields: unknown
  created_by?: string | null
}

export type UpdateCatalogFamilyInput = {
  name?: string
  category_id?: string
  description?: string | null
  is_active?: boolean
}

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function notFound(message: string): never {
  throw new MedusaError(MedusaError.Types.NOT_FOUND, message)
}

function notAllowed(message: string): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, message)
}

function normalizeText(
  value: unknown,
  name: string,
  { max = 120, required = true }: { max?: number; required?: boolean } = {},
): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) invalid(`${name} is required.`)
    return null
  }
  if (typeof value !== "string" || value.length > max || !value.trim()) {
    invalid(`${name} must be a non-empty string of at most ${max} characters.`)
  }
  return value.trim()
}

function toFamilySummary(record: {
  id: string
  handle: string
  name: string
  category_id: string
  description: string | null
  is_active: boolean
}): CatalogFamilySummary {
  return {
    id: record.id,
    handle: record.handle,
    name: record.name,
    category_id: record.category_id,
    description: record.description,
    is_active: record.is_active,
  }
}

function toFamilyVersion(record: {
  id: string
  family_id: string
  version: number
  status: "draft" | "published" | "archived"
  fields: unknown
  frozen_at: Date | string | null
}): CatalogFamilyVersion {
  return {
    id: record.id,
    family_id: record.family_id,
    version: record.version,
    status: record.status,
    fields: record.fields as CatalogField[],
    frozen_at: record.frozen_at ? new Date(record.frozen_at).toISOString() : null,
  }
}

/**
 * `model.json()` is typed as an object, but the snapshot is naturally an
 * array. Keep the array in JSONB and cross the typing boundary here.
 */
function toFieldsJson(fields: CatalogField[]): Record<string, unknown> {
  return fields as unknown as Record<string, unknown>
}

/**
 * Catalog family/version service.
 *
 * Writes are platform-owned: the API layer decides whether the caller is an
 * administrator. The service enforces the invariants that must hold no matter
 * which endpoint is used:
 *
 * - one draft version per family at a time;
 * - publishing freezes the field snapshot;
 * - publishing a version archives the previous published one;
 * - a published version is never mutated.
 */
class CatalogPimService extends MedusaService({
  CatalogFamily,
  CatalogFamilyVersion: CatalogFamilyVersionModel,
}) {
  async createFamily(
    input: CreateCatalogFamilyInput,
  ): Promise<{ family: CatalogFamilySummary; version: CatalogFamilyVersion }> {
    const handle = this.runValidation(() => normalizeFamilyHandle(input.handle))
    const name = normalizeText(input.name, "name") as string
    const categoryId = normalizeText(input.category_id, "category_id", {
      max: 120,
    }) as string
    const description = normalizeText(input.description, "description", {
      max: 1000,
      required: false,
    })
    const fields = this.runValidation(() => validateCatalogFields(input.fields))

    const existing = await this.listCatalogFamilies({ handle })
    if (existing.length) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Catalog family handle "${handle}" already exists.`,
      )
    }

    const family = await this.createCatalogFamilies({
      handle,
      name,
      category_id: categoryId,
      description,
      is_active: true,
      created_by: input.created_by ?? null,
    })

    try {
      const version = await this.createCatalogFamilyVersions({
        family_id: family.id,
        version: 1,
        status: "draft",
        fields: toFieldsJson(fields),
        created_by: input.created_by ?? null,
      })
      return {
        family: toFamilySummary(family),
        version: toFamilyVersion(version),
      }
    } catch (error) {
      // Without a shared transaction a failed version would leave a family
      // with no schema, which is worse than a partial create.
      await this.deleteCatalogFamilies(family.id).catch(() => undefined)
      throw error
    }
  }

  async updateFamily(
    familyId: string,
    input: UpdateCatalogFamilyInput,
  ): Promise<CatalogFamilySummary> {
    const family = await this.retrieveFamily(familyId)
    const patch: UpdateCatalogFamilyInput = {}

    if (input.name !== undefined) {
      patch.name = normalizeText(input.name, "name") as string
    }
    if (input.category_id !== undefined) {
      patch.category_id = normalizeText(input.category_id, "category_id", {
        max: 120,
      }) as string
    }
    if (input.description !== undefined) {
      patch.description = normalizeText(input.description, "description", {
        max: 1000,
        required: false,
      })
    }
    if (input.is_active !== undefined) {
      if (typeof input.is_active !== "boolean") {
        invalid("is_active must be a boolean.")
      }
      patch.is_active = input.is_active
    }

    const updated = await this.updateCatalogFamilies({ id: family.id, ...patch })
    return toFamilySummary(updated)
  }

  /**
   * Creates the next draft with a fresh field snapshot. Published versions and
   * their products are untouched.
   */
  async createVersion(
    familyId: string,
    fields: unknown,
    createdBy?: string | null,
  ): Promise<CatalogFamilyVersion> {
    const family = await this.retrieveFamily(familyId)
    const normalized = this.runValidation(() => validateCatalogFields(fields))

    const draft = await this.listCatalogFamilyVersions({
      family_id: family.id,
      status: "draft",
    })
    if (draft.length) {
      notAllowed(
        `Family ${family.handle} already has draft version ${draft[0].version}; publish or archive it first.`,
      )
    }

    const [latest] = await this.listCatalogFamilyVersions(
      { family_id: family.id },
      { order: { version: "DESC" }, take: 1 },
    )

    const version = await this.createCatalogFamilyVersions({
      family_id: family.id,
      version: (latest?.version ?? 0) + 1,
      status: "draft",
      fields: toFieldsJson(normalized),
      created_by: createdBy ?? null,
    })
    return toFamilyVersion(version)
  }

  /**
   * Freezes a draft and archives the previously published version. Publishing
   * an already published version is idempotent; archived versions are final.
   */
  async publishVersion(
    versionId: string,
    publishedAt: Date = new Date(),
  ): Promise<CatalogFamilyVersion> {
    const version = await this.retrieveVersion(versionId)
    if (version.status === "published") return toFamilyVersion(version)
    if (version.status === "archived") {
      notAllowed(`Version ${version.version} is archived and cannot be published again.`)
    }

    const fields = this.runValidation(() => validateCatalogFields(version.fields))

    const previouslyPublished = await this.listCatalogFamilyVersions({
      family_id: version.family_id,
      status: "published",
    })
    for (const previous of previouslyPublished) {
      await this.updateCatalogFamilyVersions({
        id: previous.id,
        status: "archived",
      })
    }

    const published = await this.updateCatalogFamilyVersions({
      id: version.id,
      status: "published",
      fields: toFieldsJson(fields),
      frozen_at: publishedAt,
    })
    return toFamilyVersion(published)
  }

  async retrieveFamily(familyId: string) {
    const family = await this.retrieveCatalogFamily(familyId).catch(() => null)
    if (!family) notFound(`Catalog family ${familyId} was not found.`)
    return family
  }

  async retrieveVersion(versionId: string) {
    const version = await this.retrieveCatalogFamilyVersion(versionId).catch(
      () => null,
    )
    if (!version) notFound(`Catalog family version ${versionId} was not found.`)
    return version
  }

  async getPublishedVersion(
    familyId: string,
  ): Promise<CatalogFamilyVersion | null> {
    const [published] = await this.listCatalogFamilyVersions(
      { family_id: familyId, status: "published" },
      { order: { version: "DESC" }, take: 1 },
    )
    return published ? toFamilyVersion(published) : null
  }

  async listFamilies(): Promise<CatalogFamilySummary[]> {
    const families = await this.listCatalogFamilies(
      {},
      { order: { name: "ASC" } },
    )
    return families.map(toFamilySummary)
  }

  async getFamilyByHandle(handle: string): Promise<CatalogFamilySummary | null> {
    const normalized = this.runValidation(() => normalizeFamilyHandle(handle))
    const [family] = await this.listCatalogFamilies({ handle: normalized })
    return family ? toFamilySummary(family) : null
  }

  /**
   * Returns a version only when it is published. Products may only be
   * associated with published snapshots: assigning a draft would let a later
   * publish change the schema behind products that already reference it.
   */
  async getPublishedVersionById(
    versionId: string,
  ): Promise<CatalogFamilyVersion> {
    const version = await this.retrieveVersion(versionId)
    if (version.status !== "published") {
      notAllowed(
        `Version ${version.version} is ${version.status}; only published versions can be assigned to products.`,
      )
    }
    return toFamilyVersion(version)
  }

  /** Typed read used by the public comparison surface. */
  async getVersionById(
    versionId: string,
  ): Promise<CatalogFamilyVersion | null> {
    const version = await this.retrieveCatalogFamilyVersion(versionId).catch(
      () => null,
    )
    return version ? toFamilyVersion(version) : null
  }

  private runValidation<T>(fn: () => T): T {
    try {
      return fn()
    } catch (error) {
      if (error instanceof CatalogFieldValidationError) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
      }
      throw error
    }
  }
}

export default CatalogPimService
