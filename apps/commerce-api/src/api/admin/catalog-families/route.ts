import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { CatalogPimService } from "@agestyles/catalog-pim" with {
  "resolution-mode": "import"
}

/**
 * Catalog families are platform-owned: only administrators define the schema
 * sellers fill in. All routes under `/admin` require an authenticated user, so
 * this handler never has to check the actor itself.
 */

type ProductCategoryService = {
  retrieveProductCategory(id: string): Promise<{ id: string }>
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve("agestylesCatalogPim") as CatalogPimService
  const families = await service.listFamilies()
  res.json({ catalog_families: families, count: families.length })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as Record<string, unknown>
  if (typeof body.category_id !== "string" || !body.category_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "category_id is required.",
    )
  }

  const productService = req.scope.resolve(
    Modules.PRODUCT,
  ) as unknown as ProductCategoryService
  await productService.retrieveProductCategory(body.category_id).catch(() => {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Product category ${body.category_id} was not found.`,
    )
  })

  const service = req.scope.resolve("agestylesCatalogPim") as CatalogPimService
  const created = await service.createFamily({
    handle: body.handle as string,
    name: body.name as string,
    category_id: body.category_id,
    description:
      body.description === undefined ? undefined : (body.description as string | null),
    fields: body.fields,
    created_by: req.auth_context.actor_id ?? null,
  })
  res.status(201).json(created)
}
