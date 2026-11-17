import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { useBusiness } from "../../context/business-context";
import { hasPermission, OperationList, Row, Section } from "../../components/operation-list";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { productStatusLabel } from "../../lib/status-labels";
import {
  canAddDefaultVariant,
  deriveVariantAxes,
  hasVariantCombination,
  type VariantAxis,
} from "../../lib/variant-options";

type SellerProduct = {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  variants?: SellerVariant[];
};

type SellerVariant = {
  id: string;
  title?: string;
  sku?: string | null;
  options?: { value: string; option?: { title?: string } }[];
};

type ProductChangeResponse = {
  product_change?: { id: string; status?: string };
};

export default function ProductsScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { request, seller, member } = useBusiness();
  const [items, setItems] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantTitle, setVariantTitle] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [addingVariantProductId, setAddingVariantProductId] = useState<string | null>(null);
  const [loadingVariantOptionsFor, setLoadingVariantOptionsFor] = useState<string | null>(null);
  const [savingNewVariantFor, setSavingNewVariantFor] = useState<string | null>(null);
  const [newVariantTitle, setNewVariantTitle] = useState("");
  const [newVariantSku, setNewVariantSku] = useState("");
  const [variantAxes, setVariantAxes] = useState<VariantAxis[]>([]);
  const [selectedVariantOptions, setSelectedVariantOptions] = useState<Record<string, string>>({});
  const [loadedVariantsByProduct, setLoadedVariantsByProduct] = useState<
    Record<string, SellerVariant[]>
  >({});
  const canEdit = hasPermission(member, "products", "edit");
  const canManageProducts = hasPermission(member, "products", "manage");

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    try {
      const data = await request<{ products?: SellerProduct[] }>(
        "/vendor/products?limit=50&fields=id,title,description,status,variants.id,variants.title,variants.sku",
      );
      setItems(data?.products ?? []);
    } catch {
      setError("No se pudo consultar el catálogo de esta tienda.");
    } finally {
      setLoading(false);
    }
  }, [request, seller]);

  useEffect(() => {
    void load();
  }, [load]);

  function beginEdit(item: SellerProduct) {
    if (!canEdit) return;
    setNotice("");
    setError("");
    setEditingId(item.id);
    setTitle(item.title ?? "");
    setDescription(item.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setDescription("");
  }

  async function submitChange(item: SellerProduct) {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("El nombre del producto no puede quedar vacío.");
      return;
    }

    const update: { title?: string; description?: string } = {};
    if (nextTitle !== item.title) update.title = nextTitle;
    if (description !== (item.description ?? "")) update.description = description;
    if (Object.keys(update).length === 0) {
      setNotice("No hay cambios para enviar.");
      cancelEdit();
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await request<ProductChangeResponse>(
        `/vendor/products/${item.id}`,
        "POST",
        update,
      );
      const changeId = result?.product_change?.id;
      setNotice(
        changeId
          ? "Cambios enviados a AgeStyles para revisión. El producto actual sigue visible sin cambios hasta su aprobación."
          : "La solicitud de cambios se envió para revisión.",
      );
      cancelEdit();
    } catch {
      setError("No se pudo enviar el producto a revisión.");
    } finally {
      setSaving(false);
    }
  }

  function beginVariantEdit(variant: SellerVariant) {
    if (!canEdit) return;
    setNotice("");
    setError("");
    setEditingVariantId(variant.id);
    setVariantTitle(variant.title ?? "");
    setVariantSku(variant.sku ?? "");
  }

  function cancelVariantEdit() {
    setEditingVariantId(null);
    setVariantTitle("");
    setVariantSku("");
  }

  async function submitVariantChange(item: SellerProduct, variant: SellerVariant) {
    const nextTitle = variantTitle.trim();
    const nextSku = variantSku.trim();
    if (!nextTitle) {
      setError("El nombre de la variante no puede quedar vacío.");
      return;
    }

    const update: { title?: string; sku?: string | null } = {};
    if (nextTitle !== (variant.title ?? "")) update.title = nextTitle;
    if (nextSku !== (variant.sku ?? "")) update.sku = nextSku || null;
    if (Object.keys(update).length === 0) {
      setNotice("No hay cambios para enviar.");
      cancelVariantEdit();
      return;
    }

    setSavingVariantId(variant.id);
    setError("");
    setNotice("");
    try {
      await request<ProductChangeResponse>(
        `/vendor/products/${item.id}/variants/${variant.id}`,
        "POST",
        update,
      );
      setNotice(
        "Cambios de la variante enviados a AgeStyles para revisión. La ficha actual no cambia hasta su aprobación.",
      );
      cancelVariantEdit();
    } catch {
      setError("No se pudo enviar la variante a revisión.");
    } finally {
      setSavingVariantId(null);
    }
  }

  function confirmVariantRemoval(item: SellerProduct, variant: SellerVariant) {
    if (!canManageProducts || deletingVariantId) return;
    Alert.alert(
      "Retirar variante",
      `Se enviará a revisión la solicitud para retirar “${variant.title ?? "esta variante"}”. Seguirá disponible hasta que AgeStyles apruebe el cambio.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar solicitud",
          style: "destructive",
          onPress: () => {
            setDeletingVariantId(variant.id);
            setError("");
            setNotice("");
            void request<ProductChangeResponse>(
              `/vendor/products/${item.id}/variants/${variant.id}`,
              "DELETE",
            )
              .then((result) => {
                setNotice(
                  result?.product_change?.id
                    ? "Solicitud enviada a AgeStyles para revisión. La variante actual sigue disponible hasta su aprobación."
                    : "La solicitud para retirar la variante se envió para revisión.",
                );
              })
              .catch((cause) => setError("No se pudo solicitar el retiro de la variante."))
              .finally(() => setDeletingVariantId(null));
          },
        },
      ],
    );
  }

  async function beginAddVariant(item: SellerProduct) {
    if (!canEdit) return;
    setError("");
    setNotice("");
    setLoadingVariantOptionsFor(item.id);
    try {
      const result = await request<{ variants?: SellerVariant[] }>(
        `/vendor/products/${item.id}/variants?limit=50&fields=id,title,sku,options.value,options.option.title`,
      );
      const variants = result.variants ?? [];
      const axes = deriveVariantAxes(variants);

      if (axes.length === 0 && !canAddDefaultVariant(variants)) {
        setError("Este producto no tiene opciones para diferenciar otra variante.");
        return;
      }

      setLoadedVariantsByProduct((current) => ({ ...current, [item.id]: variants }));
      setVariantAxes(axes);
      setSelectedVariantOptions(
        Object.fromEntries(axes.map((axis) => [axis.title, axis.values[0] ?? ""])),
      );
      setNewVariantTitle("");
      setNewVariantSku("");
      setAddingVariantProductId(item.id);
    } catch {
      setError("No se pudieron consultar las opciones del producto.");
    } finally {
      setLoadingVariantOptionsFor(null);
    }
  }

  function cancelAddVariant() {
    setAddingVariantProductId(null);
    setNewVariantTitle("");
    setNewVariantSku("");
    setVariantAxes([]);
    setSelectedVariantOptions({});
  }

  async function submitNewVariant(item: SellerProduct) {
    const title = newVariantTitle.trim();
    if (!title) {
      setError("El nombre de la variante no puede quedar vacío.");
      return;
    }

    const options = Object.fromEntries(
      variantAxes.map((axis) => [axis.title, selectedVariantOptions[axis.title] ?? ""]),
    );
    if (Object.values(options).some((value) => !value)) {
      setError("Selecciona un valor para cada opción de la variante.");
      return;
    }

    if (hasVariantCombination(loadedVariantsByProduct[item.id] ?? [], options)) {
      setError("Ya existe una variante con esa combinación de opciones.");
      return;
    }

    setSavingNewVariantFor(item.id);
    setError("");
    setNotice("");
    try {
      await request<ProductChangeResponse>(`/vendor/products/${item.id}/variants`, "POST", {
        title,
        ...(newVariantSku.trim() ? { sku: newVariantSku.trim() } : {}),
        ...(Object.keys(options).length > 0 ? { options } : {}),
      });
      setNotice(
        "Variante enviada a revisión. Se creará sin inventario asignado; la ficha actual no cambia hasta su aprobación.",
      );
      cancelAddVariant();
    } catch {
      setError("No se pudo enviar la variante a revisión.");
    } finally {
      setSavingNewVariantFor(null);
    }
  }

  return (
    <OperationList
      title="Productos"
      subtitle={
        canEdit
          ? "Consulta el catálogo y envía cambios para revisión."
          : "Consulta el catálogo disponible para tu rol."
      }
      loading={loading}
      error={error}
      empty="Esta tienda todavía no tiene productos visibles."
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {items.length ? (
        <Section title={`${items.length} productos`}>
          {items.map((item) => (
            <View key={item.id} style={styles.product}>
              <Row
                title={item.title ?? "Producto sin título"}
                detail={`${item.variants?.length ?? 0} variantes · ${productStatusLabel(item.status)}`}
                action={canEdit ? () => beginEdit(item) : undefined}
              />
              {item.variants?.length ? (
                <View style={styles.variants}>
                  {item.variants.map((variant) => (
                    <View key={variant.id} style={styles.variant}>
                      {editingVariantId === variant.id ? (
                        <View style={styles.variantEditor}>
                          <Text style={styles.label}>Nombre de la variante</Text>
                          <TextInput
                            accessibilityLabel={`Nombre de la variante ${variant.title ?? ""}`}
                            value={variantTitle}
                            onChangeText={setVariantTitle}
                            editable={savingVariantId !== variant.id}
                            maxLength={200}
                            placeholder="Nombre de la variante"
                            placeholderTextColor={theme.placeholderText}
                            style={styles.input}
                          />
                          <Text style={styles.label}>SKU</Text>
                          <TextInput
                            accessibilityLabel={`SKU de la variante ${variant.title ?? ""}`}
                            value={variantSku}
                            onChangeText={setVariantSku}
                            editable={savingVariantId !== variant.id}
                            maxLength={100}
                            autoCapitalize="characters"
                            placeholder="Sin SKU"
                            placeholderTextColor={theme.placeholderText}
                            style={styles.input}
                          />
                          <View style={styles.actions}>
                            <Pressable
                              onPress={cancelVariantEdit}
                              disabled={savingVariantId === variant.id}
                              accessibilityRole="button"
                              style={({ pressed }) => [
                                styles.secondaryButton,
                                pressed && styles.pressed,
                                savingVariantId === variant.id && styles.disabled,
                              ]}
                            >
                              <Text style={styles.secondaryText}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => void submitVariantChange(item, variant)}
                              disabled={savingVariantId === variant.id || !variantTitle.trim()}
                              accessibilityRole="button"
                              style={({ pressed }) => [
                                styles.primaryButton,
                                pressed && styles.pressed,
                                (savingVariantId === variant.id || !variantTitle.trim()) &&
                                  styles.disabled,
                              ]}
                            >
                              <Text style={styles.primaryText}>
                                {savingVariantId === variant.id ? "Enviando…" : "Enviar a revisión"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.variantSummary}>
                          <View style={styles.variantText}>
                            <Text style={styles.variantTitle}>{variant.title ?? "Variante"}</Text>
                            <Text style={styles.variantSku}>{variant.sku || "Sin SKU"}</Text>
                          </View>
                          {canEdit ? (
                            <Pressable
                              onPress={() => beginVariantEdit(variant)}
                              accessibilityRole="button"
                              accessibilityLabel={`Editar variante ${variant.title ?? ""}`}
                              style={({ pressed }) => [
                                styles.variantAction,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={styles.variantActionText}>Editar</Text>
                            </Pressable>
                          ) : null}
                          {canManageProducts ? (
                            <Pressable
                              onPress={() => confirmVariantRemoval(item, variant)}
                              disabled={deletingVariantId === variant.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Solicitar retiro de variante ${variant.title ?? ""}`}
                              accessibilityHint="AgeStyles debe aprobar el cambio antes de retirar la variante del catálogo."
                              style={({ pressed }) => [
                                styles.variantAction,
                                pressed && styles.pressed,
                                deletingVariantId === variant.id && styles.disabled,
                              ]}
                            >
                              <Icon name="trash" color={theme.error} size={20} />
                              <Text style={styles.dangerActionText}>
                                {deletingVariantId === variant.id ? "Enviando…" : "Retirar"}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
              {canEdit ? (
                <View style={styles.addVariantArea}>
                  {addingVariantProductId === item.id ? (
                    <View style={styles.variantEditor}>
                      <Text style={styles.label}>Nueva variante</Text>
                      <TextInput
                        accessibilityLabel="Nombre de la nueva variante"
                        value={newVariantTitle}
                        onChangeText={setNewVariantTitle}
                        editable={savingNewVariantFor !== item.id}
                        maxLength={200}
                        placeholder="Nombre de la variante"
                        placeholderTextColor={theme.placeholderText}
                        style={styles.input}
                      />
                      <TextInput
                        accessibilityLabel="SKU de la nueva variante"
                        value={newVariantSku}
                        onChangeText={setNewVariantSku}
                        editable={savingNewVariantFor !== item.id}
                        maxLength={100}
                        autoCapitalize="characters"
                        placeholder="SKU (opcional)"
                        placeholderTextColor={theme.placeholderText}
                        style={styles.input}
                      />
                      {variantAxes.map((axis) => (
                        <View key={axis.title} style={styles.optionAxis}>
                          <Text style={styles.label}>{axis.title}</Text>
                          <View style={styles.optionValues}>
                            {axis.values.map((value) => {
                              const selected = selectedVariantOptions[axis.title] === value;
                              return (
                                <Pressable
                                  key={`${axis.title}-${value}`}
                                  onPress={() =>
                                    setSelectedVariantOptions((current) => ({
                                      ...current,
                                      [axis.title]: value,
                                    }))
                                  }
                                  disabled={savingNewVariantFor === item.id}
                                  accessibilityRole="radio"
                                  accessibilityLabel={`${axis.title}: ${value}`}
                                  accessibilityState={{ checked: selected }}
                                  style={({ pressed }) => [
                                    styles.optionChip,
                                    selected && styles.optionChipSelected,
                                    pressed && styles.pressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.optionChipText,
                                      selected && styles.optionChipTextSelected,
                                    ]}
                                  >
                                    {value}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                      <Text style={styles.variantHelp}>
                        Solo puedes elegir opciones ya usadas por este producto. La variante se
                        enviará para aprobación y necesitará inventario antes de venderse.
                      </Text>
                      <View style={styles.actions}>
                        <Pressable
                          onPress={cancelAddVariant}
                          disabled={savingNewVariantFor === item.id}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            pressed && styles.pressed,
                            savingNewVariantFor === item.id && styles.disabled,
                          ]}
                        >
                          <Text style={styles.secondaryText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void submitNewVariant(item)}
                          disabled={savingNewVariantFor === item.id || !newVariantTitle.trim()}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.primaryButton,
                            pressed && styles.pressed,
                            (savingNewVariantFor === item.id || !newVariantTitle.trim()) &&
                              styles.disabled,
                          ]}
                        >
                          <Text style={styles.primaryText}>
                            {savingNewVariantFor === item.id ? "Enviando…" : "Enviar a revisión"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => void beginAddVariant(item)}
                      disabled={loadingVariantOptionsFor === item.id}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.addVariantButton,
                        pressed && styles.pressed,
                        loadingVariantOptionsFor === item.id && styles.disabled,
                      ]}
                    >
                      <Text style={styles.variantActionText}>
                        {loadingVariantOptionsFor === item.id
                          ? "Cargando opciones…"
                          : "Añadir variante"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
              {editingId === item.id ? (
                <View style={styles.editor}>
                  <Text style={styles.label}>Nombre del producto</Text>
                  <TextInput
                    accessibilityLabel="Nombre del producto"
                    value={title}
                    onChangeText={setTitle}
                    editable={!saving}
                    maxLength={200}
                    placeholder="Nombre del producto"
                    placeholderTextColor={theme.placeholderText}
                    style={styles.input}
                  />
                  <Text style={styles.label}>Descripción</Text>
                  <TextInput
                    accessibilityLabel="Descripción del producto"
                    value={description}
                    onChangeText={setDescription}
                    editable={!saving}
                    multiline
                    maxLength={5000}
                    textAlignVertical="top"
                    placeholder="Describe el producto"
                    placeholderTextColor={theme.placeholderText}
                    style={[styles.input, styles.description]}
                  />
                  <View style={styles.actions}>
                    <Pressable
                      onPress={cancelEdit}
                      disabled={saving}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                        saving && styles.disabled,
                      ]}
                    >
                      <Text style={styles.secondaryText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void submitChange(item)}
                      disabled={saving || !title.trim()}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.pressed,
                        (saving || !title.trim()) && styles.disabled,
                      ]}
                    >
                      <Text style={styles.primaryText}>
                        {saving ? "Enviando…" : "Enviar a revisión"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}
      {!canEdit && items.length ? (
        <Text style={styles.readOnlyNote}>
          Tu rol permite consultar productos, pero no enviar cambios.
        </Text>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    product: { borderBottomWidth: 1, borderBottomColor: theme.border },
    variants: { paddingHorizontal: 15, paddingBottom: 10 },
    variant: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    variantSummary: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    variantText: { flex: 1, gap: 3 },
    variantTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
    variantSku: { color: theme.muted, fontSize: 12 },
    variantAction: {
      minHeight: 40,
      minWidth: 60,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
    },
    variantActionText: { color: theme.action, fontSize: 13, fontWeight: "600" },
    dangerActionText: { color: theme.error, fontSize: 13, fontWeight: "600" },
    variantEditor: { flex: 1, gap: 9, paddingVertical: 14 },
    addVariantArea: { paddingHorizontal: 15, paddingBottom: 14 },
    addVariantButton: {
      minHeight: 42,
      justifyContent: "center",
      alignItems: "flex-start",
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    optionAxis: { gap: 7 },
    optionValues: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    optionChip: {
      minHeight: 38,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      backgroundColor: theme.surface,
    },
    optionChipSelected: { borderColor: theme.action, backgroundColor: theme.selectedSurface },
    optionChipText: { color: theme.text, fontSize: 13 },
    optionChipTextSelected: { color: theme.action, fontWeight: "600" },
    variantHelp: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    editor: { gap: 9, paddingHorizontal: 15, paddingBottom: 16 },
    label: { color: theme.text, fontSize: 13, fontWeight: "600" },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      color: theme.text,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 15,
    },
    description: { minHeight: 112 },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 9,
      marginTop: 4,
    },
    primaryButton: {
      minHeight: 44,
      justifyContent: "center",
      borderRadius: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.action,
    },
    primaryText: { color: theme.onAction, fontSize: 14, fontWeight: "700" },
    secondaryButton: {
      minHeight: 44,
      justifyContent: "center",
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    secondaryText: { color: theme.text, fontSize: 14, fontWeight: "600" },
    pressed: { opacity: 0.78 },
    disabled: { opacity: 0.45 },
    notice: {
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      color: theme.text,
      padding: 12,
      lineHeight: 20,
    },
    readOnlyNote: { color: theme.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  });
