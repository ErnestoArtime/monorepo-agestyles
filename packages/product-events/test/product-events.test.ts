import assert from "node:assert/strict";
import {
  ProductEventValidationError,
  retentionCutoff,
  validateProductEventInput,
} from "../src/validation.ts";

/** Rule tests for product events. Run with `node test/product-events.test.ts`. */

const view = validateProductEventInput({
  product_id: "prod_01ABC",
  seller_id: "sel_01ABC",
  type: "product_view",
  surface: "vitrina",
  session_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
});
assert.equal(view.product_id, "prod_01ABC");
assert.equal(view.type, "product_view");

const storeView = validateProductEventInput({
  product_id: null,
  seller_id: "sel_01ABC",
  type: "store_view",
  surface: "tienda-app",
  session_id: "sess_12345678",
});
assert.equal(storeView.product_id, null);

// Product events need a product; store views must not carry one.
assert.throws(
  () =>
    validateProductEventInput({
      product_id: null,
      seller_id: "sel_1",
      type: "product_click",
      surface: "vitrina",
      session_id: "sess_12345678",
    }),
  ProductEventValidationError,
);
assert.throws(
  () =>
    validateProductEventInput({
      product_id: "prod_1",
      seller_id: "sel_1",
      type: "store_view",
      surface: "vitrina",
      session_id: "sess_12345678",
    }),
  ProductEventValidationError,
);

// Unknown type or surface, missing seller, short session id: all rejected.
assert.throws(
  () =>
    validateProductEventInput({
      product_id: "prod_1",
      seller_id: "sel_1",
      type: "purchase",
      surface: "vitrina",
      session_id: "sess_12345678",
    }),
  ProductEventValidationError,
);
assert.throws(
  () =>
    validateProductEventInput({
      product_id: "prod_1",
      seller_id: "sel_1",
      type: "product_view",
      surface: "web",
      session_id: "sess_12345678",
    }),
  ProductEventValidationError,
);
assert.throws(
  () =>
    validateProductEventInput({
      product_id: "prod_1",
      seller_id: " ",
      type: "product_view",
      surface: "vitrina",
      session_id: "sess_12345678",
    }),
  ProductEventValidationError,
);
assert.throws(
  () =>
    validateProductEventInput({
      product_id: "prod_1",
      seller_id: "sel_1",
      type: "product_view",
      surface: "vitrina",
      session_id: "abc",
    }),
  ProductEventValidationError,
);

// Extra fields (IP, user agent, client time) are dropped, never stored.
const clean = validateProductEventInput({
  product_id: "prod_1",
  seller_id: "sel_1",
  type: "product_view",
  surface: "vitrina",
  session_id: "sess_12345678",
  ip: "1.2.3.4",
  user_agent: "Mozilla",
  occurred_at: "2020-01-01T00:00:00.000Z",
});
assert.deepEqual(Object.keys(clean).sort(), [
  "product_id",
  "seller_id",
  "session_id",
  "surface",
  "type",
]);

// Retention cutoff: 90 days before now by default.
const now = new Date("2026-11-24T12:00:00.000Z");
assert.equal(retentionCutoff(now).toISOString(), "2026-08-26T12:00:00.000Z");
assert.equal(retentionCutoff(now, 30).toISOString(), "2026-10-25T12:00:00.000Z");

console.log("product-events validation: ok");
