import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/**
 * AG-70: following stores over HTTP on disposable data. Authentication, ownership (one customer
 * never sees or changes another's follows), the alert being off by default, and the push-only
 * «following» preference group. The alert itself (recent published product, no repeats) is
 * covered by test/store-follows.test.mjs and the rules tests, because publishing needs the
 * administration's review flow.
 */

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
assert.equal(process.env.AGESTYLES_CI_DISPOSABLE, "true", "Disposable CI data only");
assert.equal(base, "http://127.0.0.1:19081", "Use the local disposable Mercur API only");
assert(key?.startsWith("pk_"), "Set the disposable publishable API key");
assert(seededPassword?.length >= 12, "Set the disposable seller password");

const runId = randomUUID();

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
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
    `${options?.method ?? "GET"} ${path}: expected ${acceptable.join(" or ")}, got ${result.status} (${result.data?.message ?? "no body"})`,
  );
  return result.data;
}

async function makeCustomer(label) {
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
      body: { email, first_name: "CI", last_name: "Follower" },
    },
    [200, 201],
  );
  const { token } = await expectStatus(
    "/auth/customer/emailpass",
    { method: "POST", body: { email, password } },
    200,
  );
  return token;
}

const { sellers } = await expectStatus("/store/sellers?fields=id,handle,name", {}, 200);
const seller = sellers.find(({ handle }) => handle === "agestyles-lab-a2");
const otherSeller = sellers.find(({ handle }) => handle === "agestyles-lab-b2");
assert(seller?.id && otherSeller?.id, "Two seeded sellers are required");

const alice = await makeCustomer("follow-alice");
const bob = await makeCustomer("follow-bob");
const memberToken = (
  await expectStatus(
    "/auth/member/emailpass",
    { method: "POST", body: { email: "seller@mercur.dev", password: seededPassword } },
    200,
  )
).token;

const path = "/store/agestyles/store-follows";
const one = (id) => `${path}/${id}`;

// Authentication: customers only -------------------------------------------------------
await expectStatus(path, {}, 401);
await expectStatus(path, { method: "POST", body: { seller_id: seller.id } }, 401);
await expectStatus(one(seller.id), { method: "POST", body: { notify_new_products: true } }, 401);
await expectStatus(one(seller.id), { method: "DELETE" }, 401);
await expectStatus(path, { token: memberToken }, [401, 403]);

// Follow: idempotent, alert off by default ---------------------------------------------
assert.deepEqual((await expectStatus(path, { token: alice }, 200)).follows, []);
await expectStatus(path, { method: "POST", token: alice, body: {} }, 400);
await expectStatus(path, { method: "POST", token: alice, body: { seller_id: "nope" } }, 400);
await expectStatus(
  path,
  { method: "POST", token: alice, body: { seller_id: "sel_01DOESNOTEXIST00" } },
  404,
);
await expectStatus(
  path,
  { method: "POST", token: alice, body: { seller_id: seller.id, notify_new_products: "yes" } },
  400,
);
const first = await expectStatus(
  path,
  { method: "POST", token: alice, body: { seller_id: seller.id } },
  200,
);
assert.equal(first.created, true);
assert.equal(first.follow.seller_id, seller.id);
assert.equal(first.follow.notify_new_products, false, "The alert is off until the customer asks");
const again = await expectStatus(
  path,
  { method: "POST", token: alice, body: { seller_id: seller.id } },
  200,
);
assert.equal(again.created, false);
assert.equal((await expectStatus(path, { token: alice }, 200)).follows.length, 1);

// Ownership: Bob sees nothing of Alice's and cannot change it ---------------------------
assert.deepEqual((await expectStatus(path, { token: bob }, 200)).follows, []);
await expectStatus(
  one(seller.id),
  { method: "POST", token: bob, body: { notify_new_products: true } },
  404,
);
const bobDelete = await expectStatus(one(seller.id), { method: "DELETE", token: bob }, 200);
assert.equal(bobDelete.deleted, false);
assert.equal((await expectStatus(path, { token: alice }, 200)).follows.length, 1);

// The alert --------------------------------------------------------------------------
await expectStatus(one("not-a-store"), { method: "POST", token: alice, body: {} }, 400);
await expectStatus(one(seller.id), { method: "POST", token: alice, body: {} }, 400);
const on = await expectStatus(
  one(seller.id),
  { method: "POST", token: alice, body: { notify_new_products: true } },
  200,
);
assert.equal(on.follow.notify_new_products, true);
const listed = await expectStatus(path, { token: alice }, 200);
assert.equal(listed.follows[0].notify_new_products, true);

// Following with the alert asked for at once -------------------------------------------
const withAlert = await expectStatus(
  path,
  { method: "POST", token: bob, body: { seller_id: otherSeller.id, notify_new_products: true } },
  200,
);
assert.equal(withAlert.follow.notify_new_products, true);

// Preferences: a push-only group the customer can turn off ------------------------------
const prefs = (
  await expectStatus("/store/agestyles/notification-preferences", { token: alice }, 200)
).preferences;
assert.deepEqual(
  prefs.filter(({ group }) => group === "following"),
  [{ group: "following", channel: "push", enabled: true }],
);
const updated = await expectStatus(
  "/store/agestyles/notification-preferences",
  {
    method: "POST",
    token: alice,
    body: { preferences: [{ group: "following", channel: "push", enabled: false }] },
  },
  200,
);
assert.equal(updated.preferences.find(({ group }) => group === "following").enabled, false);

// Unfollow ---------------------------------------------------------------------------
assert.equal(
  (await expectStatus(one(seller.id), { method: "DELETE", token: alice }, 200)).deleted,
  true,
);
assert.deepEqual((await expectStatus(path, { token: alice }, 200)).follows, []);
assert.equal(
  (await expectStatus(one(seller.id), { method: "DELETE", token: alice }, 200)).deleted,
  false,
);
await expectStatus(one(otherSeller.id), { method: "DELETE", token: bob }, 200);

console.log("store follows over HTTP: ok");
