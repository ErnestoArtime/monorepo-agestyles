import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  commissionsService,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../../lib/vendor-commissions";

/** Removes a rule. Commission already earned stays in the ledger. */
export async function DELETE(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const service = commissionsService(req);
  const [rule] = await service.listCommissionRules({
    id: req.params.id,
    seller_id: actor.sellerId,
  });
  if (!rule) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Commission rule not found.");
  await service.softDeleteCommissionRules(rule.id);
  res.json({ id: rule.id, deleted: true });
}
