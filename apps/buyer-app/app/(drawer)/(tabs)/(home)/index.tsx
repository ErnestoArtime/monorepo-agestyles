import { Loading } from "@/components/loading";
import { ProductCard } from "@/components/product-card";
import { AndroidAppLink } from "@/components/android-app-link";
import { listStoreProducts } from "@agestyles/api-client/store";
import { Colors } from "@/constants/theme";
import { useRegion } from "@/context/region-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Icon } from "@agestyles/icons";
import { sdk } from "@/lib/sdk";
import type { HttpTypes } from "@medusajs/types";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { selectedRegion, loading: regionLoading, error: regionError, reloadRegions } = useRegion();
  const router = useRouter();

  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Filters opened from the side menu (categories with their subcategories, a store, novelties).
  const params = useLocalSearchParams<{
    filtro?: string;
    nombre?: string;
    ids?: string;
    tienda?: string;
  }>();
  const [storeProductIds, setStoreProductIds] = useState<Set<string> | null>(null);
  const menuFilter = useMemo(() => {
    if (params.filtro === "categoria" && params.ids) {
      return {
        kind: "categoria" as const,
        label: params.nombre ?? "Categoría",
        ids: new Set(params.ids.split(",")),
      };
    }
    if (params.filtro === "tienda" && params.tienda) {
      return { kind: "tienda" as const, label: params.nombre ?? "Tienda", seller: params.tienda };
    }
    if (params.filtro === "novedades") return { kind: "novedades" as const, label: "Novedades" };
    return null;
  }, [params.filtro, params.ids, params.nombre, params.tienda]);

  useEffect(() => {
    // Opening a page from the menu starts from a clean list.
    setSelectedCategory(null);
    setSearchTerm("");
  }, [params.filtro, params.ids, params.tienda]);

  useEffect(() => {
    if (menuFilter?.kind !== "tienda" || !selectedRegion) {
      setStoreProductIds(null);
      return;
    }
    let active = true;
    sdk.client
      .fetch<{ offers: { product_id: string }[] }>("/store/offers", {
        query: { region_id: selectedRegion.id, seller_id: menuFilter.seller, limit: 100 },
      })
      .then(({ offers }) => {
        if (active) setStoreProductIds(new Set(offers.map((offer) => offer.product_id)));
      })
      .catch(() => {
        if (active) setStoreProductIds(new Set());
      });
    return () => {
      active = false;
    };
  }, [menuFilter, selectedRegion]);

  const categories = useMemo(() => {
    const names = products.flatMap(
      (product) => product.categories?.map((category) => category.name) ?? [],
    );
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    const filtered = products.filter((product) => {
      const searchableText = String(product.title) + " " + String(product.description ?? "");
      const matchesQuery = !query || searchableText.toLocaleLowerCase().includes(query);
      const matchesCategory =
        !selectedCategory ||
        product.categories?.some((category) => category.name === selectedCategory);
      const matchesMenu =
        menuFilter?.kind === "categoria"
          ? product.categories?.some((category) => menuFilter.ids.has(category.id))
          : menuFilter?.kind === "tienda"
            ? !storeProductIds || storeProductIds.has(product.id)
            : true;
      return matchesQuery && matchesCategory && matchesMenu;
    });
    return menuFilter?.kind === "novedades"
      ? [...filtered].sort(
          (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        )
      : filtered;
  }, [menuFilter, products, searchTerm, selectedCategory, storeProductIds]);

  const fetchProducts = useCallback(async () => {
    if (!selectedRegion) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // The whole catalog, not the client's default page of 20.
      const { products: fetchedProducts } = await listStoreProducts(sdk.client, {
        regionId: selectedRegion.id,
        limit: 200,
      });

      setProducts(fetchedProducts);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("No se pudieron cargar los productos. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedRegion) {
      fetchProducts();
    }
  }, [selectedRegion, fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  if (regionLoading) {
    return <Loading message="Preparando el catálogo…" />;
  }

  if (!selectedRegion || regionError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.statePanel,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Icon name="refresh" size={28} color={colors.tint} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            No pudimos preparar la tienda
          </Text>
          <Text style={[styles.errorText, { color: colors.icon }]}>
            {regionError ?? "No hay una región de compra disponible en este momento."}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Volver a cargar las regiones"
            onPress={() => void reloadRegions()}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
          >
            <Text style={[styles.retryText, { color: colors.onTint }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return <Loading message="Cargando productos..." />;
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.statePanel,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Icon name="refresh" size={28} color={colors.tint} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            El catálogo está tardando un poco más de lo habitual
          </Text>
          <Text style={[styles.errorText, { color: colors.icon }]}>{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={fetchProducts}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
          >
            <Text style={[styles.retryText, { color: colors.onTint }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.betaNotice, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="help" size={16} color={colors.tint} />
              <Text style={[styles.betaCopy, { color: colors.text }]}>
                AgeStyles está en fase piloto. Los pedidos son reales; si algo falla, avísanos.
              </Text>
            </View>
            <View style={[styles.hero, { backgroundColor: colors.tint }]}>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, { color: colors.onTint }]}>
                  Lo que buscas.{"\n"}Más opciones.
                </Text>
                <Text style={[styles.heroDescription, { color: colors.onTint }]}>
                  Descubre productos y compara ofertas de distintas tiendas.
                </Text>
                <Text style={[styles.heroLink, { color: colors.onTint }]}>
                  Explora el catálogo <Icon name="arrowRight" size={14} color={colors.onTint} />
                </Text>
              </View>
              {products[0]?.thumbnail ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={"Ver " + products[0].title}
                  onPress={() =>
                    router.push({
                      pathname: "/(drawer)/(tabs)/(home)/product/[id]",
                      params: { id: products[0].id, title: products[0].title },
                    })
                  }
                  style={styles.heroImageFrame}
                >
                  <Image
                    source={{ uri: products[0].thumbnail }}
                    style={[styles.heroImage, { backgroundColor: colors.imagePlaceholder }]}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            <AndroidAppLink />
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
              ]}
            >
              <Icon name="search" size={19} color={colors.icon} />
              <TextInput
                accessibilityLabel="Buscar productos"
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Buscar productos"
                placeholderTextColor={colors.icon}
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.text }]}
              />
              {searchTerm ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Borrar búsqueda"
                  onPress={() => setSearchTerm("")}
                >
                  <Icon name="close" size={18} color={colors.icon} />
                </TouchableOpacity>
              ) : null}
            </View>
            {menuFilter ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Quitar filtro ${menuFilter.label}`}
                onPress={() =>
                  router.setParams({
                    filtro: undefined,
                    ids: undefined,
                    nombre: undefined,
                    tienda: undefined,
                  })
                }
                style={[styles.menuFilter, { backgroundColor: colors.tint }]}
              >
                <Text style={[styles.categoryText, { color: colors.onTint }]}>
                  {menuFilter.label}
                </Text>
                <Icon name="close" size={16} color={colors.onTint} />
              </TouchableOpacity>
            ) : null}
            {categories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
              >
                {[null, ...categories].map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category ?? "all"}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedCategory(category)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: active ? colors.tint : colors.cardBackground,
                          borderColor: active ? colors.tint : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          { color: active ? colors.onTint : colors.text },
                        ]}
                      >
                        {category ?? "Todos los productos"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {menuFilter
                  ? menuFilter.label
                  : searchTerm || selectedCategory
                    ? "Resultados del catálogo"
                    : "Descubre algo especial"}
              </Text>
              <Text style={[styles.resultCount, { color: colors.icon }]}>
                {visibleProducts.length} {visibleProducts.length === 1 ? "producto" : "productos"}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search" size={24} color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {products.length === 0
                ? "Aún no hay productos disponibles"
                : "Ningún producto coincide con estos filtros"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    width: "100%",
    paddingBottom: 8,
  },
  betaNotice: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  betaCopy: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  hero: {
    minHeight: 212,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
  },
  heroCopy: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontWeight: "600",
  },
  heroDescription: {
    maxWidth: 230,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
  },
  heroLink: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  heroImageFrame: {
    width: "38%",
    margin: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  searchBox: {
    minHeight: 50,
    marginHorizontal: 16,
    marginTop: 20,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 15,
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  menuFilter: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 10,
  },
  categoryChip: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sectionHeading: {
    paddingHorizontal: 16,
    marginTop: 27,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 21,
    letterSpacing: -0.35,
    fontWeight: "600",
    flexShrink: 1,
  },
  resultCount: {
    fontSize: 12,
    flexShrink: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  statePanel: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
