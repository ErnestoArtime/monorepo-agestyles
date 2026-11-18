import { Icon, type IconName } from "@agestyles/icons";
import { DrawerContentComponentProps, DrawerContentScrollView } from "@react-navigation/drawer";
import { useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { useHasCountryChoice } from "@/context/region-context";
import { useThemePreference, type ThemePreference } from "@/context/theme-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTopCategories } from "@/hooks/use-top-categories";
import { RegionSelector } from "./region-selector";

const HOME = "/(drawer)/(tabs)/(home)";

/** Same menu as the legacy catalog: pages, categories, appearance and account. */
export function DrawerContent(props: DrawerContentComponentProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { customer } = useCustomer();
  const { preference, setPreference } = useThemePreference();
  const hasCountryChoice = useHasCountryChoice();
  const topCategories = useTopCategories();

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
