import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const FORMAT = "agestyles.stage-interchange"
const CONTRACT = "agestyles-stage-interchange-v1"
const SOURCE_FILES = ["categories", "subcategories", "products", "image_metadata"]
const CURRENCIES = new Set(["USD", "CUP"])
const PUBLICATION_STATES = new Set(["draft", "published", "archived"])
const MAX_SOURCE_FILE_BYTES = 250 * 1024 * 1024
const SAFE_ID_PATTERN = /^[\p{L}\p{N}._:-]+$/u

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function fail(code) {
  throw new Error(code)
}

function requireArray(value, code) {
  if (!Array.isArray(value)) fail(code)
  return value
}

function requireId(value, code) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 200 ||
    value.trim() !== value ||
    !SAFE_ID_PATTERN.test(value)
  ) {
    fail(code)
  }
  return value
}

function stableId(prefix, id) {
  if (typeof id !== "string" && !(typeof id === "number" && Number.isSafeInteger(id))) {
    fail("invalid_legacy_id")
  }
  return `${prefix}:${requireId(String(id), "invalid_legacy_id")}`
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function parseVariantOptions(value) {
  if (value == null || value === "") return [{ key: "__default__", label: "Default" }]
  let options = value
  if (typeof value === "string") {
    try {
      options = JSON.parse(value)
    } catch {
      fail("invalid_variant_options")
    }
  }
  if (!Array.isArray(options) || options.length > 100) fail("invalid_variant_options")
  const seen = new Set()
  for (const option of options) {
    if (!object(option) || typeof option.key !== "string" || typeof option.label !== "string") {
      fail("invalid_variant_options")
    }
    if (!option.key || !option.label || seen.has(option.key)) fail("invalid_variant_options")
    seen.add(option.key)
  }
  return options
}

function normalizeSpecifications(value) {
  if (value == null || value === "") return undefined
  let parsed = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      fail("invalid_product_specifications")
    }
  }
  if (!object(parsed)) fail("invalid_product_specifications")
  return parsed
}

async function readProjection(inputDir, name) {
  const filename = path.join(inputDir, `${name}.json`)
  let info
  try {
    info = await lstat(filename)
  } catch {
    fail("projection_file_missing_or_unreadable")
  }
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SOURCE_FILE_BYTES) {
    fail("projection_file_not_regular_or_too_large")
  }
  const bytes = await readFile(filename).catch(() => fail("projection_file_missing_or_unreadable"))
  let rows
  try {
    rows = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail("projection_invalid_json")
  }
  return requireArray(rows, "projection_dataset_must_be_array")
}

function normalizeMedia(rows, products) {
  const productIds = new Set(products.map((row) => String(row.id)))
  return rows.map((row) => {
    if (!object(row) || !productIds.has(String(row.product_id))) fail("invalid_media_projection")
    if (Object.keys(row).some((key) => /url/i.test(key))) fail("media_url_field_forbidden")
    if (!/^[a-f0-9]{64}$/.test(row.sha256 ?? "")) fail("media_hash_required")
    if (typeof row.mime_type !== "string" || !row.mime_type.startsWith("image/")) {
      fail("media_image_mime_type_required")
    }
    return {
      legacy_id: stableId("media", row.id),
      references: [],
      payload: { sha256: row.sha256, mime_type: row.mime_type },
      product_id: String(row.product_id),
      display_order: Number.isInteger(row.display_order) ? row.display_order : 0,
      is_primary: row.is_primary === true,
    }
  })
}

function normalizeCategories(categories, subcategories) {
  const bySlug = new Map()
  const rows = categories.map((row) => {
    if (!object(row)) fail("invalid_category_projection")
    requireId(row.id, "invalid_category_id")
    requireId(row.slug, "invalid_category_slug")
    if (bySlug.has(row.slug)) fail("duplicate_category_slug")
    bySlug.set(row.slug, stableId("category", row.id))
    return {
      legacy_id: stableId("category", row.id),
      references: [],
      payload: { slug: row.slug, name: String(row.name ?? ""), sort_order: row.sort_order ?? 0 },
    }
  })

  const subcategoryById = new Map()
  for (const row of subcategories) {
    if (!object(row)) fail("invalid_subcategory_projection")
    const parentId = bySlug.get(row.category_slug)
    if (!parentId) fail("subcategory_category_unresolved")
    const id = stableId("subcategory", row.id)
    if (subcategoryById.has(String(row.id))) fail("duplicate_subcategory_id")
    subcategoryById.set(String(row.id), id)
    rows.push({
      legacy_id: id,
      references: [{ relation: "parent_category", entity: "categories", legacy_id: parentId }],
      payload: { slug: row.slug, name: String(row.name ?? ""), sort_order: row.sort_order ?? 0 },
    })
  }
  return { rows, bySlug, subcategoryById }
}

function normalizeProducts(products, categories, media) {
  const productIds = new Set()
  const productRows = []
  const variantRows = []
  const mediaByProduct = new Map()
  for (const item of media) {
    const existing = mediaByProduct.get(item.product_id) ?? []
    existing.push(item)
    mediaByProduct.set(item.product_id, existing)
  }

  for (const source of products) {
    if (!object(source)) fail("invalid_product_projection")
    const id = requireId(source.id, "invalid_product_id")
    if (productIds.has(id)) fail("duplicate_product_id")
    productIds.add(id)
    const categoryId =
      source.subcategory_id != null
        ? categories.subcategoryById.get(String(source.subcategory_id))
        : categories.bySlug.get(source.category_slug ?? source.category)
    if (!categoryId) fail("product_category_unresolved")
    const currency = String(source.currency ?? "").toUpperCase()
    if (!CURRENCIES.has(currency)) fail("product_currency_unsupported")
    const publicationStatus = source.publication_status ?? "draft"
    if (!PUBLICATION_STATES.has(publicationStatus)) fail("product_publication_status_unsupported")

    const mediaRefs = (mediaByProduct.get(id) ?? [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((item) => item.legacy_id)
    const references = [{ relation: "category", entity: "categories", legacy_id: categoryId }]
    for (const legacyId of mediaRefs) {
      references.push({ relation: "media", entity: "media_objects", legacy_id: legacyId })
    }
    const payload = {
      title: String(source.name ?? ""),
      description: source.description == null ? "" : String(source.description),
      code: source.code == null ? null : String(source.code),
      price: source.price == null ? null : String(source.price),
      currency,
      publication_status: publicationStatus,
      featured: source.featured === true,
      gender: source.gender ?? null,
      model: source.model ?? null,
      legacy_brand_id: source.brand_id == null ? null : String(source.brand_id),
      catalog_family_version_id:
        source.catalog_family_version_id == null ? null : String(source.catalog_family_version_id),
      specifications: normalizeSpecifications(source.specifications) ?? null,
      media_count: mediaRefs.length,
      import_visibility: "draft_until_reconciled",
    }
    productRows.push({ legacy_id: stableId("product", id), references, payload })

    for (const option of parseVariantOptions(source.variant_options)) {
      variantRows.push({
        legacy_id: stableId("variant", `${id}:${option.key}`),
        references: [
          { relation: "product", entity: "products", legacy_id: stableId("product", id) },
        ],
        payload: { variant_key: option.key, label: option.label },
      })
    }
  }
  return { productRows, variantRows }
}

/** Convert a sanitized, local catalog projection to a dry-run staging bundle. */
export async function projectCatalog(inputDir, outputDir, { exportId } = {}) {
  if (typeof exportId !== "string") fail("export_id_required")
  requireId(exportId, "export_id_required")
  const input = path.resolve(inputDir)
  const output = path.resolve(outputDir)
  if (input === output || output.startsWith(`${input}${path.sep}`))
    fail("output_must_be_outside_input")
  const outputInfo = await lstat(output).catch(() => null)
  if (outputInfo) fail("output_directory_must_not_exist")

  const [categories, subcategories, products, imageMetadata] = await Promise.all(
    SOURCE_FILES.map((name) => readProjection(input, name)),
  )
  if (products.length === 0) fail("catalog_products_required")
  const normalizedCategories = normalizeCategories(categories, subcategories)
  const media = normalizeMedia(imageMetadata, products)
  const normalizedProducts = normalizeProducts(products, normalizedCategories, media)
  const datasets = new Map([
    ["categories", normalizedCategories.rows],
    [
      "media_objects",
      media.map((record) => ({
        legacy_id: record.legacy_id,
        references: record.references,
        payload: record.payload,
      })),
    ],
    ["products", normalizedProducts.productRows],
    ["variants", normalizedProducts.variantRows],
  ])

  const manifest = {
    format: FORMAT,
    schema_version: 1,
    schema_contract: CONTRACT,
    bundle_mode: "dry-run-only",
    source: { export_id: `projection-${exportId}` },
    datasets: [],
  }
  const files = []
  for (const [entity, records] of datasets) {
    const bytes = Buffer.from(`${JSON.stringify(records, null, 2)}\n`)
    files.push([`${entity}.json`, bytes])
    manifest.datasets.push({
      entity,
      file: `${entity}.json`,
      record_count: records.length,
      sha256: sha256(bytes),
    })
  }
  files.push(["manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)])
  await mkdir(output, { recursive: false, mode: 0o700 })
  try {
    for (const [filename, bytes] of files) {
      await writeFile(path.join(output, filename), bytes, { flag: "wx", mode: 0o600 })
    }
  } catch {
    await rm(output, { recursive: true, force: true })
    fail("bundle_write_failed")
  }
  return {
    status: "projected",
    mode: "dry-run-only",
    entities: manifest.datasets.map(({ entity, record_count }) => ({
      entity,
      records: record_count,
    })),
    total_records: manifest.datasets.reduce((sum, dataset) => sum + dataset.record_count, 0),
  }
}

async function main() {
  const [inputDir, outputDir, exportId] = process.argv.slice(2)
  if (!inputDir || !outputDir || !exportId) {
    console.error(
      "Usage: node tools/migration/project-catalog-projection.mjs <projection-dir> <new-output-dir> <export-id>",
    )
    process.exitCode = 2
    return
  }
  try {
    process.stdout.write(
      `${JSON.stringify(await projectCatalog(inputDir, outputDir, { exportId }), null, 2)}\n`,
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "rejected",
        code: error instanceof Error ? error.message : "projection_failed",
      }),
    )
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main()
