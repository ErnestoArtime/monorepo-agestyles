import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { recordOnlineAgentSale } from "../lib/agent-online-sales";
import { withNotificationRetries } from "../lib/notifications";

/** AG-06 phase 4: an order placed with an agent code of its store becomes a pending agent sale. */
async function recordAgentSaleOnOrderPlaced({ event, container }: SubscriberArgs<{ id: string }>) {
  await recordOnlineAgentSale(container, event.data.id);
}

export default withNotificationRetries("agent-sale-order-placed", recordAgentSaleOnOrderPlaced);

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "agestyles-agent-sale-order-placed" },
};
