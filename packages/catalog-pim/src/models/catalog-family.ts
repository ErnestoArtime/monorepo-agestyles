import { model } from "@medusajs/framework/utils"

/**
 * A catalog family groups products that share a comparison schema.
 *
 * The family itself only holds identity and taxonomy. Comparable fields live on
 * its versions, because editing a family must not change products that were
 * already published against an older version.
 */
const CatalogFamily = model
  .define("agestyles_catalog_family", {
    id: model.id({ prefix: "cafam" }).primaryKey(),
    handle: model.text().searchable(),
    name: model.text().searchable(),
    /** Medusa `product_category.id`; validated by the API layer. */
    category_id: model.text(),
    description: model.text().nullable(),
    is_active: model.boolean().default(true),
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_catalog_family_handle_unique",
      on: ["handle"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_catalog_family_category",
      on: ["category_id"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default CatalogFamily
