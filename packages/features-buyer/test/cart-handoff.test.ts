import assert from "node:assert/strict";
import test from "node:test";
import { buildHandoffUrl, parseHandoffCartId, withoutHandoffParam } from "../src/cart-handoff.ts";

test("reads a well-formed cart id from the query string", () => {
  assert.equal(parseHandoffCartId("?cart=cart_01JABCDEF123456"), "cart_01JABCDEF123456");
  assert.equal(parseHandoffCartId("cart=cart_01JABCDEF123456&x=1"), "cart_01JABCDEF123456");
});

test("ignores missing, short, foreign or injected values", () => {
  for (const search of [
    "",
    "?",
    "?cart=",
    "?cart=cart_1",
    "?cart=order_01JABCDEF123456",
    "?cart=cart_01JABCDEF123456%2F..%2Fadmin",
    "?cart=cart_01JABCDEF123456<script>",
    "?other=cart_01JABCDEF123456",
  ]) {
    assert.equal(parseHandoffCartId(search), null, search);
  }
});

test("builds the link to Tienda and rejects anything that is not a cart id", () => {
  assert.equal(
    buildHandoffUrl("https://tienda.eav-labs.com/", "cart_01JABCDEF123456"),
    "https://tienda.eav-labs.com/?cart=cart_01JABCDEF123456",
  );
  assert.equal(buildHandoffUrl("https://tienda.eav-labs.com", "../x"), null);
  assert.equal(buildHandoffUrl("https://tienda.eav-labs.com", "order_01JABCDEF123456"), null);
});

test("drops only the handoff parameter from the address", () => {
  assert.equal(withoutHandoffParam("/?cart=cart_01JABCDEF123456"), "/");
  assert.equal(
    withoutHandoffParam("/account?cart=cart_01JABCDEF123456&x=1#top"),
    "/account?x=1#top",
  );
  assert.equal(withoutHandoffParam("/account?x=1"), "/account?x=1");
});
