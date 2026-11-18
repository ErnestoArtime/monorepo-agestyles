/**
 * Client for the AG-19 notification endpoints, shared by Tienda (customer) and Negocio
 * (store member). It only needs a `fetcher`, so each app keeps its own session handling.
 */

export type NotificationScope = "store" | "vendor";

export type Fetcher = <T>(
  path: string,
  init?: { method?: "GET" | "POST" | "DELETE"; body?: unknown },
) => Promise<T>;

export type NotificationGroup =
  "orders" | "payments" | "inventory" | "commissions" | "catalog" | "account";
export type NotificationChannel = "push" | "email";

/** Where tapping a notification should lead; the app maps `screen` to its own routes. */
export type NotificationTarget = { screen: string; params?: Record<string, string> } | null;

export type AppNotification = {
  id: string;
  event_code: string;
  group: NotificationGroup;
  title: string;
  body: string;
  target: NotificationTarget;
  read_at: string | null;
  created_at: string;
};

export type InboxPage = {
  notifications: AppNotification[];
  count: number;
  unread_count: number;
  limit: number;
  offset: number;
};

export type PreferenceRow = {
  group: NotificationGroup;
  channel: NotificationChannel;
  enabled: boolean;
};

export type PushPlatform = "android" | "ios" | "web";

const base = (scope: NotificationScope) => `/${scope}/agestyles`;

export function listNotifications(
  fetcher: Fetcher,
  scope: NotificationScope,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
): Promise<InboxPage> {
  const query = new URLSearchParams({
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
  });
  if (options.unreadOnly) query.set("unread_only", "true");
  return fetcher<InboxPage>(`${base(scope)}/notifications?${query}`);
}

export function markNotificationsRead(
  fetcher: Fetcher,
  scope: NotificationScope,
  selection: { ids: string[] } | { all: true },
): Promise<{ updated: number }> {
  return fetcher<{ updated: number }>(`${base(scope)}/notifications/read`, {
    method: "POST",
    body: selection,
  });
}

export function registerPushDevice(
  fetcher: Fetcher,
  scope: NotificationScope,
  input: { token: string; app: "buyer" | "business"; platform: PushPlatform; appVersion?: string },
): Promise<{ device: { id: string } }> {
  return fetcher<{ device: { id: string } }>(`${base(scope)}/devices`, {
    method: "POST",
    body: {
      token: input.token,
      app: input.app,
      platform: input.platform,
      app_version: input.appVersion,
    },
  });
}

export function removePushDevice(
  fetcher: Fetcher,
  scope: NotificationScope,
  deviceId: string,
): Promise<{ deleted: boolean }> {
  return fetcher<{ deleted: boolean }>(`${base(scope)}/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

export async function getNotificationPreferences(
  fetcher: Fetcher,
  scope: NotificationScope,
): Promise<PreferenceRow[]> {
  const result = await fetcher<{ preferences: PreferenceRow[] }>(
    `${base(scope)}/notification-preferences`,
  );
  return result.preferences;
}

export async function setNotificationPreferences(
  fetcher: Fetcher,
  scope: NotificationScope,
  preferences: PreferenceRow[],
): Promise<PreferenceRow[]> {
  const result = await fetcher<{ preferences: PreferenceRow[] }>(
    `${base(scope)}/notification-preferences`,
    { method: "POST", body: { preferences } },
  );
  return result.preferences;
}

// Spanish copy --------------------------------------------------------------------------

export const GROUP_LABELS: Record<NotificationGroup, string> = {
  orders: "Pedidos",
  payments: "Pagos",
  inventory: "Inventario",
  commissions: "Comisiones",
  catalog: "Catálogo y publicación",
  account: "Cuenta",
};

export const GROUP_HINTS: Record<NotificationGroup, string> = {
  orders: "Pedido recibido, preparación, envío y entrega.",
  payments: "Comprobantes de pago verificados o rechazados.",
  inventory: "Productos con pocas unidades.",
  commissions: "Solicitudes y entregas de retiros de comisión.",
  catalog: "Productos aprobados, rechazados o con cambios pedidos.",
  account: "Seguridad de tu cuenta.",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  push: "En el móvil",
  email: "Por correo",
};

export const GENERIC_TITLE = "Tienes una novedad";
export const GENERIC_BODY = "Abre la app para ver los detalles.";

export function groupLabel(group: string): string {
  return GROUP_LABELS[group as NotificationGroup] ?? "Otros avisos";
}

/** Never shows a raw event code: an empty or missing text falls back to a generic one. */
export function displayNotification(notification: Pick<AppNotification, "title" | "body">): {
  title: string;
  body: string;
} {
  return {
    title: notification.title?.trim() || GENERIC_TITLE,
    body: notification.body?.trim() || GENERIC_BODY,
  };
}

export function unreadLabel(count: number): string {
  if (count <= 0) return "Notificaciones";
  return `Notificaciones, ${count} sin leer`;
}

export function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short relative time in Spanish: «Ahora», «Hace 5 min», «Hace 3 h», «Ayer», «12 nov». */
export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const elapsed = now.getTime() - then.getTime();
  if (Number.isNaN(elapsed)) return "";
  if (elapsed < MINUTE) return "Ahora";
  if (elapsed < HOUR) return `Hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY && then.getDate() === now.getDate()) {
    return `Hace ${Math.floor(elapsed / HOUR)} h`;
  }
  const yesterday = new Date(now.getTime() - DAY);
  if (
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate()
  ) {
    return "Ayer";
  }
  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })
    .format(then)
    .replace(".", "");
}

/** Settings rows grouped for display, in a stable order, ignoring unknown groups. */
export function groupPreferences(
  rows: PreferenceRow[],
): { group: NotificationGroup; push: boolean; email: boolean }[] {
  const order = Object.keys(GROUP_LABELS) as NotificationGroup[];
  return order
    .filter((group) => rows.some((row) => row.group === group))
    .map((group) => ({
      group,
      push: rows.find((row) => row.group === group && row.channel === "push")?.enabled ?? false,
      email: rows.find((row) => row.group === group && row.channel === "email")?.enabled ?? false,
    }));
}
