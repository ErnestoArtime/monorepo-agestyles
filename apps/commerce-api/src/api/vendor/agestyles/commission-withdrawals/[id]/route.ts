import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { ledgerBalance, validateWithdrawal, type EntryKind } from "@agestyles/sales-commissions";
import {
  asInvalidData,
  commissionsService,
  requireManager,
  resolveCommissionActor,
  toNumber,
  type CommissionRequest,
} from "../../../../../lib/vendor-commissions";

/**
 * The owner confirms that the cash was handed over (`paid`), which debits the
 * balance, or rejects the request. Only requested withdrawals can change.
 */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const body = (req.body ?? {}) as { status?: unknown; note?: unknown };
  if (body.status !== "paid" && body.status !== "rejected") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Indica si el retiro se entregó o se rechaza.",
    );
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
  const service = commissionsService(req);
  const [withdrawal] = await service.listCommissionWithdrawals({
    id: req.params.id,
    seller_id: actor.sellerId,
  });
  if (!withdrawal) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Withdrawal not found.");

  const locking = req.scope.resolve(Modules.LOCKING);
  const updated = await locking.execute(
    `agestyles-agent:${withdrawal.agent_id}`,
    async () => {
      const [current] = await service.listCommissionWithdrawals({ id: withdrawal.id });
      if (current?.status !== "requested") {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Este retiro ya se resolvió.");
      }
      const confirmation = {
        id: withdrawal.id,
        status: body.status as "paid" | "rejected",
        confirmed_by: actor.memberId,
        confirmed_at: new Date(),
        note,
      };
      if (body.status === "rejected") return service.updateCommissionWithdrawals(confirmation);

      const entries = await service.listCommissionEntries({ agent_id: withdrawal.agent_id });
      const balance = ledgerBalance(
        entries.map((entry) => ({ kind: entry.kind as EntryKind, amount: toNumber(entry.amount) })),
      );
      const amount = asInvalidData(() => validateWithdrawal(toNumber(withdrawal.amount), balance));
      const entry = await service.createCommissionEntries({
        seller_id: actor.sellerId,
        agent_id: withdrawal.agent_id,
        kind: "withdrawn",
        amount,
        currency_code: withdrawal.currency_code,
        withdrawal_id: withdrawal.id,
      });
      try {
        return await service.updateCommissionWithdrawals(confirmation);
      } catch (error) {
        await service.deleteCommissionEntries(entry.id);
        throw error;
      }
    },
    { timeout: 10 },
  );
  res.json({ commission_withdrawal: updated });
}
