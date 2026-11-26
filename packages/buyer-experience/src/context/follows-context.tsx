import {
  FOLLOW_COPY,
  followErrorMessage,
  followStore,
  listFollowedStores,
  setStoreAlert,
  unfollowStore,
  type FollowedStore,
} from "@agestyles/api-client/store-follows";
import { useToast } from "@agestyles/ui-native";
import { router } from "expo-router";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buyerHref } from "../config";
import { notificationsFetcher } from "../lib/notifications-fetcher";
import { useCustomer } from "./customer-context";

type Phase = "idle" | "loading" | "ready" | "error";
type StoreRef = { id: string; name: string; handle?: string | null; logo?: string | null };

type FollowsContextValue = {
  /** Followed stores, newest first. Empty while signed out. */
  follows: FollowedStore[];
  phase: Phase;
  signedIn: boolean;
  isFollowing: (sellerId: string) => boolean;
  alertOn: (sellerId: string) => boolean;
  /** Stores with a request in flight (their controls are disabled). */
  isBusy: (sellerId: string) => boolean;
  reload: () => Promise<void>;
  /** Follows or unfollows with a toast; asks to sign in when there is no session. */
  toggleFollow: (store: StoreRef) => Promise<void>;
  /** «Avisarme de productos nuevos» for a followed store. */
  setAlert: (store: StoreRef, enabled: boolean) => Promise<void>;
};

const FollowsContext = createContext<FollowsContextValue | null>(null);

/**
 * The signed-in customer's followed stores (AG-70). Changes are applied at once and rolled
 * back, with an error toast, when the server refuses them; the server is the source of truth.
 */
export function FollowsProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer();
  const toast = useToast();
  const customerId = customer?.id ?? null;
  const [follows, setFollows] = useState<FollowedStore[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState<string[]>([]);
  const followsRef = useRef<FollowedStore[]>([]);
  const busyRef = useRef<Set<string>>(new Set());
  const loadId = useRef(0);

  const replace = useCallback((next: FollowedStore[]) => {
    followsRef.current = next;
    setFollows(next);
  }, []);

  const reload = useCallback(async () => {
    const current = ++loadId.current;
    if (!customerId) {
      replace([]);
      setPhase("idle");
      return;
    }
    setPhase("loading");
    try {
      const list = await listFollowedStores(notificationsFetcher);
      if (current !== loadId.current) return;
      replace(list);
      setPhase("ready");
    } catch {
      if (current !== loadId.current) return;
      setPhase("error");
    }
  }, [customerId, replace]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const withBusy = useCallback(async (sellerId: string, run: () => Promise<void>) => {
    if (busyRef.current.has(sellerId)) return;
    busyRef.current.add(sellerId);
    setBusy([...busyRef.current]);
    try {
      await run();
    } finally {
      busyRef.current.delete(sellerId);
      setBusy([...busyRef.current]);
    }
  }, []);

  const askToSignIn = useCallback(() => {
    toast.show(FOLLOW_COPY.signedOut, "info");
    router.push(buyerHref("/(drawer)/(tabs)/account/login"));
  }, [toast]);

  const toggleFollow = useCallback(
    async (store: StoreRef) => {
      if (!customerId) return askToSignIn();
      await withBusy(store.id, async () => {
        const previous = followsRef.current;
        const existing = previous.find((item) => item.seller_id === store.id);
        if (existing) {
          replace(previous.filter((item) => item.seller_id !== store.id));
          try {
            await unfollowStore(notificationsFetcher, store.id);
            toast.show(FOLLOW_COPY.unfollowed(store.name));
          } catch (error) {
            replace(previous);
            toast.show(followErrorMessage(error), "error");
          }
          return;
        }
        replace([
          {
            seller_id: store.id,
            name: store.name,
            handle: store.handle ?? null,
            logo: store.logo ?? null,
            notify_new_products: false,
            created_at: new Date().toISOString(),
          },
          ...previous,
        ]);
        try {
          const saved = await followStore(notificationsFetcher, store.id);
          replace([saved, ...followsRef.current.filter((item) => item.seller_id !== store.id)]);
          toast.show(FOLLOW_COPY.followed(store.name));
        } catch (error) {
          replace(previous);
          toast.show(followErrorMessage(error), "error");
        }
      });
    },
    [askToSignIn, customerId, replace, toast, withBusy],
  );

  const setAlert = useCallback(
    async (store: StoreRef, enabled: boolean) => {
      if (!customerId) return askToSignIn();
      await withBusy(store.id, async () => {
        const previous = followsRef.current;
        replace(
          previous.map((item) =>
            item.seller_id === store.id ? { ...item, notify_new_products: enabled } : item,
          ),
        );
        try {
          const saved = await setStoreAlert(notificationsFetcher, store.id, enabled);
          replace(followsRef.current.map((item) => (item.seller_id === store.id ? saved : item)));
          toast.show(enabled ? FOLLOW_COPY.alertOn(store.name) : FOLLOW_COPY.alertOff(store.name));
        } catch (error) {
          replace(previous);
          toast.show(followErrorMessage(error), "error");
        }
      });
    },
    [askToSignIn, customerId, replace, toast, withBusy],
  );

  const value = useMemo<FollowsContextValue>(
    () => ({
      follows,
      phase,
      signedIn: !!customerId,
      isFollowing: (sellerId) => follows.some((item) => item.seller_id === sellerId),
      alertOn: (sellerId) =>
        follows.find((item) => item.seller_id === sellerId)?.notify_new_products ?? false,
      isBusy: (sellerId) => busy.includes(sellerId),
      reload,
      toggleFollow,
      setAlert,
    }),
    [busy, customerId, follows, phase, reload, setAlert, toggleFollow],
  );

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows() {
  const context = useContext(FollowsContext);
  if (!context) throw new Error("useFollows debe usarse dentro de FollowsProvider");
  return context;
}
