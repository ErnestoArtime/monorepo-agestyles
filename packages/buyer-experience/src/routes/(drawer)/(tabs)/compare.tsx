import { Colors } from "../../../constants/theme";
import { useRegion } from "../../../context/region-context";
import { useColorScheme } from "../../../hooks/use-color-scheme";
import { sdk } from "../../../config";
import {
  compareStoreProducts,
  type CatalogComparisonResponse,
} from "@agestyles/api-client/catalog-comparison";
import type { HttpTypes } from "@medusajs/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { buyerHref } from "../../../config";

const MAX_PRODUCTS = 4;
const ATTRIBUTE_WIDTH = 128;
const PRODUCT_WIDTH = 156;

export default function CompareProductsScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const router = useRouter();
  const { selectedRegion } = useRegion();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(productId ? [productId] : []);
  const [comparison, setComparison] = useState<CatalogComparisonResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (productId)
      setSelectedIds((current) => (current.includes(productId) ? current : [productId]));
  }, [productId]);

  useEffect(() => {
    let active = true;
    if (!selectedRegion) return;
    setLoadingProducts(true);
    sdk.store.product
      .list({
        region_id: selectedRegion.id,
        limit: 100,
        fields: "id,title,handle,thumbnail",
      })
      .then(({ products: fetched }) => {
        if (active) setProducts(fetched);
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el catálogo para elegir productos.");
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRegion]);

  const selectedKey = selectedIds.join(",");
  useEffect(() => {
    let active = true;
    const ids = selectedKey ? selectedKey.split(",") : [];
    if (ids.length < 2) {
      setComparison(null);
      setError("");
      setLoadingComparison(false);
      return;
    }
    setLoadingComparison(true);
    setError("");
    compareStoreProducts(sdk.client, ids)
      .then((result) => {
        if (active) setComparison(result);
      })
      .catch(() => {
        if (active) {
          setComparison(null);
          setError(
            "No se pudo comparar la selección. Puede que algún producto ya no esté publicado.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingComparison(false);
      });
    return () => {
      active = false;
    };
  }, [selectedKey]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds],
  );
  const candidates = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("es");
    return products.filter(
      (product) =>
        !selectedIds.includes(product.id) &&
        (!search || product.title.toLocaleLowerCase("es").includes(search)),
    );
  }, [products, query, selectedIds]);

  function toggleProduct(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= MAX_PRODUCTS) {
        setError("Puedes comparar hasta 4 productos.");
        return current;
      }
      setError("");
      return [...current, id];
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Comparar productos</Text>
      <Text style={[styles.intro, { color: colors.icon }]}>
        Selecciona de 2 a 4 productos para revisar sus características lado a lado.
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar un producto para añadir"
        placeholderTextColor={colors.icon}
        accessibilityLabel="Buscar producto para comparar"
        style={[
          styles.search,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
      {selectedProducts.length ? (
        <View style={styles.selectedList}>
          {selectedProducts.map((product) => (
            <View key={product.id} style={[styles.selectedRow, { borderColor: colors.border }]}>
              <Text style={[styles.selectedName, { color: colors.text }]} numberOfLines={2}>
                {product.title}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${product.title} de la comparación`}
                onPress={() => toggleProduct(product.id)}
                style={styles.removeButton}
              >
                <Text style={{ color: colors.tint }}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {selectedIds.length < MAX_PRODUCTS ? (
        <View style={styles.candidateSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Añadir producto</Text>
          {loadingProducts ? <Text style={{ color: colors.icon }}>Cargando productos…</Text> : null}
          {!loadingProducts && !candidates.length ? (
            <Text style={{ color: colors.icon }}>No hay más productos que coincidan.</Text>
          ) : null}
          {candidates.map((product) => (
            <TouchableOpacity
              key={product.id}
              accessibilityRole="button"
              accessibilityLabel={`Añadir ${product.title} a la comparación`}
              onPress={() => toggleProduct(product.id)}
              style={[styles.candidateRow, { borderColor: colors.border }]}
            >
              <Text style={[styles.candidateName, { color: colors.text }]}>{product.title}</Text>
              <Text style={{ color: colors.tint }}>Añadir</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
          {error}
        </Text>
      ) : null}
      {loadingComparison ? (
        <Text style={{ color: colors.icon }}>Preparando comparación…</Text>
      ) : null}
      {comparison && !loadingComparison ? (
        <View style={styles.resultSection}>
          {!comparison.comparison.compatibility.compatible ? (
            <Text
              style={[
                styles.notice,
                { color: colors.warning, backgroundColor: colors.cardBackground },
              ]}
            >
              {comparison.comparison.compatibility.reason === "family_missing"
                ? "Algún producto aún no tiene características técnicas registradas."
                : "Los productos pertenecen a fichas técnicas distintas."}
            </Text>
          ) : null}
          {!comparison.comparison.attributes.available &&
          comparison.comparison.compatibility.compatible ? (
            <Text
              style={[
                styles.notice,
                { color: colors.icon, backgroundColor: colors.cardBackground },
              ]}
            >
              No hay características comparables para esta selección.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableRow}>
                  <Text
                    style={[
                      styles.attributeCell,
                      styles.headerCell,
                      { color: colors.text, backgroundColor: colors.cardBackground },
                    ]}
                  >
                    Característica
                  </Text>
                  {comparison.products.map((product) => (
                    <Text
                      key={product.id}
                      style={[
                        styles.productCell,
                        styles.headerCell,
                        { color: colors.text, backgroundColor: colors.cardBackground },
                      ]}
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>
                  ))}
                </View>
                {comparison.comparison.attributes.rows.map((row) => (
                  <View key={row.key} style={styles.tableRow}>
                    <Text
                      style={[
                        styles.attributeCell,
                        { color: colors.icon, borderColor: colors.border },
                      ]}
                    >
                      {row.key.replace(/[_-]+/g, " ")}
                    </Text>
                    {comparison.products.map((product) => {
                      const value = row.values.find((item) => item.productId === product.id)?.value;
                      return (
                        <Text
                          key={product.id}
                          style={[
                            styles.productCell,
                            { color: colors.text, borderColor: colors.border },
                          ]}
                        >
                          {value || "—"}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        onPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace(buyerHref("/(drawer)/(tabs)/(home)") as any)
        }
        style={styles.backButton}
      >
        <Text style={{ color: colors.tint }}>Volver al producto</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "600", letterSpacing: -0.4 },
  intro: { fontSize: 14, lineHeight: 21 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14 },
  selectedList: { gap: 8 },
  selectedRow: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedName: { flex: 1, fontSize: 14, fontWeight: "500" },
  removeButton: { minWidth: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  candidateSection: { gap: 4, marginTop: 8 },
  sectionTitle: { marginBottom: 6, fontSize: 17, fontWeight: "600" },
  candidateRow: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  candidateName: { flex: 1, fontSize: 14 },
  error: { fontSize: 13, lineHeight: 19 },
  resultSection: { gap: 12, marginTop: 8 },
  notice: { padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 19, overflow: "hidden" },
  tableRow: { flexDirection: "row" },
  attributeCell: {
    width: ATTRIBUTE_WIDTH,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    textTransform: "capitalize",
    fontSize: 12,
  },
  productCell: {
    width: PRODUCT_WIDTH,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    lineHeight: 19,
  },
  headerCell: {
    minHeight: 56,
    justifyContent: "center",
    fontWeight: "600",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { minHeight: 48, justifyContent: "center", alignSelf: "flex-start", marginTop: 12 },
});
