import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { catalogIndex, parseCatalogQuery, queryCatalog } from "../../../../lib/storefront-catalog";
import { readHomeContent } from "../../../../lib/storefront-home";

/**
 * Tienda's catalog, paginated on the server (AG-34): only products that can be bought now,
 * with search, category, store, price and colour filters, sorting and facets.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const regionId = typeof req.query.region_id === "string" ? req.query.region_id : "";
  const key = req.headers["x-publishable-api-key"];
  if (!regionId || typeof key !== "string") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "region_id and a publishable key are required.",
    );
  }
  const query = parseCatalogQuery(req.query as Record<string, unknown>);
  const [cards, home] = await Promise.all([
    catalogIndex(regionId, key),
    readHomeContent(req.scope),
  ]);
  res.setHeader("cache-control", "public, max-age=30");
  res.json(queryCatalog(cards, query, home.featured_product_ids));
}
