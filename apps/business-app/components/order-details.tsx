import type { ReactNode } from "react";
import { StatusBadge } from "@agestyles/ui-native";
import { StyleSheet, Text, View } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { money, ORDER_STATUS, shortDate } from "../lib/admin";
import {
  deliveryLines,
  orderDeliveryStatus,
  orderPaymentStatus,
  type BusinessOrder,
} from "../lib/order-details";
import { Row, Section } from "./operation-list";

export function OrderDetails({
  order,
  storeName = order.seller?.name,
  children,
}: {
  order: BusinessOrder;
  storeName?: string;
  children?: ReactNode;
}) {
  const theme = useBusinessTheme();
  const delivery = orderDeliveryStatus(order);
  const payment = orderPaymentStatus(order.payment_status);
  const address = order.shipping_address;
  const name = [address?.first_name, address?.last_name].filter(Boolean).join(" ");
  const addressText = [
    address?.address_1,
    address?.address_2,
    address?.city,
    address?.province,
    address?.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const lines = new Map(deliveryLines(order).map((line) => [line.id, line]));
  const events = (order.fulfillments ?? [])
    .flatMap((fulfillment, index) =>
      [
        [fulfillment.created_at, "Preparación iniciada"],
        [fulfillment.packed_at, "Listo para envío"],
        [fulfillment.shipped_at, "Despachado"],
        [fulfillment.delivered_at, "Entregado"],
        [fulfillment.canceled_at, "Cancelado"],
      ].flatMap(([date, label]) =>
        date && label ? [{ date, label, index, id: fulfillment.id }] : [],
      ),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const totals = [
    ["Subtotal", order.subtotal],
    ["Descuentos", order.discount_total],
    ["Envío", order.shipping_total],
    ["Impuestos", order.tax_total],
    ["Total", order.total],
  ] as const;

  return (
    <View style={styles.body}>
      {storeName || order.created_at ? (
        <Text style={{ color: theme.muted }}>
          {[storeName, shortDate(order.created_at)].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      <View style={styles.statuses}>
        {[
          {
            title: "Pedido",
            label: ORDER_STATUS[order.status ?? ""] ?? "Sin información",
            tone: "neutral" as const,
          },
          { title: "Pago", ...payment },
          { title: "Entrega", ...delivery },
        ].map(({ title, label, tone }) => (
          <View key={title} style={styles.status}>
            <Text style={{ color: theme.muted }}>{title}</Text>
            <StatusBadge label={label} tone={tone} />
          </View>
        ))}
      </View>
      <Section title="Artículos">
        {order.items?.length ? (
          order.items.map((item) => {
            const line = lines.get(item.id);
            const detail = [
              item.variant_title,
              `${item.quantity} ${Number(item.quantity) === 1 ? "unidad" : "unidades"}`,
              line &&
                `${line.covered} ${line.covered === 1 ? "entregada" : "entregadas"} · ${line.remaining} ${line.remaining === 1 ? "pendiente" : "pendientes"}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Row
                key={item.id}
                title={item.title ?? "Artículo"}
                detail={detail}
                trailing={
                  item.total != null
                    ? money(item.total, order.currency_code)
                    : item.unit_price != null
                      ? `${money(item.unit_price, order.currency_code)} por unidad`
                      : undefined
                }
              />
            );
          })
        ) : (
          <Row title="Sin información de artículos" />
        )}
      </Section>
      <Section title="Comprador y entrega">
        <Row
          title={name || order.email || "Comprador sin identificar"}
          detail={[name && order.email, address?.phone].filter(Boolean).join(" · ") || undefined}
        />
        {order.shipping_methods?.map((method) => (
          <Row key={method.id} title={method.name ?? "Método de entrega"} />
        ))}
        {addressText ? <Row title="Dirección de entrega" detail={addressText} /> : null}
      </Section>
      <Section title="Importes del pedido">
        {totals.map(([label, amount]) =>
          amount != null ? (
            <Row key={label} title={label} trailing={money(amount, order.currency_code)} />
          ) : null,
        )}
        {totals.every(([, amount]) => amount == null) ? (
          <Row title="Sin información de importes" />
        ) : null}
      </Section>
      {children}
      {events.length ? (
        <Section title="Seguimiento de entrega">
          {events.map(({ date, label, id, index }) => (
            <Row
              key={`${id}-${label}`}
              title={label}
              detail={`Envío ${index + 1} · ${shortDate(date)}`}
            />
          ))}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 4 },
  statuses: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  status: { gap: 5, alignItems: "flex-start" },
});
