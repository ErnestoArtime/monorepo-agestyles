import { Icon } from "@agestyles/icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OperationList, Section } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import {
  deliverCsv,
  formatMovementDate,
  MOVEMENT_PATH,
  MOVEMENT_TYPE_LABEL,
  MOVEMENT_TYPE_OPTIONS,
  movementErrorMessage,
  movementQuery,
  PERIOD_OPTIONS,
  type InventoryMovement,
  type MovementType,
  type Period,
} from "../lib/inventory-movements";

const PAGE_SIZE = 30;

export default function MovementsScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, requestText, seller } = useBusiness();
  const params = useLocalSearchParams<{ inventory_item_id?: string; title?: string }>();
  const inventoryItemId = params.inventory_item_id || undefined;
  const [type, setType] = useState<MovementType | undefined>();
  const [period, setPeriod] = useState<Period>("30");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (offset = 0) => {
      if (!seller) return;
      setLoading(true);
      setError("");
      try {
        const data = await request<{ inventory_movements: InventoryMovement[]; count: number }>(
          `${MOVEMENT_PATH}${movementQuery({ type, period, inventoryItemId, limit: PAGE_SIZE, offset })}`,
        );
        setMovements((current) =>
          offset ? [...current, ...data.inventory_movements] : data.inventory_movements,
        );
        setCount(data.count);
      } catch (cause) {
        setError(movementErrorMessage(cause, "No se pudo consultar el historial de movimientos."));
      } finally {
        setLoading(false);
      }
    },
    [inventoryItemId, period, request, seller, type],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const csv = await requestText(
        `${MOVEMENT_PATH}/export${movementQuery({ type, period, inventoryItemId })}`,
      );
      await deliverCsv(csv, `movimientos-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (cause) {
      setError(movementErrorMessage(cause, "No se pudo exportar el historial."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <OperationList
      title="Movimientos"
      subtitle={
        params.title
          ? `Historial de ${params.title}.`
          : "Altas, bajas, ventas y ajustes del inventario de tu tienda."
      }
      loading={loading && !movements.length}
      error={error}
      empty="No hay movimientos en este periodo."
      onRefresh={() => void load(0)}
    >
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al inventario"
          style={styles.toolbarButton}
        >
          <Icon name="arrowLeft" size={18} color={theme.action} />
          <Text style={styles.toolbarText}>Inventario</Text>
        </Pressable>
        <Pressable
          onPress={() => void exportCsv()}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Exportar movimientos a CSV"
          accessibilityState={{ busy: exporting, disabled: exporting }}
          style={[styles.toolbarButton, exporting && styles.disabled]}
        >
          <Icon name="arrowDown" size={18} color={theme.action} />
          <Text style={styles.toolbarText}>{exporting ? "Exportando…" : "Exportar CSV"}</Text>
        </Pressable>
      </View>

      <View
        style={styles.filters}
        accessibilityRole="radiogroup"
        accessibilityLabel="Tipo de movimiento"
      >
        {[{ value: undefined, label: "Todos" }, ...MOVEMENT_TYPE_OPTIONS].map((option) => {
          const selected = type === option.value;
          return (
            <Pressable
              key={option.label}
              onPress={() => setType(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Periodo">
        {PERIOD_OPTIONS.map((option) => {
          const selected = period === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setPeriod(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {movements.length ? (
        <Section title={`${count} movimientos`}>
          {movements.map((movement) => (
            <View key={movement.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {MOVEMENT_TYPE_LABEL[movement.type]} ·{" "}
                  {movement.title ?? movement.sku ?? "Artículo"}
                </Text>
                <Text style={styles.rowDetail}>
                  {formatMovementDate(movement.created_at)}
                  {movement.location_name ? ` · ${movement.location_name}` : ""}
                  {movement.actor_email ? ` · ${movement.actor_email}` : ""}
                </Text>
                {movement.reason ? (
                  <Text style={styles.rowDetail}>Motivo: {movement.reason}</Text>
                ) : null}
              </View>
              <View style={styles.amounts}>
                <Text
                  style={[styles.delta, movement.delta < 0 ? styles.negative : styles.positive]}
                  accessibilityLabel={`${movement.delta > 0 ? "Más" : "Menos"} ${Math.abs(movement.delta)} unidades`}
                >
                  {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                </Text>
                <Text style={styles.rowDetail}>
                  {movement.quantity_before} → {movement.quantity_after}
                </Text>
              </View>
            </View>
          ))}
          {movements.length < count ? (
            <Pressable
              onPress={() => void load(movements.length)}
              disabled={loading}
              accessibilityRole="button"
              style={[styles.more, loading && styles.disabled]}
            >
              <Text style={styles.toolbarText}>{loading ? "Cargando…" : "Cargar más"}</Text>
            </Pressable>
          ) : null}
        </Section>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    toolbarButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 4,
    },
    toolbarText: { color: theme.action, fontSize: 14, fontWeight: "500" },
    disabled: { opacity: 0.5 },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      justifyContent: "center",
    },
    chipSelected: { backgroundColor: theme.action, borderColor: theme.action },
    chipText: { color: theme.text, fontSize: 13 },
    chipTextSelected: { color: theme.onAction, fontWeight: "600" },
    row: {
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowText: { flex: 1, gap: 3 },
    rowTitle: { color: theme.text, fontSize: 14, fontWeight: "500" },
    rowDetail: { color: theme.muted, fontSize: 12 },
    amounts: { alignItems: "flex-end", gap: 3 },
    delta: { fontSize: 16, fontWeight: "600" },
    positive: { color: theme.success },
    negative: { color: theme.error },
    more: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  });
