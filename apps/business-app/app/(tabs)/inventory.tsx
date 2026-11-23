import { ManagementPanel, ResponsiveManagementList } from "../../components/management-list";
import { SearchField } from "@agestyles/ui-native";
import { Icon } from "@agestyles/icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section, hasPermission } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import {
  MOVEMENT_PATH,
  MOVEMENT_TYPE_OPTIONS,
  movementErrorMessage,
  type MovementType,
} from "../../lib/inventory-movements";

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
type Level = NonNullable<InventoryItem["location_levels"]>[number];

export default function InventoryScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, seller, member } = useBusiness();
  const [items, setItems] = useState<InventoryItem[]>([]);
  // Offer inventory items carry the variant name («Default»); show the product instead.
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState("");
  const [detailKey, setDetailKey] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MovementType>("alta");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const editable = hasPermission(member, "inventory_items", "edit");

  useEffect(() => {
    setOpen("");
    setDetailKey("");
    setItems([]);
    setNames(new Map());
  }, [seller?.id]);

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    try {
      const data = await request<any>(
        "/vendor/inventory-items?limit=50&fields=id,title,sku,location_levels.id,location_levels.location_id,location_levels.stocked_quantity,location_levels.location.name",
      );
      setItems(data?.inventory_items ?? []);
      try {
        const { regions } = await request<{ regions: { id: string }[] }>("/store/regions");
        const [offerData, productData] = await Promise.all([
          request<{
            offers: { sku?: string; product_id: string; product_variant?: { title?: string } }[];
          }>(`/store/offers?limit=100&region_id=${regions[0]?.id ?? ""}&seller_id=${seller.id}`),
          request<{ products: { id: string; title?: string }[] }>(
            "/vendor/products?limit=100&fields=id,title",
          ),
        ]);
        const productTitles = new Map(
          (productData.products ?? []).map((product) => [product.id, product.title ?? ""]),
        );
        setNames(
          new Map(
            offerData.offers
              .filter((offer) => offer.sku)
              .map((offer) => {
                const product = productTitles.get(offer.product_id) || "";
                const variant = offer.product_variant?.title;
                return [
                  offer.sku as string,
                  variant && variant !== "Default" && product ? `${product} · ${variant}` : product,
                ];
              }),
          ),
        );
      } catch {
        // Names are a convenience; the inventory still lists SKUs.
      }
    } catch {
      setError("No se pudo consultar el inventario de esta tienda.");
    } finally {
      setLoading(false);
    }
  }, [request, seller]);
  useEffect(() => {
    void load();
  }, [load]);

  async function record(
    item: InventoryItem,
    level: Level,
    movement: { type: MovementType; quantity: number; reason?: string },
  ) {
    if (!editable || !level.location_id) return false;
    const key = `${item.id}-${level.location_id}`;
    setSaving(key);
    setNotice("");
    setError("");
    try {
      await request(MOVEMENT_PATH, "POST", {
        inventory_item_id: item.id,
        location_id: level.location_id,
        ...movement,
      });
      setNotice(`Movimiento registrado: ${item.title ?? item.sku ?? "artículo"}.`);
      await load();
      return true;
    } catch (cause) {
      setError(movementErrorMessage(cause, "No se pudo registrar el movimiento."));
      return false;
    } finally {
      setSaving("");
    }
  }

  function toggle(key: string) {
    setOpen((current) => (current === key ? "" : key));
    setType("alta");
    setQuantity("");
    setReason("");
  }

  async function submit(item: InventoryItem, level: Level) {
    const value = Number(quantity);
    if (!Number.isInteger(value) || value < 0 || (type !== "ajuste" && value === 0)) {
      setError(
        type === "ajuste"
          ? "Indica el stock contado con un número entero."
          : "Indica una cantidad entera mayor que cero.",
      );
      return;
    }
    if (type === "ajuste" && reason.trim().length < 3) {
      setError("El ajuste necesita un motivo.");
      return;
    }
    const done = await record(item, level, {
      type,
      quantity: value,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    if (done) setOpen("");
  }

  const rows = items.flatMap((item) =>
    (item.location_levels?.length ? item.location_levels : [{} as Level]).map((level, index) => ({
      key: `${item.id}-${level.location_id ?? index}`,
      item,
      level,
      title: (item.sku && names.get(item.sku)) || item.title || item.sku || "Artículo",
    })),
  );
  const text = query.trim().toLowerCase();
  const visible = rows.filter(({ item, level, title }) =>
    `${title} ${item.sku ?? ""} ${level.location?.name ?? ""}`.toLowerCase().includes(text),
  );
  const selected = rows.find(({ key }) => key === detailKey);

  function renderLevel({ item, level, key, title }: (typeof rows)[number]) {
    const busy = saving === key;
    const help = MOVEMENT_TYPE_OPTIONS.find((option) => option.value === type)?.help;
    return (
      <View key={key} style={styles.itemBlock}>
        <View style={styles.itemRow}>
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemSub}>
              {item.sku ? `SKU ${item.sku}` : "Sin SKU"}
              {level.location?.name
                ? ` · ${level.location.name}`
                : !level.location_id
                  ? " · Sin almacén asignado"
                  : ""}
            </Text>
            <Pressable
              onPress={() => {
                setDetailKey("");
                router.push({
                  pathname: "/movements",
                  params: {
                    inventory_item_id: item.id,
                    title,
                  },
                });
              }}
              accessibilityRole="link"
              accessibilityLabel={`Historial de ${item.title ?? item.sku ?? "artículo"}`}
              style={styles.inlineLink}
            >
              <Text style={styles.linkText}>Historial</Text>
            </Pressable>
          </View>
          <Text style={styles.quantity}>{level.stocked_quantity ?? "—"}</Text>
          {editable && level.location_id ? (
            <View style={styles.adjusters}>
              <Pressable
                onPress={() => void record(item, level, { type: "baja", quantity: 1 })}
                disabled={busy || !Number(level.stocked_quantity)}
                accessibilityRole="button"
                accessibilityLabel="Registrar baja de una unidad"
                style={[styles.adjustButton, busy && styles.disabled]}
              >
                <Icon name="minus" size={20} color={theme.action} />
              </Pressable>
              <Pressable
                onPress={() => void record(item, level, { type: "alta", quantity: 1 })}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Registrar alta de una unidad"
                style={[styles.adjustButton, busy && styles.disabled]}
              >
                <Icon name="plus" size={20} color={theme.action} />
              </Pressable>
              <Pressable
                onPress={() => toggle(key)}
                accessibilityRole="button"
                accessibilityLabel="Registrar otro movimiento"
                accessibilityState={{ expanded: open === key }}
                style={styles.adjustButton}
              >
                <Icon name="sliders" size={20} color={theme.action} />
              </Pressable>
            </View>
          ) : null}
        </View>
        {open === key ? (
          <View style={styles.form}>
            <View
              style={styles.chips}
              accessibilityRole="radiogroup"
              accessibilityLabel="Tipo de movimiento"
            >
              {MOVEMENT_TYPE_OPTIONS.map((option) => {
                const selected = type === option.value;
                return (
                  <Pressable
                    key={option.value}
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
            {help ? <Text style={styles.itemSub}>{help}</Text> : null}
            <Text style={styles.label}>{type === "ajuste" ? "Stock contado" : "Unidades"}</Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={type === "ajuste" ? "Stock contado" : "Unidades"}
              placeholder={type === "ajuste" ? String(level.stocked_quantity ?? 0) : "1"}
              placeholderTextColor={theme.placeholderText}
              style={styles.input}
            />
            <Text style={styles.label}>
              {type === "ajuste" ? "Motivo (obligatorio)" : "Motivo (opcional)"}
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              maxLength={300}
              accessibilityLabel="Motivo"
              placeholder="Ej.: conteo físico, rotura, compra a proveedor"
              placeholderTextColor={theme.placeholderText}
              style={styles.input}
            />
            <Pressable
              onPress={() => void submit(item, level)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.submit, busy && styles.disabled]}
            >
              <Text style={styles.submitText}>{busy ? "Guardando…" : "Registrar movimiento"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <OperationList
      title="Inventario"
      subtitle={
        editable
          ? "Consulta y registra las entradas, salidas y ajustes de tu tienda."
          : "Consulta las existencias disponibles para tu rol."
      }
      loading={loading}
      error={error}
      empty="No hay artículos de inventario para mostrar."
      onRefresh={() => void load()}
    >
      <Pressable
        onPress={() => router.push("/movements")}
        accessibilityRole="button"
        style={styles.historyLink}
      >
        <Icon name="list" size={18} color={theme.action} />
        <Text style={styles.linkText}>Ver todos los movimientos</Text>
      </Pressable>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {items.length ? (
        <Section title={`${items.length} artículos`}>
          <View style={styles.itemBlock}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar artículo, SKU o almacén"
            />
          </View>
          {visible.length ? (
            <ResponsiveManagementList
              caption="Inventario por almacén"
              rows={visible}
              rowKey={(row) => row.key}
              actionLabel={(row) => `Ver inventario de ${row.title}`}
              onOpen={(row) => {
                setOpen("");
                setDetailKey(row.key);
              }}
              columns={[
                { id: "item", label: "Artículo", width: "33%", render: (row) => row.title },
                { id: "sku", label: "SKU", width: "21%", render: (row) => row.item.sku || "—" },
                {
                  id: "location",
                  label: "Almacén",
                  width: "24%",
                  render: (row) => row.level.location?.name || "—",
                },
                {
                  id: "stock",
                  label: "Existencias",
                  width: "11%",
                  render: (row) => row.level.stocked_quantity ?? "—",
                },
              ]}
              renderCompact={() => visible.map(renderLevel)}
            />
          ) : (
            <Text style={styles.itemSub}>No hay artículos que coincidan.</Text>
          )}
        </Section>
      ) : null}
      {selected ? (
        <ManagementPanel
          wide
          title={selected.title}
          onClose={() => {
            setDetailKey("");
            setOpen("");
          }}
        >
          {notice ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={styles.itemSub}>
              {error}
            </Text>
          ) : null}
          {renderLevel(selected)}
        </ManagementPanel>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    historyLink: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    linkText: { color: theme.action, fontSize: 14, fontWeight: "500" },
    inlineLink: { minHeight: 32, justifyContent: "center", alignSelf: "flex-start" },
    itemBlock: {
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemRow: {
      minHeight: 72,
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
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
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
    },
    disabled: { opacity: 0.45 },
    form: { paddingHorizontal: 14, paddingBottom: 16, gap: 8 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
    label: { color: theme.text, fontSize: 13, fontWeight: "500", marginTop: 4 },
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
    submit: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: theme.action,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
    },
    submitText: { color: theme.onAction, fontSize: 15, fontWeight: "600" },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  });
