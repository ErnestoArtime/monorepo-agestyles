import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { normalizeAgentCode } from "@agestyles/sales-commissions";
import {
  commissionsService,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../../lib/vendor-commissions";

/** Activates/deactivates an agent or changes their code. History and balance are kept. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const service = commissionsService(req);
  const [agent] = await service.listSalesAgents({ id: req.params.id, seller_id: actor.sellerId });
  if (!agent) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sales agent not found.");
  const body = (req.body ?? {}) as { active?: unknown; code?: unknown };
  const update: { id: string; active?: boolean; code?: string } = { id: agent.id };
  if (typeof body.active === "boolean") update.active = body.active;
  if (body.code !== undefined) {
    const code = normalizeAgentCode(body.code);
    if (!code) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El código del gestor debe tener entre 4 y 12 letras o números.",
      );
    }
    const [taken] = await service.listSalesAgents({ code });
    if (taken && taken.id !== agent.id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Ese código ya está en uso.");
    }
    update.code = code;
  }
  res.json({ sales_agent: await service.updateSalesAgents(update) });
}
