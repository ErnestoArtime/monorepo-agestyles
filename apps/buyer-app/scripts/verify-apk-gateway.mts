import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import Medusa from "@medusajs/js-sdk"
import { addOffer, completeCart, listOffers, listShippingOptions } from "@agestyles/api-client/store"

const baseUrl = process.argv[2] ?? "http://127.0.0.1:19182/agestyles-lab"
assert([
  "http://127.0.0.1:19182/agestyles-lab",
  "https://descargas.eav-labs.com/agestyles-lab",
].includes(baseUrl))
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
assert(publishableKey?.startsWith("pk_"))

const buyer = new Medusa({ baseUrl, publishableKey })
const { regions } = await buyer.store.region.list()
const region = regions.find(({ currency_code }) => currency_code === "eur")
assert(region)
const { products } = await buyer.store.product.list({ region_id: region.id, fields: "id,title,*variants" })

const selections = [
  { title: "Meridian Twin-Strap Sandal", store: "Sole Society" },
  { title: "Meridian Twin-Strap Buckle Sandal", store: "Kickz Corner" },
]
const { cart } = await buyer.store.cart.create({ region_id: region.id })
for (const { title, store } of selections) {
  const product = products.find((entry) => entry.title === title)
  assert(product?.variants?.length)
  const { offers } = await listOffers(buyer.client, region.id, product.variants[0].id)
  const offer = offers.find((entry) => entry.seller.name === store && entry.in_stock)
  assert(offer, `Expected a demo offer for ${title} at ${store}`)
  await addOffer(buyer.client, cart.id, offer.id, 1)
}
const { cart: mixedCart } = await buyer.store.cart.retrieve(cart.id, { fields: "+items.*" })
assert.equal(mixedCart.items?.length, 2)
const lineId = mixedCart.items[0].id
await buyer.store.cart.updateLineItem(cart.id, lineId, { quantity: 2 })
const { cart: updated } = await buyer.store.cart.updateLineItem(cart.id, lineId, { quantity: 1 })
assert.equal(updated.items?.find(({ id }) => id === lineId)?.quantity, 1)

const address = {
  first_name: "AgeStyles",
  last_name: "Lab",
  address_1: "Calle de Prueba 10",
  city: "Madrid",
  postal_code: "28001",
  country_code: "es",
}
await buyer.store.cart.update(cart.id, {
  email: `apk+${randomUUID()}@agestyles.example`,
  shipping_address: address,
  billing_address: address,
})
const { shipping_options } = await listShippingOptions(buyer.client, cart.id)
assert.equal(Object.keys(shipping_options).length, 2)
for (const [option] of Object.values(shipping_options)) {
  assert(option)
  await buyer.store.cart.addShippingMethod(cart.id, { option_id: option.id })
}
await buyer.store.payment.initiatePaymentSession(cart, { provider_id: "pp_system_default" })
const result = await completeCart(buyer.client, cart.id)
assert.equal(result.type, "order_group", JSON.stringify(result))
assert.equal(result.order_group.orders.length, 2)

for (const path of ["/admin/products", "/vendor/orders", "/auth/member/emailpass"]) {
  const response = await fetch(baseUrl + path)
  assert.equal(response.status, 404, path)
}
for (const path of ["/store/customers/me", "/store/order-groups"]) {
  const response = await fetch(baseUrl + path, {
    headers: { "x-publishable-api-key": publishableKey },
  })
  assert.equal(response.status, 401, path)
}
console.log(`APK gateway: checkout produced ${result.order_group.orders.length} seller orders (${result.order_group.id})`)
