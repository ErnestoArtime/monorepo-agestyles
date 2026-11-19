import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { catalogIndex, parseCatalogQuery, queryCatalog } from "../../../../lib/storefront-catalog";
import { readHomeContent, readSellerHome } from "../../../../lib/storefront-home";
import { readSections } from "../../../../lib/store-sections";

/**
 * Tienda's catalog, paginated on the server (AG-34): only products that can be bought now,
 * with search, category, store (and its sections), price and colour filters, sorting and facets.
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
  // On a store's page its own featured products go first, and its sections filter.
  const sellerId =
    query.seller_id && /^sel_[A-Za-z0-9]+$/.test(query.seller_id) ? query.seller_id : null;
  const [cards, home, sections] = await Promise.all([
    catalogIndex(regionId, key),
    sellerId ? readSellerHome(req.scope, sellerId) : readHomeContent(req.scope),
    sellerId && query.section ? readSections(req.scope, sellerId) : Promise.resolve([]),
  ]);
  if (query.section) {
    const section = sections.find((entry) => entry.id === query.section);
    query.product_ids = new Set(section?.product_ids ?? []);
  }
  res.setHeader("cache-control", "public, max-age=30");
  res.json(queryCatalog(cards, query, home.featured_product_ids));
}
