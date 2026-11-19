import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  AGESTYLES_SALES_COMMISSIONS_MODULE,
  type SalesCommissionsService,
} from "@agestyles/sales-commissions";
import { recordOnlineAgentSale } from "../lib/agent-online-sales";
import { notifySellerMembers, withNotificationRetries } from "../lib/notifications";

type Sale = {
  id: string;
  seller_id: string;
  agent_id: string;
  currency_code: string;
  lines?: { commission?: number | string | null }[];
};

/**
 * AG-06 phase 4: an order placed with an agent code of its store becomes a pending agent
 * sale. AG-40: the agent hears that the purchase earns them a commission.
 */
async function recordAgentSaleOnOrderPlaced({ event, container }: SubscriberArgs<{ id: string }>) {
  const sale = (await recordOnlineAgentSale(container, event.data.id)) as unknown as Sale | null;
  if (!sale) return;
  const service = container.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
  const [agent] = (await service.listSalesAgents({ id: sale.agent_id })) as unknown as {
    member_id: string;
  }[];
  if (!agent) return;
  const commission = (sale.lines ?? []).reduce(
    (sum, line) => sum + Number(line.commission ?? 0),
    0,
  );
  await notifySellerMembers(container, {
    event_code: "agent_commission_earned",
    seller_id: sale.seller_id,
    target_member_id: agent.member_id,
    params: {
      amount:
        commission > 0
          ? new Intl.NumberFormat("es-ES", {
              style: "currency",
              currency: sale.currency_code.toUpperCase(),
            }).format(commission)
          : null,
    },
    key: ["agent_commission_earned", sale.id],
  });
}

export default withNotificationRetries("agent-sale-order-placed", recordAgentSaleOnOrderPlaced);

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "agestyles-agent-sale-order-placed" },
};
