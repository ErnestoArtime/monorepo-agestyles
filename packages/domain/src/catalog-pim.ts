/**
 * Catalog PIM contracts shared by web, native and the commerce API.
 *
 * A catalog family groups products that can be compared. Editing a family
 * creates a new immutable version; products keep pointing at the version they
 * were published with, so a comparison only includes products whose fields
 * were defined by the same version.
 *
 * Fields reference Mercur's `product-attribute` dictionary by handle. Labels,
 * units and value handles are frozen on the version so a later dictionary edit
 * cannot silently change an existing comparison.
 */

export const CATALOG_FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "select",
  "multiselect",
] as const

export type CatalogFieldType = (typeof CATALOG_FIELD_TYPES)[number]

export type CatalogFieldScope = "product" | "variant"

export type CatalogField = {
  /** `product_attribute.handle` in Mercur's attribute dictionary. */
  attribute_handle: string
  /** Stable specification key used on products and in comparisons. */
  key: string
  /** Product-level fields are shared by all variants; variant fields are not. */
  scope: CatalogFieldScope
  type: CatalogFieldType
  required: boolean
  /** Text and multi-select fields cannot be filtered in v1. */
  filterable?: boolean
  visible?: boolean
  /** False excludes the field from product comparisons. */
  comparable?: boolean
  /** Allowed labels for select/multi-select; empty otherwise. */
  options: string[]
  /** `product_attribute_value.handle` values aligned by index with `options`. */
  option_handles?: string[]
  group?: string
  help?: string
  /** Unit code, only on numeric fields. */
  unit?: string
  /** Symbol frozen when the version is created, e.g. "V" or "mm". */
  unit_symbol?: string
  minimum?: number
  maximum?: number
}

export type CatalogFamilySummary = {
  id: string
  handle: string
  name: string
  /** Medusa `product_category.id`; the storefront resolves the handle. */
  category_id: string
  description: string | null
  is_active: boolean
}

export type CatalogFamilyVersionStatus = "draft" | "published" | "archived"

export type CatalogFamilyVersion = {
  id: string
  family_id: string
  version: number
  status: CatalogFamilyVersionStatus
  fields: CatalogField[]
  /** ISO timestamp set when the version is published; null while draft. */
  frozen_at: string | null
}

export type CatalogFamilyWithVersions = CatalogFamilySummary & {
  versions: CatalogFamilyVersion[]
}

/**
 * Why a set of products may not share a comparison table. A missing family and
 * a different family are separate reasons because the UI explains them
 * differently: "no catalog family yet" vs "different versions".
 */
export type CatalogCompatibility = {
  compatible: boolean
  reason: "same_family_version" | "family_missing" | "different_family_versions"
}

export type CatalogComparisonProduct = {
  id: string
  name: string
  catalog_family_version_id: string | null
  specifications: Record<string, string> | null
  catalog_family_fields?: Array<Pick<CatalogField, "key" | "comparable">> | null
}

export type CatalogComparisonAttribute = {
  key: string
  values: Array<{
    productId: string
    productName: string
    value: string | null
  }>
  missingProductIds: string[]
}

export type CatalogComparison = {
  productCount: number
  compatibility: CatalogCompatibility
  attributes: {
    available: boolean
    reason: "available" | "family_incompatible" | "no_recorded_attributes"
    rows: CatalogComparisonAttribute[]
  }
}

export type CatalogSpecificationValues = Record<
  string,
  string | string[] | null | undefined
>

export type CatalogSpecificationError = {
  key: string
  reason:
    | "unknown_field"
    | "required"
    | "invalid_number"
    | "out_of_range"
    | "invalid_boolean"
    | "invalid_option"
    | "too_long"
}

function specificationError(
  key: string,
  reason: CatalogSpecificationError["reason"],
  message: string,
): never {
  throw Object.assign(new Error(message), {
    name: "CatalogSpecificationValidationError",
    key,
    reason,
  })
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase("es")
}

/**
 * Validates the values a product stores for one published family version.
 *
 * Only fields of that version are accepted, required fields must be present,
 * and each value is checked against the frozen field definition (type, allowed
 * options and numeric bounds). The result is the canonical
 * `Record<string, string>` shape used by `compareCatalogProducts`, so a stored
 * product can be compared later without re-reading the version.
 *
 * Kept in the shared domain package: the admin endpoint and the comparison
 * endpoint must agree on what a valid specification is.
 */
export function validateCatalogSpecifications(
  fields: CatalogField[],
  values: CatalogSpecificationValues,
): Record<string, string> {
  const fieldsByKey = new Map(
    fields.map((field) => [normalizedKey(field.key), field]),
  )
  const normalized: Record<string, string> = {}
  const provided = new Map<string, string | string[] | null | undefined>()
  for (const [rawKey, value] of Object.entries(values ?? {})) {
    const key = normalizedKey(rawKey)
    if (!fieldsByKey.has(key)) {
      specificationError(
        rawKey,
        "unknown_field",
        `Field "${rawKey}" is not part of this catalog family version.`,
      )
    }
    provided.set(key, value)
  }

  for (const field of fields) {
    const key = normalizedKey(field.key)
    const raw = provided.get(key)
    const empty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && !raw.trim()) ||
      (Array.isArray(raw) && raw.length === 0)

    if (empty) {
      if (field.required) {
        specificationError(
          field.key,
          "required",
          `Field "${field.key}" is required.`,
        )
      }
      continue
    }

    if (Array.isArray(raw) && field.type !== "multiselect") {
      specificationError(
        field.key,
        "invalid_option",
        `Field "${field.key}" accepts a single value.`,
      )
    }

    switch (field.type) {
      case "text": {
        const text = Array.isArray(raw) ? raw.join(", ") : String(raw).trim()
        normalized[field.key] = text
        break
      }
      case "number": {
        const text = Array.isArray(raw) ? raw.join(",") : String(raw).trim()
        const number = Number(text)
        if (!Number.isFinite(number)) {
          specificationError(
            field.key,
            "invalid_number",
            `Field "${field.key}" must be a finite number.`,
          )
        }
        if (
          (typeof field.minimum === "number" && number < field.minimum) ||
          (typeof field.maximum === "number" && number > field.maximum)
        ) {
          specificationError(
            field.key,
            "out_of_range",
            `Field "${field.key}" is outside its allowed range.`,
          )
        }
        normalized[field.key] = String(number)
        break
      }
      case "boolean": {
        const text = Array.isArray(raw) ? raw.join(",") : String(raw).trim()
        const lower = text.toLocaleLowerCase("es")
        if (!["true", "false", "si", "sí", "no"].includes(lower)) {
          specificationError(
            field.key,
            "invalid_boolean",
            `Field "${field.key}" must be true or false.`,
          )
        }
        normalized[field.key] = ["true", "si", "sí"].includes(lower)
          ? "Sí"
          : "No"
        break
      }
      case "select":
      case "multiselect": {
        const requested = (Array.isArray(raw) ? raw : String(raw).split(","))
          .map((option) => String(option).trim())
          .filter(Boolean)
        if (field.type === "select" && requested.length !== 1) {
          specificationError(
            field.key,
            "invalid_option",
            `Field "${field.key}" accepts exactly one option.`,
          )
        }
        const chosen: string[] = []
        for (const option of requested) {
          const match = field.options.find(
            (allowed) => normalizedKey(allowed) === normalizedKey(option),
          )
          if (!match) {
            specificationError(
              field.key,
              "invalid_option",
              `Field "${field.key}" does not allow "${option}".`,
            )
          }
          if (!chosen.includes(match)) chosen.push(match)
        }
        normalized[field.key] =
          field.type === "select" ? chosen[0] : chosen.join(", ")
        break
      }
      default: {
        // A new field type must be handled explicitly, not silently stored.
        specificationError(
          field.key,
          "unknown_field",
          `Field "${field.key}" has an unsupported type.`,
        )
      }
    }

    if (normalized[field.key].length > 500) {
      specificationError(
        field.key,
        "too_long",
        `Field "${field.key}" is too long.`,
      )
    }
  }

  return normalized
}

/**
 * Compares two to four products. Ported from the proven Catalogo rule: only
 * stored specification values are compared, keys are matched
 * case-insensitively, and fields marked `comparable: false` are excluded.
 */
export function compareCatalogProducts(
  products: CatalogComparisonProduct[],
): CatalogComparison {
  if (products.length < 2 || products.length > 4) {
    throw new Error("A comparison requires between 2 and 4 products.")
  }
  if (products.some((product) => !product.id || !product.name)) {
    throw new Error("Every compared product needs an id and a name.")
  }
  const productIds = products.map((product) => product.id.trim())
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("A product cannot be compared with itself.")
  }

  const familyIds = products.map(
    (product) => product.catalog_family_version_id?.trim() || null,
  )
  const allHaveFamily = familyIds.every(Boolean)
  const sameFamily = allHaveFamily && familyIds.every((id) => id === familyIds[0])
  const compatibility: CatalogCompatibility = {
    compatible: sameFamily,
    reason: sameFamily
      ? "same_family_version"
      : !allHaveFamily
        ? "family_missing"
        : "different_family_versions",
  }

  if (!sameFamily) {
    return {
      productCount: products.length,
      compatibility,
      attributes: { available: false, reason: "family_incompatible", rows: [] },
    }
  }

  const keysByNormalizedLabel = new Map<string, string>()
  const nonComparableKeys = new Set(
    products
      .flatMap((product) => product.catalog_family_fields || [])
      .filter((field) => field.comparable === false)
      .map((field) => field.key.trim().toLocaleLowerCase("es")),
  )
  for (const product of products) {
    for (const [rawKey, value] of Object.entries(product.specifications ?? {})) {
      const key = rawKey.trim()
      if (
        key &&
        !nonComparableKeys.has(key.toLocaleLowerCase("es")) &&
        typeof value === "string" &&
        value.trim()
      ) {
        const normalized = key.toLocaleLowerCase("es")
        if (!keysByNormalizedLabel.has(normalized)) {
          keysByNormalizedLabel.set(normalized, key)
        }
      }
    }
  }
  const keys = [...keysByNormalizedLabel.values()].sort((a, b) =>
    a.localeCompare(b, "es"),
  )

  if (!keys.length) {
    return {
      productCount: products.length,
      compatibility,
      attributes: { available: false, reason: "no_recorded_attributes", rows: [] },
    }
  }

  const rows = keys.map((key) => {
    const values = products.map((product) => {
      const entry = Object.entries(product.specifications ?? {}).find(
        ([storedKey]) =>
          storedKey.trim().toLocaleLowerCase("es") === key.toLocaleLowerCase("es"),
      )
      const value =
        typeof entry?.[1] === "string" && entry[1].trim() ? entry[1].trim() : null
      return { productId: product.id, productName: product.name, value }
    })
    return {
      key,
      values,
      missingProductIds: values
        .filter((item) => item.value === null)
        .map((item) => item.productId),
    }
  })

  return {
    productCount: products.length,
    compatibility,
    attributes: { available: true, reason: "available", rows },
  }
}
