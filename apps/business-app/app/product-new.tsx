import { Icon } from "@agestyles/icons";
import {
  buildProductCopyDraft,
  buildProductTitleDraft,
  type ProductCopyTone,
} from "@agestyles/domain/product-copy";
import { Button, Card, PillGroup } from "@agestyles/ui-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { hasPermission, OperationList } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

/** Prepared photo: resized and compressed on the device before it is uploaded. */
type Photo = { uri: string; width: number; height: number };

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
  const { request, upload, member } = useBusiness();
  const canEdit = hasPermission(member, "products", "edit");

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [variantTitle, setVariantTitle] = useState("");
  const [sku, setSku] = useState("");
  const [tone, setTone] = useState<ProductCopyTone>("commercial");
  const [maxEdge, setMaxEdge] = useState<MaxEdge>("1600");
  const [photos, setPhotos] = useState<Photo[]>([]);
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
      setPhotos((current) => [...current, ...prepared].slice(0, MAX_PHOTOS));
    } catch {
      setError("No se pudo preparar la foto. Prueba con otra imagen.");
    } finally {
      setPreparing(false);
    }
  }

  function movePhoto(index: number) {
    // The first photo is the cover (thumbnail); tapping «Portada» moves a photo to the front.
    setPhotos((current) => [current[index]!, ...current.filter((_, i) => i !== index)]);
  }

  async function uploadPhotos(): Promise<string[]> {
    if (!photos.length) return [];
    const form = new FormData();
    for (const [index, photo] of photos.entries()) {
      const name = `producto-${Date.now()}-${index + 1}.jpg`;
      if (Platform.OS === "web") {
        const blob = await (await fetch(photo.uri)).blob();
        form.append("files", blob, name);
      } else {
        form.append("files", { uri: photo.uri, name, type: "image/jpeg" } as unknown as Blob);
      }
    }
    const result = await upload(form);
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
      const urls = await uploadPhotos();
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
      setError(
        photos.length
          ? "No se pudo crear el producto. Revisa la conexión; si persiste, prueba con menos fotos."
          : "No se pudo crear el producto. Revisa la conexión e inténtalo de nuevo.",
      );
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
