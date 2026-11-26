import { ManagementPager, ManagementPanel } from "../../components/management-list";
import { useNotice } from "../../hooks/use-notice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderDirectory } from "../../components/order-directory";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { hasPermission, OperationList, Row, Section } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { OrderDetails } from "../../components/order-details";
import { useResponsive } from "../../hooks/use-responsive";
import {
  deliveryLines,
  orderDeliveryStatus,
  orderTitle,
  ORDER_DETAIL_FIELDS,
  ORDER_PROGRESS_FIELDS,
  type BusinessOrder as Order,
  type DeliveryStage as Stage,
} from "../../lib/order-details";
import { Button, PillGroup } from "@agestyles/ui-native";

const PAGE_SIZE = 20;

type StockLocation = { id: string; name: string };

const STAGE_FILTERS: { value: Stage | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "preparing", label: "En preparación" },
  { value: "ready", label: "Listos" },
  { value: "dispatched", label: "Despachados" },
  { value: "partial", label: "Entrega parcial" },
  { value: "delivered", label: "Entregados" },
];

export default function OrdersScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { isWideWeb } = useResponsive();
  const { request, seller, member } = useBusiness();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const [detailStale, setDetailStale] = useState(false);
  const storeScope = useRef(seller?.id);
  const loadVersion = useRef(0);
  const sellerId = seller?.id;
  const [detailLoading, setDetailLoading] = useState(false);
  const [fulfilling, setFulfilling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const canFulfill = hasPermission(member, "orders", "edit");
  const canOperate = canFulfill && !detailStale && selectedOrder?.status !== "canceled";
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");

  const load = useCallback(async () => {
    if (!sellerId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const data = await request<{ orders?: Order[]; count?: number }>(
        `/vendor/orders?limit=${PAGE_SIZE}&offset=${offset}&order=-created_at&fields=${ORDER_PROGRESS_FIELDS}`,
      );
      if (version !== loadVersion.current || storeScope.current !== sellerId) return;
      setItems(data?.orders ?? []);
      setCount(data?.count ?? data?.orders?.length ?? 0);
    } catch {
      if (version === loadVersion.current)
        setError("Tu rol no puede consultar los pedidos de esta tienda.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [request, sellerId, offset]);

  useEffect(() => {
    storeScope.current = sellerId;
    setSelectedOrder(null);
    setLocations([]);
    setLocationId("");
    setItems([]);
    setCount(0);
    setOffset(0);
    setDetailLoading(false);
    setFulfilling(false);
    setStageFilter("all");
  }, [sellerId]);

  useEffect(() => {
    const versionRef = loadVersion;
    void load();
    return () => {
      versionRef.current++;
    };
  }, [load]);

  const outstanding = useMemo(
    () =>
      selectedOrder ? deliveryLines(selectedOrder, false).filter((line) => line.remaining > 0) : [],
    [selectedOrder],
  );

  async function fetchDetail(id: string) {
    const detail = await request<{ order?: Order }>(
      `/vendor/orders/${id}?fields=${ORDER_DETAIL_FIELDS}`,
    );
    if (!detail.order) throw new Error("Pedido no disponible");
    return detail.order;
  }

  async function openOrder(order: Order) {
    setDetailLoading(true);
    setError("");
    setNotice("");
    try {
      const [detail, locationData] = await Promise.all([
        fetchDetail(order.id),
        canFulfill
          ? request<{ stock_locations?: StockLocation[] }>(
              "/vendor/stock-locations?limit=50&fields=id,name",
            )
          : null,
      ]);
      if (storeScope.current !== sellerId) return;
      setDetailStale(false);
      const choices = locationData?.stock_locations ?? [];
      setLocations(choices);
      setLocationId(choices.length === 1 ? choices[0].id : "");
      setSelectedOrder(detail);
    } catch {
      if (storeScope.current === sellerId) setError("No se pudo abrir el pedido.");
    } finally {
      if (storeScope.current === sellerId) setDetailLoading(false);
    }
  }

  async function refreshAfterChange(order: Order) {
    try {
      const detail = await fetchDetail(order.id);
      if (storeScope.current !== sellerId) return;
      setDetailStale(false);
      setError("");
      setSelectedOrder((current) => (current?.id === detail.id ? detail : current));
      setItems((current) => current.map((entry) => (entry.id === detail.id ? detail : entry)));
    } catch {
      if (storeScope.current !== sellerId) return;
      setDetailStale(true);
      setError("Se guardó el cambio, pero no se pudo actualizar el detalle.");
    }
  }

  async function prepareOrder() {
    if (!canOperate || !selectedOrder || !locationId || !outstanding.length || fulfilling) return;
    setFulfilling(true);
    setError("");
    setNotice("");
    try {
      await request(`/vendor/agestyles/orders/${selectedOrder.id}/fulfillments`, "POST", {
        action: "start",
        location_id: locationId,
        items: outstanding.map((item) => ({ id: item.id, quantity: item.remaining })),
      });
      if (storeScope.current !== sellerId) return;
      setNotice(
        `Pedido ${selectedOrder.display_id ?? selectedOrder.id.slice(-6)}: preparación iniciada.`,
      );
      await refreshAfterChange(selectedOrder);
    } catch {
      if (storeScope.current === sellerId) setError("No se pudo preparar el pedido.");
    } finally {
      if (storeScope.current === sellerId) setFulfilling(false);
    }
  }

  const activeFulfillment = [...(selectedOrder?.fulfillments ?? [])]
    .reverse()
    .find((fulfillment) => !fulfillment.canceled_at && !fulfillment.delivered_at);
  const nextAction = activeFulfillment
    ? activeFulfillment.shipped_at
      ? "deliver"
      : activeFulfillment.packed_at
        ? "dispatch"
        : "ready"
    : null;

  async function advanceOrder(action: "ready" | "dispatch" | "deliver") {
    if (!canOperate || !selectedOrder || !activeFulfillment || fulfilling) return;
    setFulfilling(true);
    setError("");
    setNotice("");
    try {
      await request(`/vendor/agestyles/orders/${selectedOrder.id}/fulfillments`, "POST", {
        action,
        fulfillment_id: activeFulfillment.id,
      });
      if (storeScope.current !== sellerId) return;
      const labels = {
        ready: "Preparación del envío completada.",
        dispatch: "Despacho del envío registrado.",
        deliver: "Entrega del envío registrada.",
      };
      setNotice(labels[action]);
      await refreshAfterChange(selectedOrder);
    } catch {
      if (storeScope.current === sellerId) setError("No se pudo actualizar la etapa del pedido.");
    } finally {
      if (storeScope.current === sellerId) setFulfilling(false);
    }
  }

  const visible = items.filter(
    (order) => stageFilter === "all" || orderDeliveryStatus(order).stage === stageFilter,
  );

  return (
    <OperationList
      title="Pedidos"
      subtitle="Consulta los pedidos de la tienda y prepara los artículos pendientes de envío."
      loading={loading}
      error={selectedOrder ? "" : error}
      empty="No hay pedidos para mostrar."
      isEmpty={!items.length}
      onRefresh={() => void load()}
    >
      {notice && !selectedOrder ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {items.length ? (
        <View style={styles.filters}>
          {count > PAGE_SIZE ? (
            <Text style={{ color: theme.muted }}>Etapa en esta página</Text>
          ) : null}
          <PillGroup
            accessibilityLabel="Filtrar por etapa en esta página"
            value={stageFilter}
            onChange={setStageFilter}
            options={STAGE_FILTERS}
          />
        </View>
      ) : null}
      {items.length ? (
        <Section title="Pedidos de la tienda">
          <OrderDirectory
            caption="Pedidos de la tienda"
            orders={visible}
            onOpen={(order) => {
              if (!detailLoading) void openOrder(order);
            }}
          />
          {!visible.length ? <Text style={styles.muted}>No hay pedidos en esta etapa.</Text> : null}
          <ManagementPager
            count={count}
            offset={offset}
            limit={PAGE_SIZE}
            loading={loading}
            onChange={setOffset}
          />
        </Section>
      ) : null}
      {detailLoading ? <Text style={styles.muted}>Cargando el detalle del pedido…</Text> : null}
      {selectedOrder ? (
        <ManagementPanel
          wide={isWideWeb}
          fullScreen
          title={orderTitle(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
        >
          <OrderDetails order={selectedOrder} storeName={seller?.name}>
            {detailStale ? (
              <Button
                title="Actualizar detalle"
                variant="secondary"
                onPress={() => void refreshAfterChange(selectedOrder)}
              />
            ) : null}
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.muted}>
                {error}
              </Text>
            ) : null}
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
              {canOperate && outstanding.length && !activeFulfillment ? (
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
              {canOperate && activeFulfillment && nextAction ? (
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
          </OrderDetails>
        </ManagementPanel>
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
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    filters: { marginBottom: 12 },
  });
