import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { withNotificationRetries } from "../lib/notifications";
import { notifyFollowersOfNewProduct } from "../lib/store-follows";

/**
 * AG-70: when a product becomes published (Mercur's review workflow emits `product.published`),
 * followers of its store who turned the alert on get a push. Deduplicated per product and
 * customer, so a retry or a second publication never repeats it.
 */
async function notifyStoreFollowers({ event, container }: SubscriberArgs<{ id: string }>) {
  await notifyFollowersOfNewProduct(container, event.data.id);
}

export default withNotificationRetries("notify-store-followers", notifyStoreFollowers);

export const config: SubscriberConfig = {
  event: "product.published",
  context: { subscriberId: "agestyles-notify-store-followers" },
};
