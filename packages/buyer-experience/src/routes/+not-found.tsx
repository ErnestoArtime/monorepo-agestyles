import { Icon } from "@agestyles/icons";
import { Link, Stack, type Href } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { buyerHref } from "../config";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";

/** Unknown address in Tienda: a Spanish page with the way back, never Expo's default. */
export default function NotFoundScreen() {
  const colors = Colors[useColorScheme() ?? "light"];
  return (
    <>
      <Stack.Screen options={{ title: "Página no encontrada" }} />
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Icon name="search" size={30} color={colors.tint} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Esta página no existe
          </Text>
          <Text style={[styles.body, { color: colors.icon }]}>
            Puede que el enlace esté mal escrito o que el producto ya no esté disponible.
          </Text>
          <Link
            href={buyerHref("/(drawer)/(tabs)/(home)") as Href}
            style={[styles.primary, { backgroundColor: colors.tint, color: colors.onTint }]}
          >
            Ir al inicio
          </Link>
          <Link
            href={
              {
                pathname: buyerHref("/(drawer)/(tabs)/(home)"),
                params: { filtro: "todos" },
              } as unknown as Href
            }
            style={[styles.link, { color: colors.tint }]}
          >
            Ver todos los productos
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  panel: {
    width: "100%",
    maxWidth: 440,
    padding: 28,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  primary: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 11,
    fontSize: 15,
    fontWeight: "600",
    overflow: "hidden",
  },
  link: { fontSize: 14, fontWeight: "600", paddingVertical: 6 },
});
