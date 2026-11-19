import assert from "node:assert/strict";
import { test } from "node:test";
import { compareSizes, parseCatalogQuery, queryCatalog } from "../src/lib/storefront-catalog.ts";

const card = (id, extra) => ({
  id,
  title: id,
  handle: id,
  thumbnail: null,
  created_at: "2026-11-19T00:00:00Z",
  price: 10,
  currency_code: "usd",
  categories: [],
  colors: [],
  sizes: [],
  brand: null,
  sellers: [{ id: "sel_1", name: "Tienda" }],
  variants_count: 1,
  offers_count: 1,
  direct_offer_id: null,
  ...extra,
});

test("sizes sort like a shop: letters, then numbers", () => {
  assert.deepEqual(["L", "XS", "M", "XXL", "S"].sort(compareSizes), ["XS", "S", "M", "L", "XXL"]);
  assert.deepEqual(["10", "8.5", "9", "24"].sort(compareSizes), ["8.5", "9", "10", "24"]);
});

test("size and brand filter the catalog; facets list what can be chosen", () => {
  const cards = [
    card("a", { sizes: ["S", "M"], brand: "Malecón" }),
    card("b", { sizes: ["L"], brand: "Arcoíris" }),
    card("c", { sizes: [], brand: null }),
  ];
  const all = queryCatalog(cards, parseCatalogQuery({}));
  assert.deepEqual(all.facets.sizes, ["S", "M", "L"]);
  assert.deepEqual(all.facets.brands, ["Arcoíris", "Malecón"]);
  assert.deepEqual(
    queryCatalog(cards, parseCatalogQuery({ size: "M" })).products.map((p) => p.id),
    ["a"],
  );
  assert.deepEqual(
    queryCatalog(cards, parseCatalogQuery({ brand: "Arcoíris" })).products.map((p) => p.id),
    ["b"],
  );
  assert.equal(queryCatalog(cards, parseCatalogQuery({ size: "M", brand: "Arcoíris" })).count, 0);
});
