/**
 * Web Vitals from the browser itself (AG-59, Fase 2).
 *
 * No new dependency on purpose: adding the `web-vitals` package would need
 * a lockfile regeneration the sandbox cannot do (see the PR description),
 * and the three metrics only need PerformanceObserver, which every modern
 * browser has. Thresholds are Google's "good / needs improvement" lines:
 * LCP 2.5 s / 4 s, INP 200 ms / 500 ms, CLS 0.1 / 0.25.
 *
 * Values are flushed when the page is hidden (and once at load for LCP, so
 * a short visit still counts). The reporter decides where they go: to
 * Google Analytics when it is active, to the console in development.
 */

export type WebVitalName = "LCP" | "INP" | "CLS";
export type WebVitalRating = "good" | "needs-improvement" | "poor";
export type WebVital = {
  name: WebVitalName;
  /** Milliseconds for LCP/INP, unitless for CLS. */
  value: number;
  rating: WebVitalRating;
  /** Element or interaction that produced the value, when known. */
  id: string;
};

export function rateWebVital(name: WebVitalName, value: number): WebVitalRating {
  const [good, poor] = name === "LCP" ? [2500, 4000] : name === "INP" ? [200, 500] : [0.1, 0.25];
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
}

type VitalState = { value: number; id: string };

function largestContentfulPaint(onUpdate: (vital: WebVital) => void): void {
  let state: VitalState = { value: 0, id: "" };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const paint = entry as PerformanceEntry & { renderTime?: number; loadTime?: number };
      const value = paint.renderTime ?? paint.loadTime ?? 0;
      if (value > state.value) {
        state = { value, id: "largest-contentful-paint" };
        onUpdate({ name: "LCP", value, rating: rateWebVital("LCP", value), id: state.id });
      }
    }
  });
  observer.observe({ type: "largest-contentful-paint", buffered: true });
}

function cumulativeLayoutShift(onFinal: (vital: WebVital) => void): void {
  let value = 0;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      if (shift.hadRecentInput) continue;
      value += shift.value ?? 0;
    }
  });
  observer.observe({ type: "layout-shift", buffered: true });
  const flush = () =>
    onFinal({
      name: "CLS",
      value,
      rating: rateWebVital("CLS", value),
      id: "cumulative-layout-shift",
    });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

function interactionToNextPaint(onUpdate: (vital: WebVital) => void): void {
  let worst: VitalState = { value: 0, id: "" };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const timing = entry as PerformanceEntry & { interactionId?: number; duration?: number };
      if (timing.interactionId === undefined) continue;
      const value = timing.duration ?? 0;
      if (value > worst.value) {
        worst = { value, id: `interaction-${timing.interactionId}` };
        onUpdate({ name: "INP", value, rating: rateWebVital("INP", value), id: worst.id });
      }
    }
  });
  observer.observe({
    type: "event",
    buffered: true,
    durationThreshold: 16,
  } as PerformanceObserverInit);
}

/**
 * Start measuring. Each callback fires when a metric has a new value; the
 * caller decides whether to send it now or wait for the page to hide.
 * No-op outside a browser or without PerformanceObserver.
 */
export function reportWebVitals(onVital: (vital: WebVital) => void): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => {};
  try {
    largestContentfulPaint(onVital);
    cumulativeLayoutShift(onVital);
    interactionToNextPaint(onVital);
  } catch {
    // Old browsers: the page works the same without metrics.
  }
  return () => {};
}
