import assert from "node:assert/strict"
import { SellerRole } from "@mercurjs/types"

const base = process.env.EXPO_PUBLIC_MEDUSA_URL
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY
const email = process.env.DUAL_AUTH_LAB_EMAIL
const password = process.env.DUAL_AUTH_LAB_PASSWORD
const seededPassword = process.env.AGESTYLES_LAB_SEEDED_PASSWORD

assert.equal(base, "http://127.0.0.1:19081", "Use the isolated Mercur lab only")
assert(publishableKey?.startsWith("pk_"), "Set the lab publishable key")
assert(email?.endsWith("@agestyles.example"), "Use a disposable @agestyles.example identity")
assert(password?.length >= 12, "Set a disposable lab password with at least 12 characters")
assert(seededPassword?.length >= 12, "Set AGESTYLES_LAB_SEEDED_PASSWORD in a private local env file")

async function request(path, { method = "GET", token, sellerId, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-publishable-api-key": publishableKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(sellerId ? { "x-seller-id": sellerId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json().catch(() => ({})) }
}

function requireStatus(result, expected, label) {
  assert.equal(result.status, expected, `${label}: ${result.data.message ?? result.status}`)
  return result.data
}

const owner = requireStatus(await request("/auth/member/emailpass", {
  method: "POST",
  body: { email: "seller@mercur.dev", password: seededPassword },
}), 200, "Authenticate lab seller owner")
const ownerToken = owner.token
const memberships = requireStatus(await request("/vendor/sellers?limit=20", { token: ownerToken }), 200, "List owner stores")
const seller = memberships.seller_members.find(({ seller }) => seller?.name === "Sole Society")?.seller
assert(seller?.id, "The primary lab seller is required")

let customerToken
const customerRegistration = await request("/auth/customer/emailpass/register", {
  method: "POST",
  body: { email, password },
})
if ([200, 201].includes(customerRegistration.status)) {
  const created = await request("/store/customers", {
    method: "POST",
    token: customerRegistration.data.token,
    body: { email, first_name: "Lab", last_name: "Dual Actor" },
  })
  assert([200, 201].includes(created.status), `Create buyer profile: ${created.data.message ?? created.status}`)
} else {
  assert.equal(customerRegistration.status, 401)
  assert.match(customerRegistration.data.message ?? "", /Identity with email already exists/)
}
const customerLogin = requireStatus(await request("/auth/customer/emailpass", {
  method: "POST",
  body: { email, password },
}), 200, "Authenticate buyer actor")
customerToken = customerLogin.token
requireStatus(await request("/store/customers/me", { token: customerToken }), 200, "Read buyer profile")

let memberId
try {
  const invitation = requireStatus(await request(`/vendor/sellers/${seller.id}/members`, {
    method: "POST",
    token: ownerToken,
    sellerId: seller.id,
    body: { email, role_id: SellerRole.SUPPORT },
  }), 201, "Invite existing buyer to seller account")
  assert(invitation.member_invite?.token)

  const secondRegistration = await request("/auth/member/emailpass/register", {
    method: "POST",
    body: { email, password },
  })
  assert.equal(secondRegistration.status, 401, "The same email identity must be reused, not registered twice")
  assert.match(secondRegistration.data.message ?? "", /Identity with email already exists/)

  const memberLogin = requireStatus(await request("/auth/member/emailpass", {
    method: "POST",
    body: { email, password },
  }), 200, "Authenticate member actor")
  requireStatus(await request("/vendor/members/invites/accept", {
    method: "POST",
    token: memberLogin.token,
    body: { invite_token: invitation.member_invite.token, first_name: "Lab Dual" },
  }), 200, "Link existing identity to seller membership")

  const memberRelogin = requireStatus(await request("/auth/member/emailpass", {
    method: "POST",
    body: { email, password },
  }), 200, "Refresh member actor session after accepting invitation")
  const sellerMemberships = requireStatus(await request("/vendor/sellers?limit=20", {
    token: memberRelogin.token,
  }), 200, "Read seller memberships")
  assert(sellerMemberships.seller_members.some(({ seller: item }) => item?.id === seller.id))
  requireStatus(await request("/store/customers/me", { token: customerToken }), 200, "Preserve buyer actor session")

  const customerToSeller = await request("/vendor/sellers?limit=20", { token: customerToken })
  const memberToCustomer = await request("/store/customers/me", { token: memberRelogin.token })
  assert([401, 403].includes(customerToSeller.status), "Buyer token must not authorize seller API")
  assert([401, 403].includes(memberToCustomer.status), "Member token must not authorize buyer API")

  const memberMe = requireStatus(await request("/vendor/members/me?fields=id", {
    token: memberRelogin.token,
    sellerId: seller.id,
  }), 200, "Find temporary seller membership")
  memberId = memberMe.seller_member?.id ?? memberMe.member?.id
  assert(memberId, "Temporary membership ID is required for cleanup")
  console.log("Dual actor identity passed: one email/password, linked buyer+seller actors, independent sessions, cross-actor access denied.")
} finally {
  if (memberId) {
    requireStatus(await request(`/vendor/sellers/${seller.id}/members/${memberId}`, {
      method: "DELETE",
      token: ownerToken,
      sellerId: seller.id,
    }), 200, "Remove temporary seller membership")
  }
}
