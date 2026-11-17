export type StatusLabelMap = Record<string, string>;

export const ORDER_STATUS_LABELS: StatusLabelMap = {
  pending: "Pendiente",
  completed: "Completada",
  canceled: "Cancelada",
  requires_action: "Requiere acción",
  archived: "Archivada",
  not_fulfilled: "Sin preparar",
  partially_fulfilled: "Preparada parcialmente",
  fulfilled: "Preparada",
  partially_shipped: "Enviada parcialmente",
  shipped: "Enviada",
  partially_delivered: "Entregada parcialmente",
  delivered: "Entregada",
  not_paid: "Sin pagar",
  awaiting: "Pendiente de pago",
  authorized: "Autorizado",
  partially_authorized: "Autorizado parcialmente",
  captured: "Pagado",
  partially_captured: "Pagado parcialmente",
  refunded: "Reembolsado",
  partially_refunded: "Reembolsado parcialmente",
};

export const PAYMENT_STATUS_LABELS: StatusLabelMap = {
  pending: "Pendiente",
  authorized: "Autorizado",
  captured: "Pagado",
  partially_captured: "Pagado parcialmente",
  refunded: "Reembolsado",
  partially_refunded: "Reembolsado parcialmente",
};

export function getStatusLabel(
  statusKey: string,
  map: StatusLabelMap = ORDER_STATUS_LABELS,
): string {
  return map[statusKey] ?? statusKey.replaceAll("_", " ");
}
