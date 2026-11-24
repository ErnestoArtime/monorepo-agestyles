import { Platform } from "react-native";

/**
 * Google Analytics 4 in Tienda web (AG-59, Fase 4). Web only: the native
 * Android app never loads this code, and nothing is sent from native at all.
 *
 * GA4 is inactive by default: the script is only injected when the visitor
 * accepted the statistics cookies AND a measurement ID is configured
 * (EXPO_PUBLIC_GA_MEASUREMENT_ID). Without an ID — today — nothing is sent
 * to Google, and every call below is a silent no-op.
 */

export const GA_MEASUREMENT_ID = process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID || "";

type GtagWindow = {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

function gaWindow(): (Window & GtagWindow) | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window as Window & GtagWindow;
}

/** True once the gtag script has loaded and initialized. */
export function hasGa(): boolean {
  const win = gaWindow();
  return GA_MEASUREMENT_ID !== "" && !!win && typeof win.gtag === "function";
}

/** One GA4 event. Silent no-op when GA4 is not loaded (no consent or no ID). */
export function gaEvent(name: string, params?: Record<string, unknown>): void {
  const win = gaWindow();
  if (!win || !hasGa()) return;
  try {
    win.gtag?.("event", name, params ?? {});
  } catch {
    // Analytics never breaks the page.
  }
}

/**
 * Inject the gtag script once, after consent. The default config sends the
 * first page view; later screen changes inside the app do not send one —
 * the funnel events (view_item, add_to_cart, begin_checkout) are explicit.
 */
let scriptInjected = false;

export function loadGa(): void {
  const win = gaWindow();
  if (!win || GA_MEASUREMENT_ID === "" || scriptInjected) return;
  scriptInjected = true;
  const doc = win.document;
  const script = doc.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  doc.head.appendChild(script);
  const winWithLayer = win as Window & GtagWindow;
  winWithLayer.dataLayer = winWithLayer.dataLayer ?? [];
  winWithLayer.gtag = (...args: unknown[]) => {
    winWithLayer.dataLayer?.push(args);
  };
  winWithLayer.gtag("js", new Date());
  winWithLayer.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
}
