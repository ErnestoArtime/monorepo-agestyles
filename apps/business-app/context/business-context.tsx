import AsyncStorage from "@react-native-async-storage/async-storage";
import Medusa from "@medusajs/js-sdk";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginBusinessAndBuyerActors } from "@agestyles/features-buyer/business-buyer-session";
import { buyerSdk } from "./buyer-actor";

export type Seller = { id: string; name: string; handle: string; role_id?: string };
type Permission = "view" | "edit" | "manage" | "none";
type Member = {
  id: string;
  is_owner?: boolean;
  role_id?: string;
  permissions?: Record<string, Permission>;
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
  reloadSellers: () => Promise<void>;
};

const baseUrl = process.env.EXPO_PUBLIC_MEDUSA_URL || "http://127.0.0.1:19081";
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY || "";
const SESSION_PREFIX = "agestyles.business.actor.";
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
      const result: any = await sdk.client.fetch(
        "/vendor/members/me?fields=id,is_owner,role_id,permissions",
        {
          headers: { "x-seller-id": choice.id },
        },
      );
      const data = result?.data ?? result;
      setMember(data?.member ?? data);
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
    await sdk.auth.logout();
    setSeller(null);
    setMember(null);
    setSellers([]);
    setReady(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError("");
      try {
        await loginBusinessAndBuyerActors(email, password, sdk, buyerSdk);
        const choices = await reloadSellers();
        setSeller(null);
        setMember(null);
        setReady(true);
        if (choices.length === 1) await selectSeller(choices[0]);
      } catch (cause) {
        setError("No se pudo iniciar sesión.");
        throw cause;
      } finally {
        setLoading(false);
      }
    },
    [reloadSellers, selectSeller],
  );

  useEffect(() => {
    let active = true;
    sdk.client
      .fetch("/vendor/sellers?limit=50")
      .then(async () => {
        await reloadSellers();
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [reloadSellers]);

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
