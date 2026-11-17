import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { SellerRole } from "@mercurjs/types"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD
assert(seededPassword?.length >= 12, "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file")
assert.equal(base, "http://127.0.0.1:19081", "Use the local Mercur lab only")
assert(key?.startsWith("pk_"), "Set the lab publishable key")

const runId = randomUUID()
const results = []
const created = []
const ownerCredentials = { email: "kickz@mercur.dev", password: seededPassword }

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...headers,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json().catch(() => ({})) }
}

async function expect(path, options, status, permission) {
  const result = await request(path, options)
  assert.equal(result.status, status, `${options?.method ?? "GET"} ${path}: ${result.data.message ?? result.status}`)
  if (permission) {
    assert.equal(result.data.code, "MISSING_PERMISSION")
    assert.equal(result.data.permission, permission)
  }
  return result.data
}

async function authenticate(credentials, register = false) {
  const { token } = await expect(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: credentials },
    200,
  )
  assert(token)
  return { authorization: `Bearer ${token}` }
}

async function check(actor, action, path, status, options = {}) {
  const data = await expect(path, {
    method: options.method,
    body: options.body,
    headers: options.headers ?? actor.headers,
  }, status, options.permission)
  results.push({ store: actor.storeName, role: actor.name, action, status })
  return data
}

async function createMember(owner, store, name, slug, role) {
  const credentials = { email: `${slug}+${runId}@agestyles.example`, password: randomUUID() }
  const { member_invite } = await expect(`/vendor/sellers/${store.id}/members`, {
    method: "POST",
    headers: { ...owner.headers, "x-seller-id": store.id },
    body: { email: credentials.email, role_id: role },
  }, 201)
  assert(member_invite.token)
  await expect("/vendor/members/invites/accept", {
    method: "POST",
    headers: await authenticate(credentials, true),
    body: { invite_token: member_invite.token, first_name: "AgeStyles Lab" },
  }, 200)
  const headers = { ...await authenticate(credentials), "x-seller-id": store.id }
  const { seller_member } = await expect("/vendor/members/me?fields=id,is_owner,role_id,permissions", { headers }, 200)
  assert.equal(seller_member.role_id, role)
  assert.equal(seller_member.is_owner, false)
  const member = {
    name,
    credentials,
    headers,
    role,
    membership: seller_member,
    storeName: store.name,
    headersByStore: new Map([[store.id, headers]]),
  }
  created.push({ store, owner, member })
  return member
}

async function addMemberToStore(owner, store, member) {
  const { member_invite } = await expect(`/vendor/sellers/${store.id}/members`, {
    method: "POST",
    headers: { ...owner.headers, "x-seller-id": store.id },
    body: { email: member.credentials.email, role_id: member.role },
  }, 201)
  assert(member_invite.token)
  await expect("/vendor/members/invites/accept", {
    method: "POST",
    headers: await authenticate(member.credentials),
    body: { invite_token: member_invite.token, first_name: "AgeStyles Lab" },
  }, 200)
  const headers = { ...await authenticate(member.credentials), "x-seller-id": store.id }
  const { seller_member } = await expect("/vendor/members/me?fields=id,is_owner,role_id,permissions", { headers }, 200)
  assert.equal(seller_member.role_id, member.role)
  member.storeName = store.name
  member.headersByStore ??= new Map()
  member.headersByStore.set(store.id, headers)
  created.push({ store, owner, member: { ...member, membership: seller_member } })
}

async function verifyStore(owner, store, manager, reader, foreignSellerId) {
  const ownerAtStore = { ...owner, storeName: store.name, headers: { ...owner.headers, "x-seller-id": store.id } }
  const managerAtStore = { ...manager, storeName: store.name, headers: manager.headersByStore.get(store.id) }
  const readerAtStore = { ...reader, storeName: store.name, headers: reader.headersByStore.get(store.id) }
  const membersPath = `/vendor/sellers/${store.id}/members`

  const { seller_member: ownerMembership } = await expect("/vendor/members/me?fields=id,is_owner,permissions", { headers: ownerAtStore.headers }, 200)
  assert(ownerMembership.is_owner)
  const { stock_locations } = await expect("/vendor/stock-locations?fields=id&limit=1", { headers: ownerAtStore.headers }, 200)
  const location = stock_locations[0]
  assert(location)

  const { inventory_item } = await check(ownerAtStore, "Crear artículo de inventario", "/vendor/inventory-items", 200, {
    method: "POST",
    body: { title: `Role verification ${store.handle}`, sku: `ROLE-${store.handle}-${runId}` },
  })
  const itemId = inventory_item.id
  const itemPath = `/vendor/inventory-items/${itemId}`
  let itemActive = true
  try {
    await expect(`${itemPath}/location-levels`, {
      method: "POST",
      headers: ownerAtStore.headers,
      body: { location_id: location.id, stocked_quantity: 12 },
    }, 200)
    const levelPath = `${itemPath}/location-levels/${location.id}`

    for (const actor of [ownerAtStore, managerAtStore, readerAtStore]) {
      await check(actor, "Leer inventario", itemPath, 200)
      const manager = actor === managerAtStore
      const canRead = !manager
      await check(actor, "Listar productos", "/vendor/products?limit=20&fields=id,title,status,variants.id", canRead ? 200 : 403, {
        permission: canRead ? undefined : "products",
      })
      await check(actor, "Listar pedidos", "/vendor/orders?limit=20&fields=id,display_id,status,total", canRead ? 200 : 403, {
        permission: canRead ? undefined : "orders",
      })
      await check(actor, "Listar ofertas", "/vendor/offers?limit=1", canRead ? 200 : 403, {
        permission: canRead ? undefined : "offers",
      })
      await check(actor, "Listar miembros", membersPath, actor === ownerAtStore ? 200 : 403, {
        permission: actor === ownerAtStore ? undefined : "members",
      })
    }

    await check(managerAtStore, "Editar existencias", levelPath, 200, {
      method: "POST",
      body: { stocked_quantity: 17 },
    })
    await check(readerAtStore, "Solo lectura no puede editar existencias", levelPath, 403, {
      method: "POST",
      body: { stocked_quantity: 99 },
      permission: "inventory_items",
    })
    await check(managerAtStore, "Gestor no puede borrar inventario", itemPath, 403, {
      method: "DELETE",
      permission: "inventory_items",
    })
    for (const actor of [ownerAtStore, managerAtStore, readerAtStore]) {
      await check(actor, "Denegar otra tienda propietaria", "/vendor/inventory-items", 403, {
        headers: { ...actor.headers, "x-seller-id": foreignSellerId },
      })
    }

    await check(ownerAtStore, "Limpiar artículo de inventario", itemPath, 200, { method: "DELETE" })
    itemActive = false
  } finally {
    if (itemActive) {
      await expect(itemPath, { method: "DELETE", headers: ownerAtStore.headers }, 200)
    }
  }
}

const ownerAuth = await authenticate(ownerCredentials)
const ownerMemberships = await expect("/vendor/sellers?limit=50", { headers: ownerAuth }, 200)
const stores = ownerMemberships.seller_members.map(({ seller }) => seller).filter(Boolean)
const b1 = stores.find(({ name }) => name === "Kickz Corner")
const b2 = stores.find(({ handle }) => handle === "agestyles-lab-b2")
assert(b1?.id && b2?.id, "Kickz Corner and the B2 lab store must both belong to this owner")
const owner = { name: "Dueño Kickz", headers: { ...ownerAuth, "x-seller-id": b1.id } }
const otherOwnerAuth = await authenticate({ email: "seller@mercur.dev", password: seededPassword })
const otherOwnerMemberships = await expect("/vendor/sellers?limit=50", { headers: otherOwnerAuth }, 200)
const foreignSellerId = otherOwnerMemberships.seller_members
  .map(({ seller }) => seller)
  .find(({ name }) => name === "Sole Society")?.id
assert(foreignSellerId, "The foreign owner seller is required for cross-owner denial checks")

let manager
let reader
try {
  manager = await createMember(owner, b1, "Gestor", "kickz-inventory", SellerRole.INVENTORY_MANAGEMENT)
  reader = await createMember(owner, b1, "Solo lectura", "kickz-reader", SellerRole.SUPPORT)
  await addMemberToStore(owner, b2, manager)
  await addMemberToStore(owner, b2, reader)
  await verifyStore(owner, b1, manager, reader, foreignSellerId)
  await verifyStore(owner, b2, manager, reader, foreignSellerId)
  console.log(`Kickz/B2 role matrix passed: ${results.length} checks across owner, inventory manager, and read-only member.`)
  console.table(results)
} finally {
  const cleanedMemberships = new Set()
  for (const entry of created.reverse()) {
    const membershipId = entry.member.membership.id
    if (!membershipId || cleanedMemberships.has(membershipId)) continue
    cleanedMemberships.add(membershipId)
    await expect(`/vendor/sellers/${entry.store.id}/members/${membershipId}`, {
      method: "DELETE",
      headers: { ...entry.owner.headers, "x-seller-id": entry.store.id },
    }, 200)
  }
}
