import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  AGESTYLES_MANUAL_PAYMENTS_MODULE,
  type ManualPaymentsService,
} from "@agestyles/manual-payments";
import {
  buildAnalytics,
  type AnalyticsAgentSale,
  type AnalyticsOrder,
  type StockItem,
} from "../../../../lib/analytics";
import {
  commissionsService,
  queryGraph,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";

type Request = CommissionRequest & {
  permissions?: Record<string, string | undefined>;
  permissions_enforced?: boolean;
};

const DAY = 86_400_000;
const MAX_DAYS = 366;
const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "status",
  "currency_code",
  "items.product_id",
  "items.product_title",
  "items.title",
  "items.thumbnail",
  "items.quantity",
  "items.unit_price",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
];

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * «Análisis» of the selected store (AG-39): sales by period against the previous one, best
 * sellers, products without rotation, products running out, open orders by stage and, for
 * the owner and the store's administration, sales agents and commissions. Read only.
 */
export async function GET(req: Request, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const orderRight = req.permissions?.orders;
  if (
    !actor.isManager &&
    !(req.permissions_enforced === true && ["view", "edit", "manage"].includes(orderRight ?? ""))
  ) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Store analytics are not allowed.");
  }
  const now = new Date();
  const to = parseDate(req.query.to) ?? now;
  let from = parseDate(req.query.from) ?? new Date(to.getTime() - 29 * DAY);
  if (from > to) from = new Date(to.getTime() - 29 * DAY);
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY)
    from = new Date(to.getTime() - MAX_DAYS * DAY);
  const span = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - span - DAY);
  // Rotation needs 90 days of history whatever the chosen period.
  const historyFrom = new Date(Math.min(previousFrom.getTime(), now.getTime() - 90 * DAY));

  const query = queryGraph(req);
  const sellerId = actor.sellerId;
  const { data: links } = await query.graph({
    entity: "order_seller",
    fields: ["order_id"],
    filters: { seller_id: sellerId },
  });
  const orderIds = (links as { order_id: string }[]).map((link) => link.order_id);
  const orders = orderIds.length
    ? ((
        await query.graph({
          entity: "order",
          fields: ORDER_FIELDS,
          filters: { id: orderIds, is_draft_order: false },
        })
      ).data as unknown as AnalyticsOrder[])
    : [];

  const service = commissionsService(req);
  const [agentSales, agents, stockLinks, pendingPayments] = await Promise.all([
    service.listAgentSales(
      { seller_id: sellerId, created_at: { $gte: historyFrom } },
      { take: 20_000, order: { created_at: "ASC" } },
    ) as unknown as Promise<(AnalyticsAgentSale & { seller_id: string })[]>,
    service.listSalesAgents({ seller_id: sellerId }) as unknown as Promise<
      { id: string; code: string; member_email: string | null }[]
    >,
    query.graph({
      entity: "inventory_item_seller",
      fields: ["inventory_item_id"],
      filters: { seller_id: sellerId },
    }),
    req.scope
      .resolve<ManualPaymentsService>(AGESTYLES_MANUAL_PAYMENTS_MODULE)
      .listManualPayments({ seller_id: sellerId, status: "pending" })
      .then((rows: unknown[]) => rows.length)
      .catch(() => 0),
  ]);

  const itemIds = (stockLinks.data as { inventory_item_id: string }[]).map(
    (link) => link.inventory_item_id,
  );
  const items = itemIds.length
    ? ((
        await query.graph({
          entity: "inventory_item",
          fields: [
            "id",
            "title",
            "location_levels.stocked_quantity",
            "location_levels.reserved_quantity",
            "variants.product.id",
            "variants.product.title",
            "variants.product.thumbnail",
          ],
          filters: { id: itemIds },
        })
      ).data as {
        title?: string | null;
        location_levels?: { stocked_quantity?: number | null; reserved_quantity?: number | null }[];
        variants?: { product?: { id: string; title: string; thumbnail?: string | null } | null }[];
      }[])
    : [];
  const stock: StockItem[] = items.map((item) => {
    const product = item.variants?.find((variant) => variant.product)?.product ?? null;
    return {
      product_id: product?.id ?? null,
      title: product?.title ?? item.title ?? "Producto",
      thumbnail: product?.thumbnail ?? null,
      available: (item.location_levels ?? []).reduce(
        (sum, level) =>
          sum + Number(level.stocked_quantity ?? 0) - Number(level.reserved_quantity ?? 0),
        0,
      ),
    };
  });

  const inRange = (date: string | Date, start: Date, end: Date) => {
    const t = new Date(date).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
  const live = orders.filter((order) => order.status !== "canceled");
  const recentSales = [
    ...live
      .filter((order) => inRange(order.created_at, new Date(now.getTime() - 90 * DAY), now))
      .flatMap((order) =>
        (order.items ?? []).map((item) => ({
          product_id: item.product_id ?? "",
          quantity: Number(item.quantity ?? 0),
          at: new Date(order.created_at),
        })),
      ),
    ...agentSales
      .filter(
        (sale) =>
          sale.source === "manual" &&
          sale.status !== "reversed" &&
          inRange(sale.created_at, new Date(now.getTime() - 90 * DAY), now),
      )
      .flatMap((sale) =>
        (sale.lines ?? []).map((line) => ({
          product_id: line.product_id,
          quantity: Number(line.quantity ?? 0),
          at: new Date(sale.created_at),
        })),
      ),
  ].filter((sale) => sale.product_id);

  // Open orders count whatever their date; the period only filters sales.
  const periodOrders = orders.filter((order) => inRange(order.created_at, from, to));
  const previousOrders = orders.filter((order) => inRange(order.created_at, previousFrom, from));

  const result = buildAnalytics({
    from,
    to,
    now,
    orders: periodOrders,
    previousOrders,
    openOrders: orders,
    agentSales: agentSales.filter((sale) => inRange(sale.created_at, from, to)),
    previousAgentSales: agentSales.filter((sale) => inRange(sale.created_at, previousFrom, from)),
    recentSales,
    stock,
    pendingPayments,
    agents: agents.map((agent) => ({ id: agent.id, name: agent.member_email ?? agent.code })),
    includeAgents: actor.isManager,
  });
  res.json(result);
}
