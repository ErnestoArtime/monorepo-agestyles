import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { parseRuleInput } from "@agestyles/sales-commissions";
import {
  asInvalidData,
  commissionsService,
  queryGraph,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";

/** Store rules are visible to managers and agents of the store (agents need them to know what they earn). */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  if (!actor.isManager && !actor.agent) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Commission rules are not available.");
  }
  const rules = await commissionsService(req).listCommissionRules(
    { seller_id: actor.sellerId },
    { order: { created_at: "ASC" } },
  );
  res.json({ commission_rules: rules });
}

/** Creates or replaces the store-wide rule (no product) or a product's own rule. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const input = asInvalidData(() => parseRuleInput(req.body));
  if (input.product_id) {
    const { data } = await queryGraph(req).graph({
      entity: "offer",
      fields: ["id"],
      filters: { seller_id: actor.sellerId, product_id: input.product_id },
    });
    if (!data.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "This store does not sell that product.");
    }
  }
  const service = commissionsService(req);
  const [existing] = await service.listCommissionRules({
    seller_id: actor.sellerId,
    product_id: input.product_id,
  });
  const rule = existing
    ? await service.updateCommissionRules({ id: existing.id, ...input })
    : await service.createCommissionRules({ seller_id: actor.sellerId, ...input });
  res.status(existing ? 200 : 201).json({ commission_rule: rule });
}
