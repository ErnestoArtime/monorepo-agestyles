import assert from "node:assert/strict"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD
assert(seededPassword?.length >= 12, "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file")
assert.match(base ?? "", /^http:\/\/127\.0\.0\.1:19\d{3}$/, "Use a loopback Mercur lab API")
assert(key?.startsWith("pk_"), "Set the lab publishable key")

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...headers,
      ...(body && { "content-type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json() }
}

function expectStatus(result, status, action) {
  assert.equal(result.status, status, `${action}: ${result.data?.message ?? result.status}`)
  return result.data
}

const { regions } = expectStatus(await request("/store/regions"), 200, "List regions")
const region = regions.find(({ currency_code }) => currency_code === "eur")
assert(region?.id, "The EUR lab region is required")

const { sellers } = expectStatus(
  await request("/store/sellers?fields=id,handle,name"),
  200,
  "List visible sellers",
)
const a2 = sellers.find(({ handle }) => handle === "agestyles-lab-a2")
const b2 = sellers.find(({ handle }) => handle === "agestyles-lab-b2")
assert(a2?.id && b2?.id, "Both approved lab sellers must be visible")

async function findOffer(seller, sku) {
  const query = new URLSearchParams({
    region_id: region.id,
    seller_id: seller.id,
    limit: "100",
    fields: "+in_stock,+calculated_price,*seller",
  })
  const { offers } = expectStatus(
    await request(`/store/offers?${query}`),
    200,
    `List public offers for ${seller.handle}`,
  )
  const offer = offers.find((candidate) => candidate.sku === sku)
  assert(offer?.id && offer.in_stock, `${sku} must be publicly visible and in stock`)
  return offer
}

const offers = [
  await findOffer(a2, "AGESTYLES-LAB-A2-COMMON-01"),
  await findOffer(b2, "AGESTYLES-LAB-B2-COMMON-02"),
]
const { cart } = expectStatus(
  await request("/store/carts", { method: "POST", body: { region_id: region.id } }),
  200,
  "Create buyer cart",
)
assert(cart?.id)

let currentCart = cart
for (const offer of offers) {
  const result = expectStatus(
    await request(`/store/carts/${cart.id}/line-items?fields=%2Bitems.*`, {
      method: "POST",
      body: { offer_id: offer.id, quantity: 1 },
    }),
    200,
    `Add offer from ${offer.seller.handle}`,
  )
  currentCart = result.cart
}
assert.equal(currentCart.items.length, 2, "The cart must contain both seller offers")

expectStatus(
  await request(`/store/carts/${cart.id}`, {
    method: "POST",
    body: {
      email: "buyer-multistore-lab@agestyles.example",
      shipping_address: {
        first_name: "Lab",
        last_name: "Buyer",
        address_1: "Calle de prueba 1",
        city: "Madrid",
        postal_code: "28001",
        country_code: "es",
        phone: "+34000000000",
      },
    },
  }),
  200,
  "Set checkout address",
)

const { shipping_options: shippingBySeller } = expectStatus(
  await request(`/store/shipping-options?cart_id=${cart.id}`),
  200,
  "List seller shipping options",
)
for (const sellerId of [a2.id, b2.id]) {
  const option = shippingBySeller[sellerId]?.[0]
  assert(option?.id, `Seller ${sellerId} needs a shipping option`)
  if (option.insufficient_inventory) {
    console.warn(`Shipping option ${option.id} reports insufficient_inventory for seller ${sellerId}`)
  }
  expectStatus(
    await request(`/store/carts/${cart.id}/shipping-methods`, {
      method: "POST",
      body: { option_id: option.id },
    }),
    200,
    `Select shipping for ${sellerId}`,
  )
}

const { payment_collection: collection } = expectStatus(
  await request("/store/payment-collections", {
    method: "POST",
    body: { cart_id: cart.id },
  }),
  200,
  "Create payment collection",
)
assert(collection?.id)
expectStatus(
  await request(`/store/payment-collections/${collection.id}/payment-sessions`, {
    method: "POST",
    body: { provider_id: "pp_system_default" },
  }),
  200,
  "Initialize lab payment",
)

const completion = expectStatus(
  await request(`/store/carts/${cart.id}/complete`, { method: "POST", body: {} }),
  200,
  "Complete multistore checkout",
)
assert.equal(completion.type, "order_group")
assert.equal(completion.order_group.orders.length, 2, "Checkout must split into two seller orders")

async function authenticate(email) {
  const { token } = expectStatus(
    await request("/auth/member/emailpass", {
      method: "POST",
      body: { email, password: seededPassword },
    }),
    200,
    `Authenticate ${email}`,
  )
  return { authorization: `Bearer ${token}` }
}

const orderScopes = [
  {
    sellerId: a2.id,
    otherSellerId: b2.id,
    headers: await authenticate("seller@mercur.dev"),
    order: completion.order_group.orders[0],
  },
  {
    sellerId: b2.id,
    otherSellerId: a2.id,
    headers: await authenticate("kickz@mercur.dev"),
    order: completion.order_group.orders[1],
  },
]
for (const scope of orderScopes) {
  const ownHeaders = { ...scope.headers, "x-seller-id": scope.sellerId }
  const { orders } = expectStatus(
    await request("/vendor/orders?limit=100&fields=id,display_id,status,created_at,total", {
      headers: ownHeaders,
    }),
    200,
    `Read seller ${scope.sellerId} orders`,
  )
  assert(orders.some(({ id }) => id === scope.order.id), "Seller must see its order from the group")
  expectStatus(
    await request("/vendor/orders?limit=100", {
      headers: { ...scope.headers, "x-seller-id": scope.otherSellerId },
    }),
    403,
    `Deny cross-owner orders for ${scope.sellerId}`,
  )
}

console.log("Buyer checkout passed: A2 + B2 offers, two seller shipping options, two split orders, and cross-owner reads denied.")
console.log(JSON.stringify({
  cartId: cart.id,
  orderGroupId: completion.order_group.id,
  orderCount: completion.order_group.orders.length,
  shippingInventoryWarnings: Object.values(shippingBySeller).flat().filter(({ insufficient_inventory }) => insufficient_inventory).length,
}))
