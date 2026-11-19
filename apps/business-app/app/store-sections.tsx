import { mediaVariant } from "@agestyles/api-client/media";
import { Button } from "@agestyles/ui-native";
import { Icon } from "@agestyles/icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

type StoreSection = { id: string; name: string; product_ids: string[] };
type Product = { id: string; title: string; thumbnail: string | null };

const MAX_SECTIONS = 20;

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function move<T>(list: T[], index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/**
 * «Secciones de mi tienda» (AG-35): the store's own categories that organise its page in
 * Tienda, without approval. Marketplace categories are requested from «Solicitar categoría».
 */
export default function StoreSectionsScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, seller } = useBusiness();
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StoreSection | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<{
        sections: StoreSection[];
        products: Product[];
        can_edit: boolean;
      }>("/vendor/agestyles/store-sections");
      setSections(data.sections ?? []);
      setProducts(data.products ?? []);
      setCanEdit(data.can_edit);
      setDirty(false);
    } catch {
      setError("No se pudieron cargar las secciones.");
    } finally {
      setLoading(false);
    }
    // The selected store changes what the server returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, seller?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const change = (next: StoreSection[]) => {
    setSections(next);
    setDirty(true);
    setNotice("");
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = await request<{ sections: StoreSection[] }>(
        "/vendor/agestyles/store-sections",
        "POST",
        { sections },
      );
      setSections(data.sections);
      setDirty(false);
      setNotice("Secciones guardadas. Tu página de la Tienda ya las muestra.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        /secci|producto/i.test(message) && message.length < 200
          ? message
          : "No se pudieron guardar las secciones.",
      );
    } finally {
      setSaving(false);
    }
  }

  function apply() {
    if (!editing) return;
    const name = editing.name.trim();
    if (name.length < 2) return setError("Escribe el nombre de la sección.");
    if (
      sections.some(
        (section) => section.id !== editing.id && section.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return setError("Ya tienes una sección con ese nombre.");
    setError("");
    const next = { ...editing, name };
    change(
      sections.some((section) => section.id === next.id)
        ? sections.map((section) => (section.id === next.id ? next : section))
        : [...sections, next],
    );
    setEditing(null);
  }

  const visibleProducts = products.filter(
    (product) => !query.trim() || plain(product.title).includes(plain(query.trim())),
  );

  return (
    <OperationList
      backLabel="Más"
      title="Secciones de mi tienda"
      subtitle="Agrupa tus productos como quieras en tu página de la Tienda. No necesitan aprobación."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.saveBar}>
        <Text style={styles.muted}>
          {!canEdit
            ? "Solo el titular o la administración de la tienda pueden cambiarlas."
            : dirty
              ? "Hay cambios sin guardar."
              : "Todo guardado."}
        </Text>
        <Button
          title="Guardar secciones"
          loading={saving}
          disabled={!dirty || !canEdit}
          onPress={() => void save()}
        />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/category-requests")}
        style={styles.hint}
      >
        <Icon name="help" size={16} color={theme.action} />
        <Text style={styles.hintText}>
          ¿Necesitas una categoría en todo el catálogo? Solicítala a la administración.
        </Text>
        <Icon name="arrowRight" size={14} color={theme.action} />
      </Pressable>

      <Section title={`Secciones (${sections.length}/${MAX_SECTIONS})`}>
        {sections.length ? null : (
          <Text style={[styles.muted, styles.pad]}>
            Sin secciones, tu página agrupa los productos por las categorías del catálogo.
          </Text>
        )}
        {sections.map((section, index) => (
          <View key={section.id} style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{section.name}</Text>
              <Text style={styles.muted}>
                {section.product_ids.length}{" "}
                {section.product_ids.length === 1 ? "producto" : "productos"}
              </Text>
            </View>
            {canEdit ? (
              <View style={styles.tools}>
                <IconButton
                  icon="chevronUp"
                  label="Subir"
                  disabled={index === 0}
                  onPress={() => change(move(sections, index, -1))}
                />
                <IconButton
                  icon="chevronDown"
                  label="Bajar"
                  disabled={index === sections.length - 1}
                  onPress={() => change(move(sections, index, 1))}
                />
                <IconButton
                  icon="settings"
                  label="Editar"
                  onPress={() => {
                    setEditing(section);
                    setQuery("");
                  }}
                />
                <IconButton
                  icon="trash"
                  label="Eliminar"
                  onPress={() => change(sections.filter((s) => s.id !== section.id))}
                />
              </View>
            ) : null}
          </View>
        ))}
        {editing ? (
          <View style={styles.editor}>
            <Text style={styles.label}>Nombre de la sección</Text>
            <TextInput
              value={editing.name}
              onChangeText={(name) => setEditing({ ...editing, name })}
              maxLength={40}
              placeholder="Por ejemplo: Ofertas, Para regalar, Novedades de verano"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Nombre de la sección"
              style={styles.input}
            />
            <Text style={styles.label}>
              Productos ({editing.product_ids.length} de {products.length})
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar en tus productos"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Buscar en tus productos"
              style={styles.input}
            />
            {visibleProducts.length ? null : (
              <Text style={styles.muted}>No hay productos publicados que coincidan.</Text>
            )}
            {visibleProducts.map((product) => {
              const selected = editing.product_ids.includes(product.id);
              return (
                <Pressable
                  key={product.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    setEditing({
                      ...editing,
                      product_ids: selected
                        ? editing.product_ids.filter((id) => id !== product.id)
                        : [...editing.product_ids, product.id],
                    })
                  }
                  style={[styles.choice, selected && styles.choiceOn]}
                >
                  <View style={styles.thumb}>
                    {product.thumbnail ? (
                      <Image
                        source={{ uri: mediaVariant(product.thumbnail, 400) }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                  <Text style={styles.choiceText}>{product.title}</Text>
                  <Icon
                    name={selected ? "check" : "plus"}
                    size={18}
                    color={selected ? theme.action : theme.muted}
                  />
                </Pressable>
              );
            })}
            <View style={styles.actions}>
              <Button title="Aplicar" onPress={apply} />
              <Pressable accessibilityRole="button" onPress={() => setEditing(null)}>
                <Text style={styles.link}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : canEdit && sections.length < MAX_SECTIONS ? (
          <View style={styles.pad}>
            <Button
              title="Añadir sección"
              variant="secondary"
              onPress={() => {
                setEditing({ id: `sec_${Date.now().toString(36)}`, name: "", product_ids: [] });
                setQuery("");
              }}
            />
          </View>
        ) : null}
      </Section>
      {sections.some((section) => section.product_ids.some((id) => !productById.has(id))) ? (
        <Text style={styles.muted}>
          Algunas secciones tienen productos que ya no están publicados; no se muestran en la
          Tienda.
        </Text>
      ) : null}
    </OperationList>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "chevronUp" | "chevronDown" | "settings" | "trash";
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, disabled && styles.disabled]}
    >
      <Icon name={icon} size={18} color={icon === "trash" ? theme.error : theme.text} />
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    saveBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },
    hint: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    hintText: { color: theme.action, fontSize: 14, fontWeight: "600", flexShrink: 1 },
    pad: { padding: 14 },
    row: {
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    flex: { flex: 1, gap: 3 },
    tools: { flexDirection: "row", gap: 2 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.3 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    editor: { padding: 14, gap: 10 },
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
    choice: {
      minHeight: 52,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    choiceOn: { borderColor: theme.action, backgroundColor: theme.quietSurface },
    choiceText: { color: theme.text, fontSize: 14, flex: 1 },
    thumb: {
      width: 36,
      height: 36,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
    },
    actions: { flexDirection: "row", alignItems: "center", gap: 14 },
  });
