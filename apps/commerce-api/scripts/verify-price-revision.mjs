// Manual, reversible laboratory probe. Run from the repository root only after
// loading apps/commerce-api/.env in a private shell with these variable names:
//   EXPO_PUBLIC_MEDUSA_URL, EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY,
//   DATABASE_URL, AGESTYLES_LAB_PRICE_SELLER_EMAIL,
//   AGESTYLES_LAB_SEEDED_PASSWORD, DUAL_AUTH_LAB_EMAIL, DUAL_AUTH_LAB_PASSWORD
//   node apps/commerce-api/scripts/verify-price-revision.mjs
// This script is intentionally not wired into package.json and must not be run
// against a shared or production environment.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.EXPO_PUBLIC_MEDUSA_URL;
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;
const sellerPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD;
const sellerEmail = process.env.AGESTYLES_LAB_PRICE_SELLER_EMAIL;
const buyerEmail = process.env.DUAL_AUTH_LAB_EMAIL;
const buyerPassword = process.env.DUAL_AUTH_LAB_PASSWORD;

assert.equal(base, "http://127.0.0.1:19081", "Only the isolated API at 127.0.0.1:19081 is allowed");
assert(publishableKey?.startsWith("pk_"), "Set the laboratory publishable API key");
assert(sellerEmail?.endsWith("@mercur.dev"), "Set the synthetic AGESTYLES_LAB_PRICE_SELLER_EMAIL");
assert(
  sellerPassword?.length >= 12,
  "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file",
);
assert(
  buyerEmail?.endsWith("@agestyles.example"),
  "Set the existing synthetic DUAL_AUTH_LAB_EMAIL",
);
assert(buyerPassword?.length >= 12, "Set the existing synthetic DUAL_AUTH_LAB_PASSWORD");

function assertLaboratoryTarget() {
  assert.equal(
    process.env.EXPO_PUBLIC_MEDUSA_URL,
    "http://127.0.0.1:19081",
    "API writes are restricted to loopback 19081",
  );
  const rawDatabaseUrl = process.env.DATABASE_URL;
  assert(rawDatabaseUrl, "Load the commerce-api .env before laboratory writes");
  const database = new URL(rawDatabaseUrl);
  assert.equal(
    database.hostname,
    "127.0.0.1",
    "Database writes are restricted to loopback PostgreSQL",
  );
  assert.equal(database.port, "15472", "Database writes are restricted to laboratory port 15472");
  assert.equal(
    database.pathname,
    "/agestyles_mercur_lab",
    "Database writes are restricted to the Mercur laboratory database",
  );
}

async function request(path, { method = "GET", token, sellerId, body, idempotencyKey } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": publishableKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(sellerId ? { "x-seller-id": sellerId } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

function expect(result, status, label) {
  assert.equal(
    result.status,
    status,
    `${label}: ${result.data.message ?? result.data.code ?? result.status}`,
  );
  return result.data;
}

async function authenticate(actor, email, password) {
  const path = actor === "seller" ? "/auth/member/emailpass" : "/auth/customer/emailpass";
  const data = expect(
    await request(path, { method: "POST", body: { email, password } }),
    200,
    `Authenticate ${actor}`,
  );
  assert(data.token, `${actor} session token is required`);
  return data.token;
}

assertLaboratoryTarget();
const sellerToken = await authenticate("seller", sellerEmail, sellerPassword);
const { sellers } = expect(
  await request("/store/sellers?fields=id,handle,name"),
  200,
  "List public sellers",
);
const seller = sellers.find(({ handle }) => handle === "agestyles-lab-a2");
assert(seller?.id, "The synthetic A2 seller membership is required");

const { regions: sellerRegions } = expect(
  await request("/vendor/regions?limit=100", {
    token: sellerToken,
    sellerId: seller.id,
  }),
  200,
  "Read A2 seller regions",
);
if (!sellerRegions.some(({ currency_code }) => currency_code?.toLowerCase() === "eur")) {
  console.log(
    JSON.stringify({
      status: "unsupported",
      reason: "A2 has no EUR seller region; no cart, quote, or price write was attempted",
    }),
  );
  process.exit(0);
}

const { regions } = expect(await request("/store/regions"), 200, "List public regions");
const region = regions.find(({ currency_code }) => currency_code?.toLowerCase() === "eur");
assert(region?.id, "An EUR Store API region is required when A2 has EUR enabled");
const offerQuery = new URLSearchParams({
  region_id: region.id,
  seller_id: seller.id,
  limit: "100",
  fields: "+in_stock,+calculated_price,*seller",
});
const { offers } = expect(await request(`/store/offers?${offerQuery}`), 200, "Read A2 offers");
const offer = offers.find(({ sku, in_stock }) => sku === "AGESTYLES-LAB-A2-COMMON-01" && in_stock);
assert(offer?.id, "The synthetic in-stock A2 offer is required");
const { offer: originalOffer } = expect(
  await request(`/vendor/offers/${offer.id}`, {
    token: sellerToken,
    sellerId: seller.id,
  }),
  200,
  "Read the A2 price ladder",
);
const originalRows = originalOffer.prices ?? [];
assert(originalRows.length > 0, "The A2 offer must have a restorable price ladder");

const toPriceInput = (price, amount = Number(price.amount)) => ({
  id: price.id,
  amount,
  currency_code: price.currency_code,
  ...(price.min_quantity != null ? { min_quantity: price.min_quantity } : {}),
  ...(price.max_quantity != null ? { max_quantity: price.max_quantity } : {}),
  rules: Object.fromEntries(
    (price.price_rules ?? []).map(({ attribute, value }) => [attribute, value]),
  ),
});
const originalPrices = originalRows.map((price) => toPriceInput(price));
const buyerToken = await authenticate("buyer", buyerEmail, buyerPassword);

assertLaboratoryTarget();
const { cart } = expect(
  await request("/store/carts", {
    method: "POST",
    token: buyerToken,
    body: { region_id: region.id },
  }),
  200,
  "Create isolated price-probe cart",
);
assert(cart?.id, "The price-probe cart id is required");
assertLaboratoryTarget();
expect(
  await request(`/store/carts/${cart.id}/line-items?fields=%2Bitems.*`, {
    method: "POST",
    token: buyerToken,
    body: { offer_id: offer.id, quantity: 1 },
  }),
  200,
  "Add the A2 offer to the probe cart",
);
assertLaboratoryTarget();
const idempotencyKey = randomUUID();
const { quote } = expect(
  await request("/store/order-quotes", {
    method: "POST",
    token: buyerToken,
    idempotencyKey,
    body: { cart_id: cart.id },
  }),
  201,
  "Create the initial A2 quote",
);
assert(
  quote?.id && quote.revision === 1 && quote.status === "quoted",
  "The initial quote must be reviewable",
);

const changedPrices = originalRows.map((price) => toPriceInput(price, Number(price.amount) + 1));
let restoreRequired = false;
let probeError;
try {
  assertLaboratoryTarget();
  restoreRequired = true;
  expect(
    await request(`/vendor/offers/${offer.id}`, {
      method: "POST",
      token: sellerToken,
      sellerId: seller.id,
      body: { prices: changedPrices },
    }),
    200,
    "Temporarily increase the A2 offer price",
  );
  assertLaboratoryTarget();
  const acceptance = await request(`/store/order-quotes/${quote.id}/accept`, {
    method: "POST",
    token: buyerToken,
    body: { revision: quote.revision },
  });
  assert.equal(acceptance.status, 409, "A changed price must require buyer review");
  assert.equal(acceptance.data.status, "requoted");
  assert.equal(acceptance.data.quote?.revision, quote.revision + 1);
  assert.equal(acceptance.data.quote?.status, "quoted");
  assert.equal(acceptance.data.quote?.order_group_id, null);
} catch (error) {
  probeError = error;
} finally {
  if (restoreRequired) {
    assertLaboratoryTarget();
    expect(
      await request(`/vendor/offers/${offer.id}`, {
        method: "POST",
        token: sellerToken,
        sellerId: seller.id,
        body: { prices: originalPrices },
      }),
      200,
      "Restore the exact A2 price ladder",
    );
  }
}

const { offer: restoredOffer } = expect(
  await request(`/vendor/offers/${offer.id}`, {
    token: sellerToken,
    sellerId: seller.id,
  }),
  200,
  "Read the restored A2 price ladder",
);
assert.deepEqual(
  (restoredOffer.prices ?? []).map((price) => toPriceInput(price)),
  originalPrices,
  "Every original price field must be restored",
);
if (probeError) throw probeError;

console.log(
  JSON.stringify({
    status: "verified",
    seller: "agestyles-lab-a2",
    quoteRevision: quote.revision,
    repricedRevision: quote.revision + 1,
    priceLadderRestored: true,
  }),
);
