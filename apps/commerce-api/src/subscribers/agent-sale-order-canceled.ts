import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { reverseOnlineAgentSale } from "../lib/agent-online-sales";
import { withNotificationRetries } from "../lib/notifications";

/** AG-06 phase 4: canceling an order reverses its online agent sale and any commission earned. */
async function reverseAgentSaleOnCancel({ event, container }: SubscriberArgs<{ id: string }>) {
  await reverseOnlineAgentSale(container, event.data.id);
}

export default withNotificationRetries("agent-sale-order-canceled", reverseAgentSaleOnCancel);

export const config: SubscriberConfig = {
  event: "order.canceled",
  context: { subscriberId: "agestyles-agent-sale-order-canceled" },
};
