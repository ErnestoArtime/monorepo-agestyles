import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import type { EventCode } from "@agestyles/notifications";
import { notifySellerMembers, queryGraph, withNotificationRetries } from "../lib/notifications";

const CODES: Record<string, EventCode> = {
  "product.published": "seller_product_approved",
  "product.rejected": "seller_product_rejected",
  "product.change-requested": "seller_product_changes_requested",
};

/** Mercur's review workflow already emits these; the owning store's managers hear the verdict. */
async function notifyProductReview({ event, container }: SubscriberArgs<{ id: string }>) {
  const code = CODES[event.name];
  if (!code) return;
  const query = queryGraph(container);
  const [{ data: links }, { data: products }] = await Promise.all([
    query.graph({
      entity: "product_seller",
      fields: ["seller_id"],
      filters: { product_id: event.data.id },
    }),
    query.graph({ entity: "product", fields: ["id", "title"], filters: { id: event.data.id } }),
  ]);
  const sellerId = (links[0] as { seller_id?: string } | undefined)?.seller_id;
  if (!sellerId) return;
  await notifySellerMembers(container, {
    event_code: code,
    seller_id: sellerId,
    params: { product: (products[0] as { title?: string } | undefined)?.title },
    key: [event.name, event.data.id],
  });
}

export default withNotificationRetries("notify-product-review", notifyProductReview);

export const config: SubscriberConfig = {
  event: ["product.published", "product.rejected", "product.change-requested"],
  context: { subscriberId: "agestyles-notify-product-review" },
};
