import assert from "node:assert/strict"
import { BUSINESS_BUYER_SESSION_PREFIX, createBuyerActorStorage } from "../src/business-buyer-session.ts"

{
  const values = new Map<string, string>([["agestyles.business.actor.token", "member-token"]])
  const storage = {
    async getItem(key: string) { return values.get(key) ?? null },
    async setItem(key: string, value: string) { values.set(key, value) },
    async removeItem(key: string) { values.delete(key) },
  }
  const customerStorage = createBuyerActorStorage(storage)

  await customerStorage.setItem("token", "customer-token")

  assert.equal(await customerStorage.getItem("token"), "customer-token")
  assert.equal(values.get("agestyles.business.actor.token"), "member-token")
  assert.equal(values.get(`${BUSINESS_BUYER_SESSION_PREFIX}token`), "customer-token")

  await customerStorage.removeItem("token")

  assert.equal(await customerStorage.getItem("token"), null)
  assert.equal(values.get("agestyles.business.actor.token"), "member-token")
}
