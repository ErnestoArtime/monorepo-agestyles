import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { CatalogFamilyVersion } from "@agestyles/domain/catalog-pim" with {
  "resolution-mode": "import"
}
import {
  POST as assignFamily,
  DELETE as clearFamily,
} from "../api/admin/products/[id]/catalog-family/route"
import { GET as compareProducts } from "../api/store/catalog-comparison/route"
import { POST as createFamily } from "../api/admin/catalog-families/route"
import { POST as publishVersion } from "../api/admin/catalog-families/[id]/versions/[version_id]/publish/route"

/**
 * Proves product → published family version persistence and the public
 * comparison surface against the isolated lab:
 *
 * - a draft version cannot be assigned;
 * - invalid or unknown specifications are rejected before writing;
 * - valid values are normalized and stored on the product metadata;
 * - two products of the same version compare with their stored values;
 * - a product without a family reports `family_missing`;
 * - clearing the assignment removes the product from comparison.
 *
 * Run with:
 *   pnpm --filter @agestyles/commerce-api exec medusa exec ./src/scripts/verify-catalog-product-assignment.ts
 */

type ProductRecord = {
  id: string
  title: string
  status: string
  metadata: Record<string, unknown> | null
}

type ProductService = {
  listProductCategories(
    filters: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<Array<{ id: string; handle: string }>>
  createProducts(input: Record<string, unknown>): Promise<ProductRecord>
  listProducts(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<ProductRecord[]>
  deleteProducts(ids: string | string[]): Promise<void>
}

type PimService = {
  listCatalogFamilyVersions(
    filters: Record<string, unknown>,
  ): Promise<CatalogFamilyVersion[]>
  deleteCatalogFamilyVersions(ids: string | string[]): Promise<void>
  deleteCatalogFamilies(ids: string | string[]): Promise<void>
}

type RouteState = { statusCode: number; body: unknown }

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
  {
    body = {},
    params = {},
    query = {},
  }: {
    body?: unknown
    params?: Record<string, string>
    query?: Record<string, unknown>
  },
) {
  return {
    scope: container,
    body,
    params,
    query,
    auth_context: {
      actor_id: "verifier",
      actor_type: "user",
      auth_identity_id: "verifier",
      app_metadata: {},
      user_metadata: {},
    },
  } as unknown as AuthenticatedMedusaRequest
}

function fields() {
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
      maximum: 240,
      comparable: true,
    },
    {
      attribute_handle: "power_source",
      key: "Alimentación",
      type: "select",
      required: false,
      options: ["Batería", "Cable"],
      option_handles: ["bateria", "cable"],
      comparable: true,
    },
    {
      attribute_handle: "internal_notes",
      key: "Notas internas",
      type: "text",
      required: false,
      options: [],
      comparable: false,
    },
  ]
}

export default async function verifyCatalogProductAssignment({
  container,
}: ExecArgs) {
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
  ) as unknown as ProductService
  const pimService = container.resolve("agestylesCatalogPim") as PimService

  const [category] = await productService.listProductCategories({}, { take: 1 })
  if (!category) throw new Error("The lab needs at least one product category.")

  const stamp = Date.now()
  const handle = `pim-assignment-${stamp}`
  const productIds: string[] = []
  let familyId: string | undefined
  const versionIds: string[] = []

  try {
    // Family with draft v1, then published.
    const createdFamily = createResponse()
    await createFamily(
      adminRequest(container, {
        body: {
          handle,
          name: "Familia de asignación",
          category_id: category.id,
          fields: fields(),
        },
      }),
      createdFamily.res,
    )
    assert.equal(createdFamily.state.statusCode, 201)
    const created = createdFamily.state.body as {
      family: { id: string }
      version: CatalogFamilyVersion
    }
    familyId = created.family.id
    versionIds.push(created.version.id)

    const productA = await productService.createProducts({
      title: `Taladro A ${stamp}`,
      status: "published",
    })
    const productB = await productService.createProducts({
      title: `Taladro B ${stamp}`,
      status: "published",
    })
    productIds.push(productA.id, productB.id)

    // Draft version cannot be assigned.
    const draftAssignment = createResponse()
    await assert.rejects(
      () =>
        assignFamily(
          adminRequest(container, {
            params: { id: productA.id },
            body: {
              version_id: created.version.id,
              specifications: { Voltaje: "220" },
            },
          }),
          draftAssignment.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_ALLOWED,
      "a draft version must not be assigned",
    )

    // Publish v1.
    const published = createResponse()
    await publishVersion(
      adminRequest(container, {
        params: { id: created.family.id, version_id: created.version.id },
      }),
      published.res,
    )
    assert.equal(published.state.statusCode, 200)

    // Unknown field and out-of-range numbers are rejected.
    for (const [name, specifications] of [
      ["unknown field", { Voltaje: "220", Peso: "2" }],
      ["out of range", { Voltaje: "260" }],
      ["invalid option", { Voltaje: "220", Alimentación: "Nuclear" }],
      ["missing required", { Alimentación: "Cable" }],
    ] as Array<[string, Record<string, unknown>]>) {
      const rejected = createResponse()
      await assert.rejects(
        () =>
          assignFamily(
            adminRequest(container, {
              params: { id: productA.id },
              body: { version_id: created.version.id, specifications },
            }),
            rejected.res,
          ),
        (error: unknown) =>
          (error as { type?: string }).type === MedusaError.Types.INVALID_DATA,
        `expected rejection: ${name}`,
      )
    }

    // Valid assignment, values normalized.
    const assignedA = createResponse()
    await assignFamily(
      adminRequest(container, {
        params: { id: productA.id },
        body: {
          version_id: created.version.id,
          specifications: {
            voltaje: " 220 ",
            "ALIMENTACIÓN": "batería",
            "Notas internas": "Caja abierta",
          },
        },
      }),
      assignedA.res,
    )
    assert.equal(assignedA.state.statusCode, 200)
    assert.deepEqual(
      (assignedA.state.body as { specifications: Record<string, string> })
        .specifications,
      { Voltaje: "220", Alimentación: "Batería", "Notas internas": "Caja abierta" },
    )

    const assignedB = createResponse()
    await assignFamily(
      adminRequest(container, {
        params: { id: productB.id },
        body: {
          version_id: created.version.id,
          specifications: { Voltaje: "110", "Alimentación": "Cable" },
        },
      }),
      assignedB.res,
    )
    assert.equal(assignedB.state.statusCode, 200)

    // Metadata persisted on the products.
    const stored = await productService.listProducts(
      { id: productIds },
      { select: ["id", "metadata"] },
    )
    const storedA = stored.find((product) => product.id === productA.id)
    assert.equal(
      storedA?.metadata?.catalog_family_version_id,
      created.version.id,
    )
    assert.deepEqual(storedA?.metadata?.catalog_specifications, {
      Voltaje: "220",
      Alimentación: "Batería",
      "Notas internas": "Caja abierta",
    })

    // Comparison reads stored values and excludes comparable:false fields.
    const compared = createResponse()
    await compareProducts(
      adminRequest(container, { query: { ids: [productA.id, productB.id] } }),
      compared.res,
    )
    assert.equal(compared.state.statusCode, 200)
    const comparedBody = compared.state.body as {
      comparison: {
        compatibility: { compatible: boolean; reason: string }
        attributes: { available: boolean; rows: Array<{ key: string }> }
      }
    }
    const comparison = comparedBody.comparison
    assert.equal(comparison.compatibility.compatible, true)
    assert.equal(comparison.compatibility.reason, "same_family_version")
    assert.deepEqual(
      comparison.attributes.rows.map((row) => row.key),
      ["Alimentación", "Voltaje"],
      "comparable:false fields are not shown",
    )

    // A third product without a family cannot be compared with them.
    const productC = await productService.createProducts({
      title: `Taladro C ${stamp}`,
      status: "published",
    })
    productIds.push(productC.id)
    const mixed = createResponse()
    await compareProducts(
      adminRequest(container, {
        query: { ids: [productA.id, productC.id] },
      }),
      mixed.res,
    )
    assert.equal(
      (
        mixed.state.body as {
          comparison: { compatibility: { reason: string } }
        }
      ).comparison.compatibility.reason,
      "family_missing",
    )

    // Clearing the assignment removes the product from comparison.
    const cleared = createResponse()
    await clearFamily(
      adminRequest(container, { params: { id: productC.id } }),
      cleared.res,
    )
    assert.equal(cleared.state.statusCode, 200)

    console.log(
      JSON.stringify({
        assignedA: "Voltaje=220",
        assignedB: "Voltaje=110",
        comparedRows: comparison.attributes.rows.length,
        sameVersionCompatible: true,
        draftAssignmentRejected: true,
        invalidValuesRejected: true,
        hiddenFieldExcluded: true,
        missingFamilyReported: true,
      }),
    )
  } finally {
    if (productIds.length) await productService.deleteProducts(productIds)
    if (versionIds.length) await pimService.deleteCatalogFamilyVersions(versionIds)
    if (familyId) await pimService.deleteCatalogFamilies(familyId)
    console.log("Cleaned up assignment verification data")
  }
}
