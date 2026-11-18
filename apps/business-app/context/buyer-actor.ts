import { configureBuyerExperience } from "@agestyles/buyer-experience/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Medusa from "@medusajs/js-sdk";
import {
  createBusinessBuyerSession,
  createBuyerActorStorage,
} from "@agestyles/features-buyer/business-buyer-session";

const storage = createBuyerActorStorage(AsyncStorage);

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
  exit: { label: "Mi negocio", href: "/(tabs)" },
});
