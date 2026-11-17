import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const databaseUrl = process.env.DATABASE_URL
assert.equal(base, "http://127.0.0.1:19081", "Only the isolated 19081 lab is allowed")
assert(key?.startsWith("pk_"), "Set the lab publishable API key")
assert(databaseUrl, "Load apps/commerce-api/.env to verify the isolated database")
const parsed = new URL(databaseUrl)
assert.equal(parsed.hostname, "127.0.0.1")
assert.equal(parsed.port, "15472")
assert.equal(parsed.pathname, "/agestyles_mercur_lab")

async function request(path, { method = "GET", token, body, idempotencyKey } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json().catch(() => ({})) }
}
function expect(result, status, label) {
  assert.equal(result.status, status, `${label}: ${result.data.message ?? result.data.code ?? result.status}`)
  return result.data
}

const email = `quote-expiry-${randomUUID()}@agestyles.example`
const password = `${randomUUID()}Aa1!`
const registration = expect(await request("/auth/customer/emailpass/register", {
  method: "POST", body: { email, password },
}), 200, "Register disposable expiry buyer")
expect(await request("/store/customers", {
  method: "POST", token: registration.token, body: { email, first_name: "Quote", last_name: "Expiry" },
}), 200, "Create expiry buyer profile")
const buyer = expect(await request("/auth/customer/emailpass", {
  method: "POST", body: { email, password },
}), 200, "Authenticate expiry buyer")
const token = buyer.token
assert(token)

const { regions } = expect(await request("/store/regions"), 200, "List regions")
const region = regions.find(({ currency_code }) => currency_code === "eur")
assert(region?.id, "The lab must have an EUR region")
const { sellers } = expect(await request("/store/sellers?fields=id,handle"), 200, "List sellers")
const seller = sellers.find(({ handle }) => handle === "agestyles-lab-a2")
assert(seller?.id, "A2 lab seller is required")
const offersQuery = new URLSearchParams({ region_id: region.id, seller_id: seller.id, limit: "100", fields: "+in_stock" })
const { offers } = expect(await request(`/store/offers?${offersQuery}`), 200, "List A2 offers")
const offer = offers.find(({ sku, in_stock }) => sku === "AGESTYLES-LAB-A2-COMMON-01" && in_stock)
assert(offer?.id, "A2 lab offer with stock is required")
const { cart } = expect(await request("/store/carts", {
  method: "POST", token, body: { region_id: region.id },
}), 200, "Create expiry cart")
expect(await request(`/store/carts/${cart.id}/line-items`, {
  method: "POST", token, body: { offer_id: offer.id, quantity: 1 },
}), 200, "Add offer to expiry cart")
const idempotencyKey = randomUUID()
const { quote } = expect(await request("/store/order-quotes", {
  method: "POST", token, idempotencyKey, body: { cart_id: cart.id },
}), 201, "Create quote for expiry test")

process.env.AGESTYLES_LAB_QUOTE_ID = quote.id
process.env.AGESTYLES_LAB_QUOTE_REVISION = String(quote.revision)
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
console.log(JSON.stringify({ quoteId: quote.id, cartId: cart.id, expiry: "passed", helper: "medusa exec" }))
