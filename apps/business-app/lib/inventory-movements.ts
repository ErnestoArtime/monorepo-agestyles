import { Platform, Share } from "react-native";

export type MovementType = "alta" | "baja" | "venta" | "ajuste";

export type InventoryMovement = {
  id: string;
  inventory_item_id: string;
  location_id: string;
  type: MovementType;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  actor_email: string | null;
  title: string | null;
  sku: string | null;
  location_name: string | null;
  created_at: string;
};

export const MOVEMENT_PATH = "/vendor/agestyles/inventory-movements";

export const MOVEMENT_TYPE_OPTIONS: { value: MovementType; label: string; help: string }[] = [
  { value: "alta", label: "Alta", help: "Entrada de mercancía: suma unidades." },
  { value: "baja", label: "Baja", help: "Salida por rotura, pérdida o uso: resta unidades." },
  {
    value: "venta",
    label: "Venta",
    help: "Venta hecha fuera de la tienda online: resta unidades.",
  },
  { value: "ajuste", label: "Ajuste", help: "Indica el stock contado; el motivo es obligatorio." },
];

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  alta: "Alta",
  baja: "Baja",
  venta: "Venta",
  ajuste: "Ajuste",
};

export type Period = "7" | "30" | "all";
export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "all", label: "Todo" },
];

export function movementQuery({
  type,
  period,
  inventoryItemId,
  limit,
  offset,
}: {
  type?: MovementType;
  period: Period;
  inventoryItemId?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (inventoryItemId) params.set("inventory_item_id", inventoryItemId);
  if (period !== "all") {
    params.set("from", new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString());
  }
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function formatMovementDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

/** Saves the CSV on web; on Android/iOS opens the share sheet with its contents. */
export async function deliverCsv(csv: string, filename: string) {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: csv });
}

/** API messages are Spanish for validation errors; anything else gets a generic message. */
export function movementErrorMessage(cause: unknown, fallback: string) {
  const status = (cause as { status?: number })?.status;
  const message = (cause as { message?: string })?.message;
  if (status === 400 && message && /[áéíóúñ]|stock|motivo|cantidad|ajust/i.test(message)) {
    return message;
  }
  if (status === 403) return "Tu rol no permite registrar movimientos de inventario.";
  if (status === 404) return "No se encontró ese artículo o ubicación en tu tienda.";
  return fallback;
}
