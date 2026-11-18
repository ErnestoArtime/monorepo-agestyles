import assert from "node:assert/strict";
import test from "node:test";
import {
  clampQuantity,
  defaultSelection,
  groupBySeller,
  offerFor,
  priceRange,
  selectSeller,
  toQuickViewOffers,
  variantLabel,
  type RawOffer,
} from "../src/lib/quick-view-model.ts";

const raw = (
  id: string,
  seller: string,
  variant: string,
  amount: number,
  extra: Partial<RawOffer> = {},
): RawOffer => ({
  id,
  seller_id: seller,
  variant_id: variant,
  seller: { id: seller, name: `Tienda ${seller}`, handle: seller },
  product_variant: { id: variant, title: variant },
  calculated_price: { calculated_amount: amount, currency_code: "usd" },
  in_stock: true,
  ...extra,
});

test("offers without a price in the region currency are dropped", () => {
  const offers = toQuickViewOffers(
    [
      raw("o1", "a", "S", 10),
      raw("o2", "a", "M", 12, {
        calculated_price: undefined,
        prices: [{ currency_code: "eur", amount: 9 }],
      }),
      raw("o3", "a", "L", 0, {
        calculated_price: undefined,
        prices: [{ currency_code: "USD", amount: 14 }],
      }),
    ],
    "usd",
  );
  assert.deepEqual(
    offers.map(({ id, amount }) => [id, amount]),
    [
      ["o1", 10],
      ["o3", 14],
    ],
  );
});

test("a missing stock projection means available, never sold out", () => {
  const [offer] = toQuickViewOffers([raw("o1", "a", "S", 10, { in_stock: undefined })], "usd");
  assert.equal(offer.inStock, true);
  const [sold] = toQuickViewOffers([raw("o1", "a", "S", 10, { in_stock: false })], "usd");
  assert.equal(sold.inStock, false);
});

test("the single Medusa variant is shown as «Variante única»", () => {
  assert.equal(variantLabel("Default"), "Variante única");
  assert.equal(variantLabel(" default "), "Variante única");
  assert.equal(variantLabel(""), "Variante única");
  assert.equal(variantLabel(null), "Variante única");
  assert.equal(variantLabel("M"), "M");
});

test("stores are ordered by availability and price; the default is the cheapest in stock", () => {
  const sellers = groupBySeller(
    toQuickViewOffers(
      [
        raw("o1", "cheap-soldout", "S", 5, { in_stock: false }),
        raw("o2", "mid", "S", 12),
        raw("o3", "mid", "M", 9),
        raw("o4", "dear", "S", 20),
      ],
      "usd",
    ),
  );
  assert.deepEqual(
    sellers.map((seller) => seller.id),
    ["mid", "dear", "cheap-soldout"],
  );
  assert.deepEqual(
    sellers[0].variants.map((variant) => variant.variantId),
    ["M", "S"],
    "variants cheapest first",
  );
  assert.deepEqual(defaultSelection(sellers), { sellerId: "mid", variantId: "M" });
  assert.equal(offerFor(sellers, defaultSelection(sellers))?.id, "o3");
});

test("when everything is sold out the cheapest offer is still the default, flagged as sold out", () => {
  const sellers = groupBySeller(
    toQuickViewOffers(
      [raw("o1", "a", "S", 8, { in_stock: false }), raw("o2", "b", "S", 6, { in_stock: false })],
      "usd",
    ),
  );
  const selected = offerFor(sellers, defaultSelection(sellers));
  assert.equal(selected?.id, "o2");
  assert.equal(selected?.inStock, false);
});

test("changing store keeps the variant when the new store sells it", () => {
  const sellers = groupBySeller(
    toQuickViewOffers(
      [
        raw("o1", "a", "S", 5),
        raw("o2", "a", "M", 6),
        raw("o3", "b", "M", 7),
        raw("o4", "b", "L", 8),
      ],
      "usd",
    ),
  );
  assert.deepEqual(selectSeller(sellers, { sellerId: "a", variantId: "M" }, "b"), {
    sellerId: "b",
    variantId: "M",
  });
  assert.deepEqual(selectSeller(sellers, { sellerId: "a", variantId: "S" }, "b"), {
    sellerId: "b",
    variantId: "M",
  });
  assert.deepEqual(selectSeller(sellers, { sellerId: "a", variantId: "S" }, "nobody"), {
    sellerId: "a",
    variantId: "S",
  });
  assert.equal(offerFor(sellers, null), null);
  assert.equal(offerFor(sellers, { sellerId: "a", variantId: "XL" }), null);
});

test("price range and quantity limits", () => {
  const offers = toQuickViewOffers([raw("o1", "a", "S", 5), raw("o2", "b", "S", 9)], "usd");
  assert.deepEqual(priceRange(offers), { min: 5, max: 9 });
  assert.equal(priceRange([]), null);
  assert.equal(defaultSelection([]), null);
  assert.equal(clampQuantity(0), 1);
  assert.equal(clampQuantity(3.9), 3);
  assert.equal(clampQuantity(99), 10);
  assert.equal(clampQuantity(Number.NaN), 1);
});

test("several offers for the same variant of a store show as one variant, the best one", () => {
  const sellers = groupBySeller(
    toQuickViewOffers(
      [
        raw("o1", "a", "S", 12),
        raw("o2", "a", "S", 9),
        raw("o3", "a", "S", 7, { in_stock: false }),
        raw("o4", "a", "M", 10),
      ],
      "usd",
    ),
  );
  assert.equal(sellers.length, 1);
  assert.deepEqual(
    sellers[0].variants.map((variant) => [variant.variantId, variant.offer.id]),
    [
      ["S", "o2"],
      ["M", "o4"],
    ],
    "the cheapest offer in stock represents each variant",
  );
  assert.equal(sellers[0].fromAmount, 9, "«desde» is the cheapest offer that can be bought");
});
