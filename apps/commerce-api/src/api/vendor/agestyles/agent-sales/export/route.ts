import type { MedusaResponse } from "@medusajs/framework/http";
import {
  parseSalesFilters,
  salesServiceFilters,
  salesToCsv,
  type SaleRecord,
} from "@agestyles/sales-commissions";
import {
  commissionsService,
  requireManager,
  resolveCommissionActor,
  scopedAgentId,
  type CommissionRequest,
} from "../../../../../lib/vendor-commissions";

const MAX_EXPORT_SALES = 5000;

/** CSV of the store's agent sales (one row per line) with the same filters as the list. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const agentId = scopedAgentId(actor, req.query.agent_id);
  const filters = parseSalesFilters(req.query as Record<string, unknown>);
  const service = commissionsService(req);
  const [sales, agents] = await Promise.all([
    service.listAgentSales(salesServiceFilters(actor.sellerId, filters, agentId), {
      order: { created_at: "DESC" },
      take: MAX_EXPORT_SALES,
    }),
    service.listSalesAgents({ seller_id: actor.sellerId }),
  ]);
  const labels = new Map(
    (agents as unknown as { id: string; member_email: string | null; code: string }[]).map(
      (agent) => [agent.id, agent.member_email ?? agent.code],
    ),
  );
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="ventas-gestores-${date}.csv"`);
  res.setHeader("cache-control", "no-store");
  res.send(salesToCsv(sales as unknown as SaleRecord[], labels));
}
