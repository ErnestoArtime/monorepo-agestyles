import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { deleteProductCategoriesWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Deletes a category only when nothing depends on it (AG-42), as the old catalog did:
 * no products and no subcategories. Medusa's own delete would just unlink the products.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: { id: string; products?: { id: string }[] }[] }>;
  };
  const id = req.params.id;
  const [
    {
      data: [category],
    },
    { data: children },
  ] = await Promise.all([
    query.graph({ entity: "product_category", fields: ["id", "products.id"], filters: { id } }),
    query.graph({
      entity: "product_category",
      fields: ["id"],
      filters: { parent_category_id: id },
    }),
  ]);
  if (!category) throw new MedusaError(MedusaError.Types.NOT_FOUND, "La categoría no existe.");
  if (children.length)
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tiene subcategorías: muévelas o bórralas antes.",
    );
  if (category.products?.length)
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Tiene ${category.products.length} producto(s): cámbialos de categoría o desactívala en lugar de borrarla.`,
    );
  await deleteProductCategoriesWorkflow(req.scope).run({ input: [id] });
  res.json({ id, deleted: true });
}
