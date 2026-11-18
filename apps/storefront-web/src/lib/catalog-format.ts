import type { HttpTypes } from "@medusajs/types";
import type { StoreOffer } from "@agestyles/api-client/store";

export function productPrice(product: HttpTypes.StoreProduct) {
  const variant = product.variants?.find(
    (item) => item.calculated_price?.calculated_amount != null,
  );
  if (!variant?.calculated_price) return undefined;
  const amount = variant.calculated_price.calculated_amount;
  if (typeof amount !== "number") return undefined;
  return {
    amount,
    currency: variant.calculated_price.currency_code || "eur",
  };
}

export function lowestOfferPrices(offers: StoreOffer[], currency = "eur") {
  const prices: Record<string, { amount: number; currency: string }> = {};
  for (const offer of offers) {
    const price = offer.prices?.find(
      (item) => item.currency_code.toLowerCase() === currency.toLowerCase(),
    );
    if (typeof price?.amount !== "number") continue;
    const current = prices[offer.product_id];
    if (!current || price.amount < current.amount) {
      prices[offer.product_id] = { amount: price.amount, currency: price.currency_code };
    }
  }
  return prices;
}

export function formatPrice(amount: number, currency = "eur") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * When a product was listed: the legacy publication date preserved at migration
 * (`metadata.agestyles_legacy_activated_at`) or, otherwise, its creation date.
 */
export function listedAt(product: {
  created_at?: string | Date | null;
  metadata?: Record<string, unknown> | null;
}) {
  const legacy = product.metadata?.agestyles_legacy_activated_at;
  const value = typeof legacy === "string" && legacy ? legacy : product.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}
