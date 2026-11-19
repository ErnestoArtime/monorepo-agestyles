import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnalytics, orderStage } from "../src/lib/analytics.ts";

const now = new Date("2026-11-19T12:00:00Z");
const daysAgo = (n) => new Date(now.getTime() - n * 86_400_000);
const order = (id, at, items, extra = {}) => ({
  id,
  created_at: at,
  status: "pending",
  items,
  fulfillments: [],
  ...extra,
});

test("stages follow the fulfillments (AG-04)", () => {
  assert.equal(orderStage(order("a", now, [])), "unprepared");
  assert.equal(orderStage(order("a", now, [], { fulfillments: [{}] })), "preparing");
  assert.equal(orderStage(order("a", now, [], { fulfillments: [{ packed_at: now }] })), "ready");
  assert.equal(
    orderStage(order("a", now, [], { fulfillments: [{ packed_at: now, shipped_at: now }] })),
    "shipped",
  );
  assert.equal(orderStage(order("a", now, [], { fulfillments: [{ delivered_at: now }] })), null);
  assert.equal(orderStage(order("a", now, [], { status: "canceled" })), null);
  assert.equal(
    orderStage(order("a", now, [], { fulfillments: [{ canceled_at: now }] })),
    "unprepared",
  );
});

test("sales, comparison, rotation, cover and agents", () => {
  const current = [
    order("o1", daysAgo(2), [{ product_id: "p1", title: "Café", quantity: 3, unit_price: 5 }]),
    order("o2", daysAgo(1), [{ product_id: "p2", title: "Miel", quantity: 1, unit_price: 10 }], {
      status: "canceled",
    }),
  ];
  const previous = [
    order("o0", daysAgo(40), [{ product_id: "p1", quantity: 1, unit_price: 10 }], {
      status: "completed",
    }),
  ];
  const agentSales = [
    {
      id: "s1",
      agent_id: "ag1",
      source: "manual",
      status: "paid",
      total: 20,
      created_at: daysAgo(3),
      lines: [{ product_id: "p1", title: "Café", quantity: 4, unit_price: 5, commission: 2 }],
    },
    // An online agent sale is the same order o1: it must not count twice in sales.
    {
      id: "s2",
      agent_id: "ag1",
      source: "online",
      status: "paid",
      total: 15,
      created_at: daysAgo(2),
      lines: [{ product_id: "p1", quantity: 3, unit_price: 5, commission: 1.5 }],
    },
    {
      id: "s3",
      agent_id: "ag1",
      source: "manual",
      status: "reversed",
      total: 99,
      created_at: daysAgo(2),
      lines: [],
    },
  ];
  const result = buildAnalytics({
    from: daysAgo(29),
    to: now,
    now,
    orders: current,
    previousOrders: previous,
    openOrders: [...current, ...previous],
    agentSales,
    previousAgentSales: [],
    recentSales: [
      { product_id: "p1", quantity: 3, at: daysAgo(2) },
      { product_id: "p1", quantity: 4, at: daysAgo(3) },
      { product_id: "p3", quantity: 1, at: daysAgo(80) },
    ],
    stock: [
      { product_id: "p1", title: "Café", available: 1 },
      { product_id: "p2", title: "Miel", available: 0 },
      { product_id: "p3", title: "Ron", available: 6 },
      { product_id: "p4", title: "Aceite", available: 2 },
    ],
    pendingPayments: 2,
    agents: [{ id: "ag1", name: "Jorge" }],
    includeAgents: true,
  });
  assert.equal(result.sales.amount, 35); // 15 online + 20 in store; cancelled and reversed out
  assert.equal(result.sales.online_amount, 15);
  assert.equal(result.sales.in_store_amount, 20);
  assert.equal(result.sales.count, 2);
  assert.equal(result.sales.units, 7);
  assert.equal(result.sales.previous.amount, 10);
  assert.equal(result.sales.change.amount, 250);
  assert.equal(result.sales.daily.length, 30);
  assert.equal(result.top_products[0].product_id, "p1");
  assert.equal(result.top_products[0].units, 7);
  // p3 sold 80 days ago, p4 never in 90 days: both stale; p1 sells.
  assert.deepEqual(result.stale_products.map((p) => p.product_id).sort(), ["p3", "p4"]);
  // p1: 7 units / 30 days, 1 left → 4 days; p2 is out of stock.
  assert.deepEqual(
    result.running_out.map((p) => [p.product_id, p.days_left]),
    [
      ["p2", 0],
      ["p1", 4],
    ],
  );
  assert.equal(result.pending_orders.unprepared, 1);
  assert.equal(result.pending_orders.manual_payments, 2);
  assert.equal(result.agents[0].name, "Jorge");
  assert.equal(result.agents[0].count, 2);
  assert.equal(result.agents[0].commission, 3.5);
});

test("agents are hidden without the right", () => {
  const result = buildAnalytics({
    from: daysAgo(6),
    to: now,
    now,
    orders: [],
    previousOrders: [],
    openOrders: [],
    agentSales: [],
    previousAgentSales: [],
    recentSales: [],
    stock: [],
    pendingPayments: 0,
    agents: [],
    includeAgents: false,
  });
  assert.equal(result.agents, null);
  assert.equal(result.sales.change.amount, null);
});
