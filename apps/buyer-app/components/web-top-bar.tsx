import { Icon, type IconName } from "@agestyles/icons";
import { usePathname, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLockup } from "@/components/brand-lockup";
import { NotificationHeaderBell } from "@/components/notification-header-bell";
import { Colors } from "@/constants/theme";
import { useCart } from "@/context/cart-context";
import { useCustomer } from "@/context/customer-context";
import { useThemePreference, type ThemePreference } from "@/context/theme-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CONTENT_MAX } from "@/hooks/use-responsive";
import { useTopCategories } from "@/hooks/use-top-categories";

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
  const pathname = usePathname();
  const { cart } = useCart();
  const { customer } = useCustomer();
  const { preference, setPreference } = useThemePreference();
  const categories = useTopCategories();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Escape closes the categories menu, as in any website dropdown.
  useEffect(() => {
    if (!categoriesOpen || Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setCategoriesOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [categoriesOpen]);

  const openCategory = (category: (typeof categories)[number]) => {
    setCategoriesOpen(false);
    router.push({
      pathname: HOME,
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
      {categoriesOpen ? (
        // Click anywhere outside the menu to close it.
        <Pressable
          accessibilityLabel="Cerrar menú de categorías"
          onPress={() => setCategoriesOpen(false)}
          style={styles.backdrop}
        />
      ) : null}
      <View style={styles.inner}>
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push(HOME as Href)}
            accessibilityRole="link"
            accessibilityLabel="AgeStyles, ir al inicio"
            style={styles.brand}
          >
            <BrandLockup />
          </Pressable>
          <View style={styles.nav} role="navigation">
            {link("Inicio", HOME as Href, atHome)}
            {link(
              "Todos los productos",
              { pathname: HOME, params: { filtro: "todos" } } as Href,
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
                        style={({ hovered }: { hovered?: boolean }) => [
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
            {link("Novedades", { pathname: HOME, params: { filtro: "novedades" } } as Href, false)}
            {link("Tiendas", "/stores" as Href, pathname.startsWith("/stores"))}
          </View>
          <View style={styles.actions}>
            {action(theme.label, theme.icon, () => setPreference(theme.next))}
            <NotificationHeaderBell />
            {action("Favoritos", "heart", () => router.push("/(drawer)/(tabs)/favorites" as Href))}
            {action(
              customer ? "Mi cuenta" : "Iniciar sesión",
              "user",
              () =>
                router.push(
                  (customer
                    ? "/(drawer)/(tabs)/account"
                    : "/(drawer)/(tabs)/account/login") as Href,
                ),
              { text: customer ? "Mi cuenta" : "Entrar" },
            )}
            {action(
              itemCount ? `Carrito, ${itemCount} artículos` : "Carrito",
              "shoppingCart",
              () => router.push("/(drawer)/(tabs)/(cart)" as Href),
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
