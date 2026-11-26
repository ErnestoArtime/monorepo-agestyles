import { Icon } from "@agestyles/icons";
import { buildProductCopyDraft, type ProductCopyTone } from "@agestyles/domain/product-copy";
import { BottomSheet, Button, Card, LargeTitle, PillGroup } from "@agestyles/ui-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { CategoryPicker, categoryPath, type CategoryNode } from "../components/category-picker";
import { hasPermission, OperationList } from "../components/operation-list";
import {
  activeValues,
  ATTRIBUTE_FIELDS,
  isBrandAttribute,
  isSizeAttribute,
  type Attribute,
} from "../lib/codifiers";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { useResponsive } from "../hooks/use-responsive";

/** Prepared photo: resized and compressed on the device, then uploaded right away. */
type Photo = { uri: string; width: number; height: number };
/** Uploaded photo: `url` is the public address used by the product and by AI Studio. */
type StoredPhoto = { uri: string; url: string };

/** What the server says AI Studio can do for this member (AG-27). */
type AiStatus = {
  allowed: boolean;
  describe: boolean;
  remove_background: boolean;
  used: number;
  limit: number;
};

function aiErrorMessage(cause: unknown, fallback: string) {
  const message = String((cause as { message?: string })?.message ?? "");
  if (message.includes("quota")) return "Se alcanzó el límite mensual de la IA para esta tienda.";
  if (message.includes("not configured")) return "La IA todavía no está activada en el servidor.";
  if (message.includes("owner"))
    return "La IA está disponible para el titular y la administración.";
  return fallback;
}

/** Longest side after on-device resizing: sharp on phones and catalog pages, light to upload. */
const MAX_EDGE = 1600;
const TONE_OPTIONS: { value: ProductCopyTone; label: string }[] = [
  { value: "commercial", label: "Comercial" },
  { value: "technical", label: "Técnico" },
  { value: "direct", label: "Directo" },
];
const MAX_PHOTOS = 6;

/** Resize so the longest side is at most `maxEdge`, then save as a compressed JPEG. */
async function preparePhoto(asset: ImagePicker.ImagePickerAsset, maxEdge: number): Promise<Photo> {
  const longest = Math.max(asset.width, asset.height);
  const resize =
    longest > maxEdge
      ? asset.width >= asset.height
        ? { width: maxEdge }
        : { height: maxEdge }
      : null;
  const result = await manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}

/** Product creation with photos (AG-26). The product goes to AgeStyles for review. */
export default function NewProductScreen() {
  const theme = useBusinessTheme();
  const { isWideWeb } = useResponsive();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, upload, member, seller } = useBusiness();
  const canEdit = hasPermission(member, "products", "edit");

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [variantTitle, setVariantTitle] = useState("");
  const [sku, setSku] = useState("");
  const [tone, setTone] = useState<ProductCopyTone>("commercial");
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState("");
  const [suggestion, setSuggestion] = useState<{ title: string; description: string } | null>(null);
  const [cutout, setCutout] = useState<{ index: number; original: string; url: string } | null>(
    null,
  );
  // Codificadores (AG-42): marketplace categories, brands and sizes chosen from lists.
  const [categoryOptions, setCategoryOptions] = useState<CategoryNode[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [codifiers, setCodifiers] = useState<Attribute[]>([]);
  const [brandValueId, setBrandValueId] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [sizeAttributeId, setSizeAttributeId] = useState<string | null>(null);
  const [sizeValueIds, setSizeValueIds] = useState<string[]>([]);
  const brandAttribute = useMemo(() => codifiers.find(isBrandAttribute) ?? null, [codifiers]);
  const brandValues = brandAttribute ? activeValues(brandAttribute) : [];
  const sizeAttributes = useMemo(
    () => codifiers.filter((a) => isSizeAttribute(a) && a.is_active !== false),
    [codifiers],
  );
  const sizeAttribute = sizeAttributes.find((a) => a.id === sizeAttributeId) ?? null;

  useEffect(() => {
    if (!seller) return;
    request<{ product_categories: CategoryNode[] }>(
      "/vendor/product-categories?limit=500&fields=id,name,parent_category_id,is_active",
    )
      .then((data) =>
        setCategoryOptions(
          (data.product_categories ?? []).filter(
            (c) => (c as CategoryNode & { is_active?: boolean }).is_active !== false,
          ),
        ),
      )
      .catch(() => setCategoryOptions([]));
    request<{ product_attributes: Attribute[] }>(
      `/vendor/product-attributes?limit=200&fields=${ATTRIBUTE_FIELDS}`,
    )
      .then((data) => setCodifiers(data.product_attributes ?? []))
      .catch(() => setCodifiers([]));
  }, [request, seller]);

  // The AI copy and the checklist read the chosen names.
  useEffect(() => {
    if (categoryId) setCategory(categoryPath(categoryOptions, categoryId));
  }, [categoryId, categoryOptions]);
  useEffect(() => {
    const value = brandValues.find((v) => v.id === brandValueId);
    if (value) setBrand(value.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandValueId]);

  useEffect(() => {
    if (!seller) return;
    // AI Studio is optional: any error simply hides its buttons.
    request<AiStatus>("/vendor/agestyles/ai-studio")
      .then(setAi)
      .catch(() => setAi(null));
  }, [request, seller]);
  const aiLeft = ai ? Math.max(ai.limit - ai.used, 0) : 0;
  const canDescribe = !!ai?.allowed && ai.describe && aiLeft > 0;
  const canCutout = !!ai?.allowed && ai.remove_background && aiLeft > 0;

  async function suggestWithAi() {
    setAiBusy("describe");
    setAiNotice("");
    try {
      const result = await request<{
        draft: { title: string; description: string };
        used_image: boolean;
      }>("/vendor/agestyles/ai-studio/describe", "POST", {
        title,
        brand,
        category,
        tone,
        ...(description.trim() ? { notes: description.trim() } : {}),
        ...(photos[0] ? { image_url: photos[0].url } : {}),
      });
      setSuggestion(result.draft);
      if (photos[0] && !result.used_image) {
        setAiNotice("La IA no pudo leer la foto; la propuesta usa solo los datos de la ficha.");
      }
      setAi((current) => (current ? { ...current, used: current.used + 1 } : current));
    } catch (cause) {
      setAiNotice(
        aiErrorMessage(cause, "La IA no pudo preparar la propuesta. Inténtalo más tarde."),
      );
      setAi((current) => (current ? { ...current, used: current.used + 1 } : current));
    } finally {
      setAiBusy(null);
    }
  }

  async function removeBackground(index: number) {
    const photo = photos[index];
    if (!photo) return;
    setAiBusy(`cutout-${index}`);
    setAiNotice("");
    try {
      const result = await request<{ url: string }>(
        "/vendor/agestyles/ai-studio/remove-background",
        "POST",
        { image_url: photo.url },
      );
      setCutout({ index, original: photo.url, url: result.url });
    } catch (cause) {
      setAiNotice(aiErrorMessage(cause, "No se pudo quitar el fondo de esta foto."));
    } finally {
      setAi((current) => (current ? { ...current, used: current.used + 1 } : current));
      setAiBusy(null);
    }
  }
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function addPhotos(source: "library" | "camera") {
    setError("");
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Sin permiso de cámara. Puedes elegir una foto guardada.");
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      // Native pickers offer a square crop; the web picker returns the original.
      allowsEditing: Platform.OS !== "web",
      aspect: [1, 1],
      allowsMultipleSelection: source === "library" && Platform.OS === "web",
      selectionLimit: MAX_PHOTOS - photos.length,
    };
    const picked =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return;
    setPreparing(true);
    try {
      const prepared = await Promise.all(
        picked.assets
          .slice(0, MAX_PHOTOS - photos.length)
          .map((asset) => preparePhoto(asset, MAX_EDGE)),
      );
      const urls = await uploadPhotos(prepared);
      setPhotos((current) =>
        [...current, ...prepared.map((photo, i) => ({ uri: photo.uri, url: urls[i]! }))].slice(
          0,
          MAX_PHOTOS,
        ),
      );
    } catch {
      setError("No se pudo preparar o subir la foto. Revisa la conexión y prueba otra vez.");
    } finally {
      setPreparing(false);
    }
  }

  function movePhoto(index: number) {
    // The first photo is the cover (thumbnail); tapping «Portada» moves a photo to the front.
    setPhotos((current) => [current[index]!, ...current.filter((_, i) => i !== index)]);
  }

  async function uploadPhotos(prepared: Photo[]): Promise<string[]> {
    if (!prepared.length) return [];
    const form = new FormData();
    for (const [index, photo] of prepared.entries()) {
      const name = `producto-${Date.now()}-${index + 1}.jpg`;
      if (Platform.OS === "web") {
        const blob = await (await fetch(photo.uri)).blob();
        form.append("files", blob, name);
      } else {
        form.append("files", { uri: photo.uri, name, type: "image/jpeg" } as unknown as Blob);
      }
    }
    const result = await upload(form);
    if (result.files.length !== prepared.length) throw new Error("upload mismatch");
    return result.files.map((file) => file.url);
  }

  async function submit() {
    const name = title.trim();
    if (!name) {
      setError("Escribe el nombre del producto.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const urls = photos.map((photo) => photo.url);
      // One variant per chosen size (the size attribute is Mercur's variant axis).
      const sizes = sizeAttribute
        ? activeValues(sizeAttribute).filter((v) => sizeValueIds.includes(v.id))
        : [];
      const attributes = [
        ...(brandAttribute && brandValueId
          ? [{ id: brandAttribute.id, value_ids: [brandValueId] }]
          : []),
        ...(sizeAttribute && sizes.length
          ? [{ id: sizeAttribute.id, value_ids: sizes.map((v) => v.id) }]
          : []),
      ];
      const variants = sizes.length
        ? sizes.map((size) => ({
            title: size.name,
            options: { [sizeAttribute!.name]: size.name },
            ...(sku.trim() ? { sku: `${sku.trim()}-${size.name}`.toUpperCase() } : {}),
          }))
        : [
            {
              title: variantTitle.trim() || "Única",
              ...(sku.trim() ? { sku: sku.trim() } : {}),
            },
          ];
      await request("/vendor/products", "POST", {
        title: name,
        ...(description.trim() ? { description: description.trim() } : {}),
        status: "proposed",
        ...(urls.length ? { images: urls.map((url) => ({ url })), thumbnail: urls[0] } : {}),
        ...(categoryId ? { categories: [{ id: categoryId }] } : {}),
        ...(attributes.length ? { attributes } : {}),
        variants,
      });
      setDone(true);
    } catch {
      setError("No se pudo crear el producto. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setTitle("");
    setBrand("");
    setCategory("");
    setDescription("");
    setVariantTitle("");
    setSku("");
    setCategoryId(null);
    setBrandValueId(null);
    setSizeAttributeId(null);
    setSizeValueIds([]);
    setPhotos([]);
    setDone(false);
  }

  if (done) {
    return (
      <OperationList title="Producto enviado" subtitle="" loading={false} error="">
        <Card style={styles.doneCard}>
          <View style={[styles.doneIcon, { backgroundColor: theme.successSoft }]}>
            <Icon name="check" size={24} color={theme.successText} />
          </View>
          <Text style={styles.doneText}>
            AgeStyles revisará la ficha antes de publicarla. Después podrás fijar precio y
            existencias.
          </Text>
          <Button title="Crear otro producto" onPress={reset} />
          <Button
            title="Ver productos"
            variant="secondary"
            onPress={() => router.replace("/(tabs)/products")}
          />
        </Card>
      </OperationList>
    );
  }

  if (!canEdit) {
    return (
      <OperationList
        title="Nuevo producto"
        subtitle=""
        loading={false}
        error="Tu rol no permite crear productos."
      />
    );
  }

  const cover = photos[0];
  const checklist = [
    { label: "Portada", ok: !!cover },
    { label: "Nombre", ok: !!title.trim() },
    { label: "Descripción", ok: description.trim().length >= 20 },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Phones show «Nuevo producto» in the app header; the page title is for wide browsers. */}
        {isWideWeb ? (
          <>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Volver a productos"
              style={styles.back}
            >
              <Icon name="arrowLeft" size={18} color={theme.action} />
              <Text style={styles.link}>Productos</Text>
            </Pressable>
            <LargeTitle
              title="Nuevo producto"
              subtitle="Una buena portada y una descripción con datos reales venden más."
            />
          </>
        ) : null}
        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Icon name="alert" size={18} color={theme.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Photos: one large cover, then a strip with the rest. */}
        <Card style={styles.card}>
          <SectionHeader title="Fotos" hint={`${photos.length}/${MAX_PHOTOS}`} styles={styles} />
          {cover ? (
            <View style={styles.coverBox}>
              <Image
                source={{ uri: cover.uri }}
                style={styles.coverImage}
                resizeMode="contain"
                accessibilityLabel="Foto de portada"
              />
              <Text style={styles.coverBadge}>Portada</Text>
              <View style={styles.coverActions}>
                {canCutout ? (
                  <Pressable
                    onPress={() => void removeBackground(0)}
                    disabled={!!aiBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Quitar el fondo de la portada"
                    style={styles.chipAction}
                  >
                    <Text style={styles.chipActionText}>
                      {aiBusy === "cutout-0" ? "Quitando fondo…" : "Quitar fondo"}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setPhotos((current) => current.slice(1))}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar la portada"
                  style={styles.chipAction}
                >
                  <Icon name="trash" size={14} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => void addPhotos("library")}
              disabled={preparing}
              accessibilityRole="button"
              accessibilityLabel="Añadir la foto de portada"
              style={({ pressed }) => [styles.dropzone, pressed && styles.pressed]}
            >
              <View style={styles.dropIcon}>
                <Icon name="package" size={28} color={theme.action} />
              </View>
              <Text style={styles.dropTitle}>
                {preparing ? "Preparando foto…" : "Añade la foto de portada"}
              </Text>
              <Text style={styles.dropHint}>
                Producto centrado, buena luz y fondo liso. Se reduce y comprime antes de subir.
              </Text>
            </Pressable>
          )}
          {cover ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.strip}>
                {photos.slice(1).map((photo, offset) => {
                  const index = offset + 1;
                  return (
                    <View key={`${photo.url}-${index}`} style={styles.thumb}>
                      <Pressable
                        onPress={() => movePhoto(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Usar la foto ${index + 1} como portada`}
                        style={StyleSheet.absoluteFill}
                      >
                        <Image
                          source={{ uri: photo.uri }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setPhotos((current) => current.filter((_, i) => i !== index))
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar la foto ${index + 1}`}
                        hitSlop={6}
                        style={styles.thumbRemove}
                      >
                        <Icon name="close" size={12} color="#ffffff" />
                      </Pressable>
                    </View>
                  );
                })}
                {photos.length < MAX_PHOTOS ? (
                  <Pressable
                    onPress={() => void addPhotos("library")}
                    disabled={preparing}
                    accessibilityRole="button"
                    accessibilityLabel="Añadir más fotos"
                    style={({ pressed }) => [
                      styles.thumb,
                      styles.addThumb,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="plus" size={22} color={theme.action} />
                    <Text style={styles.addThumbText}>{preparing ? "…" : "Añadir"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          ) : null}
          {cover ? (
            <Text style={styles.hint}>Toca una miniatura para usarla como portada.</Text>
          ) : null}
          {Platform.OS !== "web" ? (
            <Button
              icon="scan"
              variant="secondary"
              title="Hacer foto con la cámara"
              disabled={preparing || photos.length >= MAX_PHOTOS}
              onPress={() => void addPhotos("camera")}
            />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <SectionHeader title="Datos del producto" styles={styles} />
          <Field label="Nombre" counter={`${title.length}/120`} styles={styles}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="Ej.: Camiseta deportiva de tirantes"
              placeholderTextColor={theme.placeholderText}
              accessibilityLabel="Nombre del producto"
              style={styles.input}
            />
          </Field>
          {categoryOptions.length ? (
            <CategoryPicker
              label="Categoría"
              categories={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
            />
          ) : (
            <Field label="Tipo" optional styles={styles}>
              <TextInput
                value={category}
                onChangeText={setCategory}
                maxLength={60}
                placeholder="Ej.: Ropa deportiva"
                placeholderTextColor={theme.placeholderText}
                accessibilityLabel="Tipo de producto"
                style={styles.input}
              />
            </Field>
          )}
          {brandValues.length ? (
            <Field label="Marca" optional styles={styles}>
              <TextInput
                value={brandQuery}
                onChangeText={setBrandQuery}
                placeholder="Buscar marca"
                placeholderTextColor={theme.placeholderText}
                accessibilityLabel="Buscar marca"
                style={styles.input}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                <PillGroup
                  accessibilityLabel="Marca"
                  value={brandValueId ?? "__none__"}
                  onChange={(value) => {
                    setBrandValueId(value === "__none__" ? null : value);
                    if (value === "__none__") setBrand("");
                  }}
                  options={[
                    { value: "__none__", label: "Sin marca" },
                    ...brandValues
                      .filter(
                        (v) =>
                          !brandQuery.trim() ||
                          v.name.toLowerCase().includes(brandQuery.trim().toLowerCase()),
                      )
                      .slice(0, 30)
                      .map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
              </ScrollView>
            </Field>
          ) : (
            <Field label="Marca" optional styles={styles}>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                maxLength={60}
                placeholder="Ej.: Nike"
                placeholderTextColor={theme.placeholderText}
                accessibilityLabel="Marca"
                style={styles.input}
              />
            </Field>
          )}
        </Card>

        <Card style={styles.card}>
          <SectionHeader title="Descripción" styles={styles} />
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={5000}
            textAlignVertical="top"
            placeholder="Material, medidas, uso, cuidados… Solo datos que puedas confirmar."
            placeholderTextColor={theme.placeholderText}
            accessibilityLabel="Descripción"
            style={[styles.input, styles.multiline]}
          />
          <View style={styles.helper}>
            <View style={styles.helperHead}>
              <Icon name="sliders" size={16} color={theme.action} />
              <Text style={styles.helperTitle}>Ayuda para escribir</Text>
            </View>
            <PillGroup
              accessibilityLabel="Estilo del texto"
              value={tone}
              onChange={setTone}
              options={TONE_OPTIONS}
            />
            {canDescribe ? (
              <>
                <Button
                  icon="send"
                  title={aiBusy === "describe" ? "La IA está escribiendo…" : "Sugerir con IA"}
                  loading={aiBusy === "describe"}
                  disabled={!title.trim() || !!aiBusy}
                  onPress={() => void suggestWithAi()}
                />
                <Text style={styles.hint}>
                  Mira la portada y los datos de la ficha. Lo que escribas en la descripción se usa
                  como datos confirmados. Quedan {aiLeft} usos este mes.
                </Text>
              </>
            ) : null}
            <Pressable
              onPress={() =>
                setDescription(buildProductCopyDraft({ name: title, brand, category, tone }))
              }
              disabled={!title.trim()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.textAction,
                !title.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.link}>
                {canDescribe
                  ? "O montar un texto básico con nombre, marca y tipo"
                  : "Montar un texto básico con nombre, marca y tipo"}
              </Text>
            </Pressable>
            {aiNotice ? (
              <Text accessibilityRole="alert" style={styles.aiNotice}>
                {aiNotice}
              </Text>
            ) : null}
          </View>
          {suggestion ? (
            <View style={styles.suggestion}>
              <Text style={styles.suggestionLabel}>Propuesta de la IA · revisa antes de usar</Text>
              <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
              <Text style={styles.suggestionText}>{suggestion.description}</Text>
              <View style={styles.row}>
                <Button
                  variant="secondary"
                  title="Usar nombre"
                  onPress={() => setTitle(suggestion.title)}
                  style={styles.flex}
                />
                <Button
                  title="Usar texto"
                  onPress={() => setDescription(suggestion.description)}
                  style={styles.flex}
                />
              </View>
              <Pressable
                onPress={() => setSuggestion(null)}
                accessibilityRole="button"
                style={styles.textAction}
              >
                <Text style={styles.mutedLink}>Descartar propuesta</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <SectionHeader title="Variante" styles={styles} />
          {sizeAttributes.length ? (
            <>
              <Text style={styles.hint}>
                Si el producto tiene tallas, elige el tipo y marca las que vendes: cada talla será
                una variante con su precio y existencias.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                <PillGroup
                  accessibilityLabel="Tipo de talla"
                  value={sizeAttributeId ?? "__none__"}
                  onChange={(value) => {
                    setSizeAttributeId(value === "__none__" ? null : value);
                    setSizeValueIds([]);
                  }}
                  options={[
                    { value: "__none__", label: "Sin tallas" },
                    ...sizeAttributes.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </ScrollView>
              {sizeAttribute ? (
                <View style={styles.sizeGrid}>
                  {activeValues(sizeAttribute).map((value) => {
                    const on = sizeValueIds.includes(value.id);
                    return (
                      <Pressable
                        key={value.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`Talla ${value.name}`}
                        onPress={() =>
                          setSizeValueIds(
                            on
                              ? sizeValueIds.filter((id) => id !== value.id)
                              : [...sizeValueIds, value.id],
                          )
                        }
                        style={[
                          styles.sizeChip,
                          {
                            borderColor: on ? theme.action : theme.border,
                            backgroundColor: on ? theme.action : theme.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.sizeText, { color: on ? theme.onAction : theme.text }]}
                        >
                          {value.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.hint}>
              Si vendes tallas o colores, podrás añadir más variantes cuando la ficha esté aprobada.
            </Text>
          )}
          <View style={styles.row}>
            {sizeValueIds.length ? null : (
              <Field label="Nombre" optional styles={styles} flex>
                <TextInput
                  value={variantTitle}
                  onChangeText={setVariantTitle}
                  maxLength={120}
                  placeholder="Única"
                  placeholderTextColor={theme.placeholderText}
                  accessibilityLabel="Nombre de la variante"
                  style={styles.input}
                />
              </Field>
            )}
            <Field label="SKU" optional styles={styles} flex>
              <TextInput
                value={sku}
                onChangeText={setSku}
                maxLength={100}
                autoCapitalize="characters"
                placeholder="AGS-0001"
                placeholderTextColor={theme.placeholderText}
                accessibilityLabel="SKU"
                style={styles.input}
              />
            </Field>
          </View>
        </Card>
      </ScrollView>

      {/* Sticky footer: readiness at a glance and the single primary action. */}
      <View style={styles.footer}>
        <View style={styles.checklist} accessibilityLabel="Estado de la ficha">
          {checklist.map((item) => (
            <View key={item.label} style={styles.checkItem}>
              <Icon
                name={item.ok ? "check" : "minus"}
                size={14}
                color={item.ok ? theme.successText : theme.muted}
              />
              <Text style={[styles.checkText, item.ok && styles.checkTextOk]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Button
          title={saving ? "Enviando…" : "Enviar a revisión"}
          loading={saving}
          disabled={saving || preparing || !title.trim()}
          onPress={() => void submit()}
        />
        <Text style={styles.footerHint}>
          Precio y existencias se fijan cuando AgeStyles apruebe la ficha.
        </Text>
      </View>

      <BottomSheet
        visible={!!cutout}
        onClose={() => setCutout(null)}
        title="¿Usar la foto sin fondo?"
        footer={
          <View style={styles.row}>
            <Button
              variant="secondary"
              title="No, mantener"
              onPress={() => setCutout(null)}
              style={styles.flex}
            />
            <Button
              title="Usar sin fondo"
              onPress={() => {
                if (!cutout) return;
                setPhotos((current) =>
                  current.map((photo, i) =>
                    i === cutout.index ? { uri: cutout.url, url: cutout.url } : photo,
                  ),
                );
                setCutout(null);
              }}
              style={styles.flex}
            />
          </View>
        }
      >
        {cutout ? (
          <View style={styles.compare}>
            <View style={styles.flex}>
              <Text style={styles.label}>Original</Text>
              <Image
                source={{ uri: cutout.original }}
                style={styles.compareImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Sin fondo</Text>
              <Image
                source={{ uri: cutout.url }}
                style={[styles.compareImage, styles.compareCutout]}
                resizeMode="contain"
              />
            </View>
          </View>
        ) : null}
        <Text style={styles.hint}>
          Revisa bordes y textos: la herramienta puede dejar restos o recortar detalles finos.
        </Text>
      </BottomSheet>
    </View>
  );
}

function SectionHeader({
  title,
  hint,
  styles,
}: {
  title: string;
  hint?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function Field({
  label,
  optional,
  counter,
  children,
  styles,
  flex,
}: {
  label: string;
  optional?: boolean;
  counter?: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && styles.flex]}>
      <View style={styles.fieldHead}>
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> · opcional</Text> : null}
        </Text>
        {counter ? <Text style={styles.counter}>{counter}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    chipsRow: { marginTop: 8, flexGrow: 0 },
    sizeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 6 },
    sizeChip: {
      minWidth: 48,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    sizeText: { fontSize: 15, fontWeight: "600" },
    screen: { flex: 1, backgroundColor: theme.background },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 14,
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
    },
    back: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    mutedLink: { color: theme.muted, fontSize: 13 },
    errorBox: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.errorSoft,
    },
    errorText: { flex: 1, color: theme.error, fontSize: 14, lineHeight: 20 },
    card: { gap: 12, padding: 16 },
    sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "700" },
    sectionHint: { color: theme.muted, fontSize: 13 },
    hint: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    row: { flexDirection: "row", gap: 10 },
    flex: { flex: 1 },
    field: { gap: 6 },
    fieldHead: { flexDirection: "row", justifyContent: "space-between" },
    label: { color: theme.text, fontSize: 13, fontWeight: "600" },
    optional: { color: theme.muted, fontWeight: "400" },
    counter: { color: theme.muted, fontSize: 12 },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.background,
      color: theme.text,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 15,
    },
    multiline: { minHeight: 140, lineHeight: 21 },
    dropzone: {
      aspectRatio: 4 / 3,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: theme.border,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      gap: 8,
    },
    dropIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 4,
    },
    dropTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
    dropHint: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
      maxWidth: 280,
    },
    coverBox: {
      aspectRatio: 1,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: theme.border,
    },
    coverImage: { width: "100%", height: "100%" },
    coverBadge: {
      position: "absolute",
      left: 10,
      top: 10,
      backgroundColor: theme.action,
      color: theme.onAction,
      fontSize: 12,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      overflow: "hidden",
    },
    coverActions: { position: "absolute", right: 10, bottom: 10, flexDirection: "row", gap: 8 },
    chipAction: {
      minHeight: 34,
      minWidth: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    chipActionText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
    strip: { flexDirection: "row", gap: 10 },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    thumbRemove: {
      position: "absolute",
      right: 4,
      top: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    addThumb: { alignItems: "center", justifyContent: "center", borderStyle: "dashed", gap: 2 },
    addThumbText: { color: theme.action, fontSize: 11, fontWeight: "600" },
    helper: {
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.background,
    },
    helperHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    helperTitle: { color: theme.text, fontSize: 14, fontWeight: "700" },
    textAction: { minHeight: 36, justifyContent: "center", alignSelf: "flex-start" },
    aiNotice: { color: theme.text, fontSize: 13, lineHeight: 18 },
    suggestion: {
      gap: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.action,
    },
    suggestionLabel: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    suggestionTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
    suggestionText: { color: theme.text, fontSize: 14, lineHeight: 21 },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      gap: 8,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    checklist: { flexDirection: "row", gap: 14, justifyContent: "center" },
    checkItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    checkText: { color: theme.muted, fontSize: 12 },
    checkTextOk: { color: theme.successText, fontWeight: "600" },
    footerHint: { color: theme.muted, fontSize: 12, textAlign: "center" },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.45 },
    compare: { flexDirection: "row", gap: 10 },
    compareImage: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 6,
    },
    compareCutout: { backgroundColor: "#ffffff" },
    doneCard: { gap: 14, alignItems: "stretch" },
    doneIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    doneText: { color: theme.text, fontSize: 15, lineHeight: 22 },
  });
