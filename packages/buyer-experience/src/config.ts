import type Medusa from "@medusajs/js-sdk";
import type { Href } from "expo-router";

/**
 * What changes between the apps that mount the buyer experience (AG-31):
 * - Tienda mounts it at the root with its own customer session;
 * - Negocio mounts the same screens under `/tienda` with the customer actor kept apart from
 *   the store member (ADR-002), plus a way back to «Mi negocio».
 * Each app calls `configureBuyerExperience` once, before rendering any buyer screen.
 */
export type BuyerExperienceConfig = {
  /** Medusa client authenticated as the `customer` actor (Store API only). */
  sdk: Medusa;
  /** Where the buyer route tree is mounted: "" in Tienda, "/tienda" in Negocio. */
  basePath: string;
  /** Link to the Android APK shown on the web; omit where the app is already installed. */
  androidApkUrl?: string;
  /** Public Tienda address used in shared product links (Negocio shares Tienda, not itself). */
  publicStoreUrl?: string;
  /** Exit from the store back to the host app (Negocio's «Mi negocio»). */
  exit?: { label: string; href: Href };
};

let config: BuyerExperienceConfig | null = null;

export function configureBuyerExperience(next: BuyerExperienceConfig) {
  config = { ...next, basePath: next.basePath.replace(/\/+$/, "") };
}

function current(): BuyerExperienceConfig {
  if (!config) {
    throw new Error("configureBuyerExperience() must run before the buyer experience is used.");
  }
  return config;
}

/**
 * The configured client. A proxy, so modules can import it at load time and the host app
 * still decides which client (and which actor's token storage) is behind it.
 */
export const sdk: Medusa = new Proxy({} as Medusa, {
  get: (_target, key) => Reflect.get(current().sdk, key),
});

/** An absolute path of the buyer tree (as written for Tienda) inside the host app. */
export function buyerPath(path: string): string {
  const base = current().basePath;
  if (!base) return path;
  return path === "/" ? base : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Same as `buyerPath` for `router.push`/`Link` targets, including `{ pathname, params }`. */
export function buyerHref(href: string): Href;
export function buyerHref(href: { pathname: string; params?: Record<string, unknown> }): Href;
export function buyerHref(href: string | { pathname: string; params?: Record<string, unknown> }) {
  if (typeof href === "string") return buyerPath(href) as Href;
  return { ...href, pathname: buyerPath(href.pathname) } as unknown as Href;
}

/** The current pathname as Tienda sees it (without the host app's prefix). */
export function buyerPathname(pathname: string): string {
  const base = current().basePath;
  if (!base || !pathname.startsWith(base)) return pathname;
  return pathname.slice(base.length) || "/";
}

export function androidApkUrl(): string | undefined {
  return current().androidApkUrl?.trim() || undefined;
}

export function buyerExit(): BuyerExperienceConfig["exit"] {
  return current().exit;
}

/** Public link to a product page, for sharing. */
export function publicProductUrl(productId: string): string {
  const configured = current().publicStoreUrl?.trim();
  const origin =
    configured ||
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://tienda.eav-labs.com");
  return `${origin.replace(/\/+$/, "")}/product/${encodeURIComponent(productId)}`;
}
