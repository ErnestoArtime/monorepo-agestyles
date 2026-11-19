import { useEffect, useState } from "react";
import type { StoreOffer } from "@agestyles/api-client/store";
import { sdk } from "../config";

export type AvailableOffers = {
  loading: boolean;
  /** In-stock, priced offers of each product (by product id). */
  byProduct: Map<string, StoreOffer[]>;
};

const PAGE = 100;

/**
 * Which products can be bought right now in the region: listings only show these, and a
 * product with a single variant and a single available offer is added without the quick view.
 */
export function useAvailableOffers(regionId: string | undefined, reloadKey = 0): AvailableOffers {
  const [state, setState] = useState<AvailableOffers>({ loading: true, byProduct: new Map() });

  useEffect(() => {
    if (!regionId) return;
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    (async () => {
      const offers: StoreOffer[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const page = await sdk.client.fetch<{ offers: StoreOffer[]; count: number }>(
          "/store/offers",
          {
            query: {
              region_id: regionId,
              fields: "+in_stock,+calculated_price",
              limit: PAGE,
              offset,
            },
          },
        );
        offers.push(...page.offers);
        if (offers.length >= page.count || page.offers.length < PAGE) break;
      }
      const byProduct = new Map<string, StoreOffer[]>();
      for (const offer of offers) {
        const priced = Boolean(offer.calculated_price || offer.prices?.length);
        if (offer.in_stock === false || !priced) continue;
        byProduct.set(offer.product_id, [...(byProduct.get(offer.product_id) ?? []), offer]);
      }
      if (active) setState({ loading: false, byProduct });
    })().catch(() => {
      // Without availability the list falls back to showing every product.
      if (active) setState({ loading: false, byProduct: new Map() });
    });
    return () => {
      active = false;
    };
  }, [regionId, reloadKey]);

  return state;
}
