import {
  CHANNEL_LABELS,
  GROUP_HINTS,
  GROUP_LABELS,
  getNotificationPreferences,
  groupPreferences,
  setNotificationPreferences,
  type NotificationChannel,
  type NotificationGroup,
  type PreferenceRow,
} from "@agestyles/api-client/notifications";
import { Icon } from "@agestyles/icons";
import { Button, Card, useUiTheme } from "@agestyles/ui-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Switch, Text, View } from "react-native";
import { useNotifications } from "./provider";
import { usePushRegistration, type AppName, type PushStatus } from "./push";

const PUSH_COPY: Record<PushStatus, string> = {
  checking: "Comprobando este dispositivo…",
  unsupported:
    "Los avisos en el móvil solo están disponibles en la app instalada de Android o iOS.",
  unconfigured: "Los avisos en el móvil aún no están disponibles en esta versión de la app.",
  denied: "Has bloqueado las notificaciones. Actívalas en los ajustes del dispositivo.",
  undetermined:
    "Recibe un aviso en el móvil cuando haya novedades, aunque no tengas la app abierta.",
  granted: "Las notificaciones están permitidas, pero este dispositivo aún no está activado.",
  registered: "Los avisos en el móvil están activados en este dispositivo.",
};

/**
 * Settings: this device's push permission and, per group, whether to be told on the phone
 * or by email. The inbox itself is always on, and account/security notices cannot be turned off.
 */
export function NotificationPreferences({ app }: { app: AppName }) {
  const { color } = useUiTheme();
  const { fetcher, scope } = useNotifications();
  const push = usePushRegistration(app);
  const [rows, setRows] = useState<PreferenceRow[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [saveError, setSaveError] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      setRows(await getNotificationPreferences(fetcher, scope));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [fetcher, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(group: NotificationGroup, channel: NotificationChannel, enabled: boolean) {
    const previous = rows;
    setSaveError(false);
    setRows((current) =>
      current.map((row) =>
        row.group === group && row.channel === channel ? { ...row, enabled } : row,
      ),
    );
    try {
      setRows(await setNotificationPreferences(fetcher, scope, [{ group, channel, enabled }]));
    } catch {
      setRows(previous);
      setSaveError(true);
    }
  }

  const groups = groupPreferences(rows);
  const canAsk = push.status === "undetermined" || push.status === "granted";

  return (
    <View style={styles.container}>
      <Text style={[styles.intro, { color: color.muted }]}>
        Elige cómo quieres enterarte de las novedades.
      </Text>

      <Card style={styles.card}>
        <View style={styles.pushHead}>
          <Icon name="bell" size={20} color={color.action} />
          <Text style={[styles.cardTitle, { color: color.text }]}>Avisos en este móvil</Text>
        </View>
        <Text style={[styles.cardText, { color: color.muted }]} accessibilityLiveRegion="polite">
          {PUSH_COPY[push.status]}
        </Text>
        {canAsk ? (
          <Button
            title="Activar avisos en el móvil"
            loading={push.busy}
            onPress={() => void push.enable()}
          />
        ) : null}
        {push.status === "denied" ? (
          <Button
            title="Abrir ajustes"
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
        {push.status === "registered" ? (
          <Button
            title="Desactivar en este móvil"
            variant="secondary"
            loading={push.busy}
            onPress={() => void push.disable()}
          />
        ) : null}
      </Card>

      {phase === "loading" ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={color.action} />
          <Text style={[styles.cardText, { color: color.muted }]}>Cargando tus preferencias…</Text>
        </View>
      ) : null}

      {phase === "error" ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <Text style={[styles.cardText, { color: color.error }]}>
            No se pudieron cargar tus preferencias.
          </Text>
          <Button title="Reintentar" variant="secondary" onPress={() => void load()} />
        </View>
      ) : null}

      {phase === "ready"
        ? groups.map((entry) => (
            <Card key={entry.group} style={styles.card}>
              <Text style={[styles.cardTitle, { color: color.text }]}>
                {GROUP_LABELS[entry.group]}
              </Text>
              <Text style={[styles.cardText, { color: color.muted }]}>
                {GROUP_HINTS[entry.group]}
              </Text>
              {(["push", "email"] as const).map((channel) => (
                <View key={channel} style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: color.text }]}>
                    {CHANNEL_LABELS[channel]}
                  </Text>
                  <Switch
                    value={entry[channel]}
                    onValueChange={(value) => void toggle(entry.group, channel, value)}
                    // The thumb must stand out from its track in both themes: it is the part
                    // that shows the state (a dark thumb on a dark track vanished in dark mode).
                    trackColor={{ false: color.border, true: color.action }}
                    thumbColor={entry[channel] ? color.onAction : color.muted}
                    ios_backgroundColor={color.border}
                    accessibilityLabel={`${GROUP_LABELS[entry.group]}: ${CHANNEL_LABELS[channel].toLowerCase()}`}
                  />
                </View>
              ))}
            </Card>
          ))
        : null}

      {saveError ? (
        <Text style={[styles.cardText, { color: color.error }]} accessibilityLiveRegion="assertive">
          No se pudo guardar el cambio. Inténtalo de nuevo.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  intro: { fontSize: 14, lineHeight: 20 },
  card: { gap: 10 },
  pushHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardText: { fontSize: 13, lineHeight: 19 },
  center: { alignItems: "center", gap: 10, padding: 24 },
  switchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchLabel: { flex: 1, fontSize: 14 },
});
