import { Icon } from "@agestyles/icons";
import { DrawerContentComponentProps, DrawerContentScrollView } from "@react-navigation/drawer";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { useHasCountryChoice } from "@/context/region-context";
import { useThemePreference, type ThemePreference } from "@/context/theme-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { sdk } from "@/lib/sdk";
import { RegionSelector } from "./region-selector";

type Category = {
  id: string;
  name: string;
  parent_category_id?: string | null;
  category_children?: { id: string }[];
};

const HOME = "/(drawer)/(tabs)/(home)";

/** Same menu as the legacy catalog: pages, categories, appearance and account. */
export function DrawerContent(props: DrawerContentComponentProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { customer } = useCustomer();
  const { preference, setPreference } = useThemePreference();
  const hasCountryChoice = useHasCountryChoice();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    sdk.client
      .fetch<{ product_categories: Category[] }>("/store/product-categories", {
        query: { limit: 100, fields: "id,name,parent_category_id,category_children.id" },
      })
      .then(({ product_categories }) => setCategories(product_categories))
      .catch(() => setCategories([]));
  }, []);

  // Top-level categories, each opening its products and those of its subcategories.
  const topCategories = useMemo(() => {
    const byParent = new Map<string, string[]>();
    for (const category of categories) {
      if (category.parent_category_id) {
        byParent.set(category.parent_category_id, [
          ...(byParent.get(category.parent_category_id) ?? []),
          category.id,
        ]);
      }
    }
    const descendants = (id: string): string[] => [
      id,
      ...(byParent.get(id) ?? []).flatMap((child) => descendants(child)),
    ];
    return categories
      .filter((category) => !category.parent_category_id)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((category) => ({ ...category, ids: descendants(category.id) }));
  }, [categories]);

  function go(href: Href) {
    props.navigation.closeDrawer();
    router.push(href);
  }

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

  const themes: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "Sistema" },
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
  ];

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Menú principal
        </Text>

        <View style={styles.section} accessibilityLabel="Páginas del sitio">
          {item("Inicio", () => go(HOME), "home")}
          {item(
            "Todos los productos",
            () => go({ pathname: HOME, params: { filtro: "todos" } }),
            "list",
          )}
          {item("Novedades", () => go({ pathname: HOME, params: { filtro: "novedades" } }), "bell")}
          {item("Tiendas", () => go("/stores" as Href), "store")}
        </View>

        {topCategories.length ? (
          <View style={styles.section} accessibilityLabel="Categorías de productos">
            <Text style={styles.heading}>Categorías</Text>
            {topCategories.map((category) =>
              item(category.name, () =>
                go({
                  pathname: HOME,
                  params: {
                    filtro: "categoria",
                    nombre: category.name,
                    ids: category.ids.join(","),
                  },
                }),
              ),
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>Apariencia</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Tema">
            {themes.map((theme) => {
              const selected = preference === theme.value;
              return (
                <Pressable
                  key={theme.value}
                  onPress={() => setPreference(theme.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {theme.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section} accessibilityLabel="Tu cuenta">
          <Text style={styles.heading}>Tu cuenta</Text>
          {item("Favoritos", () => go("/(drawer)/(tabs)/favorites"), "heart")}
          {item("Mis pedidos", () => go("/(drawer)/(tabs)/account/orders"), "package")}
          {customer
            ? item("Mi cuenta", () => go("/(drawer)/(tabs)/account"), "user")
            : item("Iniciar sesión", () => go("/(drawer)/(tabs)/account/login"), "user")}
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
    chips: { flexDirection: "row", gap: 8, paddingHorizontal: 8 },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
    },
    chipSelected: { backgroundColor: colors.tint, borderColor: colors.tint },
    chipText: { color: colors.text, fontSize: 13 },
    chipTextSelected: { color: colors.onTint, fontWeight: "600" },
  });
