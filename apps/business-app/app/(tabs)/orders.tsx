import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { hasPermission, OperationList, Row, Section } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { orderStatusLabel } from "../../lib/status-labels";

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

function progressLabel(order: Order) {
  const active = (order.fulfillments ?? []).filter((fulfillment) => !fulfillment.canceled_at);
  if (active.some((fulfillment) => fulfillment.delivered_at)) return "Entregado";
  if (active.some((fulfillment) => fulfillment.shipped_at)) return "Despachado";
  if (active.some((fulfillment) => fulfillment.packed_at)) return "Listo para envío";
  if (active.length) return "En preparación";
  return orderStatusLabel(order.fulfillment_status ?? order.status);
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
        <Section title={`${items.length} pedidos`}>
          {items.map((item) => (
            <Row
              key={item.id}
              title={`Pedido ${item.display_id ?? item.id.slice(-6)}`}
              detail={`${progressLabel(item)} · ${
                item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : ""
              }`}
              trailing={
                item.total != null
                  ? `${item.currency_code?.toUpperCase() ?? ""} ${item.total}`
                  : undefined
              }
              action={() => void openOrder(item)}
              disabled={detailLoading}
            />
          ))}
        </Section>
      ) : null}
      {detailLoading ? <Text style={styles.muted}>Cargando el detalle del pedido…</Text> : null}
      {selectedOrder ? (
        <Section
          title={`Detalle · Pedido ${selectedOrder.display_id ?? selectedOrder.id.slice(-6)}`}
        >
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
              <Pressable
                onPress={() => void prepareOrder()}
                disabled={!locationId || fulfilling || !locations.length}
                accessibilityRole="button"
                style={[
                  styles.primaryButton,
                  (!locationId || fulfilling || !locations.length) && styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {fulfilling ? "Iniciando…" : "Iniciar preparación"}
                </Text>
              </Pressable>
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
              <Pressable
                onPress={() => void advanceOrder(nextAction)}
                disabled={fulfilling}
                accessibilityRole="button"
                style={[styles.primaryButton, fulfilling && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>
                  {fulfilling
                    ? "Actualizando…"
                    : nextAction === "ready"
                      ? "Marcar como listo"
                      : nextAction === "dispatch"
                        ? "Marcar como despachado"
                        : "Confirmar entrega"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Section>
      ) : null}
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
    primaryButton: {
      minHeight: 50,
      borderRadius: 13,
      backgroundColor: theme.action,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 3,
      paddingHorizontal: 16,
    },
    disabledButton: { opacity: 0.5 },
    primaryButtonText: { color: theme.onAction, fontSize: 14, fontWeight: "600" },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  });
