import type { MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  ledgerBalance,
  roundMoney,
  validateWithdrawal,
  type EntryKind,
} from "@agestyles/sales-commissions";
import {
  asInvalidData,
  commissionsService,
  requireAgent,
  resolveCommissionActor,
  scopedAgentId,
  toNumber,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";
import { AGESTYLES_EVENTS, emitAgestylesEventSafely } from "../../../../lib/notifications";

/** Agents list their withdrawals; managers list the store's (optionally by agent or status). */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const agentId = scopedAgentId(actor, req.query.agent_id);
  const status = ["requested", "paid", "rejected"].includes(String(req.query.status))
    ? String(req.query.status)
    : undefined;
  const withdrawals = await commissionsService(req).listCommissionWithdrawals(
    {
      seller_id: actor.sellerId,
      ...(agentId ? { agent_id: agentId } : {}),
      ...(status ? { status } : {}),
    },
    { order: { created_at: "DESC" }, take: 100 },
  );
  res.json({ commission_withdrawals: withdrawals });
}

/** The agent asks to withdraw part of the available balance in cash. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const agent = requireAgent(actor);
  const service = commissionsService(req);
  const locking = req.scope.resolve(Modules.LOCKING);
  const withdrawal = await locking.execute(
    `agestyles-agent:${agent.id}`,
    async () => {
      const [entries, pending] = await Promise.all([
        service.listCommissionEntries({ agent_id: agent.id }),
        service.listCommissionWithdrawals({ agent_id: agent.id, status: "requested" }),
      ]);
      const balance = ledgerBalance(
        entries.map((entry) => ({ kind: entry.kind as EntryKind, amount: toNumber(entry.amount) })),
      );
      const available = roundMoney(
        balance - pending.reduce((sum, item) => sum + toNumber(item.amount), 0),
      );
      const amount = asInvalidData(() =>
        validateWithdrawal((req.body as { amount?: unknown } | undefined)?.amount, available),
      );
      return service.createCommissionWithdrawals({
        seller_id: actor.sellerId,
        agent_id: agent.id,
        amount,
        currency_code: "usd",
        status: "requested",
      });
    },
    { timeout: 10 },
  );
  await emitAgestylesEventSafely(req.scope, AGESTYLES_EVENTS.WITHDRAWAL_REQUESTED, {
    withdrawal_id: withdrawal.id,
    seller_id: actor.sellerId,
  });
  res.status(201).json({ commission_withdrawal: withdrawal });
}
