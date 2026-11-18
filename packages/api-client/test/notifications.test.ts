import assert from "node:assert/strict";
import {
  GENERIC_BODY,
  GENERIC_TITLE,
  badgeText,
  displayNotification,
  formatNotificationTime,
  getNotificationPreferences,
  groupLabel,
  groupPreferences,
  listNotifications,
  markNotificationsRead,
  registerPushDevice,
  removePushDevice,
  setNotificationPreferences,
  unreadLabel,
  type Fetcher,
} from "../src/notifications.ts";

/** Tests for the shared notification client. Run with `node test/notifications.test.ts`. */

const calls: { path: string; init?: { method?: string; body?: unknown } }[] = [];
const fetcher: Fetcher = async <T>(
  path: string,
  init?: { method?: "GET" | "POST" | "DELETE"; body?: unknown },
) => {
  calls.push({ path, init });
  return {
    preferences: [{ group: "orders", channel: "push", enabled: true }],
    updated: 2,
    device: { id: "adevice_1" },
    deleted: true,
  } as T;
};

await listNotifications(fetcher, "store");
await listNotifications(fetcher, "vendor", { limit: 5, offset: 10, unreadOnly: true });
await markNotificationsRead(fetcher, "store", { all: true });
await markNotificationsRead(fetcher, "vendor", { ids: ["anotif_1"] });
await registerPushDevice(fetcher, "store", {
  token: "ExponentPushToken[abc]",
  app: "buyer",
  platform: "android",
  appVersion: "1.0.0",
});
await removePushDevice(fetcher, "vendor", "adevice_1");
assert.deepEqual((await getNotificationPreferences(fetcher, "store"))[0].group, "orders");
await setNotificationPreferences(fetcher, "vendor", [
  { group: "inventory", channel: "push", enabled: false },
]);

assert.deepEqual(
  calls.map((call) => `${call.init?.method ?? "GET"} ${call.path}`),
  [
    "GET /store/agestyles/notifications?limit=20&offset=0",
    "GET /vendor/agestyles/notifications?limit=5&offset=10&unread_only=true",
    "POST /store/agestyles/notifications/read",
    "POST /vendor/agestyles/notifications/read",
    "POST /store/agestyles/devices",
    "DELETE /vendor/agestyles/devices/adevice_1",
    "GET /store/agestyles/notification-preferences",
    "POST /vendor/agestyles/notification-preferences",
  ],
);
assert.deepEqual(calls[2].init?.body, { all: true });
assert.deepEqual(calls[4].init?.body, {
  token: "ExponentPushToken[abc]",
  app: "buyer",
  platform: "android",
  app_version: "1.0.0",
});

// Spanish copy never leaks codes
assert.equal(groupLabel("orders"), "Pedidos");
assert.equal(groupLabel("something_new"), "Otros avisos");
assert.deepEqual(displayNotification({ title: "  ", body: "" }), {
  title: GENERIC_TITLE,
  body: GENERIC_BODY,
});
assert.deepEqual(displayNotification({ title: "Pedido listo", body: "Tu pedido está listo." }), {
  title: "Pedido listo",
  body: "Tu pedido está listo.",
});
assert.equal(unreadLabel(0), "Notificaciones");
assert.equal(unreadLabel(3), "Notificaciones, 3 sin leer");
assert.equal(badgeText(7), "7");
assert.equal(badgeText(120), "99+");

// Relative time (noon, 18 Nov 2026 UTC; the formatter works on the local calendar, so use local dates)
const now = new Date(2026, 10, 18, 12, 0, 0);
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
assert.equal(formatNotificationTime(ago(20_000), now), "Ahora");
assert.equal(formatNotificationTime(ago(5 * 60_000), now), "Hace 5 min");
assert.equal(formatNotificationTime(ago(3 * 3_600_000), now), "Hace 3 h");
assert.equal(formatNotificationTime(new Date(2026, 10, 17, 9, 0).toISOString(), now), "Ayer");
assert.equal(formatNotificationTime(new Date(2026, 10, 12, 9, 0).toISOString(), now), "12 nov");
assert.match(
  formatNotificationTime(new Date(2025, 10, 12, 9, 0).toISOString(), now),
  /12 nov 2025/,
);
assert.equal(formatNotificationTime("not a date", now), "");

// Settings grouping
assert.deepEqual(
  groupPreferences([
    { group: "payments", channel: "email", enabled: true },
    { group: "orders", channel: "push", enabled: true },
    { group: "orders", channel: "email", enabled: false },
  ]),
  [
    { group: "orders", push: true, email: false },
    { group: "payments", push: false, email: true },
  ],
);

console.log("api-client notifications: ok");
