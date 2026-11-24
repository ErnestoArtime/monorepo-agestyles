import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { getAnalyticsConsent, subscribeAnalyticsConsent } from "../lib/analytics-consent";
import { GA_MEASUREMENT_ID, loadGa } from "../lib/google-analytics";

/**
 * Google Analytics 4 loader for Tienda web (AG-59, Fase 4). Renders
 * nothing and loads nothing until the visitor accepts the statistics
 * cookies; native apps never reach this code at all.
 */
export function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    void getAnalyticsConsent().then((consent) => {
      if (!cancelled) setEnabled(GA_MEASUREMENT_ID !== "" && consent === "accepted");
    });
    const unsubscribe = subscribeAnalyticsConsent((consent) =>
      setEnabled(GA_MEASUREMENT_ID !== "" && consent === "accepted"),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (enabled) loadGa();
  }, [enabled]);

  return null;
}
