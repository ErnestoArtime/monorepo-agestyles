import assert from "node:assert/strict";
import { test } from "node:test";
import {
  followResponse,
  listFollowsResponse,
  notifyFollowersOfNewProduct,
  setNotifyResponse,
  unfollowResponse,
} from "../src/lib/store-follows.ts";

/** AG-70: server flow with in-memory stand-ins for the query graph, the follows and the avisos. */
const NOW = new Date("2026-11-26T12:00:00Z");
const SELLER = "sel_01OPENSTORE1";
const CLOSED = "sel_01CLOSEDSTORE";

function world({ product, status = "open" } = {}) {
  const follows = [];
  const sent = [];
  const seen = new Set();
  const sellers = [
    { id: SELLER, name: "Tienda Sol", handle: "sol", status, logo: null },
    { id: CLOSED, name: "Cerrada", handle: "c", status: "suspended", logo: null },
  ];
  const service = {
    async listFollows(customerId) {
      return follows.filter((row) => row.customer_id === customerId);
    },
    async follow(customerId, sellerId, notify) {
      const existing = follows.find(
        (r) => r.customer_id === customerId && r.seller_id === sellerId,
      );
      if (existing) {
        if (notify !== undefined) existing.notify_new_products = notify;
        return { follow: existing, created: false };
      }
      const row = {
        customer_id: customerId,
        seller_id: sellerId,
        notify_new_products: notify ?? false,
        created_at: NOW,
      };
      follows.push(row);
      return { follow: row, created: true };
    },
    async setNotify(customerId, sellerId, enabled) {
      const row = follows.find((r) => r.customer_id === customerId && r.seller_id === sellerId);
      if (!row) throw new Error("No sigues esta tienda.");
      row.notify_new_products = enabled;
      return row;
    },
    async unfollow(customerId, sellerId) {
      const index = follows.findIndex(
        (r) => r.customer_id === customerId && r.seller_id === sellerId,
      );
      if (index < 0) return false;
      follows.splice(index, 1);
      return true;
    },
    async notifiableCustomerIds(sellerId) {
      return follows
        .filter((r) => r.seller_id === sellerId && r.notify_new_products)
        .map((r) => r.customer_id);
    },
  };
  const notifications = {
    // Same contract as the real service: a repeated dedupe key creates nothing.
    async notify(input) {
      if (seen.has(input.dedupe_key)) return null;
      seen.add(input.dedupe_key);
      sent.push(input);
      return input;
    },
  };
  const graph = async ({ entity, filters }) => {
    if (entity === "seller") {
      const ids = [].concat(filters.id);
      return { data: sellers.filter((seller) => ids.includes(seller.id)) };
    }
    if (entity === "product") return { data: product ? [product] : [] };
    if (entity === "product_seller") return { data: [{ seller_id: SELLER }] };
    return { data: [] };
  };
  const scope = {
    resolve: (key) =>
      key === "query" ? { graph } : key === "agestylesStoreFollows" ? service : notifications,
  };
  return { scope, follows, sent };
}

const fresh = {
  id: "prod_1",
  title: "Lámpara",
  status: "published",
  created_at: "2026-11-25T09:00:00Z",
};

test("following starts with the alert off and only an open store can be followed", async () => {
  const { scope, follows } = world();
  const { follow, created } = await followResponse(scope, "cus_1", { seller_id: SELLER });
  assert.equal(created, true);
  assert.equal(follow.notify_new_products, false);
  assert.equal(follow.name, "Tienda Sol");
  assert.equal(follows.length, 1);
  await assert.rejects(
    followResponse(scope, "cus_1", { seller_id: CLOSED }),
    /Tienda no encontrada/,
  );
  await assert.rejects(
    followResponse(scope, "cus_1", { seller_id: "sel_01UNKNOWNSTORE" }),
    /Tienda no encontrada/,
  );
  await assert.rejects(
    followResponse(scope, "cus_1", { seller_id: "nope" }),
    /tienda que quieres seguir/,
  );
  assert.equal(follows.length, 1);
});

test("a customer only sees and changes their own follows", async () => {
  const { scope } = world();
  await followResponse(scope, "cus_1", { seller_id: SELLER, notify_new_products: true });
  assert.deepEqual((await listFollowsResponse(scope, "cus_2")).follows, []);
  assert.equal((await listFollowsResponse(scope, "cus_1")).follows[0].notify_new_products, true);
  assert.deepEqual(await unfollowResponse(scope, "cus_2", SELLER), { deleted: false });
  assert.equal((await listFollowsResponse(scope, "cus_1")).follows.length, 1);
  await assert.rejects(
    setNotifyResponse(scope, "cus_2", SELLER, { notify_new_products: true }),
    /No sigues/,
  );
  await assert.rejects(
    setNotifyResponse(scope, "cus_1", SELLER, { notify_new_products: "yes" }),
    /avisos/,
  );
  const { follow } = await setNotifyResponse(scope, "cus_1", SELLER, {
    notify_new_products: false,
  });
  assert.equal(follow.notify_new_products, false);
  assert.deepEqual(await unfollowResponse(scope, "cus_1", SELLER), { deleted: true });
});

test("a recent published product alerts only followers who turned the alert on", async () => {
  const { scope, sent } = world({ product: fresh });
  await followResponse(scope, "cus_on", { seller_id: SELLER, notify_new_products: true });
  await followResponse(scope, "cus_off", { seller_id: SELLER });
  assert.equal(await notifyFollowersOfNewProduct(scope, "prod_1", NOW), 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient_id, "cus_on");
  assert.equal(sent[0].recipient_type, "customer");
  assert.equal(sent[0].event_code, "followed_store_new_product");
  assert.deepEqual(sent[0].params, {
    store: "Tienda Sol",
    product: "Lámpara",
    product_id: "prod_1",
  });
  assert.equal(sent[0].dedupe_key, "followed_store_new_product:prod_1:cus_on");
});

test("the same product never alerts the same customer twice", async () => {
  const { scope, sent } = world({ product: fresh });
  await followResponse(scope, "cus_on", { seller_id: SELLER, notify_new_products: true });
  await notifyFollowersOfNewProduct(scope, "prod_1", NOW);
  await notifyFollowersOfNewProduct(scope, "prod_1", NOW); // retry or a second publication
  assert.equal(sent.length, 1);
});

test("old, unpublished or closed-store products alert nobody", async () => {
  const cases = [
    [{ ...fresh, created_at: "2026-10-01T00:00:00Z" }, "open", "older than 14 days"],
    [{ ...fresh, status: "draft" }, "open", "not published"],
    [{ ...fresh, created_at: undefined }, "open", "undated"],
    [fresh, "suspended", "store not open"],
    [undefined, "open", "unknown product"],
  ];
  for (const [product, status, label] of cases) {
    const { scope, follows, sent } = world({ product, status });
    // The follow already exists (made while the store was open, or before this shipped).
    follows.push({ customer_id: "cus_on", seller_id: SELLER, notify_new_products: true });
    assert.equal(await notifyFollowersOfNewProduct(scope, "prod_1", NOW), 0, label);
    assert.equal(sent.length, 0, label);
  }
});
