import Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { listStoreOffers, listStoreProducts } from "@agestyles/api-client/store";
import { getCupExchangeRate } from "@agestyles/api-client/exchange-rate";

const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_URL;
const publishableKey =
  process.env.MEDUSA_PUBLISHABLE_API_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;

const sdk = backendUrl ? new Medusa({ baseUrl: backendUrl, publishableKey }) : undefined;

export type PublicStoreSeller = {
  id: string;
  handle: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
};

export type PublicStoreOffer = {
  id: string;
  seller_id: string;
  product_id: string;
  variant_id: string;
  seller?: { id: string; name: string; handle?: string };
  product_variant?: { id: string; title: string; sku?: string | null };
  prices?: Array<{ currency_code: string; amount: number }>;
};

type StoreSellerPage = {
  sellers: PublicStoreSeller[];
  count: number;
  limit: number;
  offset: number;
};
type StoreOfferPage = { offers: PublicStoreOffer[]; count: number; limit: number; offset: number };
export type PublicProductCategory = {
  id: string;
  name: string;
  handle: string;
  rank?: number;
  parent_category_id?: string | null;
  products?: Array<{ id: string }>;
};
type StoreCategoryPage = {
  product_categories: PublicProductCategory[];
  count: number;
  limit: number;
  offset: number;
};
const pageSize = 100;

async function listPublicSellers(): Promise<PublicStoreSeller[]> {
  if (!sdk) return [];
  const sellers: PublicStoreSeller[] = [];
  let offset = 0;
  let count = 0;
  do {
    const page = await sdk.client.fetch<StoreSellerPage>("/store/sellers", {
      query: {
        fields: "id,handle,name,description,logo,banner",
        limit: pageSize,
        offset,
      },
    });
    if (!page.sellers.length) break;
    sellers.push(...page.sellers);
    count = page.count;
    offset += page.sellers.length;
  } while (offset < count);
  return sellers;
}

async function listPublicOffers(
  filters: { sellerId?: string; productId?: string; regionId?: string } = {},
) {
  if (!sdk) return [];
  const offers: PublicStoreOffer[] = [];
  let offset = 0;
  let count = 0;
  do {
    const page = await sdk.client.fetch<StoreOfferPage>("/store/offers", {
      query: {
        ...(filters.sellerId ? { seller_id: filters.sellerId } : {}),
        ...(filters.productId ? { product_id: filters.productId } : {}),
        ...(filters.regionId ? { region_id: filters.regionId } : {}),
        fields: "*seller",
        limit: pageSize,
        offset,
      },
    });
    if (!page.offers.length) break;
    offers.push(...page.offers);
    count = page.count;
    offset += page.offers.length;
  } while (offset < count);
  return offers;
}

export async function getSellerDirectory() {
  if (!sdk) return [];
  try {
    const [sellers, offers] = await Promise.all([listPublicSellers(), listPublicOffers()]);
    const catalogBySeller = new Map<string, Set<string>>();
    const offersBySeller = new Map<string, number>();
    for (const offer of offers) {
      const products = catalogBySeller.get(offer.seller_id) ?? new Set<string>();
      products.add(offer.product_id);
      catalogBySeller.set(offer.seller_id, products);
      offersBySeller.set(offer.seller_id, (offersBySeller.get(offer.seller_id) ?? 0) + 1);
    }
    return sellers.map((seller) => ({
      ...seller,
      productCount: catalogBySeller.get(seller.id)?.size ?? 0,
      offerCount: offersBySeller.get(seller.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getSellerByHandle(handle: string) {
  const sellers = await listPublicSellers();
  return sellers.find((seller) => seller.handle === handle);
}

export async function getSellerCatalog(handle: string) {
  if (!sdk) return undefined;
  try {
    const seller = await getSellerByHandle(handle);
    if (!seller) return undefined;
    const { regions } = await sdk.store.region.list();
    const region = regions[0];
    if (!region) return undefined;

    const offers = await listPublicOffers({ sellerId: seller.id, regionId: region.id });
    const productIds = [...new Set(offers.map(({ product_id }) => product_id))];
    const products: HttpTypes.StoreProduct[] = [];
    for (let index = 0; index < productIds.length; index += pageSize) {
      const ids = productIds.slice(index, index + pageSize);
      const page = await sdk.client.fetch<{ products: HttpTypes.StoreProduct[] }>(
        "/store/products",
        {
          query: {
            id: ids,
            region_id: region.id,
            limit: ids.length,
            fields: "*variants.calculated_price,+variants.inventory_quantity",
          },
        },
      );
      products.push(...page.products);
    }
    return { seller, products, offers, currency: region.currency_code };
  } catch {
    return undefined;
  }
}

export async function getCatalog(query?: string, categoryHandle?: string, page = 1) {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const limit = 48;
  const emptyPagination = { page: safePage, totalProducts: 0, totalPages: 1 };
  if (!sdk)
    return {
      products: [] as HttpTypes.StoreProduct[],
      offers: [],
      categories: [],
      selectedCategory: undefined,
      ...emptyPagination,
      error: "La tienda se está preparando.",
    };

  try {
    const [{ regions }, categoryPage] = await Promise.all([
      sdk.store.region.list(),
      sdk.client.fetch<StoreCategoryPage>("/store/product-categories", {
        query: {
          limit: pageSize,
          fields: "id,name,handle,rank,parent_category_id,products.id",
        },
      }),
    ]);
    const region = regions[0];
    if (!region)
      return {
        products: [] as HttpTypes.StoreProduct[],
        offers: [],
        categories: [],
        selectedCategory: undefined,
        ...emptyPagination,
        error: "No hay una región de compra disponible.",
      };

    const categories = categoryPage.product_categories
      .filter((category) => (category.products?.length ?? 0) > 0)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const selectedCategory = categoryHandle
      ? categoryPage.product_categories.find((category) => category.handle === categoryHandle)
      : undefined;
    let result = await sdk.store.product.list({
      region_id: region.id,
      limit,
      offset: (safePage - 1) * limit,
      ...(query ? { q: query } : {}),
      ...(selectedCategory ? { category_id: selectedCategory.id } : {}),
      fields: "*variants.calculated_price,+variants.inventory_quantity",
    });
    const totalProducts = result.count ?? result.products.length;
    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
    const effectivePage = Math.min(safePage, totalPages);
    if (effectivePage !== safePage) {
      result = await sdk.store.product.list({
        region_id: region.id,
        limit,
        offset: (effectivePage - 1) * limit,
        ...(query ? { q: query } : {}),
        ...(selectedCategory ? { category_id: selectedCategory.id } : {}),
        fields: "*variants.calculated_price,+variants.inventory_quantity",
      });
    }
    const { offers } = await listStoreOffers(sdk.client, { limit: 100 });
    return {
      products: result.products,
      offers,
      categories,
      selectedCategory,
      currency: region.currency_code,
      page: effectivePage,
      totalProducts,
      totalPages,
      error: undefined,
    };
  } catch {
    return {
      products: [] as HttpTypes.StoreProduct[],
      offers: [],
      categories: [],
      selectedCategory: undefined,
      ...emptyPagination,
      error: "No pudimos cargar el catálogo. Inténtalo de nuevo en unos minutos.",
    };
  }
}
export async function getProductByHandle(handle: string) {
  if (!sdk) return undefined;
  try {
    const { regions } = await sdk.store.region.list();
    const region = regions[0];
    if (!region) return undefined;
    const { products } = await listStoreProducts(sdk.client, {
      regionId: region.id,
      handle,
      limit: 1,
    });
    const product = products[0];
    if (!product) return undefined;
    const offers = await listPublicOffers({ productId: product.id, regionId: region.id });
    return { product, offers, currency: region.currency_code };
  } catch {
    return undefined;
  }
}

/** Informational CUP-per-USD rate; null when not configured or unreachable. */
export async function getCupRate() {
  if (!sdk) return null;
  return getCupExchangeRate(sdk.client);
}
