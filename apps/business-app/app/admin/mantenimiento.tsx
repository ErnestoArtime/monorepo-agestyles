import { Button } from "@agestyles/ui-native";
import { useNotice } from "../../hooks/use-notice";
import { Icon } from "@agestyles/icons";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, shortDate } from "../../lib/admin";

type Maintenance = {
  enabled: boolean;
  title: string;
  message: string;
  back_at: string | null;
  updated_at: string | null;
};

/**
 * Administración → «Mantenimiento» (AG-44): while it is on, Tienda and the Catálogo show a
 * maintenance page and the buyer gateway refuses carts and checkout. Negocio keeps working,
 * and its Tienda shows a notice so the team can check the shop meanwhile.
 */
export default function MaintenanceScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const [state, setState] = useState<Maintenance | null>(null);
  const [draft, setDraft] = useState<Maintenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { maintenance } = await adminRequest<{ maintenance: Maintenance }>(
        "/admin/agestyles/maintenance",
      );
      setState(maintenance);
      setDraft(maintenance);
    } catch (cause) {
      setError(adminError(cause, "No se pudo cargar el estado de mantenimiento."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: Maintenance) {
    setSaving(true);
    setError("");
    try {
      const { maintenance } = await adminRequest<{ maintenance: Maintenance }>(
        "/admin/agestyles/maintenance",
        "POST",
        { enabled: next.enabled, title: next.title, message: next.message, back_at: next.back_at },
      );
      setState(maintenance);
      setDraft(maintenance);
      setNotice(
        maintenance.enabled
          ? "Mantenimiento activado: en menos de un minuto la Tienda muestra la página de mantenimiento y no deja comprar; el Catálogo, en unos minutos."
          : "Mantenimiento desactivado. La Tienda vuelve a estar abierta.",
      );
    } catch (cause) {
      setError(adminError(cause, "No se pudo guardar."));
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    Boolean(state && draft) &&
    (state!.title !== draft!.title ||
      state!.message !== draft!.message ||
      (state!.back_at ?? "") !== (draft!.back_at ?? ""));

  return (
    <OperationList
      title="Mantenimiento"
      subtitle="Cierra la Tienda y el Catálogo mientras trabajáis en ellos. Negocio sigue funcionando."
      loading={loading && !state}
      error={error}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {draft ? (
        <>
          <Section title="Estado">
            <View style={styles.pad}>
              <View style={styles.status}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: state?.enabled ? theme.error : theme.successText },
                  ]}
                />
                <Text style={styles.rowTitle}>
                  {state?.enabled
                    ? "En mantenimiento: los clientes no pueden comprar"
                    : "Abierta: la Tienda funciona con normalidad"}
                </Text>
              </View>
              {state?.updated_at ? (
                <Text style={styles.muted}>Último cambio: {shortDate(state.updated_at)}</Text>
              ) : null}
              <View style={styles.actions}>
                <Button
                  title={state?.enabled ? "Desactivar mantenimiento" : "Activar mantenimiento"}
                  variant={state?.enabled ? "primary" : "danger"}
                  loading={saving}
                  onPress={() => void save({ ...draft, enabled: !state?.enabled })}
                />
              </View>
            </View>
          </Section>
          <Section title="Lo que ven los clientes">
            <View style={styles.form}>
              <Field
                label="Título"
                value={draft.title}
                max={80}
                onChange={(title) => setDraft({ ...draft, title })}
              />
              <Field
                label="Mensaje"
                value={draft.message}
                max={400}
                multiline
                onChange={(message) => setDraft({ ...draft, message })}
              />
              <Field
                label="Volvemos (opcional)"
                value={draft.back_at ?? ""}
                max={60}
                placeholder="hoy a las 18:00"
                onChange={(back_at) => setDraft({ ...draft, back_at: back_at || null })}
              />
              <View style={styles.preview} accessibilityLabel="Vista previa">
                <Icon name="settings" size={28} color={theme.action} />
                <Text style={styles.previewTitle}>{draft.title}</Text>
                <Text style={styles.previewText}>{draft.message}</Text>
                {draft.back_at ? (
                  <Text style={styles.rowTitle}>Volvemos {draft.back_at}.</Text>
                ) : null}
              </View>
              <Button
                title="Guardar texto"
                variant="secondary"
                disabled={!dirty}
                loading={saving}
                onPress={() => void save({ ...draft, enabled: Boolean(state?.enabled) })}
              />
            </View>
          </Section>
        </>
      ) : null}
    </OperationList>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  multiline?: boolean;
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
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    pad: { padding: 14, gap: 8 },
    status: { flexDirection: "row", alignItems: "center", gap: 10 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13 },
    actions: { flexDirection: "row", marginTop: 6 },
    form: { padding: 14, gap: 12 },
    field: { gap: 6 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
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
    multiline: { minHeight: 90, textAlignVertical: "top" },
    preview: {
      alignItems: "center",
      gap: 8,
      padding: 24,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
    },
    previewTitle: { color: theme.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
    previewText: { color: theme.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  });
