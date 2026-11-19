import { Icon, type IconName } from "@agestyles/icons";
import { usePathname, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLockup } from "./brand-lockup";
import { NotificationHeaderBell } from "./notification-header-bell";
import { Colors } from "../constants/theme";
import { useCart } from "../context/cart-context";
import { useCustomer } from "../context/customer-context";
import { useThemePreference, type ThemePreference } from "../context/theme-preference";
import { useColorScheme } from "../hooks/use-color-scheme";
import { CONTENT_MAX } from "../hooks/use-responsive";
import { useTopCategories } from "../hooks/use-top-categories";
import { buyerExit, buyerHref, buyerPath, buyerPathname } from "../config";

const HOME = "/(drawer)/(tabs)/(home)";

const NEXT_THEME: Record<
  ThemePreference,
  { next: ThemePreference; icon: IconName; label: string }
> = {
  system: { next: "light", icon: "monitor", label: "Tema del sistema (cambiar a claro)" },
  light: { next: "dark", icon: "sun", label: "Tema claro (cambiar a oscuro)" },
  dark: { next: "system", icon: "moon", label: "Tema oscuro (usar el del sistema)" },
};

/**
 * Website navigation for wide browsers: brand, pages, categories and the shop actions
 * (favourites, cart, account) that the app keeps in its tab bar and side menu.
 */
export function WebTopBar() {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const exit = buyerExit();
  // Pathname as Tienda sees it, also when the store is mounted inside Negocio.
  const pathname = buyerPathname(usePathname());
  const { cart } = useCart();
  const { customer, logout } = useCustomer();
  const { preference, setPreference } = useThemePreference();
  const categories = useTopCategories();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Escape closes the categories menu, as in any website dropdown.
  useEffect(() => {
    if (!(categoriesOpen || accountOpen) || Platform.OS !== "web" || typeof window === "undefined")
      return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCategoriesOpen(false);
      setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountOpen, categoriesOpen]);

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
  const openAccount = (target: Href) => {
    setAccountOpen(false);
    router.push(target);
  };

  const openCategory = (category: (typeof categories)[number]) => {
    setCategoriesOpen(false);
    router.push({
      pathname: buyerPath(HOME),
      params: { filtro: "categoria", nombre: category.name, ids: category.ids.join(",") },
    } as Href);
  };
  const itemCount = cart?.items?.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0) ?? 0;
  const theme = NEXT_THEME[preference];

  const link = (label: string, href: Href, active: boolean) => (
    <Pressable
      key={label}
      onPress={() => router.push(href)}
      accessibilityRole="link"
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.link,
        (hovered || pressed) && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <Text style={[styles.linkText, active && styles.linkActive]}>{label}</Text>
    </Pressable>
  );

  const action = (
    label: string,
    icon: IconName,
    onPress: () => void,
    options: { badge?: number; text?: string } = {},
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.action,
        (hovered || pressed) && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View>
        <Icon name={icon} size={20} color={colors.text} />
        {options.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{options.badge > 99 ? "99+" : options.badge}</Text>
          </View>
        ) : null}
      </View>
      {options.text ? <Text style={styles.actionText}>{options.text}</Text> : null}
    </Pressable>
  );

  const atHome = pathname === "/" || pathname === "";

  return (
    <View style={styles.bar} accessibilityRole="header">
      {categoriesOpen || accountOpen ? (
        // Click anywhere outside the menu to close it.
        <Pressable
          accessibilityLabel="Cerrar menú"
          onPress={() => {
            setCategoriesOpen(false);
            setAccountOpen(false);
          }}
          style={styles.backdrop}
        />
      ) : null}
      <View style={styles.inner}>
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push(buyerHref(HOME))}
            accessibilityRole="link"
            accessibilityLabel="AgeStyles, ir al inicio"
            style={styles.brand}
          >
            <BrandLockup />
          </Pressable>
          <View style={styles.nav} role="navigation">
            {link("Inicio", buyerHref(HOME), atHome)}
            {link(
              "Todos los productos",
              { pathname: buyerPath(HOME), params: { filtro: "todos" } } as Href,
              false,
            )}
            {categories.length ? (
              <View style={styles.dropdownHost}>
                <Pressable
                  onPress={() => setCategoriesOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel="Categorías"
                  accessibilityState={{ expanded: categoriesOpen }}
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.link,
                    styles.dropdownTrigger,
                    (hovered || pressed || categoriesOpen) && {
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.linkText, categoriesOpen && styles.linkActive]}>
                    Categorías
                  </Text>
                  <Icon name="chevronDown" size={16} color={colors.icon} />
                </Pressable>
                {categoriesOpen ? (
                  <View style={styles.dropdown} accessibilityLabel="Categorías de productos">
                    {categories.map((category) => (
                      <Pressable
                        key={category.id}
                        onPress={() => openCategory(category)}
                        accessibilityRole="link"
                        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
                          styles.dropdownItem,
                          hovered && { backgroundColor: colors.surfaceMuted },
                        ]}
                      >
                        <Text style={styles.dropdownText}>{category.name}</Text>
                        <Icon name="chevronRight" size={16} color={colors.icon} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {link(
              "Novedades",
              { pathname: buyerPath(HOME), params: { filtro: "novedades" } } as Href,
              false,
            )}
            {link("Tiendas", buyerHref("/stores"), pathname.startsWith("/stores"))}
          </View>
          <View style={styles.actions}>
            {exit
              ? // Inside Negocio (AG-31): back to the managed store, keeping both sessions.
                action(exit.label, "store", () => router.replace(exit.href), { text: exit.label })
              : null}
            {action(theme.label, theme.icon, () => setPreference(theme.next))}
            <NotificationHeaderBell />
            {action("Favoritos", "heart", () =>
              router.push(buyerHref("/(drawer)/(tabs)/favorites") as Href),
            )}
            {customer ? (
              // Signed in: who you are, and your account pages, as on any shop website.
              <View style={styles.dropdownHost}>
                <Pressable
                  onPress={() => {
                    setCategoriesOpen(false);
                    setAccountOpen((open) => !open);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Tu cuenta: ${customerName || customer.email}`}
                  accessibilityState={{ expanded: accountOpen }}
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.action,
                    (hovered || pressed || accountOpen) && {
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{customerInitials}</Text>
                  </View>
                  <Text style={styles.actionText} numberOfLines={1}>
                    {customer.first_name || "Mi cuenta"}
                  </Text>
                  <Icon name="chevronDown" size={16} color={colors.icon} />
                </Pressable>
                {accountOpen ? (
                  <View style={[styles.dropdown, styles.accountMenu]}>
                    <View style={styles.accountHead}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {customerName || "Tu cuenta"}
                      </Text>
                      <Text style={styles.accountEmail} numberOfLines={1}>
                        {customer.email}
                      </Text>
                    </View>
                    {(
                      [
                        ["Mi cuenta", "user", buyerHref("/(drawer)/(tabs)/account")],
                        ["Mis compras", "package", buyerHref("/(drawer)/(tabs)/account/orders")],
                        [
                          "Direcciones de entrega",
                          "mapPin",
                          {
                            pathname: buyerPath("/(drawer)/(tabs)/account"),
                            params: { seccion: "direcciones" },
                          } as Href,
                        ],
                        ["Favoritos", "heart", buyerHref("/(drawer)/(tabs)/favorites")],
                        ["Notificaciones", "bell", buyerHref("/notifications")],
                      ] as [string, IconName, Href][]
                    ).map(([label, icon, href]) => (
                      <Pressable
                        key={label}
                        onPress={() => openAccount(href)}
                        accessibilityRole="link"
                        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
                          styles.dropdownItem,
                          styles.menuItem,
                          hovered && { backgroundColor: colors.surfaceMuted },
                        ]}
                      >
                        <Icon name={icon} size={18} color={colors.icon} />
                        <Text style={[styles.dropdownText, styles.flex]}>{label}</Text>
                      </Pressable>
                    ))}
                    <View style={styles.menuSeparator} />
                    <Pressable
                      onPress={() => {
                        setAccountOpen(false);
                        void logout().catch(() => undefined);
                      }}
                      accessibilityRole="button"
                      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
                        styles.dropdownItem,
                        styles.menuItem,
                        hovered && { backgroundColor: colors.surfaceMuted },
                      ]}
                    >
                      <Icon name="arrowLeft" size={18} color={colors.icon} />
                      <Text style={[styles.dropdownText, styles.flex]}>Cerrar sesión</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              action(
                "Iniciar sesión",
                "user",
                () => router.push(buyerHref("/(drawer)/(tabs)/account/login")),
                { text: "Entrar" },
              )
            )}
            {action(
              itemCount ? `Carrito, ${itemCount} artículos` : "Carrito",
              "shoppingCart",
              () => router.push(buyerHref("/(drawer)/(tabs)/(cart)") as Href),
              { badge: itemCount, text: "Carrito" },
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: (typeof Colors)[keyof typeof Colors]) =>
  StyleSheet.create({
    bar: {
      position: "relative",
      zIndex: 10,
      backgroundColor: colors.cardBackground,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    inner: {
      width: "100%",
      maxWidth: CONTENT_MAX,
      alignSelf: "center",
      paddingHorizontal: 16,
      zIndex: 30,
    },
    row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 24 },
    brand: { paddingVertical: 8 },
    nav: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
    link: { minHeight: 40, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
    linkText: { color: colors.icon, fontSize: 15, fontWeight: "500" },
    linkActive: { color: colors.text, fontWeight: "700" },
    actions: { flexDirection: "row", alignItems: "center", gap: 4 },
    action: {
      minHeight: 40,
      minWidth: 40,
      paddingHorizontal: 10,
      borderRadius: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    actionText: { color: colors.text, fontSize: 14, fontWeight: "500" },
    badge: {
      position: "absolute",
      top: -6,
      right: -9,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.tint,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.onTint, fontSize: 11, fontWeight: "700" },
    dropdownHost: { position: "relative", zIndex: 30 },
    dropdownTrigger: { flexDirection: "row", alignItems: "center", gap: 6 },
    dropdown: {
      position: "absolute",
      top: 46,
      left: 0,
      minWidth: 260,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    dropdownItem: {
      minHeight: 44,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    dropdownText: { color: colors.text, fontSize: 15 },
    flex: { flex: 1 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.tint,
    },
    avatarText: { color: colors.onTint, fontSize: 12, fontWeight: "700" },
    accountMenu: { left: undefined, right: 0, minWidth: 260 },
    accountHead: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      gap: 2,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      marginBottom: 4,
    },
    accountName: { color: colors.text, fontSize: 15, fontWeight: "700" },
    accountEmail: { color: colors.icon, fontSize: 13 },
    menuItem: { justifyContent: "flex-start", gap: 12 },
    menuSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    backdrop: {
      // Fixed on web so it covers the page under the bar, not only the bar.
      position: (Platform.OS === "web" ? "fixed" : "absolute") as "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
    },
  });
