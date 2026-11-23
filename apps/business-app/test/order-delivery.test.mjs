import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryLines, orderDeliveryStatus, orderPaymentStatus } from "../lib/order-details.ts";

const delivered = "2026-11-23T16:00:00Z";
const order = {
  id: "order_demo",
  status: "pending",
  payment_status: "authorized",
  items: [
    { id: "one", quantity: 3 },
    { id: "two", quantity: 1 },
    { id: "digital", quantity: 1, requires_shipping: false },
  ],
};
const shipment = (id, line_item_id, quantity, timestamps = {}) => ({
  id,
  ...timestamps,
  items: [{ line_item_id, quantity }],
});

test("a delivery covering only part of a line stays partial even if the API says delivered", () => {
  const partial = {
    ...order,
    fulfillment_status: "delivered",
    fulfillments: [shipment("first", "one", 2, { delivered_at: delivered })],
  };
  assert.equal(orderDeliveryStatus(partial).stage, "partial");
  assert.deepEqual(
    deliveryLines(partial).map(({ covered, remaining }) => [covered, remaining]),
    [
      [2, 1],
      [0, 1],
    ],
  );
  assert.equal(orderPaymentStatus(partial.payment_status).label, "Autorizado");
  assert.equal(partial.status, "pending");
});

test("multiple delivered shipments can finish all physical lines", () => {
  const complete = {
    ...order,
    fulfillments: [
      shipment("first", "one", 2, { delivered_at: delivered }),
      shipment("second", "one", 1, { delivered_at: delivered }),
      shipment("third", "two", 1, { delivered_at: delivered }),
    ],
  };
  assert.equal(orderDeliveryStatus(complete).stage, "delivered");
});

test("canceled shipments do not count and dispatch does not imply delivery", () => {
  const stillShipping = {
    ...order,
    fulfillments: [
      shipment("canceled", "one", 3, { delivered_at: delivered, canceled_at: delivered }),
      shipment("dispatched", "two", 1, { shipped_at: delivered }),
    ],
  };
  assert.equal(orderDeliveryStatus(stillShipping).stage, "dispatched");
  assert.deepEqual(
    deliveryLines(stillShipping, false).map(({ remaining }) => remaining),
    [3, 0],
  );
  assert.deepEqual(
    deliveryLines(stillShipping).map(({ remaining }) => remaining),
    [3, 1],
  );
});

test("a canceled order stays canceled despite recorded deliveries", () => {
  const canceled = {
    ...order,
    status: "canceled",
    fulfillments: [shipment("first", "one", 2, { delivered_at: delivered })],
  };
  assert.equal(orderDeliveryStatus(canceled).label, "Cancelada");
});

test("a delivered shipment without quantities cannot confirm the complete order", () => {
  const missingLines = {
    ...order,
    fulfillment_status: "delivered",
    fulfillments: [{ id: "unknown", delivered_at: delivered }],
  };
  assert.equal(orderDeliveryStatus(missingLines).label, "Entrega sin conciliar");
});
