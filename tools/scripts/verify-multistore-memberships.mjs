import assert from "node:assert/strict"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD
assert(seededPassword?.length >= 12, "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file")
assert.equal(base, "http://127.0.0.1:19081", "Use the local Mercur lab only")
assert(key?.startsWith("pk_"), "Configure the lab publishable key first")

const owners = [
  {
    email: "seller@mercur.dev",
    password: seededPassword,
    baseSeller: "Sole Society",
    secondSeller: {
      name: "AgeStyles Lab A2",
      handle: "agestyles-lab-a2",
      email: "lab-a2@agestyles.example",
    },
  },
  {
    email: "kickz@mercur.dev",
    password: seededPassword,
    baseSeller: "Kickz Corner",
    secondSeller: {
      name: "AgeStyles Lab B2",
      handle: "agestyles-lab-b2",
      email: "lab-b2@agestyles.example",
    },
  },
]

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body && { "content-type": "application/json" }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  return { status: response.status, data }
}

async function authenticate({ email, password }) {
  const { status, data } = await request("/auth/member/emailpass", {
    method: "POST",
    headers: { "x-publishable-api-key": key },
    body: { email, password },
  })
  assert.equal(status, 200, `Could not authenticate lab member (${status})`)
  assert(data.token)
  return { authorization: `Bearer ${data.token}` }
}

async function listMemberships(headers) {
  const { status, data } = await request("/vendor/sellers?limit=50", { headers })
  assert.equal(status, 200, `Could not list a member's seller accounts (${status})`)
  return data.seller_members
}

async function ensureSecondStore(owner, headers) {
  let memberships = await listMemberships(headers)
  assert(
    memberships.some(({ seller }) => seller?.name === owner.baseSeller),
    `Expected seeded owner account for ${owner.baseSeller}`,
  )

  let second = memberships.find(({ seller }) => seller?.handle === owner.secondSeller.handle)
  if (!second) {
    const { status, data } = await request("/vendor/sellers", {
      method: "POST",
      headers,
      body: {
        name: owner.secondSeller.name,
        handle: owner.secondSeller.handle,
        email: owner.secondSeller.email,
        currency_code: "eur",
        description: "Pending seller account used only by the isolated AgeStyles Mercur lab.",
        metadata: { agestyles_lab_fixture: "multi-store-v1" },
      },
    })
    assert.equal(status, 201, `Could not create the lab seller account (${status}): ${data.message ?? "unknown error"}`)
    assert.equal(data.seller?.handle, owner.secondSeller.handle)
    memberships = await listMemberships(headers)
    second = memberships.find(({ seller }) => seller?.handle === owner.secondSeller.handle)
  }

  assert(second?.seller?.id, `Owner could not access ${owner.secondSeller.name}`)
  return { memberships, secondSellerId: second.seller.id }
}

const ownerResults = []
for (const owner of owners) {
  const headers = await authenticate(owner)
  const { memberships, secondSellerId } = await ensureSecondStore(owner, headers)
  const ownSellerIds = memberships.map(({ seller }) => seller?.id).filter(Boolean)
  assert(ownSellerIds.length >= 2, `${owner.baseSeller} must own at least two seller accounts`)
  ownerResults.push({ headers, baseSeller: owner.baseSeller, ownSellerIds, secondSellerId })
}

const [ownerA, ownerB] = ownerResults
const sellerScopes = [
  ...ownerA.ownSellerIds.map((sellerId) => ({ owner: ownerA, sellerId })),
  ...ownerB.ownSellerIds.map((sellerId) => ({ owner: ownerB, sellerId })),
]

const businessReads = [
  ["productos", "/vendor/products?limit=50&fields=id,title,status,variants.id"],
  ["inventario", "/vendor/inventory-items?limit=50&fields=id,title,sku,location_levels.id,location_levels.stocked_quantity"],
  ["pedidos", "/vendor/orders?limit=50&fields=id,display_id,status,created_at,total"],
  ["ofertas", "/vendor/offers?limit=50"],
  ["ubicaciones", "/vendor/stock-locations?limit=50&fields=id,name"],
]

const capabilityResults = []
for (const { owner, sellerId } of sellerScopes) {
  const ownHeaders = { ...owner.headers, "x-seller-id": sellerId }
  for (const [resource, path] of businessReads) {
    const own = await request(path, { headers: ownHeaders })
    assert.equal(own.status, 200, `${owner.baseSeller} could not read ${resource} in own seller ${sellerId}`)
    capabilityResults.push({ sellerId, resource, own: own.status })

    const foreignOwner = owner === ownerA ? ownerB : ownerA
    const foreignSellerId = foreignOwner.ownSellerIds[0]
    const foreign = await request(path, {
      headers: { ...owner.headers, "x-seller-id": foreignSellerId },
    })
    assert.equal(foreign.status, 403, `${owner.baseSeller} read ${resource} from another owner's seller`)
  }
}

for (const [owner, other] of [[ownerA, ownerB], [ownerB, ownerA]]) {
  const ownStoreSelection = await request("/vendor/sellers/select", {
    method: "POST",
    headers: owner.headers,
    body: { seller_id: owner.secondSellerId },
  })
  assert.equal(ownStoreSelection.status, 200, `${owner.baseSeller} must be able to select its second store`)

  const foreignStoreSelection = await request("/vendor/sellers/select", {
    method: "POST",
    headers: owner.headers,
    body: { seller_id: other.secondSellerId },
  })
  assert.equal(foreignStoreSelection.status, 403, `${owner.baseSeller} must not select another owner's store`)

  const ownStore = await request("/vendor/sellers/me?fields=id,name,handle", {
    headers: { ...owner.headers, "x-seller-id": owner.secondSellerId },
  })
  assert.equal(ownStore.status, 200, `${owner.baseSeller} must read its selected store`)
  assert.equal(ownStore.data.seller?.id, owner.secondSellerId)

  const foreignStore = await request("/vendor/sellers/me?fields=id,name,handle", {
    headers: { ...owner.headers, "x-seller-id": other.secondSellerId },
  })
  assert.equal(foreignStore.status, 403, `${owner.baseSeller} must not read another owner's store`)
}

console.log("Two lab owners each have two seller stores; own-store selection passed and cross-owner selection/read returned 403.")
console.table(ownerResults.map(({ baseSeller, ownSellerIds }) => ({ owner: baseSeller, storeCount: ownSellerIds.length })))
console.log("All four stores passed owner-scoped product, inventory, order, offer, and stock-location reads; cross-owner reads returned 403.")
console.table(capabilityResults)
