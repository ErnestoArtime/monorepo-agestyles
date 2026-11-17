import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { CatalogPimService } from "@agestyles/catalog-pim" with {
  "resolution-mode": "import"
}

/**
 * Public reading surface for a comparison schema.
 *
 * Only the published version is returned. Drafts are platform work in
 * progress and must never leak to the storefront or to sellers.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve("agestylesCatalogPim") as CatalogPimService
  const family = await service.getFamilyByHandle(req.params.handle)
  if (!family || !family.is_active) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Catalog family ${req.params.handle} was not found.`,
    )
  }

  const version = await service.getPublishedVersion(family.id)
  if (!version) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Catalog family ${req.params.handle} has no published version.`,
    )
  }

  res.json({ catalog_family: family, version })
}
