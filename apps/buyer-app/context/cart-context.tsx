import { createBuyerCartFeature } from "@agestyles/features-buyer/cart";
import { sdk } from "@/lib/sdk";
import { FetchError } from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useRegion } from "./region-context";

interface CartContextType {
  cart: HttpTypes.StoreCart | null;
  addToCart: (offerId: string, quantity: number) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  transferCart: () => Promise<string>;
  clearCart: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "cart_id";
const cartFeature = createBuyerCartFeature(sdk.client, AsyncStorage, CART_STORAGE_KEY);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedRegion } = useRegion();

  const loadCart = useCallback(async () => {
    if (!selectedRegion) return null;

    try {
      setLoading(true);
      setError(null);

      const currentCart = await cartFeature.loadOrCreate(selectedRegion.id);
      setCart(currentCart);
      return currentCart;
    } catch (err) {
      setError(`Failed to load cart: ${err instanceof FetchError ? err.message : String(err)}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  // Load cart on mount
  useEffect(() => {
    loadCart()
  }, [loadCart]);

  // Update cart's region when selected region changes
  useEffect(() => {
    const updateCartRegion = async () => {
      if (!cart || !selectedRegion || cart.region_id === selectedRegion.id) {
        return;
      }

      try {
        setLoading(true);
        const updatedCart = await cartFeature.updateRegion(cart.id, selectedRegion.id);
        setCart(updatedCart);
      } catch (err) {
        setError(`Failed to update cart region: ${err instanceof FetchError ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    updateCartRegion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion]);

  const addToCart = async (offerId: string, quantity: number) => {
    let currentCart = cart;
    
    if (!currentCart) {
      currentCart = await loadCart();
      if (!currentCart) throw new Error("Could not create cart");
    }

    try {
      setLoading(true);
      setError(null);

      const updatedCart = await cartFeature.addOffer(currentCart.id, offerId, quantity);
      setCart(updatedCart);
    } catch (err) {
      setError(`Failed to add item to cart: ${err instanceof FetchError ? err.message : String(err)}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    if (!cart) return;

    try {
      setLoading(true);
      setError(null);

      const updatedCart = await cartFeature.updateItemQuantity(cart.id, itemId, quantity);
      setCart(updatedCart);
    } catch (err) {
      setError(`Failed to update quantity: ${err instanceof FetchError ? err.message : String(err)}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!cart) return;

    try {
      setLoading(true);
      setError(null);

      const updatedCart = await cartFeature.removeItem(cart.id, itemId);
      setCart(updatedCart);
    } catch (err) {
      setError(`Failed to remove item: ${err instanceof FetchError ? err.message : String(err)}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshCart = async () => {
    if (!cart) return;

    try {
      const updatedCart = await cartFeature.refresh(cart.id);
      setCart(updatedCart);
    } catch (err) {
      setError(`Failed to refresh cart: ${err instanceof FetchError ? err.message : String(err)}`);
    }
  };

  const transferCart = useCallback(async () => {
    let currentCart = cart;
    if (!currentCart) currentCart = await loadCart();
    if (!currentCart) throw new Error("Could not load cart");

    const transferredCart = await cartFeature.transfer(currentCart.id);
    setCart(transferredCart);
    return transferredCart.id;
  }, [cart, loadCart]);

  const clearCart = async () => {
    setCart(null);
    const newCart = await cartFeature.clear(selectedRegion?.id);
    setCart(newCart);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateItemQuantity,
        removeItem,
        refreshCart,
        transferCart,
        clearCart,
        loading,
        error,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

