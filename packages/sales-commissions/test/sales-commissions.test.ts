import assert from "node:assert/strict";
import {
  CommissionValidationError,
  commissionForLine,
  ledgerBalance,
  normalizeAgentCode,
  parseAgentSaleInput,
  parseRuleInput,
  resolveRule,
  unitsToNextThreshold,
  validateWithdrawal,
} from "../src/rules.ts";

/** Rule tests for AG-06 commissions. Run with `node test/sales-commissions.test.ts`. */

const invalid = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(
    fn,
    (error: unknown) => error instanceof CommissionValidationError && pattern.test(error.message),
  );

// Rule input
assert.deepEqual(parseRuleInput({ kind: "percent", value: 5 }), {
  product_id: null,
  kind: "percent",
  value: 5,
  unit_threshold: null,
});
assert.equal(
  parseRuleInput({ product_id: "prod_1", kind: "fixed", value: "2.5", unit_threshold: "10" })
    .unit_threshold,
  10,
);
invalid(() => parseRuleInput({ kind: "percent", value: 101 }), /100/);
invalid(() => parseRuleInput({ kind: "fixed", value: 2 }), /general de la tienda es un porcentaje/);
invalid(() => parseRuleInput({ product_id: "prod_1", kind: "fixed", value: 0 }), /mayor que cero/);
invalid(
  () => parseRuleInput({ product_id: "prod_1", kind: "fixed", value: 1.005 }),
  /dos decimales/,
);
invalid(() => parseRuleInput({ kind: "bonus", value: 1 }), /porcentaje o importe fijo/);
invalid(
  () => parseRuleInput({ product_id: "prod_1", kind: "percent", value: 5, unit_threshold: 10 }),
  /importe fijo/,
);
invalid(() => parseRuleInput({ kind: "fixed", value: 2, unit_threshold: 10 }), /porcentaje/);
invalid(
  () => parseRuleInput({ product_id: "prod_1", kind: "fixed", value: 2, unit_threshold: 1 }),
  /entre 2/,
);

// Precedence: product rule first, then the store-wide rule
const general = {
  id: "r_store",
  product_id: null,
  kind: "percent" as const,
  value: 10,
  unit_threshold: null,
};
const nike = {
  id: "r_nike",
  product_id: "prod_nike",
  kind: "fixed" as const,
  value: 3,
  unit_threshold: null,
};
assert.equal(resolveRule([general, nike], "prod_nike")?.id, "r_nike");
assert.equal(resolveRule([general, nike], "prod_other")?.id, "r_store");
assert.equal(resolveRule([nike], "prod_other"), null);

// Line commissions
assert.equal(
  commissionForLine(general, { product_id: "p", quantity: 2, unit_price: 19.99 }).amount,
  4,
);
assert.equal(
  commissionForLine(nike, { product_id: "prod_nike", quantity: 2, unit_price: 50 }).amount,
  6,
);
assert.equal(commissionForLine(null, { product_id: "p", quantity: 1, unit_price: 10 }).amount, 0);
invalid(
  () => commissionForLine(general, { product_id: "p", quantity: 0, unit_price: 10 }),
  /Cantidad/,
);

// Cumulative threshold: 5 per completed block of 10 units
const cumulative = {
  id: "r_cum",
  product_id: "prod_c",
  kind: "fixed" as const,
  value: 5,
  unit_threshold: 10,
};
assert.equal(
  commissionForLine(cumulative, { product_id: "prod_c", quantity: 4, unit_price: 1 }, 0).amount,
  0,
);
assert.equal(
  commissionForLine(cumulative, { product_id: "prod_c", quantity: 6, unit_price: 1 }, 4).amount,
  5,
);
assert.equal(
  commissionForLine(cumulative, { product_id: "prod_c", quantity: 25, unit_price: 1 }, 7).amount,
  15,
);
assert.equal(unitsToNextThreshold(cumulative, 13), 7);
assert.equal(unitsToNextThreshold(nike, 13), null);

// Ledger and withdrawals
const entries = [
  { kind: "earned" as const, amount: 10.1 },
  { kind: "earned" as const, amount: 0.2 },
  { kind: "reversed" as const, amount: 3 },
  { kind: "withdrawn" as const, amount: 5 },
];
assert.equal(ledgerBalance(entries), 2.3);
assert.equal(validateWithdrawal("2.30", 2.3), 2.3);
invalid(() => validateWithdrawal(2.31, 2.3), /saldo disponible/);
invalid(() => validateWithdrawal(0, 2.3), /mayor que cero/);
invalid(() => validateWithdrawal(1.234, 2.3), /dos decimales/);

// Agent codes
assert.equal(normalizeAgentCode(" ana2026 "), "ANA2026");
assert.equal(normalizeAgentCode("a-1"), null);
assert.equal(normalizeAgentCode("ABCDEFGHIJKLM"), null);

// Agent sale input
const sale = parseAgentSaleInput({
  location_id: "sloc_1",
  payment_method: "cash",
  note: "  Cliente de la tienda ",
  lines: [{ offer_id: "offer_1", quantity: "2", unit_price: "19.99" }],
});
assert.equal(sale.note, "Cliente de la tienda");
assert.deepEqual(sale.lines, [{ offer_id: "offer_1", quantity: 2, unit_price: 19.99 }]);
const saleBase = { location_id: "sloc_1", payment_method: "transfer" };
invalid(
  () => parseAgentSaleInput({ ...saleBase, payment_method: "bizum", lines: [] }),
  /efectivo o transferencia/,
);
invalid(() => parseAgentSaleInput({ ...saleBase, lines: [] }), /al menos un producto/);
invalid(
  () =>
    parseAgentSaleInput({ ...saleBase, lines: [{ offer_id: "o", quantity: 0, unit_price: 1 }] }),
  /entero entre 1/,
);
invalid(
  () =>
    parseAgentSaleInput({
      ...saleBase,
      lines: [{ offer_id: "o", quantity: 1, unit_price: 1.234 }],
    }),
  /dos decimales/,
);
invalid(
  () =>
    parseAgentSaleInput({
      ...saleBase,
      lines: [
        { offer_id: "o", quantity: 1, unit_price: 1 },
        { offer_id: "o", quantity: 2, unit_price: 1 },
      ],
    }),
  /una vez/,
);

console.log("sales-commissions rules: ok");
