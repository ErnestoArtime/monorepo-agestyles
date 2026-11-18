import { createBuyerCartFeature } from "@agestyles/features-buyer/cart";
import {
  handoffLines,
  parseHandoffCartId,
  withoutHandoffParam,
} from "@agestyles/features-buyer/cart-handoff";
import { sdk } from "@/lib/sdk";
import type { HttpTypes } from "@medusajs/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
/** Cart handed over by the Catálogo whose lines are still to be copied into this device's cart. */
const HANDOFF_STORAGE_KEY = "cart_handoff_source";
const cartFeature = createBuyerCartFeature(sdk.client, AsyncStorage, CART_STORAGE_KEY);

let handoff: Promise<void> | null = null;
let handoffArrived = false;

/**
 * A cart built in the public Catálogo arrives as `?cart=cart_…`. Its lines are copied into this
 * device's own cart (see `handoffLines`); the id from the link is never used as Tienda's cart,
 * because whoever wrote the link would know it and Medusa returns a cart to anyone holding its id.
 * The parameter is removed first, so a reload never copies the lines twice.
 */
function adoptHandoffCart(): Promise<void> {
  if (Platform.OS !== "web" || typeof window === "undefined") return Promise.resolve();
  handoff ??= (async () => {
    const cartId = parseHandoffCartId(window.location.search);
    if (!cartId) return;
    window.history.replaceState(
      window.history.state,
      "",
      withoutHandoffParam(window.location.href),
    );
    await AsyncStorage.setItem(HANDOFF_STORAGE_KEY, cartId);
    handoffArrived = true;
  })();
  return handoff;
}

/** True once when this visit came with a cart handed over from the Catálogo (so it opens on the cart). */
export async function takeHandoffArrival(): Promise<boolean> {
  await adoptHandoffCart();
  const arrived = handoffArrived;
  handoffArrived = false;
  return arrived;
}
// Read the address as soon as the app starts: the router rewrites it while the regions load.
void adoptHandoffCart();

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

      await adoptHandoffCart();
      let currentCart = await cartFeature.loadOrCreate(selectedRegion.id);
      const sourceId = await AsyncStorage.getItem(HANDOFF_STORAGE_KEY);
      if (sourceId) {
        // Forget it first: a failure must not copy the same lines again on the next load.
        await AsyncStorage.removeItem(HANDOFF_STORAGE_KEY);
        if (sourceId !== currentCart.id) {
          let failed = 0;
          try {
            const source = await cartFeature.refresh(sourceId);
            for (const line of handoffLines(source)) {
              try {
                currentCart = await cartFeature.addOffer(
                  currentCart.id,
                  line.offer_id,
                  line.quantity,
                );
              } catch {
                failed += 1;
              }
            }
          } catch {
            failed += 1;
          }
          if (failed) {
            setError(
              "Algunos productos que elegiste en el Catálogo ya no están disponibles y no se añadieron.",
            );
          }
        }
      }
      setCart(currentCart);
      return currentCart;
    } catch {
      setError("No se pudo cargar el carrito. Inténtalo de nuevo.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  // Load cart on mount
  useEffect(() => {
    loadCart();
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
      } catch {
        setError("No se pudo actualizar la región de entrega. Inténtalo de nuevo.");
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
      setError("No se pudo añadir el producto al carrito. Inténtalo de nuevo.");
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
      setError("No se pudo actualizar la cantidad. Inténtalo de nuevo.");
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
      setError("No se pudo quitar el producto del carrito. Inténtalo de nuevo.");
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
    } catch {
      setError("No se pudo actualizar el carrito. Inténtalo de nuevo.");
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
