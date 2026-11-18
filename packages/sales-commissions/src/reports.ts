// Same rounding as rules.ts; kept local so the tests can load this file directly.
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** A stored agent sale as the reports need it (lines are the JSON snapshot of the sale). */
export type SaleRecord = {
  id: string;
  agent_id: string;
  source: string;
  payment_method: string;
  status: string;
  currency_code: string;
  total: number | string;
  created_at: string | Date;
  lines?: {
    product_id: string;
    title?: string | null;
    sku?: string | null;
    quantity: number;
    unit_price: number | string;
    commission?: number | string;
  }[];
};

export type SalesFilters = {
  from?: Date;
  to?: Date;
  payment_method?: "cash" | "transfer" | "online";
};

export const MAX_REPORT_DAYS = 366;

/** Reads `from`/`to` (YYYY-MM-DD, inclusive, UTC) and `payment_method` from a query string. */
export function parseSalesFilters(query: Record<string, unknown>): SalesFilters {
  const day = (value: unknown, endOfDay: boolean) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const filters: SalesFilters = {};
  const from = day(query.from, false);
  const to = day(query.to, true);
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (filters.from && filters.to && filters.from > filters.to) {
    [filters.from, filters.to] = [day(query.to, false), day(query.from, true)];
  }
  if (
    query.payment_method === "cash" ||
    query.payment_method === "transfer" ||
    query.payment_method === "online"
  ) {
    filters.payment_method = query.payment_method;
  }
  return filters;
}

/** Service filters for `listAgentSales` built from the parsed query. */
export function salesServiceFilters(
  sellerId: string,
  filters: SalesFilters,
  agentId?: string,
): Record<string, unknown> {
  const created: Record<string, Date> = {};
  if (filters.from) created.$gte = filters.from;
  if (filters.to) created.$lte = filters.to;
  return {
    seller_id: sellerId,
    ...(agentId ? { agent_id: agentId } : {}),
    ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
    ...(Object.keys(created).length ? { created_at: created } : {}),
  };
}

const toNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

export type SalesReport = {
  totals: { count: number; total: number; commission: number };
  days: { date: string; count: number; total: number }[];
  agents: { agent_id: string; count: number; total: number; commission: number }[];
  products: {
    product_id: string;
    title: string | null;
    sku: string | null;
    units: number;
    total: number;
  }[];
};

/**
 * Daily revenue, agent ranking and best-selling products for paid sales. Reversed sales are
 * left out. Days use UTC dates, like the filters.
 */
export function buildSalesReport(sales: SaleRecord[], topProducts = 10): SalesReport {
  const days = new Map<string, { count: number; total: number }>();
  const agents = new Map<string, { count: number; total: number; commission: number }>();
  const products = new Map<
    string,
    { title: string | null; sku: string | null; units: number; total: number }
  >();
  const totals = { count: 0, total: 0, commission: 0 };

  for (const sale of sales) {
    if (sale.status === "reversed") continue;
    const total = toNumber(sale.total);
    const commission = (sale.lines ?? []).reduce((sum, line) => sum + toNumber(line.commission), 0);
    const date = new Date(sale.created_at).toISOString().slice(0, 10);

    totals.count += 1;
    totals.total += total;
    totals.commission += commission;

    const day = days.get(date) ?? { count: 0, total: 0 };
    day.count += 1;
    day.total += total;
    days.set(date, day);

    const agent = agents.get(sale.agent_id) ?? { count: 0, total: 0, commission: 0 };
    agent.count += 1;
    agent.total += total;
    agent.commission += commission;
    agents.set(sale.agent_id, agent);

    for (const line of sale.lines ?? []) {
      const product = products.get(line.product_id) ?? {
        title: line.title ?? null,
        sku: line.sku ?? null,
        units: 0,
        total: 0,
      };
      product.units += toNumber(line.quantity);
      product.total += toNumber(line.quantity) * toNumber(line.unit_price);
      products.set(line.product_id, product);
    }
  }

  return {
    totals: {
      count: totals.count,
      total: roundMoney(totals.total),
      commission: roundMoney(totals.commission),
    },
    days: [...days]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, count: value.count, total: roundMoney(value.total) })),
    agents: [...agents]
      .map(([agent_id, value]) => ({
        agent_id,
        count: value.count,
        total: roundMoney(value.total),
        commission: roundMoney(value.commission),
      }))
      .sort((a, b) => b.total - a.total || b.count - a.count),
    products: [...products]
      .map(([product_id, value]) => ({ product_id, ...value, total: roundMoney(value.total) }))
      .sort((a, b) => b.units - a.units || b.total - a.total)
      .slice(0, topProducts),
  };
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  online: "En línea",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  paid: "Cobrada",
  reversed: "Revertida",
};

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  // Neutralise spreadsheet formulas and quote separators, quotes and line breaks.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per sale line, `;`-separated with BOM for Spanish spreadsheets. */
export function salesToCsv(sales: SaleRecord[], agentLabels: Map<string, string>): string {
  const header = [
    "Fecha (UTC)",
    "Venta",
    "Gestor",
    "Pago",
    "Estado",
    "Producto",
    "SKU",
    "Cantidad",
    "Precio unidad",
    "Importe línea",
    "Comisión línea",
    "Moneda",
  ];
  const rows: string[] = [];
  for (const sale of sales) {
    const base = [
      new Date(sale.created_at).toISOString().replace("T", " ").slice(0, 19),
      sale.id,
      agentLabels.get(sale.agent_id) ?? sale.agent_id,
      PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method,
      STATUS_LABELS[sale.status] ?? sale.status,
    ];
    for (const line of sale.lines ?? []) {
      rows.push(
        [
          ...base,
          line.title ?? "",
          line.sku ?? "",
          toNumber(line.quantity),
          roundMoney(toNumber(line.unit_price)).toFixed(2),
          roundMoney(toNumber(line.quantity) * toNumber(line.unit_price)).toFixed(2),
          roundMoney(toNumber(line.commission)).toFixed(2),
          sale.currency_code.toUpperCase(),
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }
  return `\uFEFF${[header.join(";"), ...rows].join("\r\n")}\r\n`;
}
