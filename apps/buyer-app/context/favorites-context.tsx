import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const FAVORITES_STORAGE_KEY = "agestyles_favorite_product_ids";

interface FavoritesContextValue {
  favoriteIds: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  ready: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const favoriteIdsRef = useRef<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(FAVORITES_STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const parsed: unknown = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const ids = [...new Set(parsed.filter((id): id is string => typeof id === "string"))];
            favoriteIdsRef.current = ids;
            setFavoriteIds(ids);
          }
        } catch {
          favoriteIdsRef.current = [];
          setFavoriteIds([]);
        }
      })
      .catch(() => {
        if (!active) return;
        favoriteIdsRef.current = [];
        setFavoriteIds([]);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.includes(productId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(async (productId: string) => {
    const current = favoriteIdsRef.current;
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    favoriteIdsRef.current = next;
    setFavoriteIds(next);
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      if (favoriteIdsRef.current === next) {
        favoriteIdsRef.current = current;
        setFavoriteIds(current);
      }
      throw error;
    }
  }, []);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite, ready }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  return context;
}
