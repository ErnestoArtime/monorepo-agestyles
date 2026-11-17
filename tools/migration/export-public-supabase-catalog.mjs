import { createHash, randomUUID } from "node:crypto"
import { chmod, lstat, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { projectCatalog } from "./project-catalog-projection.mjs"

const PAGE_SIZE = 500
const IMAGE_PRODUCT_BATCH_SIZE = 80
const MAX_ROWS_PER_DATASET = 250_000
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_EXPORT_BYTES = 100 * 1024 * 1024
const IMAGE_EXTENSIONS = Object.freeze({
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
})
const PUBLIC_CATALOG_FIELDS = Object.freeze({
  categories: "id,slug,name,sort_order",
  subcategories: "id,category_slug,slug,name,sort_order",
  products:
    "id,code,name,description,price,currency,featured,gender,model,brand_id,subcategory_id,category,publication_status,specifications,variant_options,catalog_family_version_id,store_id",
  product_images: "id,product_id,image_url,display_order,is_primary",
})
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function fail(code) {
  throw new Error(code)
}

function parseSourceConfig() {
  if (process.env.AGESTYLES_SOURCE_CATALOG_EXPORT_ALLOW !== "true") {
    fail("export_guard_missing_AGESTYLES_SOURCE_CATALOG_EXPORT_ALLOW")
  }
  const rawUrl =
    process.env.AGESTYLES_SOURCE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.AGESTYLES_SOURCE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!rawUrl || !anonKey) fail("source_supabase_public_config_required")

  let url
  try {
    url = new URL(rawUrl)
  } catch {
    fail("source_supabase_url_invalid")
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    fail("source_supabase_url_must_be_project_https_origin")
  }
  if (anonKey.length < 20) fail("source_supabase_anon_key_invalid")
  return { origin: url.origin, anonKey }
}

async function resolvePrivateOutput(outputArg) {
  if (!path.isAbsolute(outputArg)) fail("output_directory_must_be_absolute")
  const parent = await realpath(path.dirname(outputArg)).catch(() => fail("output_parent_missing"))
  const output = path.join(parent, path.basename(outputArg))
  if (output === REPO_ROOT || output.startsWith(`${REPO_ROOT}${path.sep}`)) {
    fail("output_directory_must_be_outside_repository")
  }
  const existing = await lstat(output).catch(() => null)
  if (existing) fail("output_directory_must_not_exist")
  return output
}

function endpoint(origin, table, query = {}) {
  if (!Object.hasOwn(PUBLIC_CATALOG_FIELDS, table)) fail("source_table_not_allowlisted")
  const url = new URL(`/rest/v1/${table}`, origin)
  url.searchParams.set("select", PUBLIC_CATALOG_FIELDS[table])
  url.searchParams.set("limit", String(PAGE_SIZE))
  url.searchParams.set("order", "id.asc")
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url
}

async function requestRows(config, table, query = {}, offset = 0) {
  const url = endpoint(config.origin, table, query)
  const end = offset + PAGE_SIZE - 1
  const response = await fetch(url, {
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      "range-unit": "items",
      range: `${offset}-${end}`,
      prefer: "count=exact",
    },
    signal: AbortSignal.timeout(30_000),
  }).catch(() => fail("source_supabase_unreachable"))
  if (!response.ok) fail(`source_${table}_http_${response.status}`)
  let rows
  try {
    rows = await response.json()
  } catch {
    fail(`source_${table}_response_invalid`)
  }
  if (!Array.isArray(rows)) fail(`source_${table}_response_not_array`)
  const contentRange = response.headers.get("content-range")
  const total = Number(contentRange?.split("/")[1])
  if (!Number.isSafeInteger(total) || total < 0) fail(`source_${table}_count_missing`)
  return { rows, total }
}

async function readDataset(config, table, query = {}) {
  const rows = []
  let expectedTotal
  for (let offset = 0; offset < MAX_ROWS_PER_DATASET; offset += PAGE_SIZE) {
    const result = await requestRows(config, table, query, offset)
    if (expectedTotal === undefined) expectedTotal = result.total
    if (result.total !== expectedTotal) fail(`source_${table}_changed_during_export`)
    const page = result.rows
    rows.push(...page)
    if (rows.length > MAX_ROWS_PER_DATASET) fail(`source_${table}_row_limit_exceeded`)
    if (rows.length === expectedTotal) return rows
    if (page.length < PAGE_SIZE) fail(`source_${table}_count_mismatch`)
  }
  fail(`source_${table}_row_limit_exceeded`)
}

function chunks(values, size) {
  const result = []
  for (let start = 0; start < values.length; start += size) {
    result.push(values.slice(start, start + size))
  }
  return result
}

function postgrestInValues(values) {
  return values.map((value) => {
    const id = String(value)
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) fail("source_product_id_not_safe_for_filter")
    return id
  })
}

async function readPublicImageMetadata(config, products, mediaDirectory) {
  const byId = new Map(products.map((product) => [String(product.id), product]))
  const productIds = postgrestInValues([...byId.keys()])
  const groups = chunks(productIds, IMAGE_PRODUCT_BATCH_SIZE)
  const imageRows = []
  for (const productIdGroup of groups) {
    const query = { product_id: `in.(${productIdGroup.join(",")})` }
    imageRows.push(...(await readDataset(config, "product_images", query)))
  }

  const metadata = []
  let downloadedBytes = 0
  let writtenBytes = 0
  const writtenHashes = new Set()
  for (const group of chunks(imageRows, 4)) {
    const digests = await Promise.all(
      group.map(async (row) => {
        if (!byId.has(String(row.product_id))) return null
        const content = await readPublicImage(config.origin, row.image_url, Boolean(mediaDirectory))
        return {
          id: String(row.id),
          product_id: String(row.product_id),
          display_order: row.display_order,
          is_primary: row.is_primary,
          sha256: content.sha256,
          source_url: row.image_url,
          mime_type: content.mimeType,
          bytes: content.bytes,
        }
      }),
    )
    for (const item of digests.filter(Boolean)) {
      if (mediaDirectory) {
        downloadedBytes += item.bytes.length
        if (downloadedBytes > MAX_IMAGE_EXPORT_BYTES)
          fail("source_images_export_size_limit_exceeded")
        const extension = IMAGE_EXTENSIONS[item.mime_type]
        if (!extension) fail("source_image_mime_unsupported_for_export")
        if (!writtenHashes.has(item.sha256)) {
          await writeFile(path.join(mediaDirectory, `${item.sha256}.${extension}`), item.bytes, {
            flag: "wx",
            mode: 0o600,
          }).catch(() => fail("private_media_write_failed"))
          writtenHashes.add(item.sha256)
          writtenBytes += item.bytes.length
        }
        delete item.bytes
      } else {
        delete item.bytes
      }
      metadata.push(item)
    }
  }
  return {
    metadata,
    downloadedBytes,
    filesWritten: writtenHashes.size,
    bytesWritten: writtenBytes,
  }
}

async function readPublicImage(sourceOrigin, imageUrl, includeBytes) {
  let url
  try {
    url = new URL(imageUrl)
  } catch {
    fail("source_image_url_invalid")
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== sourceOrigin ||
    !url.pathname.startsWith("/storage/v1/object/public/") ||
    url.username ||
    url.password
  ) {
    fail("source_image_not_public_on_source_project")
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(() =>
    fail("source_image_unreachable"),
  )
  if (!response.ok) fail(`source_image_http_${response.status}`)
  const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (!mimeType.startsWith("image/")) fail("source_image_mime_not_image")
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    fail("source_image_too_large")
  }
  if (!response.body) fail("source_image_body_missing")

  const digest = createHash("sha256")
  let byteCount = 0
  const byteChunks = includeBytes ? [] : undefined
  for await (const chunk of response.body) {
    byteCount += chunk.length
    if (byteCount > MAX_IMAGE_BYTES) fail("source_image_too_large")
    digest.update(chunk)
    byteChunks?.push(chunk)
  }
  return {
    sha256: digest.digest("hex"),
    mimeType,
    ...(byteChunks ? { bytes: Buffer.concat(byteChunks) } : {}),
  }
}

async function writePrivateProjection(directory, name, value) {
  await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  }).catch(() => fail("private_projection_write_failed"))
}

async function exportCatalog(outputArg, mediaOutputArg) {
  const config = parseSourceConfig()
  const output = await resolvePrivateOutput(outputArg)
  const mediaOutput = mediaOutputArg ? await resolvePrivateOutput(mediaOutputArg) : undefined
  if (mediaOutput === output) fail("media_directory_must_differ_from_bundle_directory")
  let mediaWorkingDirectory
  let mediaDirectoryCommitted = false
  if (mediaOutput) {
    mediaWorkingDirectory = await mkdtemp(
      path.join(path.dirname(mediaOutput), ".agestyles-media-export-"),
    )
    await chmod(mediaWorkingDirectory, 0o700)
  }
  try {
    const [categories, subcategories, products] = await Promise.all([
      readDataset(config, "categories"),
      readDataset(config, "subcategories"),
      readDataset(config, "products", { publication_status: "eq.published" }),
    ])
    if (products.length === 0) fail("source_published_catalog_empty")
    const mediaExport = await readPublicImageMetadata(config, products, mediaWorkingDirectory)
    const imageMetadata = mediaExport.metadata.map(({ source_url, ...metadata }) => metadata)

    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "agestyles-catalog-projection-"),
    )
    try {
      await chmod(temporaryDirectory, 0o700)
      await Promise.all([
        writePrivateProjection(temporaryDirectory, "categories", categories),
        writePrivateProjection(temporaryDirectory, "subcategories", subcategories),
        writePrivateProjection(temporaryDirectory, "products", products),
        writePrivateProjection(temporaryDirectory, "image_metadata", imageMetadata),
      ])
      const projection = await projectCatalog(temporaryDirectory, output, {
        exportId: randomUUID(),
      })
      const imageUrls = Object.fromEntries(
        mediaExport.metadata.map(({ sha256, source_url }) => [sha256, source_url]),
      )
      await writePrivateProjection(
        path.dirname(output),
        `${path.basename(output)}.source-image-urls`,
        imageUrls,
      )
      if (mediaWorkingDirectory && mediaOutput) {
        await rename(mediaWorkingDirectory, mediaOutput)
        mediaDirectoryCommitted = true
      }
      return {
        status: projection.status,
        mode: "private_catalog_export",
        output_directory: output,
        entities: projection.entities,
        total_records: projection.total_records,
        reconciliation: projection.reconciliation,
        image_bytes_written: 0,
        media_files_written: mediaExport.filesWritten,
        media_bytes_written: mediaExport.bytesWritten,
        media_bytes_downloaded: mediaExport.downloadedBytes,
        media_directory: mediaOutput ?? null,
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {})
    }
  } finally {
    if (mediaWorkingDirectory && !mediaDirectoryCommitted) {
      await rm(mediaWorkingDirectory, { recursive: true, force: true }).catch(() => {})
    }
  }
}

async function main() {
  const [outputArg, flag, mediaFlag, mediaOutputArg, extra] = process.argv.slice(2)
  if (
    !outputArg ||
    flag !== "--export" ||
    (mediaFlag !== undefined && (mediaFlag !== "--media-directory" || !mediaOutputArg)) ||
    extra !== undefined
  ) {
    fail(
      "usage: node tools/migration/export-public-supabase-catalog.mjs <absolute-private-output-directory> --export [--media-directory <absolute-private-directory>]",
    )
  }
  const result = await exportCatalog(outputArg, mediaOutputArg)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "source_export_failed"
    const code = /^[a-z0-9_,:-]+$/.test(message) ? message : "source_export_failed"
    process.stderr.write(`${JSON.stringify({ status: "rejected", code })}\n`)
    process.exitCode = 1
  })
}
