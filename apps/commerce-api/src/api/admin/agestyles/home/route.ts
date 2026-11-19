import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  parseHomeContent,
  readHomeContent,
  writeHomeContent,
} from "../../../../lib/storefront-home";

type Query = {
  graph(input: { entity: string; fields: string[]; filters?: Record<string, unknown> }): Promise<{
    data: Record<string, any>[];
  }>;
};

/** Home content for the administration, with the published products and the categories to link. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query;
  const [content, { data: products }, { data: categories }] = await Promise.all([
    readHomeContent(req.scope),
    query.graph({
      entity: "product",
      fields: ["id", "title", "thumbnail", "status"],
      filters: { status: "published" },
    }),
    query.graph({ entity: "product_category", fields: ["id", "name"] }),
  ]);
  res.json({
    content,
    products: products.sort((a, b) => String(a.title).localeCompare(String(b.title), "es")),
    categories: categories.sort((a, b) => String(a.name).localeCompare(String(b.name), "es")),
  });
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content = parseHomeContent(req.body);
  res.json({ content: await writeHomeContent(req.scope, content) });
}
