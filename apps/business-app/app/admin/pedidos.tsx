import { useLocalSearchParams, useRouter } from "expo-router";
import { ManagementPager, ManagementPanel } from "../../components/management-list";
import { Button, ConfirmDialog, PillGroup, SearchField } from "@agestyles/ui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, money, shortDate } from "../../lib/admin";
import { OrderDirectory } from "../../components/order-directory";
import { OrderDetails } from "../../components/order-details";
import { useResponsive } from "../../hooks/use-responsive";
import {
  orderTitle,
  ORDER_DETAIL_FIELDS,
  ORDER_PROGRESS_FIELDS,
  type BusinessOrder as Order,
} from "../../lib/order-details";

const PAGE_SIZE = 20;

type ManualPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency_code: string;
  method: string;
  reference: string;
  receipt_url: string | null;
  notes: string | null;
  status: string;
  created_at?: string;
};

const METHOD: Record<string, string> = {
  transfer: "Transferencia",
  deposit: "Depósito",
  cash: "Efectivo",
  other: "Otro",
};

/**
 * Every order of the marketplace, and the manual payments waiting for verification: the
 * administration confirms the money arrived (or rejects the proof with a reason for the buyer).
 */
export default function AdminOrdersScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const { isWideWeb } = useResponsive();
  const router = useRouter();
  const { pedido } = useLocalSearchParams<{ pedido?: string }>();
  const detailId =
    typeof pedido === "string" && /^order_[a-z0-9_-]+$/i.test(pedido) ? pedido : null;
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailError, setDetailError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const loadVersion = useRef(0);
  const [status, setStatus] = useState("all");
  const [verify, setVerify] = useState<ManualPayment | null>(null);
  const [rejecting, setRejecting] = useState<ManualPayment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim().replace(/^#(?=\d)/, ""));
      setOffset(0);
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        order: "-created_at",
        fields: `${ORDER_PROGRESS_FIELDS},seller.name`,
      });
      if (status !== "all") params.set("status", status);
      if (search) params.set(search.startsWith("order_") ? "id" : "q", search);
      const [orderData, paymentData] = await Promise.all([
        adminRequest<{ orders: Order[]; count?: number }>(`/admin/orders?${params}`),
        adminRequest<{ manual_payments: ManualPayment[] }>("/admin/manual-payments?status=pending"),
      ]);
      if (version !== loadVersion.current) return;
      setOrders(orderData.orders ?? []);
      setCount(orderData.count ?? orderData.orders?.length ?? 0);
      setPayments(paymentData.manual_payments ?? []);
    } catch (cause) {
      if (version === loadVersion.current)
        setError(adminError(cause, "No se pudieron cargar los pedidos."));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [adminRequest, offset, search, status]);

  useEffect(() => {
    const versionRef = loadVersion;
    void load();
    return () => {
      versionRef.current++;
    };
  }, [load]);

  useEffect(() => {
    if (!detailId) return;
    let active = true;
    setDetail(null);
    setDetailError("");
    adminRequest<{ order?: Order }>(
      `/admin/orders/${detailId}?fields=${ORDER_DETAIL_FIELDS},seller.name`,
    )
      .then(({ order }) => {
        if (!order) throw new Error("Pedido no disponible");
        if (active) setDetail(order);
      })
      .catch((cause) => {
        if (active) setDetailError(adminError(cause, "No se pudo abrir el pedido."));
      });
    return () => {
      active = false;
    };
  }, [adminRequest, detailId]);

  const orderNumber = (orderId: string) =>
    orders.find((order) => order.id === orderId)?.display_id ?? orderId.slice(-6);

  async function confirmVerify() {
    const payment = verify;
    setVerify(null);
    if (!payment) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/manual-payments/${payment.id}/verify`, "POST", {});
      setNotice(`Pago del pedido #${orderNumber(payment.order_id)} verificado.`);
      await load();
    } catch (cause) {
      setError(
        adminError(cause, "No se pudo verificar: comprueba que el importe coincide con el pedido."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject(payment: ManualPayment) {
    if (!reason.trim()) {
      setError("Indica el motivo del rechazo; se lo mostraremos al comprador.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/manual-payments/${payment.id}/reject`, "POST", {
        reason: reason.trim(),
      });
      setRejecting(null);
      setReason("");
      setNotice(`Pago del pedido #${orderNumber(payment.order_id)} rechazado.`);
      await load();
    } catch (cause) {
      setError(adminError(cause, "No se pudo rechazar el pago."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OperationList
      title="Pedidos"
      subtitle="Todos los pedidos del marketplace y los pagos por verificar."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      {payments.length ? (
        <Section title={`Pagos por verificar (${payments.length})`}>
          {payments.length ? (
            payments.map((payment) => (
              <View key={payment.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    Pedido #{orderNumber(payment.order_id)} ·{" "}
                    {money(payment.amount, payment.currency_code)}
                  </Text>
                  <Text style={styles.muted}>
                    {METHOD[payment.method] ?? "Pago"} · referencia {payment.reference}
                    {payment.created_at ? ` · ${shortDate(payment.created_at)}` : ""}
                  </Text>
                  {payment.notes ? <Text style={styles.muted}>Nota: {payment.notes}</Text> : null}
                  {payment.receipt_url ? (
                    <Pressable
                      onPress={() => void Linking.openURL(payment.receipt_url as string)}
                      accessibilityRole="link"
                    >
                      <Text style={styles.link}>Ver comprobante</Text>
                    </Pressable>
                  ) : null}
                  {rejecting?.id === payment.id ? (
                    <View style={styles.reject}>
                      <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Motivo para el comprador (p. ej., el importe no coincide)"
                        placeholderTextColor={theme.muted}
                        accessibilityLabel="Motivo del rechazo"
                        style={styles.input}
                      />
                      <View style={styles.actions}>
                        <Button
                          title="Rechazar pago"
                          variant="secondary"
                          onPress={() => void confirmReject(payment)}
                          loading={busy}
                        />
                        <Pressable onPress={() => setRejecting(null)} accessibilityRole="button">
                          <Text style={styles.link}>Cancelar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
                {rejecting?.id === payment.id ? null : (
                  <View style={styles.side}>
                    <Button title="Verificar" onPress={() => setVerify(payment)} />
                    <Pressable
                      onPress={() => {
                        setRejecting(payment);
                        setReason("");
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.danger}>Rechazar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={[styles.muted, styles.pad]}>No hay pagos esperando verificación.</Text>
          )}
        </Section>
      ) : null}

      <Section title={`Pedidos (${count})`}>
        <View style={styles.pad}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por número o correo"
          />
          <PillGroup
            accessibilityLabel="Estado del pedido"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setOffset(0);
            }}
            options={[
              { value: "all", label: "Todos" },
              { value: "pending", label: "Pendientes" },
              { value: "completed", label: "Completados" },
              { value: "canceled", label: "Cancelados" },
            ]}
          />
        </View>
        {orders.length ? (
          <OrderDirectory
            caption="Pedidos del marketplace"
            orders={orders}
            onOpen={(order) => router.setParams({ pedido: order.id })}
          />
        ) : null}
        {!orders.length ? (
          <Text style={[styles.muted, styles.pad]}>No hay pedidos que coincidan.</Text>
        ) : null}
        <ManagementPager
          count={count}
          offset={offset}
          limit={PAGE_SIZE}
          loading={loading}
          onChange={setOffset}
        />
      </Section>

      {detailId ? (
        <ManagementPanel
          wide={isWideWeb}
          fullScreen
          title={detail ? orderTitle(detail) : "Detalle del pedido"}
          onClose={() => router.setParams({ pedido: "" })}
        >
          {detail ? (
            <OrderDetails order={detail} />
          ) : (
            <Text accessibilityLiveRegion="polite" style={[styles.muted, styles.pad]}>
              {detailError || "Cargando el detalle…"}
            </Text>
          )}
        </ManagementPanel>
      ) : null}

      <ConfirmDialog
        visible={!!verify}
        tone="warning"
        title="Verificar pago"
        message={
          verify
            ? `Confirmas que llegaron ${money(verify.amount, verify.currency_code)} del pedido #${orderNumber(verify.order_id)} (referencia ${verify.reference}).`
            : ""
        }
        primary={{ label: "Sí, verificar", onPress: () => void confirmVerify() }}
        secondary={{ label: "Cancelar", onPress: () => setVerify(null) }}
        onClose={() => setVerify(null)}
      />
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    pad: { padding: 14, gap: 10 },
    row: {
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    flex: { flex: 1, gap: 3 },
    side: { alignItems: "flex-end", gap: 8 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    danger: { color: theme.error, fontSize: 14, fontWeight: "600" },
    reject: { gap: 8, marginTop: 8 },
    actions: { flexDirection: "row", alignItems: "center", gap: 14 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 15,
    },
  });
