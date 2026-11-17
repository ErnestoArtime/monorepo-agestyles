import { createHash } from "node:crypto"
import { lstat, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { validateStageBundle } from "./validate-stage-bundle.mjs"

const production = process.env.AGESTYLES_COMMERCE_ENV === "production"
const target = production ? "production" : "lab"
const envPrefix = production ? "AGESTYLES_PRODUCTION" : "AGESTYLES_LAB"
const API_ORIGIN = production ? "http://127.0.0.1:19085" : "http://127.0.0.1:19081"
const PAGE_SIZE = 100
const MAX_RECORDS = 100_000
const MAX_JSON_BYTES = 250 * 1024 * 1024
const EXTERNAL_ID_PREFIX = "agestyles-stage-v1:"

function fail(code) {
  throw new Error(code)
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function externalId(legacyId) {
  return `${EXTERNAL_ID_PREFIX}${legacyId}`
}

function stableHandle(prefix, legacyId, title) {
  const normalized = String(title ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)
  const digest = createHash("sha256").update(legacyId).digest("hex").slice(0, 10)
  return `${prefix}-${normalized || "item"}-${digest}`
}

async function readBundleJson(directory, filename) {
  const filepath = path.join(directory, filename)
  let info
  try {
    info = await lstat(filepath)
  } catch {
    fail("bundle_file_unreadable")
  }
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_JSON_BYTES) {
    fail("bundle_file_not_regular_or_too_large")
  }
  let parsed
  try {
    parsed = JSON.parse((await readFile(filepath)).toString("utf8"))
  } catch {
    fail("bundle_json_invalid")
  }
  return parsed
}

async function loadCatalogBundle(bundlePath) {
  const directory = path.resolve(bundlePath)
  const validation = await validateStageBundle(directory, { profile: "catalog-only" })
  if (validation.status !== "valid") {
    fail(`bundle_invalid:${[...new Set(validation.issues.map(({ code }) => code))].join(",")}`)
  }

  const [manifest, categories, products, variants, mediaObjects] = await Promise.all([
    readBundleJson(directory, "manifest.json"),
    readBundleJson(directory, "categories.json"),
    readBundleJson(directory, "products.json"),
    readBundleJson(directory, "variants.json"),
    readBundleJson(directory, "media_objects.json"),
  ])
  if (
    !isObject(manifest) ||
    !isObject(manifest.source) ||
    !Array.isArray(categories) ||
    !Array.isArray(products) ||
    !Array.isArray(variants) ||
    !Array.isArray(mediaObjects)
  ) {
    fail("bundle_catalog_shape_invalid")
  }
  if (categories.length + products.length + variants.length + mediaObjects.length > MAX_RECORDS) {
    fail("bundle_record_limit_exceeded")
  }

  return { directory, manifest, categories, products, variants, mediaObjects, validation }
}

function categoryParent(category) {
  return category.references.find((reference) => reference.relation === "parent_category")
    ?.legacy_id
}

function sortCategories(categories) {
  const byId = new Map(categories.map((category) => [category.legacy_id, category]))
  const visited = new Set()
  const visiting = new Set()
  const result = []

  function visit(category) {
    if (visited.has(category.legacy_id)) return
    if (visiting.has(category.legacy_id)) fail("category_parent_cycle")
    visiting.add(category.legacy_id)
    const parentId = categoryParent(category)
    if (parentId) {
      const parent = byId.get(parentId)
      if (!parent) fail("category_parent_missing")
      visit(parent)
    }
    visiting.delete(category.legacy_id)
    visited.add(category.legacy_id)
    result.push(category)
  }

  for (const category of categories) visit(category)
  return result
}

function validateImportContent(bundle) {
  const productsById = new Set(bundle.products.map((product) => product.legacy_id))
  const categoriesById = new Set(bundle.categories.map((category) => category.legacy_id))
  const variantsByProduct = new Map()

  for (const category of bundle.categories) {
    const payload = category.payload
    if (!isObject(payload) || !String(payload.name ?? payload.slug ?? "").trim()) {
      fail("category_name_required")
    }
  }

  for (const variant of bundle.variants) {
    const productRef = variant.references.find((reference) => reference.relation === "product")
    if (!productRef || !productsById.has(productRef.legacy_id)) fail("variant_product_missing")
    const bucket = variantsByProduct.get(productRef.legacy_id) ?? []
    bucket.push(variant)
    variantsByProduct.set(productRef.legacy_id, bucket)
  }

  for (const product of bundle.products) {
    const payload = product.payload
    if (!isObject(payload) || !String(payload.title ?? "").trim()) fail("product_title_required")
    const categoryRef = product.references.find((reference) => reference.relation === "category")
    if (categoryRef && !categoriesById.has(categoryRef.legacy_id)) {
      fail("product_category_missing")
    }
  }

  return variantsByProduct
}

function summarize(bundle, variantsByProduct) {
  const productsWithoutCurrency = bundle.products.filter(
    (product) => product.payload.currency !== "USD" && product.payload.currency !== "CUP",
  ).length
  const productsWithoutSeller = bundle.products.length
  const productsWithoutCategory = bundle.products.filter(
    (product) => !product.references.some((reference) => reference.relation === "category"),
  ).length
  return {
    mode: "dry-run",
    bundle_status: "valid",
    counts: {
      categories: bundle.categories.length,
      products: bundle.products.length,
      variants: bundle.variants.length,
      media_objects: bundle.mediaObjects.length,
    },
    import_policy: {
      categories: "inactive",
      products: "global_draft",
      seller_links: 0,
      variants_without_prices: bundle.variants.length,
      inventory_levels: 0,
      media_uploaded: 0,
      idempotency_key: "external_id=agestyles-stage-v1:<legacy_id>",
    },
    products_without_currency: productsWithoutCurrency,
    products_without_seller_mapping: productsWithoutSeller,
    products_without_stock_mapping: bundle.products.length,
    products_without_category: productsWithoutCategory,
    products_with_no_variants: bundle.products.filter(
      (product) => (variantsByProduct.get(product.legacy_id) ?? []).length === 0,
    ).length,
    writes_performed: 0,
    target_checked: false,
  }
}

function assertLoopbackWriteGuards() {
  const environment = process.env.AGESTYLES_COMMERCE_ENV ?? "lab"
  if (environment !== target) fail("import_environment_invalid")
  for (const suffix of ["IMPORT_APPLY", "DB_ALLOW_WRITE"]) {
    if (process.env[`${envPrefix}_${suffix}`] !== "true") {
      fail(`apply_guard_missing_${envPrefix}_${suffix}`)
    }
  }
  if (process.env[`${envPrefix}_API_URL`] !== API_ORIGIN) fail("api_must_match_loopback_target")

  const rawDatabaseUrl = process.env.DATABASE_URL
  if (!rawDatabaseUrl) fail("database_url_required_for_apply")
  let databaseUrl
  try {
    databaseUrl = new URL(rawDatabaseUrl)
  } catch {
    fail("database_url_invalid")
  }
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== (production ? "15473" : "15472") ||
    databaseUrl.username !== (production ? "agestyles_production" : "agestyles_lab") ||
    databaseUrl.pathname !== (production ? "/agestyles_commerce" : "/agestyles_mercur_lab") ||
    !databaseUrl.password
  ) {
    fail("database_must_match_loopback_target")
  }
  if (!process.env[`${envPrefix}_ADMIN_BEARER_TOKEN`]) fail("admin_bearer_token_required")
}

async function adminRequest(pathname, { method = "GET", body } = {}) {
  const response = await fetch(`${API_ORIGIN}${pathname}`, {
    method,
    redirect: "error",
    headers: {
      authorization: `Bearer ${process.env[`${envPrefix}_ADMIN_BEARER_TOKEN`]}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => fail("loopback_medusa_unreachable"))

  let data
  try {
    data = await response.json()
  } catch {
    fail("medusa_response_invalid")
  }
  if (!response.ok) fail(`medusa_http_${response.status}`)
  return data
}

async function listAll(pathname, responseKey, fields) {
  const all = []
  for (let offset = 0; offset < MAX_RECORDS; offset += PAGE_SIZE) {
    const separator = pathname.includes("?") ? "&" : "?"
    const data = await adminRequest(
      `${pathname}${separator}limit=${PAGE_SIZE}&offset=${offset}&fields=${fields}`,
    )
    if (!Array.isArray(data?.[responseKey])) fail("medusa_list_response_invalid")
    const page = data[responseKey]
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
  fail("medusa_list_record_limit_exceeded")
}

function indexExisting(records, stagedRecords, requireExternalId = true) {
  const byStagedKey = new Map()
  const wanted = new Map(stagedRecords.map((record) => [externalId(record.legacy_id), record]))
  for (const record of records) {
    const idKey = wanted.has(record.external_id) ? record.external_id : null
    const metadataLegacyId = record.metadata?.agestyles_legacy_id
    const metadataKey =
      typeof metadataLegacyId === "string" && wanted.has(externalId(metadataLegacyId))
        ? externalId(metadataLegacyId)
        : null
    if (!idKey && !metadataKey) continue
    if (idKey && metadataKey && idKey !== metadataKey) fail("legacy_marker_conflict")
    const key = idKey ?? metadataKey
    if (byStagedKey.has(key)) fail("duplicate_legacy_target_records")
    if (
      (requireExternalId && record.external_id !== key) ||
      metadataLegacyId !== wanted.get(key).legacy_id
    ) {
      fail("legacy_target_marker_inconsistent")
    }
    byStagedKey.set(key, record)
  }
  return byStagedKey
}

async function assertHealthyApi() {
  const response = await fetch(`${API_ORIGIN}/health`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => fail("loopback_medusa_unreachable"))
  if (!response.ok) fail(`medusa_health_http_${response.status}`)
}

async function applyBundle(bundle, variantsByProduct, verifiedMedia, sourceUrls) {
  assertLoopbackWriteGuards()
  const sellerId = production ? process.env.AGESTYLES_PRODUCTION_OFFICIAL_SELLER_ID : undefined
  if (production && !/^seller_[a-zA-Z0-9]+$/.test(sellerId ?? "")) {
    fail("official_seller_id_required")
  }
  await assertHealthyApi()

  const [targetCategories, targetProducts] = await Promise.all([
    listAll(
      "/admin/product-categories",
      "product_categories",
      "id,handle,metadata,parent_category_id,is_active",
    ),
    listAll("/admin/products", "products", "id,handle,external_id,metadata,status"),
  ])
  const existingCategories = indexExisting(targetCategories, bundle.categories, false)
  const existingProducts = indexExisting(targetProducts, bundle.products)
  const categoriesToCreate = bundle.categories.filter(
    (category) => !existingCategories.has(externalId(category.legacy_id)),
  )
  const productsToCreate = bundle.products.filter(
    (product) => !existingProducts.has(externalId(product.legacy_id)),
  )

  const categoryIds = new Map(
    bundle.categories.flatMap((category) => {
      const existing = existingCategories.get(externalId(category.legacy_id))
      return existing ? [[category.legacy_id, existing.id]] : []
    }),
  )

  let createdCategories = 0
  const categoriesInCreationOrder = sortCategories(bundle.categories).filter((category) =>
    categoriesToCreate.some((candidate) => candidate.legacy_id === category.legacy_id),
  )
  for (const category of categoriesInCreationOrder) {
    const parentId = categoryParent(category)
    const parentCategoryId = parentId ? categoryIds.get(parentId) : undefined
    if (parentId && !parentCategoryId) fail("category_parent_target_missing")
    const payload = category.payload
    const response = await adminRequest("/admin/product-categories", {
      method: "POST",
      body: {
        name: String(payload.name ?? payload.slug).trim(),
        handle: stableHandle("legacy-category", category.legacy_id, payload.slug ?? payload.name),
        description: "",
        rank:
          Number.isSafeInteger(payload.sort_order) && payload.sort_order >= 0
            ? payload.sort_order
            : 0,
        parent_category_id: parentCategoryId ?? null,
        is_active: false,
        metadata: {
          agestyles_legacy_id: category.legacy_id,
          agestyles_legacy_name: payload.legacy_name ?? payload.name,
          agestyles_stage_source_export_id: String(bundle.manifest.source.export_id ?? ""),
        },
      },
    })
    const created = response?.product_category
    if (!created?.id) fail("medusa_category_create_response_invalid")
    categoryIds.set(category.legacy_id, created.id)
    createdCategories += 1
  }

  const uploadedMedia = new Map()
  const linkedMedia = new Set()
  let createdProducts = 0
  for (const product of productsToCreate) {
    const payload = product.payload
    const categoryRef = product.references.find((reference) => reference.relation === "category")
    const categoryId = categoryRef ? categoryIds.get(categoryRef.legacy_id) : undefined
    if (categoryRef && !categoryId) fail("product_category_target_missing")
    const variantPayloads = variantsByProduct.get(product.legacy_id) ?? []
    const mediaRefs = product.references
      .filter((reference) => reference.relation === "media")
      .sort((a, b) => a.display_order - b.display_order)
    const mediaHashes = mediaRefs.map((reference) => reference.legacy_id)
    const images = []
    let thumbnail
    if (production) {
      for (const reference of mediaRefs) {
        const id = reference.legacy_id
        if (!sourceUrls && !uploadedMedia.has(id)) {
          uploadedMedia.set(id, await uploadMedia(verifiedMedia.entries.get(id)))
        }
        const url = sourceUrls?.get(id) ?? uploadedMedia.get(id)
        linkedMedia.add(id)
        images.push({ url })
        if (reference.is_primary) thumbnail = url
      }
    }
    const productMetadata = {
      agestyles_legacy_id: product.legacy_id,
      agestyles_legacy_title: payload.legacy_title ?? payload.title,
      agestyles_stage_source_export_id: String(bundle.manifest.source.export_id ?? ""),
      agestyles_legacy_store_id: payload.legacy_store_id ?? null,
      agestyles_legacy_brand_id: payload.legacy_brand_id ?? null,
      agestyles_legacy_currency: payload.legacy_currency ?? payload.currency ?? null,
      agestyles_legacy_price: payload.price ?? null,
      agestyles_legacy_publication_status: payload.publication_status ?? null,
      agestyles_legacy_catalog_family_version_id: payload.catalog_family_version_id ?? null,
      agestyles_legacy_specifications: payload.specifications ?? null,
      agestyles_legacy_media_hashes: mediaHashes,
      agestyles_import_status: sellerId
        ? "draft_assigned_no_inventory"
        : "draft_unassigned_no_inventory",
    }
    const variants = variantPayloads.map((variant) => ({
      title: String(variant.payload.label ?? variant.payload.variant_key ?? "Legacy variant"),
      metadata: {
        agestyles_legacy_id: variant.legacy_id,
        agestyles_legacy_variant_key: String(variant.payload.variant_key ?? ""),
      },
    }))

    const response = await adminRequest("/admin/products", {
      method: "POST",
      body: {
        title: String(payload.title).trim(),
        description: payload.description == null ? "" : String(payload.description),
        handle: stableHandle("legacy-product", product.legacy_id, payload.title),
        status: "draft",
        discountable: false,
        ...(sellerId ? { seller_ids: [sellerId] } : {}),
        external_id: externalId(product.legacy_id),
        ...(categoryId ? { categories: [{ id: categoryId }] } : {}),
        variants,
        ...(images.length ? { images, thumbnail: thumbnail ?? images[0].url } : {}),
        metadata: productMetadata,
      },
    })
    if (!response?.product?.id) fail("medusa_product_create_response_invalid")
    createdProducts += 1
  }

  return {
    mode: "apply",
    bundle_status: "valid",
    target,
    created: { categories: createdCategories, products: createdProducts },
    skipped_as_already_imported: {
      categories: bundle.categories.length - createdCategories,
      products: bundle.products.length - createdProducts,
    },
    product_policy: {
      status: "draft",
      seller_links: sellerId ? createdProducts : 0,
      variant_prices: 0,
      inventory_levels: 0,
      media_uploaded: uploadedMedia.size,
      media_linked: linkedMedia.size,
    },
  }
}

async function uploadMedia({ file, name, mime, hash }) {
  const bytes = await readFile(file)
  if (createHash("sha256").update(bytes).digest("hex") !== hash) fail("media_hash_mismatch")
  const body = new FormData()
  body.append("files", new Blob([bytes], { type: mime }), name)
  const response = await fetch(`${API_ORIGIN}/admin/uploads`, {
    method: "POST",
    redirect: "error",
    headers: { authorization: `Bearer ${process.env[`${envPrefix}_ADMIN_BEARER_TOKEN`]}` },
    body,
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) fail(`media_upload_http_${response.status}`)
  const { files } = await response.json()
  let url
  try {
    url = new URL(files?.[0]?.url)
  } catch {
    fail("media_upload_url_invalid")
  }
  if (url.protocol !== "https:" || url.username || url.password) fail("media_upload_https_required")
  return url.href
}

async function verifyMedia(directory, mediaObjects) {
  const extensions = new Map([
    ["image/avif", "avif"],
    ["image/gif", "gif"],
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])
  const entries = new Set(await readdir(directory).catch(() => fail("media_directory_unreadable")))
  let totalBytes = 0
  const verified = new Map()
  for (const { legacy_id, payload } of mediaObjects) {
    const extension = extensions.get(payload.mime_type)
    if (!extension || !/^[a-f0-9]{64}$/.test(payload.sha256)) fail("media_metadata_invalid")
    const name = `${payload.sha256}.${extension}`
    if (!entries.delete(name)) fail("media_file_missing")
    const file = path.join(directory, name)
    const info = await lstat(file).catch(() => fail("media_file_unreadable"))
    if (!info.isFile() || info.size === 0 || info.size > 25 * 1024 * 1024) {
      fail("media_file_invalid")
    }
    const bytes = await readFile(file).catch(() => fail("media_file_unreadable"))
    if (createHash("sha256").update(bytes).digest("hex") !== payload.sha256) {
      fail("media_hash_mismatch")
    }
    verified.set(legacy_id, { file, name, mime: payload.mime_type, hash: payload.sha256 })
    totalBytes += bytes.length
  }
  if (entries.size) fail("media_directory_contains_unexpected_files")
  return { files: mediaObjects.length, bytes: totalBytes, entries: verified }
}

async function loadSourceImageUrls(bundlePath, mediaObjects) {
  const bundle = path.resolve(bundlePath)
  const mapping = await readBundleJson(
    path.dirname(bundle),
    `${path.basename(bundle)}.source-image-urls.json`,
  )
  if (!isObject(mapping)) fail("source_image_urls_invalid")
  const urls = new Map()
  for (const row of mediaObjects) {
    let url
    try {
      url = new URL(mapping[row.payload.sha256])
    } catch {
      fail("source_image_url_missing_or_invalid")
    }
    if (
      url.origin !== "https://ittbtmwtooiqyprrcapi.supabase.co" ||
      !url.pathname.startsWith("/storage/v1/object/public/product-images/") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      fail("source_image_url_outside_catalog_bucket")
    urls.set(row.legacy_id, url.href)
  }
  return urls
}

async function main() {
  const [bundlePath, ...args] = process.argv.slice(2)
  const mode = args[0] === "--apply" || args[0] === "--dry-run" ? args.shift() : "--dry-run"
  const [mediaFlag, mediaDirectory, extra] = args
  if (
    !bundlePath ||
    bundlePath.startsWith("--") ||
    (args.length &&
      (mediaFlag !== "--media-directory" ||
        !mediaDirectory ||
        mediaDirectory.startsWith("--") ||
        extra !== undefined))
  ) {
    fail(
      "usage: node tools/migration/import-catalog-bundle-to-medusa.mjs <validated-bundle> [--dry-run|--apply] [--media-directory <directory>]",
    )
  }

  const bundle = await loadCatalogBundle(bundlePath)
  const variantsByProduct = validateImportContent(bundle)
  const verifiedMedia = mediaDirectory
    ? await verifyMedia(mediaDirectory, bundle.mediaObjects)
    : null
  const reuseUrls = process.env.AGESTYLES_PRODUCTION_REUSE_SOURCE_IMAGES === "true"
  const sourceUrls =
    production && reuseUrls ? await loadSourceImageUrls(bundlePath, bundle.mediaObjects) : null
  if (production && mode === "--apply" && !verifiedMedia && !sourceUrls) {
    fail("production_image_source_required")
  }
  const result =
    mode === "--apply"
      ? await applyBundle(bundle, variantsByProduct, verifiedMedia, sourceUrls)
      : summarize(bundle, variantsByProduct)
  if (sourceUrls) result.source_images = sourceUrls.size
  if (verifiedMedia)
    result.media_verified = { files: verifiedMedia.files, bytes: verifiedMedia.bytes }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ status: "rejected", code: error instanceof Error ? error.message : "import_failed" })}\n`,
    )
    process.exitCode = 1
  })
}
