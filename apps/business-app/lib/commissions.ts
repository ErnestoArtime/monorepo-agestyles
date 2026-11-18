export const COMMISSIONS = {
  agents: "/vendor/agestyles/sales-agents",
  rules: "/vendor/agestyles/commission-rules",
  sales: "/vendor/agestyles/agent-sales",
  balance: "/vendor/agestyles/commissions/balance",
  withdrawals: "/vendor/agestyles/commission-withdrawals",
};

/** Public store web where buyers land with an agent's link (AG-06 phase 4). */
export const STORE_WEB_URL = (
  process.env.EXPO_PUBLIC_STORE_WEB_URL || "https://tienda.eav-labs.com"
).replace(/\/+$/, "");

export function agentLink(code: string) {
  return `${STORE_WEB_URL}/?gestor=${encodeURIComponent(code)}`;
}

export function reverseSalePath(id: string) {
  return `/vendor/agestyles/agent-sales/${id}/reverse`;
}

export type SalesAgent = {
  id: string;
  member_id: string;
  member_email: string | null;
  code: string;
  active: boolean;
};

export type CommissionRule = {
  id: string;
  product_id: string | null;
  kind: "percent" | "fixed";
  value: number | string;
  unit_threshold: number | null;
};

export type AgentSale = {
  id: string;
  agent_id: string;
  source?: "manual" | "online";
  order_id?: string | null;
  note?: string | null;
  payment_method: "cash" | "transfer" | "online";
  status: "pending" | "paid" | "reversed";
  total: number | string;
  created_at: string;
  lines: {
    title: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
    commission?: number;
  }[];
};

export type Withdrawal = {
  id: string;
  agent_id: string;
  amount: number | string;
  status: "requested" | "paid" | "rejected";
  created_at: string;
  confirmed_at: string | null;
};

export type Balance = {
  balance: number;
  requested: number;
  available: number;
  progress: {
    product_id: string;
    unit_threshold: number;
    units_sold: number;
    units_to_next: number | null;
  }[];
};

export const PAYMENT_LABEL: Record<AgentSale["payment_method"], string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  online: "Pedido online",
};

export const SALE_STATUS_LABEL: Record<AgentSale["status"], string> = {
  pending: "Pendiente de pago",
  paid: "Cobrada",
  reversed: "Anulada",
};

export const WITHDRAWAL_LABEL: Record<Withdrawal["status"], string> = {
  requested: "Pendiente",
  paid: "Entregado",
  rejected: "Rechazado",
};

export function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export function ruleLabel(rule: CommissionRule) {
  const value = Number(rule.value);
  const base =
    rule.kind === "percent"
      ? `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)} % del precio`
      : `${money(value)} por unidad`;
  return rule.unit_threshold
    ? `${money(value)} cada ${rule.unit_threshold} unidades vendidas`
    : base;
}

/** Validation messages from the API are Spanish; anything else gets a generic message. */
export function commissionError(cause: unknown, fallback: string) {
  const status = (cause as { status?: number })?.status;
  const message = (cause as { message?: string })?.message;
  if (
    status === 400 &&
    message &&
    /[áéíóúñ]|saldo|comisi|gestor|venta|retiro|stock/i.test(message)
  ) {
    return message;
  }
  if (status === 403) return "Tu rol no permite hacer esta operación.";
  if (status === 404) return "No se encontró el elemento en esta tienda.";
  return fallback;
}
