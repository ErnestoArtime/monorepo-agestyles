import { Icon } from "@agestyles/icons";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { formatPrice } from "@/lib/format-price";
import { groupStatusView } from "@/lib/order-status";
import { Card, LargeTitle, StatusBadge, useUiTheme } from "@agestyles/ui-native";
import { sdk } from "@/lib/sdk";
import { listBuyerOrderGroups } from "@agestyles/api-client/buyer-orders";
import type { BuyerOrderGroup } from "@agestyles/api-client/buyer-orders";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
}

export default function OrdersScreen() {
  const { customer, loading: customerLoading } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [orders, setOrders] = useState<BuyerOrderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listBuyerOrderGroups(sdk.client);
      setOrders(result.order_groups);
    } catch {
      setError("No se pudieron cargar tus compras. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (customer) void loadOrders();
    else if (!customerLoading) setLoading(false);
  }, [customer, customerLoading, loadOrders]);

  if (customerLoading || loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
        <Text style={{ color: colors.icon }}>Cargando tus compras…</Text>
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.center, styles.signedOut, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          Inicia sesión para ver tus compras
        </Text>
        <Button
          title="Iniciar sesión"
          onPress={() => router.push("/(drawer)/(tabs)/account/login")}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadOrders(true)}
          tintColor={colors.tint}
        />
      }
    >
      <LargeTitle title="Mis pedidos" />
      {error ? (
        <View style={styles.section}>
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </Text>
          <Button title="Reintentar" variant="secondary" onPress={() => loadOrders()} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.title, { color: colors.text }]}>Aún no tienes compras</Text>
          <Text style={[styles.description, { color: colors.icon }]}>
            Las compras que hagas mientras estés conectado aparecerán aquí Las compras de invitados
            no están vinculadas a una cuenta.
          </Text>
          <Button
            title="Continuar comprando"
            onPress={() => router.navigate("/(drawer)/(tabs)/(home)")}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {orders.map((group) => (
            <OrderGroupRow key={group.id} group={group} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** Order card (reference POS style): number, date, stores, total and a status badge. */
function OrderGroupRow({ group }: { group: BuyerOrderGroup }) {
  const { color } = useUiTheme();
  const currency = group.orders[0]?.currency_code;
  const status = groupStatusView(group.orders.map((order) => order.fulfillment_status));
  return (
    <Card
      accessibilityLabel={`Compra ${group.display_id ?? group.id}, ${status.label}, ${formatPrice(group.total, currency)}`}
      onPress={() =>
        router.push({ pathname: "/(drawer)/(tabs)/account/orders/[id]", params: { id: group.id } })
      }
    >
      <View style={styles.rowHeading}>
        <Text style={[styles.orderName, { color: color.text }]}>
          Compra #{group.display_id ?? group.id}
        </Text>
        <Text style={{ color: color.muted }}>{formatDate(group.created_at)}</Text>
      </View>
      <View style={styles.rowLine}>
        <Icon name="store" size={16} color={color.muted} />
        <Text style={{ color: color.text, flexShrink: 1 }} numberOfLines={1}>
          {group.orders.map((order) => order.seller?.name ?? "Tienda").join(" · ")}
        </Text>
      </View>
      <View style={styles.rowHeading}>
        <Text style={[styles.total, { color: color.text }]}>
          {formatPrice(group.total, currency)}
        </Text>
        <StatusBadge label={status.label} tone={status.tone} icon={status.icon} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20 },
  list: { gap: 12 },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  row: { gap: 8, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  rowHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  orderName: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  total: { fontSize: 16, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 14 },
  signedOut: { gap: 20 },
  empty: { flex: 1, minHeight: 260, justifyContent: "center", alignItems: "flex-start", gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  section: { gap: 16 },
});
