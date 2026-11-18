import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Icon, type IconName } from "@agestyles/icons";
import { OperationList, Section, hasPermission } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme, type BusinessTheme } from "../../hooks/use-business-theme";

type Order = {
  id: string;
  status?: string;
  fulfillment_status?: string;
  fulfillments?: { delivered_at?: string | null; canceled_at?: string | null }[];
};
type InventoryItem = {
  id: string;
  location_levels?: { stocked_quantity?: number | null }[];
};
type DashboardData = {
  products: number | null;
  orders: number | null;
  openOrders: number | null;
  inventoryItems: number | null;
  lowStock: number | null;
  partial: boolean;
};

const EMPTY: DashboardData = {
  products: null,
  orders: null,
  openOrders: null,
  inventoryItems: null,
  lowStock: null,
  partial: false,
};

function countOf(
  data: { count?: number; products?: unknown[]; orders?: unknown[]; inventory_items?: unknown[] },
  key: "products" | "orders" | "inventory_items",
) {
  const rows = data[key];
  return typeof data.count === "number" ? data.count : Array.isArray(rows) ? rows.length : 0;
}

export default function OverviewScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { seller, member, request } = useBusiness();
  const [summary, setSummary] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canProducts = hasPermission(member, "products");
  const canOrders = hasPermission(member, "orders");
  const canInventory = hasPermission(member, "inventory_items");
  const canManageTeam = Boolean(member?.is_owner || member?.permissions?.members === "manage");

  const load = useCallback(async () => {
    if (!seller) {
      setSummary(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    const [productResult, orderResult, stockResult] = await Promise.allSettled([
      canProducts
        ? request<{ count?: number; products?: unknown[] }>("/vendor/products?limit=50&fields=id")
        : Promise.resolve(null),
      canOrders
        ? request<{ count?: number; orders?: Order[] }>(
            "/vendor/orders?limit=50&fields=id,status,fulfillment_status,fulfillments.delivered_at,fulfillments.canceled_at",
          )
        : Promise.resolve(null),
      canInventory
        ? request<{ count?: number; inventory_items?: InventoryItem[] }>(
            "/vendor/inventory-items?limit=50&fields=id,location_levels.stocked_quantity",
          )
        : Promise.resolve(null),
    ]);

    const next: DashboardData = { ...EMPTY };
    const unavailable: string[] = [];
    if (canProducts && productResult.status === "fulfilled" && productResult.value) {
      next.products = countOf(productResult.value, "products");
    } else if (canProducts) unavailable.push("productos");

    if (canOrders && orderResult.status === "fulfilled" && orderResult.value) {
      const orders = orderResult.value.orders ?? [];
      next.orders = countOf(orderResult.value, "orders");
      const allOrdersLoaded =
        typeof orderResult.value.count === "number"
          ? orderResult.value.count <= orders.length
          : orders.length < 50;
      next.openOrders = allOrdersLoaded
        ? orders.filter((order) => {
            const fulfillments = order.fulfillments ?? [];
            return (
              order.status !== "canceled" &&
              !fulfillments.some((item) => item.delivered_at && !item.canceled_at)
            );
          }).length
        : null;
      if (!allOrdersLoaded) next.partial = true;
    } else if (canOrders) unavailable.push("pedidos");

    if (canInventory && stockResult.status === "fulfilled" && stockResult.value) {
      const inventory = stockResult.value.inventory_items ?? [];
      next.inventoryItems = countOf(stockResult.value, "inventory_items");
      const allInventoryLoaded =
        typeof stockResult.value.count === "number"
          ? stockResult.value.count <= inventory.length
          : inventory.length < 50;
      if (allInventoryLoaded) {
        next.lowStock = inventory.filter((item) => {
          const levels = item.location_levels ?? [];
          return (
            levels.length > 0 &&
            levels.reduce((sum, level) => sum + Number(level.stocked_quantity ?? 0), 0) <= 2
          );
        }).length;
      } else next.partial = true;
    } else if (canInventory) unavailable.push("inventario");

    setSummary(next);
    setError(
      unavailable.length
        ? `No se pudieron cargar ${unavailable.join(", ")}. El resto del panel sigue disponible según tus permisos.`
        : "",
    );
    setLoading(false);
  }, [canInventory, canOrders, canProducts, request, seller]);

  useEffect(() => {
    void load();
  }, [load]);

  const alerts = useMemo(() => {
    const items: { title: string; detail: string; icon: IconName; action: () => void }[] = [];
    if (summary.openOrders && summary.openOrders > 0 && canOrders) {
      items.push({
        title: `${summary.openOrders} ${summary.openOrders === 1 ? "pedido necesita" : "pedidos necesitan"} atención`,
        detail: "Revisa su estado y prepara los pedidos pendientes.",
        icon: "list",
        action: () => router.push("/(tabs)/orders"),
      });
    }
    if (summary.lowStock && summary.lowStock > 0 && canInventory) {
      items.push({
        title: `${summary.lowStock} ${summary.lowStock === 1 ? "artículo con" : "artículos con"} pocas existencias`,
        detail: "Hay 2 unidades o menos en los almacenes consultados.",
        icon: "warehouse",
        action: () => router.push("/(tabs)/inventory"),
      });
    }
    return items;
  }, [canInventory, canOrders, router, summary.lowStock, summary.openOrders]);

  const actions: { title: string; detail: string; icon: IconName; href: Href }[] = [];
  if (canOrders)
    actions.push({
      title: "Pedidos",
      detail: "Preparar y actualizar",
      icon: "list",
      href: "/(tabs)/orders",
    });
  if (canProducts)
    actions.push({
      title: "Productos",
      detail: "Gestionar catálogo",
      icon: "package",
      href: "/(tabs)/products",
    });
  if (canInventory)
    actions.push({
      title: "Inventario",
      detail: "Consultar existencias",
      icon: "warehouse",
      href: "/(tabs)/inventory",
    });
  if (canInventory)
    actions.push({
      title: "Movimientos",
      detail: "Historial de existencias",
      icon: "arrowUpRight",
      href: "/movements",
    });
  if (canManageTeam)
    actions.push({
      title: "Equipo",
      detail: "Personas y permisos",
      icon: "user",
      href: "/(tabs)/team",
    });
  actions.push({
    title: "Más opciones",
    detail: "Cuenta y tiendas",
    icon: "more",
    href: "/(tabs)/more",
  });

  const roleId = member?.role_id?.toLowerCase() ?? "";
  const roleLabel = member?.is_owner
    ? "Propietario"
    : roleId.includes("inventory")
      ? "Gestor de inventario"
      : roleId.includes("order")
        ? "Gestor de pedidos"
        : roleId.includes("support")
          ? "Solo lectura"
          : roleId.includes("accounting")
            ? "Contabilidad"
            : roleId.includes("administration")
              ? "Administración"
              : "Equipo de tienda";

  return (
    <OperationList
      title="Resumen"
      subtitle={seller?.name ?? "Tu tienda"}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      <View style={styles.storeCard}>
        <View style={styles.storeMark}>
          <Icon name="store" size={21} color={theme.onAction} />
        </View>
        <View style={styles.storeCopy}>
          <Text style={styles.storeName} numberOfLines={1}>
            {seller?.name ?? "Tienda"}
          </Text>
          <Text style={styles.storeRole}>
            {roleLabel}
            {seller?.handle ? ` · @${seller.handle}` : ""}
          </Text>
        </View>
        <Icon name="shieldCheck" size={20} color={theme.onAction} />
      </View>
      {loading ? (
        <View style={styles.loadingState} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.action} />
          <Text style={styles.loadingText}>Actualizando los datos de la tienda…</Text>
        </View>
      ) : null}

      <Section title="Actividad de la tienda">
        <View style={styles.metrics}>
          {canOrders ? (
            <Metric
              label="Pedidos"
              value={summary.orders}
              icon="list"
              theme={theme}
              styles={styles}
            />
          ) : null}
          {canProducts ? (
            <Metric
              label="Productos"
              value={summary.products}
              icon="package"
              theme={theme}
              styles={styles}
            />
          ) : null}
          {canInventory ? (
            <Metric
              label="Artículos"
              value={summary.inventoryItems}
              icon="warehouse"
              theme={theme}
              styles={styles}
            />
          ) : null}
        </View>
        {canOrders && summary.openOrders !== null ? (
          <Pressable
            onPress={() => router.push("/(tabs)/orders")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.openOrders, pressed && styles.pressed]}
          >
            <View style={styles.openIcon}>
              <Icon name="bell" size={18} color={theme.action} />
            </View>
            <Text style={styles.openLabel}>Por atender</Text>
            <Text style={styles.openValue}>{summary.openOrders}</Text>
            <Icon name="chevronRight" size={18} color={theme.muted} />
          </Pressable>
        ) : null}
      </Section>

      {alerts.length ? (
        <Section title="Avisos">
          <View style={styles.alertList}>
            {alerts.map((alert) => (
              <Pressable
                key={alert.title}
                onPress={alert.action}
                accessibilityRole="button"
                style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}
              >
                <View style={styles.alertIcon}>
                  <Icon name={alert.icon} size={19} color={theme.error} />
                </View>
                <View style={styles.alertCopy}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertDetail}>{alert.detail}</Text>
                </View>
                <Icon name="chevronRight" size={18} color={theme.muted} />
              </Pressable>
            ))}
          </View>
        </Section>
      ) : !loading && !error && !summary.partial && (canOrders || canInventory) ? (
        <View style={styles.calmNotice}>
          <Icon name="check" size={18} color={theme.successText} />
          <Text style={styles.calmText}>No hay avisos urgentes para esta tienda.</Text>
        </View>
      ) : null}
      {!loading && summary.partial ? (
        <View style={styles.partialNotice}>
          <Icon name="bell" size={18} color={theme.action} />
          <Text style={styles.calmText}>
            Hay más registros que los consultados. Abre Pedidos o Inventario para revisar la lista
            completa.
          </Text>
        </View>
      ) : null}

      <Section title="Accesos rápidos">
        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <Pressable
              key={action.href}
              onPress={() => router.push(action.href)}
              accessibilityRole="button"
              accessibilityLabel={`${action.title}. ${action.detail}`}
              style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
            >
              <View style={styles.actionIcon}>
                <Icon name={action.icon} size={20} color={theme.action} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDetail}>{action.detail}</Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Text style={styles.footerNote}>
        Los datos corresponden a {seller?.name ?? "la tienda seleccionada"}. El servidor valida cada
        permiso al abrir una sección.
      </Text>
    </OperationList>
  );
}

function Metric({
  label,
  value,
  icon,
  theme,
  styles,
}: {
  label: string;
  value: number | null;
  icon: IconName;
  theme: BusinessTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Icon name={icon} size={18} color={theme.action} />
      </View>
      <Text style={styles.metricValue}>{value === null ? "—" : value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: BusinessTheme) =>
  StyleSheet.create({
    storeCard: {
      minHeight: 82,
      padding: 15,
      borderRadius: 18,
      backgroundColor: theme.action,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    storeMark: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    storeCopy: { flex: 1, gap: 4 },
    storeName: { color: theme.onAction, fontSize: 17, fontWeight: "700" },
    storeRole: { color: theme.onAction, opacity: 0.78, fontSize: 13 },
    loadingState: {
      minHeight: 44,
      paddingHorizontal: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    loadingText: { color: theme.muted, fontSize: 13 },
    metrics: { flexDirection: "row", gap: 10 },
    metricCard: {
      flex: 1,
      minWidth: 0,
      minHeight: 112,
      padding: 13,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      justifyContent: "space-between",
    },
    metricIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    metricValue: {
      color: theme.text,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    metricLabel: { color: theme.muted, fontSize: 13, fontWeight: "500" },
    openOrders: {
      minHeight: 56,
      marginTop: 10,
      borderRadius: 13,
      paddingHorizontal: 12,
      backgroundColor: theme.quietSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    openIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    openLabel: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "600" },
    openValue: {
      color: theme.action,
      fontSize: 18,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    alertList: { gap: 9 },
    alertCard: {
      minHeight: 76,
      padding: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    alertIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    alertCopy: { flex: 1, gap: 4 },
    alertTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
    alertDetail: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    calmNotice: {
      marginTop: 17,
      padding: 13,
      borderRadius: 13,
      backgroundColor: theme.quietSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    partialNotice: {
      marginTop: 17,
      padding: 13,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    calmText: { color: theme.muted, flex: 1, fontSize: 13 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    actionCard: {
      width: "48%",
      minHeight: 116,
      flexGrow: 1,
      flexBasis: "44%",
      padding: 13,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    pressed: { opacity: 0.72 },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    actionTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
    actionDetail: { color: theme.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
    footerNote: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 18,
      paddingHorizontal: 2,
    },
  });
