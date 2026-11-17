import assert from "node:assert/strict";
import {
  BUSINESS_BUYER_SESSION_PREFIX,
  createBuyerActorStorage,
  loginBusinessAndBuyerActors,
} from "../src/business-buyer-session.ts";

{
  const values = new Map<string, string>([["agestyles.business.actor.token", "member-token"]]);
  const storage = {
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
  const customerStorage = createBuyerActorStorage(storage);

  await customerStorage.setItem("token", "customer-token");

  assert.equal(await customerStorage.getItem("token"), "customer-token");
  assert.equal(values.get("agestyles.business.actor.token"), "member-token");
  assert.equal(values.get(`${BUSINESS_BUYER_SESSION_PREFIX}token`), "customer-token");

  await customerStorage.removeItem("token");

  assert.equal(await customerStorage.getItem("token"), null);
  assert.equal(values.get("agestyles.business.actor.token"), "member-token");
}

{
  const calls: [string, string, { email: string; password: string }][] = [];
  const credentials = { email: "person@example.test", password: "synthetic-password" };
  const businessSdk = {
    auth: {
      async login(actor: "member", provider: string, input: typeof credentials) {
        calls.push([actor, provider, input]);
        return "member-token";
      },
    },
  };
  const buyerSdk = {
    auth: {
      async login(actor: "customer", provider: string, input: typeof credentials) {
        calls.push([actor, provider, input]);
        return "customer-token";
      },
      async logout() {},
    },
    store: {
      customer: {
        async retrieve() {
          return { customer: { id: "cus_test", email: credentials.email } };
        },
      },
    },
  };

  const result = await loginBusinessAndBuyerActors(
    credentials.email,
    credentials.password,
    businessSdk,
    buyerSdk,
  );

  assert.deepEqual(result, { businessAuthenticated: true, buyerAuthenticated: true });
  assert.deepEqual(calls, [
    ["member", "emailpass", credentials],
    ["customer", "emailpass", credentials],
  ]);
}

{
  let buyerLoginAttempted = false;
  const businessSdk = {
    auth: {
      async login() {
        return "member-token";
      },
    },
  };
  const buyerSdk = {
    auth: {
      async login() {
        buyerLoginAttempted = true;
        throw new Error("customer actor is not linked");
      },
      async logout() {},
    },
    store: {
      customer: {
        async retrieve() {
          throw new Error("not signed in");
        },
      },
    },
  };

  const result = await loginBusinessAndBuyerActors(
    "person@example.test",
    "synthetic-password",
    businessSdk,
    buyerSdk,
  );

  assert.deepEqual(result, { businessAuthenticated: true, buyerAuthenticated: false });
  assert.equal(buyerLoginAttempted, true);
}

{
  let buyerLoginAttempted = false;
  const businessSdk = {
    auth: {
      async login() {
        throw new Error("invalid member credentials");
      },
    },
  };
  const buyerSdk = {
    auth: {
      async login() {
        buyerLoginAttempted = true;
        return "customer-token";
      },
      async logout() {},
    },
    store: {
      customer: {
        async retrieve() {
          return { customer: { id: "cus_test", email: "person@example.test" } };
        },
      },
    },
  };

  await assert.rejects(
    loginBusinessAndBuyerActors("person@example.test", "synthetic-password", businessSdk, buyerSdk),
    /invalid member credentials/,
  );
  assert.equal(buyerLoginAttempted, false);
}
