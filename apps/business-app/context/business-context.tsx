import AsyncStorage from "@react-native-async-storage/async-storage";
import Medusa from "@medusajs/js-sdk";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginBusinessAndBuyerActors } from "@agestyles/features-buyer/business-buyer-session";
import { unregisterThisDevice } from "@agestyles/features-notifications";
import { toFetcher } from "../lib/notifications";
import { useAdmin } from "./admin-context";
import { buyerSdk } from "./buyer-actor";

export type Seller = { id: string; name: string; handle: string; role_id?: string };
type Permission = "view" | "edit" | "manage" | "none";
type Member = {
  id: string;
  is_owner?: boolean;
  role_id?: string;
  permissions?: Record<string, Permission>;
  /** The signed-in person, to show who is using Negocio and with which role. */
  member?: { email?: string | null; first_name?: string | null; last_name?: string | null };
};
type BusinessContextValue = {
  ready: boolean;
  loading: boolean;
  error: string;
  sellers: Seller[];
  seller: Seller | null;
  member: Member | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectSeller: (seller: Seller) => Promise<void>;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  /** Non-JSON downloads (CSV exports) for the selected seller. */
  requestText: (path: string, accept?: string) => Promise<string>;
  /** Multipart upload of product photos to Mercur's `/vendor/uploads` (AG-26). */
  upload: (form: FormData) => Promise<{ files: { id: string; url: string }[] }>;
  reloadSellers: () => Promise<void>;
};

const baseUrl = process.env.EXPO_PUBLIC_MEDUSA_URL || "http://127.0.0.1:19081";
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY || "";
const SESSION_PREFIX = "agestyles.business.actor.";
/** Last store opened, so a reload or a shared link reopens it (AG-41). */
const SELECTED_SELLER_KEY = "agestyles.business.selected-seller";
const storage = {
  getItem: (key: string) => AsyncStorage.getItem(`${SESSION_PREFIX}${key}`),
  setItem: (key: string, value: string) => AsyncStorage.setItem(`${SESSION_PREFIX}${key}`, value),
  removeItem: (key: string) => AsyncStorage.removeItem(`${SESSION_PREFIX}${key}`),
};
const sdk: any = new Medusa({
  baseUrl,
  publishableKey,
  auth: { type: "jwt", jwtTokenStorageMethod: "custom", storage },
});

const BusinessContext = createContext<BusinessContextValue | null>(null);

/** `expired`: the emailed link is invalid, already used or too old. */
export class PasswordResetError extends Error {
  constructor(readonly kind: "expired" | "failed") {
    super(kind);
    this.name = "PasswordResetError";
  }
}

/**
 * Asks for the reset email. The server answers the same whether or not the account exists, so
 * only a failure to reach it is reported.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sdk.auth.resetPassword("member", "emailpass", { identifier: email.trim() });
}

export async function completePasswordReset(token: string, password: string): Promise<void> {
  try {
    await sdk.auth.updateProvider("member", "emailpass", { password }, token);
  } catch (cause) {
    const status = (cause as { status?: number } | null)?.status;
    throw new PasswordResetError(status === 401 || status === 403 ? "expired" : "failed");
  }
}

async function unwrap<T>(result: any): Promise<T> {
  return (result?.data ?? result) as T;
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const { loginAdmin, logoutAdmin } = useAdmin();

  const request = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown) => {
      if (!seller && path !== "/vendor/sellers")
        throw new Error("Selecciona una tienda para continuar.");
      return unwrap<T>(
        await sdk.client.fetch(path, {
          method,
          ...(body === undefined ? {} : { body }),
          headers: seller ? { "x-seller-id": seller.id } : {},
        }),
      );
    },
    [seller],
  );

  const requestText = useCallback(
    async (path: string, accept = "text/csv") => {
      if (!seller) throw new Error("Selecciona una tienda para continuar.");
      // Without an application/json accept header the SDK returns the raw Response.
      const response: Response = await sdk.client.fetch(path, {
        headers: { "x-seller-id": seller.id, accept },
      });
      return response.text();
    },
    [seller],
  );

  const upload = useCallback(
    async (form: FormData) => {
      if (!seller) throw new Error("Selecciona una tienda para continuar.");
      // A null content-type lets the runtime set the multipart boundary.
      return unwrap<{ files: { id: string; url: string }[] }>(
        await sdk.client.fetch("/vendor/uploads", {
          method: "POST",
          body: form,
          headers: { "x-seller-id": seller.id, "content-type": null },
        }),
      );
    },
    [seller],
  );

  const reloadSellers = useCallback(async () => {
    const result: any = await sdk.client.fetch("/vendor/sellers?limit=50");
    const data = result?.data ?? result;
    const memberships = data?.seller_members ?? data?.members ?? [];
    const choices = memberships
      .map((entry: any) => ({
        id: entry.seller?.id ?? entry.seller_id,
        name: entry.seller?.name ?? entry.seller?.handle ?? "Tienda",
        handle: entry.seller?.handle ?? "",
        role_id: entry.role_id,
      }))
      .filter((entry: Seller) => Boolean(entry.id));
    setSellers(choices);
    return choices;
  }, []);

  const selectSeller = useCallback(async (choice: Seller) => {
    setLoading(true);
    setError("");
    try {
      await sdk.client.fetch("/vendor/sellers/select", {
        method: "POST",
        body: { seller_id: choice.id },
      });
      setSeller(choice);
      void AsyncStorage.setItem(SELECTED_SELLER_KEY, choice.id).catch(() => undefined);
      const result: any = await sdk.client.fetch(
        "/vendor/members/me?fields=id,is_owner,role_id,permissions,member.email,member.first_name,member.last_name",
        {
          headers: { "x-seller-id": choice.id },
        },
      );
      const data = result?.data ?? result;
      // Mercur returns { seller_member: {...} }; older shapes are still accepted.
      setMember(data?.seller_member ?? data?.member ?? data);
    } catch (cause) {
      setSeller(null);
      setMember(null);
      setError("No se pudo abrir esta tienda.");
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Before the session is dropped: the device removal needs the selected store.
    if (seller) {
      try {
        await unregisterThisDevice(toFetcher(request), "vendor");
      } catch {
        // Signing out must never depend on the push token being removed.
      }
    }
    await sdk.auth.logout();
    await logoutAdmin();
    await AsyncStorage.removeItem(SELECTED_SELLER_KEY).catch(() => undefined);
    setSeller(null);
    setMember(null);
    setSellers([]);
    setReady(false);
  }, [logoutAdmin, request, seller]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError("");
      try {
        // The same credentials may also open the marketplace administration (AG-32).
        const [business, isAdmin] = await Promise.all([
          loginBusinessAndBuyerActors(email, password, sdk, buyerSdk).then(
            () => null,
            (cause: unknown) => cause ?? new Error("member sign-in failed"),
          ),
          loginAdmin(email, password).catch(() => false),
        ]);
        if (business && !isAdmin) throw business;
        setSeller(null);
        setMember(null);
        if (business) {
          // Administrator without a store: only the administration section is available.
          setSellers([]);
          setReady(true);
          return;
        }
        const choices = await reloadSellers();
        setReady(true);
        if (choices.length === 1) await selectSeller(choices[0]);
      } catch (cause) {
        setError("No se pudo iniciar sesión.");
        throw cause;
      } finally {
        setLoading(false);
      }
    },
    [loginAdmin, reloadSellers, selectSeller],
  );

  useEffect(() => {
    let active = true;
    sdk.client
      .fetch("/vendor/sellers?limit=50")
      .then(async () => {
        const choices = await reloadSellers();
        // Reopen the last store (or the only one) before the screens ask for data, so a
        // reload or a direct link lands on the page instead of «Elige una tienda».
        const saved = await AsyncStorage.getItem(SELECTED_SELLER_KEY).catch(() => null);
        const choice =
          choices.find((entry: Seller) => entry.id === saved) ??
          (choices.length === 1 ? choices[0] : undefined);
        if (choice && active) await selectSeller(choice).catch(() => undefined);
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [reloadSellers, selectSeller]);

  const value = useMemo(
    () => ({
      ready,
      loading,
      error,
      sellers,
      seller,
      member,
      login,
      logout,
      selectSeller,
      request,
      requestText,
      upload,
      reloadSellers,
    }),
    [
      ready,
      loading,
      error,
      sellers,
      seller,
      member,
      login,
      logout,
      selectSeller,
      request,
      requestText,
      upload,
      reloadSellers,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error("useBusiness debe usarse dentro de BusinessProvider.");
  return context;
}
