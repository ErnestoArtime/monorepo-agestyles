import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSellerId,
  parseInfoBody,
  readPublicInfo,
  readSellerInfo,
} from "../src/lib/store-info.ts";

const info = {
  fulfillment: { pickup: true, delivery: false, delivery_note: null },
  phones: ["+5352497039"],
  address: { line: "Calle 26 #102A", area: "Miramar", city: "La Habana", reference: null },
};

/** A container whose query returns the given sellers, filtered like Medusa's graph would. */
const scopeWith = (sellers) => ({
  resolve: () => ({
    graph: async ({ filters }) => ({
      data: sellers.filter((seller) =>
        Object.entries(filters).every(([key, value]) => seller[key] === value),
      ),
    }),
  }),
});
const seller = (extra) => ({
  id: "sel_ABC",
  handle: "dulceria",
  status: "open",
  metadata: { agestyles_info: info, other: "kept" },
  ...extra,
});

test("a buyer sees the information of an open store, by id or by handle", async () => {
  const scope = scopeWith([seller()]);
  const byId = await readPublicInfo(scope, { sellerId: "sel_ABC" });
  assert.equal(byId?.seller_id, "sel_ABC");
  assert.deepEqual(byId?.info.phones, ["+5352497039"]);
  assert.equal(byId?.info.fulfillment.pickup, true);
  assert.equal((await readPublicInfo(scope, { handle: "dulceria" }))?.seller_id, "sel_ABC");
});

test("a buyer sees nothing for a pending or suspended store, an unknown one or an empty one", async () => {
  for (const status of ["pending_approval", "suspended", "terminated"]) {
    const scope = scopeWith([seller({ status })]);
    assert.equal(await readPublicInfo(scope, { sellerId: "sel_ABC" }), null, status);
  }
  assert.equal(await readPublicInfo(scopeWith([]), { handle: "nadie" }), null);
  const empty = scopeWith([seller({ metadata: {} })]);
  assert.equal(await readPublicInfo(empty, { sellerId: "sel_ABC" }), null);
  const broken = scopeWith([seller({ metadata: { agestyles_info: "basura" } })]);
  assert.equal(await readPublicInfo(broken, { sellerId: "sel_ABC" }), null);
});

test("the team always reads its own information, empty when nothing is stored", async () => {
  const stored = await readSellerInfo(scopeWith([seller()]), "sel_ABC");
  assert.equal(stored.address.area, "Miramar");
  const blank = await readSellerInfo(scopeWith([seller({ metadata: null })]), "sel_ABC");
  assert.deepEqual(blank.phones, []);
  await assert.rejects(readSellerInfo(scopeWith([]), "sel_NOPE"), /Store not found/);
});

test("an editor's body is validated with a Spanish message and a 400", async () => {
  const parsed = await parseInfoBody({
    phones: ["+53 5249 7039"],
    socials: { instagram: "@tienda" },
  });
  assert.deepEqual(parsed.phones, ["+5352497039"]);
  assert.equal(parsed.socials.instagram, "https://instagram.com/tienda");
  await assert.rejects(parseInfoBody({ email: "no-es-correo" }), (error) => {
    assert.match(error.message, /correo/);
    assert.equal(error.type, "invalid_data");
    return true;
  });
  await assert.rejects(parseInfoBody(null), /Faltan los datos/);
});

test("only well-formed seller ids are accepted", () => {
  assert.equal(isSellerId("sel_01ABC"), true);
  for (const value of ["", "sel_", "seller_1", "sel_1; drop", null, undefined, 42]) {
    assert.equal(isSellerId(value), false);
  }
});

test("the WhatsApp already used by the order links pre-fills the information", async () => {
  const legacy = scopeWith([seller({ metadata: { whatsapp_phone: "5352497039" } })]);
  assert.equal((await readSellerInfo(legacy, "sel_ABC")).whatsapp, "5352497039");
  const publicInfo = await readPublicInfo(legacy, { sellerId: "sel_ABC" });
  assert.equal(publicInfo?.info.whatsapp, "5352497039");
  // What the store typed in the information wins over the old value.
  const both = scopeWith([
    seller({ metadata: { whatsapp_phone: "111", agestyles_info: { whatsapp: "+34600111222" } } }),
  ]);
  assert.equal((await readSellerInfo(both, "sel_ABC")).whatsapp, "+34600111222");
});
