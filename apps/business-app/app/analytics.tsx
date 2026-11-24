import { mediaVariant } from "@agestyles/api-client/media";
import { PillGroup } from "@agestyles/ui-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CardGrid } from "../components/card-grid";
import { OperationList, Section } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { money } from "../lib/admin";

type Totals = {
  amount: number;
  online_amount: number;
  in_store_amount: number;
  count: number;
  units: number;
  average_ticket: number;
};
type ProductRow = {
  product_id: string;
  title: string;
  thumbnail: string | null;
};
type TrafficProductRow = ProductRow & {
  views: number;
  clicks: number;
  ctr: number | null;
  add_to_cart: number;
  orders: number;
  units: number;
};
type Analytics = {
  from: string;
  to: string;
  sales: Totals & {
    previous: Totals;
    change: { amount: number | null; count: number | null };
    daily: { date: string; amount: number; count: number }[];
  };
  top_products: (ProductRow & { units: number; amount: number })[];
  stale_products: (ProductRow & { available: number; days_without_sales: number | null })[];
  running_out: (ProductRow & {
    available: number;
    daily_sales: number;
    days_left: number | null;
  })[];
  pending_orders: {
    unprepared: number;
    preparing: number;
    ready: number;
    shipped: number;
    manual_payments: number;
    oldest: { id: string; display_id: number | null; stage: string; hours: number }[];
  };
  traffic: {
    store_views: number;
    product_views: number;
    product_clicks: number;
    add_to_cart_clicks: number;
    ctr: number | null;
    daily: { date: string; views: number; clicks: number }[];
    top_products: TrafficProductRow[];
  };
  agents:
    { agent_id: string; name: string; count: number; amount: number; commission: number }[] | null;
  thresholds: { stale_days: number; cover_days: number };
};

type Period = "7" | "30" | "90" | "month";
const PERIODS: { value: Period; label: string }[] = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "month", label: "Este mes" },
];
const STAGE: Record<string, string> = {
  unprepared: "Sin preparar",
  preparing: "En preparación",
  ready: "Listo",
  shipped: "Despachado",
};

function periodRange(period: Period) {
  const to = new Date();
  if (period === "month") return { from: new Date(to.getFullYear(), to.getMonth(), 1), to };
  return { from: new Date(to.getTime() - (Number(period) - 1) * 86_400_000), to };
}

const age = (hours: number) =>
  hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} ${hours < 48 ? "día" : "días"}`;

/**
 * «Análisis» (AG-39, vistas y clics en AG-59 Fase 6): how the store is doing in a period,
 * compared with the previous one, and what needs attention (stock running out, products that
 * do not sell, open orders). Gestores y comisiones only for the owner and the store's
 * administration (server rule). Traffic is the store's own anonymous views and clicks: the
 * server only ever returns the selected store's events, never another store's.
 */
export default function AnalyticsScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, seller } = useBusiness();
  const [period, setPeriod] = useState<Period>("30");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = periodRange(period);
      setData(
        await request<Analytics>(
          `/vendor/agestyles/analytics?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
      );
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      setError(
        status === 403
          ? "Tu rol en esta tienda no permite ver el análisis."
          : "No se pudo cargar el análisis. Inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
    // The selected store changes what the server returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, period, seller?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const max = useMemo(
    () => Math.max(1, ...(data?.sales.daily ?? []).map((day) => day.amount)),
    [data],
  );
  const maxViews = useMemo(
    () => Math.max(1, ...(data?.traffic.daily ?? []).map((day) => day.views)),
    [data],
  );
  const pendingTotal = data
    ? data.pending_orders.unprepared +
      data.pending_orders.preparing +
      data.pending_orders.ready +
      data.pending_orders.shipped
    : 0;

  return (
    <OperationList
      skeleton="stats"
      backLabel="Más"
      title="Análisis"
      subtitle="Ventas, vistas y clics de tu tienda en el período elegido."
      loading={loading && !data}
      error={error}
      onRefresh={() => void load()}
    >
      <View style={styles.toolbar}>
        <PillGroup
          accessibilityLabel="Período"
          value={period}
          onChange={setPeriod}
          options={PERIODS}
        />
      </View>
      {data ? (
        <>
          <CardGrid minColumnWidth={200} maxColumns={4}>
            <Kpi
              label="Ventas"
              value={money(data.sales.amount)}
              change={data.sales.change.amount}
              detail={`Online ${money(data.sales.online_amount)} · En tienda ${money(data.sales.in_store_amount)}`}
            />
            <Kpi
              label="Pedidos"
              value={String(data.sales.count)}
              change={data.sales.change.count}
            />
            <Kpi label="Ticket medio" value={money(data.sales.average_ticket)} />
            <Kpi label="Unidades vendidas" value={String(data.sales.units)} />
          </CardGrid>

          <Section title="Ventas por día">
            <View style={styles.chart} accessibilityLabel="Gráfico de ventas por día">
              {data.sales.daily.map((day) => (
                <View
                  key={day.date}
                  style={styles.barSlot}
                  accessibilityLabel={`${day.date}: ${money(day.amount)}`}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(day.amount ? 4 : 1, (day.amount / max) * 100)}%`,
                        backgroundColor: day.amount ? theme.action : theme.border,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.axis}>
              <Text style={styles.muted}>
                {data.sales.daily[0]?.date.slice(5).split("-").reverse().join("/")}
              </Text>
              <Text style={styles.muted}>Máximo diario {money(max)}</Text>
              <Text style={styles.muted}>
                {data.sales.daily.at(-1)?.date.slice(5).split("-").reverse().join("/")}
              </Text>
            </View>
          </Section>

          <CardGrid minColumnWidth={200} maxColumns={4}>
            <Kpi label="Vistas de la tienda" value={String(data.traffic.store_views)} />
            <Kpi label="Vistas de productos" value={String(data.traffic.product_views)} />
            <Kpi label="Clics en productos" value={String(data.traffic.product_clicks)} />
            <Kpi
              label="CTR (clics / vistas)"
              value={data.traffic.ctr === null ? "—" : `${data.traffic.ctr} %`}
              detail={`${data.traffic.add_to_cart_clicks} clics en «Añadir al carrito»`}
            />
          </CardGrid>

          <Section title="Vistas por día">
            <Text style={[styles.pad, styles.muted]}>
              Vistas de la tienda y de sus productos, en la vitrina y en Tienda. Las vistas se
              cuentan desde que se publicó esta versión; los días anteriores muestran cero.
            </Text>
            <View style={styles.chart} accessibilityLabel="Gráfico de vistas por día">
              {data.traffic.daily.map((day) => (
                <View
                  key={day.date}
                  style={styles.barSlot}
                  accessibilityLabel={`${day.date}: ${day.views} vistas`}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(day.views ? 4 : 1, (day.views / maxViews) * 100)}%`,
                        backgroundColor: day.views ? theme.action : theme.border,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.axis}>
              <Text style={styles.muted}>
                {data.traffic.daily[0]?.date.slice(5).split("-").reverse().join("/")}
              </Text>
              <Text style={styles.muted}>Máximo diario {maxViews} vistas</Text>
              <Text style={styles.muted}>
                {data.traffic.daily.at(-1)?.date.slice(5).split("-").reverse().join("/")}
              </Text>
            </View>
          </Section>

          <CardGrid minColumnWidth={340}>
            <Section title={`Pedidos por atender (${pendingTotal})`}>
              <View style={styles.stages}>
                {(["unprepared", "preparing", "ready", "shipped"] as const).map((stage) => (
                  <View key={stage} style={styles.stage}>
                    <Text style={styles.stageValue}>{data.pending_orders[stage]}</Text>
                    <Text style={styles.muted}>{STAGE[stage]}</Text>
                  </View>
                ))}
              </View>
              {data.pending_orders.manual_payments ? (
                <Text style={[styles.pad, styles.warn]}>
                  {data.pending_orders.manual_payments} pago(s) manual(es) por verificar.
                </Text>
              ) : null}
              {data.pending_orders.oldest.map((order) => (
                <Pressable
                  key={order.id}
                  accessibilityRole="link"
                  onPress={() => router.push("/(tabs)/orders")}
                  style={styles.row}
                >
                  <Text style={styles.rowTitle}>
                    Pedido {order.display_id ? `#${order.display_id}` : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {STAGE[order.stage]} · hace {age(order.hours)}
                  </Text>
                </Pressable>
              ))}
            </Section>

            <Section title="Más vendidos">
              {data.top_products.length ? null : (
                <Text style={[styles.pad, styles.muted]}>Sin ventas en este período.</Text>
              )}
              {data.top_products.map((product, index) => (
                <ProductLine
                  key={product.product_id}
                  product={product}
                  lead={`${index + 1}`}
                  detail={`${product.units} uds · ${money(product.amount)}`}
                />
              ))}
            </Section>

            <Section title="Productos más vistos">
              <Text style={[styles.pad, styles.muted]}>
                Vistas, clics y pedidos del período. Un producto con muchas vistas y pocos pedidos
                se ve pero no se compra.
              </Text>
              {data.traffic.top_products.length ? null : (
                <Text style={[styles.pad, styles.muted]}>Sin vistas en este período.</Text>
              )}
              {data.traffic.top_products.map((product, index) => (
                <ProductLine
                  key={product.product_id}
                  product={product}
                  lead={`${index + 1}`}
                  detail={`${product.views} vistas · ${product.clicks} clics · CTR ${
                    product.ctr === null ? "—" : `${product.ctr} %`
                  } · ${product.add_to_cart} al carrito · ${product.orders} ${
                    product.orders === 1 ? "pedido" : "pedidos"
                  }`}
                />
              ))}
            </Section>

            <Section title="Próximos a agotarse">
              <Text style={[styles.pad, styles.muted]}>
                Sin stock o con menos de {data.thresholds.cover_days} días al ritmo de ventas de los
                últimos 30 días.
              </Text>
              {data.running_out.length ? null : (
                <Text style={[styles.pad, styles.muted]}>Nada a punto de agotarse.</Text>
              )}
              {data.running_out.map((product) => (
                <ProductLine
                  key={product.product_id}
                  product={product}
                  detail={
                    product.available <= 0
                      ? "Agotado"
                      : `${product.available} uds · ${product.days_left} ${product.days_left === 1 ? "día" : "días"} de stock`
                  }
                  alert={product.available <= 0}
                />
              ))}
            </Section>

            <Section title="Sin rotación">
              <Text style={[styles.pad, styles.muted]}>
                Con stock y sin ventas en {data.thresholds.stale_days} días o más.
              </Text>
              {data.stale_products.length ? null : (
                <Text style={[styles.pad, styles.muted]}>Todo lo que tiene stock se vende.</Text>
              )}
              {data.stale_products.map((product) => (
                <ProductLine
                  key={product.product_id}
                  product={product}
                  detail={`${product.available} uds · ${
                    product.days_without_sales === null
                      ? "sin ventas en 90 días"
                      : `${product.days_without_sales} días sin vender`
                  }`}
                />
              ))}
            </Section>

            {data.agents ? (
              <Section title="Gestores de venta">
                {data.agents.length ? null : (
                  <Text style={[styles.pad, styles.muted]}>
                    Sin ventas de gestores en este período.
                  </Text>
                )}
                {data.agents.map((agent) => (
                  <View key={agent.agent_id} style={styles.row}>
                    <Text style={styles.rowTitle}>{agent.name}</Text>
                    <Text style={styles.muted}>
                      {agent.count} {agent.count === 1 ? "venta" : "ventas"} · {money(agent.amount)}{" "}
                      · comisión {money(agent.commission)}
                    </Text>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push("/commissions")}
                  style={styles.row}
                >
                  <Text style={styles.link}>Ver comisiones, saldos y retiros</Text>
                </Pressable>
              </Section>
            ) : null}
          </CardGrid>
          <Text style={styles.muted}>
            La rentabilidad se añadirá cuando se registre el coste de compra de los productos.
          </Text>
        </>
      ) : null}
    </OperationList>
  );

  function Kpi({
    label,
    value,
    change,
    detail,
  }: {
    label: string;
    value: string;
    change?: number | null;
    detail?: string;
  }) {
    return (
      <View style={styles.kpi}>
        <Text style={styles.muted}>{label}</Text>
        <Text style={styles.kpiValue}>{value}</Text>
        {change !== undefined ? (
          <Text
            style={[
              styles.change,
              {
                color:
                  change === null ? theme.muted : change >= 0 ? theme.successText : theme.error,
              },
            ]}
          >
            {change === null
              ? "Sin datos del período anterior"
              : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)} % frente al período anterior`}
          </Text>
        ) : null}
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
    );
  }

  function ProductLine({
    product,
    detail,
    lead,
    alert,
  }: {
    product: ProductRow;
    detail: string;
    lead?: string;
    alert?: boolean;
  }) {
    return (
      <View style={styles.row}>
        <View style={styles.productRow}>
          {lead ? <Text style={styles.lead}>{lead}</Text> : null}
          <View style={styles.thumb}>
            {product.thumbnail ? (
              <Image
                source={{ uri: mediaVariant(product.thumbnail, 400) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {product.title}
            </Text>
            <Text style={[styles.muted, alert && styles.alert]}>{detail}</Text>
          </View>
        </View>
      </View>
    );
  }
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { marginBottom: 14 },
    kpi: {
      padding: 16,
      gap: 4,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      marginBottom: 12,
    },
    kpiValue: { color: theme.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
    change: { fontSize: 12, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    warn: { color: theme.error, fontSize: 13, fontWeight: "600" },
    alert: { color: theme.error, fontWeight: "600" },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    pad: { paddingHorizontal: 14, paddingTop: 10 },
    chart: {
      height: 140,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
    bar: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
    axis: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    stages: { flexDirection: "row", paddingHorizontal: 6, paddingTop: 12 },
    stage: { flex: 1, alignItems: "center", gap: 2 },
    stageValue: { color: theme.text, fontSize: 22, fontWeight: "700" },
    row: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 2,
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    productRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    lead: { color: theme.muted, fontSize: 13, fontWeight: "700", width: 18, textAlign: "right" },
    thumb: {
      width: 40,
      height: 40,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
    },
    flex: { flex: 1, gap: 2 },
    rowTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
  });
