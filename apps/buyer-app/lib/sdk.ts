import { configureBuyerExperience } from "@agestyles/buyer-experience/config";
import Medusa from "@medusajs/js-sdk";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_URL || "http://127.0.0.1:19081";

const MEDUSA_PUBLISHABLE_API_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY || "";

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

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: __DEV__,
  auth: {
    type: "jwt",
    jwtTokenStorageMethod: "custom",
    storage: secureTokenStorage,
  },
  publishableKey: MEDUSA_PUBLISHABLE_API_KEY,
});

// Tienda mounts the shared buyer experience at the root (AG-31).
configureBuyerExperience({
  sdk,
  basePath: "",
  androidApkUrl: process.env.EXPO_PUBLIC_ANDROID_APK_URL,
});
