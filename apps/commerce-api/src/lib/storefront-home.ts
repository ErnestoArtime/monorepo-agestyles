import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows";
import { updateSellersWorkflow } from "@mercurjs/core/workflows";

/**
 * Tienda's home content (AG-34): the banner carousel and the featured products, edited in
 * Negocio's administration and kept in the base store's metadata (no migration).
 */
export const LINK_KINDS = ["none", "category", "product", "seller", "url"] as const;
export type BannerLink = {
  kind: (typeof LINK_KINDS)[number];
  value: string | null;
  label: string | null;
};
export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  cta: string | null;
  link: BannerLink;
  active: boolean;
};
export type HomeContent = { banners: HomeBanner[]; featured_product_ids: string[] };

const KEY = "agestyles_home";
const EMPTY: HomeContent = { banners: [], featured_product_ids: [] };
export const MAX_BANNERS = 8;
export const MAX_FEATURED = 24;

type Scope = Pick<MedusaContainer, "resolve">;

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export function parseHomeContent(body: unknown): HomeContent {
  if (!body || typeof body !== "object") invalid("Faltan los datos de la portada.");
  const raw = body as Record<string, unknown>;
  const banners = Array.isArray(raw.banners) ? raw.banners : [];
  if (banners.length > MAX_BANNERS)
    invalid(`La portada admite como máximo ${MAX_BANNERS} banners.`);
  const ids = Array.isArray(raw.featured_product_ids) ? raw.featured_product_ids : [];
  if (ids.length > MAX_FEATURED)
    invalid(`Se pueden destacar como máximo ${MAX_FEATURED} productos.`);
  return {
    banners: banners.map((entry, index) => {
      const banner = (entry ?? {}) as Record<string, unknown>;
      const title = text(banner.title, 80);
      const image = text(banner.image_url, 500);
      if (!title) invalid(`El banner ${index + 1} necesita un título.`);
      if (!image || !/^https:\/\//.test(image))
        invalid(`El banner ${index + 1} necesita una imagen.`);
      const link = (banner.link ?? {}) as Record<string, unknown>;
      const kind = LINK_KINDS.includes(link.kind as BannerLink["kind"])
        ? (link.kind as BannerLink["kind"])
        : "none";
      const value = text(link.value, 500);
      if (kind !== "none" && !value) invalid(`El banner ${index + 1} necesita a dónde lleva.`);
      if (kind === "url" && !/^https:\/\//.test(value ?? ""))
        invalid(`El enlace del banner ${index + 1} debe empezar por https://.`);
      return {
        id: text(banner.id, 40) ?? `bnr_${Date.now().toString(36)}${index}`,
        title: title!,
        subtitle: text(banner.subtitle, 160),
        image_url: image!,
        cta: text(banner.cta, 30),
        link: { kind, value: kind === "none" ? null : value, label: text(link.label, 80) },
        active: banner.active !== false,
      };
    }),
    featured_product_ids: [
      ...new Set(
        ids.filter((id): id is string => typeof id === "string" && /^prod_[A-Za-z0-9]+$/.test(id)),
      ),
    ],
  };
}

async function baseStore(scope: Scope) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
    }): Promise<{ data: { id: string; metadata?: Record<string, unknown> | null }[] }>;
  };
  const { data } = await query.graph({ entity: "store", fields: ["id", "metadata"] });
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Base store not found.");
  return data[0];
}

export async function readHomeContent(scope: Scope): Promise<HomeContent> {
  const store = await baseStore(scope);
  const stored = store.metadata?.[KEY] as HomeContent | undefined;
  return stored ? { ...EMPTY, ...stored } : EMPTY;
}

export async function writeHomeContent(scope: Scope, content: HomeContent) {
  const store = await baseStore(scope);
  await updateStoresWorkflow(scope as MedusaContainer).run({
    input: {
      selector: { id: store.id },
      update: { metadata: { ...(store.metadata ?? {}), [KEY]: content } },
    },
  });
  return content;
}

/**
 * A store's own page (AG-34): banners and featured products of one seller, kept in the
 * seller's metadata and edited by its owner or administration from Negocio.
 */
async function sellerRecord(scope: Scope, sellerId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: { id: string; metadata?: Record<string, unknown> | null }[] }>;
  };
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "metadata"],
    filters: { id: sellerId },
  });
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Store not found.");
  return data[0];
}

export async function readSellerHome(scope: Scope, sellerId: string): Promise<HomeContent> {
  const seller = await sellerRecord(scope, sellerId);
  const stored = seller.metadata?.[KEY] as HomeContent | undefined;
  return stored ? { ...EMPTY, ...stored } : EMPTY;
}

/**
 * A store may only feature and link to its own products, and may not link to another store.
 * `ownProductIds` are the products this seller has offers for.
 */
export function checkSellerHome(
  content: HomeContent,
  sellerId: string,
  ownProductIds: Set<string>,
) {
  for (const id of content.featured_product_ids) {
    if (!ownProductIds.has(id)) invalid("Solo puedes destacar productos de tu tienda.");
  }
  for (const banner of content.banners) {
    if (banner.link.kind === "product" && !ownProductIds.has(banner.link.value ?? ""))
      invalid(`El banner «${banner.title}» debe llevar a un producto de tu tienda.`);
    if (banner.link.kind === "seller" && banner.link.value !== sellerId)
      invalid(`El banner «${banner.title}» no puede llevar a otra tienda.`);
  }
  return content;
}

export async function writeSellerHome(scope: Scope, sellerId: string, content: HomeContent) {
  const seller = await sellerRecord(scope, sellerId);
  await updateSellersWorkflow(scope as MedusaContainer).run({
    input: {
      selector: { id: sellerId },
      update: { metadata: { ...(seller.metadata ?? {}), [KEY]: content } },
    },
  });
  return content;
}
