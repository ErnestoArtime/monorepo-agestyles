import { model } from "@medusajs/framework/utils"
import type { CatalogField } from "@agestyles/domain/catalog-pim" with {
  "resolution-mode": "import"
}

/**
 * Immutable field snapshot for one family version.
 *
 * `family_id` is stored as plain text instead of a MikroORM relation: the
 * service enforces the family/version boundary and the module stays free of
 * cross-entity cascade surprises during upstream upgrades.
 */
const CatalogFamilyVersion = model
  .define("agestyles_catalog_family_version", {
    id: model.id({ prefix: "cafav" }).primaryKey(),
    family_id: model.text(),
    version: model.number(),
    status: model.enum(["draft", "published", "archived"]).default("draft"),
    /** `CatalogField[]`; revalidated before publishing. */
    fields: model.json(),
    frozen_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_catalog_family_version_unique",
      on: ["family_id", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_catalog_family_version_status",
      on: ["family_id", "status"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export type CatalogFamilyVersionRecord = {
  id: string
  family_id: string
  version: number
  status: "draft" | "published" | "archived"
  fields: CatalogField[]
  frozen_at: Date | string | null
  created_by: string | null
}

export default CatalogFamilyVersion
