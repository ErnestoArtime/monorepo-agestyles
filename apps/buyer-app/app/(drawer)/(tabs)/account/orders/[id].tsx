import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { formatPrice } from "@/lib/format-price";
import { fulfillmentStatusView } from "@/lib/order-status";
import { Card, KeyValueRow, StatusBadge } from "@agestyles/ui-native";
import { sdk } from "@/lib/sdk";
import { getBuyerOrderGroup, BuyerOrderGroupDetail } from "@agestyles/api-client/buyer-orders";
import { getOrderTracking, OrderTracking } from "@agestyles/api-client/order-tracking";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getStatusLabel, PAYMENT_STATUS_LABELS } from "@/lib/status-labels";
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
        const entries = await Promise.all(
          order_group.orders.map(async (order) => {
            try {
              const { tracking } = await getOrderTracking(sdk.client, order.id);
              return [order.id, tracking] as const;
            } catch {
              return [order.id, null] as const;
            }
          }),
        );
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
        <Text style={{ color: colors.icon }}>Cargando compra…</Text>
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Compra no disponible</Text>
        <Text style={[styles.muted, { color: colors.icon }]}>
          Puede que haya sido removido o pertenezca a otra cuenta
        </Text>
      </View>
    );
  }

  const currency = group.orders[0]?.currency_code;
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.summary}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Compra #{group.display_id ?? group.id}
        </Text>
        <KeyValueRow
          label="Fecha"
          value={new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
            new Date(group.created_at),
          )}
        />
        <KeyValueRow label="Total" value={formatPrice(group.total, currency)} emphasis />
      </View>

      {group.orders.map((order) => (
        <Card key={order.id} style={styles.sellerSection}>
          <View style={styles.sellerHeading}>
            <Text style={[styles.sellerName, { color: colors.text }]}>
              {order.seller?.name ?? "Tienda"}
            </Text>
            <Text style={[styles.muted, { color: colors.icon }]}>Orden #{order.display_id}</Text>
          </View>
          <View style={styles.badges}>
            {(() => {
              const view = fulfillmentStatusView(
                trackingByOrder[order.id]?.status ?? order.fulfillment_status ?? order.status,
              );
              return <StatusBadge label={view.label} tone={view.tone} icon={view.icon} />;
            })()}
            {order.payment_status ? (
              <StatusBadge
                label={getStatusLabel(order.payment_status, PAYMENT_STATUS_LABELS)}
                tone={order.payment_status === "captured" ? "success" : "neutral"}
                icon="creditCard"
              />
            ) : null}
          </View>
          {order.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={{ color: colors.icon }}>Cant. {item.quantity}</Text>
              <Text style={{ color: colors.text }}>
                {formatPrice(item.total, order.currency_code)}
              </Text>
              <View style={styles.itemTracking}>
                <Text style={[styles.trackingHeading, { color: colors.text }]}>
                  Seguimiento del ítem
                </Text>
                {trackingLoading ? (
                  <Text style={{ color: colors.icon }}>Cargando seguimiento…</Text>
                ) : trackingByOrder[order.id] ? (
                  <TrackingLine
                    tracking={trackingByOrder[order.id]!}
                    itemId={item.id}
                    colors={colors}
                  />
                ) : (
                  <Text style={{ color: colors.icon }}>
                    No se pudo cargar el seguimiento. Inténtalo de nuevo más tarde.
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card>
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
  if (!line)
    return (
      <Text style={{ color: colors.icon }}>
        No hay información de seguimiento disponible para este ítem.
      </Text>
    );

  const shipments = line.shipments.flatMap((shipment) =>
    shipment.tracking.map((label) => ({ number: label.tracking_number, url: label.tracking_url })),
  );

  return (
    <View style={styles.trackingDetails}>
      <Text style={{ color: colors.icon, textTransform: "capitalize" }}>
        {getStatusLabel(line.status)}
        {line.shipped_quantity > 0
          ? ` · ${line.shipped_quantity} de ${line.quantity} enviados`
          : line.preparing_quantity + line.ready_quantity > 0
            ? ` · ${Math.min(line.quantity, line.preparing_quantity + line.ready_quantity)} de ${line.quantity} artículos`
            : ""}
      </Text>
      {shipments.map(({ number, url }, index) => {
        const safeUrl = url && /^https:\/\//i.test(url) ? url : null;
        return safeUrl ? (
          <Pressable
            key={`${number}-${index}`}
            accessibilityRole="link"
            accessibilityLabel={`Abrir seguimiento del envío ${number}`}
            onPress={() => {
              void Linking.openURL(safeUrl).catch(() => undefined);
            }}
            hitSlop={8}
          >
            <Text style={[styles.trackingLink, { color: colors.tint }]}>{number}</Text>
          </Pressable>
        ) : (
          <Text key={`${number}-${index}`} style={{ color: colors.icon }}>
            {number}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8 },
  summary: { gap: 6, paddingBottom: 16 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.4, marginBottom: 6 },
  sellerSection: { marginBottom: 12 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sellerHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  sellerName: { fontSize: 17, fontWeight: "600" },
  muted: { fontSize: 14 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  itemTitle: { flex: 1, minWidth: 120, fontSize: 15 },
  itemTracking: { width: "100%", gap: 4, paddingTop: 4 },
  trackingHeading: { fontSize: 13, fontWeight: "600" },
  trackingDetails: { gap: 4 },
  trackingLink: { textDecorationLine: "underline", minHeight: 24, paddingVertical: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 14 },
});
