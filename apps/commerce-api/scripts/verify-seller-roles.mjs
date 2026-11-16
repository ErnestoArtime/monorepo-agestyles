import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { SellerRole } from "@mercurjs/types"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const key = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
assert.equal(base, "http://127.0.0.1:19080", "Use the local Mercur lab only")
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
    ...await authenticate({ email: "seller@mercur.dev", password: "supersecret" }),
    "x-seller-id": store.id,
  },
}
const membersPath = `/vendor/sellers/${store.id}/members`
const actors = []
let itemId

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
  actors.push({ name, headers, membership: seller_member })
  assert.equal(seller_member.role_id, role)
  assert.equal(seller_member.is_owner, false)
  return actors.at(-1)
}

async function check(actor, action, path, status, { method = "GET", body, permission } = {}) {
  const data = await expectStatus(path, { method, body, headers: actor.headers }, status, permission)
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
    const canReadOrders = actor !== manager
    await check(actor, "Listar pedidos", "/vendor/orders?limit=1", canReadOrders ? 200 : 403, {
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

  await check(owner, "Revocar acceso de un miembro", readerPath, 200, { method: "DELETE" })
  actors.splice(actors.indexOf(reader), 1)
  await check(reader, "Leer inventario con sesión revocada", "/vendor/inventory-items", 403)
  console.table(results)
} finally {
  if (itemId) {
    await expectStatus(`/vendor/inventory-items/${itemId}`, { method: "DELETE", headers: owner.headers }, 200)
  }
  for (const actor of actors) {
    await expectStatus(`${membersPath}/${actor.membership.id}`, { method: "DELETE", headers: owner.headers }, 200)
  }
}
