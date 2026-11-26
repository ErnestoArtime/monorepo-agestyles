import { model } from "@medusajs/framework/utils";

/**
 * A customer following a store. `notify_new_products` is the opt-in for a push alert when the
 * store publishes a new product: off by default, changed only by the customer.
 * `seller_id` references Mercur's seller by id only (no cross-module link needed).
 */
const StoreFollow = model
  .define("agestyles_store_follow", {
    id: model.id({ prefix: "sfol" }).primaryKey(),
    customer_id: model.text(),
    seller_id: model.text(),
    notify_new_products: model.boolean().default(false),
  })
  .indexes([
    {
      name: "IDX_agestyles_store_follow_unique",
      on: ["customer_id", "seller_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_store_follow_seller",
      on: ["seller_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ]);

export default StoreFollow;
