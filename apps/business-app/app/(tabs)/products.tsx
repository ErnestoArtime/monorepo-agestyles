import { mediaVariant } from "@agestyles/api-client/media";
import { useNotice } from "../../hooks/use-notice";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CardGrid } from "../../components/card-grid";
import { useResponsive } from "../../hooks/use-responsive";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Icon } from "@agestyles/icons";
import { useBusiness } from "../../context/business-context";
import { hasPermission, OperationList } from "../../components/operation-list";
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  PillGroup,
  SearchField,
  StatusBadge,
  type BadgeTone,
} from "@agestyles/ui-native";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { productStatusLabel } from "../../lib/status-labels";
import {
  canAddDefaultVariant,
  deriveVariantAxes,
  hasVariantCombination,
  type VariantAxis,
} from "../../lib/variant-options";
import { loadOfferSkus, withOfferSkus } from "../../lib/offer-skus";

type SellerProduct = {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  thumbnail?: string | null;
  variants?: SellerVariant[];
};

type StatusFilter = "all" | "published" | "proposed" | "draft" | "rejected";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "published", label: "Publicados" },
  { value: "proposed", label: "En revisión" },
  { value: "draft", label: "Borradores" },
  { value: "rejected", label: "Rechazados" },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  published: "success",
  proposed: "warning",
  draft: "neutral",
  rejected: "error",
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
  // Búsqueda que llega desde el sidebar: ?q=texto (web-sidebar.tsx).
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [items, setItems] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();
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
  const [query, setQuery] = useState(q ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<{ item: SellerProduct; variant: SellerVariant } | null>(
    null,
  );
  const canEdit = hasPermission(member, "products", "edit");
  const { isWideWeb } = useResponsive();
  const canManageProducts = hasPermission(member, "products", "manage");

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    try {
      const data = await request<{ products?: SellerProduct[] }>(
        "/vendor/products?limit=100&fields=id,title,description,status,thumbnail,variants.id,variants.title,variants.sku",
      );
      // Variants have no SKU in production; show the offer SKU instead (AG-29).
      const skus = seller
        ? await loadOfferSkus(request, seller.id).catch(() => new Map<string, string>())
        : new Map<string, string>();
      setItems(
        (data?.products ?? []).map((product) => ({
          ...product,
          variants: withOfferSkus(product.variants, skus),
        })),
      );
    } catch {
      setError("No se pudo consultar el catálogo de esta tienda.");
    } finally {
      setLoading(false);
    }
  }, [request, seller]);

  useEffect(() => {
    void load();
  }, [load]);

  // Si el sidebar (u otra pantalla) navega con ?q=, aplica ese texto.
  useEffect(() => {
    setQuery(q ?? "");
  }, [q]);

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
    setRemoval({ item, variant });
  }

  function submitVariantRemoval() {
    if (!removal) return;
    const { item, variant } = removal;
    setRemoval(null);
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
      .catch(() => setError("No se pudo solicitar el retiro de la variante."))
      .finally(() => setDeletingVariantId(null));
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

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (statusFilter === "all" || (item.status ?? "").toLowerCase() === statusFilter) &&
        (!needle ||
          item.title?.toLowerCase().includes(needle) ||
          item.variants?.some((variant) => variant.sku?.toLowerCase().includes(needle))),
    );
  }, [items, query, statusFilter]);
  const openItem = items.find((item) => item.id === openId) ?? null;

  function closeSheet() {
    setOpenId(null);
    cancelEdit();
    cancelVariantEdit();
    cancelAddVariant();
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
      error={error && !openItem ? error : ""}
      empty="Esta tienda todavía no tiene productos visibles."
      isEmpty={!items.length}
      onRefresh={() => void load()}
    >
      {notice && !openItem ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {canEdit ? (
        // In a wide browser both actions sit side by side at their natural width, like a web page.
        <View style={isWideWeb ? styles.actionsWide : null}>
          <Button
            icon="plus"
            title="Nuevo producto"
            onPress={() => router.push("/product-new")}
            style={styles.importButton}
          />
          <Button
            icon="list"
            variant="secondary"
            title="Importar o corregir catálogo por CSV"
            onPress={() => router.push("/catalog-import")}
            style={styles.importButton}
          />
        </View>
      ) : null}
      {items.length ? (
        <View style={styles.toolbar}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre o SKU"
          />
          <PillGroup
            accessibilityLabel="Filtrar por estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
          <Text style={styles.count}>
            {visibleItems.length === items.length
              ? `${items.length} productos`
              : `${visibleItems.length} de ${items.length} productos`}
          </Text>
        </View>
      ) : null}
      {items.length && !visibleItems.length ? (
        <Text style={styles.readOnlyNote}>Ningún producto coincide con la búsqueda.</Text>
      ) : null}
      {visibleItems.length ? (
        <CardGrid>
          {visibleItems.map((item) => {
            const variants = item.variants?.length ?? 0;
            return (
              <Card
                key={item.id}
                onPress={() => {
                  setError("");
                  setNotice("");
                  setOpenId(item.id);
                }}
                accessibilityLabel={`${item.title ?? "Producto"}, ${productStatusLabel(item.status)}`}
              >
                <View style={styles.cardRow}>
                  <View style={styles.thumb}>
                    {item.thumbnail ? (
                      <Image
                        source={{ uri: mediaVariant(item.thumbnail, 400) }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <Icon name="package" size={22} color={theme.muted} />
                    )}
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title ?? "Producto sin título"}
                    </Text>
                    <Text style={styles.cardDetail}>
                      {variants === 1 ? "1 variante" : `${variants} variantes`}
                    </Text>
                    <StatusBadge
                      label={productStatusLabel(item.status)}
                      tone={STATUS_TONE[(item.status ?? "").toLowerCase()] ?? "neutral"}
                    />
                  </View>
                  <Icon name="chevronRight" size={20} color={theme.muted} />
                </View>
              </Card>
            );
          })}
        </CardGrid>
      ) : null}
      {!canEdit && items.length ? (
        <Text style={styles.readOnlyNote}>
          Tu rol permite consultar productos, pero no enviar cambios.
        </Text>
      ) : null}
      <BottomSheet visible={!!openItem} onClose={closeSheet} title={openItem?.title ?? "Producto"}>
        {openItem
          ? (() => {
              const item = openItem;
              return (
                <View style={styles.sheet}>
                  <StatusBadge
                    label={productStatusLabel(item.status)}
                    tone={STATUS_TONE[(item.status ?? "").toLowerCase()] ?? "neutral"}
                  />
                  {notice ? (
                    <Text accessibilityRole="alert" style={styles.notice}>
                      {notice}
                    </Text>
                  ) : null}
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.sheetError}>
                      {error}
                    </Text>
                  ) : null}
                  {editingId === item.id ? null : (
                    <>
                      <Text style={item.description ? styles.descriptionText : styles.readOnlyNote}>
                        {item.description || "Sin descripción."}
                      </Text>
                      {canEdit ? (
                        <Button
                          icon="sliders"
                          variant="secondary"
                          title="Editar nombre y descripción"
                          onPress={() => beginEdit(item)}
                        />
                      ) : null}
                    </>
                  )}
                  <View style={styles.product}>
                    <Text style={styles.sheetSection}>Variantes</Text>
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
                                    disabled={
                                      savingVariantId === variant.id || !variantTitle.trim()
                                    }
                                    accessibilityRole="button"
                                    style={({ pressed }) => [
                                      styles.primaryButton,
                                      pressed && styles.pressed,
                                      (savingVariantId === variant.id || !variantTitle.trim()) &&
                                        styles.disabled,
                                    ]}
                                  >
                                    <Text style={styles.primaryText}>
                                      {savingVariantId === variant.id
                                        ? "Enviando…"
                                        : "Enviar a revisión"}
                                    </Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : (
                              <View style={styles.variantSummary}>
                                <View style={styles.variantText}>
                                  <Text style={styles.variantTitle}>
                                    {!variant.title || variant.title === "Default"
                                      ? "Variante única"
                                      : variant.title}
                                  </Text>
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
                              Solo puedes elegir opciones ya usadas por este producto. La variante
                              se enviará para aprobación y necesitará inventario antes de venderse.
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
                                disabled={
                                  savingNewVariantFor === item.id || !newVariantTitle.trim()
                                }
                                accessibilityRole="button"
                                style={({ pressed }) => [
                                  styles.primaryButton,
                                  pressed && styles.pressed,
                                  (savingNewVariantFor === item.id || !newVariantTitle.trim()) &&
                                    styles.disabled,
                                ]}
                              >
                                <Text style={styles.primaryText}>
                                  {savingNewVariantFor === item.id
                                    ? "Enviando…"
                                    : "Enviar a revisión"}
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
                </View>
              );
            })()
          : null}
      </BottomSheet>
      <ConfirmDialog
        visible={!!removal}
        tone="warning"
        title="Retirar variante"
        message={`Se enviará a revisión la solicitud para retirar «${removal?.variant.title ?? "esta variante"}». Seguirá disponible hasta que AgeStyles apruebe el cambio.`}
        primary={{ label: "Enviar solicitud", onPress: submitVariantRemoval }}
        secondary={{ label: "Cancelar", onPress: () => setRemoval(null) }}
        onClose={() => setRemoval(null)}
      />
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { gap: 12, marginBottom: 14 },
    actionsWide: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    count: { color: theme.muted, fontSize: 13 },
    cards: { gap: 10 },
    cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: 10,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
    },
    cardText: { flex: 1, gap: 4, alignItems: "flex-start" },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    cardDetail: { color: theme.muted, fontSize: 13 },
    sheet: { gap: 14 },
    sheetSection: { color: theme.text, fontSize: 17, fontWeight: "700", marginBottom: 4 },
    sheetError: { color: theme.error, fontSize: 14, lineHeight: 20 },
    descriptionText: { color: theme.text, fontSize: 15, lineHeight: 22 },
    product: { gap: 4 },
    variants: {},
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
    addVariantArea: { paddingTop: 6 },
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
    editor: { gap: 9, paddingTop: 6 },
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
    importButton: { marginBottom: 14 },
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
