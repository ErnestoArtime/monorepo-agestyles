import type { BadgeTone } from "@agestyles/ui-native";
import type { IconName } from "@agestyles/icons";

type StatusView = { label: string; tone: BadgeTone; icon: IconName; rank: number };

/** Spanish label, badge tone and icon for Medusa fulfillment statuses. Lower rank = less advanced. */
const FULFILLMENT: Record<string, StatusView> = {
  canceled: { label: "Cancelado", tone: "error", icon: "close", rank: -1 },
  not_fulfilled: { label: "Pendiente", tone: "warning", icon: "package", rank: 0 },
  partially_fulfilled: { label: "En preparación", tone: "warning", icon: "package", rank: 1 },
  fulfilled: { label: "Listo para enviar", tone: "neutral", icon: "package", rank: 2 },
  partially_shipped: { label: "Enviado en parte", tone: "neutral", icon: "truck", rank: 3 },
  shipped: { label: "Enviado", tone: "neutral", icon: "truck", rank: 4 },
  partially_delivered: { label: "Entregado en parte", tone: "success", icon: "truck", rank: 5 },
  delivered: { label: "Entregado", tone: "success", icon: "check", rank: 6 },
};

export function fulfillmentStatusView(status: string | null | undefined): StatusView {
  return (
    FULFILLMENT[status ?? ""] ?? { label: "En proceso", tone: "neutral", icon: "package", rank: 0 }
  );
}

/** One badge for a multi-store purchase: the least advanced store decides, cancelled ones aside. */
export function groupStatusView(statuses: (string | null | undefined)[]): StatusView {
  const views = statuses.map(fulfillmentStatusView);
  const active = views.filter((view) => view.rank >= 0);
  if (!active.length) return views[0] ?? fulfillmentStatusView(undefined);
  return active.reduce((least, view) => (view.rank < least.rank ? view : least));
}
