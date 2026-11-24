"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent } from "@/lib/analytics-consent";
import { GA_MEASUREMENT_ID, gaPageView } from "@/lib/google-analytics";

/**
 * Google Analytics 4 loader (AG-59, Fase 4). The script only mounts when
 * the visitor accepted the statistics cookies and a measurement ID is
 * configured; otherwise this renders nothing and no request goes to Google.
 * Page views are sent manually so client-side navigation counts too.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(
    () => GA_MEASUREMENT_ID !== "" && getAnalyticsConsent() === "accepted",
  );

  useEffect(() => {
    const refresh = () =>
      setEnabled(GA_MEASUREMENT_ID !== "" && getAnalyticsConsent() === "accepted");
    refresh();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (enabled) gaPageView(pathname);
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="agestyles-ga4"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: [
            "window.dataLayer = window.dataLayer || [];",
            "function gtag(){dataLayer.push(arguments);}",
            "gtag('js', new Date());",
            `gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true, send_page_view: false });`,
          ].join("\n"),
        }}
      />
    </>
  );
}
