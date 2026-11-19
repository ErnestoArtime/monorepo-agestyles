import assert from "node:assert/strict";
import test from "node:test";
import { createBuyerCartFeature } from "../src/cart.ts";

function createFixture(responses: unknown[], initialStorage: Record<string, string> = {}) {
  const calls: { path: string; options: unknown }[] = [];
  const values = new Map(Object.entries(initialStorage));
  const client = {
    async fetch(path: string, options?: unknown) {
      calls.push({ path, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
  };
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

  return {
    feature: createBuyerCartFeature(client as never, storage, "buyer.cart"),
    calls,
    values,
  };
}

test("loadOrCreate reuses the saved cart and preserves its storage key", async () => {
  const cart = { id: "cart_existing", region_id: "reg_eu" };
  const { feature, calls, values } = createFixture([{ cart }], { "buyer.cart": cart.id });

  assert.deepEqual(await feature.loadOrCreate("reg_eu"), cart);
  assert.deepEqual(calls, [
    {
      path: "/store/carts/cart_existing",
      options: { query: { fields: "+items.*" } },
    },
  ]);
  assert.equal(values.get("buyer.cart"), cart.id);
});

test("loadOrCreate drops an invalid saved cart before creating a regional cart", async () => {
  const cart = { id: "cart_new", region_id: "reg_us" };
  const { feature, calls, values } = createFixture([new Error("stale cart"), { cart }], {
    "buyer.cart": "cart_expired",
  });

  assert.deepEqual(await feature.loadOrCreate("reg_us"), cart);
  assert.deepEqual(calls, [
    {
      path: "/store/carts/cart_expired",
      options: { query: { fields: "+items.*" } },
    },
    {
      path: "/store/carts",
      options: {
        method: "POST",
        query: { fields: "+items.*" },
        body: { region_id: "reg_us" },
      },
    },
  ]);
  assert.equal(values.get("buyer.cart"), cart.id);
});

test("clear removes storage and avoids creating a cart without a region", async () => {
  const { feature, calls, values } = createFixture([], { "buyer.cart": "cart_old" });

  assert.equal(await feature.clear(), null);
  assert.equal(values.has("buyer.cart"), false);
  assert.deepEqual(calls, []);
});

test("clear creates and persists a new cart when a region is available", async () => {
  const cart = { id: "cart_fresh", region_id: "reg_eu" };
  const { feature, calls, values } = createFixture([{ cart }], { "buyer.cart": "cart_old" });

  assert.deepEqual(await feature.clear("reg_eu"), cart);
  assert.equal(values.get("buyer.cart"), cart.id);
  assert.equal(calls[0]?.path, "/store/carts");
});

test("transfer persists the cart and addOffer appends offers from two sellers", async () => {
  const transferredCart = { id: "cart_transferred", region_id: "reg_eu" };
  const cartWithSellerA = { id: "cart_transferred", items: [{ id: "line_a" }] };
  const cartWithBothSellers = {
    id: "cart_transferred",
    items: [{ id: "line_a" }, { id: "line_b" }],
  };
  const { feature, calls, values } = createFixture([
    { cart: transferredCart },
    { cart: cartWithSellerA },
    { cart: cartWithBothSellers },
  ]);

  assert.deepEqual(await feature.transfer("cart_guest"), transferredCart);
  assert.equal(values.get("buyer.cart"), transferredCart.id);
  assert.deepEqual(
    await feature.addOffer("cart_transferred", "offer_seller_a", 1),
    cartWithSellerA,
  );
  assert.deepEqual(
    await feature.addOffer("cart_transferred", "offer_seller_b", 2),
    cartWithBothSellers,
  );
  assert.deepEqual(calls[0], {
    path: "/store/carts/cart_guest/customer",
    options: { method: "POST", query: { fields: "+items.*" } },
  });
  assert.deepEqual(calls[1], {
    path: "/store/carts/cart_transferred/line-items",
    options: {
      method: "POST",
      query: { fields: "+items.*" },
      body: { offer_id: "offer_seller_a", quantity: 1 },
    },
  });
  assert.deepEqual(calls[2], {
    path: "/store/carts/cart_transferred/line-items",
    options: {
      method: "POST",
      query: { fields: "+items.*" },
      body: { offer_id: "offer_seller_b", quantity: 2 },
    },
  });
});
