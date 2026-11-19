import { model } from "@medusajs/framework/utils";

/**
 * A store's request for a new marketplace category.
 *
 * Mercur 2.4.1 has no way for sellers to create or request categories (its
 * category–seller link only restricts sellers). The store proposes a name and,
 * optionally, where it fits; the administration decides: create it as a main
 * category or under a parent, point the store to an existing category, or
 * reject it. Categories themselves stay in Medusa's product module.
 */
const CategoryRequest = model
  .define("agestyles_category_request", {
    id: model.id({ prefix: "catreq" }).primaryKey(),
    seller_id: model.text(),
    /** Member who sent it. */
    requested_by: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    /** Where the store thinks it fits (a category id); the administration decides. */
    suggested_parent_id: model.text().nullable(),
    /** Why the store needs it (e.g. which products). */
    note: model.text().nullable(),
    status: model.enum(["pending", "approved", "merged", "rejected"]).default("pending"),
    /** Created category (approved) or the existing one the store should use (merged). */
    resolved_category_id: model.text().nullable(),
    /** Message for the store. */
    resolution_note: model.text().nullable(),
    reviewed_by: model.text().nullable(),
    reviewed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_category_request_seller",
      on: ["seller_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_category_request_status",
      on: ["status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ]);

export default CategoryRequest;
