import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD
assert(seededPassword?.length >= 12, "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file")
const email = process.env.DUAL_AUTH_LAB_EMAIL ?? `quote-${randomUUID()}@agestyles.example`
const password = process.env.DUAL_AUTH_LAB_PASSWORD ?? `${randomUUID()}Aa1!`
assert.equal(base, "http://127.0.0.1:19081", "Only the isolated 19081 lab is allowed")
assert(key?.startsWith("pk_"), "Set the lab publishable API key")
assert(email?.endsWith("@agestyles.example"), "Set a disposable @agestyles.example buyer")
assert(password?.length >= 12, "Set the disposable lab password")

async function request(path, { method = "GET", token, sellerId, body, idempotencyKey } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(sellerId ? { "x-seller-id": sellerId } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, headers: response.headers, data: await response.json().catch(() => ({})) }
}
function expect(result, status, label) {
  assert.equal(result.status, status, `${label}: ${result.data.message ?? result.data.code ?? result.status}`)
  return result.data
}

function assertLabDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  assert(databaseUrl, "Load the commerce-api .env before running reversible fixture mutations")
  const parsed = new URL(databaseUrl)
  assert.equal(parsed.hostname, "127.0.0.1", "Fixture writes are restricted to loopback PostgreSQL")
  assert.equal(parsed.port, "15472", "Fixture writes are restricted to lab PostgreSQL port 15472")
  assert.equal(parsed.pathname, "/agestyles_mercur_lab", "Fixture writes are restricted to the Mercur lab database")
  assert.equal(base, "http://127.0.0.1:19081", "Fixture writes are restricted to API 19081")
}

async function authenticateSeller(memberEmail) {
  return expect(await request("/auth/member/emailpass", {
    method: "POST", body: { email: memberEmail, password: seededPassword },
  }), 200, `Authenticate seller ${memberEmail}`).token
}

async function addOfferToNewCart(offerId, label) {
  const { cart } = expect(await request("/store/carts", { method: "POST", token, body: { region_id: region.id } }), 200, `Create ${label} cart`)
  expect(await request(`/store/carts/${cart.id}/line-items?fields=%2Bitems.*`, { method: "POST", token, body: { offer_id: offerId, quantity: 1 } }), 200, `Add ${label} offer`)
  return cart.id
}

async function prepareSingleSellerCheckout(cartId, sellerId, label) {
  expect(await request(`/store/carts/${cartId}`, {
    method: "POST", token,
    body: { email, shipping_address: { first_name: "Quote", last_name: "Lab", address_1: "Calle de prueba 1", city: "Madrid", postal_code: "28001", country_code: "es", phone: "+34000000000" } },
  }), 200, `Set ${label} address`)
  const { shipping_options } = expect(await request(`/store/shipping-options?cart_id=${cartId}`, { token }), 200, `List ${label} shipping`)
  const option = shipping_options[sellerId]?.[0]
  assert(option?.id, `${label} seller shipping option is required`)
  expect(await request(`/store/carts/${cartId}/shipping-methods`, { method: "POST", token, body: { option_id: option.id } }), 200, `Select ${label} shipping`)
  const { payment_collection: collection } = expect(await request("/store/payment-collections", { method: "POST", token, body: { cart_id: cartId } }), 200, `Create ${label} payment collection`)
  expect(await request(`/store/payment-collections/${collection.id}/payment-sessions`, { method: "POST", token, body: { provider_id: "pp_system_default" } }), 200, `Initialize ${label} lab payment`)
}

const registration = await request("/auth/customer/emailpass/register", {
  method: "POST", body: { email, password },
})
if ([200, 201].includes(registration.status)) {
  const createdCustomer = await request("/store/customers", {
    method: "POST", token: registration.data.token,
    body: { email, first_name: "Quote", last_name: "Lab" },
  })
  assert([200, 201].includes(createdCustomer.status), `Create buyer profile: ${createdCustomer.data.message ?? createdCustomer.status}`)
} else {
  assert.equal(registration.status, 401)
  assert.match(registration.data.message ?? "", /Identity with email already exists/)
}
const login = expect(await request("/auth/customer/emailpass", {
  method: "POST", body: { email, password },
}), 200, "Authenticate buyer")
const token = login.token
assert(token)

const { regions } = expect(await request("/store/regions"), 200, "List lab regions")
const region = regions.find((value) => value.currency_code === "eur")
assert(region?.id)
const { sellers } = expect(await request("/store/sellers?fields=id,handle,name"), 200, "List sellers")
const seller = sellers.find(({ handle }) => handle === "agestyles-lab-a2")
assert(seller?.id, "A2 lab seller is required")
const query = new URLSearchParams({ region_id: region.id, seller_id: seller.id, limit: "100", fields: "+in_stock,+calculated_price,*seller" })
const { offers } = expect(await request(`/store/offers?${query}`), 200, "List seller offers")
const offer = offers.find(({ sku, in_stock }) => sku === "AGESTYLES-LAB-A2-COMMON-01" && in_stock)
assert(offer?.id, "A2 lab SKU with available inventory is required")
const b2 = sellers.find(({ handle }) => handle === "agestyles-lab-b2")
assert(b2?.id, "B2 lab seller is required")
const b2Query = new URLSearchParams({ region_id: region.id, seller_id: b2.id, limit: "100", fields: "+in_stock,+calculated_price,*seller" })
const { offers: b2Offers } = expect(await request(`/store/offers?${b2Query}`), 200, "List second seller offers")
const b2Offer = b2Offers.find(({ sku, in_stock }) => sku === "AGESTYLES-LAB-B2-COMMON-02" && in_stock)
assert(b2Offer?.id, "B2 lab SKU with available inventory is required")

const { cart: mixedCart } = expect(await request("/store/carts", { method: "POST", token, body: { region_id: region.id } }), 200, "Create mixed-seller scope cart")
expect(await request(`/store/carts/${mixedCart.id}/line-items?fields=%2Bitems.*`, { method: "POST", token, body: { offer_id: offer.id, quantity: 1 } }), 200, "Add A2 scope-test offer")
const mixedCartResult = expect(await request(`/store/carts/${mixedCart.id}/line-items?fields=%2Bitems.*`, { method: "POST", token, body: { offer_id: b2Offer.id, quantity: 1 } }), 200, "Add B2 scope-test offer")
const cartId = mixedCart.id
assert.equal(mixedCartResult.cart.items.length, 2, "The quote must cover the full two-seller cart")
expect(await request(`/store/carts/${cartId}`, {
  method: "POST", token,
  body: { email, shipping_address: { first_name: "Quote", last_name: "Lab", address_1: "Calle de prueba 1", city: "Madrid", postal_code: "28001", country_code: "es", phone: "+34000000000" } },
}), 200, "Set buyer shipping address")
const { shipping_options } = expect(await request(`/store/shipping-options?cart_id=${cartId}`, { token }), 200, "List shipping options")
for (const sellerId of [seller.id, b2.id]) {
  const option = shipping_options[sellerId]?.[0]
  assert(option?.id, `Seller ${sellerId} shipping option is required`)
  expect(await request(`/store/carts/${cartId}/shipping-methods`, { method: "POST", token, body: { option_id: option.id } }), 200, `Select shipping for ${sellerId}`)
}
const { payment_collection: collection } = expect(await request("/store/payment-collections", { method: "POST", token, body: { cart_id: cartId } }), 200, "Create lab payment collection")
expect(await request(`/store/payment-collections/${collection.id}/payment-sessions`, { method: "POST", token, body: { provider_id: "pp_system_default" } }), 200, "Initialize configured system payment provider")

const idempotencyKey = randomUUID()
const created = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey, body: { cart_id: cartId },
}), 201, "Request full-cart quote")
const quote = created.quote
assert(quote?.id && quote.revision === 1 && quote.status === "quoted")
assert.deepEqual([...quote.seller_ids].sort(), [seller.id, b2.id].sort(), "The quote must include both server-resolved sellers")
const duplicate = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey, body: { cart_id: cartId },
}), 200, "Repeat same idempotency key")
assert.equal(duplicate.quote.id, quote.id)

const stale = await request(`/store/order-quotes/${quote.id}/accept`, { method: "POST", token, body: { revision: quote.revision + 1 } })
assert.equal(stale.status, 409, "A stale revision must be rejected")
assert.equal(stale.data.code, "stale_revision")

const acceptancePath = `/store/order-quotes/${quote.id}/accept`
const acceptKey = randomUUID()
const simultaneous = await Promise.all(Array.from({ length: 5 }, () => request(acceptancePath, {
  method: "POST", token, idempotencyKey: acceptKey, body: { revision: quote.revision },
})))
const resolved = await Promise.all(simultaneous.map(async (result) => {
  if (result.status === 200) return result
  if (result.status !== 409) expect(result, 200, "Concurrent acceptance")
  const retryKey = result.headers.get("idempotency-key") ?? acceptKey
  let retried = result
  for (let attempt = 0; attempt < 5 && retried.status === 409; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    retried = await request(acceptancePath, { method: "POST", token, idempotencyKey: retryKey, body: { revision: quote.revision } })
  }
  return retried
}))
for (const result of resolved) expect(result, 200, "Concurrent acceptance after idempotent retry")
const orderGroupId = resolved[0].data.order_group_id
const childOrders = resolved[0].data.orders
assert(orderGroupId && childOrders?.length === 2, "Acceptance must return one group with two seller orders")
assert.deepEqual(childOrders.map(({ seller_id }) => seller_id).sort(), [seller.id, b2.id].sort(), "Each seller must get one child order")
assert(resolved.every(({ data }) => data.status === "accepted" && data.order_group_id === orderGroupId), "Concurrent acceptance and retries must converge to one order group")
assert(resolved.every(({ data }) => JSON.stringify(data.orders.map(({ id }) => id).sort()) === JSON.stringify(childOrders.map(({ id }) => id).sort())), "Retries must converge to the same two child order IDs")
const retry = expect(await request(acceptancePath, { method: "POST", token, idempotencyKey: acceptKey, body: { revision: quote.revision } }), 200, "Retry accepted quote")
assert.equal(retry.order_group_id, orderGroupId)

for (const [sellerId, memberEmail, ownOrder, otherOrder] of [
  [seller.id, "seller@mercur.dev", childOrders.find(({ seller_id }) => seller_id === seller.id), childOrders.find(({ seller_id }) => seller_id === b2.id)],
  [b2.id, "kickz@mercur.dev", childOrders.find(({ seller_id }) => seller_id === b2.id), childOrders.find(({ seller_id }) => seller_id === seller.id)],
]) {
  const sellerToken = await authenticateSeller(memberEmail)
  const { orders: sellerOrders } = expect(await request("/vendor/orders?limit=100&fields=id,display_id,status,total", { token: sellerToken, sellerId }), 200, `Read orders for ${sellerId}`)
  assert(sellerOrders.some(({ id }) => id === ownOrder.id), `Seller ${sellerId} can read its child order`)
  assert(!sellerOrders.some(({ id }) => id === otherOrder.id), `Seller ${sellerId} cannot see the other seller's child order`)
  const otherSeller = sellerId === seller.id ? b2.id : seller.id
  expect(await request("/vendor/orders?limit=100", { token: sellerToken, sellerId: otherSeller }), 403, `Deny cross-seller order listing for ${otherSeller}`)
}

// Reprice one seller offer through its supported vendor API, then restore the
// exact original price ladder even if quote acceptance/assertions fail.
const sellerAToken = await authenticateSeller("seller@mercur.dev")
const a2VendorOffer = expect(await request(`/vendor/offers/${offer.id}`, { token: sellerAToken, sellerId: seller.id }), 200, "Read A2 offer fixture")
const originalPriceRows = a2VendorOffer.offer.prices ?? []
assert(originalPriceRows.length > 0, "A2 offer must have a restorable lab price ladder")
const toPriceInput = (price, amount = Number(price.amount)) => ({
  id: price.id,
  amount,
  currency_code: price.currency_code,
  ...(price.min_quantity != null ? { min_quantity: price.min_quantity } : {}),
  ...(price.max_quantity != null ? { max_quantity: price.max_quantity } : {}),
  rules: Object.fromEntries((price.price_rules ?? []).map(({ attribute, value }) => [attribute, value])),
})
const originalPrices = originalPriceRows.map((price) => toPriceInput(price))
const priceCartId = await addOfferToNewCart(offer.id, "price-change probe")
const priceKey = randomUUID()
const priceQuote = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey: priceKey, body: { cart_id: priceCartId },
}), 201, "Quote before price change").quote
const { regions: sellerRegions } = expect(await request("/vendor/regions?limit=100", { token: sellerAToken, sellerId: seller.id }), 200, "Read A2 seller regions")
const sellerHasEur = sellerRegions.some(({ currency_code }) => currency_code?.toLowerCase() === "eur")
let priceMutation = "verified"
if (!sellerHasEur) {
  const currentOffer = expect(await request(`/vendor/offers/${offer.id}`, { token: sellerAToken, sellerId: seller.id }), 200, "Confirm unchanged A2 offer price")
  assert.deepEqual((currentOffer.offer.prices ?? []).map((price) => toPriceInput(price)), originalPrices, "Unsupported reprice must leave the exact original price ladder unchanged")
  assert.deepEqual(originalPrices.map(({ amount, currency_code }) => ({ amount, currency_code })), [{ amount: 49, currency_code: "eur" }], "This lab fixture is the seeded EUR 49 A2 price")
  priceMutation = "unsupported"
} else {
  let priceMutationApplied = false
  try {
    assertLabDatabase()
    const changedPrices = originalPriceRows.map((price) => toPriceInput(price, Number(price.amount) + 1))
    priceMutationApplied = true
    expect(await request(`/vendor/offers/${offer.id}`, { method: "POST", token: sellerAToken, sellerId: seller.id, body: { prices: changedPrices } }), 200, "Temporarily change A2 offer price")
    const priceAccept = await request(`/store/order-quotes/${priceQuote.id}/accept`, { method: "POST", token, body: { revision: priceQuote.revision } })
    assert.equal(priceAccept.status, 409, "A changed price must require buyer review")
    assert.equal(priceAccept.data.status, "requoted")
    assert.equal(priceAccept.data.quote.revision, priceQuote.revision + 1)
    assert.equal(priceAccept.data.quote.status, "quoted")
    assert.equal(priceAccept.data.quote.order_group_id, null)
  } finally {
    if (priceMutationApplied) {
      assertLabDatabase()
      expect(await request(`/vendor/offers/${offer.id}`, { method: "POST", token: sellerAToken, sellerId: seller.id, body: { prices: originalPrices } }), 200, "Restore A2 offer price ladder")
    }
  }
  const restoredPrice = expect(await request(`/vendor/offers/${offer.id}`, { token: sellerAToken, sellerId: seller.id }), 200, "Verify restored A2 offer price").offer
  assert.deepEqual((restoredPrice.prices ?? []).map((price) => toPriceInput(price)), originalPrices, "Price fixture must match its original ladder after restoration")
}
const restoredPriceQuote = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey: priceKey, body: { cart_id: priceCartId },
}), 200, "Refresh quote after the price probe").quote
assert(restoredPriceQuote.status === "quoted", "Price probe quote must remain reviewable")
if (priceMutation === "verified") assert(restoredPriceQuote.revision >= priceQuote.revision + 2, "Restored price must issue another reviewable quote revision")

// Zero only available stock (preserving reservations), test unavailability, and
// restore every level in finally. The loopback DB guard runs before each write.
const freshA2Offer = expect(await request(`/vendor/offers/${offer.id}`, { token: sellerAToken, sellerId: seller.id }), 200, "Read A2 inventory fixture").offer
assert(freshA2Offer.manage_inventory && !freshA2Offer.allow_backorder, "A2 fixture must use managed, non-backorder inventory")
const inventoryLevels = []
for (const link of freshA2Offer.inventory_items ?? []) {
  const inventoryItemId = link.inventory_item_id ?? link.id
  assert(inventoryItemId, "A2 offer inventory item ID is required")
  const levels = expect(await request(`/vendor/inventory-items/${inventoryItemId}/location-levels?fields=id,inventory_item_id,location_id,stocked_quantity,reserved_quantity&limit=100`, {
    token: sellerAToken, sellerId: seller.id,
  }), 200, `Read A2 stock levels ${inventoryItemId}`).inventory_levels
  inventoryLevels.push(...levels.map((level) => ({ ...level, inventory_item_id: inventoryItemId, required_quantity: Number(link.required_quantity ?? 1) })))
}
assert(inventoryLevels.length > 0, "A2 offer must have location stock levels")
assert(inventoryLevels.some(({ stocked_quantity, reserved_quantity, required_quantity }) => Number(stocked_quantity) - Number(reserved_quantity) >= required_quantity), "A2 offer must have available stock before mutation")
const stockCartId = await addOfferToNewCart(offer.id, "stock-change probe")
await prepareSingleSellerCheckout(stockCartId, seller.id, "stock-change probe")
const stockKey = randomUUID()
const stockQuote = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey: stockKey, body: { cart_id: stockCartId },
}), 201, "Quote before stock change").quote
const stockMutationApplied = []
let stockAccept
try {
  for (const level of inventoryLevels) {
    assertLabDatabase()
    stockMutationApplied.push(level)
    expect(await request(`/vendor/inventory-items/${level.inventory_item_id}/location-levels/${level.location_id}`, {
      method: "POST", token: sellerAToken, sellerId: seller.id, body: { stocked_quantity: Number(level.reserved_quantity) },
    }), 200, `Temporarily remove available stock at ${level.location_id}`)
  }
  stockAccept = await request(`/store/order-quotes/${stockQuote.id}/accept`, { method: "POST", token, body: { revision: stockQuote.revision } })
  assert.equal(stockAccept.status, 409, "Stock reduction must prevent order acceptance")
  assert.equal(stockAccept.data.status, "unavailable", JSON.stringify(stockAccept.data))
  assert.equal(stockAccept.data.quote.available, false)
  assert.equal(stockAccept.data.quote.revision, stockQuote.revision + 1)
  assert.equal(stockAccept.data.quote.order_group_id, null)
} finally {
  for (const level of stockMutationApplied.reverse()) {
    assertLabDatabase()
    expect(await request(`/vendor/inventory-items/${level.inventory_item_id}/location-levels/${level.location_id}`, {
      method: "POST", token: sellerAToken, sellerId: seller.id, body: { stocked_quantity: Number(level.stocked_quantity) },
    }), 200, `Restore stock at ${level.location_id}`)
  }
}
for (const originalLevel of inventoryLevels) {
  const currentLevels = expect(await request(`/vendor/inventory-items/${originalLevel.inventory_item_id}/location-levels?fields=id,inventory_item_id,location_id,stocked_quantity,reserved_quantity&limit=100`, {
    token: sellerAToken, sellerId: seller.id,
  }), 200, `Verify restored stock levels ${originalLevel.inventory_item_id}`).inventory_levels
  const restoredLevel = currentLevels.find(({ location_id }) => location_id === originalLevel.location_id)
  assert(restoredLevel, `Restored location ${originalLevel.location_id} must exist`)
  assert.equal(Number(restoredLevel.stocked_quantity), Number(originalLevel.stocked_quantity), `Stocked quantity must be restored at ${originalLevel.location_id}`)
  assert.equal(Number(restoredLevel.reserved_quantity), Number(originalLevel.reserved_quantity), `Reserved quantity must be preserved at ${originalLevel.location_id}`)
}
const restoredStockQuote = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey: stockKey, body: { cart_id: stockCartId },
}), 200, "Refresh quote after restoring stock").quote
assert.equal(restoredStockQuote.status, "quoted")
assert.equal(restoredStockQuote.available, true)

// Create a second quote and expire it through the registered module service helper.
// This avoids SQL and keeps the public API free of test-only controls.
const { cart: expiryCart } = expect(await request("/store/carts", { method: "POST", token, body: { region_id: region.id } }), 200, "Create expiry-probe cart")
expect(await request(`/store/carts/${expiryCart.id}/line-items?fields=%2Bitems.*`, { method: "POST", token, body: { offer_id: offer.id, quantity: 1 } }), 200, "Add expiry-probe seller offer")
const expiryKey = randomUUID()
const expiryQuoteResponse = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey: expiryKey, body: { cart_id: expiryCart.id },
}), 201, "Request quote for expiry probe")
const expiryQuote = expiryQuoteResponse.quote
assert(expiryQuote?.id)
process.env.AGESTYLES_LAB_QUOTE_ID = expiryQuote.id
process.env.AGESTYLES_LAB_QUOTE_REVISION = String(expiryQuote.revision)
process.env.AGESTYLES_LAB_CUSTOMER_TOKEN = token
process.env.AGESTYLES_LAB_PUBLISHABLE_KEY = key
process.env.AGESTYLES_LAB_API_BASE = base
const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const expiryRun = spawnSync("pnpm", ["exec", "medusa", "exec", "./src/scripts/verify-expired-order-quote.ts"], {
  cwd: appRoot,
  env: process.env,
  encoding: "utf8",
})
if (expiryRun.status !== 0) throw new Error(`Expiry helper failed: ${expiryRun.stderr || expiryRun.stdout}`)
console.log(expiryRun.stdout.trim())
console.log(JSON.stringify({ quoteId: quote.id, cartId, orderGroupId, childOrders, concurrencyAttempts: simultaneous.length, initialConflicts: simultaneous.filter(({ status }) => status === 409).length, priceMutation, priceRevision: restoredPriceQuote.revision, unavailableRevision: stockAccept.data.quote.revision, restoredStockRevision: restoredStockQuote.revision, expiryProbeQuoteId: expiryQuote.id }))
