import { mediaVariant } from "@agestyles/api-client/media";
import type { FollowedStore } from "@agestyles/api-client/store-follows";
import { Icon } from "@agestyles/icons";
import { Button, useUiTheme } from "@agestyles/ui-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buyerHref, buyerPath } from "../config";
import { useFollows } from "../context/follows-context";
import { CONTENT_MAX, useResponsive } from "../hooks/use-responsive";
import { FollowStoreButton, StoreAlertSwitch } from "./follow-store-button";
import { SignedOutNotice } from "./signed-out-notice";

/** Favoritos → «Tiendas»: the stores the customer follows, each with its new-product alert. */
export function FollowedStores() {
  const { color } = useUiTheme();
  const router = useRouter();
  const { isWideWeb } = useResponsive();
  const { follows, phase, signedIn, reload } = useFollows();

  if (!signedIn) {
    return (
      <SignedOutNotice
        title="Sigue a tus tiendas"
        description="Inicia sesión para seguir tiendas y recibir un aviso cuando publiquen productos nuevos."
      />
    );
  }

  const openStore = (store: FollowedStore) =>
    router.push({
      pathname: buyerPath("/(drawer)/(tabs)/(home)"),
      params: { filtro: "tienda", tienda: store.seller_id, nombre: store.name },
    });

  const loading = phase === "idle" || phase === "loading";

  return (
    <FlatList
      data={follows}
      keyExtractor={(store) => store.seller_id}
      contentContainerStyle={[
        follows.length ? styles.list : styles.emptyList,
        isWideWeb && styles.wide,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={phase === "loading" && follows.length > 0}
          onRefresh={() => void reload()}
          tintColor={color.action}
        />
      }
      ListEmptyComponent={
        <View style={styles.state} accessibilityLiveRegion="polite">
          {loading ? (
            <>
              <ActivityIndicator color={color.action} />
              <Text style={[styles.stateText, { color: color.muted }]}>Cargando tus tiendas…</Text>
            </>
          ) : phase === "error" ? (
            <>
              <Text style={[styles.stateText, { color: color.text }]}>
                No se pudieron cargar tus tiendas.
              </Text>
              <Button title="Reintentar" variant="secondary" onPress={() => void reload()} />
            </>
          ) : (
            <>
              <Icon name="store" size={32} color={color.muted} />
              <Text style={[styles.stateText, { color: color.muted }]}>
                Todavía no sigues ninguna tienda. Síguelas para encontrarlas aquí y, si quieres,
                enterarte de sus productos nuevos.
              </Text>
              <Button
                title="Ver tiendas"
                onPress={() => router.push(buyerHref("/(drawer)/(tabs)/stores"))}
              />
            </>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
          <Pressable
            onPress={() => openStore(item)}
            accessibilityRole="link"
            accessibilityLabel={`Ver la tienda ${item.name}`}
            style={styles.head}
          >
            <View style={[styles.logo, { backgroundColor: color.border }]}>
              {item.logo ? (
                <Image
                  source={{ uri: mediaVariant(item.logo, 400) }}
                  style={styles.fill}
                  contentFit="cover"
                />
              ) : (
                <Icon name="store" size={22} color={color.action} />
              )}
            </View>
            <Text style={[styles.name, { color: color.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Icon name="chevronRight" size={18} color={color.muted} />
          </Pressable>
          <StoreAlertSwitch store={{ id: item.seller_id, name: item.name }} />
          <FollowStoreButton
            store={{ id: item.seller_id, name: item.name, logo: item.logo, handle: item.handle }}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, padding: 20 },
  wide: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },
  state: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 14 },
  stateText: { maxWidth: 300, textAlign: "center", fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: { width: "100%", height: "100%" },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
});
