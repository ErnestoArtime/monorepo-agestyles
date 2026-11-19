import { Button, StatusBadge } from "@agestyles/ui-native";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { CategoryPicker, categoryPath, type CategoryNode } from "../components/category-picker";
import { OperationList, Section } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { shortDate } from "../lib/admin";

type CategoryRequest = {
  id: string;
  name: string;
  description: string | null;
  suggested_parent_id: string | null;
  note: string | null;
  status: "pending" | "approved" | "merged" | "rejected";
  resolved_category_id: string | null;
  resolution_note: string | null;
  created_at: string;
};

const STATUS: Record<
  CategoryRequest["status"],
  { label: string; tone: "neutral" | "success" | "error" | "warning" }
> = {
  pending: { label: "Pendiente", tone: "warning" },
  approved: { label: "Aprobada", tone: "success" },
  merged: { label: "Usa una existente", tone: "neutral" },
  rejected: { label: "No aceptada", tone: "error" },
};

/**
 * «Solicitar categoría» (AG-35): the store asks for a marketplace category; the
 * administration decides where it goes (main or subcategory), points to an existing one,
 * or rejects it. The store sees the decision here.
 */
export default function CategoryRequestsScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { request, seller } = useBusiness();
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<{
        category_requests: CategoryRequest[];
        categories: CategoryNode[];
        can_edit: boolean;
      }>("/vendor/agestyles/category-requests");
      setRequests(data.category_requests ?? []);
      setCategories(data.categories ?? []);
      setCanEdit(data.can_edit);
    } catch {
      setError("No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
    // The selected store changes what the server returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, seller?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (name.trim().length < 2) return setError("Escribe el nombre de la categoría.");
    setSending(true);
    setError("");
    setNotice("");
    try {
      await request("/vendor/agestyles/category-requests", "POST", {
        name: name.trim(),
        description: description.trim() || null,
        suggested_parent_id: parentId,
        note: note.trim() || null,
      });
      setName("");
      setDescription("");
      setParentId(null);
      setNote("");
      setNotice("Solicitud enviada. La administración decidirá dónde va en el catálogo.");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        /solicitud|categor|máximo/i.test(message) && message.length < 200
          ? message
          : "No se pudo enviar la solicitud.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <OperationList
      backLabel="Más"
      title="Solicitar categoría"
      subtitle="Propón una categoría para todo el catálogo. La administración decide si va como categoría principal o dentro de otra."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {canEdit ? (
        <Section title="Nueva solicitud">
          <View style={styles.form}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder="Por ejemplo: Artesanía"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Nombre de la categoría"
              style={styles.input}
            />
            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={300}
              placeholder="Qué productos entran en ella"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Descripción de la categoría"
              style={styles.input}
            />
            <CategoryPicker
              label="¿Dónde crees que encaja? (opcional)"
              categories={categories}
              value={parentId}
              onChange={setParentId}
              rootLabel="Como categoría principal"
            />
            <Text style={styles.label}>¿Para qué la necesitas? (opcional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              placeholder="Por ejemplo: vendemos cerámica y tallas de madera y no encajan en ninguna categoría."
              placeholderTextColor={theme.muted}
              accessibilityLabel="Motivo de la solicitud"
              style={[styles.input, styles.multiline]}
            />
            <Button title="Enviar solicitud" loading={sending} onPress={() => void send()} />
          </View>
        </Section>
      ) : (
        <Text style={styles.muted}>
          Solo el titular o la administración de la tienda pueden solicitar categorías.
        </Text>
      )}
      <Section title={`Mis solicitudes (${requests.length})`}>
        {requests.length ? null : (
          <Text style={[styles.muted, styles.pad]}>Todavía no has solicitado categorías.</Text>
        )}
        {requests.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <StatusBadge label={STATUS[item.status].label} tone={STATUS[item.status].tone} />
            </View>
            <Text style={styles.muted}>
              {shortDate(item.created_at)}
              {item.suggested_parent_id
                ? ` · Propuesta dentro de ${categoryPath(categories, item.suggested_parent_id)}`
                : ""}
            </Text>
            {item.status === "approved" && item.resolved_category_id ? (
              <Text style={styles.ok}>
                Creada como {categoryPath(categories, item.resolved_category_id) || item.name}. Ya
                puedes usarla en tus productos.
              </Text>
            ) : null}
            {item.status === "merged" && item.resolved_category_id ? (
              <Text style={styles.ok}>
                Usa la categoría {categoryPath(categories, item.resolved_category_id)}.
              </Text>
            ) : null}
            {item.resolution_note ? (
              <Text style={styles.muted}>Administración: {item.resolution_note}</Text>
            ) : null}
          </View>
        ))}
      </Section>
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    form: { padding: 14, gap: 10 },
    pad: { padding: 14 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    ok: { color: theme.successText, fontSize: 13, lineHeight: 18 },
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
    multiline: { minHeight: 84, textAlignVertical: "top" },
    row: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  });
