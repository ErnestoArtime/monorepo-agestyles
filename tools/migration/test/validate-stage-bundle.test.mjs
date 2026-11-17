import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateStageBundle } from "../validate-stage-bundle.mjs"

const fixture = fileURLToPath(new URL("../fixtures/synthetic-v1", import.meta.url))

async function withBundle(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agestyles-stage-bundle-"))
  await cp(fixture, directory, { recursive: true })
  try {
    await callback(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function setDataset(directory, entity, rows) {
  const bytes = Buffer.from(`${JSON.stringify(rows, null, 2)}\n`)
  await writeFile(path.join(directory, `${entity}.json`), bytes)
  const manifestPath = path.join(directory, "manifest.json")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  const dataset = manifest.datasets.find((entry) => entry.entity === entity)
  dataset.record_count = rows.length
  dataset.sha256 = createHash("sha256").update(bytes).digest("hex")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function keepCatalogOnly(directory) {
  const manifestPath = path.join(directory, "manifest.json")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  const allowed = new Set(["categories", "products", "variants", "media_objects"])
  for (const dataset of manifest.datasets) {
    if (!allowed.has(dataset.entity)) await rm(path.join(directory, dataset.file), { force: true })
  }
  manifest.datasets = manifest.datasets.filter((dataset) => allowed.has(dataset.entity))
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const products = JSON.parse(await readFile(path.join(directory, "products.json"), "utf8"))
  products[0].references = products[0].references.filter(
    (reference) => reference.relation !== "seller",
  )
  products[0].payload.currency = "USD"
  products[0].payload.publication_status = "published"
  await setDataset(directory, "products", products)
}

test("accepts the synthetic staging interchange and reports only counts and hashes", async () => {
  const summary = await validateStageBundle(fixture)
  assert.equal(summary.status, "valid")
  assert.equal(summary.mode, "dry-run")
  assert.equal(summary.totals.entities, 15)
  assert.equal(summary.totals.records, 15)
  assert.ok(summary.entities.every((entity) => /^[a-f0-9]{64}$/.test(entity.sha256)))
  assert.equal(JSON.stringify(summary).includes("Producto sintético"), false)
  assert.equal(JSON.stringify(summary).includes("product-syn-001"), false)
})

test("catalog-only profile accepts a catalog bundle without sellers, offers, stock, or customer data", async () => {
  await withBundle(async (directory) => {
    await keepCatalogOnly(directory)
    const summary = await validateStageBundle(directory, { profile: "catalog-only" })
    assert.equal(summary.status, "valid")
    assert.equal(summary.profile, "catalog-only")
    assert.deepEqual(
      summary.entities.map((entity) => entity.entity),
      ["categories", "media_objects", "products", "variants"],
    )
  })
})

test("catalog-only profile rejects an empty product dataset", async () => {
  await withBundle(async (directory) => {
    await keepCatalogOnly(directory)
    await setDataset(directory, "products", [])
    const summary = await validateStageBundle(directory, { profile: "catalog-only" })
    assert.equal(summary.status, "invalid")
    assert.ok(summary.issues.some((entry) => entry.code === "catalog_products_required"))
  })
})

test("catalog-only profile rejects out-of-scope entities and invalid product or media metadata without echoing values", async () => {
  await withBundle(async (directory) => {
    await keepCatalogOnly(directory)
    const products = JSON.parse(await readFile(path.join(directory, "products.json"), "utf8"))
    products[0].payload.currency = "SENSITIVE-SYNTHETIC-SENTINEL"
    await setDataset(directory, "products", products)
    const media = JSON.parse(await readFile(path.join(directory, "media_objects.json"), "utf8"))
    media[0].payload.source_url = "https://example.invalid/SENSITIVE-SYNTHETIC-SENTINEL"
    await setDataset(directory, "media_objects", media)

    const manifestPath = path.join(directory, "manifest.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    manifest.datasets.push({
      entity: "customers",
      file: "customers.json",
      record_count: 1,
      sha256: "0".repeat(64),
    })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    await writeFile(path.join(directory, "customers.json"), "NOT-JSON-SENSITIVE-SYNTHETIC-SENTINEL")

    const summary = await validateStageBundle(directory, { profile: "catalog-only" })
    assert.equal(summary.status, "invalid")
    assert.ok(summary.issues.some((entry) => entry.code === "entity_outside_catalog_profile"))
    assert.equal(
      summary.issues.some((entry) => entry.code === "invalid_json"),
      false,
    )
    assert.ok(summary.issues.some((entry) => entry.code === "product_currency_unsupported"))
    assert.ok(summary.issues.some((entry) => entry.code === "media_source_url_forbidden"))
    assert.equal(JSON.stringify(summary).includes("SENSITIVE-SYNTHETIC-SENTINEL"), false)
  })
})

test("detects changed contents without printing row data", async () => {
  await withBundle(async (directory) => {
    const productsPath = path.join(directory, "products.json")
    const rows = JSON.parse(await readFile(productsPath, "utf8"))
    rows[0].payload.title = "SENSITIVE-SYNTHETIC-SENTINEL"
    await writeFile(productsPath, JSON.stringify(rows))

    const summary = await validateStageBundle(directory)
    assert.equal(summary.status, "invalid")
    assert.ok(summary.issues.some((entry) => entry.code === "sha256_mismatch"))
    assert.equal(JSON.stringify(summary).includes("SENSITIVE-SYNTHETIC-SENTINEL"), false)
  })
})

test("detects duplicate identifiers and unresolved references", async () => {
  await withBundle(async (directory) => {
    await setDataset(directory, "categories", [
      { legacy_id: "category-syn-001", references: [], payload: { name: "Synthetic A" } },
      { legacy_id: "category-syn-001", references: [], payload: { name: "Synthetic B" } },
    ])
    const products = JSON.parse(await readFile(path.join(directory, "products.json"), "utf8"))
    products[0].references[0].legacy_id = "missing-category"
    await setDataset(directory, "products", products)

    const summary = await validateStageBundle(directory)
    assert.ok(summary.issues.some((entry) => entry.code === "duplicate_legacy_id"))
    assert.ok(summary.issues.some((entry) => entry.code === "unresolved_reference"))
    assert.equal(JSON.stringify(summary).includes("missing-category"), false)
  })
})

test("rejects entities outside the allowlist and path traversal", async () => {
  await withBundle(async (directory) => {
    const manifestPath = path.join(directory, "manifest.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    manifest.datasets.push({
      entity: "user_credentials",
      file: "user_credentials.json",
      record_count: 0,
      sha256: "0".repeat(64),
    })
    manifest.datasets[0].file = "../outside.json"
    await writeFile(manifestPath, JSON.stringify(manifest))

    const summary = await validateStageBundle(directory)
    assert.ok(summary.issues.some((entry) => entry.code === "entity_not_allowlisted"))
    assert.ok(summary.issues.some((entry) => entry.code === "invalid_dataset_filename"))
  })
})

test("rejects bundles with unsupported mode or contract version", async () => {
  await withBundle(async (directory) => {
    const manifestPath = path.join(directory, "manifest.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    manifest.bundle_mode = "apply"
    manifest.schema_version = 999
    await writeFile(manifestPath, JSON.stringify(manifest))

    const summary = await validateStageBundle(directory)
    assert.ok(summary.issues.some((entry) => entry.code === "bundle_must_be_dry_run_only"))
    assert.ok(summary.issues.some((entry) => entry.code === "unsupported_schema_version"))
  })
})
