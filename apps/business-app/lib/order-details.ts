import type { BadgeTone } from "@agestyles/ui-native";

type OrderItem = {
  id: string;
  title?: string;
  variant_title?: string;
  quantity: number;
  unit_price?: number;
  total?: number;
  requires_shipping?: boolean;
};

type Fulfillment = {
  id: string;
  created_at?: string | null;
  packed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  canceled_at?: string | null;
  items?: { line_item_id?: string | null; quantity: number }[];
};

type Address = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

export type BusinessOrder = {
  id: string;
  display_id?: number | string;
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  created_at?: string;
  currency_code?: string;
  email?: string | null;
  seller?: { name?: string } | null;
  total?: number;
  subtotal?: number;
  shipping_total?: number;
  tax_total?: number;
  discount_total?: number;
  items?: OrderItem[];
  fulfillments?: Fulfillment[];
  shipping_address?: Address | null;
  shipping_methods?: { id: string; name?: string }[];
};

export const ORDER_PROGRESS_FIELDS = [
  "id",
  "display_id",
  "status",
  "payment_status",
  "fulfillment_status",
  "created_at",
  "currency_code",
  "total",
  "email",
  "items.id",
  "items.quantity",
  "items.requires_shipping",
  "fulfillments.id",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.items.line_item_id",
  "fulfillments.items.quantity",
].join(",");

export const ORDER_DETAIL_FIELDS = [
  ORDER_PROGRESS_FIELDS,
  "subtotal",
  "shipping_total",
  "tax_total",
  "discount_total",
  "items.title",
  "items.variant_title",
  "items.unit_price",
  "items.total",
  "fulfillments.created_at",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_methods.id",
  "shipping_methods.name",
].join(",");

export type DeliveryStage =
  "pending" | "preparing" | "ready" | "dispatched" | "partial" | "delivered" | "other";

type DeliveryStatus = { stage: DeliveryStage; label: string; tone: BadgeTone };

function coveredQuantities(order: BusinessOrder, deliveredOnly: boolean) {
  const quantities = new Map<string, number>();
  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.canceled_at || (deliveredOnly && !fulfillment.delivered_at)) continue;
    for (const item of fulfillment.items ?? []) {
      const quantity = Number(item.quantity);
      if (item.line_item_id && Number.isFinite(quantity) && quantity > 0) {
        quantities.set(item.line_item_id, (quantities.get(item.line_item_id) ?? 0) + quantity);
      }
    }
  }
  return quantities;
}

export function deliveryLines(order: BusinessOrder, deliveredOnly = true) {
  const covered = coveredQuantities(order, deliveredOnly);
  return (order.items ?? [])
    .filter((item) => item.requires_shipping !== false && Number(item.quantity) > 0)
    .map((item) => ({
      ...item,
      covered: Math.min(Number(item.quantity), covered.get(item.id) ?? 0),
      remaining: Math.max(0, Number(item.quantity) - (covered.get(item.id) ?? 0)),
    }));
}

export function orderDeliveryStatus(order: BusinessOrder): DeliveryStatus {
  if (order.status === "canceled" || order.fulfillment_status === "canceled")
    return { stage: "other", label: "Cancelada", tone: "error" };
  const active = (order.fulfillments ?? []).filter((fulfillment) => !fulfillment.canceled_at);
  const lines = deliveryLines(order);
  if (lines.length && lines.every((line) => line.remaining === 0))
    return { stage: "delivered", label: "Entregada", tone: "success" };
  if (active.some((fulfillment) => fulfillment.delivered_at)) {
    if (!lines.length && !order.items?.length && order.fulfillment_status === "delivered")
      return { stage: "delivered", label: "Entregada", tone: "success" };
    if (lines.length && !lines.some((line) => line.covered > 0))
      return { stage: "other", label: "Entrega sin conciliar", tone: "warning" };
    return { stage: "partial", label: "Entrega parcial", tone: "warning" };
  }
  if (order.fulfillment_status === "partially_delivered")
    return { stage: "partial", label: "Entrega parcial", tone: "warning" };
  if (order.items?.length && !lines.length)
    return { stage: "other", label: "Sin envío", tone: "neutral" };
  if (
    active.some((fulfillment) => fulfillment.shipped_at) ||
    ["shipped", "partially_shipped"].includes(order.fulfillment_status ?? "")
  )
    return { stage: "dispatched", label: "Despachada", tone: "neutral" };
  if (active.some((fulfillment) => fulfillment.packed_at))
    return { stage: "ready", label: "Lista para envío", tone: "neutral" };
  if (
    active.length ||
    ["fulfilled", "partially_fulfilled"].includes(order.fulfillment_status ?? "")
  )
    return { stage: "preparing", label: "En preparación", tone: "warning" };
  if (!lines.length && !order.items?.length && order.fulfillment_status === "delivered")
    return { stage: "delivered", label: "Entregada", tone: "success" };
  return { stage: "pending", label: "Sin preparar", tone: "neutral" };
}

const ORDER_PAYMENT_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  not_paid: { label: "Sin pagar", tone: "warning" },
  awaiting: { label: "En espera", tone: "warning" },
  authorized: { label: "Autorizado", tone: "neutral" },
  partially_authorized: { label: "Autorización parcial", tone: "warning" },
  captured: { label: "Cobrado", tone: "success" },
  partially_captured: { label: "Cobro parcial", tone: "warning" },
  partially_refunded: { label: "Reembolso parcial", tone: "warning" },
  refunded: { label: "Reembolsado", tone: "neutral" },
  canceled: { label: "Cancelado", tone: "error" },
  requires_action: { label: "Requiere acción", tone: "warning" },
};

export function orderPaymentStatus(status?: string) {
  return (
    ORDER_PAYMENT_LABELS[status ?? ""] ?? { label: "Sin información", tone: "neutral" as const }
  );
}

export function orderTitle(order: Pick<BusinessOrder, "display_id" | "id">) {
  return `Pedido #${order.display_id ?? order.id.slice(-6)}`;
}
