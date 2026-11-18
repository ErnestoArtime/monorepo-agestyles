import type { CupExchangeRate } from "@agestyles/api-client/exchange-rate";

/**
 * Pure model behind the quick view and the product page purchase panel: which stores sell a
 * product, which variants each one has and which offer a given choice resolves to. Relative
 * imports only, so it runs under `node` for tests.
 */

export type RawOffer = {
  id: string;
  seller_id: string;
  variant_id: string;
  seller?: { id: string; name: string; handle?: string | null };
  product_variant?: { id: string; title?: string | null; sku?: string | null };
  sku?: string | null;
  prices?: { currency_code: string; amount: number }[];
  calculated_price?: { calculated_amount: number; currency_code: string };
  in_stock?: boolean;
};

export type QuickViewOffer = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerHandle: string | null;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  amount: number;
  currency: string;
  inStock: boolean;
};

export type VariantChoice = { variantId: string; title: string; offer: QuickViewOffer };
export type SellerChoice = {
  id: string;
  name: string;
  handle: string | null;
  fromAmount: number;
  inStock: boolean;
  variants: VariantChoice[];
};

export type QuickViewData = {
  product: {
    id: string;
    handle: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    images: string[];
    category: string | null;
    /** Facts the product page lists as «Características»; only those the product has. */
    specs: { label: string; value: string }[];
  };
  currency: string;
  offers: QuickViewOffer[];
  cupRate: CupExchangeRate | null;
};

/** The catalog shows «Variante única» where Medusa names the only variant «Default». */
export function variantLabel(title: string | null | undefined): string {
  const clean = (title ?? "").trim();
  return !clean || clean.toLowerCase() === "default" ? "Variante única" : clean;
}

function priceIn(offer: RawOffer, currency: string): number | null {
  const wanted = currency.toLowerCase();
  const calculated = offer.calculated_price;
  if (calculated && calculated.currency_code.toLowerCase() === wanted) {
    const amount = Number(calculated.calculated_amount);
    if (Number.isFinite(amount)) return amount;
  }
  const listed = offer.prices?.find((price) => price.currency_code.toLowerCase() === wanted);
  const amount = Number(listed?.amount);
  return Number.isFinite(amount) ? amount : null;
}

/** Offers without a price in the region's currency cannot be bought and are left out. */
export function toQuickViewOffers(offers: RawOffer[], currency: string): QuickViewOffer[] {
  const result: QuickViewOffer[] = [];
  for (const offer of offers) {
    const amount = priceIn(offer, currency);
    if (amount === null) continue;
    result.push({
      id: offer.id,
      sellerId: offer.seller?.id ?? offer.seller_id,
      sellerName: offer.seller?.name?.trim() || "Tienda AgeStyles",
      sellerHandle: offer.seller?.handle ?? null,
      variantId: offer.variant_id,
      variantTitle: variantLabel(offer.product_variant?.title),
      sku: offer.sku ?? offer.product_variant?.sku ?? null,
      amount,
      currency,
      // The API only reports the stock projection when asked; absent means "not exposed",
      // never "sold out".
      inStock: offer.in_stock !== false,
    });
  }
  return result;
}

/** The offer to show for a variant that several offers cover: in stock first, then cheapest. */
function betterOffer(a: QuickViewOffer, b: QuickViewOffer): QuickViewOffer {
  if (a.inStock !== b.inStock) return a.inStock ? a : b;
  return a.amount <= b.amount ? a : b;
}

/**
 * Stores ordered by their cheapest available offer; one entry per variant inside each (a store
 * may have several offers for the same variant), cheapest first.
 */
export function groupBySeller(offers: QuickViewOffer[]): SellerChoice[] {
  const sellers = new Map<string, SellerChoice>();
  const variants = new Map<string, Map<string, QuickViewOffer>>();
  for (const offer of offers) {
    const own = variants.get(offer.sellerId) ?? new Map<string, QuickViewOffer>();
    const known = own.get(offer.variantId);
    own.set(offer.variantId, known ? betterOffer(known, offer) : offer);
    variants.set(offer.sellerId, own);
    if (!sellers.has(offer.sellerId)) {
      sellers.set(offer.sellerId, {
        id: offer.sellerId,
        name: offer.sellerName,
        handle: offer.sellerHandle,
        fromAmount: Number.POSITIVE_INFINITY,
        inStock: false,
        variants: [],
      });
    }
  }
  const choices: SellerChoice[] = [];
  for (const [sellerId, seller] of sellers) {
    const list = [...(variants.get(sellerId) ?? new Map<string, QuickViewOffer>()).values()]
      .map((offer) => ({ variantId: offer.variantId, title: offer.variantTitle, offer }))
      .sort(
        (a, b) =>
          Number(!a.offer.inStock) - Number(!b.offer.inStock) || a.offer.amount - b.offer.amount,
      );
    choices.push({
      ...seller,
      variants: list,
      fromAmount: Math.min(...list.map((item) => item.offer.amount)),
      inStock: list.some((item) => item.offer.inStock),
    });
  }
  const rank = (seller: SellerChoice) => [seller.inStock ? 0 : 1, seller.fromAmount] as const;
  return choices.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]);
}

export type Selection = { sellerId: string; variantId: string };

/** The cheapest offer that is in stock; otherwise the cheapest one, shown as sold out. */
export function defaultSelection(sellers: SellerChoice[]): Selection | null {
  const first = sellers[0]?.variants[0];
  return first ? { sellerId: sellers[0].id, variantId: first.variantId } : null;
}

export function offerFor(
  sellers: SellerChoice[],
  selection: Selection | null,
): QuickViewOffer | null {
  if (!selection) return null;
  const seller = sellers.find((item) => item.id === selection.sellerId);
  return seller?.variants.find((item) => item.variantId === selection.variantId)?.offer ?? null;
}

/** Changing store keeps the variant when that store sells it, otherwise its first variant. */
export function selectSeller(
  sellers: SellerChoice[],
  current: Selection | null,
  sellerId: string,
): Selection | null {
  const seller = sellers.find((item) => item.id === sellerId);
  if (!seller || !seller.variants.length) return current;
  const same = seller.variants.find((item) => item.variantId === current?.variantId);
  return { sellerId, variantId: (same ?? seller.variants[0]).variantId };
}

export function priceRange(offers: QuickViewOffer[]): { min: number; max: number } | null {
  if (!offers.length) return null;
  const amounts = offers.map((offer) => offer.amount);
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

export const MAX_QUANTITY = 10;

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_QUANTITY);
}
