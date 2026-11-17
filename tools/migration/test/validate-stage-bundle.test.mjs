import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateStageBundle } from "../validate-stage-bundle.mjs"
import { projectCatalog } from "../project-catalog-projection.mjs"

const fixture = fileURLToPath(new URL("../fixtures/synthetic-v1", import.meta.url))
const catalogFixture = fileURLToPath(new URL("../fixtures/synthetic-catalog-v1", import.meta.url))

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

test("accepts the checked-in synthetic catalog-only bundle", async () => {
  const summary = await validateStageBundle(catalogFixture, { profile: "catalog-only" })
  assert.equal(summary.status, "valid")
  assert.equal(summary.totals.entities, 4)
  assert.equal(summary.totals.records, 4)
  assert.equal(JSON.stringify(summary).includes("product-synthetic-001"), false)
})

test("projects a sanitized synthetic catalog snapshot into a valid dry-run bundle", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agestyles-catalog-projection-"))
  const input = path.join(root, "projection")
  const output = path.join(root, "bundle")
  const repeatedOutput = path.join(root, "bundle-repeat")
  await import("node:fs/promises").then(({ mkdir }) => mkdir(input))
  const projection = {
    categories: [{ id: "cat-1", slug: "clothing", name: "Clothing", sort_order: 1 }],
    subcategories: [{ id: "sub-1", category_slug: "clothing", slug: "shirts", name: "Shirts" }],
    products: [
      {
        id: "prod-1",
        code: "00042",
        name: "Synthetic shirt",
        description: "Fixture only",
        price: 25,
        currency: "USD",
        publication_status: "published",
        subcategory_id: "sub-1",
        brand_id: "brand-1",
        variant_options: [{ key: "blue-m", label: "Blue / M" }],
        store_id: "must-not-be-copied",
        stock: 99,
        customer_email: "must-not-be-copied@example.invalid",
      },
    ],
    image_metadata: [
      {
        id: "image-1",
        product_id: "prod-1",
        sha256: "a".repeat(64),
        mime_type: "image/jpeg",
        display_order: 0,
        is_primary: true,
      },
    ],
  }
  try {
    for (const [name, rows] of Object.entries(projection)) {
      await writeFile(path.join(input, `${name}.json`), `${JSON.stringify(rows)}\n`)
    }
    const result = await projectCatalog(input, output, { exportId: "synthetic-001" })
    assert.equal(result.status, "projected")
    assert.equal(result.total_records, 5)
    assert.equal(result.reconciliation.counts_match, true)
    assert.deepEqual(result.reconciliation.staged_counts, {
      categories: 2,
      media_objects: 1,
      products: 1,
      variants: 1,
    })
    assert.deepEqual(result.reconciliation.source_counts.products_by_currency, {
      USD: 1,
      CUP: 0,
      unsupported: 0,
    })
    assert.deepEqual(result.reconciliation.source_counts.products_by_publication_status, {
      draft: 0,
      published: 1,
      archived: 0,
      unsupported: 0,
    })
    assert.equal(result.reconciliation.source_counts.products_with_store_id, 1)
    assert.equal(JSON.stringify(result).includes("prod-1"), false)
    assert.equal(JSON.stringify(result).includes("must-not-be-copied"), false)
    const summary = await validateStageBundle(output, { profile: "catalog-only" })
    assert.equal(summary.status, "valid")
    const stagedProducts = JSON.parse(await readFile(path.join(output, "products.json"), "utf8"))
    assert.equal(stagedProducts[0].payload.code, "00042")
    assert.equal(stagedProducts[0].payload.import_visibility, "draft_until_reconciled")
    assert.equal(JSON.stringify(stagedProducts).includes("must-not-be-copied"), false)
    assert.equal(JSON.stringify(stagedProducts).includes("example.invalid"), false)
    const repeated = await projectCatalog(input, repeatedOutput, { exportId: "synthetic-001" })
    assert.deepEqual(repeated.reconciliation, result.reconciliation)
    assert.deepEqual(
      JSON.parse(await readFile(path.join(repeatedOutput, "manifest.json"), "utf8")),
      JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8")),
    )
    const stagedCategories = JSON.parse(
      await readFile(path.join(output, "categories.json"), "utf8"),
    )
    assert.equal(stagedCategories[1].references[0].relation, "parent_category")
    assert.equal(JSON.stringify(result).includes("prod-1"), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("creates a default variant when legacy variant options are empty", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agestyles-empty-variants-"))
  const input = path.join(root, "projection")
  const output = path.join(root, "bundle")
  await import("node:fs/promises").then(({ mkdir }) => mkdir(input))
  const projection = {
    categories: [{ id: "cat-1", slug: "clothing", name: "Clothing" }],
    subcategories: [],
    products: [
      {
        id: "prod-array-empty",
        name: "Synthetic no-options array",
        category_slug: "clothing",
        currency: "USD",
        variant_options: [],
      },
      {
        id: "prod-json-empty",
        name: "Synthetic no-options JSON",
        category_slug: "clothing",
        currency: "CUP",
        variant_options: "[]",
      },
    ],
    image_metadata: [],
  }

  try {
    for (const [name, rows] of Object.entries(projection)) {
      await writeFile(path.join(input, `${name}.json`), `${JSON.stringify(rows)}\n`)
    }
    const result = await projectCatalog(input, output, { exportId: "synthetic-empty-variants" })
    const variants = JSON.parse(await readFile(path.join(output, "variants.json"), "utf8"))
    assert.equal(result.reconciliation.counts_match, true)
    assert.equal(variants.length, 2)
    assert.ok(variants.every((variant) => variant.payload.variant_key === "__default__"))
    assert.equal(JSON.stringify(result).includes("prod-array-empty"), false)
    assert.equal(JSON.stringify(result).includes("prod-json-empty"), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("projection refuses unresolved relations, malformed options, image URLs, and existing outputs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agestyles-catalog-projection-"))
  const input = path.join(root, "projection")
  const output = path.join(root, "bundle")
  const { mkdir } = await import("node:fs/promises")
  await mkdir(input)
  const base = {
    categories: [{ id: "cat-1", slug: "clothing", name: "Clothing" }],
    subcategories: [],
    products: [
      {
        id: "prod-1",
        name: "Synthetic",
        category_slug: "clothing",
        currency: "USD",
        variant_options: [{ key: "x", label: "X" }],
      },
    ],
    image_metadata: [],
  }
  const writeProjection = async (value) => {
    for (const [name, rows] of Object.entries(value)) {
      await writeFile(path.join(input, `${name}.json`), `${JSON.stringify(rows)}\n`)
    }
  }
  try {
    await writeProjection({
      ...base,
      products: [{ ...base.products[0], category_slug: "missing" }],
    })
    await assert.rejects(
      projectCatalog(input, output, { exportId: "synthetic-002" }),
      /product_category_unresolved/,
    )
    await writeProjection({
      ...base,
      products: [{ ...base.products[0], variant_options: [{ key: "", label: "X" }] }],
    })
    await assert.rejects(
      projectCatalog(input, output, { exportId: "synthetic-002" }),
      /invalid_variant_options/,
    )
    await writeProjection({
      ...base,
      image_metadata: [
        {
          id: "img",
          product_id: "prod-1",
          sha256: "a".repeat(64),
          mime_type: "image/jpeg",
          image_url: "https://example.invalid/private",
        },
      ],
    })
    await assert.rejects(
      projectCatalog(input, output, { exportId: "synthetic-002" }),
      /media_url_field_forbidden/,
    )
    await writeProjection(base)
    const categoriesPath = path.join(input, "categories.json")
    await rm(categoriesPath)
    const alternatePath = path.join(root, "alternate.json")
    await writeFile(alternatePath, JSON.stringify(base.categories))
    await symlink(alternatePath, categoriesPath)
    await assert.rejects(
      projectCatalog(input, output, { exportId: "synthetic-002" }),
      /projection_file_not_regular_or_too_large/,
    )
    await mkdir(output)
    await assert.rejects(
      projectCatalog(input, output, { exportId: "synthetic-002" }),
      /output_directory_must_not_exist/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
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
