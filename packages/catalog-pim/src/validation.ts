import type {
  CatalogField,
  CatalogFieldScope,
  CatalogFieldType,
} from "@agestyles/domain/catalog-pim" with { "resolution-mode": "import" }
import { AttributeType } from "@mercurjs/types"

/**
 * Pure field validation for catalog family versions.
 *
 * Kept free of Medusa imports so it can be tested without a database and
 * reused by a future shared validation package. The service wraps these errors
 * in a Medusa error before exposing them over HTTP.
 */

export const MAX_CATALOG_FIELDS = 24
export const MAX_CATALOG_OPTIONS = 50
export const MAX_FIELD_LABEL = 80
export const MAX_HELP_LENGTH = 240
export const MAX_OPTION_LENGTH = 120
export const MAX_UNIT_SYMBOL_LENGTH = 24

const ATTRIBUTE_HANDLE_PATTERN = /^[a-z][a-z0-9_-]{0,79}$/
const UNIT_PATTERN = /^[a-z][a-z0-9_]{0,39}$/
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"])

/**
 * Local copy of the domain union: this module must not require the ESM domain
 * package at runtime. The alias below fails typecheck if a type is added to the
 * contract and forgotten here.
 */
const FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "select",
  "multiselect",
] as const satisfies readonly CatalogFieldType[]
type _AssertAllFieldTypesListed = Exclude<
  CatalogFieldType,
  (typeof FIELD_TYPES)[number]
> extends never
  ? true
  : never

export class CatalogFieldValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CatalogFieldValidationError"
  }
}

function fail(message: string): never {
  throw new CatalogFieldValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Maps the AgeStyles presentation type onto Mercur's attribute type. The
 * attribute dictionary stays in Mercur; this is only the adapter that keeps a
 * family field consumable by `product-attribute`.
 *
 * `number` maps to `unit` because Mercur has no plain numeric type; the unit
 * symbol itself is optional.
 */
export const MERCUR_ATTRIBUTE_TYPE: Record<CatalogFieldType, AttributeType> = {
  text: AttributeType.TEXT,
  number: AttributeType.UNIT,
  boolean: AttributeType.TOGGLE,
  select: AttributeType.SINGLE_SELECT,
  multiselect: AttributeType.MULTI_SELECT,
}

export function toMercurAttributeType(type: CatalogFieldType): AttributeType {
  return MERCUR_ATTRIBUTE_TYPE[type]
}

export function validateCatalogFields(raw: unknown): CatalogField[] {
  if (!Array.isArray(raw)) fail("Fields must be an array.")
  if (raw.length < 1 || raw.length > MAX_CATALOG_FIELDS) {
    fail(`Define between 1 and ${MAX_CATALOG_FIELDS} fields.`)
  }

  const attributes = new Set<string>()
  const keys = new Set<string>()

  return raw.map((value, index) => validateField(value, index, attributes, keys))
}

function validateField(
  value: unknown,
  index: number,
  attributes: Set<string>,
  keys: Set<string>,
): CatalogField {
  if (!isRecord(value)) fail(`Field ${index + 1} is not an object.`)

  const attributeHandle = value.attribute_handle
  if (
    typeof attributeHandle !== "string" ||
    !ATTRIBUTE_HANDLE_PATTERN.test(attributeHandle)
  ) {
    fail(`Field ${index + 1} needs a valid attribute_handle.`)
  }

  const rawKey = value.key
  if (typeof rawKey !== "string" || !rawKey.trim() || rawKey.length > MAX_FIELD_LABEL) {
    fail(`Field ${index + 1} needs a key of at most ${MAX_FIELD_LABEL} characters.`)
  }
  const key = rawKey.trim()
  if (RESERVED_KEYS.has(key)) fail(`Field key "${key}" is reserved.`)

  const type = value.type
  if (!FIELD_TYPES.includes(type as CatalogFieldType)) {
    fail(`Field "${key}" has an unsupported type.`)
  }
  const fieldType = type as CatalogFieldType

  if (typeof value.required !== "boolean") {
    fail(`Field "${key}" must declare whether it is required.`)
  }

  const scope = value.scope ?? "product"
  if (scope !== "product" && scope !== "variant") {
    fail(`Field "${key}" scope must be product or variant.`)
  }

  for (const option of ["visible", "comparable"] as const) {
    if (value[option] !== undefined && typeof value[option] !== "boolean") {
      fail(`Field "${key}" ${option} must be a boolean.`)
    }
  }

  if (value.filterable !== undefined) {
    if (typeof value.filterable !== "boolean") {
      fail(`Field "${key}" filterable must be a boolean.`)
    }
    if (value.filterable && (fieldType === "text" || fieldType === "multiselect")) {
      fail(`Field "${key}" cannot be filterable: ${fieldType} filters are not supported yet.`)
    }
  }

  const options = normalizeOptions(key, value.options, fieldType)
  const optionHandles = normalizeOptionHandles(key, value.option_handles, options.length)

  for (const [name, limit] of [
    ["group", MAX_FIELD_LABEL],
    ["help", MAX_HELP_LENGTH],
  ] as const) {
    const text = value[name]
    if (
      text !== undefined &&
      (typeof text !== "string" || !text.trim() || text.length > limit)
    ) {
      fail(`Field "${key}" ${name} is invalid.`)
    }
  }

  const unit = value.unit
  if (unit !== undefined) {
    if (fieldType !== "number" || typeof unit !== "string" || !UNIT_PATTERN.test(unit)) {
      fail(`Field "${key}" unit only applies to numeric fields.`)
    }
  }

  const unitSymbol = value.unit_symbol
  if (unitSymbol !== undefined) {
    if (
      unit === undefined ||
      typeof unitSymbol !== "string" ||
      !unitSymbol.trim() ||
      unitSymbol.length > MAX_UNIT_SYMBOL_LENGTH
    ) {
      fail(`Field "${key}" unit_symbol needs a unit and at most ${MAX_UNIT_SYMBOL_LENGTH} characters.`)
    }
  }

  for (const bound of ["minimum", "maximum"] as const) {
    const limit = value[bound]
    if (
      limit !== undefined &&
      (fieldType !== "number" || typeof limit !== "number" || !Number.isFinite(limit))
    ) {
      fail(`Field "${key}" ${bound} must be a finite number on a numeric field.`)
    }
  }
  if (
    typeof value.minimum === "number" &&
    typeof value.maximum === "number" &&
    value.minimum > value.maximum
  ) {
    fail(`Field "${key}" minimum cannot be greater than maximum.`)
  }

  if (attributes.has(attributeHandle)) {
    fail(`Attribute handle "${attributeHandle}" is repeated.`)
  }
  const normalizedKey = key.toLocaleLowerCase("es")
  if (keys.has(normalizedKey)) fail(`Field key "${key}" is repeated.`)
  attributes.add(attributeHandle)
  keys.add(normalizedKey)

  const filterable =
    typeof value.filterable === "boolean" ? value.filterable : undefined
  const visible = typeof value.visible === "boolean" ? value.visible : undefined
  const comparable =
    typeof value.comparable === "boolean" ? value.comparable : undefined
  const group = typeof value.group === "string" ? value.group.trim() : undefined
  const help = typeof value.help === "string" ? value.help.trim() : undefined
  const normalizedUnit = typeof value.unit === "string" ? value.unit : undefined
  const normalizedUnitSymbol =
    typeof value.unit_symbol === "string" ? value.unit_symbol.trim() : undefined
  const minimum =
    typeof value.minimum === "number" ? value.minimum : undefined
  const maximum =
    typeof value.maximum === "number" ? value.maximum : undefined

  return {
    attribute_handle: attributeHandle,
    key,
    scope: scope as CatalogFieldScope,
    type: fieldType,
    required: value.required,
    options,
    ...(optionHandles === undefined ? {} : { option_handles: optionHandles }),
    ...(filterable === undefined ? {} : { filterable }),
    ...(visible === undefined ? {} : { visible }),
    ...(comparable === undefined ? {} : { comparable }),
    ...(group === undefined ? {} : { group }),
    ...(help === undefined ? {} : { help }),
    ...(normalizedUnit === undefined ? {} : { unit: normalizedUnit }),
    ...(normalizedUnitSymbol === undefined
      ? {}
      : { unit_symbol: normalizedUnitSymbol }),
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
  }
}

function normalizeOptions(
  key: string,
  rawOptions: unknown,
  type: CatalogFieldType,
): string[] {
  if (!Array.isArray(rawOptions) || rawOptions.length > MAX_CATALOG_OPTIONS) {
    fail(`Field "${key}" options must be an array of at most ${MAX_CATALOG_OPTIONS} labels.`)
  }
  const options = rawOptions.map((option) => {
    if (typeof option !== "string" || !option.trim() || option.length > MAX_OPTION_LENGTH) {
      fail(`Field "${key}" has an invalid option.`)
    }
    return option.trim()
  })
  if (new Set(options.map((option) => option.toLocaleLowerCase("es"))).size !== options.length) {
    fail(`Field "${key}" repeats options.`)
  }
  const expectsOptions = type === "select" || type === "multiselect"
  if (expectsOptions ? options.length === 0 : options.length > 0) {
    fail(`Field "${key}" options only apply to select and multi-select fields.`)
  }
  return options
}

function normalizeOptionHandles(
  key: string,
  rawHandles: unknown,
  optionCount: number,
): string[] | undefined {
  if (rawHandles === undefined) return undefined
  if (!Array.isArray(rawHandles) || rawHandles.length !== optionCount) {
    fail(`Field "${key}" option_handles must align with options.`)
  }
  const handles = rawHandles.map((handle) => {
    if (typeof handle !== "string" || !ATTRIBUTE_HANDLE_PATTERN.test(handle)) {
      fail(`Field "${key}" has an invalid option handle.`)
    }
    return handle
  })
  if (new Set(handles).size !== handles.length) {
    fail(`Field "${key}" repeats option handles.`)
  }
  return handles
}

export function normalizeFamilyHandle(raw: string): string {
  const handle = raw.trim().toLocaleLowerCase("en")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle) || handle.length > MAX_FIELD_LABEL) {
    fail("Family handle must be a lowercase slug of at most 80 characters.")
  }
  return handle
}
