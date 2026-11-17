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
import { useRouter } from "expo-router";
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
  const { selectedRegion } = useRegion();
  const router = useRouter();

  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const names = products.flatMap(
      (product) => product.categories?.map((category) => category.name) ?? [],
    );
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const searchableText = String(product.title) + " " + String(product.description ?? "");
      const matchesQuery = !query || searchableText.toLocaleLowerCase().includes(query);
      const matchesCategory =
        !selectedCategory ||
        product.categories?.some((category) => category.name === selectedCategory);
      return matchesQuery && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const fetchProducts = useCallback(async () => {
    if (!selectedRegion) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { products: fetchedProducts } = await listStoreProducts(sdk.client, {
        regionId: selectedRegion.id,
      });

      setProducts(fetchedProducts);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Failed to load products. Please try again.");
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

  if (loading) {
    return <Loading message="Loading products..." />;
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
            The catalog is taking a moment
          </Text>
          <Text style={[styles.errorText, { color: colors.icon }]}>{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={fetchProducts}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
          >
            <Text style={[styles.retryText, { color: colors.onTint }]}>Try again</Text>
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
                The catalog and orders still use test data.
              </Text>
            </View>
            <View style={[styles.hero, { backgroundColor: colors.tint }]}>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, { color: colors.onTint }]}>
                  What you want.{"\n"}More options.
                </Text>
                <Text style={[styles.heroDescription, { color: colors.onTint }]}>
                  Discover products and compare offers from different stores.
                </Text>
                <Text style={[styles.heroLink, { color: colors.onTint }]}>
                  Explore the catalog <Icon name="arrowRight" size={14} color={colors.onTint} />
                </Text>
              </View>
              {products[0]?.thumbnail ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={"View " + products[0].title}
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
                accessibilityLabel="Search products"
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search products"
                placeholderTextColor={colors.icon}
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.text }]}
              />
              {searchTerm ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchTerm("")}
                >
                  <Icon name="close" size={18} color={colors.icon} />
                </TouchableOpacity>
              ) : null}
            </View>
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
                        {category ?? "All products"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {searchTerm || selectedCategory ? "Catalog results" : "Discover something special"}
              </Text>
              <Text style={[styles.resultCount, { color: colors.icon }]}>
                {visibleProducts.length} products
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
                ? "No products are available yet"
                : "No products match these filters"}
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
