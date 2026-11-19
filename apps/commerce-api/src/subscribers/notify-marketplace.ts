import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  notifyAdmins,
  notifySellerMembers,
  queryGraph,
  sellerName,
  withNotificationRetries,
} from "../lib/notifications";

/**
 * Marketplace events of Mercur 2.4.1 (AG-40): a new store or a product sent for review
 * reaches the administration; approving or suspending a store reaches its managers.
 * Event names from `@mercurjs/core` workflows/events (seller.*) and product-edit/events.
 */
async function notifyMarketplace({ event, container }: SubscriberArgs<{ id: string }>) {
  const id = event.data?.id;
  if (!id) return;
  if (event.name === "seller.created") {
    await notifyAdmins(container, {
      event_code: "admin_store_registered",
      params: { store: await sellerName(container, id) },
      key: [event.name, id],
    });
    return;
  }
  if (event.name === "seller.approved" || event.name === "seller.suspended") {
    await notifySellerMembers(container, {
      event_code:
        event.name === "seller.approved" ? "seller_store_approved" : "seller_store_suspended",
      seller_id: id,
      params: { store: await sellerName(container, id) },
      // A store can be suspended more than once: one notice per day and state.
      key: [event.name, id, new Date().toISOString().slice(0, 10)],
    });
    return;
  }
  if (event.name === "product-change.created") {
    const query = queryGraph(container);
    const { data: changes } = await query.graph({
      entity: "product_change",
      fields: ["id", "product_id"],
      filters: { id },
    });
    const productId = (changes[0] as { product_id?: string } | undefined)?.product_id;
    if (!productId) return;
    const [{ data: products }, { data: links }] = await Promise.all([
      query.graph({ entity: "product", fields: ["id", "title"], filters: { id: productId } }),
      query.graph({
        entity: "product_seller",
        fields: ["seller_id"],
        filters: { product_id: productId },
      }),
    ]);
    const sellerId = (links[0] as { seller_id?: string } | undefined)?.seller_id;
    await notifyAdmins(container, {
      event_code: "admin_product_review",
      params: {
        product: (products[0] as { title?: string } | undefined)?.title ?? null,
        store: sellerId ? await sellerName(container, sellerId) : null,
      },
      key: [event.name, id],
    });
  }
}

export default withNotificationRetries("notify-marketplace", notifyMarketplace);

export const config: SubscriberConfig = {
  event: ["seller.created", "seller.approved", "seller.suspended", "product-change.created"],
  context: { subscriberId: "agestyles-notify-marketplace" },
};
