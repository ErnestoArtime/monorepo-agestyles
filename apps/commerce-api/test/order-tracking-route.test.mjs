import assert from "node:assert/strict";
import { GET } from "../src/api/store/orders/[id]/tracking/route.ts";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";

const order = {
  id: "order_buyer_1",
  items: [{ id: "line_1", title: "Camisa AgeStyles", quantity: 1 }],
  fulfillments: [
    {
      id: "fulfillment_1",
      shipped_at: "2026-11-17T10:00:00.000Z",
      items: [{ line_item_id: "line_1", quantity: 1 }],
      labels: [
        {
          tracking_number: "SAFE-TRACKING-1",
          tracking_url: "https://tracking.example/SAFE-TRACKING-1",
        },
      ],
    },
  ],
};

const graphCalls = [];
const query = {
  async graph(input) {
    graphCalls.push(input);
    return {
      data: input.filters.customer_id === "cus_owner" ? [order] : [],
    };
  },
};

function makeRequest(actorId) {
  return {
    auth_context: actorId ? { actor_id: actorId } : undefined,
    params: { id: order.id },
    scope: {
      resolve(key) {
        assert.equal(key, ContainerRegistrationKeys.QUERY);
        return query;
      },
    },
  };
}

function makeResponse() {
  return {
    body: undefined,
    json(body) {
      this.body = body;
      return body;
    },
  };
}

// Anonymous requests stop before resolving or querying the data layer.
const queryCountBeforeAnonymous = graphCalls.length;
await assert.rejects(
  () => GET(makeRequest(undefined), makeResponse()),
  (error) => error instanceof MedusaError && error.type === MedusaError.Types.UNAUTHORIZED,
);
assert.equal(graphCalls.length, queryCountBeforeAnonymous);

// An order owned by another customer is indistinguishable from an unknown id.
await assert.rejects(
  () => GET(makeRequest("cus_other"), makeResponse()),
  (error) => {
    assert.ok(error instanceof MedusaError);
    assert.equal(error.type, MedusaError.Types.NOT_FOUND);
    assert.equal(error.message.includes("SAFE-TRACKING-1"), false);
    return true;
  },
);
assert.deepEqual(graphCalls.at(-1).filters, {
  id: order.id,
  is_draft_order: false,
  customer_id: "cus_other",
});

// An owner receives only the line-level tracking projection of their order.
const response = makeResponse();
await GET(makeRequest("cus_owner"), response);
assert.deepEqual(graphCalls.at(-1).filters, {
  id: order.id,
  is_draft_order: false,
  customer_id: "cus_owner",
});
assert.deepEqual(response.body, {
  tracking: {
    order_id: order.id,
    status: "shipped",
    lines: [
      {
        line_item_id: "line_1",
        title: "Camisa AgeStyles",
        quantity: 1,
        preparing_quantity: 0,
        ready_quantity: 0,
        shipped_quantity: 1,
        delivered_quantity: 0,
        status: "shipped",
        shipments: [
          {
            fulfillment_id: "fulfillment_1",
            quantity: 1,
            shipped_at: "2026-11-17T10:00:00.000Z",
            delivered_at: null,
            tracking: [
              {
                tracking_number: "SAFE-TRACKING-1",
                tracking_url: "https://tracking.example/SAFE-TRACKING-1",
              },
            ],
          },
        ],
      },
    ],
  },
});

console.log("PASS: tracking route enforces authentication and customer ownership");
