import { Icon } from "@agestyles/icons";
import type { BuyerOrderGroup } from "@agestyles/api-client/buyer-orders";
import { Card, StatusBadge, useUiTheme } from "@agestyles/ui-native";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { buyerPath } from "../../config";
import { formatPrice } from "../../lib/format-price";
import { groupStatusView } from "../../lib/order-status";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
}

/** Order card (reference POS style): number, date, stores, total and a status badge. */
export function OrderGroupRow({ group }: { group: BuyerOrderGroup }) {
  const { color } = useUiTheme();
  const currency = group.orders[0]?.currency_code;
  const status = groupStatusView(group.orders.map((order) => order.fulfillment_status));
  return (
    <Card
      accessibilityLabel={`Compra ${group.display_id ?? group.id}, ${status.label}, ${formatPrice(group.total, currency)}`}
      onPress={() =>
        router.push({
          pathname: buyerPath("/(drawer)/(tabs)/account/orders/[id]"),
          params: { id: group.id },
        })
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
  rowLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  orderName: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  total: { fontSize: 16, fontWeight: "600" },
});
