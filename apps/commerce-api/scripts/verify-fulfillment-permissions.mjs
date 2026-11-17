import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SellerRole } from "@mercurjs/types";

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const password = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
assert.equal(process.env.AGESTYLES_CI_DISPOSABLE, "true");
assert.equal(base, "http://127.0.0.1:19081");
assert(key?.startsWith("pk_"));
assert(password?.length >= 12);

const runId = randomUUID();
const actors = [];

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...headers,
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
  assert.equal(
    result.status,
    expected,
    `${options?.method ?? "GET"} ${path}: expected ${expected}, got ${result.status}`,
  );
  return result.data;
}

async function authenticate(email, actorPassword, register = false) {
  const data = await expectStatus(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: { email, password: actorPassword } },
    200,
  );
  assert(data?.token);
  return { authorization: `Bearer ${data.token}` };
}

const ownerHeaders = await authenticate("seller@mercur.dev", password);
const { sellers } = await expectStatus("/store/sellers?fields=id,handle", {}, 200);
const seller = sellers.find(({ handle }) => handle === "agestyles-lab-a2");
assert(seller?.id, "The A2 seller fixture is required");
const scopedOwnerHeaders = { ...ownerHeaders, "x-seller-id": seller.id };
const membersPath = `/vendor/sellers/${seller.id}/members`;
const probePath = "/vendor/agestyles/orders/order_ci_permission_probe/fulfillments";
const body = {
  location_id: "loc_ci_permission_probe",
  items: [{ id: "item_ci_permission_probe", quantity: 1 }],
};

async function createActor(name, roleId) {
  const credentials = {
    email: `${name}-${runId}@agestyles.example`,
    password: `${randomUUID()}Aa1!`,
  };
  const { member_invite: invite } = await expectStatus(
    membersPath,
    {
      method: "POST",
      headers: scopedOwnerHeaders,
      body: { email: credentials.email, role_id: roleId },
    },
    201,
  );
  assert(invite?.token);
  await expectStatus(
    "/vendor/members/invites/accept",
    {
      method: "POST",
      headers: await authenticate(credentials.email, credentials.password, true),
      body: { invite_token: invite.token, first_name: "CI fulfillment" },
    },
    200,
  );
  const headers = {
    ...(await authenticate(credentials.email, credentials.password)),
    "x-seller-id": seller.id,
  };
  const { seller_member: membership } = await expectStatus(
    "/vendor/members/me?fields=id,is_owner,role_id,permissions",
    { headers },
    200,
  );
  actors.push({ headers, membership });
  return membership;
}

try {
  const manager = await createActor("fulfillment-inventory", SellerRole.INVENTORY_MANAGEMENT);
  const reader = await createActor("fulfillment-reader", SellerRole.SUPPORT);
  assert.equal(manager.permissions?.inventory_items, "edit");
  assert.equal(reader.permissions?.orders, "view");

  for (const actor of actors) {
    const result = await request(probePath, {
      method: "POST",
      headers: actor.headers,
      body,
    });
    assert.equal(result.status, 403, "Inventory manager and read-only member cannot fulfill");
  }

  const ownerResult = await request(probePath, {
    method: "POST",
    headers: scopedOwnerHeaders,
    body,
  });
  assert.equal(
    ownerResult.status,
    404,
    "Owner must pass authorization before missing-order lookup",
  );
  console.log("PASS: fulfillment requires orders:edit; inventory manager and read-only are denied");
} finally {
  for (const actor of actors) {
    await expectStatus(
      `${membersPath}/${actor.membership.id}`,
      {
        method: "DELETE",
        headers: scopedOwnerHeaders,
      },
      200,
    );
  }
}
