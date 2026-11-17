/**
 * Catalog contracts shared by web and native clients.
 *
 * These types describe the Store API projections, not database rows: a product
 * is global, an offer belongs to one seller, and price/stock live on the offer.
 * Keep them free of Supabase, Next and React Native imports.
 */

export type Money = {
  /** Decimal amount in the currency's major unit, as returned by the API. */
  amount: number
  /** ISO 4217 code in lowercase, e.g. "usd". */
  currency_code: string
}

export type CatalogReference = {
  id: string
  name: string
  handle: string
}

export type ProductSummary = {
  id: string
  handle: string
  title: string
  thumbnail_url: string | null
  category: CatalogReference | null
  brand: CatalogReference | null
}

export type ProductVariantSummary = {
  id: string
  sku: string | null
  title: string
  options: { name: string; value: string }[]
}

export type ProductOffer = {
  id: string
  product_id: string
  seller: CatalogReference
  variant: ProductVariantSummary | null
  /** Null when the seller has no active price for the requested currency. */
  price: Money | null
  compare_at_price: Money | null
  /** Null when the seller does not expose stock for this offer. */
  available_quantity: number | null
  is_active: boolean
}
