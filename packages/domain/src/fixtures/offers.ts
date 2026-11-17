import type { ProductOffer, ProductSummary } from "../catalog"

/**
 * One product, two sellers. Mirrors the lab scenario (A2/B2 selling the same
 * common product with different SKU, price and stock) so web and native
 * clients can develop against the same shape before the endpoint exists.
 */
export const commonProduct: ProductSummary = {
  id: "prod_common_chronograph",
  handle: "aurora-chronograph",
  title: "Aurora Chronograph",
  thumbnail_url: null,
  category: { id: "cat_relojes", name: "Relojes", handle: "relojes" },
  brand: { id: "brand_aurora", name: "Aurora", handle: "aurora" },
}

export const commonOffers: ProductOffer[] = [
  {
    id: "offer_sole_society",
    product_id: commonProduct.id,
    seller: { id: "sel_sole_society", name: "Sole Society", handle: "sole-society" },
    variant: {
      id: "variant_sole_black",
      sku: "SS-AUR-BLK",
      title: "Negro / 42",
      options: [
        { name: "Color", value: "Negro" },
        { name: "Talla", value: "42" },
      ],
    },
    price: { amount: 189, currency_code: "usd" },
    compare_at_price: null,
    available_quantity: 12,
    is_active: true,
  },
  {
    id: "offer_kickz_corner",
    product_id: commonProduct.id,
    seller: { id: "sel_kickz_corner", name: "Kickz Corner", handle: "kickz-corner" },
    variant: {
      id: "variant_kickz_steel",
      sku: "KC-AUR-STL",
      title: "Acero / 41",
      options: [
        { name: "Color", value: "Acero" },
        { name: "Talla", value: "41" },
      ],
    },
    price: { amount: 175, currency_code: "usd" },
    compare_at_price: { amount: 210, currency_code: "usd" },
    available_quantity: 3,
    is_active: true,
  },
]
