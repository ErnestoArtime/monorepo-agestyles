import assert from "node:assert/strict";
import {
  DEFAULT_QUIET_HOURS,
  EVENTS,
  EVENT_CODES,
  GENERIC_NOTIFICATION,
  MAX_ATTEMPTS,
  NotificationValidationError,
  dedupeKey,
  isQuietHour,
  memberReceives,
  nextAllowedPushTime,
  parseDeviceInput,
  quietHoursFromEnv,
  parsePreferencesInput,
  preferencesMatrix,
  renderEmail,
  renderNotification,
  renderPasswordResetEmail,
  resolveDeliveryChannels,
  retryDelayMs,
} from "../src/rules.ts";

/** Rule tests for AG-19 notifications. Run with `node test/notifications.test.ts`. */

const invalid = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(
    fn,
    (error: unknown) => error instanceof NotificationValidationError && pattern.test(error.message),
  );

// Texts: every event renders Spanish text and never leaks the code
for (const code of EVENT_CODES) {
  const rendered = renderNotification(code, { store: "Tienda Sol", order_id: "order_1" });
  assert.ok(rendered.title.length > 0 && rendered.body.length > 0, code);
  assert.ok(!rendered.title.includes(code) && !rendered.body.includes(code), code);
}
assert.equal(
  renderNotification("order_dispatched", { store: "Tienda Sol" }).body,
  "Tu pedido de Tienda Sol va en camino.",
);
assert.equal(
  renderNotification("order_dispatched", {}).body,
  "Tu pedido de la tienda va en camino.",
);
assert.deepEqual(renderNotification("order_delivered", { order_id: "order_9" }).target, {
  screen: "order",
  params: { id: "order_9" },
});
assert.equal(
  renderNotification("seller_low_stock", { product: "Camisa", available: 1 }).body,
  "«Camisa» tiene pocas unidades (1 unidad).",
);
assert.equal(
  renderNotification("seller_low_stock", { product: "Camisa", available: 0 }).body,
  "«Camisa» tiene pocas unidades (0 unidades).",
);
// Unknown or hostile codes fall back to the generic text
assert.deepEqual(renderNotification("something_new"), GENERIC_NOTIFICATION);
assert.deepEqual(renderNotification("__proto__"), GENERIC_NOTIFICATION);
assert.deepEqual(renderNotification("constructor"), GENERIC_NOTIFICATION);

// Dedupe keys
assert.equal(dedupeKey("order_group.created", "og_1", "cus_1"), "order_group.created:og_1:cus_1");
assert.throws(() => dedupeKey("a", ""), NotificationValidationError);
assert.throws(() => dedupeKey("a", null), NotificationValidationError);
assert.throws(() => dedupeKey(), NotificationValidationError);

// Audiences mirror seller-permissions
const owner = { member_id: "mem_o", role_id: null, is_owner: true };
const admin = { member_id: "mem_a", role_id: "role_seller_administration", is_owner: false };
const support = { member_id: "mem_s", role_id: "role_seller_support", is_owner: false };
const stock = { member_id: "mem_i", role_id: "role_seller_inventory_management", is_owner: false };
const other = { member_id: "mem_x", role_id: "role_seller_accounting", is_owner: false };
assert.deepEqual(
  [owner, admin, support, stock, other].map((m) => memberReceives("orders", m)),
  [true, true, true, false, false],
);
assert.deepEqual(
  [owner, admin, support, stock, other].map((m) => memberReceives("inventory", m)),
  [true, true, false, true, false],
);
assert.deepEqual(
  [owner, admin, support, stock, other].map((m) => memberReceives("managers", m)),
  [true, true, false, false, false],
);
assert.equal(memberReceives("member", support, "mem_s"), true);
assert.equal(memberReceives("member", owner, "mem_s"), false);
assert.equal(memberReceives("member", owner, null), false);

// Channels and preferences
assert.deepEqual(resolveDeliveryChannels(EVENTS.order_placed, []), ["push"]);
assert.deepEqual(
  resolveDeliveryChannels(EVENTS.order_placed, [
    { group: "orders", channel: "email", enabled: true },
    { group: "orders", channel: "push", enabled: false },
  ]),
  ["email"],
);
assert.deepEqual(
  resolveDeliveryChannels(EVENTS.payment_verified, [
    { group: "orders", channel: "push", enabled: false },
  ]),
  ["push"],
  "preferences are per group",
);
const mandatory = { ...EVENTS.order_placed, mandatory: true };
assert.deepEqual(
  resolveDeliveryChannels(mandatory, [{ group: "orders", channel: "push", enabled: false }]),
  ["push", "email"],
);
assert.deepEqual(
  parsePreferencesInput({ preferences: [{ group: "orders", channel: "email", enabled: true }] }),
  [{ group: "orders", channel: "email", enabled: true }],
);
invalid(() => parsePreferencesInput({}), /preferencias/);
invalid(
  () => parsePreferencesInput({ preferences: [{ group: "nope", channel: "push", enabled: true }] }),
  /Grupo/,
);
invalid(
  () =>
    parsePreferencesInput({
      preferences: [{ group: "account", channel: "email", enabled: false }],
    }),
  /cuenta/,
);
invalid(
  () =>
    parsePreferencesInput({ preferences: [{ group: "orders", channel: "sms", enabled: true }] }),
  /Canal/,
);
invalid(
  () =>
    parsePreferencesInput({ preferences: [{ group: "orders", channel: "push", enabled: "yes" }] }),
  /activado/,
);

// Settings matrix per recipient type
const customerMatrix = preferencesMatrix("customer", [
  { group: "orders", channel: "email", enabled: true },
]);
assert.deepEqual([...new Set(customerMatrix.map((row) => row.group))], ["orders", "payments"]);
assert.equal(
  customerMatrix.find((row) => row.group === "orders" && row.channel === "email")?.enabled,
  true,
);
assert.equal(
  customerMatrix.find((row) => row.group === "orders" && row.channel === "push")?.enabled,
  true,
);
assert.equal(
  customerMatrix.find((row) => row.group === "payments" && row.channel === "email")?.enabled,
  false,
);
assert.deepEqual(
  [...new Set(preferencesMatrix("member", []).map((row) => row.group))],
  ["orders", "payments", "inventory", "commissions", "catalog"],
);

// Devices
assert.deepEqual(
  parseDeviceInput({
    token: "ExponentPushToken[abcdEFGH12345]",
    app: "buyer",
    platform: "android",
    app_version: " 1.2.3 ",
  }),
  {
    token: "ExponentPushToken[abcdEFGH12345]",
    app: "buyer",
    platform: "android",
    app_version: "1.2.3",
  },
);
invalid(() => parseDeviceInput({ token: "abc", app: "buyer", platform: "ios" }), /token/);
invalid(
  () => parseDeviceInput({ token: "ExpoPushToken[abcdefgh]", app: "admin", platform: "ios" }),
  /Aplicación/,
);
invalid(
  () => parseDeviceInput({ token: "ExpoPushToken[abcdefgh]", app: "buyer", platform: "tv" }),
  /Plataforma/,
);
invalid(
  () =>
    parseDeviceInput({
      token: "ExpoPushToken[abcdefgh]",
      app: "buyer",
      platform: "ios",
      app_version: "x".repeat(33),
    }),
  /versión/,
);

// Retries: 1 min, 5 min, 30 min, 2 h, 12 h, then give up
assert.deepEqual(
  [1, 2, 3, 4].map((attempts) => retryDelayMs(attempts)),
  [60_000, 300_000, 1_800_000, 7_200_000],
);
assert.equal(retryDelayMs(MAX_ATTEMPTS), null);
assert.equal(retryDelayMs(MAX_ATTEMPTS + 3), null);
assert.equal(retryDelayMs(0), 60_000);

// Push provider errors
assert.equal(classifyPushError("DeviceNotRegistered"), "revoke");
assert.equal(classifyPushError("MessageTooBig"), "fatal");
assert.equal(classifyPushError("InvalidCredentials"), "fatal");
assert.equal(classifyPushError("MessageRateExceeded"), "retry");
assert.equal(classifyPushError(undefined), "retry");

// Quiet hours, Cuba time (EST in winter, UTC-5): 22:00-07:00
assert.equal(DEFAULT_QUIET_HOURS.timeZone, "America/Havana");
const at = (iso: string) => new Date(iso);
assert.equal(isQuietHour(at("2026-11-19T03:30:00Z")), true, "22:30 local");
assert.equal(isQuietHour(at("2026-11-19T11:59:00Z")), true, "06:59 local");
assert.equal(isQuietHour(at("2026-11-19T12:00:00Z")), false, "07:00 local");
assert.equal(isQuietHour(at("2026-11-19T20:00:00Z")), false, "15:00 local");
assert.equal(isQuietHour(at("2026-11-19T03:00:00Z")), true, "22:00 local");
assert.equal(isQuietHour(at("2026-11-19T02:59:00Z")), false, "21:59 local");
const afternoon = at("2026-11-19T20:00:00Z");
assert.equal(nextAllowedPushTime(afternoon).getTime(), afternoon.getTime());
const night = nextAllowedPushTime(at("2026-11-19T04:10:00Z"));
assert.ok(night.getTime() >= at("2026-11-19T12:00:00Z").getTime());
assert.ok(night.getTime() < at("2026-11-19T12:15:00Z").getTime());
assert.equal(isQuietHour(night), false);

// Quiet hours can be switched off for disposable test data, nothing else disables them
assert.equal(quietHoursFromEnv("off"), null);
assert.equal(quietHoursFromEnv(" OFF "), null);
assert.deepEqual(quietHoursFromEnv(undefined), DEFAULT_QUIET_HOURS);
assert.deepEqual(quietHoursFromEnv("false"), DEFAULT_QUIET_HOURS);

// Email
const email = renderEmail({
  subject: "Hola",
  heading: "<b>Hola</b>",
  paragraphs: ["a & b"],
  button: { label: "Abrir", url: "https://tienda.eav-labs.com/?a=1&b=2" },
});
assert.ok(email.html.includes("&lt;b&gt;Hola&lt;/b&gt;"), "escapes the heading");
assert.ok(email.html.includes("a &amp; b"), "escapes paragraphs");
assert.ok(email.html.includes("a=1&amp;b=2"), "escapes the link");
assert.ok(
  !renderEmail({
    subject: "x",
    heading: "x",
    paragraphs: [],
    button: { label: "x", url: "javascript:alert(1)" },
  }).html.includes("javascript:"),
  "only https links become buttons",
);
const reset = renderPasswordResetEmail("https://tienda.eav-labs.com/reset-password?token=t");
assert.equal(reset.subject, "Restablece tu contraseña de AgeStyles");
assert.ok(reset.html.includes('lang="es"'));

console.log("notifications rules: ok");

// Expo client with a fake transport
import {
  ExpoPushClient,
  ExpoRequestError,
  classifyPushError,
  decodeTicketRef,
  encodeTicketRef,
} from "../src/expo.ts";

const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
const fakeFetch =
  (respond: (url: string, body: unknown) => unknown, status = 200) =>
  async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, headers: init.headers });
    return { ok: status === 200, status, json: async () => respond(url, body) };
  };

const messages = Array.from({ length: 205 }, (_, index) => ({
  to: `ExponentPushToken[token${index}abcd]`,
  title: "t",
  body: "b",
}));
const sendClient = new ExpoPushClient({
  accessToken: "secret",
  fetch: fakeFetch((_url, body) => ({
    data: (body as { to: string }[]).map((message, index) =>
      message.to.endsWith("7abcd]")
        ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
        : message.to.endsWith("9abcd]")
          ? { status: "error", message: "slow", details: { error: "MessageRateExceeded" } }
          : { status: "ok", id: `ticket-${message.to}-${index}` },
    ),
  })),
});
const sent = await sendClient.send(messages);
assert.equal(sent.length, 205);
assert.equal(calls.length, 3, "205 messages go in 3 batches of at most 100");
assert.deepEqual(
  calls.map((call) => (call.body as unknown[]).length),
  [100, 100, 5],
);
assert.equal(calls[0].headers.authorization, "Bearer secret");
assert.equal((calls[0].body as { channelId: string }[])[0].channelId, "default");
assert.deepEqual(sent[7], { ok: false, code: "DeviceNotRegistered", action: "revoke" });
assert.deepEqual(sent[9], { ok: false, code: "MessageRateExceeded", action: "retry" });
assert.equal(sent[0].ok, true);

const brokenClient = new ExpoPushClient({ fetch: fakeFetch(() => ({}), 503) });
await assert.rejects(
  () => brokenClient.send([messages[0]]),
  (error: unknown) => error instanceof ExpoRequestError && error.message === "http_503",
);
const shortClient = new ExpoPushClient({ fetch: fakeFetch(() => ({ data: [] })) });
await assert.rejects(
  () => shortClient.send([messages[0]]),
  (error: unknown) => error instanceof ExpoRequestError && error.message === "invalid_response",
);
const throwingClient = new ExpoPushClient({
  fetch: async () => {
    throw new Error("offline");
  },
});
await assert.rejects(
  () => throwingClient.send([messages[0]]),
  (error: unknown) => error instanceof ExpoRequestError && error.message === "network_error",
);

calls.length = 0;
const receiptClient = new ExpoPushClient({
  fetch: fakeFetch((_url, body) => ({
    data: Object.fromEntries(
      (body as { ids: string[] }).ids.map((id) => [
        id,
        id === "dead"
          ? { status: "error", details: { error: "DeviceNotRegistered" } }
          : { status: "ok" },
      ]),
    ),
  })),
});
const receipts = await receiptClient.receipts([
  "a",
  "dead",
  ...Array.from({ length: 300 }, (_, i) => `x${i}`),
]);
assert.equal(calls.length, 2, "302 receipts are read in 2 requests");
assert.deepEqual(receipts.get("dead"), {
  ok: false,
  code: "DeviceNotRegistered",
  action: "revoke",
});
assert.equal(receipts.get("a")?.ok, true);

assert.equal(
  encodeTicketRef([
    { deviceId: "adevice_1", ticketId: "t1" },
    { deviceId: "adevice_2", ticketId: "t2" },
  ]),
  "adevice_1=t1,adevice_2=t2",
);
assert.deepEqual(decodeTicketRef("adevice_1=t1,adevice_2=t2"), [
  { deviceId: "adevice_1", ticketId: "t1" },
  { deviceId: "adevice_2", ticketId: "t2" },
]);
assert.deepEqual(decodeTicketRef(null), []);
assert.deepEqual(decodeTicketRef("broken,=x,y="), []);

// The Expo base URL is https or loopback only
assert.throws(
  () => new ExpoPushClient({ baseUrl: "http://exp.host/--/api/v2" }),
  (error: unknown) => error instanceof ExpoRequestError && error.message === "invalid_base_url",
);
assert.throws(
  () => new ExpoPushClient({ baseUrl: "http://evil.example/--/api/v2" }),
  ExpoRequestError,
);
calls.length = 0;
const loopback = new ExpoPushClient({
  baseUrl: "http://127.0.0.1:19290/--/api/v2/",
  fetch: fakeFetch(() => ({ data: [{ status: "ok", id: "t" }] })),
});
await loopback.send([messages[0]]);
assert.equal(calls[0].url, "http://127.0.0.1:19290/--/api/v2/push/send");

console.log("notifications expo client: ok");
