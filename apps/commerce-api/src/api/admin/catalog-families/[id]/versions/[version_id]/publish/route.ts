import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { CatalogPimService } from "@agestyles/catalog-pim" with {
  "resolution-mode": "import"
}

/**
 * Freezes a draft and archives the previously published version. The version
 * must belong to the family in the URL: publishing must never cross families
 * because the family id is part of the URL contract.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve("agestylesCatalogPim") as CatalogPimService
  const version = await service.retrieveVersion(req.params.version_id)
  if (version.family_id !== req.params.id) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Version ${req.params.version_id} does not belong to family ${req.params.id}.`,
    )
  }
  const published = await service.publishVersion(version.id)
  res.json({ version: published })
}
