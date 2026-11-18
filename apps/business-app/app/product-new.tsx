import { Icon } from "@agestyles/icons";
import {
  buildProductCopyDraft,
  buildProductTitleDraft,
  type ProductCopyTone,
} from "@agestyles/domain/product-copy";
import { BottomSheet, Button, Card, PillGroup } from "@agestyles/ui-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { hasPermission, OperationList } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

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

type MaxEdge = "800" | "1200" | "1600" | "2048";
const MAX_EDGE_OPTIONS: { value: MaxEdge; label: string }[] = [
  { value: "800", label: "800 px" },
  { value: "1200", label: "1200 px" },
  { value: "1600", label: "1600 px" },
  { value: "2048", label: "2048 px" },
];
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
  const [maxEdge, setMaxEdge] = useState<MaxEdge>("1600");
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState("");
  const [suggestion, setSuggestion] = useState<{ title: string; description: string } | null>(null);
  const [cutout, setCutout] = useState<{ index: number; original: string; url: string } | null>(
    null,
  );

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
          .map((asset) => preparePhoto(asset, Number(maxEdge))),
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
      await request("/vendor/products", "POST", {
        title: name,
        ...(description.trim() ? { description: description.trim() } : {}),
        status: "proposed",
        ...(urls.length ? { images: urls.map((url) => ({ url })), thumbnail: urls[0] } : {}),
        variants: [
          {
            title: variantTitle.trim() || "Única",
            ...(sku.trim() ? { sku: sku.trim() } : {}),
          },
        ],
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

  return (
    <OperationList
      title="Nuevo producto"
      subtitle="Completa la ficha y añade fotos. Se envía a revisión antes de publicarse."
      loading={false}
      error={canEdit ? error : "Tu rol no permite crear productos."}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={styles.back}
      >
        <Icon name="arrowLeft" size={18} color={theme.action} />
        <Text style={styles.link}>Productos</Text>
      </Pressable>

      {canEdit ? (
        <View style={styles.form}>
          <Text style={styles.section}>Fotos</Text>
          <Text style={styles.help}>
            La primera es la portada. Se reducen y comprimen en tu dispositivo antes de subirlas.
          </Text>
          <PillGroup
            accessibilityLabel="Tamaño máximo de las fotos"
            value={maxEdge}
            onChange={setMaxEdge}
            options={MAX_EDGE_OPTIONS}
          />
          {photos.length ? (
            <View style={styles.photos}>
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.photo}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityLabel={index === 0 ? "Foto de portada" : `Foto ${index + 1}`}
                  />
                  {index === 0 ? (
                    <Text style={styles.cover}>Portada</Text>
                  ) : (
                    <Pressable
                      onPress={() => movePhoto(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar la foto ${index + 1} como portada`}
                      style={styles.coverAction}
                    >
                      <Text style={styles.coverActionText}>Portada</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar la foto ${index + 1}`}
                    hitSlop={6}
                    style={styles.remove}
                  >
                    <Icon name="close" size={16} color="#ffffff" />
                  </Pressable>
                  {canCutout ? (
                    <Pressable
                      onPress={() => void removeBackground(index)}
                      disabled={!!aiBusy}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar el fondo de la foto ${index + 1}`}
                      style={styles.cutoutAction}
                    >
                      <Text style={styles.coverActionText}>
                        {aiBusy === `cutout-${index}` ? "…" : "Sin fondo"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {photos.length < MAX_PHOTOS ? (
            <View style={styles.row}>
              <Button
                icon="plus"
                variant="secondary"
                title={preparing ? "Preparando…" : "Elegir fotos"}
                disabled={preparing}
                onPress={() => void addPhotos("library")}
                style={styles.flex}
              />
              {Platform.OS !== "web" ? (
                <Button
                  icon="scan"
                  variant="secondary"
                  title="Cámara"
                  disabled={preparing}
                  onPress={() => void addPhotos("camera")}
                  style={styles.flex}
                />
              ) : null}
            </View>
          ) : (
            <Text style={styles.help}>Máximo {MAX_PHOTOS} fotos.</Text>
          )}

          <Text style={styles.section}>Ficha</Text>
          <Field label="Nombre del producto" styles={styles}>
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
          <View style={styles.row}>
            <Field label="Marca (opcional)" styles={styles} flex>
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
            <Field label="Tipo (opcional)" styles={styles} flex>
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
          </View>
          {title.trim() && brand.trim() ? (
            <Button
              variant="secondary"
              title={`Usar título: ${buildProductTitleDraft({ name: title, brand })}`}
              onPress={() => setTitle(buildProductTitleDraft({ name: title, brand }))}
            />
          ) : null}
          <Field label="Descripción" styles={styles}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={5000}
              textAlignVertical="top"
              placeholder="Describe el producto con datos reales: material, medidas, uso…"
              placeholderTextColor={theme.placeholderText}
              accessibilityLabel="Descripción"
              style={[styles.input, styles.multiline]}
            />
          </Field>
          <View style={styles.assistant}>
            <Text style={styles.assistantTitle}>Borrador desde la ficha</Text>
            <Text style={styles.help}>
              Ordena los datos que escribiste. No inventa características: revisa antes de guardar.
            </Text>
            <PillGroup
              accessibilityLabel="Estilo del borrador"
              value={tone}
              onChange={setTone}
              options={TONE_OPTIONS}
            />
            <Button
              variant="secondary"
              title={description.trim() ? "Reemplazar por el borrador" : "Preparar borrador"}
              disabled={!title.trim()}
              onPress={() =>
                setDescription(
                  buildProductCopyDraft({
                    name: title,
                    brand,
                    category,
                    tone,
                  }),
                )
              }
            />
            {canDescribe ? (
              <Button
                icon="send"
                title={aiBusy === "describe" ? "La IA está escribiendo…" : "Sugerir con IA"}
                loading={aiBusy === "describe"}
                disabled={!title.trim() || !!aiBusy}
                onPress={() => void suggestWithAi()}
              />
            ) : null}
            {ai?.allowed && (ai.describe || ai.remove_background) ? (
              <Text style={styles.help}>
                La IA usa la portada y los datos de la ficha. Quedan {aiLeft} usos este mes.
              </Text>
            ) : null}
            {aiNotice ? (
              <Text accessibilityRole="alert" style={styles.aiNotice}>
                {aiNotice}
              </Text>
            ) : null}
            {suggestion ? (
              <Card style={styles.suggestion}>
                <Text style={styles.label}>Propuesta de la IA · revisa antes de usar</Text>
                <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.suggestionText}>{suggestion.description}</Text>
                <View style={styles.row}>
                  <Button
                    variant="secondary"
                    title="Usar título"
                    onPress={() => setTitle(suggestion.title)}
                    style={styles.flex}
                  />
                  <Button
                    variant="secondary"
                    title="Usar descripción"
                    onPress={() => setDescription(suggestion.description)}
                    style={styles.flex}
                  />
                </View>
              </Card>
            ) : null}
          </View>

          <Text style={styles.section}>Variante</Text>
          <View style={styles.row}>
            <Field label="Nombre (opcional)" styles={styles} flex>
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
            <Field label="SKU (opcional)" styles={styles} flex>
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

          <Button
            title={saving ? "Enviando…" : "Enviar a revisión"}
            loading={saving}
            disabled={saving || preparing || !title.trim()}
            onPress={() => void submit()}
          />
          <Text style={styles.help}>
            Precio y existencias se fijan cuando AgeStyles apruebe la ficha.
          </Text>
        </View>
      ) : null}
      <BottomSheet
        visible={!!cutout}
        onClose={() => setCutout(null)}
        title="Comparar fondo"
        footer={
          <View style={styles.row}>
            <Button
              variant="secondary"
              title="Mantener original"
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
        <Text style={styles.help}>
          Revisa bordes y textos: la herramienta puede dejar restos o recortar detalles finos.
        </Text>
      </BottomSheet>
    </OperationList>
  );
}

function Field({
  label,
  children,
  styles,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && styles.flex]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
    link: { color: theme.action, fontSize: 14, fontWeight: "500" },
    form: { gap: 12, marginTop: 4 },
    section: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: 12 },
    help: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    row: { flexDirection: "row", gap: 10 },
    flex: { flex: 1 },
    field: { gap: 6 },
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
    multiline: { minHeight: 120 },
    photos: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    photo: {
      width: 104,
      height: 104,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cover: {
      position: "absolute",
      left: 6,
      bottom: 6,
      backgroundColor: theme.action,
      color: theme.onAction,
      fontSize: 11,
      fontWeight: "700",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    coverAction: {
      position: "absolute",
      left: 6,
      bottom: 6,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    coverActionText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
    remove: {
      position: "absolute",
      right: 6,
      top: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    assistant: {
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    assistantTitle: { color: theme.text, fontSize: 15, fontWeight: "700" },
    aiNotice: { color: theme.text, fontSize: 13, lineHeight: 18 },
    suggestion: { gap: 8 },
    suggestionTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
    suggestionText: { color: theme.text, fontSize: 14, lineHeight: 20 },
    cutoutAction: {
      position: "absolute",
      left: 6,
      top: 6,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
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
