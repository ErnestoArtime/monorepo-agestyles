import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { parseReversalNote } from "@agestyles/sales-commissions";
import { reverseAgentSale } from "../../../../../../lib/agent-online-sales";
import {
  commissionsService,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../../../lib/vendor-commissions";

/**
 * The owner or administration reverses a sale of the store (a return, a mistake): the
 * commission it earned is debited from the agent's balance with `reversed` entries.
 * Stock is not changed; returned goods are registered as an «alta» in Movimientos.
 */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const [sale] = (await commissionsService(req).listAgentSales({
    id: req.params.id,
    seller_id: actor.sellerId,
  })) as unknown as { id: string; status: string }[];
  if (!sale) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "The sale was not found in this store.");
  }
  if (sale.status === "reversed") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Esta venta ya está anulada.");
  }
  const result = await reverseAgentSale(req.scope, sale.id, {
    note: parseReversalNote(req.body) ?? "anulada por la tienda",
  });
  res.json({ agent_sale: result?.sale ?? null, reversed: result?.reversed ?? 0 });
}
