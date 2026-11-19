import type { Fetcher, NotificationTarget } from "@agestyles/api-client/notifications";

type VendorRequest = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

/** Adapts the store-scoped `request` of the business session to the shared notification client. */
export function toFetcher(request: VendorRequest): Fetcher {
  return <T>(path: string, init?: { method?: "GET" | "POST" | "DELETE"; body?: unknown }) =>
    request<T>(path, init?.method ?? "GET", init?.body);
}

const ROUTES: Record<string, string> = {
  orders: "/(tabs)/orders",
  inventory: "/(tabs)/inventory",
  products: "/(tabs)/products",
  commissions: "/commissions",
  home: "/(tabs)",
  "category-requests": "/category-requests",
  "admin-stores": "/admin/tiendas",
  "admin-review": "/admin/revision",
  "admin-orders": "/admin/pedidos",
  "admin-categories": "/admin/categorias",
};

/** Screen a notification leads to, or null when the target is missing or unknown. */
export function routeForTarget(target: NotificationTarget): string | null {
  return (target && ROUTES[target.screen]) || null;
}
