// web-sidebar.tsx — Sidebar fijo de la Tienda en web ancha (NUEVO)
// REVISIÓN PRECISA (2026-11-22, commit deb0e37 del monorepo):
// Archivo nuevo en packages/buyer-experience/src/components/web-sidebar.tsx.
// Hoy NO existe ningún sidebar en Tienda: en web ancha se usa la barra
// superior (web-top-bar.tsx) y en móvil/APK el drawer (drawer-content.tsx).
// Este componente es React Native + Expo Router + StyleSheet + tokens de
// @agestyles/design-tokens (vía Colors en ../constants/theme.ts), con
// <Icon name="…"> de @agestyles/icons y SearchField de @agestyles/ui-native.
// NO es Next.js, NO usa Tailwind ni className, NO importa lucide-react
// directo (eso solo vive dentro de packages/icons).
//
// PENDIENTE: este sidebar NO está conectado todavía. Para conectarlo hay
// que tocar packages/buyer-experience/src/routes/(drawer)/_layout.tsx:
// en web ancha, renderizar <WebSidebar /> junto al Drawer en vez de (o
// debajo de) <WebTopBar />. Ese cambio afecta a la vez a apps/buyer-app
// y a apps/business-app/app/tienda, porque ambas re-exportan este paquete
// (config.ts: la Tienda se monta en "/" en buyer-app y en "/tienda" en
// business-app; buyerHref/buyerPathname ya resuelven ese prefijo).
// Cambiar el layout es un cambio de UX mayor y queda fuera de este paso.
//
// Búsqueda cableada: pasa el texto como parámetro q a la home, que lo lee
// con useLocalSearchParams y busca en el servidor (query.q).
// Secciones reales (máx. 5, como pide el reel), verificadas en
// src/routes/(drawer)/(tabs)/_layout.tsx:
//   Inicio/Catálogo, Tiendas, Favoritos, Carrito (badge real: suma de
//   cantidades del carrito, como en web-top-bar.tsx), Cuenta.
// "Mis pedidos" queda dentro de Cuenta, no como 6ª sección; "Novedades"
// es un filtro de la home, no una sección; "/ofertas", "/ajustes" y
// "/soporte" NO existen en el repo, por eso no aparecen.
// Pie real: Mis pedidos y Notificaciones (rutas que sí existen).
// Avatar: iniciales de 32 px, como en el reel; no hay foto de avatar
// del cliente en customer-context (solo first_name/last_name/email).
// Móvil: en móvil no hay sidebar fijo; el drawer + tab bar se quedan
// como están, y el drawer lleva su propia búsqueda (drawer-content.tsx).

import { Icon, type IconName } from "@agestyles/icons";
import { SearchField } from "@agestyles/ui-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { buyerExit, buyerHref, buyerPathname } from "../config";
import { Colors } from "../constants/theme";
import { useCart } from "../context/cart-context";
import { useCustomer } from "../context/customer-context";
import { useColorScheme } from "../hooks/use-color-scheme";
import { BrandLockup } from "./brand-lockup";

type Item = {
  label: string;
  icon: IconName;
  href: Href;
  match: (path: string) => boolean;
  badge?: number;
};

const HOME = "/(drawer)/(tabs)/(home)";

export function WebSidebar() {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const pathname = buyerPathname(usePathname());
  const exit = buyerExit();
  const { cart } = useCart();
  const { customer } = useCustomer();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  // Badge real del carrito: suma de cantidades, como en web-top-bar.tsx
  // (el tab bar usa cart.items.length; aquí se usa la suma, que coincide
  // con el storefront-web y con lo que el cliente espera pagar).
  const cartCount =
    cart?.items?.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0) ?? 0;

  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  const customerInitials = (
    customerName
      ? customerName
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
      : (customer?.email?.[0] ?? "?")
  ).toUpperCase();

  // Atajo web: Ctrl/Cmd+K o "/" enfoca la búsqueda, Esc la suelta.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar productos"]')?.focus();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar productos"]')?.focus();
      } else if (event.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmitSearch = () => {
    // La búsqueda pasa el texto por ruta: la home lee q con
    // useLocalSearchParams y busca en el servidor (query.q).
    router.push(buyerHref({ pathname: HOME, params: { q: query.trim() } }));
  };

  const navItems: Item[] = [
    {
      label: "Inicio",
      icon: "home",
      href: buyerHref(HOME),
      match: (p) => p === "/" || p === "" || p.includes("/(home)"),
    },
    {
      label: "Tiendas",
      icon: "store",
      href: buyerHref("/(drawer)/(tabs)/stores"),
      match: (p) => p.includes("/stores"),
    },
    {
      label: "Favoritos",
      icon: "heart",
      href: buyerHref("/(drawer)/(tabs)/favorites"),
      match: (p) => p.includes("/favorites"),
    },
    {
      label: "Carrito",
      icon: "shoppingCart",
      href: buyerHref("/(drawer)/(tabs)/(cart)"),
      match: (p) => p.includes("/(cart)"),
      badge: cartCount,
    },
    {
      label: "Cuenta",
      icon: "user",
      href: buyerHref("/(drawer)/(tabs)/account"),
      match: (p) => p.includes("/account"),
    },
  ];

  const footerItems: Item[] = [
    {
      label: "Mis pedidos",
      icon: "list",
      href: buyerHref("/(drawer)/(tabs)/account/orders"),
      match: (p) => p.includes("/account/orders"),
    },
    {
      label: "Notificaciones",
      icon: "bell",
      href: buyerHref("/notifications"),
      match: (p) => p.includes("/notifications"),
    },
  ];

  const renderItem = (item: Item) => {
    const active = item.match(pathname);
    const badge = item.badge ?? 0;
    return (
      <Pressable
        key={item.label}
        onPress={() => router.push(item.href)}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        accessibilityLabel={
          collapsed ? (badge > 0 ? `${item.label}, ${badge} artículos` : item.label) : undefined
        }
        style={({ hovered }: { hovered?: boolean }) => [
          styles.item,
          collapsed && styles.itemCollapsed,
          active && styles.itemActive,
          hovered && !active && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        <View>
          <Icon name={item.icon} size={18} color={active ? colors.tint : colors.icon} />
          {collapsed && badge > 0 ? <View style={styles.badgeDot} /> : null}
        </View>
        {collapsed ? null : (
          <>
            <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
              {item.label}
            </Text>
            {badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge > 99 ? "99+" : String(badge)}</Text>
              </View>
            ) : null}
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}
      role="navigation"
      accessibilityLabel="Menú de la Tienda"
    >
      <View style={styles.top}>
        {collapsed ? null : <BrandLockup />}
        <Pressable
          onPress={() => setCollapsed((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Expandir menú" : "Colapsar menú"}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.collapseButton,
            hovered && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          {/* No hay chevronLeft en @agestyles/icons: se usan arrowLeft/arrowRight. */}
          <Icon name={collapsed ? "arrowRight" : "arrowLeft"} size={18} color={colors.icon} />
        </Pressable>
      </View>

      {collapsed ? null : (
        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar productos"
            accessibilityLabel="Buscar productos"
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
        </View>
      )}

      {exit && !collapsed ? (
        <Pressable
          onPress={() => router.replace(exit.href)}
          accessibilityRole="link"
          style={({ hovered }: { hovered?: boolean }) => [
            styles.exit,
            hovered && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Icon name="store" size={18} color={colors.icon} />
          <Text style={styles.itemText} numberOfLines={1}>
            {exit.label}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.nav}>{navItems.map(renderItem)}</View>

      <View style={styles.bottom}>
        {footerItems.map(renderItem)}
        <View style={styles.divider} />
        <Pressable
          onPress={() => router.push(buyerHref("/(drawer)/(tabs)/account"))}
          accessibilityRole="link"
          accessibilityLabel={collapsed ? "Mi cuenta" : undefined}
          style={[styles.account, collapsed && styles.accountCollapsed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customerInitials}</Text>
          </View>
          {collapsed ? null : (
            <View style={styles.flex}>
              <Text style={styles.accountName} numberOfLines={1}>
                {customerName || "Mi cuenta"}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {customer?.email ?? "Inicia sesión para ver tus pedidos"}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: (typeof Colors)["light"]) =>
  StyleSheet.create({
    sidebar: {
      width: 260,
      backgroundColor: colors.cardBackground,
      borderRightColor: colors.border,
      borderRightWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 12,
    },
    sidebarCollapsed: { width: 72, paddingHorizontal: 8 },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      minHeight: 44,
    },
    collapseButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    searchWrap: { marginTop: 12 },
    exit: {
      marginTop: 12,
      minHeight: 40,
      borderRadius: 8,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    nav: { marginTop: 12, gap: 2 },
    item: {
      minHeight: 40,
      borderRadius: 8,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    itemCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
    itemActive: { backgroundColor: colors.surfaceMuted },
    itemText: { flex: 1, color: colors.text, fontSize: 14 },
    itemTextActive: { color: colors.tint, fontWeight: "600" },
    badge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.onError, fontSize: 11, fontWeight: "700" },
    badgeDot: {
      position: "absolute",
      top: -2,
      right: -4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
    },
    bottom: {
      marginTop: "auto",
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 8,
      gap: 2,
    },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    accountCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.tint, fontSize: 13, fontWeight: "700" },
    accountName: { color: colors.text, fontSize: 15, fontWeight: "600" },
    muted: { color: colors.icon, fontSize: 12, marginTop: 2 },
    flex: { flex: 1 },
  });
