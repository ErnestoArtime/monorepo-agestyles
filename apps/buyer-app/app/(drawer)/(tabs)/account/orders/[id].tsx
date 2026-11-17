import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { formatPrice } from "@/lib/format-price";
import { sdk } from "@/lib/sdk";
import { getBuyerOrderGroup, BuyerOrderGroupDetail } from "@agestyles/api-client/buyer-orders";
import { getOrderTracking, OrderTracking } from "@agestyles/api-client/order-tracking";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type ThemeColors = (typeof Colors)[keyof typeof Colors];

export default function PurchaseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { customer, loading: customerLoading } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [group, setGroup] = useState<BuyerOrderGroupDetail | null>(null);
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, OrderTracking | null>>({});
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (customerLoading) return;
    if (!customer) {
      router.replace("/(drawer)/(tabs)/account/login");
      return;
    }

    let active = true;
    setTrackingByOrder({});
    setTrackingLoading(true);
    getBuyerOrderGroup(sdk.client, id)
      .then(async ({ order_group }) => {
        if (!active) return;
        setGroup(order_group);
        const entries = await Promise.all(order_group.orders.map(async (order) => {
          try {
            const { tracking } = await getOrderTracking(sdk.client, order.id);
            return [order.id, tracking] as const;
          } catch {
            return [order.id, null] as const;
          }
        }));
        if (active) setTrackingByOrder(Object.fromEntries(entries));
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) {
          setTrackingLoading(false);
          setLoading(false);
        }
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
              <View style={styles.itemTracking}>
                <Text style={[styles.trackingHeading, { color: colors.text }]}>Item tracking</Text>
                {trackingLoading ? (
                  <Text style={{ color: colors.icon }}>Loading tracking…</Text>
                ) : trackingByOrder[order.id] ? (
                  <TrackingLine tracking={trackingByOrder[order.id]!} itemId={item.id} colors={colors} />
                ) : (
                  <Text style={{ color: colors.icon }}>Tracking could not be loaded. Try again later.</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function TrackingLine({
  tracking,
  itemId,
  colors,
}: {
  tracking: OrderTracking;
  itemId: string;
  colors: ThemeColors;
}) {
  const line = tracking.lines.find((entry) => entry.line_item_id === itemId);
  if (!line) return <Text style={{ color: colors.icon }}>No tracking information is available for this item.</Text>;

  const shipments = line.shipments.flatMap((shipment) =>
    shipment.tracking.map((label) => ({ number: label.tracking_number, url: label.tracking_url })),
  );

  return (
    <View style={styles.trackingDetails}>
      <Text style={{ color: colors.icon, textTransform: "capitalize" }}>
        {line.status.replaceAll("_", " ")} · {line.shipped_quantity} of {line.quantity} shipped
      </Text>
      {shipments.map(({ number, url }, index) => {
        const safeUrl = url && /^https:\/\//i.test(url) ? url : null;
        return safeUrl ? (
          <Pressable
            key={`${number}-${index}`}
            accessibilityRole="link"
            accessibilityLabel={`Open shipment tracking ${number}`}
            onPress={() => { void Linking.openURL(safeUrl).catch(() => undefined); }}
            hitSlop={8}
          >
            <Text style={[styles.trackingLink, { color: colors.tint }]}>{number}</Text>
          </Pressable>
        ) : (
          <Text key={`${number}-${index}`} style={{ color: colors.icon }}>{number}</Text>
        );
      })}
    </View>
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
  itemTracking: { width: "100%", gap: 4, paddingTop: 4 },
  trackingHeading: { fontSize: 13, fontWeight: "600" },
  trackingDetails: { gap: 4 },
  trackingLink: { textDecorationLine: "underline", minHeight: 24, paddingVertical: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 14 },
});
