import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { OperationList, Row, Section } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";

export default function OverviewScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { seller, member, request } = useBusiness();
  const [summary, setSummary] = useState({ products: "—", orders: "—", inventory: "—" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      request<any>("/vendor/products?limit=1&fields=id"),
      request<any>("/vendor/orders?limit=1&fields=id"),
      request<any>("/vendor/inventory-items?limit=1&fields=id"),
    ]);
    const availability = (result: PromiseSettledResult<any>) =>
      result.status === "fulfilled" ? "Disponible" : "Sin acceso";
    setSummary({
      products: availability(results[0]),
      orders: availability(results[1]),
      inventory: availability(results[2]),
    });
    if (results.some((result) => result.status === "rejected")) {
      setError(
        "Algunos datos no están disponibles para tu rol; el servidor conserva el control de acceso.",
      );
    }
    setLoading(false);
  }, [request, seller]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OperationList
      title="Resumen"
      subtitle={seller?.name ?? "Tu tienda"}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      <View style={styles.permission}>
        <Icon name="shieldCheck" size={20} color={theme.action} />
        <Text style={styles.permissionText}>
          {member?.is_owner
            ? "Propietario"
            : member?.role_id
              ? "Permisos activos para esta tienda"
              : "Permisos comprobados por el servidor"}
        </Text>
      </View>
      <Section title="Actividad de la tienda">
        <Row title="Productos" detail="Catálogo visible para tu rol" trailing={summary.products} />
        <Row title="Pedidos" detail="Pedidos de esta tienda" trailing={summary.orders} />
        <Row title="Inventario" detail="Artículos de inventario" trailing={summary.inventory} />
      </Section>
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Acceso por tienda</Text>
        <Text style={styles.noteBody}>
          Los datos y acciones se solicitan con la tienda elegida y el servidor vuelve a comprobar
          cada permiso.
        </Text>
      </View>
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    permission: {
      borderRadius: 12,
      borderColor: theme.border,
      borderWidth: 1,
      backgroundColor: theme.surface,
      minHeight: 48,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      paddingHorizontal: 14,
    },
    permissionText: { color: theme.text, fontSize: 14, fontWeight: "500" },
    note: { marginTop: 18, padding: 17, borderRadius: 14, backgroundColor: theme.quietSurface },
    noteTitle: { color: theme.text, fontWeight: "600", fontSize: 15 },
    noteBody: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  });
