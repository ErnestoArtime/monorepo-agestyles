/**
 * Google Analytics 4 in the public catalog (AG-59, Fase 4).
 *
 * GA4 is inactive by default: it only loads when the visitor accepted the
 * statistics cookies AND a measurement ID is configured
 * (NEXT_PUBLIC_GA_MEASUREMENT_ID). Without an ID — today — nothing is
 * sent to Google at all, and every call below is a silent no-op.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** True once the gtag script has loaded and initialized. */
export function hasGa(): boolean {
  return (
    typeof window !== "undefined" && GA_MEASUREMENT_ID !== "" && typeof window.gtag === "function"
  );
}

/** One GA4 event. Silent no-op when GA4 is not loaded (no consent or no ID). */
export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (!hasGa()) return;
  try {
    window.gtag?.("event", name, params ?? {});
  } catch {
    // Analytics never breaks the page.
  }
}

/** Manual page view for client-side navigation (send_page_view is off). */
export function gaPageView(path: string): void {
  gaEvent("page_view", { page_path: path });
}
