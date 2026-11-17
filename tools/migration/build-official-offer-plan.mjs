#!/usr/bin/env node
// Builds the private offer plan for the official AgeStyles store from a validated
// catalog bundle and a legacy stock snapshot. Reads local files only; writes one
// private JSON file consumed by apps/commerce-api/src/scripts/setup-official-commerce.ts.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const DEFAULT_KEY = "__default__"
const EXTERNAL_PREFIX = "agestyles-stage-v1:"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

// Mirrors variantKeyLabel() in the legacy catalog.
function variantLabel(key) {
  if (key.startsWith("men:")) return { option: "Talla", value: `Hombre ${key.slice(4)}` }
  if (key.startsWith("women:")) return { option: "Talla", value: `Mujer ${key.slice(6)}` }
  return { option: "Presentación", value: key }
}

const [bundlePath, stockPath, outPath, ...rest] = process.argv.slice(2)
if (!bundlePath || !stockPath || !outPath) {
  fail(
    "usage: node tools/migration/build-official-offer-plan.mjs <bundle> <stock.json> <out.json> [--exclude-code <code>]... [--delivery-usd <amount>]",
  )
}
const excludedCodes = new Set()
let deliveryUsd = 5
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i] === "--exclude-code") excludedCodes.add(String(rest[i + 1]))
  else if (rest[i] === "--delivery-usd") deliveryUsd = Number(rest[i + 1])
  else fail(`unknown_argument_${rest[i]}`)
}
if (!(deliveryUsd >= 0)) fail("delivery_usd_invalid")

const products = readJson(join(bundlePath, "products.json"))
const stockRows = readJson(stockPath).stock
if (!Array.isArray(stockRows)) fail("stock_snapshot_invalid")

const stockByProduct = new Map()
for (const row of stockRows) {
  const list = stockByProduct.get(row.product_id) ?? []
  list.push({
    key: String(row.variant_key),
    stock: Math.max(0, Math.trunc(Number(row.stock) || 0)),
  })
  stockByProduct.set(row.product_id, list)
}

const offers = []
const excluded = []
for (const { legacy_id: legacyId, payload } of products) {
  const productUuid = legacyId.replace(/^product:/, "")
  const code = String(payload.code)
  const usd = Number(payload.price)
  const base = {
    product_external_id: `${EXTERNAL_PREFIX}${legacyId}`,
    legacy_code: code,
    title: payload.title,
  }
  if (excludedCodes.has(code)) {
    excluded.push({ ...base, reason: "excluded_by_owner_review", usd })
    continue
  }
  if (String(payload.currency).toUpperCase() !== "USD" || !(usd > 0)) {
    excluded.push({ ...base, reason: "price_not_positive_usd", usd })
    continue
  }
  const rows = stockByProduct.get(productUuid) ?? []
  const sized = rows.filter((row) => row.key !== DEFAULT_KEY && row.stock > 0)
  if (sized.length > 1) {
    excluded.push({ ...base, reason: "multiple_sized_balances_need_variants", usd })
    continue
  }
  if (sized.length === 1) {
    const label = variantLabel(sized[0].key)
    offers.push({
      ...base,
      usd,
      stock: sized[0].stock,
      legacy_variant_key: sized[0].key,
      option_title: label.option,
      variant_label: label.value,
    })
    continue
  }
  const defaultRow = rows.find((row) => row.key === DEFAULT_KEY)
  offers.push({
    ...base,
    usd,
    stock: defaultRow?.stock ?? 0,
    legacy_variant_key: DEFAULT_KEY,
    option_title: null,
    variant_label: null,
  })
}

const plan = {
  format: "agestyles-official-offer-plan",
  version: 1,
  created_at: new Date().toISOString(),
  currency_code: "usd",
  delivery_usd: deliveryUsd,
  location: {
    name: "AgeStyles Oficial",
    city: "La Habana",
    country_code: "cu",
    address_1: "Almacén oficial AgeStyles",
  },
  offers,
  excluded,
}
writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 })
console.log(
  JSON.stringify({
    offers: offers.length,
    offers_with_stock: offers.filter((offer) => offer.stock > 0).length,
    units: offers.reduce((sum, offer) => sum + offer.stock, 0),
    sized_variants: offers.filter((offer) => offer.variant_label).length,
    excluded: excluded.map((item) => `${item.legacy_code}:${item.reason}`),
  }),
)
