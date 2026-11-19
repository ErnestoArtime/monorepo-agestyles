import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

type Category = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parent_category_id: string | null;
  rank: number | null;
  is_active: boolean;
  is_internal: boolean;
  metadata: Record<string, unknown> | null;
  products?: { id: string }[];
};

/**
 * Codificadores → Categorías (AG-42): every marketplace category with its parent, order,
 * state and how many products use it. Writes go through Medusa's own admin routes
 * (`/admin/product-categories`); deleting goes through the guarded route next to this one.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: { entity: string; fields: string[] }): Promise<{ data: Category[] }>;
  };
  const { data } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "parent_category_id",
      "rank",
      "is_active",
      "is_internal",
      "metadata",
      "products.id",
    ],
  });
  res.json({
    categories: data
      .map(({ products, ...category }) => ({ ...category, product_count: products?.length ?? 0 }))
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "es")),
  });
}
