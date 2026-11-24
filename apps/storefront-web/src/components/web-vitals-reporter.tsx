"use client";

import { useEffect, useRef } from "react";
import { gaEvent } from "@/lib/google-analytics";
import { reportWebVitals, type WebVital } from "@/lib/web-vitals";

/**
 * Web Vitals reporter (AG-59, Fase 2). In production the values go to
 * Google Analytics as `web_vitals` events, when GA4 is active; in
 * development they are logged, so the numbers can be checked without a
 * measurement ID. Nothing is stored on the server yet — Lighthouse in CI
 * is the check that fails the build; these numbers are the real-user
 * counterpart, and a server-side aggregation is a later step if needed.
 */
export function WebVitalsReporter() {
  const latest = useRef(new Map<string, WebVital>());

  useEffect(() => {
    const flush = () => {
      for (const vital of latest.current.values()) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.debug(`[web-vitals] ${vital.name}: ${vital.value} (${vital.rating})`);
        }
        gaEvent("web_vitals", {
          name: vital.name,
          value: Math.round(vital.value * 100) / 100,
          rating: vital.rating,
          id: vital.id,
          page_path: window.location.pathname,
        });
      }
      latest.current.clear();
    };
    const stop = reportWebVitals((vital) => {
      latest.current.set(vital.name, vital);
      // LCP settles early; send it without waiting for the page to hide.
      if (vital.name === "LCP") flush();
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      stop();
    };
  }, []);

  return null;
}
