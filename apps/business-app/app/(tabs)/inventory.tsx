import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OperationList, Section, hasPermission } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";

type InventoryItem = {
  id: string;
  title?: string;
  sku?: string;
  location_levels?: {
    id?: string;
    location_id?: string;
    stocked_quantity?: number;
    location?: { name?: string };
  }[];
};

export default function InventoryScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { request, seller, member } = useBusiness();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const editable = hasPermission(member, "inventory_items", "edit");
  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await request<any>(
        "/vendor/inventory-items?limit=50&fields=id,title,sku,location_levels.id,location_levels.location_id,location_levels.stocked_quantity,location_levels.location.name",
      );
      setItems(data?.inventory_items ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo consultar el inventario de esta tienda.",
      );
    } finally {
      setLoading(false);
    }
  }, [request, seller]);
  useEffect(() => {
    void load();
  }, [load]);

  async function adjust(
    item: InventoryItem,
    level: NonNullable<InventoryItem["location_levels"]>[number],
    delta: number,
  ) {
    if (!editable || !level.location_id) return;
    const quantity = Math.max(0, Number(level.stocked_quantity ?? 0) + delta);
    setSaving(item.id);
    setNotice("");
    setError("");
    try {
      await request(
        `/vendor/inventory-items/${item.id}/location-levels/${level.location_id}`,
        "POST",
        { stocked_quantity: quantity },
      );
      setNotice(`Stock actualizado: ${item.title ?? item.sku ?? "artículo"}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el stock.");
    } finally {
      setSaving("");
    }
  }

  return (
    <OperationList
      title="Inventario"
      subtitle={
        editable
          ? "Consulta y ajusta las existencias de tu tienda."
          : "Consulta las existencias disponibles para tu rol."
      }
      loading={loading}
      error={error}
      empty="No hay artículos de inventario para mostrar."
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {items.length ? (
        <Section title={`${items.length} artículos`}>
          {items.map((item) =>
            (item.location_levels?.length
              ? item.location_levels
              : [{ stocked_quantity: undefined }]
            ).map((level, index) => (
              <View key={`${item.id}-${level.location_id ?? index}`} style={styles.itemRow}>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemTitle}>{item.title ?? item.sku ?? "Artículo"}</Text>
                  <Text style={styles.itemSub}>
                    {item.sku ? `SKU ${item.sku}` : "Sin SKU"}
                    {level.location?.name
                      ? ` · ${level.location.name}`
                      : !level.location_id
                        ? " · Sin ubicación de stock"
                        : ""}
                  </Text>
                </View>
                <Text style={styles.quantity}>{level.stocked_quantity ?? "—"}</Text>
                {editable && level.location_id ? (
                  <View style={styles.adjusters}>
                    <Pressable
                      onPress={() => void adjust(item, level, -1)}
                      disabled={saving === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Reducir stock"
                      style={styles.adjustButton}
                    >
                      <Text style={styles.adjustText}>−</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void adjust(item, level, 1)}
                      disabled={saving === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Aumentar stock"
                      style={styles.adjustButton}
                    >
                      <Text style={styles.adjustText}>+</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )),
          )}
        </Section>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    itemRow: {
      minHeight: 72,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemDetails: { flex: 1 },
    itemTitle: { color: theme.text, fontWeight: "500", fontSize: 14 },
    itemSub: { color: theme.muted, fontSize: 12, marginTop: 4 },
    quantity: {
      minWidth: 32,
      textAlign: "center",
      color: theme.text,
      fontSize: 16,
      fontWeight: "600",
    },
    adjusters: { flexDirection: "row", gap: 8 },
    adjustButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
    },
    adjustText: { fontSize: 22, lineHeight: 25, color: theme.action },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  });
