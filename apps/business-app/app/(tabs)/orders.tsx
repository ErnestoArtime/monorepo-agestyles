import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { hasPermission, OperationList, Row, Section } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { orderStatusLabel } from "../../lib/status-labels";
import {
  BottomSheet,
  Button,
  Card,
  PillGroup,
  StatusBadge,
  type BadgeTone,
} from "@agestyles/ui-native";
import type { IconName } from "@agestyles/icons";

type Order = {
  id: string;
  display_id?: number | string;
  status?: string;
  fulfillment_status?: string;
  created_at?: string;
  currency_code?: string;
  total?: number;
  fulfillments?: {
    id: string;
    packed_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
    canceled_at?: string | null;
  }[];
};

type OrderDetails = Order & {
  items?: { id: string; title?: string; variant_title?: string; quantity: number }[];
  fulfillments?: {
    id: string;
    packed_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
    canceled_at?: string | null;
    items?: { line_item_id?: string | null; quantity: number }[];
  }[];
};

type StockLocation = { id: string; name: string };

type Stage = "pending" | "preparing" | "ready" | "dispatched" | "delivered" | "other";

/** Stage, Spanish label, badge tone and icon of an order (AG-04 lifecycle). */
function progressView(order: Order): {
  stage: Stage;
  label: string;
  tone: BadgeTone;
  icon: IconName;
} {
  const active = (order.fulfillments ?? []).filter((fulfillment) => !fulfillment.canceled_at);
  if (active.some((fulfillment) => fulfillment.delivered_at))
    return { stage: "delivered", label: "Entregado", tone: "success", icon: "check" };
  if (active.some((fulfillment) => fulfillment.shipped_at))
    return { stage: "dispatched", label: "Despachado", tone: "neutral", icon: "truck" };
  if (active.some((fulfillment) => fulfillment.packed_at))
    return { stage: "ready", label: "Listo para envío", tone: "neutral", icon: "package" };
  if (active.length)
    return { stage: "preparing", label: "En preparación", tone: "warning", icon: "package" };
  if (order.status === "canceled")
    return { stage: "other", label: "Cancelado", tone: "error", icon: "close" };
  return {
    stage: "pending",
    label: orderStatusLabel(order.fulfillment_status ?? order.status),
    tone: "warning",
    icon: "alert",
  };
}

const STAGE_FILTERS: { value: Stage | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "preparing", label: "En preparación" },
  { value: "ready", label: "Listos" },
  { value: "dispatched", label: "Despachados" },
  { value: "delivered", label: "Entregados" },
];

function money(amount: number | undefined, currency: string | undefined) {
  if (amount == null) return "";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
  }).format(amount);
}

function remainingItems(order: OrderDetails) {
  const fulfilled = new Map<string, number>();
  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.canceled_at) continue;
    for (const item of fulfillment.items ?? []) {
      if (item.line_item_id) {
        fulfilled.set(
          item.line_item_id,
          (fulfilled.get(item.line_item_id) ?? 0) + Number(item.quantity),
        );
      }
    }
  }
  return (order.items ?? [])
    .map((item) => ({
      ...item,
      remaining: Math.max(0, Number(item.quantity) - (fulfilled.get(item.id) ?? 0)),
    }))
    .filter((item) => item.remaining > 0);
}

export default function OrdersScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { request, seller, member } = useBusiness();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fulfilling, setFulfilling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const canFulfill = hasPermission(member, "orders", "edit");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    try {
      const data = await request<{ orders?: Order[] }>(
        "/vendor/orders?limit=50&fields=id,display_id,status,fulfillment_status,created_at,currency_code,total,fulfillments.id,fulfillments.packed_at,fulfillments.shipped_at,fulfillments.delivered_at,fulfillments.canceled_at",
      );
      setItems(data?.orders ?? []);
    } catch {
      setError("Tu rol no puede consultar los pedidos de esta tienda.");
    } finally {
      setLoading(false);
    }
  }, [request, seller]);

  useEffect(() => {
    setSelectedOrder(null);
    setLocations([]);
    setLocationId("");
    void load();
  }, [load]);

  const outstanding = useMemo(
    () => (selectedOrder ? remainingItems(selectedOrder) : []),
    [selectedOrder],
  );

  async function openOrder(order: Order) {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
      return;
    }
    setDetailLoading(true);
    setError("");
    setNotice("");
    try {
      const detail = await request<{ order?: OrderDetails }>(
        `/vendor/orders/${order.id}?fields=id,display_id,status,fulfillment_status,items.id,items.title,items.variant_title,items.quantity,fulfillments.id,fulfillments.packed_at,fulfillments.shipped_at,fulfillments.delivered_at,fulfillments.canceled_at,fulfillments.items.line_item_id,fulfillments.items.quantity`,
      );
      setSelectedOrder(detail.order ?? null);
      setLocationId("");
      if (canFulfill) {
        const locationData = await request<{ stock_locations?: StockLocation[] }>(
          "/vendor/stock-locations?limit=50&fields=id,name",
        );
        const choices = locationData.stock_locations ?? [];
        setLocations(choices);
        if (choices.length === 1) setLocationId(choices[0].id);
      } else {
        setLocations([]);
      }
    } catch {
      setSelectedOrder(null);
      setError("No se pudo abrir el pedido.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function prepareOrder() {
    if (!canFulfill || !selectedOrder || !locationId || !outstanding.length || fulfilling) return;
    setFulfilling(true);
    setError("");
    setNotice("");
    try {
      await request(`/vendor/agestyles/orders/${selectedOrder.id}/fulfillments`, "POST", {
        action: "start",
        location_id: locationId,
        items: outstanding.map((item) => ({ id: item.id, quantity: item.remaining })),
      });
      setNotice(
        `Pedido ${selectedOrder.display_id ?? selectedOrder.id.slice(-6)}: preparación iniciada.`,
      );
      setSelectedOrder(null);
      await load();
    } catch {
      setError("No se pudo preparar el pedido.");
    } finally {
      setFulfilling(false);
    }
  }

  const activeFulfillment = [...(selectedOrder?.fulfillments ?? [])]
    .reverse()
    .find((fulfillment) => !fulfillment.canceled_at);
  const nextAction = activeFulfillment
    ? activeFulfillment.delivered_at
      ? null
      : activeFulfillment.shipped_at
        ? "deliver"
        : activeFulfillment.packed_at
          ? "dispatch"
          : "ready"
    : null;

  async function advanceOrder(action: "ready" | "dispatch" | "deliver") {
    if (!canFulfill || !selectedOrder || !activeFulfillment || fulfilling) return;
    setFulfilling(true);
    setError("");
    setNotice("");
    try {
      await request(`/vendor/agestyles/orders/${selectedOrder.id}/fulfillments`, "POST", {
        action,
        fulfillment_id: activeFulfillment.id,
      });
      const labels = { ready: "listo para envío", dispatch: "despachado", deliver: "entregado" };
      setNotice(
        `Pedido ${selectedOrder.display_id ?? selectedOrder.id.slice(-6)}: ${labels[action]}.`,
      );
      setSelectedOrder(null);
      await load();
    } catch {
      setError("No se pudo actualizar la etapa del pedido.");
    } finally {
      setFulfilling(false);
    }
  }

  return (
    <OperationList
      title="Pedidos"
      subtitle="Consulta los pedidos de la tienda y prepara los artículos pendientes de envío."
      loading={loading}
      error={error}
      empty="No hay pedidos para mostrar."
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {items.length ? (
        <View style={styles.filters}>
          <PillGroup
            accessibilityLabel="Filtrar por estado"
            value={stageFilter}
            onChange={setStageFilter}
            options={STAGE_FILTERS}
          />
        </View>
      ) : null}
      {items.length ? (
        <View style={styles.cards}>
          {items
            .filter((item) => stageFilter === "all" || progressView(item).stage === stageFilter)
            .map((item) => {
              const view = progressView(item);
              return (
                <Card
                  key={item.id}
                  onPress={detailLoading ? undefined : () => void openOrder(item)}
                  accessibilityLabel={`Pedido ${item.display_id ?? item.id.slice(-6)}, ${view.label}`}
                >
                  <View style={styles.cardLine}>
                    <Text style={styles.cardTitle}>
                      Pedido #{item.display_id ?? item.id.slice(-6)}
                    </Text>
                    <Text style={styles.cardDate}>
                      {item.created_at
                        ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(
                            new Date(item.created_at),
                          )
                        : ""}
                    </Text>
                  </View>
                  <View style={styles.cardLine}>
                    <Text style={styles.cardTotal}>{money(item.total, item.currency_code)}</Text>
                    <StatusBadge label={view.label} tone={view.tone} icon={view.icon} />
                  </View>
                </Card>
              );
            })}
        </View>
      ) : null}
      {detailLoading ? <Text style={styles.muted}>Cargando el detalle del pedido…</Text> : null}
      <BottomSheet
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `Pedido #${selectedOrder.display_id ?? selectedOrder.id.slice(-6)}`
            : undefined
        }
      >
        {selectedOrder ? (
          <Section title="Artículos por preparar">
            {outstanding.length ? (
              outstanding.map((item) => (
                <Row
                  key={item.id}
                  title={item.title ?? "Artículo"}
                  detail={
                    item.variant_title
                      ? `${item.variant_title} · ${item.remaining} por preparar`
                      : `${item.remaining} por preparar`
                  }
                />
              ))
            ) : (
              <Text style={styles.muted}>
                Todos los artículos de este pedido ya tienen preparación registrada.
              </Text>
            )}
            {canFulfill && outstanding.length && !activeFulfillment ? (
              <View style={styles.fulfillmentPanel}>
                <Text style={styles.panelTitle}>Ubicación de preparación</Text>
                {locations.length ? (
                  locations.map((location) => (
                    <Pressable
                      key={location.id}
                      onPress={() => setLocationId(location.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: locationId === location.id }}
                      accessibilityLabel={location.name}
                      style={[
                        styles.locationChoice,
                        locationId === location.id && styles.locationSelected,
                      ]}
                    >
                      <Icon
                        name={locationId === location.id ? "check" : "warehouse"}
                        size={19}
                        color={locationId === location.id ? theme.action : theme.muted}
                      />
                      <Text style={styles.locationText}>{location.name}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.muted}>Esta tienda no tiene almacenes habilitados.</Text>
                )}
                <Button
                  title="Iniciar preparación"
                  onPress={() => void prepareOrder()}
                  loading={fulfilling}
                  disabled={!locationId || !locations.length}
                />
              </View>
            ) : null}
            {canFulfill && activeFulfillment && nextAction ? (
              <View style={styles.fulfillmentPanel}>
                <Text style={styles.panelTitle}>
                  Etapa actual:{" "}
                  {activeFulfillment.shipped_at
                    ? "Despachado"
                    : activeFulfillment.packed_at
                      ? "Listo para envío"
                      : "En preparación"}
                </Text>
                <Button
                  title={
                    nextAction === "ready"
                      ? "Marcar como listo"
                      : nextAction === "dispatch"
                        ? "Marcar como despachado"
                        : "Confirmar entrega"
                  }
                  onPress={() => void advanceOrder(nextAction)}
                  loading={fulfilling}
                />
              </View>
            ) : null}
          </Section>
        ) : null}
      </BottomSheet>
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    muted: { color: theme.muted, fontSize: 14, lineHeight: 20, padding: 16 },
    fulfillmentPanel: {
      padding: 14,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    panelTitle: { color: theme.text, fontSize: 14, fontWeight: "600", marginBottom: 2 },
    locationChoice: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.surface,
    },
    locationSelected: { borderColor: theme.action, backgroundColor: theme.selectedSurface },
    locationText: { color: theme.text, fontSize: 14, flex: 1 },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    filters: { marginBottom: 12 },
    cards: { gap: 12 },
    cardLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    cardTitle: { color: theme.text, fontSize: 17, fontWeight: "600" },
    cardDate: { color: theme.muted, fontSize: 13 },
    cardTotal: { color: theme.text, fontSize: 15, fontWeight: "600" },
  });
