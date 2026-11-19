import { Icon } from "@agestyles/icons";
import { useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLockup } from "./brand-lockup";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { CONTENT_MAX } from "../hooks/use-responsive";
import { androidApkUrl, buyerHref, buyerPath } from "../config";

const HOME = "/(drawer)/(tabs)/(home)";

/** Website footer for wide browsers: site map, account links and the Android app. */
export function WebFooter() {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const apkUrl = androidApkUrl();

  const link = (label: string, href: Href) => (
    <Pressable key={label} onPress={() => router.push(href)} accessibilityRole="link">
      {({ hovered }: { hovered?: boolean; pressed: boolean }) => (
        <Text style={[styles.link, hovered && styles.linkHover]}>{label}</Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.footer} role="contentinfo">
      <View style={styles.inner}>
        <View style={styles.about}>
          <BrandLockup />
          <Text style={styles.text}>
            Productos de distintas tiendas en un solo lugar. Compara ofertas y compra con envío o
            recogida.
          </Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.heading}>Comprar</Text>
          {link("Inicio", buyerHref(HOME))}
          {link("Todos los productos", {
            pathname: buyerPath(HOME),
            params: { filtro: "todos" },
          } as Href)}
          {link("Novedades", {
            pathname: buyerPath(HOME),
            params: { filtro: "novedades" },
          } as Href)}
          {link("Tiendas", buyerHref("/stores"))}
        </View>
        <View style={styles.column}>
          <Text style={styles.heading}>Tu cuenta</Text>
          {link("Favoritos", buyerHref("/(drawer)/(tabs)/favorites"))}
          {link("Mis pedidos", buyerHref("/(drawer)/(tabs)/account/orders"))}
          {link("Carrito", buyerHref("/(drawer)/(tabs)/(cart)"))}
        </View>
        {apkUrl ? (
          <View style={styles.column}>
            <Text style={styles.heading}>App para Android</Text>
            <Pressable
              onPress={() => void Linking.openURL(apkUrl)}
              accessibilityRole="link"
              style={styles.app}
            >
              <Icon name="phone" size={18} color={colors.tint} />
              <Text style={[styles.link, { color: colors.tint }]}>Descargar AgeStyles 1.3.0</Text>
            </Pressable>
            <Text style={styles.small}>Android 7.0 o superior</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.inner, styles.legal]}>
        <Text style={styles.small}>
          © {new Date().getFullYear()} AgeStyles · Fase piloto: los pedidos son reales; si algo
          falla, avísanos.
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: (typeof Colors)[keyof typeof Colors]) =>
  StyleSheet.create({
    footer: {
      marginTop: 48,
      paddingTop: 36,
      paddingBottom: 28,
      backgroundColor: colors.cardBackground,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 28,
    },
    inner: {
      width: "100%",
      maxWidth: CONTENT_MAX,
      alignSelf: "center",
      paddingHorizontal: 16,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 40,
    },
    about: { flexBasis: 300, flexGrow: 1, gap: 12 },
    column: { minWidth: 160, gap: 10 },
    heading: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    text: { color: colors.icon, fontSize: 14, lineHeight: 21, maxWidth: 360 },
    link: { color: colors.icon, fontSize: 14 },
    linkHover: { color: colors.text, textDecorationLine: "underline" },
    app: { flexDirection: "row", alignItems: "center", gap: 8 },
    small: { color: colors.icon, fontSize: 12 },
    legal: {
      paddingTop: 18,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
