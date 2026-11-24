import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordProductEvent, type ProductEventInput } from "@agestyles/api-client/product-events";
import { Platform } from "react-native";
import { sdk } from "../config";

/**
 * Anonymous events from Tienda (AG-59). The session id is a random value
 * kept in this device only; it lets the API ignore a repeat from the same
 * visit. Nothing personal is ever sent, and a failed event is silently
 * dropped — tracking never breaks the product page.
 */

const SESSION_KEY = "agestyles.analytics.session";

let cachedSession: Promise<string> | undefined;

function randomSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "sess-";
  for (let i = 0; i < 24; i += 1) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function getAnonymousSessionId(): Promise<string> {
  cachedSession ??= (async () => {
    try {
      const saved = await AsyncStorage.getItem(SESSION_KEY);
      if (saved) return saved;
      const id = randomSessionId();
      await AsyncStorage.setItem(SESSION_KEY, id);
      return id;
    } catch {
      return randomSessionId();
    }
  })();
  return cachedSession;
}

/** "tienda-web" in a browser, "tienda-app" on Android/iOS. */
export function eventSurface(): "tienda-web" | "tienda-app" {
  return Platform.OS === "web" ? "tienda-web" : "tienda-app";
}

export async function trackProductEvent(
  event: Omit<ProductEventInput, "session_id" | "surface">,
): Promise<void> {
  try {
    const session_id = await getAnonymousSessionId();
    await recordProductEvent(sdk.client, { ...event, surface: eventSurface(), session_id });
  } catch {
    // Tracking is best effort; the page never depends on it.
  }
}
