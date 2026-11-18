/**
 * Hands a cart built in the public Catálogo over to Tienda for payment. The cart is a regular
 * Medusa cart; its id travels in the link and Tienda adopts it. Pure helpers shared by both apps.
 */

const CART_ID = /^cart_[A-Za-z0-9]{6,64}$/;
export const HANDOFF_PARAM = "cart";

/** The cart id carried by a query string (`?cart=cart_…`), or null when absent or malformed. */
export function parseHandoffCartId(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(query).get(HANDOFF_PARAM);
  return value && CART_ID.test(value) ? value : null;
}

/** Link to Tienda's home with the cart attached. Returns null when the id is not a cart id. */
export function buildHandoffUrl(appUrl: string, cartId: string): string | null {
  if (!CART_ID.test(cartId)) return null;
  const base = appUrl.trim().replace(/\/+$/, "");
  return `${base}/?${HANDOFF_PARAM}=${encodeURIComponent(cartId)}`;
}

/** The same address without the handoff parameter, so reloading does not adopt the cart twice. */
export function withoutHandoffParam(href: string): string {
  const url = new URL(href, "https://handoff.invalid");
  url.searchParams.delete(HANDOFF_PARAM);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
