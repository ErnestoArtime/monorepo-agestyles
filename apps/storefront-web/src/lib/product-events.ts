import type {
  ProductEventInput,
  ProductEventSurface,
  ProductEventType,
} from "@agestyles/api-client/product-events";

/**
 * Anonymous events from the public catalog (AG-59). The session id is a
 * random value kept in this browser only; it lets the API ignore a repeat
 * from the same visit. Nothing personal is ever sent, and a failed event
 * is silently dropped — tracking never breaks the page.
 */

const SESSION_KEY = "agestyles.analytics.session";

export type ApiConfig = { apiUrl: string; publishableKey: string } | null;

export function getAnonymousSessionId(): string {
  if (typeof window === "undefined" || !window.localStorage) return "sess-unknown";
  try {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = `sess-${window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "sess-unknown";
  }
}

export function trackProductEvent(
  config: ApiConfig,
  event: Omit<ProductEventInput, "session_id">,
): void {
  if (!config) return;
  const type: ProductEventType = event.type;
  const surface: ProductEventSurface = event.surface;
  const body = {
    product_id: event.product_id ?? null,
    seller_id: event.seller_id,
    type,
    surface,
    session_id: getAnonymousSessionId(),
  };
  void fetch(`${config.apiUrl.replace(/\/+$/, "")}/store/agestyles/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": config.publishableKey,
    },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Tracking is best effort; the page never depends on it.
  });
}
