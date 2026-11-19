import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePeople, parsePeopleAction, PeopleError } from "../src/lib/people.ts";

test("merges customers, administrators and store members by email", () => {
  const people = mergePeople({
    customers: [
      {
        id: "cus_1",
        email: "Ana@Example.com ",
        first_name: "Ana",
        created_at: "2026-11-01T00:00:00Z",
        metadata: { legacy_role: "admin" },
      },
      { id: "cus_2", email: "luis@example.com", created_at: "2026-11-02T00:00:00Z" },
      { id: "cus_3", email: "", first_name: "Sin correo" },
    ],
    users: [{ id: "user_1", email: "ana@example.com", last_name: "Pérez" }],
    sellerMembers: [
      {
        id: "sm_2",
        role_id: "role_seller_support",
        seller: { id: "sel_b", name: "Zapatos" },
        member: { id: "mem_1", email: "ana@example.com" },
      },
      {
        id: "sm_1",
        is_owner: true,
        role_id: null,
        seller: { id: "sel_a", name: "Ana Moda" },
        member: { id: "mem_1", email: "ana@example.com" },
      },
      { id: "sm_3", seller: null, member: { id: "mem_x", email: "x@example.com" } },
    ],
    passwordEmails: ["ANA@example.com"],
  });

  assert.equal(people.length, 2);
  const [ana, luis] = people;
  assert.equal(ana.email, "ana@example.com");
  assert.equal(ana.first_name, "Ana");
  assert.equal(ana.last_name, "Pérez");
  assert.equal(ana.customer_id, "cus_1");
  assert.equal(ana.user_id, "user_1");
  assert.equal(ana.has_password, true);
  assert.equal(ana.legacy_role, "admin");
  assert.deepEqual(
    ana.stores.map((store) => [store.seller_name, store.is_owner]),
    [
      ["Ana Moda", true],
      ["Zapatos", false],
    ],
  );
  assert.equal(luis.has_password, false);
  assert.deepEqual(luis.stores, []);
});

test("validates people actions", () => {
  assert.deepEqual(parsePeopleAction({ action: "grant_admin", email: " A@B.com" }), {
    action: "grant_admin",
    email: "a@b.com",
  });
  assert.deepEqual(
    parsePeopleAction({
      action: "add_to_store",
      email: "a@b.com",
      seller_id: "sel_1",
      role_id: "role_seller_support",
    }),
    {
      action: "add_to_store",
      email: "a@b.com",
      seller_id: "sel_1",
      role_id: "role_seller_support",
    },
  );
  for (const body of [
    { action: "grant_admin" },
    { action: "drop_tables", email: "a@b.com" },
    { action: "add_to_store", email: "a@b.com", seller_id: "sel_1", role_id: "role_owner" },
    { action: "change_role", email: "a@b.com", role_id: "role_seller_support" },
  ]) {
    assert.throws(() => parsePeopleAction(body), PeopleError);
  }
});
