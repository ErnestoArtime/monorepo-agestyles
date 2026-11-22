import type { HttpTypes } from "@medusajs/types";
import type { StoreClient } from "./transport";

export type { StoreClient } from "./transport";

export type Offer = {
  id: string;
  variant_id: string;
  product_id: string;
  seller_id: string;
  seller: { id: string; name: string };
  in_stock: boolean;
  calculated_price?: { calculated_amount: number; currency_code: string };
};

export type SellerShippingOption = HttpTypes.StoreCartShippingOption & {
  seller: { id: string; name: string };
};

export type ShippingOptions = Record<string, SellerShippingOption[]>;

export type StoreProductList = {
  products: HttpTypes.StoreProduct[];
  count: number;
  limit: number;
  offset: number;
};

export type StoreProductQuery = {
  regionId: string;
  limit?: number;
  offset?: number;
  query?: string;
  handle?: string;
};

export function listStoreProducts(
  client: StoreClient,
  { regionId, limit = 20, offset = 0, query, handle }: StoreProductQuery,
) {
  return client.fetch<StoreProductList>("/store/products", {
    query: {
      region_id: regionId,
      limit,
      offset,
      ...(query ? { q: query } : {}),
      ...(handle ? { handle } : {}),
      fields: "*variants.calculated_price,+variants.inventory_quantity",
    },
  });
}

export type StoreOffer = {
  id: string;
  seller_id: string;
  product_id: string;
  variant_id: string;
  seller?: { id: string; name: string; handle?: string | null };
  product_variant?: { id: string; title: string; sku?: string | null };
  prices?: Array<{ currency_code: string; amount: number }>;
  /** Only present when the request asks for the inventory projection. */
  in_stock?: boolean;
  /** Only present when the request includes `region_id`. */
  calculated_price?: { calculated_amount: number; currency_code: string };
  sku?: string | null;
};

export type StoreOfferList = {
  offers: StoreOffer[];
  count: number;
  limit: number;
  offset: number;
};

export type StoreOfferQuery = {
  productId?: string;
  variantId?: string;
  /** Required for `calculated_price` and seller-scoped pricing. */
  regionId?: string;
  limit?: number;
};

export function listStoreOffers(
  client: StoreClient,
  { productId, variantId, regionId, limit = 100 }: StoreOfferQuery = {},
) {
  return client.fetch<StoreOfferList>("/store/offers", {
    query: {
      ...(productId ? { product_id: productId } : {}),
      ...(variantId ? { variant_id: variantId } : {}),
      ...(regionId ? { region_id: regionId, fields: "+in_stock,+calculated_price,*seller" } : {}),
      limit,
    },
  });
}

/**
 * @deprecated Use `listProductOffers` from `@agestyles/api-client/offers`.
 * Kept temporarily for callers that still consume the raw `Offer` shape.
 */
export function listOffers(client: StoreClient, regionId: string, variantId?: string) {
  return client.fetch<{ offers: Offer[] }>("/store/offers", {
    query: {
      region_id: regionId,
      ...(variantId && { variant_id: variantId }),
      fields: "+in_stock,+calculated_price",
    },
  });
}

export function addOffer(client: StoreClient, cartId: string, offerId: string, quantity: number) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    query: { fields: "+items.*" },
    body: { offer_id: offerId, quantity },
  });
}

export function retrieveCart(client: StoreClient, cartId: string) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>(`/store/carts/${cartId}`, {
    query: { fields: "+items.*" },
  });
}

export function createCart(client: StoreClient, regionId: string) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>("/store/carts", {
    method: "POST",
    query: { fields: "+items.*" },
    body: { region_id: regionId },
  });
}

export function updateCartRegion(client: StoreClient, cartId: string, regionId: string) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>(`/store/carts/${cartId}`, {
    method: "POST",
    query: { fields: "+items.*" },
    body: { region_id: regionId },
  });
}

export function updateCartLineItem(
  client: StoreClient,
  cartId: string,
  itemId: string,
  quantity: number,
) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>(
    `/store/carts/${cartId}/line-items/${itemId}`,
    {
      method: "POST",
      query: { fields: "+items.*" },
      body: { quantity },
    },
  );
}

export function deleteCartLineItem(client: StoreClient, cartId: string, itemId: string) {
  return client.fetch<{ parent?: HttpTypes.StoreCart }>(
    `/store/carts/${cartId}/line-items/${itemId}`,
    {
      method: "DELETE",
      query: { fields: "+items.*" },
    },
  );
}

export function transferCart(client: StoreClient, cartId: string) {
  return client.fetch<{ cart: HttpTypes.StoreCart }>(`/store/carts/${cartId}/customer`, {
    method: "POST",
    query: { fields: "+items.*" },
  });
}

export function listShippingOptions(client: StoreClient, cartId: string) {
  return client.fetch<{ shipping_options: ShippingOptions }>("/store/agestyles/shipping-options", {
    query: { cart_id: cartId },
  });
}

export function completeCart(client: StoreClient, cartId: string) {
  return client.fetch<
    | { type: "order_group"; order_group: { id: string; orders: { id: string }[] } }
    | { type: "cart"; error: { message: string } }
  >(`/store/carts/${cartId}/complete`, {
    method: "POST",
    query: { fields: "id,orders.id" },
    body: {},
  });
}
