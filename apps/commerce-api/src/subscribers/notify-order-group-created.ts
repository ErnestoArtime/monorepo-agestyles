import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifyCustomer, queryGraph, withNotificationRetries } from "../lib/notifications";

/** One «Pedido recibido» per checkout (order group), not one per store. */
async function notifyOrderGroupCreated({ event, container }: SubscriberArgs<{ id: string }>) {
  const { data } = await queryGraph(container).graph({
    entity: "order_group",
    fields: ["id", "customer_id"],
    filters: { id: event.data.id },
  });
  const group = data[0] as { id: string; customer_id?: string | null } | undefined;
  if (!group?.customer_id) return;
  await notifyCustomer(container, {
    event_code: "order_placed",
    customer_id: group.customer_id,
    key: ["order_group.created", group.id],
  });
}

export default withNotificationRetries("notify-order-group-created", notifyOrderGroupCreated);

export const config: SubscriberConfig = {
  event: "order_group.created",
  context: { subscriberId: "agestyles-notify-order-group-created" },
};
