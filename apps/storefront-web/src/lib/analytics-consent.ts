/**
 * Cookie consent for statistics (AG-59, Fase 4). One choice, stored in this
 * browser only, shared by the vitrina's Google Analytics loader and the
 * cookie banner. The own anonymous view/click events (Fase 5) do NOT depend
 * on this choice: they carry no personal data and no third-party cookie, and
 * the cookie policy says so.
 */

export type AnalyticsConsent = "accepted" | "rejected";

const CONSENT_KEY = "agestyles.consent.analytics";
const CONSENT_EVENT = "agestyles:consent-changed";

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const saved = window.localStorage.getItem(CONSENT_KEY);
    return saved === "accepted" || saved === "rejected" ? saved : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private mode: the choice only lasts for this visit.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Event fired on this window whenever the choice changes. */
export const ANALYTICS_CONSENT_EVENT = CONSENT_EVENT;
