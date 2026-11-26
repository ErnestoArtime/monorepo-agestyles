import type { HttpTypes } from "@medusajs/types";
import { sdk } from "../config";

/** Card of the server-paginated catalog (AG-34), see commerce-api lib/storefront-catalog. */
export type CatalogCard = {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  created_at: string | null;
  price: number | null;
  currency_code: string | null;
  categories: { id: string; name: string }[];
  colors: string[];
  sizes?: string[];
  brand?: string | null;
  sellers: { id: string; name: string }[];
  variants_count: number;
  offers_count: number;
  direct_offer_id: string | null;
};
export type CatalogPage = {
  products: CatalogCard[];
  count: number;
  offset: number;
  limit: number;
  facets: {
    categories: { id: string; name: string }[];
    colors: string[];
    max_price: number;
    /** Codificadores (AG-43); absent from older API versions. */
    sizes?: string[];
    brands?: string[];
  };
};
export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  cta: string | null;
  link: {
    kind: "none" | "category" | "product" | "seller" | "url";
    value: string | null;
    label: string | null;
  };
};

export type CatalogParams = {
  regionId: string;
  q?: string;
  categoryIds?: string[];
  sellerId?: string;
  /** A store's own section (only with `sellerId`). */
  section?: string;
  minPrice?: number;
  maxPrice?: number;
  color?: string | null;
  size?: string | null;
  brand?: string | null;
  sort?: string;
  offset?: number;
  limit?: number;
};

export function fetchCatalog(params: CatalogParams) {
  return sdk.client.fetch<CatalogPage>("/store/agestyles/catalog", {
    query: {
      region_id: params.regionId,
      ...(params.q ? { q: params.q } : {}),
      ...(params.categoryIds?.length ? { category_ids: params.categoryIds.join(",") } : {}),
      ...(params.sellerId ? { seller_id: params.sellerId } : {}),
      ...(params.sellerId && params.section ? { section: params.section } : {}),
      ...(params.minPrice !== undefined ? { min_price: String(params.minPrice) } : {}),
      ...(params.maxPrice !== undefined ? { max_price: String(params.maxPrice) } : {}),
      ...(params.color ? { color: params.color } : {}),
      ...(params.size ? { size: params.size } : {}),
      ...(params.brand ? { brand: params.brand } : {}),
      sort: params.sort ?? "featured",
      offset: params.offset ?? 0,
      limit: params.limit ?? 24,
    },
  });
}

/** The marketplace home, or with `sellerId` that store's own page (its banners and products). */
export function fetchHome(regionId: string, sellerId?: string | null) {
  return sdk.client.fetch<{
    banners: HomeBanner[];
    featured: CatalogCard[];
    /** A store's own sections with products available now. */
    sections?: { id: string; name: string }[];
  }>("/store/agestyles/home", {
    query: { region_id: regionId, ...(sellerId ? { seller_id: sellerId } : {}) },
  });
}

/** The product cards render Store API products; a catalog card carries what they need. */
/** «Tienda X», or the number of stores when several sell the product; null when unknown. */
export function storeLabel(sellers: { name: string }[] | undefined): string | null {
  if (!sellers?.length) return null;
  return sellers.length === 1 ? sellers[0].name : `${sellers.length} tiendas`;
}

/** `showStore` is false inside a store's own page, where its name would repeat on every card. */
export function cardAsProduct(card: CatalogCard, showStore = true): HttpTypes.StoreProduct {
  return {
    id: card.id,
    title: card.title,
    handle: card.handle,
    thumbnail: card.thumbnail,
    created_at: card.created_at,
    categories: card.categories,
    // Shown under the title in the grids, so a product always says whose it is.
    metadata: { store_label: showStore ? storeLabel(card.sellers) : null },
    variants: [
      { calculated_price: { calculated_amount: card.price, currency_code: card.currency_code } },
    ],
  } as unknown as HttpTypes.StoreProduct;
}
