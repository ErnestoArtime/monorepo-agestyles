import { mediaVariant } from "@agestyles/api-client/media";
import { useNotice } from "../../hooks/use-notice";
import { Icon } from "@agestyles/icons";
import { Button, PillGroup, StatusBadge } from "@agestyles/ui-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CategoryPicker, type CategoryNode } from "../../components/category-picker";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError } from "../../lib/admin";
import {
  ATTRIBUTE_FIELDS,
  CODIFIER_KEY,
  handleFrom,
  isBrandAttribute,
  isSizeAttribute,
  SIZE_PRESETS,
  sortedValues,
  type Attribute,
  type AttributeValue,
} from "../../lib/codifiers";

type Category = CategoryNode & {
  handle: string;
  description: string | null;
  rank: number | null;
  is_active: boolean;
  is_internal: boolean;
  metadata: Record<string, unknown> | null;
  product_count: number;
};
type Tab = "categories" | "sizes" | "brands";

const TABS: { value: Tab; label: string }[] = [
  { value: "categories", label: "Categorías" },
  { value: "sizes", label: "Tallas" },
  { value: "brands", label: "Marcas" },
];

/** API messages written in Spanish by our routes are shown as they are. */
function message(cause: unknown, fallback: string) {
  const text = cause instanceof Error ? cause.message : "";
  return /[áéíóúñ]|categor|subcategor|producto/i.test(text) && text.length < 220
    ? text
    : adminError(cause, fallback);
}

/**
 * Administración → «Codificadores» (AG-42), as in the old catalog: categories and
 * subcategories (Medusa product categories), sizes by type and brands (Mercur global
 * attributes). Sizes and brands are deactivated instead of deleted, so products keep them.
 */
export default function CodifiersScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const [tab, setTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cats, attrs] = await Promise.all([
        adminRequest<{ categories: Category[] }>("/admin/agestyles/codifiers/categories"),
        adminRequest<{ product_attributes: Attribute[] }>(
          `/admin/product-attributes?limit=200&fields=${ATTRIBUTE_FIELDS}`,
        ),
      ]);
      setCategories(cats.categories ?? []);
      setAttributes(attrs.product_attributes ?? []);
    } catch (cause) {
      setError(message(cause, "No se pudieron cargar los codificadores."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = async (text: string) => {
    setNotice(text);
    setError("");
    await load();
  };
  const fail = (cause: unknown, fallback: string) => {
    setNotice("");
    setError(message(cause, fallback));
  };

  return (
    <OperationList
      title="Codificadores"
      subtitle="Categorías, tallas y marcas que usan todas las tiendas del catálogo."
      loading={loading && !categories.length}
      error={error}
      onRefresh={() => void load()}
    >
      <View style={styles.toolbar}>
        <PillGroup accessibilityLabel="Codificador" value={tab} onChange={setTab} options={TABS} />
      </View>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {tab === "categories" ? (
        <CategoriesTab categories={categories} onDone={done} onFail={fail} />
      ) : tab === "sizes" ? (
        <SizesTab attributes={attributes.filter(isSizeAttribute)} onDone={done} onFail={fail} />
      ) : (
        <BrandsTab
          attribute={attributes.find(isBrandAttribute) ?? null}
          onDone={done}
          onFail={fail}
        />
      )}
    </OperationList>
  );
}

type TabProps = {
  onDone: (notice: string) => Promise<void>;
  onFail: (cause: unknown, fallback: string) => void;
};

// Categorías ------------------------------------------------------------------

function CategoriesTab({ categories, onDone, onFail }: TabProps & { categories: Category[] }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const [editing, setEditing] = useState<(Partial<Category> & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Depth-first tree: each category followed by its subcategories, in their order.
  const tree = useMemo(() => {
    const byParent = new Map<string | null, Category[]>();
    for (const category of categories) {
      const key = category.parent_category_id ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), category]);
    }
    const rows: { category: Category; depth: number; siblings: Category[] }[] = [];
    const walk = (parent: string | null, depth: number) => {
      const siblings = byParent.get(parent) ?? [];
      for (const category of siblings) {
        rows.push({ category, depth, siblings });
        if (depth < 6) walk(category.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [categories]);

  const descendants = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of categories)
        if (c.parent_category_id && out.has(c.parent_category_id) && !out.has(c.id)) {
          out.add(c.id);
          grew = true;
        }
    }
    return out;
  };

  async function save() {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (name.length < 2) return onFail(new Error("Escribe el nombre de la categoría."), "");
    setBusy(true);
    try {
      const body = {
        name,
        description: (editing.description ?? "").trim() || undefined,
        parent_category_id: editing.parent_category_id ?? null,
        is_active: editing.is_active !== false,
        metadata: {
          ...(editing.metadata ?? {}),
          uses_gender: Boolean(editing.metadata?.uses_gender),
        },
      };
      if (editing.id) {
        await adminRequest(`/admin/product-categories/${editing.id}`, "POST", body);
      } else {
        await adminRequest("/admin/product-categories", "POST", {
          ...body,
          // Handles are unique across the catalog; the suffix avoids clashes between levels.
          handle: `${handleFrom(name)}-${Date.now().toString(36)}`,
          is_internal: false,
        });
      }
      setEditing(null);
      await onDone(editing.id ? `«${name}» guardada.` : `«${name}» creada.`);
    } catch (cause) {
      onFail(cause, "No se pudo guardar la categoría.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(category: Category) {
    try {
      await adminRequest(`/admin/product-categories/${category.id}`, "POST", {
        is_active: !category.is_active,
      });
      await onDone(
        category.is_active
          ? `«${category.name}» desactivada: deja de verse en la Tienda.`
          : `«${category.name}» activada.`,
      );
    } catch (cause) {
      onFail(cause, "No se pudo cambiar el estado.");
    }
  }

  async function move(category: Category, siblings: Category[], delta: number) {
    const index = siblings.findIndex((s) => s.id === category.id);
    const other = siblings[index + delta];
    if (!other) return;
    try {
      // Ranks are rewritten for the whole level, so the order is always 0, 1, 2…
      const order = [...siblings];
      [order[index], order[index + delta]] = [order[index + delta]!, order[index]!];
      for (const [rank, entry] of order.entries()) {
        if ((entry.rank ?? -1) !== rank)
          await adminRequest(`/admin/product-categories/${entry.id}`, "POST", { rank });
      }
      await onDone("Orden guardado.");
    } catch (cause) {
      onFail(cause, "No se pudo cambiar el orden.");
    }
  }

  async function remove(category: Category) {
    try {
      await adminRequest(`/admin/agestyles/codifiers/categories/${category.id}`, "DELETE");
      setConfirmDelete(null);
      await onDone(`«${category.name}» borrada.`);
    } catch (cause) {
      setConfirmDelete(null);
      onFail(cause, "No se pudo borrar la categoría.");
    }
  }

  const exclude = editing?.id ? descendants(editing.id) : new Set<string>();

  return (
    <>
      <View style={styles.actionsBar}>
        <Button
          title="Nueva categoría"
          variant="secondary"
          onPress={() => setEditing({ name: "", parent_category_id: null, is_active: true })}
        />
      </View>
      {editing ? (
        <Section title={editing.id ? "Editar categoría" : "Nueva categoría"}>
          <View style={styles.form}>
            <Field
              label="Nombre"
              value={editing.name ?? ""}
              onChange={(name) => setEditing({ ...editing, name })}
            />
            <Field
              label="Descripción (opcional)"
              value={editing.description ?? ""}
              onChange={(description) => setEditing({ ...editing, description })}
            />
            <CategoryPicker
              label="Dentro de"
              categories={categories.filter((c) => !exclude.has(c.id))}
              value={editing.parent_category_id ?? null}
              onChange={(parent) => setEditing({ ...editing, parent_category_id: parent })}
              rootLabel="Categoría principal"
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(editing.metadata?.uses_gender) }}
              onPress={() =>
                setEditing({
                  ...editing,
                  metadata: {
                    ...(editing.metadata ?? {}),
                    uses_gender: !editing.metadata?.uses_gender,
                  },
                })
              }
              style={styles.check}
            >
              <Icon
                name={editing.metadata?.uses_gender ? "check" : "plus"}
                size={16}
                color={theme.action}
              />
              <Text style={styles.rowTitle}>Usa género (hombre, mujer, unisex)</Text>
            </Pressable>
            <View style={styles.inline}>
              <Button title="Guardar" loading={busy} onPress={() => void save()} />
              <Pressable accessibilityRole="button" onPress={() => setEditing(null)}>
                <Text style={styles.link}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Section>
      ) : null}
      <Section title={`Categorías (${categories.length})`}>
        {tree.map(({ category, depth, siblings }) => {
          const index = siblings.findIndex((s) => s.id === category.id);
          return (
            <View key={category.id} style={[styles.row, { paddingLeft: 14 + depth * 22 }]}>
              <View style={styles.flex}>
                <View style={styles.inline}>
                  {depth ? <Text style={styles.muted}>↳</Text> : null}
                  <Text style={styles.rowTitle}>{category.name}</Text>
                  {!category.is_active ? <StatusBadge label="Inactiva" tone="neutral" /> : null}
                  {category.is_internal ? <StatusBadge label="Interna" tone="neutral" /> : null}
                </View>
                <Text style={styles.muted}>
                  {category.product_count} {category.product_count === 1 ? "producto" : "productos"}
                  {category.metadata?.uses_gender ? " · usa género" : ""}
                </Text>
                {confirmDelete === category.id ? (
                  <View style={styles.inline}>
                    <Text style={styles.danger}>¿Borrar «{category.name}»?</Text>
                    <Button title="Borrar" variant="danger" onPress={() => void remove(category)} />
                    <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(null)}>
                      <Text style={styles.link}>Cancelar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={styles.tools}>
                <Tool
                  icon="chevronUp"
                  label="Subir"
                  disabled={index === 0}
                  onPress={() => void move(category, siblings, -1)}
                />
                <Tool
                  icon="chevronDown"
                  label="Bajar"
                  disabled={index === siblings.length - 1}
                  onPress={() => void move(category, siblings, 1)}
                />
                <Tool
                  icon={category.is_active ? "eye" : "eyeOff"}
                  label={category.is_active ? "Desactivar" : "Activar"}
                  onPress={() => void toggle(category)}
                />
                <Tool icon="settings" label="Editar" onPress={() => setEditing(category)} />
                <Tool icon="trash" label="Borrar" onPress={() => setConfirmDelete(category.id)} />
              </View>
            </View>
          );
        })}
      </Section>
    </>
  );
}

// Tallas ----------------------------------------------------------------------

function SizesTab({ attributes, onDone, onFail }: TabProps & { attributes: Attribute[] }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const [busy, setBusy] = useState("");
  const [newType, setNewType] = useState({ name: "", values: "" });
  const [adding, setAdding] = useState<Record<string, string>>({});
  const missing = SIZE_PRESETS.filter(
    (preset) => !attributes.some((attribute) => attribute.metadata?.size_type === preset.type),
  );

  async function create(name: string, sizeType: string, values: string[]) {
    await adminRequest("/admin/product-attributes", "POST", {
      name,
      handle: `talla-${handleFrom(sizeType)}`,
      // Mercur only treats multi-select attributes as variant axes (one variant per size).
      type: "multi_select",
      is_variant_axis: true,
      is_filterable: true,
      metadata: { [CODIFIER_KEY]: "size", size_type: sizeType },
      values: values.map((value, rank) => ({ name: value, rank })),
    });
  }

  async function createPresets() {
    setBusy("presets");
    try {
      for (const preset of missing) await create(preset.name, preset.type, preset.values);
      await onDone(`Creados ${missing.length} tipos de talla con sus tallas.`);
    } catch (cause) {
      onFail(cause, "No se pudieron crear los tipos de talla.");
    } finally {
      setBusy("");
    }
  }

  async function createType() {
    const name = newType.name.trim();
    const values = newType.values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (name.length < 2 || !values.length)
      return onFail(new Error("Escribe el nombre del tipo y al menos una talla."), "");
    setBusy("new");
    try {
      await create(name, handleFrom(name), values);
      setNewType({ name: "", values: "" });
      await onDone(`«${name}» creado.`);
    } catch (cause) {
      onFail(cause, "No se pudo crear el tipo de talla.");
    } finally {
      setBusy("");
    }
  }

  async function addValue(attribute: Attribute) {
    const names = (adding[attribute.id] ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!names.length) return;
    const existing = sortedValues(attribute);
    setBusy(attribute.id);
    try {
      await adminRequest(`/admin/product-attributes/${attribute.id}/values`, "POST", {
        values: [
          ...existing.map((value) => ({ id: value.id })),
          ...names
            .filter(
              (name) => !existing.some((value) => value.name.toLowerCase() === name.toLowerCase()),
            )
            .map((name, i) => ({ name, rank: existing.length + i })),
        ],
      });
      setAdding({ ...adding, [attribute.id]: "" });
      await onDone("Tallas añadidas.");
    } catch (cause) {
      onFail(cause, "No se pudieron añadir las tallas.");
    } finally {
      setBusy("");
    }
  }

  async function toggleValue(attribute: Attribute, value: AttributeValue) {
    try {
      await adminRequest(`/admin/product-attributes/${attribute.id}/values/${value.id}`, "POST", {
        is_active: value.is_active === false,
      });
      await onDone(
        value.is_active === false
          ? `Talla ${value.name} activada.`
          : `Talla ${value.name} desactivada.`,
      );
    } catch (cause) {
      onFail(cause, "No se pudo cambiar la talla.");
    }
  }

  return (
    <>
      <Text style={[styles.muted, styles.space]}>
        Las tiendas eligen las tallas de estas listas al dar de alta un producto; cada talla elegida
        es una variante. Una talla desactivada deja de ofrecerse, pero los productos que la usan la
        conservan.
      </Text>
      {missing.length ? (
        <View style={styles.actionsBar}>
          <Button
            title={`Crear los tipos del catálogo anterior (${missing.map((m) => m.name.replace("Talla de ", "")).join(", ")})`}
            variant="secondary"
            loading={busy === "presets"}
            onPress={() => void createPresets()}
          />
        </View>
      ) : null}
      {attributes.map((attribute) => (
        <Section key={attribute.id} title={attribute.name}>
          <View style={styles.chips}>
            {sortedValues(attribute).map((value) => (
              <Pressable
                key={value.id}
                accessibilityRole="button"
                accessibilityLabel={`${value.name}: ${value.is_active === false ? "desactivada, pulsa para activar" : "activa, pulsa para desactivar"}`}
                onPress={() => void toggleValue(attribute, value)}
                style={[styles.chip, value.is_active === false && styles.chipOff]}
              >
                <Text style={[styles.chipText, value.is_active === false && styles.chipTextOff]}>
                  {value.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.inline, styles.pad]}>
            <TextInput
              value={adding[attribute.id] ?? ""}
              onChangeText={(text) => setAdding({ ...adding, [attribute.id]: text })}
              placeholder="Añadir tallas (separadas por comas)"
              placeholderTextColor={theme.muted}
              accessibilityLabel={`Añadir tallas a ${attribute.name}`}
              style={[styles.input, styles.flex]}
            />
            <Button
              title="Añadir"
              loading={busy === attribute.id}
              onPress={() => void addValue(attribute)}
            />
          </View>
        </Section>
      ))}
      <Section title="Nuevo tipo de talla">
        <View style={styles.form}>
          <Field
            label="Nombre"
            value={newType.name}
            placeholder="Por ejemplo: Talla de anillo"
            onChange={(name) => setNewType({ ...newType, name })}
          />
          <Field
            label="Tallas (separadas por comas, en orden)"
            value={newType.values}
            placeholder="6, 7, 8, 9"
            onChange={(values) => setNewType({ ...newType, values })}
          />
          <Button
            title="Crear tipo de talla"
            loading={busy === "new"}
            onPress={() => void createType()}
          />
        </View>
      </Section>
    </>
  );
}

// Marcas ----------------------------------------------------------------------

function BrandsTab({ attribute, onDone, onFail }: TabProps & { attribute: Attribute | null }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest, adminUpload } = useAdmin();
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [editing, setEditing] = useState<AttributeValue | null>(null);

  async function enable() {
    setBusy("enable");
    try {
      await adminRequest("/admin/product-attributes", "POST", {
        name: "Marca",
        handle: "marca",
        type: "single_select",
        is_variant_axis: false,
        is_filterable: true,
        metadata: { [CODIFIER_KEY]: "brand" },
        values: [],
      });
      await onDone("Marcas activadas. Ya puedes añadirlas.");
    } catch (cause) {
      onFail(cause, "No se pudieron activar las marcas.");
    } finally {
      setBusy("");
    }
  }

  async function pickLogo() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setBusy("logo");
    try {
      const asset = picked.assets[0];
      const longest = Math.max(asset.width, asset.height);
      const resize =
        longest > 600 ? (asset.width >= asset.height ? { width: 600 } : { height: 600 }) : null;
      const photo = await manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
        compress: 0.9,
        format: SaveFormat.PNG,
      });
      const form = new FormData();
      const file = `marca-${Date.now()}.png`;
      if (Platform.OS === "web") form.append("files", await (await fetch(photo.uri)).blob(), file);
      else
        form.append("files", { uri: photo.uri, name: file, type: "image/png" } as unknown as Blob);
      const { files } = await adminUpload(form);
      setLogo(files[0]?.url ?? null);
    } catch (cause) {
      onFail(cause, "No se pudo subir el logo.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!attribute) return;
    const clean = name.trim();
    if (clean.length < 2) return onFail(new Error("Escribe el nombre de la marca."), "");
    const existing = sortedValues(attribute);
    if (!editing && existing.some((value) => value.name.toLowerCase() === clean.toLowerCase()))
      return onFail(new Error("Esa marca ya existe."), "");
    setBusy("save");
    try {
      if (editing) {
        await adminRequest(
          `/admin/product-attributes/${attribute.id}/values/${editing.id}`,
          "POST",
          {
            name: clean,
            metadata: { ...(editing.metadata ?? {}), logo_url: logo },
          },
        );
      } else {
        await adminRequest(`/admin/product-attributes/${attribute.id}/values`, "POST", {
          values: [
            ...existing.map((value) => ({ id: value.id })),
            { name: clean, rank: existing.length, metadata: { logo_url: logo } },
          ],
        });
      }
      setName("");
      setLogo(null);
      setEditing(null);
      await onDone(editing ? `«${clean}» guardada.` : `«${clean}» añadida.`);
    } catch (cause) {
      onFail(cause, "No se pudo guardar la marca.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(value: AttributeValue) {
    if (!attribute) return;
    try {
      await adminRequest(`/admin/product-attributes/${attribute.id}/values/${value.id}`, "POST", {
        is_active: value.is_active === false,
      });
      await onDone(
        value.is_active === false ? `«${value.name}» activada.` : `«${value.name}» desactivada.`,
      );
    } catch (cause) {
      onFail(cause, "No se pudo cambiar la marca.");
    }
  }

  if (!attribute) {
    return (
      <Section title="Marcas">
        <View style={styles.form}>
          <Text style={styles.muted}>
            Las marcas aún no están activadas. Al activarlas, las tiendas podrán elegir la marca de
            cada producto y los compradores filtrar por marca.
          </Text>
          <Button
            title="Activar marcas"
            loading={busy === "enable"}
            onPress={() => void enable()}
          />
        </View>
      </Section>
    );
  }

  return (
    <>
      <Section title={editing ? "Editar marca" : "Nueva marca"}>
        <View style={styles.form}>
          <Field label="Nombre" value={name} onChange={setName} />
          <View style={styles.inline}>
            <View style={styles.logo}>
              {logo ? (
                <Image
                  source={{ uri: mediaVariant(logo, 400) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              ) : (
                <Icon name="tag" size={20} color={theme.muted} />
              )}
            </View>
            <Button
              title={logo ? "Cambiar logo" : "Subir logo (opcional)"}
              variant="secondary"
              loading={busy === "logo"}
              onPress={() => void pickLogo()}
            />
          </View>
          <View style={styles.inline}>
            <Button
              title={editing ? "Guardar" : "Añadir marca"}
              loading={busy === "save"}
              onPress={() => void save()}
            />
            {editing ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setEditing(null);
                  setName("");
                  setLogo(null);
                }}
              >
                <Text style={styles.link}>Cancelar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Section>
      <Section title={`Marcas (${attribute.values?.length ?? 0})`}>
        {sortedValues(attribute).length ? null : (
          <Text style={[styles.muted, styles.pad]}>Todavía no hay marcas.</Text>
        )}
        {sortedValues(attribute).map((value) => {
          const url = typeof value.metadata?.logo_url === "string" ? value.metadata.logo_url : null;
          return (
            <View key={value.id} style={styles.row}>
              <View style={styles.logo}>
                {url ? (
                  <Image
                    source={{ uri: mediaVariant(url, 400) }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name="tag" size={18} color={theme.muted} />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{value.name}</Text>
                {value.is_active === false ? <Text style={styles.muted}>Desactivada</Text> : null}
              </View>
              <View style={styles.tools}>
                <Tool
                  icon={value.is_active === false ? "eyeOff" : "eye"}
                  label={value.is_active === false ? "Activar" : "Desactivar"}
                  onPress={() => void toggle(value)}
                />
                <Tool
                  icon="settings"
                  label="Editar"
                  onPress={() => {
                    setEditing(value);
                    setName(value.name);
                    setLogo(url);
                  }}
                />
              </View>
            </View>
          );
        })}
      </Section>
    </>
  );
}

// Shared pieces ---------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  );
}

function Tool({
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
      style={[styles.tool, disabled && styles.disabled]}
    >
      <Icon name={icon} size={18} color={icon === "trash" ? theme.error : theme.text} />
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { marginBottom: 12 },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    actionsBar: { marginBottom: 12, alignItems: "flex-start" },
    space: { marginBottom: 12 },
    form: { padding: 14, gap: 10 },
    field: { gap: 6 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
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
    check: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
    inline: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    row: {
      minHeight: 60,
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
    tool: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.3 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    danger: { color: theme.error, fontSize: 14, fontWeight: "600" },
    pad: { padding: 14 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 14 },
    chip: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: theme.action,
      justifyContent: "center",
    },
    chipOff: { borderColor: theme.border, borderStyle: "dashed" },
    chipText: { color: theme.text, fontSize: 14, fontWeight: "600" },
    chipTextOff: { color: theme.muted, textDecorationLine: "line-through" },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
