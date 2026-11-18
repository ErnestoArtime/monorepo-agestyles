import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  AGESTYLES_EVENTS,
  notifySellerMembers,
  withNotificationRetries,
} from "../lib/notifications";

type WithdrawalEvent = {
  withdrawal_id: string;
  seller_id: string;
  status?: "paid" | "rejected";
  agent_member_id?: string;
};

/** Request → store managers; resolution → the agent who asked. */
async function notifyCommissionWithdrawals({ event, container }: SubscriberArgs<WithdrawalEvent>) {
  const { withdrawal_id: withdrawalId, seller_id: sellerId } = event.data;
  if (event.name === AGESTYLES_EVENTS.WITHDRAWAL_REQUESTED) {
    await notifySellerMembers(container, {
      event_code: "commission_withdrawal_requested",
      seller_id: sellerId,
      key: [event.name, withdrawalId],
    });
    return;
  }
  if (!event.data.agent_member_id || !event.data.status) return;
  await notifySellerMembers(container, {
    event_code:
      event.data.status === "paid"
        ? "commission_withdrawal_paid"
        : "commission_withdrawal_rejected",
    seller_id: sellerId,
    key: [event.name, withdrawalId, event.data.status],
    target_member_id: event.data.agent_member_id,
  });
}

export default withNotificationRetries(
  "notify-commission-withdrawals",
  notifyCommissionWithdrawals,
);

export const config: SubscriberConfig = {
  event: [AGESTYLES_EVENTS.WITHDRAWAL_REQUESTED, AGESTYLES_EVENTS.WITHDRAWAL_RESOLVED],
  context: { subscriberId: "agestyles-notify-commission-withdrawals" },
};
