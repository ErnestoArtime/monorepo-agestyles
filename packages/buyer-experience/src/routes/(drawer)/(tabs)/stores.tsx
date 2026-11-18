import { Icon } from "@agestyles/icons";
import { Colors } from "../../../constants/theme";
import { useColorScheme } from "../../../hooks/use-color-scheme";
import { sdk } from "../../../config";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buyerPath } from "../../../config";

type Store = {
  id: string;
  name: string;
  handle?: string | null;
  description?: string | null;
  logo?: string | null;
};

/** Store directory, as in the legacy catalog's «Tiendas». Opens the store's products in the catalog. */
export default function StoresScreen() {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { sellers } = await sdk.client.fetch<{ sellers: Store[] }>("/store/sellers", {
        query: { limit: 100, fields: "id,name,handle,description,logo" },
      });
      setStores([...sellers].sort((a, b) => a.name.localeCompare(b.name, "es")));
    } catch {
      setError("No se pudieron cargar las tiendas. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stores.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={stores}
      keyExtractor={(store) => store.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.tint} />
      }
      ListHeaderComponent={
        error ? (
          <Pressable onPress={load} accessibilityRole="button" style={styles.message}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.retry}>Reintentar</Text>
          </Pressable>
        ) : null
      }
      ListEmptyComponent={
        !error ? <Text style={styles.empty}>Todavía no hay tiendas publicadas.</Text> : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: buyerPath("/(drawer)/(tabs)/(home)"),
              params: { filtro: "tienda", tienda: item.id, nombre: item.name },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Ver los productos de ${item.name}`}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        >
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Icon name="store" size={22} color={colors.tint} />
            </View>
          )}
          <View style={styles.text}>
            <Text style={styles.name}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <Icon name="chevronRight" size={20} color={colors.icon} />
        </Pressable>
      )}
    />
  );
}

const createStyles = (colors: (typeof Colors)[keyof typeof Colors]) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 12 },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    card: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    logo: { width: 48, height: 48, borderRadius: 12 },
    logoFallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    text: { flex: 1, gap: 4 },
    name: { color: colors.text, fontSize: 16, fontWeight: "600" },
    description: { color: colors.icon, fontSize: 13 },
    message: { gap: 6, marginBottom: 12 },
    error: { color: colors.text, fontSize: 14 },
    retry: { color: colors.tint, fontSize: 14, fontWeight: "600" },
    empty: { color: colors.icon, fontSize: 14, textAlign: "center", marginTop: 24 },
  });
