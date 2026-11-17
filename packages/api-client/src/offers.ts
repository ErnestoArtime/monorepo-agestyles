import type { Money, ProductOffer } from "@agestyles/domain/catalog"
import { listStoreOffers, type StoreOffer } from "./store"
import type { StoreClient } from "./transport"

/**
 * Store API offer projection for buyers.
 *
 * `toProductOffer` is pure so web and native clients can reuse it, and so the
 * mapping can be tested without a running API. When a region is requested the
 * API returns `calculated_price`, which wins over the raw price list; without
 * a region the first matching price is used. `available_quantity: null` means
 * "not exposed", never "out of stock".
 */

export type ProductOfferPage = {
  offers: ProductOffer[]
  count: number
  limit: number
  offset: number
}

export type ProductOfferOptions = {
  productId?: string
  variantId?: string
  regionId?: string
  currencyCode?: string
  availableQuantity?: number | null
}

function selectPrice(
  offer: StoreOffer,
  currencyCode?: string,
): Money | null {
  if (offer.calculated_price && (!currencyCode || offer.calculated_price.currency_code === currencyCode)) {
    return {
      amount: Number(offer.calculated_price.calculated_amount),
      currency_code: offer.calculated_price.currency_code,
    }
  }
  if (!offer.prices?.length) return null
  const match = currencyCode
    ? offer.prices.find((price) => price.currency_code === currencyCode)
    : offer.prices[0]
  if (!match) return null
  return {
    amount: Number(match.amount),
    currency_code: match.currency_code,
  }
}

export function toProductOffer(
  offer: StoreOffer,
  {
    productId,
    currencyCode,
    availableQuantity,
  }: ProductOfferOptions = {},
): ProductOffer {
  const sellerId = offer.seller?.id ?? offer.seller_id
  const stock =
    availableQuantity !== undefined
      ? availableQuantity
      : offer.in_stock === false
        ? 0
        : null
  return {
    id: offer.id,
    product_id: productId ?? offer.product_id,
    seller: {
      id: sellerId,
      name: offer.seller?.name ?? sellerId,
      handle: offer.seller?.handle ?? sellerId,
    },
    variant: offer.product_variant
      ? {
          id: offer.product_variant.id,
          sku: offer.product_variant.sku ?? offer.sku ?? null,
          title: offer.product_variant.title,
          options: [],
        }
      : null,
    price: selectPrice(offer, currencyCode),
    compare_at_price: null,
    available_quantity: stock,
    is_active: true,
  }
}

export async function listProductOffers(
  client: StoreClient,
  { productId, variantId, regionId, currencyCode, limit = 100 }: ProductOfferOptions & { limit?: number } = {},
): Promise<ProductOfferPage> {
  const page = await listStoreOffers(client, { productId, variantId, regionId, limit })
  return {
    offers: page.offers.map((offer) =>
      toProductOffer(offer, { productId, currencyCode }),
    ),
    count: page.count,
    limit: page.limit,
    offset: 0,
  }
}
