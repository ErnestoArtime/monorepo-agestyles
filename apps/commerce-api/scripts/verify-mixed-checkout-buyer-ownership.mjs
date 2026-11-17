import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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
const database = new URL(process.env.DATABASE_URL ?? "");
assert.equal(
  database.hostname,
  "127.0.0.1",
  "Checkout writes are restricted to disposable loopback PostgreSQL",
);
assert.equal(
  database.port,
  "15472",
  "Checkout writes are restricted to disposable PostgreSQL port 15472",
);
assert.equal(
  database.pathname,
  "/agestyles_mercur_lab",
  "Checkout writes are restricted to the disposable Mercur database",
);

const runId = randomUUID();
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
  return expectStatus(
    "/auth/customer/emailpass",
    { method: "POST", body: { email, password } },
    [200],
  ).then(({ token }) => token);
};

async function request(
  path,
  { method = "GET", token, body, idempotencyKey, headers: extraHeaders = {} } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...extraHeaders,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
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

const ownerToken = await makeCustomer("checkout-owner");
const otherToken = await makeCustomer("checkout-other");
const { regions } = await expectStatus("/store/regions", {}, 200);
const region = regions.find(({ currency_code }) => currency_code === "eur");
assert(region?.id, "The seeded EUR region is required");
const { sellers } = await expectStatus("/store/sellers?fields=id,handle", {}, 200);
const sellerA = sellers.find(({ handle }) => handle === "agestyles-lab-a2");
const sellerB = sellers.find(({ handle }) => handle === "agestyles-lab-b2");
assert(
  sellerA?.id && sellerB?.id && sellerA.id !== sellerB.id,
  "Two distinct seeded sellers are required",
);

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
  {
    method: "POST",
    token: ownerToken,
    body: { region_id: region.id },
  },
  200,
);
for (const offer of [offerA, offerB]) {
  await expectStatus(
    `/store/carts/${cart.id}/line-items?fields=%2Bitems.*`,
    {
      method: "POST",
      token: ownerToken,
      body: { offer_id: offer.id, quantity: 1 },
    },
    200,
  );
}
await expectStatus(
  `/store/carts/${cart.id}`,
  {
    method: "POST",
    token: ownerToken,
    body: {
      email: `checkout-owner-${runId}@agestyles.example`,
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
  { token: ownerToken },
  200,
);
for (const seller of [sellerA, sellerB]) {
  const option = shippingBySeller[seller.id]?.[0];
  assert(option?.id, `A shipping option for ${seller.id} is required`);
  await expectStatus(
    `/store/carts/${cart.id}/shipping-methods`,
    {
      method: "POST",
      token: ownerToken,
      body: { option_id: option.id },
    },
    200,
  );
}
const { payment_collection: collection } = await expectStatus(
  "/store/payment-collections",
  {
    method: "POST",
    token: ownerToken,
    body: { cart_id: cart.id },
  },
  200,
);
await expectStatus(
  `/store/payment-collections/${collection.id}/payment-sessions`,
  {
    method: "POST",
    token: ownerToken,
    body: { provider_id: "pp_system_default" },
  },
  200,
);
const idempotencyKey = randomUUID();
const { quote } = await expectStatus(
  "/store/order-quotes",
  {
    method: "POST",
    token: ownerToken,
    idempotencyKey,
    body: { cart_id: cart.id },
  },
  201,
);
assert.deepEqual(
  [...quote.seller_ids].sort(),
  [sellerA.id, sellerB.id].sort(),
  "The quote must include both sellers",
);
const { order_group_id: groupId, orders } = await expectStatus(
  `/store/order-quotes/${quote.id}/accept`,
  {
    method: "POST",
    token: ownerToken,
    idempotencyKey: randomUUID(),
    body: { revision: quote.revision },
  },
  200,
);
assert(
  groupId && orders?.length === 2,
  "Mixed checkout must create one group with two seller orders",
);
assert.deepEqual(orders.map(({ seller_id }) => seller_id).sort(), [sellerA.id, sellerB.id].sort());

const ownedTracking = await expectStatus(
  `/store/orders/${orders[0].id}/tracking`,
  { token: ownerToken },
  200,
);
assert(
  ownedTracking.tracking?.order_id === orders[0].id,
  "The buyer must be able to read tracking for their order",
);
const foreignTracking = await request(`/store/orders/${orders[0].id}/tracking`, {
  token: otherToken,
});
assert.equal(
  foreignTracking.status,
  404,
  "A different buyer must receive the same not-found response",
);
assert.equal(
  foreignTracking.data?.tracking,
  undefined,
  "A different buyer must not receive any order tracking data",
);

const sellerOrder = orders.find(({ seller_id }) => seller_id === sellerA.id);
assert(sellerOrder?.id, "The mixed checkout must include the A2 seller order");
const { token: sellerToken } = await expectStatus(
  "/auth/member/emailpass",
  {
    method: "POST",
    body: { email: "seller@mercur.dev", password: seededPassword },
  },
  200,
);
const sellerHeaders = {
  authorization: `Bearer ${sellerToken}`,
  "x-seller-id": sellerA.id,
};
const { stock_locations: stockLocations } = await expectStatus(
  "/vendor/stock-locations?limit=50&fields=id,name",
  { headers: { ...sellerHeaders, "x-publishable-api-key": key } },
  200,
);
assert(stockLocations?.[0]?.id, "The A2 seller needs a stock location");
const { order: sellerOrderDetail } = await expectStatus(
  `/vendor/orders/${sellerOrder.id}?fields=id,status,items.id,items.quantity,fulfillments.canceled_at,fulfillments.items.line_item_id,fulfillments.items.quantity`,
  { headers: { ...sellerHeaders, "x-publishable-api-key": key } },
  200,
);
const fulfillmentItems = (sellerOrderDetail?.items ?? []).map(({ id, quantity }) => ({
  id,
  quantity,
}));
assert(fulfillmentItems.length, "The A2 seller order needs at least one line item");
const fulfillmentPath = `/vendor/agestyles/orders/${sellerOrder.id}/fulfillments`;
const fulfillmentResult = await expectStatus(
  fulfillmentPath,
  {
    method: "POST",
    headers: { ...sellerHeaders, "x-publishable-api-key": key },
    body: { location_id: stockLocations[0].id, items: fulfillmentItems },
  },
  201,
);
assert(fulfillmentResult?.fulfillment?.id, "The owner must create a fulfillment");
const { token: otherSellerToken } = await expectStatus(
  "/auth/member/emailpass",
  {
    method: "POST",
    body: { email: "kickz@mercur.dev", password: seededPassword },
  },
  200,
);
const otherSellerHeaders = {
  authorization: `Bearer ${otherSellerToken}`,
  "x-seller-id": sellerB.id,
};
const { stock_locations: otherSellerLocations } = await expectStatus(
  "/vendor/stock-locations?limit=50&fields=id,name",
  { headers: otherSellerHeaders },
  200,
);
assert(otherSellerLocations?.[0]?.id, "The B2 seller needs a stock location");
const foreignLocationFulfillment = await request(fulfillmentPath, {
  method: "POST",
  headers: sellerHeaders,
  body: { location_id: otherSellerLocations[0].id, items: fulfillmentItems },
});
assert.equal(
  foreignLocationFulfillment.status,
  404,
  "A seller must not use another seller's stock location",
);
await expectStatus(
  fulfillmentPath,
  {
    method: "POST",
    headers: { ...sellerHeaders, "x-publishable-api-key": key },
    body: { location_id: stockLocations[0].id, items: fulfillmentItems },
  },
  400,
);
const foreignSellerFulfillment = await request(
  `/vendor/agestyles/orders/${sellerOrder.id}/fulfillments`,
  {
    method: "POST",
    headers: {
      ...sellerHeaders,
      "x-seller-id": sellerB.id,
      "x-publishable-api-key": key,
    },
    body: { location_id: stockLocations[0].id, items: fulfillmentItems },
  },
);
assert.equal(foreignSellerFulfillment.status, 403, "Another seller must not fulfill this order");

console.log(
  "PASS: two-seller checkout creates isolated child orders; buyer tracking is owned; seller fulfillment is location-scoped and cannot be repeated",
);
