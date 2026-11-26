import assert from "node:assert/strict";
import {
  FOLLOW_COPY,
  followButtonLabel,
  followErrorMessage,
  followStore,
  listFollowedStores,
  setStoreAlert,
  unfollowStore,
  type FollowedStore,
} from "../src/store-follows.ts";
import type { Fetcher } from "../src/notifications.ts";

/** Client tests for AG-70. Run with `node test/store-follows.test.ts`. */

const calls: { path: string; init?: { method?: string; body?: unknown } }[] = [];
const store: FollowedStore = {
  seller_id: "sel_01ABCDEFGH",
  name: "Tienda Sol",
  handle: "tienda-sol",
  logo: null,
  notify_new_products: false,
  created_at: "2026-11-26T10:00:00Z",
};
const fetcher: Fetcher = async <T>(path: string, init?: { method?: string; body?: unknown }) => {
  calls.push({ path, init });
  return { follows: [store], follow: store, deleted: true } as T;
};

assert.deepEqual(await listFollowedStores(fetcher), [store]);
assert.equal(calls[0].path, "/store/agestyles/store-follows");

// Following does not send the alert flag unless asked: the server keeps it off
await followStore(fetcher, "sel_01ABCDEFGH");
assert.deepEqual(calls[1].init, { method: "POST", body: { seller_id: "sel_01ABCDEFGH" } });
await followStore(fetcher, "sel_01ABCDEFGH", true);
assert.deepEqual(calls[2].init?.body, { seller_id: "sel_01ABCDEFGH", notify_new_products: true });

await setStoreAlert(fetcher, "sel_01ABCDEFGH", true);
assert.equal(calls[3].path, "/store/agestyles/store-follows/sel_01ABCDEFGH");
assert.deepEqual(calls[3].init, { method: "POST", body: { notify_new_products: true } });

await unfollowStore(fetcher, "sel_01ABCDEFGH");
assert.equal(calls[4].init?.method, "DELETE");

// Spanish copy and errors: never the raw backend text
assert.equal(FOLLOW_COPY.followed("Tienda Sol"), "Sigues a Tienda Sol");
assert.match(FOLLOW_COPY.alertOn("Tienda Sol"), /productos nuevos de Tienda Sol/);
assert.equal(followErrorMessage({ status: 401 }), FOLLOW_COPY.signedOut);
assert.equal(
  followErrorMessage(new Error("Puedes seguir como máximo 200 tiendas.")),
  FOLLOW_COPY.limit,
);
assert.equal(followErrorMessage(new Error("TypeError: boom at db.ts:1")), FOLLOW_COPY.failed);
assert.equal(followErrorMessage(undefined), FOLLOW_COPY.failed);

assert.deepEqual(followButtonLabel(false, "Tienda Sol"), {
  text: "Seguir",
  accessibility: "Seguir a Tienda Sol",
});
assert.deepEqual(followButtonLabel(true, "Tienda Sol"), {
  text: "Siguiendo",
  accessibility: "Dejar de seguir a Tienda Sol",
});

console.log("api-client store-follows: ok");
