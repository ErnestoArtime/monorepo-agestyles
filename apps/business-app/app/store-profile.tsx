import { mediaVariant } from "@agestyles/api-client/media";
import { Button } from "@agestyles/ui-native";
import { Icon } from "@agestyles/icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { hasPermission } from "../lib/permissions";

type Profile = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
};

/** Longest side after resizing: logos are small squares, covers are wide. */
const EDGE = { logo: 600, banner: 2000 } as const;

/**
 * «Perfil de la tienda»: logo, cover photo and description that buyers see in Tienda
 * (directory of stores and the store's own page). Uses Mercur's `/vendor/sellers/me`,
 * which requires the «store: edit» permission on the server.
 */
export default function StoreProfileScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { request, upload, member, seller } = useBusiness();
  const canEdit = hasPermission(member, "store", "edit");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "logo" | "banner" | "save">("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<{ seller: Profile }>(
        "/vendor/sellers/me?fields=id,name,description,logo,banner",
      );
      setProfile(data.seller);
      setDescription(data.seller.description ?? "");
      setLogo(data.seller.logo);
      setBanner(data.seller.banner);
    } catch {
      setError("No se pudo cargar el perfil de la tienda.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load, seller?.id]);

  async function pick(kind: "logo" | "banner") {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: Platform.OS !== "web",
      aspect: kind === "logo" ? [1, 1] : [16, 6],
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      const edge = EDGE[kind];
      const longest = Math.max(asset.width, asset.height);
      const resize =
        longest > edge ? (asset.width >= asset.height ? { width: edge } : { height: edge }) : null;
      const photo = await manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
        compress: 0.85,
        format: SaveFormat.JPEG,
      });
      const form = new FormData();
      const name = `${kind === "logo" ? "logo" : "portada"}-${Date.now()}.jpg`;
      if (Platform.OS === "web") form.append("files", await (await fetch(photo.uri)).blob(), name);
      else form.append("files", { uri: photo.uri, name, type: "image/jpeg" } as unknown as Blob);
      const { files } = await upload(form);
      if (!files[0]?.url) throw new Error("upload");
      if (kind === "logo") setLogo(files[0].url);
      else setBanner(files[0].url);
    } catch {
      setError("No se pudo subir la imagen. Revisa la conexión y prueba otra vez.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const data = await request<{ seller: Profile }>(
        "/vendor/sellers/me?fields=id,name,description,logo,banner",
        "POST",
        { description: description.trim() || null, logo, banner },
      );
      setProfile(data.seller);
      setNotice("Perfil guardado. Los compradores ya lo ven en la Tienda.");
    } catch {
      setError("No se pudo guardar el perfil. Prueba otra vez.");
    } finally {
      setBusy("");
    }
  }

  const dirty =
    Boolean(profile) &&
    ((profile!.description ?? "") !== description.trim() ||
      profile!.logo !== logo ||
      profile!.banner !== banner);

  return (
    <OperationList
      title="Perfil de la tienda"
      subtitle="Logo, portada y descripción que ven los compradores en la Tienda."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {!canEdit ? (
        <Text style={styles.muted}>
          Solo quien tenga permiso para editar la tienda puede cambiar el perfil.
        </Text>
      ) : null}
      <Section title="Vista previa">
        <View style={styles.cover}>
          {banner ? (
            <Image
              source={{ uri: mediaVariant(banner, 800) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.muted}>Sin portada</Text>
          )}
        </View>
        <View style={styles.identity}>
          <View style={styles.logo}>
            {logo ? (
              <Image
                source={{ uri: mediaVariant(logo, 400) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <Icon name="store" size={28} color={theme.muted} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.name}>{profile?.name ?? seller?.name ?? "Tienda"}</Text>
            {description.trim() ? (
              <Text style={styles.muted} numberOfLines={3}>
                {description.trim()}
              </Text>
            ) : null}
          </View>
        </View>
      </Section>
      {canEdit ? (
        <Section title="Imágenes y descripción">
          <View style={styles.form}>
            <Text style={styles.label}>Logo o foto de la tienda</Text>
            <Text style={styles.muted}>Cuadrada, al menos 400 × 400 px.</Text>
            <View style={styles.actions}>
              <Button
                title={logo ? "Cambiar logo" : "Subir logo"}
                variant="secondary"
                loading={busy === "logo"}
                onPress={() => void pick("logo")}
              />
              {logo ? (
                <Button title="Quitar" variant="secondary" onPress={() => setLogo(null)} />
              ) : null}
            </View>
            <Text style={styles.label}>Portada</Text>
            <Text style={styles.muted}>Horizontal, al menos 1600 px de ancho.</Text>
            <View style={styles.actions}>
              <Button
                title={banner ? "Cambiar portada" : "Subir portada"}
                variant="secondary"
                loading={busy === "banner"}
                onPress={() => void pick("banner")}
              />
              {banner ? (
                <Button title="Quitar" variant="secondary" onPress={() => setBanner(null)} />
              ) : null}
            </View>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={400}
              multiline
              placeholder="Qué vendes, dónde estás y cómo entregas."
              placeholderTextColor={theme.muted}
              accessibilityLabel="Descripción de la tienda"
              style={[styles.input, styles.multiline]}
            />
            <Button
              title="Guardar perfil"
              loading={busy === "save"}
              disabled={!dirty || Boolean(busy)}
              onPress={() => void save()}
            />
          </View>
        </Section>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    cover: {
      aspectRatio: 16 / 6,
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    identity: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 16,
      marginTop: -44,
      borderWidth: 3,
      borderColor: theme.surface,
      backgroundColor: theme.quietSurface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    flex: { flex: 1, gap: 4 },
    name: { color: theme.text, fontSize: 18, fontWeight: "700" },
    form: { padding: 14, gap: 10 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600", marginTop: 6 },
    actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 15,
    },
    multiline: { minHeight: 96, textAlignVertical: "top" },
  });
