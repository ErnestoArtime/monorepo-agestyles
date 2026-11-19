import { Button, PillGroup } from "@agestyles/ui-native";
import { Icon } from "@agestyles/icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError } from "../../lib/admin";

type LinkKind = "none" | "category" | "product" | "seller" | "url";
type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  cta: string | null;
  link: { kind: LinkKind; value: string | null; label: string | null };
  active: boolean;
};
type Content = { banners: Banner[]; featured_product_ids: string[] };
type Product = { id: string; title: string; thumbnail: string | null };
type Named = { id: string; name: string };

const MAX_BANNERS = 8;
const MAX_FEATURED = 24;
/** Banners are wide: 2000 px on the long side keeps them sharp on large screens. */
const BANNER_EDGE = 2000;
const LINK_OPTIONS: { value: LinkKind; label: string }[] = [
  { value: "none", label: "Sin enlace" },
  { value: "category", label: "Categoría" },
  { value: "product", label: "Producto" },
  { value: "seller", label: "Tienda" },
  { value: "url", label: "Página web" },
];

const emptyBanner = (): Banner => ({
  id: `bnr_${Date.now().toString(36)}`,
  title: "",
  subtitle: null,
  image_url: "",
  cta: null,
  link: { kind: "none", value: null, label: null },
  active: true,
});

function move<T>(list: T[], index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

const matches = (text: string, query: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes(query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());

/**
 * «Portada de la Tienda» (AG-34): the banner carousel and the featured products of Tienda's
 * home page. Changes stay here until «Guardar portada»; the API validates them again.
 */
export default function AdminHomeScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest, adminUpload } = useAdmin();
  const [content, setContent] = useState<Content>({ banners: [], featured_product_ids: [] });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Named[]>([]);
  const [sellers, setSellers] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [linkQuery, setLinkQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [home, stores] = await Promise.all([
        adminRequest<{ content: Content; products: Product[]; categories: Named[] }>(
          "/admin/agestyles/home",
        ),
        adminRequest<{ sellers: Named[] }>("/admin/sellers?limit=200&fields=id,name").catch(() => ({
          sellers: [] as Named[],
        })),
      ]);
      setContent(home.content);
      setProducts(home.products ?? []);
      setCategories(home.categories ?? []);
      setSellers(stores.sellers ?? []);
      setDirty(false);
    } catch (cause) {
      setError(adminError(cause, "No se pudo cargar la portada."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const change = (next: Content) => {
    setContent(next);
    setDirty(true);
    setNotice("");
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await adminRequest<{ content: Content }>(
        "/admin/agestyles/home",
        "POST",
        content,
      );
      setContent(result.content);
      setDirty(false);
      setNotice("Portada guardada. La Tienda la muestra en menos de un minuto.");
    } catch (cause) {
      setError(adminError(cause, "No se pudo guardar la portada."));
    } finally {
      setSaving(false);
    }
  }

  async function pickImage() {
    if (!editing) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setUploading(true);
    setError("");
    try {
      const longest = Math.max(asset.width, asset.height);
      const resize =
        longest > BANNER_EDGE
          ? asset.width >= asset.height
            ? { width: BANNER_EDGE }
            : { height: BANNER_EDGE }
          : null;
      const photo = await manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
        compress: 0.85,
        format: SaveFormat.JPEG,
      });
      const form = new FormData();
      const name = `portada-${Date.now()}.jpg`;
      if (Platform.OS === "web") form.append("files", await (await fetch(photo.uri)).blob(), name);
      else form.append("files", { uri: photo.uri, name, type: "image/jpeg" } as unknown as Blob);
      const { files } = await adminUpload(form);
      if (!files[0]?.url) throw new Error("upload");
      setEditing({ ...editing, image_url: files[0].url });
    } catch {
      setError("No se pudo subir la imagen. Revisa la conexión y prueba otra vez.");
    } finally {
      setUploading(false);
    }
  }

  function applyBanner() {
    if (!editing) return;
    if (!editing.title.trim()) return setError("Escribe el título del banner.");
    if (!/^https:\/\//.test(editing.image_url)) return setError("Sube una imagen para el banner.");
    if (editing.link.kind !== "none" && !editing.link.value)
      return setError("Elige a dónde lleva el banner.");
    if (editing.link.kind === "url" && !/^https:\/\//.test(editing.link.value ?? ""))
      return setError("La página web debe empezar por https://.");
    setError("");
    const exists = content.banners.some((banner) => banner.id === editing.id);
    change({
      ...content,
      banners: exists
        ? content.banners.map((banner) => (banner.id === editing.id ? editing : banner))
        : [...content.banners, editing],
    });
    setEditing(null);
  }

  const linkChoices: Named[] =
    editing?.link.kind === "category"
      ? categories
      : editing?.link.kind === "seller"
        ? sellers
        : editing?.link.kind === "product"
          ? products.map((p) => ({ id: p.id, name: p.title }))
          : [];
  const filteredLinkChoices = linkChoices
    .filter((choice) => !linkQuery.trim() || matches(choice.name, linkQuery.trim()))
    .slice(0, 12);
  const featuredCandidates = productQuery.trim()
    ? products
        .filter(
          (p) =>
            !content.featured_product_ids.includes(p.id) && matches(p.title, productQuery.trim()),
        )
        .slice(0, 8)
    : [];

  const linkSummary = (banner: Banner) =>
    banner.link.kind === "none"
      ? "Sin enlace"
      : `${LINK_OPTIONS.find((o) => o.value === banner.link.kind)?.label}: ${banner.link.label ?? banner.link.value}`;

  return (
    <OperationList
      title="Portada de la Tienda"
      subtitle="Banners del carrusel de la página inicial y productos destacados."
      loading={loading}
      error={error}
      empty=""
      isEmpty={false}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.saveBar}>
        <Text style={styles.muted}>{dirty ? "Hay cambios sin guardar." : "Todo guardado."}</Text>
        <Button
          title="Guardar portada"
          loading={saving}
          disabled={!dirty}
          onPress={() => void save()}
        />
      </View>

      <Section title={`Banners (${content.banners.length}/${MAX_BANNERS})`}>
        {content.banners.length ? null : (
          <Text style={[styles.muted, styles.pad]}>
            Sin banners, la Tienda muestra su presentación habitual.
          </Text>
        )}
        {content.banners.map((banner, index) => (
          <View key={banner.id} style={styles.row}>
            <View style={styles.bannerThumb}>
              <Image
                source={{ uri: banner.image_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{banner.title}</Text>
              <Text style={styles.muted}>
                {banner.active ? "Visible" : "Oculto"} · {linkSummary(banner)}
              </Text>
            </View>
            <View style={styles.tools}>
              <IconButton
                icon="chevronUp"
                label="Subir"
                disabled={index === 0}
                onPress={() => change({ ...content, banners: move(content.banners, index, -1) })}
              />
              <IconButton
                icon="chevronDown"
                label="Bajar"
                disabled={index === content.banners.length - 1}
                onPress={() => change({ ...content, banners: move(content.banners, index, 1) })}
              />
              <IconButton
                icon={banner.active ? "eye" : "eyeOff"}
                label={banner.active ? "Ocultar" : "Mostrar"}
                onPress={() =>
                  change({
                    ...content,
                    banners: content.banners.map((b) =>
                      b.id === banner.id ? { ...b, active: !b.active } : b,
                    ),
                  })
                }
              />
              <IconButton
                icon="settings"
                label="Editar"
                onPress={() => {
                  setEditing(banner);
                  setLinkQuery("");
                }}
              />
              <IconButton
                icon="trash"
                label="Eliminar"
                onPress={() =>
                  change({ ...content, banners: content.banners.filter((b) => b.id !== banner.id) })
                }
              />
            </View>
          </View>
        ))}
        {editing ? (
          <View style={styles.editor}>
            <Text style={styles.rowTitle}>
              {content.banners.some((b) => b.id === editing.id) ? "Editar banner" : "Nuevo banner"}
            </Text>
            <View style={styles.preview}>
              {editing.image_url ? (
                <Image
                  source={{ uri: editing.image_url }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.muted}>Imagen horizontal, al menos 1600 px de ancho.</Text>
              )}
            </View>
            <Button
              title={editing.image_url ? "Cambiar imagen" : "Subir imagen"}
              variant="secondary"
              loading={uploading}
              onPress={() => void pickImage()}
            />
            <Field
              label="Título"
              value={editing.title}
              max={80}
              onChange={(title) => setEditing({ ...editing, title })}
            />
            <Field
              label="Subtítulo (opcional)"
              value={editing.subtitle ?? ""}
              max={160}
              onChange={(subtitle) => setEditing({ ...editing, subtitle: subtitle || null })}
            />
            <Text style={styles.label}>¿A dónde lleva?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <PillGroup
                accessibilityLabel="Destino del banner"
                value={editing.link.kind}
                onChange={(kind) => {
                  setLinkQuery("");
                  setEditing({ ...editing, link: { kind, value: null, label: null } });
                }}
                options={LINK_OPTIONS}
              />
            </ScrollView>
            {editing.link.kind === "url" ? (
              <Field
                label="Dirección (https://…)"
                value={editing.link.value ?? ""}
                max={500}
                onChange={(value) =>
                  setEditing({
                    ...editing,
                    link: { kind: "url", value: value.trim() || null, label: null },
                  })
                }
              />
            ) : null}
            {editing.link.kind === "category" ||
            editing.link.kind === "product" ||
            editing.link.kind === "seller" ? (
              <View style={styles.choices}>
                {editing.link.value ? (
                  <Text style={styles.selected}>
                    Elegido: {editing.link.label ?? editing.link.value}
                  </Text>
                ) : null}
                <TextInput
                  value={linkQuery}
                  onChangeText={setLinkQuery}
                  placeholder="Buscar…"
                  placeholderTextColor={theme.muted}
                  accessibilityLabel="Buscar destino"
                  style={styles.input}
                />
                {filteredLinkChoices.map((choice) => (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    onPress={() =>
                      setEditing({
                        ...editing,
                        link: { kind: editing.link.kind, value: choice.id, label: choice.name },
                      })
                    }
                    style={[styles.choice, editing.link.value === choice.id && styles.choiceOn]}
                  >
                    <Text style={styles.choiceText}>{choice.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {editing.link.kind !== "none" ? (
              <Field
                label="Texto del botón (opcional)"
                value={editing.cta ?? ""}
                max={30}
                placeholder="Ver más"
                onChange={(cta) => setEditing({ ...editing, cta: cta || null })}
              />
            ) : null}
            <View style={styles.actions}>
              <Button title="Aplicar" onPress={applyBanner} />
              <Pressable accessibilityRole="button" onPress={() => setEditing(null)}>
                <Text style={styles.link}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : content.banners.length < MAX_BANNERS ? (
          <View style={styles.pad}>
            <Button
              title="Añadir banner"
              variant="secondary"
              onPress={() => {
                setEditing(emptyBanner());
                setLinkQuery("");
              }}
            />
          </View>
        ) : null}
      </Section>

      <Section title={`Destacados (${content.featured_product_ids.length}/${MAX_FEATURED})`}>
        <Text style={[styles.muted, styles.pad]}>
          Salen en la fila «Destacados» de la página inicial y primero en el catálogo. Los que no
          tengan existencias se ocultan solos.
        </Text>
        {content.featured_product_ids.map((id, index) => {
          const product = productById.get(id);
          return (
            <View key={id} style={styles.row}>
              <View style={styles.thumb}>
                {product?.thumbnail ? (
                  <Image
                    source={{ uri: product.thumbnail }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <Icon name="package" size={20} color={theme.muted} />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{product?.title ?? "Producto no publicado"}</Text>
              </View>
              <View style={styles.tools}>
                <IconButton
                  icon="chevronUp"
                  label="Subir"
                  disabled={index === 0}
                  onPress={() =>
                    change({
                      ...content,
                      featured_product_ids: move(content.featured_product_ids, index, -1),
                    })
                  }
                />
                <IconButton
                  icon="chevronDown"
                  label="Bajar"
                  disabled={index === content.featured_product_ids.length - 1}
                  onPress={() =>
                    change({
                      ...content,
                      featured_product_ids: move(content.featured_product_ids, index, 1),
                    })
                  }
                />
                <IconButton
                  icon="trash"
                  label="Quitar"
                  onPress={() =>
                    change({
                      ...content,
                      featured_product_ids: content.featured_product_ids.filter((x) => x !== id),
                    })
                  }
                />
              </View>
            </View>
          );
        })}
        {content.featured_product_ids.length < MAX_FEATURED ? (
          <View style={[styles.pad, styles.choices]}>
            <TextInput
              value={productQuery}
              onChangeText={setProductQuery}
              placeholder="Buscar un producto para destacar"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Buscar un producto para destacar"
              style={styles.input}
            />
            {featuredCandidates.map((product) => (
              <Pressable
                key={product.id}
                accessibilityRole="button"
                accessibilityLabel={`Destacar ${product.title}`}
                onPress={() => {
                  change({
                    ...content,
                    featured_product_ids: [...content.featured_product_ids, product.id],
                  });
                  setProductQuery("");
                }}
                style={styles.choice}
              >
                <Icon name="plus" size={16} color={theme.action} />
                <Text style={styles.choiceText}>{product.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Section>
    </OperationList>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  placeholder?: string;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={max}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "chevronUp" | "chevronDown" | "eye" | "eyeOff" | "settings" | "trash";
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
    pad: { padding: 14 },
    row: {
      minHeight: 72,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    bannerThumb: {
      width: 96,
      height: 54,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
    },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    flex: { flex: 1, gap: 3 },
    tools: { flexDirection: "row", gap: 2, flexWrap: "wrap", justifyContent: "flex-end" },
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
    label: { color: theme.text, fontSize: 13, fontWeight: "600" },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    selected: { color: theme.successText, fontSize: 13, fontWeight: "600" },
    editor: { padding: 14, gap: 12 },
    preview: {
      aspectRatio: 16 / 6,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
    },
    field: { gap: 6 },
    choices: { gap: 6 },
    choice: {
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    choiceOn: { borderColor: theme.action, backgroundColor: theme.quietSurface },
    choiceText: { color: theme.text, fontSize: 14, flexShrink: 1 },
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
