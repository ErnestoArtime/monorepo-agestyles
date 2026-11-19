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

/** Products this store sells (it has an offer for them), for featuring and banner links. */
async function ownProducts(req: CommissionRequest, sellerId: string) {
  const { data } = await queryGraph(req).graph({
    entity: "offer",
    fields: ["product_id", "product.id", "product.title", "product.thumbnail", "product.status"],
    filters: { seller_id: sellerId },
  });
  const products = new Map<string, { id: string; title: string; thumbnail: string | null }>();
  for (const offer of data as {
    product_id: string;
    product?: { id: string; title: string; thumbnail: string | null; status: string } | null;
  }[]) {
    if (offer.product && offer.product.status === "published")
      products.set(offer.product_id, {
        id: offer.product.id,
        title: offer.product.title,
        thumbnail: offer.product.thumbnail,
      });
  }
  return [...products.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
}

/** The store's own page content (banners and featured products) with what it can use. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const [content, products, { data: categories }] = await Promise.all([
    readSellerHome(req.scope, actor.sellerId),
    ownProducts(req, actor.sellerId),
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
  const products = await ownProducts(req, actor.sellerId);
  const content = checkSellerHome(
    parseHomeContent(req.body),
    actor.sellerId,
    new Set(products.map((product) => product.id)),
  );
  res.json({ content: await writeSellerHome(req.scope, actor.sellerId, content) });
}
