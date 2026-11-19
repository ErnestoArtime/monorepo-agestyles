import type { MedusaResponse } from "@medusajs/framework/http";
import {
  checkSellerHome,
  parseHomeContent,
  readSellerHome,
  writeSellerHome,
} from "../../../../lib/storefront-home";
import {
  queryGraph,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";
import { sellerProducts } from "../../../../lib/seller-products";

/** The store's own page content (banners and featured products) with what it can use. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const [content, products, { data: categories }] = await Promise.all([
    readSellerHome(req.scope, actor.sellerId),
    sellerProducts(req, actor.sellerId),
    queryGraph(req).graph({ entity: "product_category", fields: ["id", "name"] }),
  ]);
  res.json({
    content,
    products,
    categories: categories.sort((a, b) => String(a.name).localeCompare(String(b.name), "es")),
    can_edit: actor.isManager,
  });
}

/** Only the owner or the store's administration may change it; only its own products. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const products = await sellerProducts(req, actor.sellerId);
  const content = checkSellerHome(
    parseHomeContent(req.body),
    actor.sellerId,
    new Set(products.map((product) => product.id)),
  );
  res.json({ content: await writeSellerHome(req.scope, actor.sellerId, content) });
}
