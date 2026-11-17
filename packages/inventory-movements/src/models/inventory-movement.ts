import { model } from "@medusajs/framework/utils";

/**
 * Append-only history of stock changes made by a seller. Product, SKU,
 * location and actor are snapshotted so the history and its exports stay
 * readable after renames or deletions.
 */
const InventoryMovement = model
  .define("agestyles_inventory_movement", {
    id: model.id({ prefix: "invmov" }).primaryKey(),
    seller_id: model.text(),
    inventory_item_id: model.text(),
    location_id: model.text(),
    type: model.enum(["alta", "baja", "venta", "ajuste"]),
    delta: model.number(),
    quantity_before: model.number(),
    quantity_after: model.number(),
    reason: model.text().nullable(),
    actor_id: model.text(),
    actor_email: model.text().nullable(),
    title: model.text().nullable(),
    sku: model.text().nullable(),
    location_name: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_inventory_movement_seller_created",
      on: ["seller_id", "created_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_inventory_movement_item",
      on: ["inventory_item_id"],
      where: "deleted_at IS NULL",
    },
  ]);

export default InventoryMovement;
