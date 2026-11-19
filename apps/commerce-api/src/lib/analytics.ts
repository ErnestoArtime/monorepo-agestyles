/**
 * Commercial analytics for one store (AG-39). Pure functions over data the API already has:
 * online orders of the store (Mercur `order_seller`), in-store sales of sales agents
 * (AG-06, `source: "manual"`; online agent sales are the same orders and are not counted
 * twice), stock of the store's inventory items, preparation stages (AG-04) and manual
 * payments. No purchase cost exists yet, so there is no profitability (user decision).
 */

export type AnalyticsOrder = {
  id: string;
  display_id?: number | null;
  created_at: string | Date;
  status?: string | null;
  currency_code?: string | null;
  items?: {
    product_id?: string | null;
    product_title?: string | null;
    title?: string | null;
    thumbnail?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
  }[];
  fulfillments?: {
    packed_at?: string | Date | null;
    shipped_at?: string | Date | null;
    delivered_at?: string | Date | null;
    canceled_at?: string | Date | null;
  }[];
};

export type AnalyticsAgentSale = {
  id: string;
  agent_id: string;
  source: string;
  status: string;
  total: number | string;
  commission_total?: number | string | null;
  created_at: string | Date;
  lines?: {
    product_id: string;
    title?: string | null;
    quantity: number;
    unit_price: number | string;
    commission?: number | string | null;
  }[];
};

export type StockItem = {
  product_id: string | null;
  title: string;
  thumbnail?: string | null;
  available: number;
};

export type Stage = "unprepared" | "preparing" | "ready" | "shipped";

export type AnalyticsInput = {
  from: Date;
  to: Date;
  now: Date;
  orders: AnalyticsOrder[];
  previousOrders: AnalyticsOrder[];
  /** Every order of the store: open ones are pending work whatever their date. */
  openOrders: AnalyticsOrder[];
  agentSales: AnalyticsAgentSale[];
  previousAgentSales: AnalyticsAgentSale[];
  /** Units sold per product in the last 90 days (orders + in-store), for rotation and cover. */
  recentSales: { product_id: string; quantity: number; at: Date }[];
  stock: StockItem[];
  pendingPayments: number;
  agents: { id: string; name: string }[];
  /** Only owners and the store's administration see sales agents and commissions. */
  includeAgents: boolean;
  thresholds?: { staleDays?: number; coverDays?: number };
};

const DAY = 86_400_000;
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const round = (value: number) => Math.round(value * 100) / 100;

const liveOrder = (order: AnalyticsOrder) =>
  order.status !== "canceled" && order.status !== "draft";
const countedSale = (sale: AnalyticsAgentSale) =>
  sale.source === "manual" && sale.status !== "reversed" && sale.status !== "canceled";

function orderAmount(order: AnalyticsOrder) {
  return (order.items ?? []).reduce(
    (sum, item) => sum + num(item.unit_price) * num(item.quantity),
    0,
  );
}
function orderUnits(order: AnalyticsOrder) {
  return (order.items ?? []).reduce((sum, item) => sum + num(item.quantity), 0);
}

/** Preparation stage from the order's fulfillments (AG-04); null when finished or cancelled. */
export function orderStage(order: AnalyticsOrder): Stage | null {
  if (!liveOrder(order) || order.status === "completed" || order.status === "archived") return null;
  const active = (order.fulfillments ?? []).filter((f) => !f.canceled_at);
  if (!active.length) return "unprepared";
  if (active.every((f) => f.delivered_at)) return null;
  if (active.some((f) => f.shipped_at)) return "shipped";
  if (active.some((f) => f.packed_at)) return "ready";
  return "preparing";
}

function totals(orders: AnalyticsOrder[], sales: AnalyticsAgentSale[]) {
  const online = orders.filter(liveOrder);
  const inStore = sales.filter(countedSale);
  const onlineAmount = online.reduce((sum, order) => sum + orderAmount(order), 0);
  const inStoreAmount = inStore.reduce((sum, sale) => sum + num(sale.total), 0);
  const count = online.length + inStore.length;
  const units =
    online.reduce((sum, order) => sum + orderUnits(order), 0) +
    inStore.reduce(
      (sum, sale) => sum + (sale.lines ?? []).reduce((s, line) => s + num(line.quantity), 0),
      0,
    );
  return {
    amount: round(onlineAmount + inStoreAmount),
    online_amount: round(onlineAmount),
    in_store_amount: round(inStoreAmount),
    count,
    units,
    average_ticket: count ? round((onlineAmount + inStoreAmount) / count) : 0,
  };
}

const change = (current: number, previous: number) =>
  previous ? round(((current - previous) / previous) * 100) : null;

export function buildAnalytics(input: AnalyticsInput) {
  const staleDays = input.thresholds?.staleDays ?? 60;
  const coverDays = input.thresholds?.coverDays ?? 7;
  const current = totals(input.orders, input.agentSales);
  const previous = totals(input.previousOrders, input.previousAgentSales);

  // Daily series for the chart: every day of the period, zero when nothing was sold.
  const days = new Map<string, { amount: number; count: number }>();
  for (let t = Date.parse(dayKey(input.from)); t <= input.to.getTime(); t += DAY) {
    days.set(dayKey(new Date(t)), { amount: 0, count: 0 });
  }
  const addDay = (at: Date, amount: number) => {
    const entry = days.get(dayKey(at));
    if (!entry) return;
    entry.amount = round(entry.amount + amount);
    entry.count += 1;
  };
  for (const order of input.orders.filter(liveOrder))
    addDay(new Date(order.created_at), orderAmount(order));
  for (const sale of input.agentSales.filter(countedSale))
    addDay(new Date(sale.created_at), num(sale.total));

  // Best sellers of the period.
  const products = new Map<
    string,
    { product_id: string; title: string; thumbnail: string | null; units: number; amount: number }
  >();
  const addProduct = (
    id: string | null | undefined,
    title: string | null | undefined,
    thumbnail: string | null | undefined,
    units: number,
    amount: number,
  ) => {
    if (!id) return;
    const entry = products.get(id) ?? {
      product_id: id,
      title: title ?? "Producto",
      thumbnail: thumbnail ?? null,
      units: 0,
      amount: 0,
    };
    entry.units += units;
    entry.amount = round(entry.amount + amount);
    if (!entry.thumbnail && thumbnail) entry.thumbnail = thumbnail;
    products.set(id, entry);
  };
  for (const order of input.orders.filter(liveOrder))
    for (const item of order.items ?? [])
      addProduct(
        item.product_id,
        item.product_title ?? item.title,
        item.thumbnail,
        num(item.quantity),
        num(item.unit_price) * num(item.quantity),
      );
  for (const sale of input.agentSales.filter(countedSale))
    for (const line of sale.lines ?? [])
      addProduct(
        line.product_id,
        line.title,
        null,
        num(line.quantity),
        num(line.unit_price) * num(line.quantity),
      );

  // Rotation and stock cover from the last 90 days of sales.
  const lastSale = new Map<string, number>();
  const sold30 = new Map<string, number>();
  for (const sale of input.recentSales) {
    lastSale.set(sale.product_id, Math.max(lastSale.get(sale.product_id) ?? 0, sale.at.getTime()));
    if (input.now.getTime() - sale.at.getTime() <= 30 * DAY)
      sold30.set(sale.product_id, (sold30.get(sale.product_id) ?? 0) + sale.quantity);
  }
  const byProduct = new Map<string, StockItem & { product_id: string }>();
  for (const item of input.stock) {
    if (!item.product_id) continue;
    const entry = byProduct.get(item.product_id);
    if (entry) entry.available += item.available;
    else byProduct.set(item.product_id, { ...item, product_id: item.product_id });
  }
  const stale: {
    product_id: string;
    title: string;
    thumbnail: string | null;
    available: number;
    days_without_sales: number | null;
  }[] = [];
  const runningOut: {
    product_id: string;
    title: string;
    thumbnail: string | null;
    available: number;
    daily_sales: number;
    days_left: number | null;
  }[] = [];
  for (const item of byProduct.values()) {
    const last = lastSale.get(item.product_id);
    const idleDays = last ? Math.floor((input.now.getTime() - last) / DAY) : null;
    if (item.available > 0 && (idleDays === null || idleDays >= staleDays))
      stale.push({
        product_id: item.product_id,
        title: item.title,
        thumbnail: item.thumbnail ?? null,
        available: item.available,
        // null: no sale in the last 90 days.
        days_without_sales: idleDays,
      });
    const daily = (sold30.get(item.product_id) ?? 0) / 30;
    const daysLeft = daily > 0 ? Math.floor(item.available / daily) : null;
    if (item.available <= 0 || (daysLeft !== null && daysLeft <= coverDays))
      runningOut.push({
        product_id: item.product_id,
        title: item.title,
        thumbnail: item.thumbnail ?? null,
        available: item.available,
        daily_sales: round(daily),
        days_left: item.available <= 0 ? 0 : daysLeft,
      });
  }
  stale.sort(
    (a, b) =>
      (b.days_without_sales ?? 9999) - (a.days_without_sales ?? 9999) || b.available - a.available,
  );
  runningOut.sort(
    (a, b) => (a.days_left ?? 0) - (b.days_left ?? 0) || b.daily_sales - a.daily_sales,
  );

  // Orders waiting for the store, by stage and age (all open orders, not only this period).
  const pending = { unprepared: 0, preparing: 0, ready: 0, shipped: 0 };
  const oldest: { id: string; display_id: number | null; stage: Stage; hours: number }[] = [];
  for (const order of input.openOrders) {
    const stage = orderStage(order);
    if (!stage) continue;
    pending[stage] += 1;
    if (stage !== "shipped")
      oldest.push({
        id: order.id,
        display_id: order.display_id ?? null,
        stage,
        hours: Math.floor((input.now.getTime() - new Date(order.created_at).getTime()) / 3_600_000),
      });
  }
  oldest.sort((a, b) => b.hours - a.hours);

  let agents:
    { agent_id: string; name: string; count: number; amount: number; commission: number }[] | null =
    null;
  if (input.includeAgents) {
    const names = new Map(input.agents.map((agent) => [agent.id, agent.name]));
    const byAgent = new Map<
      string,
      { agent_id: string; name: string; count: number; amount: number; commission: number }
    >();
    for (const sale of input.agentSales.filter(
      (s) => s.status !== "reversed" && s.status !== "canceled",
    )) {
      const entry = byAgent.get(sale.agent_id) ?? {
        agent_id: sale.agent_id,
        name: names.get(sale.agent_id) ?? "Gestor",
        count: 0,
        amount: 0,
        commission: 0,
      };
      entry.count += 1;
      entry.amount = round(entry.amount + num(sale.total));
      entry.commission = round(
        entry.commission +
          (sale.commission_total != null
            ? num(sale.commission_total)
            : (sale.lines ?? []).reduce((s, line) => s + num(line.commission), 0)),
      );
      byAgent.set(sale.agent_id, entry);
    }
    agents = [...byAgent.values()].sort((a, b) => b.amount - a.amount);
  }

  return {
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    sales: {
      ...current,
      previous: previous,
      change: {
        amount: change(current.amount, previous.amount),
        count: change(current.count, previous.count),
      },
      daily: [...days].map(([date, value]) => ({ date, ...value })),
    },
    top_products: [...products.values()]
      .sort((a, b) => b.units - a.units || b.amount - a.amount)
      .slice(0, 10),
    stale_products: stale.slice(0, 20),
    running_out: runningOut.slice(0, 20),
    pending_orders: {
      ...pending,
      oldest: oldest.slice(0, 5),
      manual_payments: input.pendingPayments,
    },
    agents,
    thresholds: { stale_days: staleDays, cover_days: coverDays },
  };
}
