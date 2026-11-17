import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type {
  CatalogFamilyVersion,
  CatalogFamilySummary,
} from "@agestyles/domain/catalog-pim" with { "resolution-mode": "import" }
import { GET as listFamilies, POST as createFamily } from "../api/admin/catalog-families/route"
import { POST as createVersion } from "../api/admin/catalog-families/[id]/versions/route"
import { POST as publishVersion } from "../api/admin/catalog-families/[id]/versions/[version_id]/publish/route"
import { GET as getStoreFamily } from "../api/store/catalog-families/[handle]/route"

/**
 * Exercises the catalog PIM route handlers against the isolated lab.
 *
 * Authentication itself is applied by the framework: every `/admin/*` route is
 * wrapped with `authenticate("user", ...)` and every `/store/*` route requires
 * a publishable key. This verifier targets the handler logic, category
 * validation, status transitions and the no-draft-leak rule.
 *
 * Run with:
 *   pnpm --filter @agestyles/commerce-api exec medusa exec ./src/scripts/verify-catalog-pim-http.ts
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

type RouteState = {
  statusCode: number
  body: unknown
}

function createResponse(): { res: MedusaResponse; state: RouteState } {
  const state: RouteState = { statusCode: 200, body: undefined }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(body: unknown) {
      state.body = body
      return res
    },
  }
  return { res: res as unknown as MedusaResponse, state }
}

function adminRequest(
  container: ExecArgs["container"],
  { body = {}, params = {} }: { body?: unknown; params?: Record<string, string> },
) {
  return {
    scope: container,
    body,
    params,
    auth_context: {
      actor_id: "verifier",
      actor_type: "user",
      auth_identity_id: "verifier",
      app_metadata: {},
      user_metadata: {},
    },
  } as unknown as AuthenticatedMedusaRequest
}

function storeRequest(
  container: ExecArgs["container"],
  params: Record<string, string>,
) {
  return {
    scope: container,
    body: {},
    params,
  } as unknown as AuthenticatedMedusaRequest
}

function fields(maximum = 240) {
  return [
    {
      attribute_handle: "voltage",
      key: "Voltaje",
      type: "number",
      required: true,
      options: [],
      unit: "v",
      unit_symbol: "V",
      minimum: 0,
      maximum,
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
    },
  ]
}

export default async function verifyCatalogPimHttp({ container }: ExecArgs) {
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
  if (!category) throw new Error("The lab needs at least one product category.")

  const service = container.resolve("agestylesCatalogPim") as PimService
  const stamp = Date.now()
  const publishedHandle = `pim-http-published-${stamp}`
  const draftHandle = `pim-http-draft-${stamp}`
  const familyIds: string[] = []

  try {
    // Unknown category is rejected before anything is written.
    const invalid = createResponse()
    await assert.rejects(
      () =>
        createFamily(
          adminRequest(container, {
            body: {
              handle: `pim-http-invalid-${stamp}`,
              name: "Categoría inexistente",
              category_id: "pcat_does_not_exist",
              fields: fields(),
            },
          }),
          invalid.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.INVALID_DATA,
    )

    // Create family + draft version 1.
    const created = createResponse()
    await createFamily(
      adminRequest(container, {
        body: {
          handle: publishedHandle,
          name: "Familia HTTP publicada",
          category_id: category.id,
          description: "Route verifier",
          fields: fields(),
        },
      }),
      created.res,
    )
    assert.equal(created.state.statusCode, 201)
    const createdBody = created.state.body as {
      family: Family
      version: CatalogFamilyVersion
    }
    const family = createdBody.family
    familyIds.push(family.id)
    assert.equal(family.handle, publishedHandle)
    assert.equal(createdBody.version.status, "draft")
    assert.equal(createdBody.version.version, 1)

    // Listing returns the new family.
    const listed = createResponse()
    await listFamilies(adminRequest(container, {}), listed.res)
    assert.equal(listed.state.statusCode, 200)
    const listedBody = listed.state.body as {
      catalog_families: CatalogFamilySummary[]
      count: number
    }
    assert.ok(
      listedBody.catalog_families.some((item) => item.id === family.id),
      "list must include the created family",
    )

    // Publish version 1 before creating the next draft: one draft at a time.
    const firstPublish = createResponse()
    await publishVersion(
      adminRequest(container, {
        params: { id: family.id, version_id: createdBody.version.id },
      }),
      firstPublish.res,
    )
    assert.equal(firstPublish.state.statusCode, 200)
    assert.equal(
      (firstPublish.state.body as { version: CatalogFamilyVersion }).version.status,
      "published",
    )

    // Draft 2 and publish it; version 1 becomes archived.
    const draft = createResponse()
    await createVersion(
      adminRequest(container, {
        body: { fields: fields(250) },
        params: { id: family.id },
      }),
      draft.res,
    )
    assert.equal(draft.state.statusCode, 201)
    const draftVersion = (draft.state.body as { version: CatalogFamilyVersion })
      .version
    assert.equal(draftVersion.version, 2)

    const published = createResponse()
    await publishVersion(
      adminRequest(container, {
        params: { id: family.id, version_id: draftVersion.id },
      }),
      published.res,
    )
    assert.equal(published.state.statusCode, 200)
    const publishedVersion = (
      published.state.body as { version: CatalogFamilyVersion }
    ).version
    assert.equal(publishedVersion.status, "published")
    assert.ok(publishedVersion.frozen_at)

    // The store surface returns only the published version.
    const store = createResponse()
    await getStoreFamily(
      storeRequest(container, { handle: publishedHandle }),
      store.res,
    )
    assert.equal(store.state.statusCode, 200)
    const storeBody = store.state.body as {
      catalog_family: Family
      version: CatalogFamilyVersion
    }
    assert.equal(storeBody.version.id, draftVersion.id)
    assert.equal(storeBody.version.status, "published")

    // A draft-only family must not leak through the store surface.
    const draftFamily = createResponse()
    await createFamily(
      adminRequest(container, {
        body: {
          handle: draftHandle,
          name: "Familia HTTP borrador",
          category_id: category.id,
          fields: fields(),
        },
      }),
      draftFamily.res,
    )
    const draftFamilyBody = draftFamily.state.body as { family: Family }
    familyIds.push(draftFamilyBody.family.id)

    const hidden = createResponse()
    await assert.rejects(
      () =>
        getStoreFamily(
          storeRequest(container, { handle: draftHandle }),
          hidden.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_FOUND,
      "a family without a published version must not be public",
    )

    // A version cannot be published through a different family id.
    const crossed = createResponse()
    await assert.rejects(
      () =>
        publishVersion(
          adminRequest(container, {
            params: { id: draftFamilyBody.family.id, version_id: draftVersion.id },
          }),
          crossed.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_FOUND,
      "publishing must not cross family boundaries",
    )

    console.log(
      JSON.stringify({
        created: 201,
        listed: listedBody.count,
        publishedVersion: publishedVersion.version,
        storeReturnsPublished: true,
        draftLeakBlocked: true,
        crossFamilyPublishBlocked: true,
        unknownCategoryRejected: true,
      }),
    )
  } finally {
    for (const familyId of familyIds) {
      const versions = await service
        .listCatalogFamilyVersions({ family_id: familyId })
        .catch(() => [])
      if (versions.length) {
        await service
          .deleteCatalogFamilyVersions(versions.map((version) => version.id))
          .catch(() => undefined)
      }
      await service.deleteCatalogFamilies(familyId).catch(() => undefined)
    }
    console.log("Cleaned up HTTP verification families")
  }
}
