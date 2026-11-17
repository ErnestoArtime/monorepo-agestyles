import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  ledgerBalance,
  roundMoney,
  unitsToNextThreshold,
  type CommissionRule,
  type EntryKind,
} from "@agestyles/sales-commissions";
import {
  commissionsService,
  resolveCommissionActor,
  scopedAgentId,
  toNumber,
  type CommissionRequest,
} from "../../../../../lib/vendor-commissions";

/**
 * Balance of an agent: earned minus reversals and paid withdrawals, minus what
 * is already requested and waiting for the owner. Includes the progress
 * towards cumulative thresholds. Agents see their own; managers pass agent_id.
 */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const agentId = scopedAgentId(actor, req.query.agent_id);
  if (!agentId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Indica el gestor.");
  const service = commissionsService(req);
  const [agent] = await service.listSalesAgents({ id: agentId, seller_id: actor.sellerId });
  if (!agent) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sales agent not found.");

  const [entries, pending, rules, sales] = await Promise.all([
    service.listCommissionEntries(
      { agent_id: agentId, seller_id: actor.sellerId },
      { order: { created_at: "DESC" } },
    ),
    service.listCommissionWithdrawals({ agent_id: agentId, status: "requested" }),
    service.listCommissionRules({ seller_id: actor.sellerId }),
    service.listAgentSales({ agent_id: agentId, status: "paid" }),
  ]);
  const balance = ledgerBalance(
    entries.map((entry) => ({ kind: entry.kind as EntryKind, amount: toNumber(entry.amount) })),
  );
  const requested = roundMoney(pending.reduce((sum, item) => sum + toNumber(item.amount), 0));

  const unitsSold = new Map<string, number>();
  for (const sale of sales) {
    for (const line of (sale.lines as unknown as { product_id: string; quantity: number }[]) ??
      []) {
      unitsSold.set(line.product_id, (unitsSold.get(line.product_id) ?? 0) + Number(line.quantity));
    }
  }
  const progress = (rules as unknown as CommissionRule[])
    .filter((rule) => rule.unit_threshold && rule.product_id)
    .map((rule) => ({
      product_id: rule.product_id,
      unit_threshold: rule.unit_threshold,
      units_sold: unitsSold.get(rule.product_id as string) ?? 0,
      units_to_next: unitsToNextThreshold(
        { ...rule, value: Number(rule.value) },
        unitsSold.get(rule.product_id as string) ?? 0,
      ),
    }));

  res.json({
    agent_id: agentId,
    currency_code: "usd",
    balance,
    requested,
    available: roundMoney(balance - requested),
    entries: entries.slice(0, 50),
    progress,
  });
}
