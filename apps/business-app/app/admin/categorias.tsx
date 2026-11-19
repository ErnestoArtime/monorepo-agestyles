import { Button, PillGroup, StatusBadge } from "@agestyles/ui-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CategoryPicker, categoryPath, type CategoryNode } from "../../components/category-picker";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, shortDate } from "../../lib/admin";

type CategoryRequest = {
  id: string;
  seller_name: string | null;
  name: string;
  description: string | null;
  suggested_parent_id: string | null;
  note: string | null;
  status: "pending" | "approved" | "merged" | "rejected";
  resolved_category_id: string | null;
  resolution_note: string | null;
  created_at: string;
};
type Action = "approve" | "merge" | "reject";

const STATUS_LABEL: Record<CategoryRequest["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  merged: "Usa una existente",
  rejected: "No aceptada",
};

/**
 * Administración → «Categorías» (AG-35): requests from the stores. The administration
 * creates the category as a main one or inside another, points the store to an existing
 * category, or rejects it with a reason.
 */
export default function AdminCategoriesScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [action, setAction] = useState<Action>("approve");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest<{
        category_requests: CategoryRequest[];
        categories: CategoryNode[];
      }>(`/admin/agestyles/category-requests?status=${status}`);
      setRequests(data.category_requests ?? []);
      setCategories(data.categories ?? []);
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar las solicitudes."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function start(request: CategoryRequest) {
    setOpen(request.id);
    setAction("approve");
    setName(request.name);
    setParentId(request.suggested_parent_id);
    setExistingId(null);
    setNote("");
    setNotice("");
  }

  async function decide(request: CategoryRequest) {
    if (action === "merge" && !existingId) return setError("Elige la categoría existente.");
    if (action === "reject" && !note.trim()) return setError("Escribe por qué no se acepta.");
    setBusy(true);
    setError("");
    try {
      const body =
        action === "approve"
          ? { action, name: name.trim(), parent_id: parentId, note: note.trim() || null }
          : action === "merge"
            ? { action, category_id: existingId, note: note.trim() || null }
            : { action, note: note.trim() };
      await adminRequest(`/admin/agestyles/category-requests/${request.id}`, "POST", body);
      setNotice(
        action === "approve"
          ? `Categoría «${name.trim()}» creada${parentId ? ` dentro de ${categoryPath(categories, parentId)}` : " como principal"}.`
          : action === "merge"
            ? `La tienda usará ${categoryPath(categories, existingId)}.`
            : `Solicitud «${request.name}» rechazada.`,
      );
      setOpen(null);
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        /categor|existe|nombre|resolvi/i.test(message) && message.length < 200
          ? message
          : adminError(cause, "No se pudo guardar la decisión."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <OperationList
      title="Categorías"
      subtitle="Solicitudes de categorías de las tiendas. Decide dónde van en el catálogo."
      loading={loading}
      error={error}
      empty={status === "pending" ? "No hay solicitudes pendientes." : "No hay solicitudes."}
      isEmpty={!requests.length}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.toolbar}>
        <PillGroup
          accessibilityLabel="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "pending", label: "Pendientes" },
            { value: "all", label: "Todas" },
          ]}
        />
      </View>
      {requests.length ? (
        <Section title={`Solicitudes (${requests.length})`}>
          {requests.map((request) => (
            <View key={request.id} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{request.name}</Text>
                <StatusBadge
                  label={STATUS_LABEL[request.status]}
                  tone={
                    request.status === "pending"
                      ? "warning"
                      : request.status === "rejected"
                        ? "error"
                        : "success"
                  }
                />
              </View>
              <Text style={styles.muted}>
                {request.seller_name ?? "Tienda"} · {shortDate(request.created_at)}
                {request.suggested_parent_id
                  ? ` · Propone dentro de ${categoryPath(categories, request.suggested_parent_id)}`
                  : " · Propone como principal"}
              </Text>
              {request.description ? (
                <Text style={styles.muted}>Descripción: {request.description}</Text>
              ) : null}
              {request.note ? <Text style={styles.muted}>Motivo: {request.note}</Text> : null}
              {request.status !== "pending" && request.resolved_category_id ? (
                <Text style={styles.ok}>
                  {request.status === "approved" ? "Creada: " : "Usar: "}
                  {categoryPath(categories, request.resolved_category_id)}
                </Text>
              ) : null}
              {request.resolution_note ? (
                <Text style={styles.muted}>Nota: {request.resolution_note}</Text>
              ) : null}

              {request.status === "pending" && open !== request.id ? (
                <View style={styles.actions}>
                  <Button title="Decidir" onPress={() => start(request)} />
                </View>
              ) : null}
              {open === request.id ? (
                <View style={styles.decision}>
                  <PillGroup
                    accessibilityLabel="Decisión"
                    value={action}
                    onChange={setAction}
                    options={[
                      { value: "approve", label: "Crear categoría" },
                      { value: "merge", label: "Usar una existente" },
                      { value: "reject", label: "Rechazar" },
                    ]}
                  />
                  {action === "approve" ? (
                    <>
                      <Text style={styles.label}>Nombre definitivo</Text>
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        maxLength={60}
                        accessibilityLabel="Nombre definitivo"
                        style={styles.input}
                      />
                      <CategoryPicker
                        label="Dónde va"
                        categories={categories}
                        value={parentId}
                        onChange={setParentId}
                        rootLabel="Categoría principal (general)"
                      />
                    </>
                  ) : null}
                  {action === "merge" ? (
                    <CategoryPicker
                      label="Categoría que debe usar la tienda"
                      categories={categories}
                      value={existingId}
                      onChange={setExistingId}
                    />
                  ) : null}
                  <Text style={styles.label}>
                    {action === "reject"
                      ? "Motivo (lo verá la tienda)"
                      : "Nota para la tienda (opcional)"}
                  </Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    maxLength={500}
                    accessibilityLabel="Nota para la tienda"
                    style={styles.input}
                  />
                  <View style={styles.actions}>
                    <Button
                      title={
                        action === "approve"
                          ? "Crear categoría"
                          : action === "merge"
                            ? "Indicar categoría"
                            : "Rechazar"
                      }
                      variant={action === "reject" ? "danger" : "primary"}
                      loading={busy}
                      onPress={() => void decide(request)}
                    />
                    <Pressable accessibilityRole="button" onPress={() => setOpen(null)}>
                      <Text style={styles.link}>Cancelar</Text>
                    </Pressable>
                  </View>
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
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    toolbar: { marginBottom: 12 },
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
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    ok: { color: theme.successText, fontSize: 13, lineHeight: 18 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    decision: { gap: 10, marginTop: 10 },
    actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
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
