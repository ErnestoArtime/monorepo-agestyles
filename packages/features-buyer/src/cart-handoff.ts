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

export type HandoffLine = { offer_id: string; quantity: number };

type HandoffCartLike = {
  completed_at?: string | Date | null;
  items?:
    | {
        quantity?: number | string | null;
        metadata?: Record<string, unknown> | null;
      }[]
    | null;
};

/**
 * Lines Tienda copies from a cart handed over by the Catálogo. Tienda never takes over the
 * cart id from the link: whoever wrote the link would know it, and Medusa returns a cart
 * (with the email and addresses filled in at checkout) to anyone holding its id. Copying the
 * lines into Tienda's own cart also keeps whatever was already in it. Mercur stores the offer
 * of each line in `metadata.offer_id`; lines of the same offer are added up. A cart already
 * paid gives nothing.
 */
export function handoffLines(cart: HandoffCartLike | null | undefined): HandoffLine[] {
  if (!cart || cart.completed_at) return [];
  const byOffer = new Map<string, number>();
  for (const item of cart.items ?? []) {
    const offerId = item.metadata?.offer_id;
    const quantity = Number(item.quantity);
    if (typeof offerId !== "string" || !offerId.trim()) continue;
    if (!Number.isSafeInteger(quantity) || quantity < 1) continue;
    byOffer.set(offerId, (byOffer.get(offerId) ?? 0) + quantity);
  }
  return [...byOffer].map(([offer_id, quantity]) => ({ offer_id, quantity }));
}
