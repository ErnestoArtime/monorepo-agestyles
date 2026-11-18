import { Button, ConfirmDialog, PillGroup, SearchField, StatusBadge } from "@agestyles/ui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, money, ORDER_STATUS, PAYMENT_STATUS, shortDate } from "../../lib/admin";

type Order = {
  id: string;
  display_id?: number;
  status?: string;
  total?: number;
  currency_code?: string;
  email?: string | null;
  created_at?: string;
  payment_status?: string;
};
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [verify, setVerify] = useState<ManualPayment | null>(null);
  const [rejecting, setRejecting] = useState<ManualPayment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderData, paymentData] = await Promise.all([
        adminRequest<{ orders: Order[] }>(
          "/admin/orders?limit=100&order=-created_at&fields=id,display_id,status,total,currency_code,email,created_at,payment_status",
        ),
        adminRequest<{ manual_payments: ManualPayment[] }>("/admin/manual-payments?status=pending"),
      ]);
      setOrders(orderData.orders ?? []);
      setPayments(paymentData.manual_payments ?? []);
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar los pedidos."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      orders.filter(
        (order) =>
          (status === "all" || order.status === status) &&
          (!query.trim() ||
            `${order.display_id ?? ""} ${order.email ?? ""} ${order.id}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [orders, query, status],
  );
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

      <Section title={`Pedidos (${visible.length})`}>
        <View style={styles.pad}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por número o correo"
          />
          <PillGroup
            accessibilityLabel="Estado del pedido"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Todos" },
              { value: "pending", label: "Pendientes" },
              { value: "completed", label: "Completados" },
              { value: "canceled", label: "Cancelados" },
            ]}
          />
        </View>
        {visible.map((order) => {
          const payment = PAYMENT_STATUS[order.payment_status ?? ""];
          return (
            <View key={order.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>
                  Pedido #{order.display_id ?? order.id.slice(-6)} ·{" "}
                  {money(order.total, order.currency_code)}
                </Text>
                <Text style={styles.muted}>
                  {order.email ?? "Sin correo"}
                  {order.created_at ? ` · ${shortDate(order.created_at)}` : ""}
                </Text>
              </View>
              <StatusBadge
                label={ORDER_STATUS[order.status ?? ""] ?? "Sin estado"}
                tone={
                  order.status === "canceled"
                    ? "error"
                    : order.status === "completed"
                      ? "success"
                      : "neutral"
                }
              />
              {payment ? <StatusBadge label={payment.label} tone={payment.tone} /> : null}
            </View>
          );
        })}
        {!visible.length ? (
          <Text style={[styles.muted, styles.pad]}>No hay pedidos que coincidan.</Text>
        ) : null}
      </Section>

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
