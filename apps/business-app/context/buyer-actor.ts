import { configureBuyerExperience } from "@agestyles/buyer-experience/config";
import Medusa from "@medusajs/js-sdk";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  createBusinessBuyerSession,
  createBuyerActorStorage,
} from "@agestyles/features-buyer/business-buyer-session";

/**
 * JWT storage backed by the OS keychain/keystore (expo-secure-store) instead of
 * AsyncStorage, which keeps the token in plaintext. expo-secure-store has no web
 * implementation (its web module is empty), so the web build keeps AsyncStorage
 * (localStorage) as before and only native builds use the keychain. Existing sessions stored in AsyncStorage are not
 * migrated: users sign in once again after this change.
 */
const secureTokenStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

const storage = createBuyerActorStorage(secureTokenStorage);

export const buyerSdk = new Medusa({
  // The customer actor talks to the buyer gateway, like Tienda (AG-31), not to /negocio.
  baseUrl:
    process.env.EXPO_PUBLIC_BUYER_MEDUSA_URL ||
    process.env.EXPO_PUBLIC_MEDUSA_URL ||
    "http://127.0.0.1:19081",
  publishableKey: process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY || "",
  auth: { type: "jwt", jwtTokenStorageMethod: "custom", storage },
});

export const buyerActorSession = createBusinessBuyerSession(buyerSdk);

// Negocio mounts the shared Tienda under /tienda with this customer actor (AG-31): the member
// token never reaches the Store API, and «Mi negocio» goes back to the managed store.
configureBuyerExperience({
  sdk: buyerSdk,
  basePath: "/tienda",
  // Shared product links point to the public Tienda, not to Negocio.
  publicStoreUrl: process.env.EXPO_PUBLIC_STORE_WEB_URL || "https://tienda.eav-labs.com",
  exit: { label: "Mi negocio", href: "/(tabs)" },
});
