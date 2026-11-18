import assert from "node:assert/strict";
import { onlineSaleLines, parseReversalNote, reversalEntries, saleTotal } from "../src/online.ts";

/** AG-06 phase 4: online sale lines and reversals. Run with `node test/online.test.ts`. */

// Lines from order items: products only, whole quantities, prices rounded.
const lines = onlineSaleLines([
  {
    product_id: "prod_1",
    variant_id: "var_1",
    product_title: "Gorra",
    quantity: 2,
    unit_price: "12.5",
  },
  { product_id: null, quantity: 1, unit_price: 3 },
  { product_id: "prod_2", title: "Bolso", quantity: 0, unit_price: 9 },
  { product_id: "prod_3", title: "Cinto", variant_sku: "C-1", quantity: "1", unit_price: 7.005 },
]);
assert.deepEqual(lines, [
  {
    product_id: "prod_1",
    variant_id: "var_1",
    title: "Gorra",
    sku: null,
    quantity: 2,
    unit_price: 12.5,
  },
  {
    product_id: "prod_3",
    variant_id: null,
    title: "Cinto",
    sku: "C-1",
    quantity: 1,
    unit_price: 7.01,
  },
]);
assert.equal(saleTotal(lines), 32.01);

// Reversal cancels what was earned, per product.
assert.deepEqual(
  reversalEntries([
    { kind: "earned", amount: "1.25", product_id: "prod_1", units: 2 },
    { kind: "earned", amount: 3, product_id: "prod_3", units: 1 },
  ]),
  [
    { kind: "reversed", amount: 1.25, product_id: "prod_1", units: 2 },
    { kind: "reversed", amount: 3, product_id: "prod_3", units: 1 },
  ],
);
// Idempotent: what was already reversed is not reversed again.
assert.deepEqual(
  reversalEntries([
    { kind: "earned", amount: 1.25, product_id: "prod_1", units: 2 },
    { kind: "reversed", amount: -1.25, product_id: "prod_1", units: 2 },
  ]),
  [],
);
// Partial earlier reversal leaves only the rest.
assert.deepEqual(
  reversalEntries([
    { kind: "earned", amount: 5, product_id: "prod_1", units: 4 },
    { kind: "reversed", amount: 2, product_id: "prod_1", units: 2 },
  ]),
  [{ kind: "reversed", amount: 3, product_id: "prod_1", units: 2 }],
);
// Nothing earned (no rule, or a cumulative threshold not reached) → nothing to reverse.
assert.deepEqual(reversalEntries([]), []);

// Reversal note
assert.equal(parseReversalNote({ note: "  Devuelto en tienda " }), "Devuelto en tienda");
assert.equal(parseReversalNote({ note: "   " }), null);
assert.equal(parseReversalNote(undefined), null);
assert.equal(parseReversalNote({ note: "x".repeat(400) })?.length, 300);

console.log("sales-commissions online: ok");
