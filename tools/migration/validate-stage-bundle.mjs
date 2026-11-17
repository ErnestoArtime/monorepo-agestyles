import { createHash } from "node:crypto"
import { lstat, readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const STAGE_BUNDLE_FORMAT = "agestyles.stage-interchange"
export const STAGE_BUNDLE_VERSION = 1
export const VALIDATION_PROFILES = Object.freeze(["full", "catalog-only"])

/**
 * This is a project-owned, versioned interchange contract. It is not a claim
 * about the legacy Supabase schema; actual source-to-target mappings remain a
 * separate reviewed step.
 */
export const ALLOWED_ENTITIES = Object.freeze([
  "organizations",
  "sellers",
  "stock_locations",
  "categories",
  "products",
  "variants",
  "offers",
  "inventory_items",
  "inventory_levels",
  "customers",
  "orders",
  "order_lines",
  "media_objects",
  "favorites",
  "customer_preferences",
])

const ALLOWED_ENTITY_SET = new Set(ALLOWED_ENTITIES)
const CATALOG_ONLY_ENTITIES = new Set(["categories", "products", "variants", "media_objects"])
const MAX_MANIFEST_BYTES = 1_000_000
const MAX_ENTITY_BYTES = 250 * 1024 * 1024
const MAX_ROWS_PER_ENTITY = 1_000_000
const HASH_PATTERN = /^[a-f0-9]{64}$/

const RELATION_TARGETS = Object.freeze({
  organizations: {},
  sellers: { organization: "organizations" },
  stock_locations: { seller: "sellers" },
  categories: { parent_category: "categories" },
  products: {
    category: "categories",
    seller: "sellers",
    media: "media_objects",
  },
  variants: { product: "products" },
  offers: {
    seller: "sellers",
    product: "products",
    variant: "variants",
  },
  inventory_items: { offer: "offers" },
  inventory_levels: {
    inventory_item: "inventory_items",
    stock_location: "stock_locations",
  },
  customers: {},
  orders: { customer: "customers", seller: "sellers" },
  order_lines: {
    order: "orders",
    product: "products",
    variant: "variants",
    offer: "offers",
  },
  media_objects: {},
  favorites: { customer: "customers", product: "products" },
  customer_preferences: { customer: "customers" },
})

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function issue(code, entity = undefined, recordIndex = undefined, relation = undefined) {
  return {
    code,
    ...(entity ? { entity } : {}),
    ...(Number.isInteger(recordIndex) ? { record_index: recordIndex } : {}),
    ...(relation ? { relation } : {}),
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSafeIdentifier(value) {
  return (
    typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 240
  )
}

function emptySummary() {
  return {
    format: STAGE_BUNDLE_FORMAT,
    schema_version: STAGE_BUNDLE_VERSION,
    mode: "dry-run",
    status: "invalid",
    entities: [],
    totals: { entities: 0, records: 0 },
    issues: [],
  }
}

async function readRegularFile(directory, filename, maxBytes, issues, entity) {
  const fullPath = path.join(directory, filename)
  try {
    const info = await lstat(fullPath)
    if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) {
      issues.push(issue("file_not_regular_or_too_large", entity))
      return null
    }
    return await readFile(fullPath)
  } catch {
    issues.push(issue("file_missing_or_unreadable", entity))
    return null
  }
}

function parseJson(buffer, issues, entity) {
  try {
    return JSON.parse(buffer.toString("utf8"))
  } catch {
    issues.push(issue("invalid_json", entity))
    return null
  }
}

function validateManifest(manifest, issues) {
  if (!isObject(manifest)) {
    issues.push(issue("manifest_must_be_object"))
    return []
  }
  if (manifest.format !== STAGE_BUNDLE_FORMAT) issues.push(issue("unsupported_bundle_format"))
  if (manifest.schema_version !== STAGE_BUNDLE_VERSION)
    issues.push(issue("unsupported_schema_version"))
  if (manifest.bundle_mode !== "dry-run-only") issues.push(issue("bundle_must_be_dry_run_only"))
  if (manifest.schema_contract !== "agestyles-stage-interchange-v1") {
    issues.push(issue("unknown_interchange_contract"))
  }
  if (!isObject(manifest.source) || !isSafeIdentifier(manifest.source.export_id)) {
    issues.push(issue("invalid_source_metadata"))
  }
  if (!Array.isArray(manifest.datasets)) {
    issues.push(issue("datasets_must_be_array"))
    return []
  }

  const seenEntities = new Set()
  const seenFiles = new Set(["manifest.json"])
  for (const dataset of manifest.datasets) {
    if (!isObject(dataset)) {
      issues.push(issue("dataset_must_be_object"))
      continue
    }

    const { entity, file, record_count: recordCount, sha256: digest } = dataset
    if (typeof entity !== "string" || !ALLOWED_ENTITY_SET.has(entity)) {
      issues.push(issue("entity_not_allowlisted"))
      continue
    }
    if (seenEntities.has(entity)) issues.push(issue("duplicate_entity_manifest_entry", entity))
    seenEntities.add(entity)

    if (typeof file !== "string" || file !== `${entity}.json` || path.basename(file) !== file) {
      issues.push(issue("invalid_dataset_filename", entity))
      continue
    }
    if (seenFiles.has(file)) issues.push(issue("duplicate_dataset_filename", entity))
    seenFiles.add(file)

    if (
      !Number.isSafeInteger(recordCount) ||
      recordCount < 0 ||
      recordCount > MAX_ROWS_PER_ENTITY
    ) {
      issues.push(issue("invalid_manifest_record_count", entity))
    }
    if (typeof digest !== "string" || !HASH_PATTERN.test(digest)) {
      issues.push(issue("invalid_manifest_hash", entity))
    }
  }

  return manifest.datasets.filter(
    (dataset) =>
      isObject(dataset) &&
      typeof dataset.entity === "string" &&
      ALLOWED_ENTITY_SET.has(dataset.entity) &&
      typeof dataset.file === "string" &&
      dataset.file === `${dataset.entity}.json` &&
      path.basename(dataset.file) === dataset.file &&
      Number.isSafeInteger(dataset.record_count) &&
      dataset.record_count >= 0 &&
      typeof dataset.sha256 === "string" &&
      HASH_PATTERN.test(dataset.sha256),
  )
}

function validateRows(entity, rows, issues) {
  if (!Array.isArray(rows)) {
    issues.push(issue("dataset_must_be_array", entity))
    return []
  }
  if (rows.length > MAX_ROWS_PER_ENTITY) {
    issues.push(issue("dataset_too_many_rows", entity))
    return []
  }

  const ids = new Set()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!isObject(row)) {
      issues.push(issue("record_must_be_object", entity, index))
      continue
    }
    if (!isSafeIdentifier(row.legacy_id)) {
      issues.push(issue("invalid_legacy_id", entity, index))
    } else if (ids.has(row.legacy_id)) {
      issues.push(issue("duplicate_legacy_id", entity, index))
    } else {
      ids.add(row.legacy_id)
    }
    if (!Array.isArray(row.references)) {
      issues.push(issue("references_must_be_array", entity, index))
    } else {
      for (const reference of row.references) {
        if (
          !isObject(reference) ||
          typeof reference.relation !== "string" ||
          !isSafeIdentifier(reference.legacy_id)
        ) {
          issues.push(issue("invalid_reference", entity, index))
        }
      }
    }
    if (!isObject(row.payload)) issues.push(issue("payload_must_be_object", entity, index))
  }
  return rows
}

/**
 * Validates a local staging interchange directory. This function is read-only:
 * it opens no database connections and never emits row content or identifiers.
 */
export async function validateStageBundle(directory, { profile = "full" } = {}) {
  const summary = emptySummary()
  summary.profile = profile
  const issues = summary.issues
  if (!VALIDATION_PROFILES.includes(profile)) {
    issues.push(issue("unsupported_validation_profile"))
    return summary
  }
  let root
  try {
    root = path.resolve(directory)
    const info = await lstat(root)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      issues.push(issue("bundle_path_not_directory"))
      return summary
    }
  } catch {
    issues.push(issue("bundle_path_missing_or_unreadable"))
    return summary
  }

  const manifestBuffer = await readRegularFile(root, "manifest.json", MAX_MANIFEST_BYTES, issues)
  if (!manifestBuffer) return summary
  const manifest = parseJson(manifestBuffer, issues)
  if (!manifest) return summary

  const datasets = validateManifest(manifest, issues)
  const recordsByEntity = new Map()
  const datasetSummaries = []
  const listedFiles = new Set(["manifest.json"])

  for (const dataset of datasets) {
    const { entity, file, record_count: expectedCount, sha256: expectedHash } = dataset
    listedFiles.add(file)
    if (profile === "catalog-only" && !CATALOG_ONLY_ENTITIES.has(entity)) {
      issues.push(issue("entity_outside_catalog_profile", entity))
      continue
    }
    const buffer = await readRegularFile(root, file, MAX_ENTITY_BYTES, issues, entity)
    if (!buffer) continue

    const actualHash = sha256(buffer)
    if (actualHash !== expectedHash) issues.push(issue("sha256_mismatch", entity))

    const rows = parseJson(buffer, issues, entity)
    if (!rows) continue
    const validatedRows = validateRows(entity, rows, issues)
    if (rows.length !== expectedCount) issues.push(issue("record_count_mismatch", entity))
    recordsByEntity.set(entity, validatedRows)
    datasetSummaries.push({ entity, records: rows.length, sha256: actualHash })
  }

  try {
    const directoryEntries = await readdir(root, { withFileTypes: true })
    for (const entry of directoryEntries) {
      if (entry.isSymbolicLink() || !entry.isFile() || !listedFiles.has(entry.name)) {
        issues.push(issue("unlisted_or_nonregular_file"))
      }
    }
  } catch {
    issues.push(issue("bundle_directory_unreadable"))
  }

  const idsByEntity = new Map()
  for (const [entity, rows] of recordsByEntity) {
    const ids = new Set()
    for (const row of rows) {
      if (isSafeIdentifier(row?.legacy_id)) ids.add(row.legacy_id)
    }
    idsByEntity.set(entity, ids)
  }

  for (const [entity, rows] of recordsByEntity) {
    const allowedRelations = RELATION_TARGETS[entity]
    rows.forEach((row, recordIndex) => {
      if (!Array.isArray(row?.references)) return
      for (const reference of row.references) {
        if (!isObject(reference) || typeof reference.relation !== "string") continue
        const targetEntity = allowedRelations[reference.relation]
        if (!targetEntity || reference.entity !== targetEntity) {
          issues.push(issue("reference_relation_not_allowlisted", entity, recordIndex))
          continue
        }
        const targetIds = idsByEntity.get(targetEntity)
        if (!targetIds || !targetIds.has(reference.legacy_id)) {
          issues.push(issue("unresolved_reference", entity, recordIndex, reference.relation))
        }
      }
    })
  }

  if (profile === "catalog-only") {
    const products = recordsByEntity.get("products") ?? []
    if (products.length === 0) issues.push(issue("catalog_products_required", "products"))
    products.forEach((row, recordIndex) => {
      const references = Array.isArray(row.references) ? row.references : []
      const payload = isObject(row.payload) ? row.payload : {}
      if (
        !references.some(
          (reference) => reference?.relation === "category" && reference.entity === "categories",
        )
      ) {
        issues.push(issue("product_category_reference_required", "products", recordIndex))
      }
      if (!new Set(["USD", "CUP"]).has(payload.currency)) {
        issues.push(issue("product_currency_unsupported", "products", recordIndex))
      }
      if (!new Set(["draft", "published", "archived"]).has(payload.publication_status)) {
        issues.push(issue("product_publication_status_unsupported", "products", recordIndex))
      }

      const mediaReferences = references.filter((reference) => reference?.relation === "media")
      const displayOrders = new Set()
      let primaryCount = 0
      let previousDisplayOrder = -1
      for (const reference of mediaReferences) {
        if (
          !Number.isSafeInteger(reference.display_order) ||
          reference.display_order < 0 ||
          typeof reference.is_primary !== "boolean"
        ) {
          issues.push(issue("product_media_reference_metadata_invalid", "products", recordIndex))
          continue
        }
        if (displayOrders.has(reference.display_order)) {
          issues.push(issue("product_media_display_order_duplicate", "products", recordIndex))
        }
        if (reference.display_order <= previousDisplayOrder) {
          issues.push(issue("product_media_order_not_ascending", "products", recordIndex))
        }
        displayOrders.add(reference.display_order)
        previousDisplayOrder = reference.display_order
        if (reference.is_primary) primaryCount += 1
      }
      if (primaryCount > 1) {
        issues.push(issue("product_media_primary_duplicate", "products", recordIndex))
      }
      if (payload.media_count !== undefined && payload.media_count !== mediaReferences.length) {
        issues.push(issue("product_media_count_mismatch", "products", recordIndex))
      }
    })

    const variants = recordsByEntity.get("variants") ?? []
    variants.forEach((row, recordIndex) => {
      const references = Array.isArray(row.references) ? row.references : []
      if (
        !references.some(
          (reference) => reference?.relation === "product" && reference.entity === "products",
        )
      ) {
        issues.push(issue("variant_product_reference_required", "variants", recordIndex))
      }
    })

    const mediaObjects = recordsByEntity.get("media_objects") ?? []
    const mediaHashes = new Set()
    mediaObjects.forEach((row, recordIndex) => {
      const payload = isObject(row.payload) ? row.payload : {}
      if (!HASH_PATTERN.test(payload.sha256 ?? "")) {
        issues.push(issue("media_content_hash_required", "media_objects", recordIndex))
      } else if (mediaHashes.has(payload.sha256)) {
        issues.push(issue("duplicate_media_content_hash", "media_objects", recordIndex))
      } else {
        mediaHashes.add(payload.sha256)
      }
      if (typeof payload.mime_type !== "string" || !payload.mime_type.startsWith("image/")) {
        issues.push(issue("media_image_mime_type_required", "media_objects", recordIndex))
      }
      if ("source_url" in payload || "url" in payload) {
        issues.push(issue("media_source_url_forbidden", "media_objects", recordIndex))
      }
    })
  }

  summary.entities = datasetSummaries.sort((a, b) => a.entity.localeCompare(b.entity))
  summary.totals = {
    entities: datasetSummaries.length,
    records: datasetSummaries.reduce((total, dataset) => total + dataset.records, 0),
  }
  summary.status = issues.length === 0 ? "valid" : "invalid"
  return summary
}

async function main() {
  const args = process.argv.slice(2)
  let profile = "full"
  let bundlePath
  if (args[0] === "--profile" && args.length === 3) {
    profile = args[1]
    bundlePath = args[2]
  } else if (args.length === 1) {
    bundlePath = args[0]
  }
  if (!bundlePath || !VALIDATION_PROFILES.includes(profile)) {
    console.error(
      "Usage: node tools/migration/validate-stage-bundle.mjs [--profile full|catalog-only] <local-bundle-directory>",
    )
    process.exitCode = 2
    return
  }

  const result = await validateStageBundle(bundlePath, { profile })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status !== "valid") process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
