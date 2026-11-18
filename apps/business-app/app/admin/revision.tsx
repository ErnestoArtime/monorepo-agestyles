import { Button } from "@agestyles/ui-native";
import { Icon } from "@agestyles/icons";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, CHANGE_TYPE, shortDate } from "../../lib/admin";

type ProductChange = {
  id: string;
  product_id: string;
  status: string;
  type: string;
  action_count?: number;
  product_title?: string | null;
  product_thumbnail?: string | null;
  seller_name?: string | null;
  seller_handle?: string | null;
  external_note?: string | null;
  created_at?: string;
};

/** Product requests from every store (new products, changes, removals) waiting for approval. */
export default function AdminReviewScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  // Mercur's inbox lists the requests still waiting for a decision.
  const status = "pending";
  const [changes, setChanges] = useState<ProductChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest<{ product_changes: ProductChange[] }>(
        "/admin/product-changes?limit=100&order=-created_at",
      );
      setChanges(data.product_changes ?? []);
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar los productos en revisión."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(change: ProductChange, decision: "confirm" | "cancel") {
    if (decision === "cancel" && !note.trim()) {
      setError("Escribe por qué no se aprueba.");
      return;
    }
    setBusy(change.id);
    setError("");
    try {
      await adminRequest(
        `/admin/product-changes/${change.id}/${decision}`,
        "POST",
        decision === "cancel" ? { internal_note: note.trim() } : {},
      );
      setNotice(
        decision === "confirm"
          ? `«${change.product_title ?? "Producto"}» aprobado.`
          : `«${change.product_title ?? "Producto"}» rechazado. El motivo queda guardado en la solicitud.`,
      );
      setDeclining(null);
      setNote("");
      await load();
    } catch (cause) {
      setError(adminError(cause, "No se pudo guardar la decisión."));
    } finally {
      setBusy("");
    }
  }

  return (
    <OperationList
      title="Productos en revisión"
      subtitle="Altas, cambios y retiradas de productos que las tiendas envían para aprobar."
      loading={loading}
      error={error}
      empty="No hay productos esperando revisión."
      isEmpty={!changes.length}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {changes.length ? (
        <Section title={`Solicitudes (${changes.length})`}>
          {changes.map((change) => (
            <View key={change.id} style={styles.row}>
              <View style={styles.thumb}>
                {change.product_thumbnail ? (
                  <Image
                    source={{ uri: change.product_thumbnail }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Icon name="package" size={22} color={theme.muted} />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{change.product_title ?? "Producto"}</Text>
                <Text style={styles.muted}>
                  {change.seller_name ?? "Tienda"} · {CHANGE_TYPE[change.type] ?? "Solicitud"}
                  {change.created_at ? ` · ${shortDate(change.created_at)}` : ""}
                </Text>
                {change.external_note ? (
                  <Text style={styles.muted}>Nota: {change.external_note}</Text>
                ) : null}
                {declining === change.id ? (
                  <View style={styles.decline}>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Motivo del rechazo (p. ej., faltan fotos de la etiqueta)"
                      placeholderTextColor={theme.muted}
                      accessibilityLabel="Motivo del rechazo"
                      style={styles.input}
                    />
                    <View style={styles.actions}>
                      <Button
                        title="Rechazar"
                        variant="secondary"
                        loading={busy === change.id}
                        onPress={() => void decide(change, "cancel")}
                      />
                      <Pressable onPress={() => setDeclining(null)} accessibilityRole="button">
                        <Text style={styles.link}>Cancelar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
              {status === "pending" && declining !== change.id ? (
                <View style={styles.side}>
                  <Button
                    title="Aprobar"
                    loading={busy === change.id}
                    onPress={() => void decide(change, "confirm")}
                  />
                  <Pressable
                    onPress={() => {
                      setDeclining(change.id);
                      setNote("");
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.danger}>Rechazar</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { marginBottom: 6 },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    row: {
      minHeight: 76,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    flex: { flex: 1, gap: 3 },
    side: { alignItems: "flex-end", gap: 8 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    danger: { color: theme.error, fontSize: 14, fontWeight: "600" },
    decline: { gap: 8, marginTop: 8 },
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
