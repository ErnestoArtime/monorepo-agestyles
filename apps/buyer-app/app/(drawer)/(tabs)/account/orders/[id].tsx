import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { formatPrice } from "@/lib/format-price";
import { sdk } from "@/lib/sdk";
import { getBuyerOrderGroup, BuyerOrderGroupDetail } from "@agestyles/api-client/buyer-orders";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

export default function PurchaseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { customer, loading: customerLoading } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [group, setGroup] = useState<BuyerOrderGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (customerLoading) return;
    if (!customer) {
      router.replace("/(drawer)/(tabs)/account/login");
      return;
    }

    let active = true;
    getBuyerOrderGroup(sdk.client, id)
      .then(({ order_group }) => {
        if (active) setGroup(order_group);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customer, customerLoading, id]);

  if (loading || customerLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
        <Text style={{ color: colors.icon }}>Loading purchase…</Text>
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Purchase unavailable</Text>
        <Text style={[styles.muted, { color: colors.icon }]}>It may have been removed or belong to another account.</Text>
      </View>
    );
  }

  const currency = group.orders[0]?.currency_code;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.summary, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Purchase #{group.display_id ?? group.id}</Text>
        <Text style={{ color: colors.icon }}>{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(group.created_at))}</Text>
        <Text style={[styles.total, { color: colors.text }]}>{formatPrice(group.total, currency)}</Text>
      </View>

      {group.orders.map((order) => (
        <View key={order.id} style={[styles.sellerSection, { borderBottomColor: colors.border }]}>
          <View style={styles.sellerHeading}>
            <Text style={[styles.sellerName, { color: colors.text }]}>{order.seller?.name ?? "Store"}</Text>
            <Text style={[styles.muted, { color: colors.icon }]}>Order #{order.display_id}</Text>
          </View>
          <Text style={[styles.status, { color: colors.icon }]}>
            {order.fulfillment_status ?? order.status}{order.payment_status ? ` · ${order.payment_status}` : ""}
          </Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={{ color: colors.icon }}>Qty {item.quantity}</Text>
              <Text style={{ color: colors.text }}>{formatPrice(item.total, order.currency_code)}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8 },
  summary: { gap: 10, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 21, fontWeight: "700" },
  total: { fontSize: 18, fontWeight: "600", marginTop: 4 },
  sellerSection: { gap: 12, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  sellerHeading: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  sellerName: { fontSize: 17, fontWeight: "600" },
  muted: { fontSize: 14 },
  status: { fontSize: 14, textTransform: "capitalize" },
  item: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  itemTitle: { flex: 1, minWidth: 120, fontSize: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 14 },
});
