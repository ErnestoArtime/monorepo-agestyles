import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { SellerRole } from "@mercurjs/types"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD
assert(seededPassword?.length >= 12, "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file")
assert.equal(base, "http://127.0.0.1:19081", "Use the local Mercur lab only")
assert(key?.startsWith("pk_"), "Set the lab publishable key")

const results = []
const runId = randomUUID()

async function request(path, { method = "GET", headers, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...headers, ...(body && { "content-type": "application/json" }) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, body: await response.json() }
}

async function expectStatus(path, options, status, permission) {
  const result = await request(path, options)
  assert.equal(result.status, status, `${options.method ?? "GET"} ${path}: ${result.body?.message ?? result.status}`)
  if (permission) {
    assert.equal(result.body.code, "MISSING_PERMISSION")
    assert.equal(result.body.permission, permission)
  }
  return result.body
}

async function authenticate(credentials, register = false) {
  const { token } = await expectStatus(
    `/auth/member/emailpass${register ? "/register" : ""}`,
    { method: "POST", body: credentials },
    200,
  )
  assert(token)
  return { authorization: `Bearer ${token}` }
}

const { sellers } = await expectStatus("/store/sellers?fields=id,name", {
  headers: { "x-publishable-api-key": key },
}, 200)
const store = sellers.find(({ name }) => name === "Sole Society")
const otherStore = sellers.find(({ name }) => name === "Kickz Corner")
assert(store && otherStore)

const owner = {
  name: "Dueño",
  headers: {
    ...await authenticate({ email: "seller@mercur.dev", password: seededPassword }),
    "x-seller-id": store.id,
  },
}
const membersPath = `/vendor/sellers/${store.id}/members`
const ownerSellerAccounts = await expectStatus("/vendor/sellers?limit=50", { headers: owner.headers }, 200)
const secondStore = ownerSellerAccounts.seller_members
  .map(({ seller }) => seller)
  .find(({ handle }) => handle === "agestyles-lab-a2")
assert(secondStore?.id, "The owner's second lab store is required")
const secondMembersPath = `/vendor/sellers/${secondStore.id}/members`
const actors = []
let itemId
let secondItemId

async function createActor(name, slug, role) {
  const credentials = { email: `${slug}+${runId}@agestyles.example`, password: randomUUID() }
  const { member_invite } = await expectStatus(membersPath, {
    method: "POST",
    headers: owner.headers,
    body: { email: credentials.email, role_id: role },
  }, 201)
  assert(member_invite.token)
  await expectStatus("/vendor/members/invites/accept", {
    method: "POST",
    headers: await authenticate(credentials, true),
    body: { invite_token: member_invite.token, first_name: "AgeStyles Lab" },
  }, 200)

  const headers = { ...await authenticate(credentials), "x-seller-id": store.id }
  const { seller_member } = await expectStatus("/vendor/members/me?fields=id,is_owner,role_id,permissions", { headers }, 200)
  actors.push({
    name,
    credentials,
    headers,
    membership: seller_member,
    primaryActive: true,
    secondActive: false,
  })
  assert.equal(seller_member.role_id, role)
  assert.equal(seller_member.is_owner, false)
  return actors.at(-1)
}

async function addActorToSecondStore(actor) {
  const { member_invite } = await expectStatus(secondMembersPath, {
    method: "POST",
    headers: { ...owner.headers, "x-seller-id": secondStore.id },
    body: { email: actor.credentials.email, role_id: actor.membership.role_id },
  }, 201)
  assert(member_invite.token)
  await expectStatus("/vendor/members/invites/accept", {
    method: "POST",
    headers: await authenticate(actor.credentials),
    body: { invite_token: member_invite.token, first_name: "AgeStyles Lab" },
  }, 200)
  const headers = { ...await authenticate(actor.credentials), "x-seller-id": secondStore.id }
  const { seller_member } = await expectStatus("/vendor/members/me?fields=id,is_owner,role_id,permissions", { headers }, 200)
  assert.equal(seller_member.role_id, actor.membership.role_id)
  assert.equal(seller_member.is_owner, false)
  actor.secondHeaders = headers
  actor.secondMembership = seller_member
  actor.secondActive = true
}

async function check(actor, action, path, status, { method = "GET", body, permission, headers } = {}) {
  const data = await expectStatus(path, { method, body, headers: headers ?? actor.headers }, status, permission)
  results.push({ role: actor.name, action, status })
  return data
}

try {
  const { seller_member } = await expectStatus("/vendor/members/me?fields=id,is_owner,permissions", { headers: owner.headers }, 200)
  assert(seller_member.is_owner)
  assert.equal(seller_member.permissions?.members, "manage")

  const manager = await createActor("Gestor de inventario", "inventory", SellerRole.INVENTORY_MANAGEMENT)
  const reader = await createActor("Solo lectura", "reader", SellerRole.SUPPORT)
  assert.equal(manager.membership.permissions.inventory_items, "edit")
  assert.equal(reader.membership.permissions.inventory_items, "view")

  await addActorToSecondStore(manager)
  await addActorToSecondStore(reader)
  const secondOwner = { ...owner, headers: { ...owner.headers, "x-seller-id": secondStore.id } }
  const { seller_member: secondOwnerMembership } = await expectStatus("/vendor/members/me?fields=id,is_owner,permissions", { headers: secondOwner.headers }, 200)
  assert(secondOwnerMembership.is_owner)
  const { stock_locations: secondLocations } = await expectStatus("/vendor/stock-locations?fields=id&limit=10", { headers: secondOwner.headers }, 200)
  const secondLocation = secondLocations[0]
  assert(secondLocation)
  const { inventory_item: secondInventoryItem } = await check(secondOwner, "Crear artículo en segunda tienda", "/vendor/inventory-items", 200, {
    method: "POST",
    body: { title: "AgeStyles second-store role verification", sku: `ROLE-TEST-A2-${runId}` },
  })
  secondItemId = secondInventoryItem.id
  const secondItemPath = `/vendor/inventory-items/${secondItemId}`
  await expectStatus(`${secondItemPath}/location-levels`, {
    method: "POST",
    headers: secondOwner.headers,
    body: { location_id: secondLocation.id, stocked_quantity: 12 },
  }, 200)
  const secondLevelPath = `${secondItemPath}/location-levels/${secondLocation.id}`
  const managerSecond = { name: "Gestor (segunda tienda)", headers: manager.secondHeaders }
  const readerSecond = { name: "Solo lectura (segunda tienda)", headers: reader.secondHeaders }
  const secondStoreActors = [
    { ...secondOwner, roleName: "Dueño (segunda tienda)", isOwner: true, canReadProducts: true },
    { ...managerSecond, roleName: "Gestor (segunda tienda)", isOwner: false, canReadProducts: false },
    { ...readerSecond, roleName: "Solo lectura (segunda tienda)", isOwner: false, canReadProducts: true },
  ]
  for (const actor of secondStoreActors) {
    await check(actor, "Leer inventario en segunda tienda", secondItemPath, 200)
    await check(actor, "Listar productos en segunda tienda", "/vendor/products?limit=50&fields=id,title,status,thumbnail,variants.id,variants.title", actor.canReadProducts ? 200 : 403, {
      permission: actor.canReadProducts ? undefined : "products",
    })
    const canReadOrders = actor.isOwner || actor.canReadProducts
    await check(actor, "Listar pedidos en segunda tienda", "/vendor/orders?limit=50&fields=id,display_id,status,created_at,currency_code,total", canReadOrders ? 200 : 403, {
      permission: canReadOrders ? undefined : "orders",
    })
    await check(actor, "Listar ofertas en segunda tienda", "/vendor/offers?limit=1", canReadOrders ? 200 : 403, {
      permission: canReadOrders ? undefined : "offers",
    })
    await check(actor, "Listar miembros en segunda tienda", secondMembersPath, actor.isOwner ? 200 : 403, {
      permission: actor.isOwner ? undefined : "members",
    })
  }
  await check(managerSecond, "Cambiar stock en segunda tienda", secondLevelPath, 200, {
    method: "POST",
    body: { stocked_quantity: 17 },
  })
  await check(readerSecond, "Denegar cambio de stock en segunda tienda", secondLevelPath, 403, {
    method: "POST",
    body: { stocked_quantity: 99 },
    permission: "inventory_items",
  })
  await check({ ...managerSecond, headers: { ...managerSecond.headers, "x-seller-id": otherStore.id } }, "Denegar acceso a tienda de otro propietario", "/vendor/inventory-items", 403, {
  })
  await check({ ...readerSecond, headers: { ...readerSecond.headers, "x-seller-id": otherStore.id } }, "Denegar acceso a tienda de otro propietario", "/vendor/inventory-items", 403, {
  })

  const { stock_locations } = await expectStatus("/vendor/stock-locations?fields=id&limit=1", { headers: owner.headers }, 200)
  const location = stock_locations[0]
  assert(location)
  const { inventory_item } = await check(owner, "Crear artículo", "/vendor/inventory-items", 200, {
    method: "POST",
    body: { title: "AgeStyles role verification", sku: `ROLE-TEST-${runId}` },
  })
  itemId = inventory_item.id
  const itemPath = `/vendor/inventory-items/${itemId}`
  await expectStatus(`${itemPath}/location-levels`, {
    method: "POST",
    headers: owner.headers,
    body: { location_id: location.id, stocked_quantity: 12 },
  }, 200)
  const levelPath = `${itemPath}/location-levels/${location.id}`

  for (const actor of [owner, manager, reader]) {
    await check(actor, "Leer inventario", itemPath, 200)
    await check(actor, "Listar inventario para la app de negocio", "/vendor/inventory-items?limit=50&fields=id,title,sku,location_levels.id,location_levels.location_id,location_levels.stocked_quantity,location_levels.location.name", 200)
    const canReadProducts = actor !== manager
    await check(actor, "Listar productos para la app de negocio", "/vendor/products?limit=50&fields=id,title,status,thumbnail,variants.id,variants.title", canReadProducts ? 200 : 403, {
      permission: canReadProducts ? undefined : "products",
    })
    const canReadOrders = actor !== manager
    await check(actor, "Listar pedidos para la app de negocio", "/vendor/orders?limit=50&fields=id,display_id,status,created_at,currency_code,total", canReadOrders ? 200 : 403, {
      permission: canReadOrders ? undefined : "orders",
    })
    await check(actor, "Listar ofertas", "/vendor/offers?limit=1", canReadOrders ? 200 : 403, {
      permission: canReadOrders ? undefined : "offers",
    })
    const canManageMembers = actor === owner
    await check(actor, "Listar miembros", membersPath, canManageMembers ? 200 : 403, {
      permission: canManageMembers ? undefined : "members",
    })
  }

  for (const [actor, quantity] of [[owner, 13], [manager, 17], [reader, 99]]) {
    const canEdit = actor !== reader
    await check(actor, "Cambiar existencias", levelPath, canEdit ? 200 : 403, {
      method: "POST",
      body: { stocked_quantity: quantity },
      permission: canEdit ? undefined : "inventory_items",
    })
    const { inventory_levels } = await expectStatus(`${itemPath}/location-levels`, { headers: owner.headers }, 200)
    assert.equal(Number(inventory_levels[0].stocked_quantity), canEdit ? quantity : 17)
  }

  for (const actor of [manager, reader]) {
    await check(actor, "Eliminar artículo", itemPath, 403, {
      method: "DELETE",
      permission: "inventory_items",
    })
    await check(actor, "Cambiar rol de un miembro", `${membersPath}/${seller_member.id}`, 403, {
      method: "POST",
      body: { role_id: SellerRole.SELLER_ADMINISTRATION },
      permission: "members",
    })
    await expectStatus("/vendor/inventory-items", {
      headers: { ...actor.headers, "x-seller-id": otherStore.id },
    }, 403)
  }

  const readerPath = `${membersPath}/${reader.membership.id}`
  await check(owner, "Cambiar rol de un miembro", readerPath, 200, {
    method: "POST",
    body: { role_id: SellerRole.INVENTORY_MANAGEMENT },
  })
  const { seller_member: promoted } = await expectStatus("/vendor/members/me?fields=id,role_id,permissions", {
    headers: reader.headers,
  }, 200)
  assert.equal(promoted.role_id, SellerRole.INVENTORY_MANAGEMENT)
  assert.equal(promoted.permissions.inventory_items, "edit")
  await expectStatus(readerPath, {
    method: "POST",
    headers: owner.headers,
    body: { role_id: SellerRole.SUPPORT },
  }, 200)
  await check(reader, "Cambiar existencias tras volver a solo lectura", levelPath, 403, {
    method: "POST",
    body: { stocked_quantity: 99 },
    permission: "inventory_items",
  })

  await check(owner, "Eliminar artículo", itemPath, 200, { method: "DELETE" })
  itemId = undefined

  await check(secondOwner, "Eliminar artículo de segunda tienda", secondItemPath, 200, { method: "DELETE" })
  secondItemId = undefined

  await check(owner, "Revocar acceso de un miembro", readerPath, 200, { method: "DELETE" })
  reader.primaryActive = false
  for (const actor of [manager, reader]) {
    await check(secondOwner, "Revocar acceso en segunda tienda", `${secondMembersPath}/${actor.secondMembership.id}`, 200, { method: "DELETE" })
    actor.secondActive = false
  }
  await check(reader, "Leer inventario con sesión revocada", "/vendor/inventory-items", 403)
  console.table(results)
} finally {
  if (itemId) {
    await expectStatus(`/vendor/inventory-items/${itemId}`, { method: "DELETE", headers: owner.headers }, 200)
  }
  if (secondItemId) {
    await expectStatus(`/vendor/inventory-items/${secondItemId}`, {
      method: "DELETE",
      headers: { ...owner.headers, "x-seller-id": secondStore.id },
    }, 200)
  }
  for (const actor of actors) {
    if (actor.primaryActive) {
      await expectStatus(`${membersPath}/${actor.membership.id}`, { method: "DELETE", headers: owner.headers }, 200)
    }
    if (actor.secondActive) {
      await expectStatus(`${secondMembersPath}/${actor.secondMembership.id}`, {
        method: "DELETE",
        headers: { ...owner.headers, "x-seller-id": secondStore.id },
      }, 200)
    }
  }
}
