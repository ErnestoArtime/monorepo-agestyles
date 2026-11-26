import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { SellerRole } from "@mercurjs/types";

/**
 * AG-19: notifications over HTTP on disposable data. A real two-store checkout and the
 * order stages feed the inbox of the buyer and of each store; push goes to a local
 * stand-in for Expo, never to the real service.
 */

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
const fakeExpoPort = 19290;
const fakeExpoUrl = `http://127.0.0.1:${fakeExpoPort}/--/api/v2`;
assert.equal(process.env.AGESTYLES_CI_DISPOSABLE, "true", "Disposable CI data only");
assert.equal(base, "http://127.0.0.1:19081", "Use the local disposable Mercur API only");
assert(key?.startsWith("pk_"), "Set the disposable publishable API key");
assert(seededPassword?.length >= 12, "Set the disposable seller password");
assert.equal(
  process.env.AGESTYLES_EXPO_API_URL,
  fakeExpoUrl,
  "Start the API with AGESTYLES_EXPO_API_URL pointing at the local Expo stand-in",
);
assert.equal(
  process.env.AGESTYLES_NOTIFICATIONS_QUIET_HOURS,
  "off",
  "Start the API with AGESTYLES_NOTIFICATIONS_QUIET_HOURS=off so push is not deferred",
);

const runId = randomUUID();
const suffix = runId.replaceAll("-", "").slice(0, 12);

// Local stand-in for the Expo push service ---------------------------------------------
const received = [];
const fakeExpo = createServer((request, response) => {
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    const body = raw ? JSON.parse(raw) : [];
    response.setHeader("content-type", "application/json");
    if (request.url?.endsWith("/push/send")) {
      received.push(...body.map((message) => ({ ...message, at: Date.now() })));
      response.end(
        JSON.stringify({
          data: body.map((message, index) =>
            message.to.includes("Gone")
              ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
              : { status: "ok", id: `ticket-${index}-${randomUUID()}` },
          ),
        }),
      );
    } else {
      response.end(JSON.stringify({ data: {} }));
    }
  });
});
await new Promise((resolve) => fakeExpo.listen(fakeExpoPort, "127.0.0.1", resolve));

// HTTP helpers ------------------------------------------------------------------------
async function request(path, { method = "GET", token, body, headers: extra = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...extra,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }
  return { status: response.status, data };
}

async function expectStatus(path, options, expected) {
  const result = await request(path, options);
  const acceptable = Array.isArray(expected) ? expected : [expected];
  assert(
    acceptable.includes(result.status),
    `${options?.method ?? "GET"} ${path}: expected ${acceptable.join(" or ")}, got ${result.status} (${result.data?.message ?? result.data?.code ?? "no body"})`,
  );
  return result.data;
}

async function waitFor(description, probe, { timeoutMs = 30_000, intervalMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    assert(Date.now() < deadline, `Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const makeCustomer = async (label) => {
  const email = `${label}-${runId}@agestyles.example`;
  const password = `${randomUUID()}Aa1!`;
  const { token: registrationToken } = await expectStatus(
    "/auth/customer/emailpass/register",
    { method: "POST", body: { email, password } },
    [200, 201],
  );
  await expectStatus(
    "/store/customers",
    {
      method: "POST",
      token: registrationToken,
      body: { email, first_name: "CI", last_name: "Buyer" },
    },
    [200, 201],
  );
  const { token } = await expectStatus(
    "/auth/customer/emailpass",
    { method: "POST", body: { email, password } },
    200,
  );
  return { token, email };
};

const memberLogin = async (email, password, register = false) => {
  const { token } = await expectStatus(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: { email, password } },
    register ? [200, 201] : 200,
  );
  return token;
};

// Fixtures ----------------------------------------------------------------------------
const owner = await makeCustomer("notify-owner");
const other = await makeCustomer("notify-other");
const { regions } = await expectStatus("/store/regions", {}, 200);
const region = regions.find(({ currency_code }) => currency_code === "eur");
assert(region?.id, "The seeded EUR region is required");
const { sellers } = await expectStatus("/store/sellers?fields=id,handle,name", {}, 200);
const sellerA = sellers.find(({ handle }) => handle === "agestyles-lab-a2");
const sellerB = sellers.find(({ handle }) => handle === "agestyles-lab-b2");
assert(sellerA?.id && sellerB?.id && sellerA.id !== sellerB.id, "Two seeded sellers are required");

const tokenA = await memberLogin("seller@mercur.dev", seededPassword);
const tokenB = await memberLogin("kickz@mercur.dev", seededPassword);
const headersA = { authorization: `Bearer ${tokenA}`, "x-seller-id": sellerA.id };
const headersB = { authorization: `Bearer ${tokenB}`, "x-seller-id": sellerB.id };
const createdMembers = [];

async function createMember(name, roleId) {
  const email = `${name}-${runId}@agestyles.example`;
  const password = `${randomUUID()}Aa1!`;
  const { member_invite: invite } = await expectStatus(
    `/vendor/sellers/${sellerA.id}/members`,
    { method: "POST", headers: headersA, body: { email, role_id: roleId } },
    201,
  );
  await expectStatus(
    "/vendor/members/invites/accept",
    {
      method: "POST",
      headers: { authorization: `Bearer ${await memberLogin(email, password, true)}` },
      body: { invite_token: invite.token, first_name: "CI notifications" },
    },
    200,
  );
  const headers = {
    authorization: `Bearer ${await memberLogin(email, password)}`,
    "x-seller-id": sellerA.id,
  };
  const { seller_member: membership } = await expectStatus(
    "/vendor/members/me?fields=id",
    { headers },
    200,
  );
  createdMembers.push(membership.id);
  return headers;
}

const registeredDevices = [];

try {
  const supportHeaders = await createMember("notify-support", SellerRole.SUPPORT);
  const inventoryHeaders = await createMember("notify-inventory", SellerRole.INVENTORY_MANAGEMENT);

  const storeInbox = (headers) =>
    expectStatus("/vendor/agestyles/notifications?limit=50", { headers }, 200);
  // The seeded owners keep their inbox between runs: remember it and judge only what is new.
  const baseline = new Map();
  for (const headers of [headersA, headersB]) {
    const inbox = await storeInbox(headers);
    baseline.set(headers, new Set(inbox.notifications.map(({ id }) => id)));
    await expectStatus(
      "/vendor/agestyles/notifications/read",
      { method: "POST", headers, body: { all: true } },
      200,
    );
  }
  const fresh = async (headers) => {
    const inbox = await storeInbox(headers);
    const known = baseline.get(headers) ?? new Set();
    return {
      ...inbox,
      notifications: inbox.notifications.filter(({ id }) => !known.has(id)),
    };
  };

  // Authentication and shape ------------------------------------------------------------
  await expectStatus("/store/agestyles/notifications", {}, 401);
  assert.deepEqual(
    Object.keys(await expectStatus("/store/agestyles/notifications", { token: owner.token }, 200)),
    ["notifications", "count", "unread_count", "limit", "offset"],
  );
  await expectStatus(
    "/vendor/agestyles/notifications",
    { headers: { authorization: `Bearer ${tokenA}` } },
    [400, 401, 403],
  );
  await expectStatus(
    "/vendor/agestyles/notifications",
    { headers: { authorization: `Bearer ${tokenA}`, "x-seller-id": sellerB.id } },
    [401, 403, 404],
  );
  // A customer token is not a member and a member token is not a customer
  await expectStatus("/vendor/agestyles/notifications", { token: owner.token }, [400, 401, 403]);
  await expectStatus("/store/agestyles/notifications", { token: tokenA }, [401, 403]);

  // Devices -----------------------------------------------------------------------------
  const tokenOk = `ExponentPushToken[ciok${suffix}]`;
  const tokenGone = `ExponentPushToken[ciGone${suffix}]`;
  const memberToken = `ExponentPushToken[cimember${suffix}]`;
  await expectStatus(
    "/store/agestyles/devices",
    { method: "POST", token: owner.token, body: { token: "nope", app: "buyer", platform: "ios" } },
    400,
  );
  const device = (token, app = "buyer", platform = "android") => ({
    token,
    app,
    platform,
    app_version: "1.0.0",
  });
  for (const pushToken of [tokenOk, tokenGone]) {
    const { device: created } = await expectStatus(
      "/store/agestyles/devices",
      { method: "POST", token: owner.token, body: device(pushToken) },
      201,
    );
    assert(created.id.startsWith("adevice_"));
    assert.equal(created.token, undefined, "The token is never echoed back");
    registeredDevices.push({ id: created.id, kind: "store", token: owner.token });
  }
  await expectStatus(
    "/vendor/agestyles/devices",
    { method: "POST", headers: headersA, body: device(memberToken, "buyer") },
    400,
  );
  const { device: memberDevice } = await expectStatus(
    "/vendor/agestyles/devices",
    { method: "POST", headers: headersA, body: device(memberToken, "business") },
    201,
  );
  registeredDevices.push({ id: memberDevice.id, kind: "vendor", headers: headersA });
  await expectStatus(
    `/store/agestyles/devices/${registeredDevices[0].id}`,
    { method: "DELETE", token: other.token },
    404,
  );

  // Preferences -------------------------------------------------------------------------
  const { preferences: defaults } = await expectStatus(
    "/store/agestyles/notification-preferences",
    { token: owner.token },
    200,
  );
  const pref = (list, group, channel) =>
    list.find((row) => row.group === group && row.channel === channel)?.enabled;
  assert.equal(pref(defaults, "orders", "push"), true);
  assert.equal(pref(defaults, "orders", "email"), false);
  assert.equal(
    defaults.some((row) => row.group === "inventory"),
    false,
    "A customer is never offered store groups",
  );
  const { preferences: afterEmail } = await expectStatus(
    "/store/agestyles/notification-preferences",
    {
      method: "POST",
      token: owner.token,
      body: { preferences: [{ group: "orders", channel: "email", enabled: true }] },
    },
    200,
  );
  assert.equal(pref(afterEmail, "orders", "email"), true);
  for (const bad of [
    { group: "account", channel: "email", enabled: false },
    { group: "inventory", channel: "push", enabled: true },
    { group: "orders", channel: "sms", enabled: true },
  ]) {
    await expectStatus(
      "/store/agestyles/notification-preferences",
      { method: "POST", token: owner.token, body: { preferences: [bad] } },
      400,
    );
  }
  await expectStatus(
    "/store/agestyles/notification-preferences",
    {
      method: "POST",
      token: owner.token,
      body: { preferences: [{ group: "orders", channel: "email", enabled: false }] },
    },
    200,
  );
  const { preferences: otherPrefs } = await expectStatus(
    "/store/agestyles/notification-preferences",
    { token: other.token },
    200,
  );
  assert.equal(pref(otherPrefs, "orders", "email"), false, "Preferences are per customer");
  const { preferences: memberPrefs } = await expectStatus(
    "/vendor/agestyles/notification-preferences",
    { headers: headersA },
    200,
  );
  assert.equal(pref(memberPrefs, "inventory", "push"), true, "Stores are offered stock alerts");

  // Mixed checkout: one group, two store orders ---------------------------------------------
  async function availableOffer(sellerId, sku) {
    const query = new URLSearchParams({
      region_id: region.id,
      seller_id: sellerId,
      limit: "100",
      fields: "+in_stock,+calculated_price,*seller",
    });
    const { offers } = await expectStatus(`/store/offers?${query}`, {}, 200);
    const offer = offers.find((item) => item.sku === sku && item.in_stock);
    assert(offer?.id, `An available seeded offer ${sku} is required`);
    return offer;
  }
  const offerA = await availableOffer(sellerA.id, "AGESTYLES-LAB-A2-COMMON-01");
  const offerB = await availableOffer(sellerB.id, "AGESTYLES-LAB-B2-COMMON-02");
  const { cart } = await expectStatus(
    "/store/carts",
    { method: "POST", token: owner.token, body: { region_id: region.id } },
    200,
  );
  for (const offer of [offerA, offerB]) {
    await expectStatus(
      `/store/carts/${cart.id}/line-items?fields=%2Bitems.*`,
      { method: "POST", token: owner.token, body: { offer_id: offer.id, quantity: 1 } },
      200,
    );
  }
  await expectStatus(
    `/store/carts/${cart.id}`,
    {
      method: "POST",
      token: owner.token,
      body: {
        email: owner.email,
        shipping_address: {
          first_name: "CI",
          last_name: "Buyer",
          address_1: "Calle de prueba 1",
          city: "Madrid",
          postal_code: "28001",
          country_code: "es",
        },
      },
    },
    200,
  );
  const { shipping_options: shippingBySeller } = await expectStatus(
    `/store/shipping-options?cart_id=${cart.id}`,
    { token: owner.token },
    200,
  );
  for (const seller of [sellerA, sellerB]) {
    const option = shippingBySeller[seller.id]?.[0];
    assert(option?.id, `A shipping option for ${seller.id} is required`);
    await expectStatus(
      `/store/carts/${cart.id}/shipping-methods`,
      { method: "POST", token: owner.token, body: { option_id: option.id } },
      200,
    );
  }
  const { payment_collection: collection } = await expectStatus(
    "/store/payment-collections",
    { method: "POST", token: owner.token, body: { cart_id: cart.id } },
    200,
  );
  await expectStatus(
    `/store/payment-collections/${collection.id}/payment-sessions`,
    { method: "POST", token: owner.token, body: { provider_id: "pp_system_default" } },
    200,
  );
  const { quote } = await expectStatus(
    "/store/order-quotes",
    {
      method: "POST",
      token: owner.token,
      headers: { "idempotency-key": randomUUID() },
      body: { cart_id: cart.id },
    },
    201,
  );
  const { orders } = await expectStatus(
    `/store/order-quotes/${quote.id}/accept`,
    {
      method: "POST",
      token: owner.token,
      headers: { "idempotency-key": randomUUID() },
      body: { revision: quote.revision },
    },
    200,
  );
  assert.equal(orders?.length, 2, "Mixed checkout creates one order per store");
  const orderA = orders.find(({ seller_id }) => seller_id === sellerA.id);
  const orderB = orders.find(({ seller_id }) => seller_id === sellerB.id);
  assert(orderA?.id && orderB?.id);

  // Inbox: one «Pedido recibido» for the buyer, one «Pedido nuevo» per store -------------
  const buyerInbox = () =>
    expectStatus("/store/agestyles/notifications?limit=50", { token: owner.token }, 200);
  const placed = await waitFor("the buyer's order notification", async () => {
    const inbox = await buyerInbox();
    return inbox.notifications.some(({ event_code }) => event_code === "order_placed")
      ? inbox
      : null;
  });
  assert.equal(
    placed.notifications.filter(({ event_code }) => event_code === "order_placed").length,
    1,
    "One notification per checkout, not one per store",
  );
  const first = placed.notifications.find(({ event_code }) => event_code === "order_placed");
  assert.equal(first.title, "Pedido recibido");
  assert.equal(first.group, "orders");
  assert.equal(first.read_at, null);
  for (const hidden of ["recipient_id", "recipient_type", "dedupe_key", "seller_id"]) {
    assert.equal(first[hidden], undefined, `${hidden} is not exposed`);
  }

  const sellerAInbox = await waitFor("the first store's order notification", async () => {
    const inbox = await fresh(headersA);
    return inbox.notifications.length ? inbox : null;
  });
  const sellerBInbox = await waitFor("the second store's order notification", async () => {
    const inbox = await fresh(headersB);
    return inbox.notifications.length ? inbox : null;
  });
  assert.deepEqual(
    sellerAInbox.notifications.map(({ event_code }) => event_code),
    ["seller_order_placed"],
  );
  assert.equal(sellerAInbox.notifications[0].target?.params?.id, orderA.id);
  assert.deepEqual(
    sellerBInbox.notifications.map(({ event_code }) => event_code),
    ["seller_order_placed"],
  );
  assert.equal(
    sellerBInbox.notifications[0].target?.params?.id,
    orderB.id,
    "Each store hears only about its own order",
  );
  const supportInbox = await waitFor("the support member's notification", async () => {
    const inbox = await storeInbox(supportHeaders);
    return inbox.notifications.length ? inbox : null;
  });
  assert.equal(supportInbox.notifications[0].event_code, "seller_order_placed");
  assert.equal(
    (await storeInbox(inventoryHeaders)).notifications.length,
    0,
    "The inventory role has no access to orders, so it is not notified",
  );
  assert.equal(
    (await expectStatus("/store/agestyles/notifications", { token: other.token }, 200)).count,
    0,
    "Another customer sees nothing",
  );

  // The first push reaches Expo for both tokens; the unreachable one is revoked ---------------
  const placedPush = await waitFor(
    "the push for the placed order",
    async () => {
      const sent = received.filter(({ title }) => title === "Pedido recibido");
      return sent.length ? sent : null;
    },
    { timeoutMs: 150_000 },
  );
  assert(placedPush.some(({ to }) => to === tokenOk));
  assert(placedPush.some(({ to }) => to === tokenGone));
  for (const message of placedPush) {
    assert.deepEqual(Object.keys(message.data).sort(), ["notification_id", "target"]);
    assert.equal(message.data.notification_id, first.id);
    assert.equal(message.sound, "default");
    assert(!/\d+[.,]\d{2}/.test(message.body), "Push text carries no amounts");
  }
  const memberPush = received.find(
    ({ title, to }) => title === "Pedido nuevo" && to === memberToken,
  );
  assert(memberPush, "The store owner's device receives the new-order push");
  const memberInbox = await storeInbox(headersA);
  assert(
    memberInbox.notifications.some(
      ({ id, event_code }) =>
        id === memberPush.data.notification_id && event_code === "seller_order_placed",
    ),
    "The seller push points to the same notice in the seller inbox",
  );
  assert(
    !received.some(
      ({ title, to }) => title === "Pedido nuevo" && (to === tokenOk || to === tokenGone),
    ),
    "A buyer's devices never receive store notifications",
  );

  // Order stages by the store -----------------------------------------------------------------
  const { stock_locations: locations } = await expectStatus(
    "/vendor/stock-locations?limit=50&fields=id",
    { headers: headersA },
    200,
  );
  const { order: detail } = await expectStatus(
    `/vendor/orders/${orderA.id}?fields=id,items.id,items.quantity`,
    { headers: headersA },
    200,
  );
  const fulfillmentPath = `/vendor/agestyles/orders/${orderA.id}/fulfillments`;
  const { fulfillment } = await expectStatus(
    fulfillmentPath,
    {
      method: "POST",
      headers: headersA,
      body: {
        location_id: locations[0].id,
        items: detail.items.map(({ id, quantity }) => ({ id, quantity })),
      },
    },
    201,
  );
  for (const action of ["ready", "dispatch", "deliver"]) {
    await expectStatus(
      fulfillmentPath,
      { method: "POST", headers: headersA, body: { action, fulfillment_id: fulfillment.id } },
      200,
    );
  }
  const stages = {
    order_preparing: "Pedido en preparación",
    order_ready: "Pedido listo",
    order_dispatched: "Pedido despachado",
    order_delivered: "Pedido entregado",
  };
  const afterStages = await waitFor(
    "the four stage notifications",
    async () => {
      const inbox = await buyerInbox();
      const codes = inbox.notifications.map(({ event_code }) => event_code);
      return Object.keys(stages).every((code) => codes.includes(code)) ? inbox : null;
    },
    { timeoutMs: 45_000 },
  );
  for (const [code, title] of Object.entries(stages)) {
    const found = afterStages.notifications.filter(({ event_code }) => event_code === code);
    assert.equal(found.length, 1, `${code} appears exactly once`);
    assert.equal(found[0].title, title);
    assert.equal(found[0].target?.params?.id, orderA.id);
  }
  const delivered = afterStages.notifications.find(
    ({ event_code }) => event_code === "order_delivered",
  );
  assert(
    delivered.body.startsWith("Tu pedido de ") && delivered.body.endsWith(" se ha entregado."),
    delivered.body,
  );
  assert(
    afterStages.notifications.indexOf(delivered) <
      afterStages.notifications.indexOf(
        afterStages.notifications.find(({ event_code }) => event_code === "order_placed"),
      ),
    "Newest first",
  );
  assert.equal(
    (await fresh(headersB)).notifications.length,
    1,
    "The other store is not told about the first store's stages",
  );

  // The stage pushes skip the revoked token ---------------------------------------------------
  const stagePush = await waitFor(
    "the stage pushes",
    async () => {
      const sent = received.filter(({ title }) => title === "Pedido entregado");
      return sent.length ? sent : null;
    },
    { timeoutMs: 150_000 },
  );
  assert(stagePush.some(({ to }) => to === tokenOk));
  assert(
    stagePush.some(({ to, data }) => to === tokenOk && data.notification_id === delivered.id),
    "The delivery push points to the same notice in the buyer inbox",
  );
  assert(
    !stagePush.some(({ to }) => to === tokenGone),
    "A device Expo reports as unregistered is revoked and no longer receives pushes",
  );

  // Reading ---------------------------------------------------------------------------------
  const unread = afterStages.unread_count;
  assert.equal(unread, afterStages.notifications.length, "Everything starts unread");
  await expectStatus(
    "/store/agestyles/notifications/read",
    { method: "POST", token: owner.token, body: {} },
    400,
  );
  const foreignRead = await expectStatus(
    "/store/agestyles/notifications/read",
    { method: "POST", token: other.token, body: { ids: [first.id] } },
    200,
  );
  assert.equal(foreignRead.updated, 0, "Nobody can mark someone else's notification");
  assert.equal((await buyerInbox()).unread_count, unread);
  const oneRead = await expectStatus(
    "/store/agestyles/notifications/read",
    { method: "POST", token: owner.token, body: { ids: [first.id] } },
    200,
  );
  assert.equal(oneRead.updated, 1);
  const afterOne = await buyerInbox();
  assert.equal(afterOne.unread_count, unread - 1);
  assert(afterOne.notifications.find(({ id }) => id === first.id).read_at);
  const onlyUnread = await expectStatus(
    "/store/agestyles/notifications?unread_only=true&limit=50",
    { token: owner.token },
    200,
  );
  assert.equal(onlyUnread.count, unread - 1);
  const allRead = await expectStatus(
    "/store/agestyles/notifications/read",
    { method: "POST", token: owner.token, body: { all: true } },
    200,
  );
  assert.equal(allRead.updated, unread - 1);
  assert.equal((await buyerInbox()).unread_count, 0);
  assert.equal(
    (await storeInbox(headersA)).unread_count,
    1,
    "Reading the buyer's inbox leaves the store's unread count alone",
  );
  await expectStatus(
    "/vendor/agestyles/notifications/read",
    { method: "POST", headers: headersA, body: { all: true } },
    200,
  );
  assert.equal((await storeInbox(headersA)).unread_count, 0);
  assert.equal(
    (await storeInbox(supportHeaders)).unread_count,
    1,
    "Each member keeps their own read state",
  );

  console.log(
    "PASS: notifications reach the right buyer, store and role; stages are uniform; push skips revoked devices; read state is per recipient",
  );
} finally {
  for (const item of registeredDevices) {
    await request(`/${item.kind === "store" ? "store" : "vendor"}/agestyles/devices/${item.id}`, {
      method: "DELETE",
      token: item.token,
      headers: item.headers,
    }).catch(() => undefined);
  }
  for (const id of createdMembers) {
    await request(`/vendor/sellers/${sellerA.id}/members/${id}`, {
      method: "DELETE",
      headers: headersA,
    }).catch(() => undefined);
  }
  await new Promise((resolve) => fakeExpo.close(resolve));
}
