import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import Medusa, { FetchError } from "@medusajs/js-sdk"
import { getBuyerOrderGroup } from "@agestyles/api-client/buyer-orders"
import {
  addOffer,
  completeCart,
  listOffers,
  listShippingOptions,
} from "@agestyles/api-client/store"

const baseUrl = process.env.EXPO_PUBLIC_MEDUSA_URL
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
assert.equal(baseUrl, "http://127.0.0.1:19081", "Use the isolated Mercur lab")
assert(publishableKey?.startsWith("pk_"), "Set the lab publishable key")

const auth = { type: "jwt", jwtTokenStorageMethod: "memory" } as const
const buyer = new Medusa({ baseUrl, publishableKey, auth })
const email = `buyer+${randomUUID()}@agestyles.example`
const password = randomUUID()
const credentials = { email, password }
await buyer.auth.register("customer", "emailpass", credentials)
await buyer.store.customer.create({ email, first_name: "Lab", last_name: "Buyer" })
await buyer.auth.login("customer", "emailpass", credentials)

const { regions } = await buyer.store.region.list()
const region = regions.find((entry) => entry.currency_code === "eur")
assert(region)

const sellerAccounts = [
  { name: "Sole Society", email: "seller@mercur.dev" },
  { name: "Kickz Corner", email: "kickz@mercur.dev" },
]

const { products } = await buyer.store.product.list({ region_id: region.id, fields: "id,title,*variants" })
const selected = []
for (const seller of sellerAccounts) {
  let match
  for (const product of products) {
    if (selected.some((entry) => entry.product.id === product.id)) continue
    for (const variant of product.variants ?? []) {
      const { offers } = await listOffers(buyer.client, region.id, variant.id)
      const offer = offers.find((entry) => entry.seller.name === seller.name && entry.in_stock && entry.calculated_price)
      if (offer) {
        match = { seller, product, offer }
        break
      }
    }
    if (match) break
  }
  assert(match, `No stocked demo offer for ${seller.name}`)
  selected.push(match)
}

const { cart } = await buyer.store.cart.create({ region_id: region.id })
for (const { offer } of selected) await addOffer(buyer.client, cart.id, offer.id, 1)
const { cart: mixedCart } = await buyer.store.cart.retrieve(cart.id, { fields: "+items.*" })
assert.equal(mixedCart.items?.length, 2)
assert.deepEqual(
  new Set(mixedCart.items.map((line) => line.product_id)),
  new Set(selected.map(({ product }) => product.id)),
)

const address = {
  first_name: "Lab",
  last_name: "Buyer",
  address_1: "Calle de Prueba 10",
  city: "Madrid",
  postal_code: "28001",
  country_code: "es",
}
await buyer.store.cart.update(cart.id, { email, shipping_address: address, billing_address: address })
const { shipping_options } = await listShippingOptions(buyer.client, cart.id)
assert.deepEqual(new Set(Object.keys(shipping_options)), new Set(selected.map(({ offer }) => offer.seller_id)))
for (const options of Object.values(shipping_options)) {
  const option = options[0]
  assert(option, "Every seller needs a shipping option")
  await buyer.store.cart.addShippingMethod(cart.id, { option_id: option.id })
}
await buyer.store.payment.initiatePaymentSession(cart, { provider_id: "pp_system_default" })
const result = await completeCart(buyer.client, cart.id)
assert.equal(result.type, "order_group", JSON.stringify(result))
assert.equal(result.order_group.orders.length, 2)
const groupId = result.order_group.id
const { order_group: buyerGroup } = await getBuyerOrderGroup(buyer.client, groupId)
assert.deepEqual(
  new Set(buyerGroup.orders.map(({ id }) => id)),
  new Set(result.order_group.orders.map(({ id }) => id)),
)

type Order = { id: string; items: { product_id: string }[] }
const ownerOrders = new Map<string, string>()
const vendorClients = []
const orderDetails = (id: string) => `/vendor/orders/${id}`
const hasStatus = (status: number) => (error: unknown) =>
  error instanceof FetchError && error.status === status

for (const { seller, product, offer } of selected) {
  const vendor = new Medusa({ baseUrl, auth })
  await vendor.auth.login("member", "emailpass", { email: seller.email, password: "supersecret" })
  const headers = { "x-seller-id": offer.seller_id }
  const { orders } = await vendor.client.fetch<{ orders: Order[] }>("/vendor/orders", { headers })
  const visibleOrders = orders.filter(({ id }) => result.order_group.orders.some((order) => order.id === id))
  assert.equal(visibleOrders.length, 1, `${seller.name} must see only one order from this purchase`)
  const ownOrderId = visibleOrders[0].id
  const { order } = await vendor.client.fetch<{ order: Order }>(orderDetails(ownOrderId), {
    headers,
    query: { fields: "id,items.product_id" },
  })
  assert.deepEqual(order.items.map((item) => item.product_id), [product.id])
  ownerOrders.set(offer.seller_id, ownOrderId)
  vendorClients.push({ vendor, seller, offer })
}
assert.equal(new Set(ownerOrders.values()).size, 2)

for (const { vendor, seller, offer } of vendorClients) {
  const [foreignSellerId, foreignOrderId] = [...ownerOrders.entries()].find(([id]) => id !== offer.seller_id)!
  await assert.rejects(vendor.client.fetch(orderDetails(foreignOrderId), {
    headers: { "x-seller-id": offer.seller_id },
  }), hasStatus(404), `${seller.name}: foreign order must be hidden`)
  await assert.rejects(vendor.client.fetch(orderDetails(foreignOrderId), {
    headers: { "x-seller-id": foreignSellerId },
  }), hasStatus(403), `${seller.name}: changing store header must be forbidden`)
  await assert.rejects(vendor.client.fetch(`${orderDetails(foreignOrderId)}/cancel`, {
    method: "POST",
    body: {},
    headers: { "x-seller-id": offer.seller_id },
  }), hasStatus(404), `${seller.name}: cancelling a foreign order must fail`)
}

await assert.rejects(buyer.client.fetch("/vendor/orders", {
  headers: { "x-seller-id": selected[0].offer.seller_id },
}), hasStatus(401), "Buyer token must not authorize Vendor API")

console.log(JSON.stringify({
  cart: cart.id,
  lineCount: mixedCart.items.length,
  orderGroup: groupId,
  sellers: selected.map(({ seller, product, offer }) => ({
    store: seller.name,
    product: product.title,
    order: ownerOrders.get(offer.seller_id),
    ownOrder: 200,
    foreignOrder: 404,
    foreignStoreHeader: 403,
    cancelForeignOrder: 404,
  })),
  buyerToVendorApi: 401,
}, null, 2))
