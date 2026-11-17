import { model } from "@medusajs/framework/utils"

/**
 * Manual payment proof for one order.
 *
 * AgeStyles collects transfers, deposits and cash payments outside a payment
 * provider; Mercur/Medusa have no receipt model. Each row is one submitted
 * proof that an administrator verifies or rejects. The order and its money
 * stay in Medusa: this module never recalculates totals or moves stock.
 */
const ManualPayment = model
  .define("agestyles_manual_payment", {
    id: model.id({ prefix: "mpay" }).primaryKey(),
    order_id: model.text(),
    /** Mercur order group, when the order belongs to a multi-seller group. */
    order_group_id: model.text().nullable(),
    customer_id: model.text(),
    /** Null when the proof covers the whole order group. */
    seller_id: model.text().nullable(),
    /** Decimal money; `model.number()` would map to an integer column. */
    amount: model.bigNumber(),
    currency_code: model.text(),
    method: model.enum(["transfer", "deposit", "cash", "other"]),
    /** Bank/operation reference the buyer typed. */
    reference: model.text(),
    receipt_url: model.text().nullable(),
    notes: model.text().nullable(),
    status: model.enum(["pending", "verified", "rejected"]).default("pending"),
    reviewed_by: model.text().nullable(),
    reviewed_at: model.dateTime().nullable(),
    rejection_reason: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_manual_payment_order",
      on: ["order_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_manual_payment_customer",
      on: ["customer_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // One open proof per order and seller; rejected proofs stay as history.
      name: "IDX_agestyles_manual_payment_pending_unique",
      on: ["order_id", "seller_id"],
      unique: true,
      where: "deleted_at IS NULL AND status = 'pending'",
    },
  ])

export default ManualPayment
