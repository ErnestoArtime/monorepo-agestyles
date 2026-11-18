/**
 * In production the SKU lives on the store's Mercur offers (and their inventory items);
 * the product variants themselves have `sku` empty (AG-29). This reads the offer SKUs so
 * screens and the CSV import can fall back to them without writing any data.
 */
type Request = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

type Offer = {
  sku?: string | null;
  variant_id?: string | null;
  product_variant?: { id?: string | null } | null;
};

/** Map from variant id to the SKU of that variant's offer in the selected store. */
export async function loadOfferSkus(
  request: Request,
  sellerId: string,
): Promise<Map<string, string>> {
  const { regions } = await request<{ regions: { id: string }[] }>("/store/regions");
  const skus = new Map<string, string>();
  const limit = 100;
  for (let offset = 0; offset < 5000; offset += limit) {
    const page = await request<{ offers?: Offer[]; count?: number }>(
      `/store/offers?limit=${limit}&offset=${offset}&region_id=${regions[0]?.id ?? ""}&seller_id=${sellerId}`,
    );
    for (const offer of page.offers ?? []) {
      const variantId = offer.variant_id ?? offer.product_variant?.id;
      if (variantId && offer.sku && !skus.has(variantId)) skus.set(variantId, offer.sku);
    }
    if (!page.offers?.length || offset + limit >= (page.count ?? 0)) break;
  }
  return skus;
}

/** Fills empty variant SKUs from the offers map (does not overwrite real variant SKUs). */
export function withOfferSkus<V extends { id: string; sku?: string | null }>(
  variants: V[] | undefined,
  skus: Map<string, string>,
): V[] | undefined {
  return variants?.map((variant) =>
    variant.sku ? variant : { ...variant, sku: skus.get(variant.id) ?? variant.sku },
  );
}
