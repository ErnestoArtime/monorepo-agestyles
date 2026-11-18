import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SellerRole } from "@mercurjs/types";

/**
 * AG-06 HTTP check on disposable CI data: sales agents, commission rules
 * (product over store, cumulative threshold), agent sales that move stock,
 * balance, withdrawals (never above the balance, also under concurrency),
 * owner confirmation, role and store isolation. Restores the stock it used.
 */

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const password = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
assert.equal(process.env.AGESTYLES_CI_DISPOSABLE, "true");
assert.equal(base, "http://127.0.0.1:19081");
assert(key?.startsWith("pk_"));
assert(password?.length >= 12);

// Surface any failure, including fixture setup, as a GitHub annotation; job logs need authentication.
function annotate(error) {
  console.log(
    `::error title=verify-sales-commissions::${String(error?.message ?? error).replace(/\n/g, " ")}`,
  );
  process.exit(1);
}
process.on("uncaughtException", annotate);
process.on("unhandledRejection", annotate);

const runId = randomUUID();
const shortId = runId.replace(/-/g, "").slice(0, 6).toUpperCase();
const created = { members: [], rules: [] };

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
  return { status: response.status, data, text };
}

async function expectStatus(path, options, expected) {
  const result = await request(path, options);
  assert.equal(
    result.status,
    expected,
    `${options?.method ?? "GET"} ${path}: expected ${expected}, got ${result.status} ${result.text.slice(0, 200)}`,
  );
  return result.data;
}

async function authenticate(email, actorPassword, register = false) {
  const data = await expectStatus(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: { email, password: actorPassword } },
    200,
  );
  return { authorization: `Bearer ${data.token}` };
}

const { sellers } = await expectStatus("/store/sellers?fields=id,handle", {}, 200);
const sellerA = sellers.find(({ handle }) => handle === "agestyles-lab-a2");
const sellerB = sellers.find(({ handle }) => handle === "agestyles-lab-b2");
assert(sellerA?.id && sellerB?.id, "A2 and B2 seller fixtures are required");
const ownerA = {
  ...(await authenticate("seller@mercur.dev", password)),
  "x-seller-id": sellerA.id,
};
const ownerB = { ...(await authenticate("kickz@mercur.dev", password)), "x-seller-id": sellerB.id };
const membersPath = `/vendor/sellers/${sellerA.id}/members`;

async function createMember(name) {
  const credentials = {
    email: `${name}-${runId}@agestyles.example`,
    password: `${randomUUID()}Aa1!`,
  };
  const { member_invite: invite } = await expectStatus(
    membersPath,
    {
      method: "POST",
      headers: ownerA,
      body: { email: credentials.email, role_id: SellerRole.SUPPORT },
    },
    201,
  );
  await expectStatus(
    "/vendor/members/invites/accept",
    {
      method: "POST",
      headers: await authenticate(credentials.email, credentials.password, true),
      body: { invite_token: invite.token, first_name: "CI comisiones" },
    },
    200,
  );
  const headers = {
    ...(await authenticate(credentials.email, credentials.password)),
    "x-seller-id": sellerA.id,
  };
  const { seller_member: membership } = await expectStatus(
    "/vendor/members/me?fields=id,member_id",
    { headers },
    200,
  );
  created.members.push(membership.id);
  return { headers, membership };
}

// Fixture: the seeded A2 offer with stock at an A2 location (same fixture as the checkout verifiers).
const { regions } = await expectStatus("/store/regions?fields=id,currency_code", {}, 200);
const region = regions.find((candidate) => candidate.currency_code === "eur") ?? regions[0];
const offerQuery = new URLSearchParams({
  region_id: region.id,
  seller_id: sellerA.id,
  limit: "100",
  fields: "+in_stock,+calculated_price",
});
const { offers } = await expectStatus(`/store/offers?${offerQuery}`, {}, 200);
const offer =
  offers.find((candidate) => candidate.sku === "AGESTYLES-LAB-A2-COMMON-01") ??
  offers.find((candidate) => candidate.in_stock);
assert(offer, "A2 needs an offer");
const { stock_locations: locations } = await expectStatus(
  "/vendor/stock-locations?limit=10&fields=id",
  { headers: ownerA },
  200,
);
const locationId = locations[0].id;
const { inventory_items: items } = await expectStatus(
  `/vendor/inventory-items?limit=100&fields=id,sku,location_levels.location_id,location_levels.stocked_quantity`,
  { headers: ownerA },
  200,
);
const item = items.find((candidate) => candidate.sku === offer.sku);
assert(item, "the offer's inventory item is required");
const stockOf = async () => {
  const { inventory_items } = await expectStatus(
    `/vendor/inventory-items?id=${item.id}&fields=id,location_levels.location_id,location_levels.stocked_quantity`,
    { headers: ownerA },
    200,
  );
  return Number(
    inventory_items[0].location_levels.find((level) => level.location_id === locationId)
      .stocked_quantity,
  );
};
const originalStock = await stockOf();
assert(originalStock >= 3, "the fixture needs at least 3 units");

try {
  const agent = await createMember("agent");
  const colleague = await createMember("colleague");

  // Only managers create agents and rules.
  await expectStatus(
    "/vendor/agestyles/sales-agents",
    {
      method: "POST",
      headers: colleague.headers,
      body: { member_id: colleague.membership.member_id, code: "NOPE1" },
    },
    403,
  );
  const { sales_agent: salesAgent } = await expectStatus(
    "/vendor/agestyles/sales-agents",
    {
      method: "POST",
      headers: ownerA,
      body: { member_id: agent.membership.member_id, code: `CI${shortId}` },
    },
    201,
  );
  await expectStatus(
    "/vendor/agestyles/sales-agents",
    {
      method: "POST",
      headers: ownerA,
      body: { member_id: colleague.membership.member_id, code: `CI${shortId}` },
    },
    400,
  );
  for (const body of [
    { kind: "percent", value: 10 },
    { product_id: offer.product_id, kind: "fixed", value: 3, unit_threshold: 2 },
  ]) {
    const { commission_rule: rule } = await expectStatus(
      "/vendor/agestyles/commission-rules",
      { method: "POST", headers: ownerA, body },
      201,
    );
    created.rules.push(rule.id);
  }
  await expectStatus(
    "/vendor/agestyles/commission-rules",
    { method: "POST", headers: agent.headers, body: { kind: "percent", value: 50 } },
    403,
  );

  // Agent sales: the product rule (fixed 3 every 2 units) wins over the 10 % store rule.
  const sale = (quantity) =>
    request("/vendor/agestyles/agent-sales", {
      method: "POST",
      headers: agent.headers,
      body: {
        location_id: locationId,
        payment_method: "cash",
        lines: [{ offer_id: offer.id, quantity, unit_price: 49 }],
      },
    });
  assert.equal((await sale(1)).data?.commission, 0, "threshold not reached after 1 unit");
  const second = await sale(1);
  assert.equal(second.status, 201, second.text);
  assert.equal(second.data.commission, 3, "threshold of 2 units completed");
  assert.equal(await stockOf(), originalStock - 2, "agent sales move stock");
  assert.equal((await sale(originalStock)).status, 400, "cannot sell more than the stock");
  assert.equal(
    (
      await request("/vendor/agestyles/agent-sales", {
        method: "POST",
        headers: colleague.headers,
        body: {
          location_id: locationId,
          payment_method: "cash",
          lines: [{ offer_id: offer.id, quantity: 1, unit_price: 1 }],
        },
      })
    ).status,
    403,
    "members who are not agents cannot register sales",
  );

  // Balance and withdrawals.
  let balance = await expectStatus(
    "/vendor/agestyles/commissions/balance",
    { headers: agent.headers },
    200,
  );
  assert.equal(balance.balance, 3);
  await expectStatus("/vendor/agestyles/commissions/balance", { headers: colleague.headers }, 403);
  await expectStatus(
    "/vendor/agestyles/commission-withdrawals",
    { method: "POST", headers: agent.headers, body: { amount: 5 } },
    400,
  );
  const { commission_withdrawal: withdrawal } = await expectStatus(
    "/vendor/agestyles/commission-withdrawals",
    { method: "POST", headers: agent.headers, body: { amount: 2 } },
    201,
  );
  const concurrent = await Promise.all(
    Array.from({ length: 3 }, () =>
      request("/vendor/agestyles/commission-withdrawals", {
        method: "POST",
        headers: agent.headers,
        body: { amount: 1 },
      }),
    ),
  );
  assert.equal(
    concurrent.filter((result) => result.status === 201).length,
    1,
    "only one of three concurrent requests fits the remaining balance",
  );

  // Confirmation: only the owner of this store.
  const confirmPath = `/vendor/agestyles/commission-withdrawals/${withdrawal.id}`;
  await expectStatus(
    confirmPath,
    { method: "POST", headers: agent.headers, body: { status: "paid" } },
    403,
  );
  await expectStatus(
    confirmPath,
    { method: "POST", headers: ownerB, body: { status: "paid" } },
    404,
  );
  await expectStatus(
    confirmPath,
    { method: "POST", headers: ownerA, body: { status: "paid" } },
    200,
  );
  await expectStatus(
    confirmPath,
    { method: "POST", headers: ownerA, body: { status: "paid" } },
    400,
  );
  balance = await expectStatus(
    `/vendor/agestyles/commissions/balance?agent_id=${salesAgent.id}`,
    { headers: ownerA },
    200,
  );
  assert.equal(balance.balance, 1, "a paid withdrawal debits the balance");
  assert.equal(balance.available, 0, "the pending request of 1 is reserved");

  // Another store sees none of this.
  const { agent_sales: foreignSales } = await expectStatus(
    "/vendor/agestyles/agent-sales",
    { headers: ownerB },
    200,
  );
  assert.equal(foreignSales.length, 0, "B2 must not list A2 sales");

  // Phase 3 reports: managers only, scoped to the store, CSV for spreadsheets.
  const today = new Date().toISOString().slice(0, 10);
  const { report } = await expectStatus(
    `/vendor/agestyles/commissions/report?from=${today}&to=${today}`,
    { headers: ownerA },
    200,
  );
  assert.ok(report.totals.count >= 1, "the report counts today's sales");
  assert.ok(report.products.length >= 1, "the report ranks products");
  assert.ok(
    report.agents.some((row) => row.agent_id === salesAgent.id),
    "the report ranks the agent",
  );
  await expectStatus("/vendor/agestyles/commissions/report", { headers: agent.headers }, 403);
  const { report: foreignReport } = await expectStatus(
    "/vendor/agestyles/commissions/report",
    { headers: ownerB },
    200,
  );
  assert.equal(foreignReport.totals.count, 0, "B2 must not see A2 sales in reports");
  const csv = await request(`/vendor/agestyles/agent-sales/export?from=${today}`, {
    headers: ownerA,
  });
  assert.equal(csv.status, 200, `CSV export: ${csv.status}`);
  assert.ok(csv.text.includes("Fecha (UTC);Venta;Gestor"), "CSV header in Spanish");
  await expectStatus("/vendor/agestyles/agent-sales/export", { headers: agent.headers }, 403);
  const { agent_sales: cashSales } = await expectStatus(
    "/vendor/agestyles/agent-sales?payment_method=transfer",
    { headers: ownerA },
    200,
  );
  assert.ok(
    cashSales.every((sale) => sale.payment_method === "transfer"),
    "payment_method filter applies",
  );

  console.log(
    "PASS: sales agents and commissions enforce roles and store isolation; thresholds, stock, balance and withdrawals are consistent",
  );
} catch (error) {
  // Surface the failing check as a GitHub annotation; job logs need authentication.
  console.log(
    `::error title=verify-sales-commissions::${String(error?.message ?? error).replace(/\n/g, " ")}`,
  );
  throw error;
} finally {
  const current = await stockOf().catch(() => originalStock);
  if (current !== originalStock) {
    await request("/vendor/agestyles/inventory-movements", {
      method: "POST",
      headers: ownerA,
      body: {
        inventory_item_id: item.id,
        location_id: locationId,
        type: "ajuste",
        quantity: originalStock,
        reason: "Restauración CI comisiones",
      },
    });
  }
  for (const id of created.rules) {
    await request(`/vendor/agestyles/commission-rules/${id}`, {
      method: "DELETE",
      headers: ownerA,
    });
  }
  for (const id of created.members) {
    await request(`${membersPath}/${id}`, { method: "DELETE", headers: ownerA });
  }
}
