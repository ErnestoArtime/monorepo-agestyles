import type { CommissionRequest } from "./vendor-commissions";
import { queryGraph } from "./vendor-commissions";

/** Published products this store sells (it has an offer for them). */
export async function sellerProducts(req: CommissionRequest, sellerId: string) {
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
