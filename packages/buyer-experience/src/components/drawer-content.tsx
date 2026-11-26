import { Icon, type IconName } from "@agestyles/icons";
import { SearchField } from "@agestyles/ui-native";
import { DrawerContentComponentProps, DrawerContentScrollView } from "@react-navigation/drawer";
import { useRouter, type Href } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants/theme";
import { useCustomer } from "../context/customer-context";
import { useHasCountryChoice } from "../context/region-context";
import { useThemePreference, type ThemePreference } from "../context/theme-preference";
import { useColorScheme } from "../hooks/use-color-scheme";
import { useTopCategories } from "../hooks/use-top-categories";
import { RegionSelector } from "./region-selector";
import { buyerExit, buyerHref, buyerPath } from "../config";

const HOME = "/(drawer)/(tabs)/(home)";

/** Same menu as the legacy catalog: pages, categories, appearance and account. */
export function DrawerContent(props: DrawerContentComponentProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const exit = buyerExit();
  const { customer } = useCustomer();
  const { preference, setPreference } = useThemePreference();
  const hasCountryChoice = useHasCountryChoice();
  const topCategories = useTopCategories();
  // Búsqueda del drawer (móvil): la home lee q con useLocalSearchParams
  // y busca en el servidor, igual que la búsqueda del sidebar web.
  const [query, setQuery] = useState("");
  // Main categories open in place (several at once) without closing the menu.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCategory = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function go(href: Href) {
    props.navigation.closeDrawer();
    router.push(href);
  }

  const submitSearch = () => {
    go(buyerHref({ pathname: HOME, params: { q: query.trim() } }));
  };

  const item = (label: string, onPress: () => void, icon?: Parameters<typeof Icon>[0]["name"]) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.icon} /> : null}
      <Text style={styles.itemText}>{label}</Text>
    </Pressable>
  );

  const themes: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: "system", label: "Tema del sistema", icon: "monitor" },
    { value: "light", label: "Tema claro", icon: "sun" },
    { value: "dark", label: "Tema oscuro", icon: "moon" },
  ];

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Menú principal
        </Text>

        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar productos"
            accessibilityLabel="Buscar productos"
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
        </View>

        {exit ? (
          // Inside Negocio (AG-31): back to the managed store, keeping both sessions.
          <View style={styles.section}>
            {item(
              exit.label,
              () => {
                props.navigation.closeDrawer();
                router.replace(exit.href);
              },
              "store",
            )}
          </View>
        ) : null}

        <View style={styles.section} accessibilityLabel="Páginas del sitio">
          {item("Inicio", () => go(buyerHref(HOME)), "home")}
          {item(
            "Todos los productos",
            () => go({ pathname: buyerPath(HOME), params: { filtro: "todos" } }),
            "list",
          )}
          {item(
            "Novedades",
            () => go({ pathname: buyerPath(HOME), params: { filtro: "novedades" } }),
            "bell",
          )}
          {item("Tiendas", () => go(buyerHref("/stores")), "store")}
        </View>

        {topCategories.length ? (
          <View style={styles.section} accessibilityLabel="Categorías de productos">
            <Text style={styles.heading}>Categorías</Text>
            {topCategories.map((category) => {
              const hasChildren = category.children.length > 0;
              const isOpen = expanded.has(category.id);
              const filterBy = (target: { name: string; ids: string[] }) =>
                go({
                  pathname: buyerPath(HOME),
                  params: { filtro: "categoria", nombre: target.name, ids: target.ids.join(",") },
                });
              return (
                <View key={category.id}>
                  <View style={styles.categoryRow}>
                    <Pressable
                      onPress={() => filterBy(category)}
                      accessibilityRole="link"
                      accessibilityLabel={`${category.name}, ver todo`}
                      style={({ pressed }) => [
                        styles.categoryName,
                        pressed && { backgroundColor: colors.surfaceMuted },
                      ]}
                    >
                      <Text style={styles.itemText}>{category.name}</Text>
                    </Pressable>
                    {hasChildren ? (
                      // Opens the group inside the menu: the menu stays open to pick a subcategory.
                      <Pressable
                        onPress={() => toggleCategory(category.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                        accessibilityLabel={`${category.name}: ${isOpen ? "plegar" : "desplegar"} subcategorías`}
                        hitSlop={4}
                        style={({ pressed }) => [
                          styles.chevron,
                          pressed && { backgroundColor: colors.surfaceMuted },
                        ]}
                      >
                        <Icon
                          name={isOpen ? "chevronUp" : "chevronDown"}
                          size={18}
                          color={colors.icon}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                  {hasChildren && isOpen ? (
                    <View style={styles.children}>
                      {category.children.map((child) => (
                        <Pressable
                          key={child.id}
                          onPress={() => filterBy(child)}
                          accessibilityRole="link"
                          style={({ pressed }) => [
                            styles.item,
                            pressed && { backgroundColor: colors.surfaceMuted },
                          ]}
                        >
                          <Text style={styles.childText}>{child.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>Apariencia</Text>
          <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Tema">
            {themes.map((theme) => {
              const selected = preference === theme.value;
              return (
                <Pressable
                  key={theme.value}
                  onPress={() => setPreference(theme.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={theme.label}
                  accessibilityState={{ selected, checked: selected }}
                  style={({ pressed }) => [
                    styles.segmentItem,
                    selected && styles.segmentItemSelected,
                    pressed && !selected && styles.segmentPressed,
                  ]}
                >
                  <Icon
                    name={theme.icon}
                    size={20}
                    color={selected ? colors.onTint : colors.icon}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section} accessibilityLabel="Tu cuenta">
          <Text style={styles.heading}>Tu cuenta</Text>
          {item("Favoritos", () => go(buyerHref("/(drawer)/(tabs)/favorites")), "heart")}
          {item("Mis pedidos", () => go(buyerHref("/(drawer)/(tabs)/account/orders")), "package")}
          {customer
            ? item("Mi cuenta", () => go(buyerHref("/(drawer)/(tabs)/account")), "user")
            : item("Iniciar sesión", () => go(buyerHref("/(drawer)/(tabs)/account/login")), "user")}
        </View>

        {hasCountryChoice ? (
          <View style={styles.section}>
            <RegionSelector onRegionChange={() => props.navigation.closeDrawer()} />
          </View>
        ) : null}
      </View>
    </DrawerContentScrollView>
  );
}

const createStyles = (colors: (typeof Colors)[keyof typeof Colors]) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 8, paddingBottom: 24 },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      paddingHorizontal: 8,
      marginBottom: 8,
    },
    searchWrap: { marginHorizontal: 8, marginBottom: 4 },
    section: {
      paddingVertical: 8,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    heading: {
      color: colors.icon,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    item: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    itemText: { color: colors.text, fontSize: 15 },
    categoryRow: { flexDirection: "row", alignItems: "center" },
    categoryName: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    chevron: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },
    children: {
      marginLeft: 16,
      paddingLeft: 8,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    childText: { color: colors.text, fontSize: 14 },
    segment: {
      flexDirection: "row",
      alignSelf: "flex-start",
      marginHorizontal: 8,
      padding: 4,
      gap: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    segmentItem: {
      width: 48,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentItemSelected: { backgroundColor: colors.tint },
    segmentPressed: { backgroundColor: colors.surfaceMuted },
  });
