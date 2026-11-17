import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SellerRole } from "@mercurjs/types";

/**
 * AG-03 HTTP check on disposable CI data: inventory movement permissions,
 * stock rules, seller isolation, concurrency and CSV export. Restores the
 * stock it touched and removes the members it created.
 */

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const password = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
assert.equal(process.env.AGESTYLES_CI_DISPOSABLE, "true");
assert.equal(base, "http://127.0.0.1:19081");
assert(key?.startsWith("pk_"));
assert(password?.length >= 12);

const runId = randomUUID();
const actors = [];
const movementsPath = "/vendor/agestyles/inventory-movements";

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
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  return { status: response.status, data, text, headers: response.headers };
}

async function expectStatus(path, options, expected) {
  const result = await request(path, options);
  assert.equal(
    result.status,
    expected,
    `${options?.method ?? "GET"} ${path}: expected ${expected}, got ${result.status} ${result.text.slice(0, 200)}`,
  );
  return result;
}

async function authenticate(email, actorPassword, register = false) {
  const { data } = await expectStatus(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: { email, password: actorPassword } },
    200,
  );
  assert(data?.token);
  return { authorization: `Bearer ${data.token}` };
}

const { data: sellerPage } = await expectStatus("/store/sellers?fields=id,handle", {}, 200);
const sellerA = sellerPage.sellers.find(({ handle }) => handle === "agestyles-lab-a2");
const sellerB = sellerPage.sellers.find(({ handle }) => handle === "agestyles-lab-b2");
assert(sellerA?.id && sellerB?.id, "A2 and B2 seller fixtures are required");

const ownerA = {
  ...(await authenticate("seller@mercur.dev", password)),
  "x-seller-id": sellerA.id,
};
const ownerB = { ...(await authenticate("kickz@mercur.dev", password)), "x-seller-id": sellerB.id };
const membersPath = `/vendor/sellers/${sellerA.id}/members`;

async function createActor(name, roleId) {
  const credentials = {
    email: `${name}-${runId}@agestyles.example`,
    password: `${randomUUID()}Aa1!`,
  };
  const { data } = await expectStatus(
    membersPath,
    { method: "POST", headers: ownerA, body: { email: credentials.email, role_id: roleId } },
    201,
  );
  await expectStatus(
    "/vendor/members/invites/accept",
    {
      method: "POST",
      headers: await authenticate(credentials.email, credentials.password, true),
      body: { invite_token: data.member_invite.token, first_name: "CI movimientos" },
    },
    200,
  );
  const headers = {
    ...(await authenticate(credentials.email, credentials.password)),
    "x-seller-id": sellerA.id,
  };
  const { data: me } = await expectStatus(
    "/vendor/members/me?fields=id,permissions",
    { headers },
    200,
  );
  actors.push(me.seller_member);
  return { headers, membership: me.seller_member };
}

async function levelOf(itemId, locationId) {
  const { data } = await expectStatus(
    `/vendor/inventory-items?id=${itemId}&fields=id,location_levels.location_id,location_levels.stocked_quantity`,
    { headers: ownerA },
    200,
  );
  const inventoryItem = data.inventory_items.find((candidate) => candidate.id === itemId);
  const level = inventoryItem?.location_levels?.find((l) => l.location_id === locationId);
  assert(level, "inventory level must exist");
  return Number(level.stocked_quantity);
}

const { data: itemPage } = await expectStatus(
  "/vendor/inventory-items?limit=20&fields=id,sku,location_levels.location_id,location_levels.stocked_quantity",
  { headers: ownerA },
  200,
);
const item = itemPage.inventory_items.find((candidate) => candidate.location_levels?.length);
assert(item, "A2 needs an inventory item with a stock level");
const locationId = item.location_levels[0].location_id;
const original = await levelOf(item.id, locationId);
const move = (headers, body) =>
  request(movementsPath, {
    method: "POST",
    headers,
    body: { inventory_item_id: item.id, location_id: locationId, ...body },
  });

try {
  const manager = await createActor("movements-inventory", SellerRole.INVENTORY_MANAGEMENT);
  const reader = await createActor("movements-reader", SellerRole.SUPPORT);
  assert.equal(manager.membership.permissions?.inventory_items, "edit");

  // Read-only members can read and export, not write.
  await expectStatus(movementsPath, { headers: reader.headers }, 200);
  assert.equal((await move(reader.headers, { type: "alta", quantity: 1 })).status, 403);

  // Rules.
  assert.equal(
    (await move(manager.headers, { type: "ajuste", quantity: original + 1 })).status,
    400,
  );
  assert.equal(
    (await move(manager.headers, { type: "ajuste", quantity: original, reason: "Conteo CI" }))
      .status,
    400,
    "an adjustment to the current stock is rejected",
  );
  assert.equal((await move(manager.headers, { type: "baja", quantity: original + 1 })).status, 400);

  // Entry and exit change the stock and record before/after.
  const entry = await move(manager.headers, { type: "alta", quantity: 2, reason: "Compra CI" });
  assert.equal(entry.status, 201, entry.text);
  assert.equal(entry.data.inventory_movement.quantity_before, original);
  assert.equal(entry.data.inventory_movement.quantity_after, original + 2);
  assert.equal(
    entry.data.inventory_movement.actor_email,
    `movements-inventory-${runId}@agestyles.example`,
  );
  assert.equal(await levelOf(item.id, locationId), original + 2);

  // Another seller can neither move nor see A2 stock.
  assert.equal((await move(ownerB, { type: "baja", quantity: 1 })).status, 404);
  const { data: foreign } = await expectStatus(
    `${movementsPath}?inventory_item_id=${item.id}`,
    { headers: ownerB },
    200,
  );
  assert.equal(foreign.count, 0, "B2 must not list A2 movements");

  // Concurrent entries are serialised: final stock and history chain agree.
  const concurrent = await Promise.all(
    Array.from({ length: 5 }, () => move(manager.headers, { type: "alta", quantity: 1 })),
  );
  assert.deepEqual(
    concurrent.map((result) => result.status),
    [201, 201, 201, 201, 201],
  );
  assert.equal(await levelOf(item.id, locationId), original + 7);
  const { data: history } = await expectStatus(
    `${movementsPath}?inventory_item_id=${item.id}&limit=10`,
    { headers: reader.headers },
    200,
  );
  const chain = [...history.inventory_movements].reverse();
  for (let index = 1; index < chain.length; index += 1) {
    assert.equal(
      chain[index].quantity_before,
      chain[index - 1].quantity_after,
      "history chain is continuous",
    );
  }

  // Quick adjustment back to the original count, with reason.
  const restore = await move(manager.headers, {
    type: "ajuste",
    quantity: original,
    reason: "Restauración CI",
  });
  assert.equal(restore.status, 201, restore.text);
  assert.equal(await levelOf(item.id, locationId), original);

  // CSV export for spreadsheets. Read raw bytes: Response.text() strips the
  // UTF-8 BOM that Excel needs, so it must be checked before decoding.
  const csvResponse = await fetch(`${base}${movementsPath}/export?type=ajuste`, {
    headers: { "x-publishable-api-key": key, ...reader.headers },
  });
  assert.equal(csvResponse.status, 200, "CSV export must succeed for read-only members");
  assert.match(csvResponse.headers.get("content-type") ?? "", /text\/csv/);
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "CSV starts with a UTF-8 BOM");
  const csvText = new TextDecoder("utf-8", { ignoreBOM: true }).decode(csvBytes.slice(3));
  assert.ok(csvText.startsWith("Fecha (UTC);Tipo;Producto"));
  assert.match(csvText, /Restauración CI/);

  console.log(
    "PASS: inventory movements enforce roles, stock rules and seller isolation; concurrency, history and CSV are consistent",
  );
} finally {
  const current = await levelOf(item.id, locationId).catch(() => original);
  if (current !== original) {
    await move(ownerA, {
      type: "ajuste",
      quantity: original,
      reason: "Restauración CI (limpieza)",
    });
  }
  for (const membership of actors) {
    await expectStatus(
      `${membersPath}/${membership.id}`,
      { method: "DELETE", headers: ownerA },
      200,
    );
  }
}
