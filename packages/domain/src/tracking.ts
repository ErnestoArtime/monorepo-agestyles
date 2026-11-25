/**
 * Line-level tracking for the buyer's order.
 *
 * Medusa already stores fulfillments, their items and their labels. The gap is
 * a buyer-facing projection: one row per purchased line, with the shipments
 * that cover it and their tracking numbers. Nothing here creates or changes a
 * fulfillment; it only reads what the seller's shipment already recorded.
 *
 * Kept in the shared domain package so web, native and admin render the same
 * status from the same rule, and so the rule can be tested without a database.
 */

export type TrackingLabel = {
  tracking_number: string;
  tracking_url?: string | null;
};

export type TrackingFulfillmentItem = {
  /** Medusa order line this fulfillment item covers. */
  line_item_id: string | null;
  quantity: number;
};

export type TrackingFulfillment = {
  id: string;
  packed_at?: string | Date | null;
  shipped_at?: string | Date | null;
  delivered_at?: string | Date | null;
  canceled_at?: string | Date | null;
  items: TrackingFulfillmentItem[];
  labels?: TrackingLabel[];
};

export type TrackingOrderItem = {
  id: string;
  title: string;
  quantity: number;
};

export type LineShipment = {
  fulfillment_id: string;
  quantity: number;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking: TrackingLabel[];
};

export type LineTrackingStatus =
  | "not_fulfilled"
  | "preparing"
  | "ready"
  | "partially_prepared"
  | "partially_shipped"
  | "shipped"
  | "delivered"
  | "canceled";

export type LineTracking = {
  line_item_id: string;
  title: string;
  quantity: number;
  preparing_quantity: number;
  ready_quantity: number;
  shipped_quantity: number;
  delivered_quantity: number;
  status: LineTrackingStatus;
  shipments: LineShipment[];
};

export type OrderTracking = {
  order_id: string;
  status:
    | "not_fulfilled"
    | "preparing"
    | "partially_prepared"
    | "ready"
    | "partially_shipped"
    | "shipped"
    | "delivered"
    | "canceled";
  lines: LineTracking[];
};

export type TrackingOrder = {
  id: string;
  items: TrackingOrderItem[];
  fulfillments: TrackingFulfillment[];
};

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeLabels(labels: TrackingLabel[] | undefined): TrackingLabel[] {
  const seen = new Set<string>();
  const result: TrackingLabel[] = [];
  for (const label of labels ?? []) {
    const number = String(label.tracking_number ?? "").trim();
    if (!number || seen.has(number)) continue;
    seen.add(number);
    result.push({
      tracking_number: number,
      tracking_url: label.tracking_url?.trim() || null,
    });
  }
  return result;
}

function lineStatus(quantity: number, shipped: number, delivered: number): LineTrackingStatus {
  if (delivered >= quantity && quantity > 0) return "delivered";
  if (shipped >= quantity && quantity > 0) return "shipped";
  if (shipped > 0) return "partially_shipped";
  return "not_fulfilled";
}

/**
 * Builds the per-line view.
 *
 * A canceled fulfillment is ignored: its items are no longer on the way, and
 * counting them would show the buyer a shipment that never happened. Quantities
 * are capped at what was purchased so a data entry mistake upstream cannot show
 * "3 of 2 shipped".
 */
export function buildOrderTracking(order: TrackingOrder): OrderTracking {
  const lines = new Map<string, LineTracking>(
    order.items.map((item) => [
      item.id,
      {
        line_item_id: item.id,
        title: item.title,
        quantity: item.quantity,
        preparing_quantity: 0,
        ready_quantity: 0,
        shipped_quantity: 0,
        delivered_quantity: 0,
        status: "not_fulfilled" as LineTrackingStatus,
        shipments: [],
      },
    ]),
  );

  let anyShipment = false;
  let allLinesDelivered = order.items.length > 0;

  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.canceled_at) continue;
    const tracking = normalizeLabels(fulfillment.labels);
    const shippedAt = toIso(fulfillment.shipped_at);
    const deliveredAt = toIso(fulfillment.delivered_at);
    for (const fulfillmentItem of fulfillment.items) {
      const line = fulfillmentItem.line_item_id
        ? lines.get(fulfillmentItem.line_item_id)
        : undefined;
      // A fulfillment item without a matching line is inventory that is not
      // part of the buyer's purchase (e.g. a return label). It is not shown.
      if (!line) continue;
      const quantity = Math.max(0, Math.min(fulfillmentItem.quantity, line.quantity));

      if (!shippedAt && !deliveredAt) {
        if (fulfillment.packed_at === null) {
          line.preparing_quantity = Math.min(line.quantity, line.preparing_quantity + quantity);
        } else if (fulfillment.packed_at) {
          line.ready_quantity = Math.min(line.quantity, line.ready_quantity + quantity);
        }
      }

      if (!shippedAt && !deliveredAt) continue;

      line.shipments.push({
        fulfillment_id: fulfillment.id,
        quantity,
        shipped_at: shippedAt,
        delivered_at: deliveredAt,
        tracking,
      });
      line.shipped_quantity = Math.min(line.quantity, line.shipped_quantity + quantity);
      if (deliveredAt) {
        line.delivered_quantity = Math.min(line.quantity, line.delivered_quantity + quantity);
      }
      anyShipment = true;
    }
  }

  for (const line of lines.values()) {
    const shipmentStatus = lineStatus(
      line.quantity,
      line.shipped_quantity,
      line.delivered_quantity,
    );
    line.status =
      shipmentStatus !== "not_fulfilled"
        ? shipmentStatus
        : line.preparing_quantity >= line.quantity
          ? "preparing"
          : line.ready_quantity >= line.quantity
            ? "ready"
            : line.preparing_quantity + line.ready_quantity > 0
              ? "partially_prepared"
              : "not_fulfilled";
    if (line.status !== "delivered") allLinesDelivered = false;
  }

  let status: OrderTracking["status"] = "not_fulfilled";
  if (allLinesDelivered) status = "delivered";
  else if (anyShipment) {
    status = [...lines.values()].every((line) => line.shipped_quantity >= line.quantity)
      ? "shipped"
      : "partially_shipped";
  } else if ([...lines.values()].every((line) => line.status === "ready")) {
    status = "ready";
  } else if (
    [...lines.values()].some(
      (line) =>
        line.status === "preparing" ||
        line.status === "ready" ||
        line.status === "partially_prepared",
    )
  ) {
    status =
      [...lines.values()].some(
        (line) => line.status === "ready" || line.status === "partially_prepared",
      ) && [...lines.values()].some((line) => line.status !== "ready")
        ? "partially_prepared"
        : "preparing";
  }

  return {
    order_id: order.id,
    status,
    lines: [...lines.values()],
  };
}
