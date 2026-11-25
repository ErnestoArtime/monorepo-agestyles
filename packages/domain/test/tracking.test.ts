import assert from "node:assert/strict";
import { buildOrderTracking } from "../src/tracking.ts";

/**
 * Rule tests for the buyer line-tracking projection. Run with
 * `node test/tracking.test.ts` (Node 24 strips the types). No database needed.
 */

const order = {
  id: "order_1",
  items: [
    { id: "line_a", title: "Taladro A", quantity: 2 },
    { id: "line_b", title: "Broca B", quantity: 1 },
  ],
  fulfillments: [
    {
      id: "ful_1",
      shipped_at: "2026-11-10T10:00:00.000Z",
      items: [
        { line_item_id: "line_a", quantity: 1 },
        { line_item_id: "line_b", quantity: 1 },
      ],
      labels: [
        { tracking_number: "TRK-1", tracking_url: "https://track.example/TRK-1" },
        { tracking_number: "TRK-1" },
        { tracking_number: "  " },
      ],
    },
  ],
};

const partialOrder = buildOrderTracking(order);
assert.equal(partialOrder.status, "partially_shipped");
assert.equal(partialOrder.lines.length, 2);

const lineA = partialOrder.lines.find((line) => line.line_item_id === "line_a");
assert.ok(lineA);
assert.equal(lineA.shipped_quantity, 1);
assert.equal(lineA.delivered_quantity, 0);
assert.equal(lineA.status, "partially_shipped");
assert.deepEqual(lineA.shipments[0].tracking, [
  { tracking_number: "TRK-1", tracking_url: "https://track.example/TRK-1" },
]);

const lineB = partialOrder.lines.find((line) => line.line_item_id === "line_b");
assert.ok(lineB);
assert.equal(lineB.status, "shipped");

// A second fulfillment completes line A.
const complete = buildOrderTracking({
  ...order,
  fulfillments: [
    ...order.fulfillments,
    {
      id: "ful_2",
      shipped_at: "2026-11-11T09:00:00.000Z",
      items: [{ line_item_id: "line_a", quantity: 5 }],
      labels: [{ tracking_number: "TRK-2" }],
    },
  ],
});
const completeA = complete.lines.find((line) => line.line_item_id === "line_a");
assert.ok(completeA);
assert.equal(completeA.status, "shipped");
assert.equal(completeA.shipped_quantity, 2, "shipped quantity is capped at what was purchased");
assert.equal(complete.status, "shipped");

// Delivery of every line marks the order delivered.
const delivered = buildOrderTracking({
  ...order,
  fulfillments: order.fulfillments.map((fulfillment) => ({
    ...fulfillment,
    delivered_at: "2026-11-12T12:00:00.000Z",
  })),
});
assert.equal(delivered.status, "partially_shipped", "one unit still needs to ship");
assert.equal(delivered.lines.find((line) => line.line_item_id === "line_b")?.status, "delivered");

const allDelivered = buildOrderTracking({
  id: "order_2",
  items: [{ id: "line_c", title: "Solo uno", quantity: 1 }],
  fulfillments: [
    {
      id: "ful_3",
      shipped_at: "2026-11-10T10:00:00.000Z",
      delivered_at: "2026-11-12T10:00:00.000Z",
      items: [{ line_item_id: "line_c", quantity: 1 }],
      labels: [],
    },
  ],
});
assert.equal(allDelivered.status, "delivered");
assert.equal(allDelivered.lines[0].status, "delivered");

// A canceled fulfillment never counts.
const canceled = buildOrderTracking({
  id: "order_3",
  items: [{ id: "line_d", title: "Cancelada", quantity: 1 }],
  fulfillments: [
    {
      id: "ful_4",
      shipped_at: "2026-11-10T10:00:00.000Z",
      canceled_at: "2026-11-10T11:00:00.000Z",
      items: [{ line_item_id: "line_d", quantity: 1 }],
      labels: [{ tracking_number: "TRK-X" }],
    },
  ],
});
assert.equal(canceled.status, "not_fulfilled");
assert.equal(canceled.lines[0].shipments.length, 0);

// A packed but not shipped fulfillment does not show as a shipment yet.
const packed = buildOrderTracking({
  id: "order_4",
  items: [{ id: "line_e", title: "Empacada", quantity: 1 }],
  fulfillments: [
    {
      id: "ful_5",
      items: [{ line_item_id: "line_e", quantity: 1 }],
      labels: [{ tracking_number: "TRK-P" }],
    },
  ],
});
assert.equal(packed.status, "not_fulfilled");
assert.equal(packed.lines[0].shipments.length, 0);

// Fulfillment items that belong to another line are ignored.
const foreign = buildOrderTracking({
  id: "order_5",
  items: [{ id: "line_f", title: "Propia", quantity: 1 }],
  fulfillments: [
    {
      id: "ful_6",
      shipped_at: "2026-11-10T10:00:00.000Z",
      items: [
        { line_item_id: "line_other", quantity: 1 },
        { line_item_id: null, quantity: 1 },
      ],
      labels: [{ tracking_number: "TRK-Z" }],
    },
  ],
});
assert.equal(foreign.status, "not_fulfilled");
assert.equal(foreign.lines[0].shipments.length, 0);

console.log(
  "PASS: per-line tracking, partial shipments, caps, cancellation exclusion and label deduplication",
);
