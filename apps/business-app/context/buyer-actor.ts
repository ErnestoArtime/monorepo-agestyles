import AsyncStorage from "@react-native-async-storage/async-storage";
import Medusa from "@medusajs/js-sdk";
import {
  createBusinessBuyerSession,
  createBuyerActorStorage,
} from "../../../packages/features-buyer/src/business-buyer-session";

const storage = createBuyerActorStorage(AsyncStorage);

export const buyerSdk = new Medusa({
  baseUrl: process.env.EXPO_PUBLIC_MEDUSA_URL || "http://127.0.0.1:19081",
  publishableKey: process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY || "",
  auth: { type: "jwt", jwtTokenStorageMethod: "custom", storage },
});

export const buyerActorSession = createBusinessBuyerSession(buyerSdk);
