import { ProductCard } from "@/components/product-card";
import { Colors } from "@/constants/theme";
import { useFavorites } from "@/context/favorites-context";
import { useRegion } from "@/context/region-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { sdk } from "@/lib/sdk";
import { listStoreProducts } from "@agestyles/api-client/store";
import type { HttpTypes } from "@medusajs/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PAGE_SIZE = 100;

export default function FavoritesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { favoriteIds, ready } = useFavorites();
  const { selectedRegion } = useRegion();
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const loadFavorites = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!ready || !selectedRegion || favoriteIds.length === 0) {
      setProducts([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const wanted = new Set(favoriteIds);
      const found: HttpTypes.StoreProduct[] = [];
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      while (offset < total && found.length < wanted.size) {
        const page = await listStoreProducts(sdk.client, {
          regionId: selectedRegion.id,
          limit: PAGE_SIZE,
          offset,
        });
        total = page.count;
        found.push(...page.products.filter((product) => wanted.has(product.id)));
        offset += page.products.length;
        if (page.products.length === 0) break;
      }
      if (currentRequestId !== requestId.current) return;
      setProducts(found);
    } catch {
      if (currentRequestId !== requestId.current) return;
      setError(true);
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [favoriteIds, ready, selectedRegion]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const message =
    !ready || loading
      ? "Cargando tus favoritos…"
      : error
        ? "No se pudieron cargar tus favoritos. Vuelve a intentarlo."
        : favoriteIds.length === 0
          ? "Guarda los productos que te interesan y aparecerán aquí."
          : "Tus favoritos no están disponibles en esta región por ahora.";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={products}
        keyExtractor={(product) => product.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={products.length ? styles.list : styles.emptyList}
        ListHeaderComponent={
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>Tus favoritos</Text>
            <Text style={[styles.subtitle, { color: colors.icon }]}>
              Productos que guardaste para volver a verlos.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {(!ready || loading) && (
              <>
                <ActivityIndicator color={colors.tint} />
                <Text style={[styles.emptyText, { color: colors.icon }]}>
                  Cargando tus favoritos…
                </Text>
              </>
            )}
            {error ? (
              <>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No se pudieron cargar tus favoritos.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Volver a cargar favoritos"
                  onPress={() => void loadFavorites()}
                  style={[styles.retryButton, { backgroundColor: colors.tint }]}
                >
                  <Text style={[styles.retryText, { color: colors.onTint }]}>Reintentar</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {!error && ready && !loading && (
              <Text style={[styles.emptyText, { color: colors.icon }]}>{message}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 10, paddingBottom: 24 },
  emptyList: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  row: { justifyContent: "space-between" },
  heading: { paddingHorizontal: 5, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  emptyState: { flex: 1, minHeight: 220, justifyContent: "center", alignItems: "center", gap: 14 },
  emptyText: { maxWidth: 280, textAlign: "center", fontSize: 15, lineHeight: 22 },
  retryButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: "center" },
  retryText: { fontSize: 15, fontWeight: "600" },
});
