import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { CatalogPimService } from "@agestyles/catalog-pim" with {
  "resolution-mode": "import"
}
import type {
  CatalogComparison,
  CatalogComparisonProduct,
  CatalogField,
} from "@agestyles/domain/catalog-pim" with { "resolution-mode": "import" }

/**
 * `@agestyles/domain` is ESM and this app compiles to CommonJS: the pure rule
 * is loaded through a cached dynamic import, shared with web and native.
 */
type CatalogRules = {
  compareCatalogProducts(
    products: CatalogComparisonProduct[],
  ): CatalogComparison
}

let catalogRules: Promise<CatalogRules> | undefined
function loadCatalogRules(): Promise<CatalogRules> {
  catalogRules ??= import(
    "@agestyles/domain/catalog-pim"
  ) as unknown as Promise<CatalogRules>
  return catalogRules
}

/**
 * Public comparison endpoint: 2–4 published products by id.
 *
 * Reads only the assignment stored on the product by the admin endpoint and
 * the frozen fields of the version it points to. Draft versions are ignored, so
 * a draft schema never leaks through the public surface. Products that are not
 * published are treated as missing instead of being exposed.
 */

type ProductRecord = {
  id: string
  title: string
  status: string
  metadata: Record<string, unknown> | null
}

type ProductService = {
  listProducts(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<ProductRecord[]>
}

const VERSION_ID = "catalog_family_version_id"
const SPECIFICATIONS = "catalog_specifications"

function parseIds(query: unknown): string[] {
  const value = (query ?? {}) as Record<string, unknown>
  const raw = value.ids ?? value.product_ids
  const ids = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",")
      : []
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length < 2 || unique.length > 4) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Provide between 2 and 4 product ids.",
    )
  }
  return unique
}

function readSpecifications(metadata: Record<string, unknown> | null) {
  const raw = metadata?.[SPECIFICATIONS]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && Boolean(entry[1].trim()),
  )
  return entries.length ? Object.fromEntries(entries) : null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const ids = parseIds(req.query)
  const productService = req.scope.resolve(
    Modules.PRODUCT,
  ) as unknown as ProductService
  const catalogPim = req.scope.resolve("agestylesCatalogPim") as CatalogPimService

  const records = await productService.listProducts(
    { id: ids, status: "published" },
    { select: ["id", "title", "status", "metadata"] },
  )

  // Keep the caller's order and report products that are not publicly visible
  // instead of silently dropping them.
  const byId = new Map(records.map((record) => [record.id, record]))
  const missingIds = ids.filter((id) => !byId.has(id))
  if (missingIds.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Products not found or not published: ${missingIds.join(", ")}.`,
    )
  }

  const fieldsByVersion = new Map<string, CatalogField[] | null>()
  const products: CatalogComparisonProduct[] = []
  for (const id of ids) {
    const record = byId.get(id) as ProductRecord
    const rawVersionId = record.metadata?.[VERSION_ID]
    const versionId =
      typeof rawVersionId === "string" && rawVersionId.trim()
        ? rawVersionId.trim()
        : null

    let fields: CatalogField[] | null = null
    if (versionId) {
      if (!fieldsByVersion.has(versionId)) {
        const version = await catalogPim.getVersionById(versionId).catch(() => null)
        // Draft snapshots are platform work in progress; exposing them here
        // would leak unpublished schema through the public API.
        fieldsByVersion.set(
          versionId,
          version && version.status !== "draft" ? version.fields : null,
        )
      }
      fields = fieldsByVersion.get(versionId) ?? null
    }

    products.push({
      id: record.id,
      name: record.title,
      // A version that is not readable or is still a draft counts as no
      // family, so it can never be compared against a legitimate snapshot.
      catalog_family_version_id: fields ? versionId : null,
      specifications: readSpecifications(record.metadata),
      catalog_family_fields: fields?.map((field) => ({
        key: field.key,
        comparable: field.comparable,
      })),
    })
  }

  const { compareCatalogProducts } = await loadCatalogRules()
  const comparison = compareCatalogProducts(products)
  res.json({
    comparison,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      catalog_family_version_id: product.catalog_family_version_id,
    })),
  })
}
