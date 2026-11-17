import { model } from "@medusajs/framework/utils"

const OrderQuote = model.define("agestyles_order_quote", {
  id: model.id().primaryKey(),
  cart_id: model.text(),
  customer_id: model.text(),
  seller_ids: model.json(),
  idempotency_key: model.text().unique(),
  intent_hash: model.text(),
  revision: model.number().default(1),
  status: model.enum(["quoted", "accepting", "accepted", "expired", "unavailable"]),
  currency_code: model.text(),
  total: model.bigNumber(),
  available: model.boolean().default(true),
  snapshot: model.json(),
  expires_at: model.dateTime(),
  order_group_id: model.text().nullable(),
})

export default OrderQuote
