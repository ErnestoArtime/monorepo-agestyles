import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { catalogIndex } from "../../../../lib/storefront-catalog";
import { readHomeContent, readSellerHome } from "../../../../lib/storefront-home";

/**
 * Tienda's home (AG-34): active banners and the featured products that can be bought now.
 * With `seller_id`, the content of that store's own page (only its products).
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
  const sellerId =
    typeof req.query.seller_id === "string" && /^sel_[A-Za-z0-9]+$/.test(req.query.seller_id)
      ? req.query.seller_id
      : null;
  const [home, cards] = await Promise.all([
    sellerId ? readSellerHome(req.scope, sellerId) : readHomeContent(req.scope),
    catalogIndex(regionId, key),
  ]);
  const byId = new Map(
    cards
      .filter((card) => !sellerId || card.sellers.some((seller) => seller.id === sellerId))
      .map((card) => [card.id, card]),
  );
  res.setHeader("cache-control", "public, max-age=30");
  res.json({
    banners: home.banners.filter((banner) => banner.active),
    featured: home.featured_product_ids.map((id) => byId.get(id)).filter(Boolean),
  });
}
