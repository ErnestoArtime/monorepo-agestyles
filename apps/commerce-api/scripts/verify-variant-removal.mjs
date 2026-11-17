import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SellerRole } from "@mercurjs/types";

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
assert.equal(
  process.env.AGESTYLES_CI_DISPOSABLE,
  "true",
  "This verifier may only run against disposable CI data",
);
assert.equal(base, "http://127.0.0.1:19081", "Use the local disposable Mercur API only");
assert(key?.startsWith("pk_"), "Set the disposable publishable API key");
assert(seededPassword?.length >= 12, "Set the disposable seller password");

const runId = randomUUID();
const storefrontHeaders = { "x-publishable-api-key": key };

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...headers, ...(body && { "content-type": "application/json" }) },
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

async function expectStatus(path, options, status) {
  const result = await request(path, options);
  assert.equal(
    result.status,
    status,
    `${options?.method ?? "GET"} ${path}: ${result.data?.message ?? result.status}`,
  );
  return result.data;
}

async function authenticate(credentials, register = false) {
  const { token } = await expectStatus(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: credentials },
    200,
  );
  assert(token);
  return { authorization: `Bearer ${token}` };
}

const { sellers } = await expectStatus(
  "/store/sellers?fields=id,name",
  { headers: storefrontHeaders },
  200,
);
const store = sellers.find(({ name }) => name === "Sole Society");
assert(store?.id, "The seeded Sole Society store is required");
const ownerHeaders = {
  ...(await authenticate({ email: "seller@mercur.dev", password: seededPassword })),
  "x-seller-id": store.id,
};
const { seller_member: owner } = await expectStatus(
  "/vendor/members/me?fields=id,is_owner,permissions",
  { headers: ownerHeaders },
  200,
);
assert(owner.is_owner);
assert.equal(owner.permissions?.products, "manage");

const { products } = await expectStatus(
  "/vendor/products?limit=100&fields=id,title,variants.id,variants.title",
  { headers: ownerHeaders },
  200,
);
const product = products.find((candidate) => candidate.variants?.some((variant) => variant.id));
const variant = product?.variants?.find(({ id }) => id);
assert(product?.id && variant?.id, "A seeded seller product with a variant is required");

const membersPath = `/vendor/sellers/${store.id}/members`;
const actors = [];

async function createActor(slug, role) {
  const credentials = { email: `${slug}+${runId}@agestyles.example`, password: randomUUID() };
  const { member_invite: invite } = await expectStatus(
    membersPath,
    { method: "POST", headers: ownerHeaders, body: { email: credentials.email, role_id: role } },
    201,
  );
  assert(invite.token);
  await expectStatus(
    "/vendor/members/invites/accept",
    {
      method: "POST",
      headers: await authenticate(credentials, true),
      body: { invite_token: invite.token, first_name: "AgeStyles CI" },
    },
    200,
  );
  const headers = { ...(await authenticate(credentials)), "x-seller-id": store.id };
  const { seller_member: membership } = await expectStatus(
    "/vendor/members/me?fields=id,is_owner,permissions",
    { headers },
    200,
  );
  actors.push({ headers, membership });
  return headers;
}

try {
  const inventoryManagerHeaders = await createActor(
    "variant-inventory",
    SellerRole.INVENTORY_MANAGEMENT,
  );
  const readerHeaders = await createActor("variant-reader", SellerRole.SUPPORT);
  const path = `/vendor/products/${product.id}/variants/${variant.id}`;

  for (const [name, headers] of [
    ["inventory manager", inventoryManagerHeaders],
    ["read-only member", readerHeaders],
  ]) {
    const result = await request(path, { method: "DELETE", headers });
    assert.equal(result.status, 403, `${name} must not remove a product variant`);
    assert.equal(result.data?.code, "MISSING_PERMISSION");
  }

  const removal = await expectStatus(path, { method: "DELETE", headers: ownerHeaders }, 202);
  assert(removal.product_change?.id, "Owner removal must create a reviewable product change");
  console.log("PASS: only the store owner can request variant removal; CI data is disposable");
} finally {
  for (const actor of actors.reverse()) {
    await expectStatus(
      `${membersPath}/${actor.membership.id}`,
      {
        method: "DELETE",
        headers: ownerHeaders,
      },
      200,
    );
  }
}
