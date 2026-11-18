"use client";

import Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { createBuyerCartFeature } from "@agestyles/features-buyer/cart";
import { buildHandoffUrl } from "@agestyles/features-buyer/cart-handoff";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PublicStoreConfig } from "@/lib/catalog";

const STORAGE_KEY = "agestyles.catalog.cart_id";

type CartContextValue = {
  /** False when the shop has no public configuration: the buttons then lead to the app. */
  available: boolean;
  cart: HttpTypes.StoreCart | null;
  count: number;
  busy: boolean;
  error: string | null;
  drawerOpen: boolean;
  checkoutUrl: string | null;
  currency: string;
  openDrawer: () => void;
  closeDrawer: () => void;
  addOffer: (offerId: string, quantity: number) => Promise<boolean>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearError: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const browserStorage = {
  async getItem(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode: the cart still works for this visit.
    }
  },
  async removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clean up.
    }
  },
};

/** Spanish text for a failed cart call; never the raw backend message. */
function cartErrorMessage(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status && status >= 400 && status < 500) {
    return "Esta opción ya no está disponible o no quedan suficientes unidades.";
  }
  return "No se pudo actualizar el carrito. Revisa tu conexión e inténtalo de nuevo.";
}

export function CartProvider({
  config,
  buyerAppUrl,
  children,
}: {
  config: PublicStoreConfig | null;
  buyerAppUrl: string;
  children: ReactNode;
}) {
  const feature = useMemo(() => {
    if (!config) return null;
    const sdk = new Medusa({
      baseUrl: config.apiUrl,
      publishableKey: config.publishableKey,
      // No cookies: the gateway answers cross-origin requests without credentials.
      auth: { type: "jwt", jwtTokenStorageMethod: "nostore" },
    });
    return createBuyerCartFeature(sdk.client, browserStorage, STORAGE_KEY);
  }, [config]);

  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartRef = useRef<HttpTypes.StoreCart | null>(null);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Pick up the cart left in this browser, to show the counter. Nothing is created until an add.
  useEffect(() => {
    if (!feature) return;
    let active = true;
    void (async () => {
      const saved = await browserStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      try {
        const current = await feature.refresh(saved);
        if (!active) return;
        // A cart already paid in Tienda must not come back as a full cart.
        if ((current as { completed_at?: string | null }).completed_at) {
          await browserStorage.removeItem(STORAGE_KEY);
          return;
        }
        setCart(current);
      } catch {
        await browserStorage.removeItem(STORAGE_KEY);
      }
    })();
    return () => {
      active = false;
    };
  }, [feature]);

  const run = useCallback(async (action: () => Promise<HttpTypes.StoreCart | null>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) setCart(next);
      return true;
    } catch (cause) {
      setError(cartErrorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const addOffer = useCallback(
    async (offerId: string, quantity: number) => {
      if (!feature || !config) return false;
      const ok = await run(async () => {
        const current = cartRef.current ?? (await feature.loadOrCreate(config.regionId));
        return feature.addOffer(current.id, offerId, quantity);
      });
      if (ok) setDrawerOpen(true);
      return ok;
    },
    [config, feature, run],
  );

  const setQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      const current = cartRef.current;
      if (!feature || !current) return;
      await run(() => feature.updateItemQuantity(current.id, itemId, quantity));
    },
    [feature, run],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const current = cartRef.current;
      if (!feature || !current) return;
      await run(() => feature.removeItem(current.id, itemId));
    },
    [feature, run],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      available: Boolean(feature),
      cart,
      count: (cart?.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      busy,
      error,
      drawerOpen,
      checkoutUrl: cart ? buildHandoffUrl(buyerAppUrl, cart.id) : null,
      currency: config?.currency ?? cart?.currency_code ?? "usd",
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      addOffer,
      setQuantity,
      removeItem,
      clearError: () => setError(null),
    }),
    [
      addOffer,
      buyerAppUrl,
      busy,
      cart,
      config,
      drawerOpen,
      error,
      feature,
      removeItem,
      setQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart needs a CartProvider.");
  return value;
}
