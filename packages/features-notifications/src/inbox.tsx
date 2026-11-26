import {
  displayNotification,
  formatNotificationTime,
  listNotifications,
  markNotificationsRead,
  type AppNotification,
  type NotificationGroup,
  type NotificationTarget,
} from "@agestyles/api-client/notifications";
import { Icon, type IconName } from "@agestyles/icons";
import { Button, useUiTheme } from "@agestyles/ui-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNotifications } from "./provider";

const PAGE = 20;

const GROUP_ICONS: Record<NotificationGroup, IconName> = {
  orders: "package",
  payments: "creditCard",
  inventory: "warehouse",
  commissions: "tag",
  catalog: "boxes",
  account: "shieldCheck",
};

/**
 * The inbox: newest first, unread highlighted, pull to refresh and «Cargar más».
 * Opening an entry marks it as read and hands its target to the app to navigate.
 */
export function NotificationInbox({
  onOpenTarget,
}: {
  onOpenTarget: (target: NotificationTarget) => void;
}) {
  const { color } = useUiTheme();
  const { scope, fetcher, unreadCount, setUnreadCount } = useNotifications();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      const ticket = ++latest.current;
      if (mode === "refresh") setRefreshing(true);
      else setPhase("loading");
      try {
        const page = await listNotifications(fetcher, scope, { limit: PAGE, offset: 0 });
        if (ticket !== latest.current) return;
        setItems(page.notifications);
        setTotal(page.count);
        setUnreadCount(page.unread_count);
        setPhase("ready");
      } catch {
        if (ticket === latest.current) setPhase("error");
      } finally {
        if (ticket === latest.current) setRefreshing(false);
      }
    },
    [fetcher, scope, setUnreadCount],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await listNotifications(fetcher, scope, { limit: PAGE, offset: items.length });
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [...current, ...page.notifications.filter(({ id }) => !known.has(id))];
      });
      setTotal(page.count);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function open(item: AppNotification) {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, read_at: readAt } : entry)),
      );
      setUnreadCount(Math.max(unreadCount - 1, 0));
      markNotificationsRead(fetcher, scope, { ids: [item.id] }).catch(() => {
        setItems((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, read_at: null } : entry)),
        );
        setUnreadCount(unreadCount);
      });
    }
    onOpenTarget(item.target);
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await markNotificationsRead(fetcher, scope, { all: true });
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((entry) => ({ ...entry, read_at: entry.read_at ?? readAt })),
      );
      setUnreadCount(0);
    } catch {
      setPhase("ready");
      setMoreError(true);
    } finally {
      setMarkingAll(false);
    }
  }

  if (phase === "loading") {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator color={color.action} />
        <Text style={[styles.centerText, { color: color.muted }]}>Cargando tus avisos…</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <Icon name="alert" size={28} color={color.error} />
        <Text style={[styles.centerTitle, { color: color.text }]}>
          No se pudieron cargar los avisos
        </Text>
        <Text style={[styles.centerText, { color: color.muted }]}>
          Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="secondary" onPress={() => void load("initial")} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={() => void load("refresh")}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
      ListHeaderComponent={
        <View>
          {unreadCount > 0 ? (
            <Button
              title="Marcar todo como leído"
              variant="secondary"
              loading={markingAll}
              onPress={() => void markAll()}
              style={styles.markAll}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Icon name="bell" size={28} color={color.muted} />
          <Text style={[styles.centerTitle, { color: color.text }]}>No tienes avisos todavía</Text>
          <Text style={[styles.centerText, { color: color.muted }]}>
            Aquí verás las novedades de tus pedidos y de tu cuenta.
          </Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={color.action} style={styles.footer} />
        ) : moreError ? (
          <View style={styles.footer}>
            <Text style={[styles.centerText, { color: color.error }]}>
              No se pudo completar la acción.
            </Text>
            <Button title="Reintentar" variant="secondary" onPress={() => void loadMore()} />
          </View>
        ) : items.length < total ? (
          <Button
            title="Cargar más"
            variant="secondary"
            onPress={() => void loadMore()}
            style={styles.footer}
          />
        ) : null
      }
      renderItem={({ item }) => {
        const { title, body } = displayNotification(item);
        const unread = !item.read_at;
        const time = formatNotificationTime(item.created_at);
        return (
          <Pressable
            onPress={() => void open(item)}
            accessibilityRole="button"
            accessibilityLabel={`${unread ? "Sin leer. " : ""}${title}. ${body}. ${time}`}
            style={({ pressed }) => [
              styles.row,
              {
                borderColor: color.border,
                backgroundColor: unread ? color.selectedSurface : color.surface,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: color.quietSurface }]}>
              <Icon name={GROUP_ICONS[item.group] ?? "bell"} size={20} color={color.action} />
            </View>
            <View style={styles.rowText}>
              <View style={styles.rowHead}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.rowTitle,
                    { color: color.text, fontWeight: unread ? "700" : "500" },
                  ]}
                >
                  {title}
                </Text>
                <Text style={[styles.rowTime, { color: color.muted }]}>{time}</Text>
              </View>
              <Text numberOfLines={3} style={[styles.rowBody, { color: color.muted }]}>
                {body}
              </Text>
            </View>
            {unread ? <View style={[styles.dot, { backgroundColor: color.action }]} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  emptyContainer: { flexGrow: 1, paddingHorizontal: 16 },
  center: { alignItems: "center", justifyContent: "center", gap: 10, padding: 32, flexGrow: 1 },
  centerTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  centerText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  markAll: { marginBottom: 12 },
  footer: { marginTop: 8, marginBottom: 8, alignItems: "center", gap: 8 },
  row: {
    minHeight: 72,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 3 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, fontSize: 15 },
  rowTime: { fontSize: 12 },
  rowBody: { fontSize: 13, lineHeight: 18 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
