import type { HttpTypes } from "@medusajs/types"
import type { StoreOffer } from "@agestyles/api-client/store"

export function productPrice(product: HttpTypes.StoreProduct) {
  const variant = product.variants?.find((item) => item.calculated_price?.calculated_amount != null)
  if (!variant?.calculated_price) return undefined
  const amount = variant.calculated_price.calculated_amount
  if (typeof amount !== "number") return undefined
  return {
    amount,
    currency: variant.calculated_price.currency_code || "eur",
  }
}

export function lowestOfferPrices(offers: StoreOffer[], currency = "eur") {
  const prices: Record<string, { amount: number; currency: string }> = {}
  for (const offer of offers) {
    const price = offer.prices?.find((item) => item.currency_code.toLowerCase() === currency.toLowerCase())
    if (typeof price?.amount !== "number") continue
    const current = prices[offer.product_id]
    if (!current || price.amount < current.amount) {
      prices[offer.product_id] = { amount: price.amount, currency: price.currency_code }
    }
  }
  return prices
}

export function formatPrice(amount: number, currency = "eur") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency.toUpperCase() }).format(amount)
}
