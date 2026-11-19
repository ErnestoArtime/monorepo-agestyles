import { unregisterThisDevice } from "@agestyles/features-notifications";
import { notificationsFetcher } from "../lib/notifications-fetcher";
import { sdk } from "../config";
import type { HttpTypes } from "@medusajs/types";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCart } from "./cart-context";

type CustomerContextValue = {
  customer: HttpTypes.StoreCustomer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<HttpTypes.StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const linkedCartId = useRef<string | null>(null);
  const transferInFlight = useRef(false);
  const { cart, transferCart, clearCart } = useCart();

  useEffect(() => {
    let active = true;
    sdk.store.customer
      .retrieve()
      .then(({ customer: currentCustomer }) => {
        if (active) setCustomer(currentCustomer);
      })
      .catch(() => {
        if (active) setCustomer(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const linkCurrentCart = useCallback(async () => {
    transferInFlight.current = true;
    try {
      const cartId = await transferCart();
      linkedCartId.current = cartId;
    } finally {
      transferInFlight.current = false;
    }
  }, [transferCart]);

  useEffect(() => {
    if (!customer || !cart || linkedCartId.current === cart.id || transferInFlight.current) return;

    void linkCurrentCart().catch((error) => {
      console.warn("Could not link the cart to the customer account:", error);
    });
  }, [cart, customer, linkCurrentCart]);

  const login = useCallback(
    async (email: string, password: string) => {
      let result: Awaited<ReturnType<typeof sdk.auth.login>>;
      try {
        result = await sdk.auth.login("customer", "emailpass", { email, password });
      } catch (error) {
        // An account from the old catalog (AG-32 phase C) moves its password on its first
        // sign-in: the API checks it against the old catalog and then the normal sign-in works.
        const legacy = await sdk.client
          .fetch<{ migrated: boolean }>("/store/agestyles/legacy-login", {
            method: "POST",
            body: { email, password },
          })
          .catch(() => ({ migrated: false }));
        if (!legacy.migrated) throw error;
        result = await sdk.auth.login("customer", "emailpass", { email, password });
      }
      if (typeof result !== "string") {
        throw new Error(
          "This sign-in method needs an additional step that is not available in the app yet.",
        );
      }

      const { customer: currentCustomer } = await sdk.store.customer.retrieve();
      // Linking the guest cart is best effort: the sign-in already succeeded.
      await linkCurrentCart().catch((error) => {
        console.warn("Could not link the cart to the customer account:", error);
      });
      setCustomer(currentCustomer);
    },
    [linkCurrentCart],
  );

  const register = useCallback(
    async ({
      email,
      password,
      firstName,
      lastName,
    }: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      await sdk.auth.register("customer", "emailpass", { email, password });
      await sdk.store.customer.create({
        email,
        first_name: firstName,
        last_name: lastName,
      });

      const result = await sdk.auth.login("customer", "emailpass", { email, password });
      if (typeof result !== "string") {
        throw new Error(
          "This sign-in method needs an additional step that is not available in the app yet.",
        );
      }

      const { customer: currentCustomer } = await sdk.store.customer.retrieve();
      // Linking the guest cart is best effort: the sign-in already succeeded.
      await linkCurrentCart().catch((error) => {
        console.warn("Could not link the cart to the customer account:", error);
      });
      setCustomer(currentCustomer);
    },
    [linkCurrentCart],
  );

  const logout = useCallback(async () => {
    // The session is still valid here, so the server can stop pushing to this device.
    await unregisterThisDevice(notificationsFetcher, "store").catch(() => undefined);
    await sdk.auth.logout();
    setCustomer(null);
    linkedCartId.current = null;
    await clearCart();
  }, [clearCart]);

  return (
    <CustomerContext.Provider value={{ customer, loading, login, register, logout }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) throw new Error("useCustomer must be used within a CustomerProvider");
  return context;
}
