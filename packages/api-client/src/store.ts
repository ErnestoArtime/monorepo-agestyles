import type { HttpTypes } from "@medusajs/types"
import type { StoreClient } from "./transport"

export type Offer = {
  id: string
  variant_id: string
  product_id: string
  seller_id: string
  seller: { id: string; name: string }
  in_stock: boolean
  calculated_price?: { calculated_amount: number; currency_code: string }
}

export type SellerShippingOption = HttpTypes.StoreCartShippingOption & {
  seller: { id: string; name: string }
}

export type ShippingOptions = Record<string, SellerShippingOption[]>

export function listOffers(client: StoreClient, regionId: string, variantId?: string) {
  return client.fetch<{ offers: Offer[] }>("/store/offers", {
    query: {
      region_id: regionId,
      ...(variantId && { variant_id: variantId }),
      fields: "+in_stock,+calculated_price",
    },
  })
}

export function addOffer(client: StoreClient, cartId: string, offerId: string, quantity: number) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    query: { fields: "+items.*" },
    body: { offer_id: offerId, quantity },
  })
}

export function listShippingOptions(client: StoreClient, cartId: string) {
  return client.fetch<{ shipping_options: ShippingOptions }>("/store/shipping-options", {
    query: { cart_id: cartId },
  })
}

export function completeCart(client: StoreClient, cartId: string) {
  return client.fetch<
    | { type: "order_group"; order_group: { id: string; orders: { id: string }[] } }
    | { type: "cart"; error: { message: string } }
  >(`/store/carts/${cartId}/complete`, {
    method: "POST",
    query: { fields: "id,orders.id" },
    body: {},
  })
}
