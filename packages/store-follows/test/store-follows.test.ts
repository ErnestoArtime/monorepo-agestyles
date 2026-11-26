import assert from "node:assert/strict";
import {
  MAX_FOLLOWS_PER_CUSTOMER,
  NEW_PRODUCT_WINDOW_DAYS,
  StoreFollowValidationError,
  isRecentProduct,
  isSellerId,
  parseFollowInput,
  parseNotifyInput,
} from "../src/rules.ts";

/** Rule tests for AG-70 (following stores). Run with `node test/store-follows.test.ts`. */

const invalid = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(
    fn,
    (error: unknown) => error instanceof StoreFollowValidationError && pattern.test(error.message),
  );

// Store ids
assert.equal(isSellerId("sel_01JABCDEF123456"), true);
assert.equal(isSellerId("sel_"), false);
assert.equal(isSellerId("prod_01JABCDEF123456"), false);
assert.equal(isSellerId("sel_01/../x"), false);
assert.equal(isSellerId(42), false);

// Follow input: the alert is off unless the customer says so
assert.deepEqual(parseFollowInput({ seller_id: "sel_01JABCDEF123456" }), {
  seller_id: "sel_01JABCDEF123456",
  notify_new_products: undefined,
});
assert.deepEqual(
  parseFollowInput({ seller_id: "sel_01JABCDEF123456", notify_new_products: true }),
  {
    seller_id: "sel_01JABCDEF123456",
    notify_new_products: true,
  },
);
invalid(() => parseFollowInput({}), /tienda/);
invalid(() => parseFollowInput(null), /tienda/);
invalid(() => parseFollowInput({ seller_id: "x" }), /tienda/);
invalid(
  () => parseFollowInput({ seller_id: "sel_01JABCDEF123456", notify_new_products: "yes" }),
  /avisos/,
);

// Notify input
assert.equal(parseNotifyInput({ notify_new_products: false }), false);
assert.equal(parseNotifyInput({ notify_new_products: true }), true);
invalid(() => parseNotifyInput({}), /avisos/);
invalid(() => parseNotifyInput({ notify_new_products: 1 }), /avisos/);

// «New product» window: no alerts for old products when the feature is deployed
const now = new Date("2026-11-26T12:00:00Z");
assert.equal(NEW_PRODUCT_WINDOW_DAYS, 14);
assert.equal(isRecentProduct("2026-11-26T10:00:00Z", now), true);
assert.equal(isRecentProduct(new Date("2026-11-13T12:00:01Z"), now), true);
assert.equal(isRecentProduct("2026-11-12T11:59:59Z", now), false);
assert.equal(isRecentProduct("2026-01-01T00:00:00Z", now), false);
assert.equal(isRecentProduct("2026-11-27T00:00:00Z", now), true, "clock skew still counts as new");
assert.equal(isRecentProduct(null, now), false);
assert.equal(isRecentProduct(undefined, now), false);
assert.equal(isRecentProduct("not a date", now), false);
assert.equal(isRecentProduct("2026-11-20T12:00:00Z", now, 3), false);

assert.ok(MAX_FOLLOWS_PER_CUSTOMER > 0);
console.log("store-follows rules: ok");
