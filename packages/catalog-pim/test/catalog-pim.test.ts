import assert from "node:assert/strict"
import {
  compareCatalogProducts,
  validateCatalogSpecifications,
  type CatalogField,
} from "../../domain/src/catalog-pim.ts"
import {
  CatalogFieldValidationError,
  normalizeFamilyHandle,
  toMercurAttributeType,
  validateCatalogFields,
} from "../src/validation.ts"

/**
 * Rule tests for the PIM contract. Run with `node test/catalog-pim.test.ts`
 * (Node 24 strips the types). No database or HTTP required.
 */

const numericField = {
  attribute_handle: "voltage",
  key: "Voltaje",
  type: "number",
  required: true,
  options: [],
  unit: "v",
  unit_symbol: "V",
  minimum: 0,
  maximum: 240,
  filterable: true,
  comparable: true,
}

const [numeric] = validateCatalogFields([numericField])
assert.equal(numeric.scope, "product", "scope defaults to product")
assert.equal(numeric.minimum, 0)
assert.equal(numeric.unit_symbol, "V")

const [selectField] = validateCatalogFields([
  {
    attribute_handle: "finish",
    key: "Acabado",
    type: "select",
    required: false,
    options: [" Mate ", "Brillo"],
    option_handles: ["mate", "brillo"],
    filterable: true,
    scope: "variant",
  },
])
assert.deepEqual(selectField.options, ["Mate", "Brillo"], "options are trimmed")
assert.equal(selectField.scope, "variant")

assert.equal(toMercurAttributeType("text"), "text")
assert.equal(toMercurAttributeType("number"), "unit")
assert.equal(toMercurAttributeType("boolean"), "toggle")
assert.equal(toMercurAttributeType("select"), "single_select")
assert.equal(toMercurAttributeType("multiselect"), "multi_select")

const base = {
  attribute_handle: "voltage",
  key: "Voltaje",
  type: "number",
  required: true,
  options: [],
}
const invalid: Array<[string, unknown]> = [
  ["empty list", []],
  [
    "more than 24 fields",
    Array.from({ length: 25 }, (_, index) => ({
      ...base,
      attribute_handle: `attr_${index}`,
      key: `Campo ${index}`,
    })),
  ],
  ["missing attribute handle", [{ ...base, attribute_handle: undefined }]],
  ["invalid attribute handle", [{ ...base, attribute_handle: "Voltage!" }]],
  ["reserved key", [{ ...base, key: "__proto__" }]],
  ["unsupported type", [{ ...base, type: "date" }]],
  ["required not boolean", [{ ...base, required: "yes" }]],
  ["invalid scope", [{ ...base, scope: "store" }]],
  ["text filterable", [{ ...base, key: "Notas", type: "text", unit: undefined, filterable: true }]],
  [
    "multiselect filterable",
    [{ ...base, type: "multiselect", options: ["A"], filterable: true }],
  ],
  ["unit on text", [{ ...base, type: "text", unit: "v" }]],
  ["unit symbol without unit", [{ ...base, unit: undefined, unit_symbol: "V" }]],
  ["minimum on text", [{ ...base, type: "text", minimum: 1 }]],
  ["maximum not finite", [{ ...base, maximum: Number.POSITIVE_INFINITY }]],
  ["minimum above maximum", [{ ...base, minimum: 10, maximum: 1 }]],
  ["options on number", [{ ...base, options: ["A"] }]],
  ["select without options", [{ ...base, type: "select" }]],
  ["duplicate options", [{ ...base, type: "select", options: ["A", "a"] }]],
  ["options not aligned with handles", [{ ...base, type: "select", options: ["A", "B"], option_handles: ["a"] }]],
  ["duplicate option handles", [{ ...base, type: "select", options: ["A", "B"], option_handles: ["a", "a"] }]],
  ["duplicate attribute", [base, { ...base, key: "Otro" }]],
  ["duplicate key", [base, { ...base, attribute_handle: "other", key: " voltaje " }]],
  ["empty group", [{ ...base, group: "  " }]],
  ["help too long", [{ ...base, help: "x".repeat(241) }]],
]
for (const [name, input] of invalid) {
  assert.throws(
    () => validateCatalogFields(input),
    CatalogFieldValidationError,
    `expected rejection: ${name}`,
  )
}

assert.equal(normalizeFamilyHandle(" Herramienta-Electrica "), "herramienta-electrica")
assert.throws(() => normalizeFamilyHandle("No Valido"), CatalogFieldValidationError)

const sameVersion = compareCatalogProducts([
  {
    id: "a",
    name: "Taladro A",
    catalog_family_version_id: "v2",
    specifications: { Voltaje: "220" },
  },
  {
    id: "b",
    name: "Taladro B",
    catalog_family_version_id: "v2",
    specifications: { Voltaje: " 110 ", Color: "Rojo" },
  },
])
assert.equal(sameVersion.compatibility.compatible, true)
assert.equal(sameVersion.compatibility.reason, "same_family_version")
assert.equal(sameVersion.attributes.available, true)
assert.deepEqual(
  sameVersion.attributes.rows.map((row) => row.key),
  ["Color", "Voltaje"],
  "rows are sorted by label",
)
const voltage = sameVersion.attributes.rows.find((row) => row.key === "Voltaje")
assert.deepEqual(voltage?.values.map((value) => value.value), ["220", "110"])
assert.deepEqual(voltage?.missingProductIds, [])
const color = sameVersion.attributes.rows.find((row) => row.key === "Color")
assert.deepEqual(color?.missingProductIds, ["a"])

const differentVersions = compareCatalogProducts([
  {
    id: "a",
    name: "Taladro A",
    catalog_family_version_id: "v1",
    specifications: { Voltaje: "220" },
  },
  {
    id: "b",
    name: "Taladro B",
    catalog_family_version_id: "v2",
    specifications: { Voltaje: "110" },
  },
])
assert.equal(differentVersions.compatibility.compatible, false)
assert.equal(differentVersions.compatibility.reason, "different_family_versions")
assert.equal(differentVersions.attributes.reason, "family_incompatible")

const missingFamily = compareCatalogProducts([
  { id: "a", name: "Suelto", catalog_family_version_id: null, specifications: {} },
  { id: "b", name: "Taladro", catalog_family_version_id: "v2", specifications: {} },
])
assert.equal(missingFamily.compatibility.reason, "family_missing")

const hiddenField = compareCatalogProducts([
  {
    id: "a",
    name: "A",
    catalog_family_version_id: "v2",
    specifications: { Color: "Rojo", Voltaje: "220" },
    catalog_family_fields: [
      { key: "Color", comparable: false },
      { key: "Voltaje", comparable: true },
    ],
  },
  {
    id: "b",
    name: "B",
    catalog_family_version_id: "v2",
    specifications: { Color: "Azul", Voltaje: "110" },
    catalog_family_fields: [{ key: "Color", comparable: false }],
  },
])
assert.deepEqual(
  hiddenField.attributes.rows.map((row) => row.key),
  ["Voltaje"],
  "fields marked comparable:false are excluded",
)

assert.equal(
  compareCatalogProducts([
    { id: "a", name: "A", catalog_family_version_id: "v1", specifications: {} },
    { id: "b", name: "B", catalog_family_version_id: "v1", specifications: {} },
  ]).attributes.reason,
  "no_recorded_attributes",
)
assert.throws(() =>
  compareCatalogProducts([
    { id: "a", name: "A", catalog_family_version_id: "v1", specifications: {} },
  ]),
)
assert.throws(() =>
  compareCatalogProducts([
    { id: "a", name: "A", catalog_family_version_id: "v1", specifications: {} },
    { id: "a", name: "B", catalog_family_version_id: "v1", specifications: {} },
  ]),
)

// The validated numeric field is structurally assignable to the contract type.
const contractField: CatalogField = numeric
assert.equal(contractField.key, "Voltaje")

const specificationFields: CatalogField[] = [
  numeric,
  {
    attribute_handle: "finish",
    key: "Acabado",
    scope: "variant",
    type: "select",
    required: false,
    options: ["Mate", "Brillo"],
  },
  {
    attribute_handle: "accessories",
    key: "Accesorios",
    scope: "product",
    type: "multiselect",
    required: false,
    options: ["Maletín", "Batería", "Cable"],
  },
  {
    attribute_handle: "cordless",
    key: "Inalámbrico",
    scope: "product",
    type: "boolean",
    required: false,
    options: [],
  },
  {
    attribute_handle: "notes",
    key: "Notas",
    scope: "product",
    type: "text",
    required: false,
    options: [],
  },
]

assert.deepEqual(
  validateCatalogSpecifications(specificationFields, {
    voltaje: " 220 ",
    ACABADO: "mate",
    accesorios: ["Batería", "Maletín", "batería"],
    inalámbrico: "sí",
    notas: "  Incluye estuche  ",
  }),
  {
    Voltaje: "220",
    Acabado: "Mate",
    Accesorios: "Batería, Maletín",
    Inalámbrico: "Sí",
    Notas: "Incluye estuche",
  },
  "values are normalized to the frozen labels, numbers and booleans",
)

assert.deepEqual(
  validateCatalogSpecifications(specificationFields, { Voltaje: 220 as unknown as string }),
  { Voltaje: "220" },
  "numeric strings and numbers both normalize to the stored string",
)

const invalidSpecifications: Array<[string, Record<string, unknown>]> = [
  ["missing required", { Acabado: "Mate" }],
  ["unknown field", { Voltaje: "220", Peso: "1" }],
  ["non numeric", { Voltaje: "mucha" }],
  ["below minimum", { Voltaje: "-1" }],
  ["above maximum", { Voltaje: "241" }],
  ["invalid boolean", { Voltaje: "220", Inalámbrico: "quizá" }],
  ["option not allowed", { Voltaje: "220", Acabado: "Oro" }],
  ["two options on select", { Voltaje: "220", Acabado: ["Mate", "Brillo"] }],
  ["multiselect with unknown option", { Voltaje: "220", Accesorios: ["Maletín", "Bolsa"] }],
  ["text too long", { Voltaje: "220", Notas: "x".repeat(501) }],
]
for (const [name, values] of invalidSpecifications) {
  assert.throws(
    () => validateCatalogSpecifications(specificationFields, values as never),
    (error: unknown) =>
      (error as { name?: string }).name === "CatalogSpecificationValidationError",
    `expected specification rejection: ${name}`,
  )
}

const assigned = validateCatalogSpecifications(specificationFields, {
  Voltaje: "220",
  Acabado: "Brillo",
})
const comparisonFromStored = compareCatalogProducts([
  {
    id: "a",
    name: "Taladro A",
    catalog_family_version_id: "v3",
    specifications: assigned,
  },
  {
    id: "b",
    name: "Taladro B",
    catalog_family_version_id: "v3",
    specifications: validateCatalogSpecifications(specificationFields, {
      Voltaje: "110",
    }),
  },
])
assert.equal(comparisonFromStored.attributes.available, true)
assert.deepEqual(
  comparisonFromStored.attributes.rows.map((row) => row.key),
  ["Acabado", "Voltaje"],
)

console.log(
  "PASS: field bounds/types, handle slugs, Mercur type mapping, version-scoped comparison and specification validation",
)
