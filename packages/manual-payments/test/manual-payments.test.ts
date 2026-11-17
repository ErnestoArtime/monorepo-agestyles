import assert from "node:assert/strict"
import {
  assertPaymentMatchesOrder,
  assertPaymentWithinOrder,
  ManualPaymentValidationError,
  validateAmount,
  validateCurrency,
  validateManualPaymentInput,
  validatePaymentMethod,
  validateRejectionReason,
} from "../src/validation.ts"

/**
 * Rule tests for manual payment proofs. Run with
 * `node test/manual-payments.test.ts` (Node 24 strips the types).
 * No database or HTTP required.
 */

const base = {
  order_id: "order_123",
  customer_id: "cus_123",
  amount: 49.9,
  currency_code: "eur",
  method: "transfer",
  reference: "TRF-2026-0001",
}

const parsed = validateManualPaymentInput(base)
assert.equal(parsed.order_id, "order_123")
assert.equal(parsed.amount, 49.9)
assert.equal(parsed.currency_code, "eur")
assert.equal(parsed.seller_id, null)
assert.equal(parsed.receipt_url, null)

assert.deepEqual(
  validateManualPaymentInput({
    ...base,
    seller_id: " sel_1 ",
    order_group_id: "og_1",
    receipt_url: "https://cdn.example.com/comprobante.pdf",
    notes: " Transferencia del lunes ",
  }),
  {
    order_id: "order_123",
    order_group_id: "og_1",
    customer_id: "cus_123",
    seller_id: "sel_1",
    amount: 49.9,
    currency_code: "eur",
    method: "transfer",
    reference: "TRF-2026-0001",
    receipt_url: "https://cdn.example.com/comprobante.pdf",
    notes: "Transferencia del lunes",
  },
)

assert.equal(validateAmount("12.50"), 12.5)
assert.equal(validatePaymentMethod("cash"), "cash")
assert.equal(validateCurrency("usd"), "usd")
assert.equal(validateRejectionReason("  Sin comprobante  "), "Sin comprobante")

const invalidInputs: Array<[string, Record<string, unknown>]> = [
  ["missing order", { ...base, order_id: "" }],
  ["zero amount", { ...base, amount: 0 }],
  ["negative amount", { ...base, amount: -1 }],
  ["sub-cent amount", { ...base, amount: 1.005 }],
  ["non numeric amount", { ...base, amount: "abc" }],
  ["uppercase currency", { ...base, currency_code: "EUR" }],
  ["unknown method", { ...base, method: "crypto" }],
  ["empty reference", { ...base, reference: "   " }],
  ["long reference", { ...base, reference: "x".repeat(121) }],
  ["relative receipt url", { ...base, receipt_url: "/comprobante.pdf" }],
  ["ftp receipt url", { ...base, receipt_url: "ftp://example.com/a.pdf" }],
  ["long notes", { ...base, notes: "x".repeat(501) }],
]
for (const [name, input] of invalidInputs) {
  assert.throws(
    () => validateManualPaymentInput(input),
    ManualPaymentValidationError,
    `expected rejection: ${name}`,
  )
}

assert.throws(() => validateRejectionReason("  "), ManualPaymentValidationError)
assert.throws(
  () => validateRejectionReason("x".repeat(241)),
  ManualPaymentValidationError,
)

assert.doesNotThrow(() =>
  assertPaymentMatchesOrder(
    { amount: 49.9, currency_code: "eur" },
    { total: 49.9, currency_code: "eur" },
  ),
)
assert.throws(
  () =>
    assertPaymentMatchesOrder(
      { amount: 49.9, currency_code: "eur" },
      { total: 50, currency_code: "eur" },
    ),
  ManualPaymentValidationError,
  "amount mismatch is rejected",
)
assert.throws(
  () =>
    assertPaymentMatchesOrder(
      { amount: 49.9, currency_code: "usd" },
      { total: 49.9, currency_code: "eur" },
    ),
  ManualPaymentValidationError,
  "currency mismatch is rejected",
)

assert.doesNotThrow(() =>
  assertPaymentWithinOrder(
    { amount: 10, currency_code: "eur" },
    { total: 49.9, currency_code: "eur" },
  ),
)
assert.throws(
  () =>
    assertPaymentWithinOrder(
      { amount: 60, currency_code: "eur" },
      { total: 49.9, currency_code: "eur" },
    ),
  ManualPaymentValidationError,
  "a proof above the order total is rejected",
)
assert.throws(
  () =>
    assertPaymentWithinOrder(
      { amount: 10, currency_code: "usd" },
      { total: 49.9, currency_code: "eur" },
    ),
  ManualPaymentValidationError,
  "a proof in another currency is rejected",
)

console.log(
  "PASS: manual payment input bounds, method/currency/amount rules and order reconciliation",
)
