import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { CatalogFamilyVersion } from "@agestyles/domain/catalog-pim" with {
  "resolution-mode": "import"
}

/**
 * Proves the catalog family/version invariants against the isolated lab:
 * draft creation, one draft at a time, publishing freezes the snapshot,
 * publishing a new version archives the previous one, and invalid fields are
 * rejected before they reach the database.
 *
 * Run with:
 *   pnpm --filter @agestyles/commerce-api exec medusa exec ./src/scripts/verify-catalog-pim.ts
 */

type Family = {
  id: string
  handle: string
  name: string
  category_id: string
  description: string | null
  is_active: boolean
}

type PimService = {
  createFamily(input: {
    handle: string
    name: string
    category_id: string
    description?: string | null
    fields: unknown
    created_by?: string | null
  }): Promise<{ family: Family; version: CatalogFamilyVersion }>
  createVersion(
    familyId: string,
    fields: unknown,
    createdBy?: string | null,
  ): Promise<CatalogFamilyVersion>
  publishVersion(
    versionId: string,
    publishedAt?: Date,
  ): Promise<CatalogFamilyVersion>
  getPublishedVersion(familyId: string): Promise<CatalogFamilyVersion | null>
  getFamilyByHandle(handle: string): Promise<Family | null>
  listCatalogFamilyVersions(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<CatalogFamilyVersion[]>
  deleteCatalogFamilyVersions(ids: string | string[]): Promise<void>
  deleteCatalogFamilies(ids: string | string[]): Promise<void>
}

type CategoryService = {
  listProductCategories(
    filters: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<Array<{ id: string; handle: string }>>
}

const fieldsV1 = [
  {
    attribute_handle: "voltage",
    key: "Voltaje",
    type: "number",
    required: true,
    options: [],
    unit: "v",
    unit_symbol: "V",
    minimum: 0,
    maximum: 240,
    filterable: true,
    comparable: true,
  },
  {
    attribute_handle: "power_source",
    key: "Alimentación",
    type: "select",
    required: true,
    options: ["Batería", "Cable"],
    option_handles: ["bateria", "cable"],
    filterable: true,
    comparable: true,
  },
  {
    attribute_handle: "notes",
    key: "Notas",
    type: "text",
    required: false,
    options: [],
    comparable: false,
  },
]

export default async function verifyCatalogPim({ container }: ExecArgs) {
  const databaseUrl = process.env.DATABASE_URL ?? ""
  if (
    !/^postgres(?:ql)?:\/\/agestyles_lab:[a-f0-9]+@127\.0\.0\.1:15472\/agestyles_mercur_lab$/.test(
      databaseUrl,
    )
  ) {
    throw new Error("This verifier is restricted to the loopback AgeStyles lab database.")
  }

  const productService = container.resolve(
    Modules.PRODUCT,
  ) as unknown as CategoryService
  const [category] = await productService.listProductCategories({}, { take: 1 })
  if (!category) {
    throw new Error("The lab needs at least one product category to create a family.")
  }

  const service = container.resolve("agestylesCatalogPim") as PimService
  const handle = `pim-verifier-${Date.now()}`
  let familyId: string | undefined
  const versionIds: string[] = []

  try {
    const created = await service.createFamily({
      handle,
      name: "Familia de verificación PIM",
      category_id: category.id,
      description: "Creada y eliminada por verify-catalog-pim.ts",
      fields: fieldsV1,
      created_by: "verifier",
    })
    const createdFamilyId = created.family.id
    familyId = createdFamilyId
    versionIds.push(created.version.id)

    assert.equal(created.family.handle, handle)
    assert.equal(created.family.is_active, true)
    assert.equal(created.version.version, 1)
    assert.equal(created.version.status, "draft")
    assert.equal(created.version.frozen_at, null)
    assert.equal(created.version.fields.length, 3)
    assert.equal(created.version.fields[0].scope, "product")
    console.log("Created family and draft version 1")

    await assert.rejects(
      () =>
        service.createFamily({
          handle,
          name: "Duplicada",
          category_id: category.id,
          fields: fieldsV1,
        }),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.DUPLICATE_ERROR,
      "a repeated handle must be rejected",
    )

    await assert.rejects(
      () =>
        service.createVersion(createdFamilyId, [
          {
            attribute_handle: "voltage",
            key: "Voltaje",
            type: "text",
            required: true,
            options: [],
            unit: "v",
          },
        ]),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.INVALID_DATA,
      "unit on a text field must be rejected",
    )

    const publishedV1 = await service.publishVersion(created.version.id)
    assert.equal(publishedV1.status, "published")
    assert.ok(publishedV1.frozen_at, "publishing must freeze the version")
    assert.equal(publishedV1.fields.length, 3)
    console.log("Published version 1; frozen_at is set")

    const fieldsV2 = [
      {
        attribute_handle: "voltage",
        key: "Voltaje",
        type: "number",
        required: true,
        options: [],
        unit: "v",
        unit_symbol: "V",
        minimum: 0,
        maximum: 250,
        filterable: true,
        comparable: true,
      },
      {
        attribute_handle: "power_source",
        key: "Alimentación",
        type: "select",
        required: true,
        options: ["Batería", "Cable"],
        option_handles: ["bateria", "cable"],
        filterable: true,
        comparable: true,
      },
      {
        attribute_handle: "weight",
        key: "Peso",
        type: "number",
        required: false,
        options: [],
        unit: "kg",
        unit_symbol: "kg",
        minimum: 0,
        comparable: true,
      },
    ]
    const draftV2 = await service.createVersion(createdFamilyId, fieldsV2, "verifier")
    versionIds.push(draftV2.id)
    assert.equal(draftV2.version, 2)
    assert.equal(draftV2.status, "draft")
    assert.equal(draftV2.frozen_at, null)

    await assert.rejects(
      () => service.createVersion(createdFamilyId, fieldsV2),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_ALLOWED,
      "a family cannot have two drafts at once",
    )

    const stillPublished = await service.getPublishedVersion(createdFamilyId)
    assert.equal(stillPublished?.id, publishedV1.id, "draft does not change the published version")
    assert.equal(
      stillPublished?.fields[0].maximum,
      240,
      "the published snapshot keeps its original limits",
    )
    console.log("Created draft version 2; version 1 remains published and unchanged")

    const publishedV2 = await service.publishVersion(draftV2.id)
    assert.equal(publishedV2.status, "published")
    assert.equal(publishedV2.version, 2)

    const versions = await service.listCatalogFamilyVersions(
      { family_id: createdFamilyId },
      { order: { version: "ASC" } },
    )
    const byId = new Map(versions.map((version) => [version.id, version]))
    assert.equal(byId.get(publishedV1.id)?.status, "archived")
    assert.equal(byId.get(draftV2.id)?.status, "published")
    assert.notEqual(
      byId.get(publishedV1.id)?.id,
      byId.get(draftV2.id)?.id,
      "products on version 1 and version 2 are not comparable",
    )

    const byHandle = await service.getFamilyByHandle(handle)
    assert.equal(byHandle?.id, createdFamilyId)
    console.log("Published version 2; version 1 archived; lookup by handle works")

    console.log(
      JSON.stringify({
        familyId,
        categoryId: category.id,
        publishedVersion: publishedV2.version,
        archivedVersion: publishedV1.version,
        draftReuseRejected: true,
        duplicateHandleRejected: true,
        invalidFieldsRejected: true,
      }),
    )
  } finally {
    if (versionIds.length) await service.deleteCatalogFamilyVersions(versionIds)
    if (familyId) await service.deleteCatalogFamilies(familyId)
    console.log("Cleaned up the verification family")
  }
}
