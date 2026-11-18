import type { MedusaResponse } from "@medusajs/framework/http";
import {
  buildSalesReport,
  MAX_REPORT_DAYS,
  parseSalesFilters,
  salesServiceFilters,
  type SaleRecord,
} from "@agestyles/sales-commissions";
import {
  commissionsService,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../../lib/vendor-commissions";

const DAY = 24 * 60 * 60 * 1000;
const MAX_REPORT_SALES = 10_000;

/**
 * Managers' report for a period (default: last 30 days): daily revenue, agent ranking and
 * best-selling products of the store's agent sales. Reversed sales are excluded.
 */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const filters = parseSalesFilters(req.query as Record<string, unknown>);
  const to = filters.to ?? new Date();
  let from = filters.from ?? new Date(to.getTime() - 29 * DAY);
  if (to.getTime() - from.getTime() > MAX_REPORT_DAYS * DAY) {
    from = new Date(to.getTime() - MAX_REPORT_DAYS * DAY);
  }
  const sales = await commissionsService(req).listAgentSales(
    salesServiceFilters(actor.sellerId, { ...filters, from, to }),
    { order: { created_at: "ASC" }, take: MAX_REPORT_SALES },
  );
  res.json({
    from: from.toISOString(),
    to: to.toISOString(),
    truncated: sales.length >= MAX_REPORT_SALES,
    report: buildSalesReport(sales as unknown as SaleRecord[]),
  });
}
