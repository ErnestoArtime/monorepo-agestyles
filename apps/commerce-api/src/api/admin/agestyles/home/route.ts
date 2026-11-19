import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  parseHomeContent,
  readHomeContent,
  writeHomeContent,
} from "../../../../lib/storefront-home";

type Query = {
  graph(input: { entity: string; fields: string[]; filters?: Record<string, unknown> }): Promise<{
    data: { id: string; title: string; thumbnail: string | null; status: string }[];
  }>;
};

/** Home content for the administration: banners, featured ids and the published products. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query;
  const [content, { data: products }] = await Promise.all([
    readHomeContent(req.scope),
    query.graph({
      entity: "product",
      fields: ["id", "title", "thumbnail", "status"],
      filters: { status: "published" },
    }),
  ]);
  res.json({ content, products: products.sort((a, b) => a.title.localeCompare(b.title, "es")) });
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content = parseHomeContent(req.body);
  res.json({ content: await writeHomeContent(req.scope, content) });
}
