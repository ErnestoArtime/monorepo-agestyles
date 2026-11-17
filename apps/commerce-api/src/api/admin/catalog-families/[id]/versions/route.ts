import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { CatalogPimService } from "@agestyles/catalog-pim" with {
  "resolution-mode": "import"
}

/** Creates the next draft version for a family; published versions stay intact. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as Record<string, unknown>
  const service = req.scope.resolve("agestylesCatalogPim") as CatalogPimService
  const version = await service.createVersion(
    req.params.id,
    body.fields,
    req.auth_context.actor_id ?? null,
  )
  res.status(201).json({ version })
}
