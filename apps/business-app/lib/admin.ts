import type { BadgeTone } from "@agestyles/ui-native";

/** Spanish labels and formatting for the marketplace administration (AG-32). */

export const SELLER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "Abierta", tone: "success" },
  pending_approval: { label: "Pendiente de aprobación", tone: "warning" },
  suspended: { label: "Suspendida", tone: "error" },
  terminated: { label: "Cerrada", tone: "neutral" },
};

export const ORDER_STATUS: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  draft: "Borrador",
  archived: "Archivado",
  canceled: "Cancelado",
  requires_action: "Requiere acción",
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Por verificar", tone: "warning" },
  verified: { label: "Verificado", tone: "success" },
  rejected: { label: "Rechazado", tone: "error" },
};

export const CHANGE_TYPE: Record<string, string> = {
  new_product: "Producto nuevo",
  update: "Cambios",
  delete: "Retirada",
};

export const STORE_ROLES = [
  { value: "role_seller_administration", label: "Administración" },
  { value: "role_seller_inventory_management", label: "Gestor de inventario" },
  { value: "role_seller_order_management", label: "Gestor de pedidos" },
  { value: "role_seller_accounting", label: "Contabilidad" },
  { value: "role_seller_support", label: "Solo lectura" },
];

export function personName(person: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const full = [person.first_name, person.last_name].filter(Boolean).join(" ");
  return full || person.email || "Sin nombre";
}

export function money(amount: number | string | null | undefined, currency?: string | null) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(Number(amount ?? 0));
}

export function shortDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value))
    : "";
}

/** API errors in Spanish; the server's own text is not shown to the administrator. */
export function adminError(cause: unknown, fallback: string) {
  const status = (cause as { status?: number })?.status;
  if (status === 401) return "Tu sesión de administración ha caducado. Vuelve a entrar.";
  if (status === 403) return "Tu cuenta no tiene permiso para esta operación.";
  if (status === 404) return "No se encontró el elemento.";
  return fallback;
}

/** Address of Negocio where an invited administrator accepts the invitation. */
export function inviteLink(token: string) {
  const base =
    process.env.EXPO_PUBLIC_BUSINESS_WEB_URL ||
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://negocio.eav-labs.com");
  return `${base.replace(/\/+$/, "")}/aceptar-invitacion?token=${encodeURIComponent(token)}`;
}
