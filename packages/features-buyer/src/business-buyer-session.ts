export const BUSINESS_BUYER_SESSION_PREFIX = "agestyles.business.buyer.actor.";

export interface BuyerSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface BuyerActorClient {
  auth: {
    login(
      actor: "customer",
      provider: "emailpass",
      credentials: { email: string; password: string },
    ): Promise<unknown>;
    logout(): Promise<unknown>;
  };
  store: { customer: { retrieve(): Promise<{ customer: { id: string; email: string } }> } };
}

export interface BusinessActorClient {
  auth: {
    login(
      actor: "member",
      provider: "emailpass",
      credentials: { email: string; password: string },
    ): Promise<unknown>;
  };
}

/** Authenticate both supported actors from one credential entry without sharing token storage. */
export async function loginBusinessAndBuyerActors(
  email: string,
  password: string,
  businessSdk: BusinessActorClient,
  buyerSdk: BuyerActorClient,
): Promise<{ businessAuthenticated: true; buyerAuthenticated: boolean }> {
  const businessToken = await businessSdk.auth.login("member", "emailpass", { email, password });
  if (typeof businessToken !== "string") {
    throw new Error("El acceso de negocio requiere un paso adicional que aún no está disponible.");
  }

  // Remove a previous customer's token before pairing this business identity with a buyer actor.
  await buyerSdk.auth.logout();

  try {
    const buyerToken = await buyerSdk.auth.login("customer", "emailpass", { email, password });
    if (typeof buyerToken !== "string") {
      return { businessAuthenticated: true, buyerAuthenticated: false };
    }
    await buyerSdk.store.customer.retrieve();
    return { businessAuthenticated: true, buyerAuthenticated: true };
  } catch {
    // A valid member session must remain usable when the person has not linked a customer actor yet.
    return { businessAuthenticated: true, buyerAuthenticated: false };
  }
}

export function createBuyerActorStorage(storage: BuyerSessionStorage) {
  return {
    getItem: (key: string) => storage.getItem(`${BUSINESS_BUYER_SESSION_PREFIX}${key}`),
    setItem: (key: string, value: string) =>
      storage.setItem(`${BUSINESS_BUYER_SESSION_PREFIX}${key}`, value),
    removeItem: (key: string) => storage.removeItem(`${BUSINESS_BUYER_SESSION_PREFIX}${key}`),
  };
}

/** Customer actor actions bound to its independent token storage. */
export function createBusinessBuyerSession(sdk: BuyerActorClient) {
  return {
    async login(email: string, password: string) {
      const result = await sdk.auth.login("customer", "emailpass", { email, password });
      if (typeof result !== "string")
        throw new Error("El acceso requiere un paso adicional que aún no está disponible.");
      return sdk.store.customer.retrieve();
    },
    async getCustomer() {
      try {
        return (await sdk.store.customer.retrieve()).customer;
      } catch {
        return null;
      }
    },
    logout: () => sdk.auth.logout(),
  };
}

/** Apply local signed-out state only after the customer actor logout succeeds. */
export async function logoutBusinessBuyerActor(
  session: { logout(): Promise<unknown> },
  onLoggedOut: () => void,
) {
  await session.logout();
  onLoggedOut();
}
