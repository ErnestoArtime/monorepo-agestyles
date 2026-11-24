"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics-consent";

/**
 * Cookie banner (AG-59, Fase 4). Only the statistics cookies need a choice:
 * the cart, the anonymous session id and the preferences are needed for the
 * site to work, and the cookie policy explains each one. The choice is kept
 * in this browser only; rejecting loads nothing from Google.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(getAnalyticsConsent() === null), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const choose = (value: "accepted" | "rejected") => {
    setAnalyticsConsent(value);
    setVisible(false);
  };

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookies de estadísticas">
      <p>
        Usamos cookies de estadísticas (Google Analytics) para saber qué productos y tiendas se
        visitan. Solo se activan si aceptas; puedes cambiar de opinión en la{" "}
        <Link href="/cookies">política de cookies</Link>.
      </p>
      <div className="cookie-actions">
        <button type="button" className="btn btn-primary" onClick={() => choose("accepted")}>
          Aceptar
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => choose("rejected")}>
          Rechazar
        </button>
      </div>
    </div>
  );
}
