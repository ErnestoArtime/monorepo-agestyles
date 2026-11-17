import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { CatalogPimService } from "@agestyles/catalog-pim" with {
  "resolution-mode": "import"
}
import type {
  CatalogField,
  CatalogSpecificationValues,
} from "@agestyles/domain/catalog-pim" with { "resolution-mode": "import" }

/**
 * `@agestyles/domain` is an ESM package and this app compiles to CommonJS, so
 * the pure rules are loaded with a cached dynamic import at request time
 * instead of a value import that TypeScript would reject.
 */
type CatalogRules = {
  validateCatalogSpecifications(
    fields: CatalogField[],
    values: CatalogSpecificationValues,
  ): Record<string, string>
}

let catalogRules: Promise<CatalogRules> | undefined
function loadCatalogRules(): Promise<CatalogRules> {
  catalogRules ??= import(
    "@agestyles/domain/catalog-pim"
  ) as unknown as Promise<CatalogRules>
  return catalogRules
}

/**
 * Associates a product with one published catalog family version and stores
 * the validated specification values on the product.
 *
 * Persistence uses the product's `metadata`, a supported Medusa field, so no
 * core or database change is required. The endpoint validates the version is
 * published and each value against that version's frozen fields before
 * writing: values are never trusted from the client shape.
 */

type ProductRecord = {
  id: string
  metadata: Record<string, unknown> | null
}

type ProductService = {
  retrieveProduct(
    id: string,
    config?: Record<string, unknown>,
  ): Promise<ProductRecord>
  updateProducts(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ProductRecord>
}

const FAMILY_ID = "catalog_family_id"
const VERSION_ID = "catalog_family_version_id"
const SPECIFICATIONS = "catalog_specifications"

function parseBody(body: unknown): {
  versionId: string
  specifications: CatalogSpecificationValues
} {
  const value = (body ?? {}) as Record<string, unknown>
  if (typeof value.version_id !== "string" || !value.version_id.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "version_id is required.",
    )
  }
  const rawSpecifications = value.specifications ?? {}
  if (
    typeof rawSpecifications !== "object" ||
    rawSpecifications === null ||
    Array.isArray(rawSpecifications)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "specifications must be an object keyed by field.",
    )
  }
  return {
    versionId: value.version_id.trim(),
    specifications: rawSpecifications as CatalogSpecificationValues,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  const catalogPim = req.scope.resolve("agestylesCatalogPim") as CatalogPimService

  let parsed: ReturnType<typeof parseBody>
  let version: Awaited<ReturnType<CatalogPimService["getPublishedVersionById"]>>
  try {
    parsed = parseBody(req.body)
    version = await catalogPim.getPublishedVersionById(parsed.versionId)
  } catch (error) {
    if (error instanceof MedusaError) throw error
    throw new MedusaError(MedusaError.Types.INVALID_DATA, String(error))
  }

  let specifications: Record<string, string>
  try {
    const { validateCatalogSpecifications } = await loadCatalogRules()
    specifications = validateCatalogSpecifications(
      version.fields,
      parsed.specifications,
    )
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      error instanceof Error ? error.message : String(error),
    )
  }

  const productService = req.scope.resolve(
    Modules.PRODUCT,
  ) as unknown as ProductService
  const product = await productService
    .retrieveProduct(productId, { select: ["id", "metadata"] })
    .catch(() => {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product ${productId} was not found.`,
      )
    })

  const updated = await productService.updateProducts(productId, {
    metadata: {
      ...(product.metadata ?? {}),
      [FAMILY_ID]: version.family_id,
      [VERSION_ID]: version.id,
      [SPECIFICATIONS]: specifications,
    },
  })

  res.json({
    product_id: updated.id,
    catalog_family_id: version.family_id,
    catalog_family_version_id: version.id,
    specifications,
  })
}

/** Removes the assignment; comparison no longer includes the product. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  const productService = req.scope.resolve(
    Modules.PRODUCT,
  ) as unknown as ProductService
  const product = await productService
    .retrieveProduct(productId, { select: ["id", "metadata"] })
    .catch(() => {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product ${productId} was not found.`,
      )
    })

  const metadata = { ...(product.metadata ?? {}) }
  delete metadata[FAMILY_ID]
  delete metadata[VERSION_ID]
  delete metadata[SPECIFICATIONS]

  const updated = await productService.updateProducts(productId, { metadata })
  res.json({ product_id: updated.id, catalog_family_version_id: null })
}
