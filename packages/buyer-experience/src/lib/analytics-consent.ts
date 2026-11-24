import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cookie consent for statistics in Tienda (AG-59, Fase 4). Same choice as
 * the vitrina, but Tienda is another origin, so the visitor is asked again
 * here. The own anonymous view/click events (Fase 5) do NOT depend on this
 * choice: they carry no personal data and no third-party cookie.
 */

export type AnalyticsConsent = "accepted" | "rejected";

const CONSENT_KEY = "agestyles.consent.analytics";

const listeners = new Set<(value: AnalyticsConsent | null) => void>();

export function subscribeAnalyticsConsent(
  listener: (value: AnalyticsConsent | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getAnalyticsConsent(): Promise<AnalyticsConsent | null> {
  try {
    const saved = await AsyncStorage.getItem(CONSENT_KEY);
    return saved === "accepted" || saved === "rejected" ? saved : null;
  } catch {
    return null;
  }
}

export async function setAnalyticsConsent(value: AnalyticsConsent): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private mode: the choice only lasts for this visit.
  }
  for (const listener of listeners) listener(value);
}
