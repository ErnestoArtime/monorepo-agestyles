import { PillGroup } from "@agestyles/ui-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { useResponsive } from "../hooks/use-responsive";

const SECTIONS = [
  { value: "/admin/avisos", label: "Avisos" },
  { value: "/admin/usuarios", label: "Usuarios" },
  { value: "/admin/tiendas", label: "Tiendas" },
  { value: "/admin/pedidos", label: "Pedidos" },
  { value: "/admin/revision", label: "Revisión" },
  { value: "/admin/portada", label: "Portada" },
  { value: "/admin/categorias", label: "Categorías" },
];

/** On phones (no side menu) the administration sections are tabs at the top. */
export function AdminNav() {
  const theme = useBusinessTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { seller } = useBusiness();
  const { isWideWeb } = useResponsive();
  if (isWideWeb) return null;
  const current = SECTIONS.find((section) => pathname.startsWith(section.value))?.value ?? "";
  const options = [...SECTIONS, ...(seller ? [{ value: "/(tabs)", label: "Mi negocio" }] : [])];
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.surface }}>
      <View style={[styles.bar, { borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <PillGroup
            accessibilityLabel="Secciones de administración"
            value={current}
            onChange={(value) =>
              value === "/(tabs)" ? router.replace(value as Href) : router.push(value as Href)
            }
            options={options}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { paddingHorizontal: 16, paddingVertical: 10 },
});
