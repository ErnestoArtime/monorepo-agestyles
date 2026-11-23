import { Card, StatusBadge } from "@agestyles/ui-native";
import { StyleSheet, Text, View } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { money, ORDER_STATUS, shortDate } from "../lib/admin";
import {
  orderDeliveryStatus,
  orderPaymentStatus,
  orderTitle,
  type BusinessOrder,
} from "../lib/order-details";
import { ResponsiveManagementList, type TableColumn } from "./management-list";

export function OrderDirectory({
  caption,
  orders,
  onOpen,
}: {
  caption: string;
  orders: BusinessOrder[];
  onOpen: (order: BusinessOrder) => void;
}) {
  const theme = useBusinessTheme();
  const columns: TableColumn<BusinessOrder>[] = [
    {
      id: "order",
      label: "Pedido",
      width: "20%",
      render: (order) => (
        <>
          {orderTitle(order)}
          {order.seller?.name || order.created_at ? (
            <span className="ag-cell-detail">
              {[order.seller?.name, shortDate(order.created_at)].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </>
      ),
    },
    { id: "buyer", label: "Comprador", width: "18%", render: (order) => order.email ?? "—" },
    {
      id: "total",
      label: "Importe",
      width: "11%",
      render: (order) => (order.total == null ? "—" : money(order.total, order.currency_code)),
    },
    {
      id: "status",
      label: "Estado",
      width: "12%",
      render: (order) => ORDER_STATUS[order.status ?? ""] ?? "—",
    },
    {
      id: "payment",
      label: "Pago",
      width: "12%",
      render: (order) => <StatusBadge {...orderPaymentStatus(order.payment_status)} />,
    },
    {
      id: "delivery",
      label: "Entrega",
      width: "16%",
      render: (order) => <StatusBadge {...orderDeliveryStatus(order)} />,
    },
  ];
  return (
    <ResponsiveManagementList
      caption={caption}
      rows={orders}
      columns={columns}
      rowKey={(order) => order.id}
      actionLabel={(order) => `Ver ${orderTitle(order)}`}
      onOpen={onOpen}
      renderCompact={() => (
        <View style={styles.list}>
          {orders.map((order) => {
            const delivery = orderDeliveryStatus(order);
            const payment = orderPaymentStatus(order.payment_status);
            return (
              <Card
                key={order.id}
                onPress={() => onOpen(order)}
                accessibilityLabel={`Ver ${orderTitle(order)}`}
              >
                <View style={styles.line}>
                  <Text style={[styles.title, { color: theme.text }]}>{orderTitle(order)}</Text>
                  {order.total != null ? (
                    <Text style={{ color: theme.text }}>
                      {money(order.total, order.currency_code)}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: theme.muted }}>
                  {[order.seller?.name, order.email, shortDate(order.created_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <View style={styles.badges}>
                  <StatusBadge
                    label={`Pedido: ${ORDER_STATUS[order.status ?? ""] ?? "Sin información"}`}
                    tone="neutral"
                  />
                  <StatusBadge label={`Pago: ${payment.label}`} tone={payment.tone} />
                  <StatusBadge label={delivery.label} tone={delivery.tone} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 8, gap: 8 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
});
