import {
  addOffer,
  createCart,
  deleteCartLineItem,
  retrieveCart,
  transferCart,
  updateCartLineItem,
  updateCartRegion,
} from "@agestyles/api-client/store";
import type { HttpTypes } from "@medusajs/types";
import type { StoreClient } from "@agestyles/api-client/store";

export interface BuyerCartStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createBuyerCartFeature(
  client: StoreClient,
  storage: BuyerCartStorage,
  storageKey = "cart_id",
) {
  async function loadOrCreate(regionId: string): Promise<HttpTypes.StoreCart> {
    const savedCartId = await storage.getItem(storageKey);
    if (savedCartId) {
      try {
        const { cart } = await retrieveCart(client, savedCartId);
        return cart;
      } catch {
        await storage.removeItem(storageKey);
      }
    }

    const { cart } = await createCart(client, regionId);
    await storage.setItem(storageKey, cart.id);
    return cart;
  }

  async function clear(regionId?: string): Promise<HttpTypes.StoreCart | null> {
    await storage.removeItem(storageKey);
    if (!regionId) return null;
    const { cart } = await createCart(client, regionId);
    await storage.setItem(storageKey, cart.id);
    return cart;
  }

  return {
    loadOrCreate,
    updateRegion: async (cartId: string, regionId: string) =>
      (await updateCartRegion(client, cartId, regionId)).cart,
    addOffer: async (cartId: string, offerId: string, quantity: number) =>
      (await addOffer(client, cartId, offerId, quantity)).cart,
    updateItemQuantity: async (cartId: string, itemId: string, quantity: number) =>
      (await updateCartLineItem(client, cartId, itemId, quantity)).cart,
    removeItem: async (cartId: string, itemId: string) =>
      (await deleteCartLineItem(client, cartId, itemId)).parent ?? null,
    refresh: async (cartId: string) => (await retrieveCart(client, cartId)).cart,
    transfer: async (cartId: string) => {
      const { cart } = await transferCart(client, cartId);
      await storage.setItem(storageKey, cart.id);
      return cart;
    },
    clear,
  };
}
