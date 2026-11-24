import { model } from "@medusajs/framework/utils";

/**
 * One anonymous view or click on a product or a store (AG-59).
 *
 * AgeStyles needs per-store, per-product traffic in Negocio, and Google
 * Analytics cannot attribute it cleanly per seller. This table is the
 * first-party record: no personal data, no IP address, no user agent, no
 * client timestamp. The session id is a random value the client generates
 * and keeps in its own storage; it only lets the API ignore a repeated
 * event from the same visit. `created_at` is always the server time.
 *
 * A product page with several sellers records one `product_view` per
 * seller, so each store's traffic is its own. `store_view` has no product.
 */
const ProductEvent = model
  .define("agestyles_product_event", {
    id: model.id({ prefix: "pevt" }).primaryKey(),
    /** Null for `store_view`. */
    product_id: model.text().nullable(),
    seller_id: model.text(),
    type: model.enum(["product_view", "store_view", "product_click", "add_to_cart_click"]),
    surface: model.enum(["vitrina", "tienda-web", "tienda-app"]),
    /** Random anonymous id from the client; never a user, device or account id. */
    session_id: model.text(),
  })
  .indexes([
    {
      name: "IDX_agestyles_product_event_seller",
      on: ["seller_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_product_event_product",
      on: ["product_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_product_event_created",
      on: ["created_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      // Same visit, same event: the service treats a second hit as a repeat.
      name: "IDX_agestyles_product_event_session",
      on: ["session_id", "type", "created_at"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ]);

export default ProductEvent;
