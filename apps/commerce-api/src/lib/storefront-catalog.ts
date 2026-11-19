/**
 * Storefront catalog index (AG-34). Tienda used to download every product and every offer
 * and filter in the browser; this builds, once per region and minute, a light index of the
 * products that can be bought now (an in-stock, priced offer) from the public Store API —
 * the same data and pricing rules the buyer apps already see — and lets the routes filter,
 * sort and paginate it on the server.
 */

export type CatalogCard = {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  created_at: string | null;
  /** Lowest price among the available offers, in the region's currency. */
  price: number | null;
  currency_code: string | null;
  categories: { id: string; name: string }[];
  colors: string[];
  /** Sizes offered (variant-axis attributes named «Talla…»: codifiers of AG-42 or the product's own). */
  sizes: string[];
  brand: string | null;
  sellers: { id: string; name: string }[];
  variants_count: number;
  offers_count: number;
  /** Set when one variant and one available offer: «Agregar» adds it straight away. */
  direct_offer_id: string | null;
};

type StoreProduct = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnail?: string | null;
  created_at?: string | null;
  categories?: { id: string; name: string }[] | null;
  options?: { title?: string | null; values?: { value?: string | null }[] | null }[] | null;
  variants?: { id: string }[] | null;
  /** Mercur's computed attributes (product-scoped and global ones). */
  attributes?: { name?: string | null; values?: { name?: string | null }[] | null }[] | null;
};
type StoreOffer = {
  id: string;
  product_id: string;
  seller_id: string;
  seller?: { id: string; name: string } | null;
  in_stock?: boolean;
  calculated_price?: { calculated_amount: number; currency_code: string } | null;
  prices?: { amount: number; currency_code: string }[] | null;
};

const TTL_MS = 60_000;
const PAGE = 100;
const cache = new Map<string, { at: number; cards: Promise<CatalogCard[]> }>();

function selfUrl() {
  if (process.env.AGESTYLES_API_SELF_URL)
    return process.env.AGESTYLES_API_SELF_URL.replace(/\/+$/, "");
  const portFlag = process.argv.indexOf("--port");
  const port = portFlag > -1 ? process.argv[portFlag + 1] : process.env.PORT || "9000";
  return `http://127.0.0.1:${port}`;
}

async function fetchAll<T>(
  path: string,
  key: string,
  publishableKey: string,
  query: Record<string, string>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = new URL(`${selfUrl()}${path}`);
    for (const [name, value] of Object.entries({
      ...query,
      limit: String(PAGE),
      offset: String(offset),
    })) {
      url.searchParams.set(name, value);
    }
    const response = await fetch(url, { headers: { "x-publishable-api-key": publishableKey } });
    if (!response.ok) throw new Error(`catalog_index_${response.status}`);
    const body = (await response.json()) as Record<string, unknown> & { count?: number };
    const page = (body[key] as T[]) ?? [];
    rows.push(...page);
    if (page.length < PAGE || rows.length >= Number(body.count ?? 0)) break;
  }
  return rows;
}

function attributeValues(product: StoreProduct, name: RegExp): string[] {
  return (product.attributes ?? [])
    .filter((attribute) => name.test((attribute.name ?? "").trim()))
    .flatMap((attribute) => (attribute.values ?? []).map((value) => (value.name ?? "").trim()))
    .filter(Boolean);
}

/** Clothes sizes in their natural order, then numbers, then the rest. */
const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
export function compareSizes(a: string, b: string) {
  const la = LETTER_SIZES.indexOf(a.toUpperCase());
  const lb = LETTER_SIZES.indexOf(b.toUpperCase());
  if (la !== -1 || lb !== -1) return (la === -1 ? 99 : la) - (lb === -1 ? 99 : lb);
  const na = Number(a.replace(",", "."));
  const nb = Number(b.replace(",", "."));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "es");
}

async function buildIndex(regionId: string, publishableKey: string): Promise<CatalogCard[]> {
  const [products, offers] = await Promise.all([
    fetchAll<StoreProduct>("/store/products", "products", publishableKey, {
      region_id: regionId,
      fields:
        "id,title,handle,thumbnail,created_at,*categories,*options,*options.values,variants.id,*product_attribute_values,product_attribute_values.attribute.name",
    }),
    fetchAll<StoreOffer>("/store/offers", "offers", publishableKey, {
      region_id: regionId,
      fields: "+in_stock,+calculated_price,*seller",
    }),
  ]);
  const available = new Map<string, StoreOffer[]>();
  for (const offer of offers) {
    const priced = Boolean(offer.calculated_price || offer.prices?.length);
    if (offer.in_stock === false || !priced) continue;
    available.set(offer.product_id, [...(available.get(offer.product_id) ?? []), offer]);
  }
  const cards: CatalogCard[] = [];
  for (const product of products) {
    const productOffers = available.get(product.id);
    if (!productOffers?.length) continue;
    const prices = productOffers
      .map((offer) => offer.calculated_price ?? offer.prices?.[0])
      .filter(Boolean)
      .map((price) => ({
        amount: Number("calculated_amount" in price! ? price.calculated_amount : price!.amount),
        currency: price!.currency_code,
      }));
    const cheapest = prices.sort((a, b) => a.amount - b.amount)[0];
    const sellers = new Map(
      productOffers.map((offer) => [
        offer.seller_id,
        { id: offer.seller_id, name: offer.seller?.name ?? offer.seller_id },
      ]),
    );
    const variantsCount = product.variants?.length ?? 0;
    cards.push({
      id: product.id,
      title: product.title,
      handle: product.handle ?? null,
      thumbnail: product.thumbnail ?? null,
      created_at: product.created_at ?? null,
      price: cheapest?.amount ?? null,
      currency_code: cheapest?.currency ?? null,
      categories: (product.categories ?? []).map((category) => ({
        id: category.id,
        name: category.name,
      })),
      colors: [
        ...new Set(
          [
            ...(product.options ?? [])
              .filter((option) => /^colou?r$/i.test(option.title ?? ""))
              .flatMap((option) => (option.values ?? []).map((value) => value.value ?? "")),
            ...attributeValues(product, /^colou?r$/i),
          ].filter(Boolean),
        ),
      ],
      sizes: [...new Set(attributeValues(product, /^talla/i))],
      brand: attributeValues(product, /^marca$/i)[0] ?? null,
      sellers: [...sellers.values()],
      variants_count: variantsCount,
      offers_count: productOffers.length,
      direct_offer_id:
        variantsCount === 1 && productOffers.length === 1 ? productOffers[0].id : null,
    });
  }
  return cards;
}

/** Cached per region and publishable key for a minute; a failed build is not cached. */
export function catalogIndex(regionId: string, publishableKey: string): Promise<CatalogCard[]> {
  const key = `${regionId}:${publishableKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cards;
  const cards = buildIndex(regionId, publishableKey);
  cache.set(key, { at: Date.now(), cards });
  cards.catch(() => cache.delete(key));
  return cards;
}

export type CatalogQuery = {
  q?: string;
  category_ids?: string[];
  seller_id?: string;
  min_price?: number;
  max_price?: number;
  color?: string;
  size?: string;
  brand?: string;
  /** A store's own section (AG-35), resolved to its product ids by the route. */
  section?: string;
  product_ids?: Set<string>;
  sort?: "featured" | "newest" | "price_asc" | "price_desc";
  offset: number;
  limit: number;
};

const num = (value: unknown) => {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export function parseCatalogQuery(raw: Record<string, unknown>): CatalogQuery {
  const ids =
    typeof raw.category_ids === "string" ? raw.category_ids.split(",").filter(Boolean) : [];
  const sort = ["featured", "newest", "price_asc", "price_desc"].includes(String(raw.sort))
    ? (raw.sort as CatalogQuery["sort"])
    : "featured";
  return {
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q.trim().slice(0, 100) : undefined,
    category_ids: ids.slice(0, 50),
    seller_id: typeof raw.seller_id === "string" && raw.seller_id ? raw.seller_id : undefined,
    min_price: num(raw.min_price),
    max_price: num(raw.max_price),
    color: typeof raw.color === "string" && raw.color ? raw.color : undefined,
    size: typeof raw.size === "string" && raw.size ? raw.size.slice(0, 20) : undefined,
    brand: typeof raw.brand === "string" && raw.brand ? raw.brand.slice(0, 80) : undefined,
    section:
      typeof raw.section === "string" && /^sec_[a-z0-9]{1,30}$/.test(raw.section)
        ? raw.section
        : undefined,
    sort,
    offset: Math.max(0, Math.floor(num(raw.offset) ?? 0)),
    limit: Math.min(48, Math.max(1, Math.floor(num(raw.limit) ?? 24))),
  };
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filters, sorts and pages the index; facets describe the filtered set before paging. */
export function queryCatalog(
  cards: CatalogCard[],
  query: CatalogQuery,
  featuredIds: string[] = [],
) {
  const q = query.q ? normalize(query.q) : null;
  const categories = new Set(query.category_ids ?? []);
  const filtered = cards.filter(
    (card) =>
      (!q || normalize(card.title).includes(q)) &&
      (!categories.size || card.categories.some((category) => categories.has(category.id))) &&
      (!query.seller_id || card.sellers.some((seller) => seller.id === query.seller_id)) &&
      (!query.product_ids || query.product_ids.has(card.id)) &&
      (query.min_price === undefined || (card.price ?? 0) >= query.min_price) &&
      (query.max_price === undefined || (card.price ?? 0) <= query.max_price),
  );
  const facets = {
    categories: [
      ...new Map(filtered.flatMap((card) => card.categories).map((c) => [c.name, c])).values(),
    ]
      .map((category) => ({ ...category }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    colors: [...new Set(filtered.flatMap((card) => card.colors))].sort((a, b) =>
      a.localeCompare(b, "es"),
    ),
    max_price: Math.max(0, ...filtered.map((card) => card.price ?? 0)),
    sizes: [...new Set(filtered.flatMap((card) => card.sizes))].sort(compareSizes),
    brands: [
      ...new Set(filtered.map((card) => card.brand).filter((brand): brand is string => !!brand)),
    ].sort((a, b) => a.localeCompare(b, "es")),
  };
  const colored = filtered.filter(
    (card) =>
      (!query.color || card.colors.includes(query.color)) &&
      (!query.size || card.sizes.includes(query.size)) &&
      (!query.brand || card.brand === query.brand),
  );
  const rank = new Map(featuredIds.map((id, index) => [id, index]));
  const sorted = [...colored].sort((a, b) => {
    if (query.sort === "price_asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (query.sort === "price_desc") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
    if (query.sort === "newest")
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    // «Destacados» first, in their order; then the newest.
    const ra = rank.get(a.id) ?? Infinity;
    const rb = rank.get(b.id) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
  return {
    products: sorted.slice(query.offset, query.offset + query.limit),
    count: sorted.length,
    offset: query.offset,
    limit: query.limit,
    facets,
  };
}
