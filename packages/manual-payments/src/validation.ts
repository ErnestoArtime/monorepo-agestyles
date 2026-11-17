/**
 * Pure validation for manual payment proofs.
 *
 * Kept free of Medusa imports so it can be unit-tested without a database and
 * reused by HTTP handlers. Money is never recalculated here: the amount must
 * match what the buyer claims to have paid and is validated by the route
 * against the order.
 */

export const MANUAL_PAYMENT_METHODS = [
  "transfer",
  "deposit",
  "cash",
  "other",
] as const

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export class ManualPaymentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ManualPaymentValidationError"
  }
}

function fail(message: string): never {
  throw new ManualPaymentValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const CURRENCY_PATTERN = /^[a-z]{3}$/
const MAX_REFERENCE = 120
const MAX_RECEIPT_URL = 500
const MAX_NOTES = 500
const MAX_REJECTION_REASON = 240

function requiredText(
  value: unknown,
  name: string,
  max: number,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    fail(`${name} must be a non-empty string of at most ${max} characters.`)
  }
  return value.trim()
}

export function validatePaymentMethod(value: unknown): ManualPaymentMethod {
  if (
    typeof value !== "string" ||
    !MANUAL_PAYMENT_METHODS.includes(value as ManualPaymentMethod)
  ) {
    fail("method must be transfer, deposit, cash or other.")
  }
  return value as ManualPaymentMethod
}

export function validateCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
    fail("currency_code must be a three-letter lowercase ISO code.")
  }
  return value
}

export function validateAmount(value: unknown): number {
  const amount =
    typeof value === "string" && value.trim() ? Number(value) : value
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    fail("amount must be a positive finite number.")
  }
  // Two decimals: the API must not store sub-cent precision.
  if (Math.round(amount * 100) !== amount * 100) {
    fail("amount cannot have more than two decimals.")
  }
  return amount
}

export type ManualPaymentInput = {
  order_id: string
  order_group_id: string | null
  customer_id: string
  seller_id: string | null
  amount: number
  currency_code: string
  method: ManualPaymentMethod
  reference: string
  receipt_url: string | null
  notes: string | null
}

export function validateManualPaymentInput(raw: unknown): ManualPaymentInput {
  if (!isRecord(raw)) fail("The payment proof must be an object.")

  const orderId = requiredText(raw.order_id, "order_id", 120)
  const customerId = requiredText(raw.customer_id, "customer_id", 120)
  const reference = requiredText(raw.reference, "reference", MAX_REFERENCE)

  let orderGroupId: string | null = null
  if (raw.order_group_id !== undefined && raw.order_group_id !== null) {
    orderGroupId = requiredText(raw.order_group_id, "order_group_id", 120)
  }

  let sellerId: string | null = null
  if (raw.seller_id !== undefined && raw.seller_id !== null) {
    sellerId = requiredText(raw.seller_id, "seller_id", 120)
  }

  let receiptUrl: string | null = null
  if (raw.receipt_url !== undefined && raw.receipt_url !== null) {
    const value = requiredText(raw.receipt_url, "receipt_url", MAX_RECEIPT_URL)
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      fail("receipt_url must be an absolute http(s) URL.")
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail("receipt_url must be an absolute http(s) URL.")
    }
    receiptUrl = value
  }

  let notes: string | null = null
  if (raw.notes !== undefined && raw.notes !== null) {
    notes = requiredText(raw.notes, "notes", MAX_NOTES)
  }

  return {
    order_id: orderId,
    order_group_id: orderGroupId,
    customer_id: customerId,
    seller_id: sellerId,
    amount: validateAmount(raw.amount),
    currency_code: validateCurrency(raw.currency_code),
    method: validatePaymentMethod(raw.method),
    reference,
    receipt_url: receiptUrl,
    notes,
  }
}

export function validateRejectionReason(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length < 3 ||
    value.length > MAX_REJECTION_REASON
  ) {
    fail(
      `A rejection reason of 3 to ${MAX_REJECTION_REASON} characters is required.`,
    )
  }
  return value.trim()
}

/**
 * A proof can only be reconciled when amount and currency match the order.
 */
export function assertPaymentMatchesOrder(
  payment: { amount: number | string; currency_code: string },
  order: { total: number | string; currency_code: string },
): void {
  const amount = Number(payment.amount)
  const total = Number(order.total)
  if (payment.currency_code !== order.currency_code) {
    fail(
      `The proof currency ${payment.currency_code} does not match the order currency ${order.currency_code}.`,
    )
  }
  if (Math.round(amount * 100) !== Math.round(total * 100)) {
    fail("The proof amount does not match the order total.")
  }
}

/**
 * At submit time a deposit or partial transfer is legitimate, but it can never
 * exceed the order total nor use another currency.
 */
export function assertPaymentWithinOrder(
  payment: { amount: number | string; currency_code: string },
  order: { total: number | string; currency_code: string },
): void {
  const amount = Number(payment.amount)
  const total = Number(order.total)
  if (payment.currency_code !== order.currency_code) {
    fail(
      `The proof currency ${payment.currency_code} does not match the order currency ${order.currency_code}.`,
    )
  }
  if (amount > total) {
    fail("The proof amount cannot exceed the order total.")
  }
}
