import assert from "node:assert/strict";
import test from "node:test";
import { SellerRole } from "@mercurjs/types";
import SellerPermissionsService from "../src/modules/seller-permissions/service.ts";

const catalog = [
  { key: "products", surface: ["vendor", "admin"], rights: ["view", "edit"] },
  { key: "inventory_items", surface: ["vendor", "admin"], rights: ["view", "edit"] },
  { key: "reservations", surface: ["vendor", "admin"], rights: ["view", "edit"] },
  { key: "stock_locations", surface: ["vendor", "admin"], rights: ["view", "edit"] },
  { key: "offers", surface: ["vendor", "admin"], rights: ["view", "edit"] },
  { key: "orders", surface: ["vendor", "admin"], rights: ["view", "edit"] },
  { key: "admin_settings", surface: ["admin"], rights: ["view", "edit"] },
];

function makeActor(overrides = {}) {
  return {
    actor_id: "mem_owner",
    actor_type: "member",
    seller_id: "seller_a1",
    seller_member_id: "sm_owner_a1",
    surface: "vendor",
    ...overrides,
  };
}

function makeService(memberships = [], { ignoreFilters = false } = {}) {
  const calls = [];
  const service = new SellerPermissionsService({
    seller: {
      async listSellerMembers(filters) {
        calls.push(filters);
        if (ignoreFilters) return memberships;
        return memberships.filter(
          (membership) =>
            membership.id === filters.id &&
            membership.member_id === filters.member_id &&
            membership.seller_id === filters.seller_id,
        );
      },
    },
  });
  return { service, calls };
}

test("owner receives the vendor catalog's highest rights for the selected store", async () => {
  const { service, calls } = makeService([
    {
      id: "sm_owner_a1",
      member_id: "mem_owner",
      seller_id: "seller_a1",
      is_owner: true,
      role_id: null,
    },
  ]);
  const permissions = await service.resolvePermissions(makeActor(), catalog);
  assert.deepEqual(permissions, {
    products: "edit",
    inventory_items: "edit",
    reservations: "edit",
    stock_locations: "edit",
    offers: "edit",
    orders: "edit",
  });
  assert.deepEqual(calls, [{ id: "sm_owner_a1", member_id: "mem_owner", seller_id: "seller_a1" }]);
});

test("inventory manager can edit inventory but only view locations and reservations", async () => {
  const { service } = makeService([
    {
      id: "sm_inventory_a1",
      member_id: "mem_inventory",
      seller_id: "seller_a1",
      is_owner: false,
      role_id: SellerRole.INVENTORY_MANAGEMENT,
    },
  ]);
  assert.deepEqual(
    await service.resolvePermissions(
      makeActor({
        actor_id: "mem_inventory",
        seller_member_id: "sm_inventory_a1",
      }),
      catalog,
    ),
    {
      inventory_items: "edit",
      reservations: "view",
      stock_locations: "view",
    },
  );
});

test("read-only support member cannot edit catalog, orders, or inventory", async () => {
  const { service } = makeService([
    {
      id: "sm_viewer_a1",
      member_id: "mem_viewer",
      seller_id: "seller_a1",
      is_owner: false,
      role_id: SellerRole.SUPPORT,
    },
  ]);
  assert.deepEqual(
    await service.resolvePermissions(
      makeActor({ actor_id: "mem_viewer", seller_member_id: "sm_viewer_a1" }),
      catalog,
    ),
    {
      inventory_items: "view",
      stock_locations: "view",
      products: "view",
      offers: "view",
      orders: "view",
    },
  );
});

test("admin user gets the permissions declared for the admin surface without a seller lookup", async () => {
  const { service, calls } = makeService();
  assert.deepEqual(
    await service.resolvePermissions(
      makeActor({ surface: "admin", actor_type: "user", actor_id: "admin_1" }),
      catalog,
    ),
    {
      products: "edit",
      inventory_items: "edit",
      reservations: "edit",
      stock_locations: "edit",
      offers: "edit",
      orders: "edit",
      admin_settings: "edit",
    },
  );
  assert.equal(calls.length, 0);
});

test("invalid actors, unknown roles, and a changed store ID receive no permissions", async () => {
  const memberships = [
    {
      id: "sm_manager_a1",
      member_id: "mem_manager",
      seller_id: "seller_a1",
      is_owner: false,
      role_id: "role_unrecognized",
    },
  ];
  const { service, calls } = makeService(memberships);

  assert.deepEqual(await service.resolvePermissions(makeActor({ seller_id: "" }), catalog), {});
  assert.deepEqual(
    await service.resolvePermissions(makeActor({ actor_type: "user" }), catalog),
    {},
  );
  assert.deepEqual(
    await service.resolvePermissions(
      makeActor({
        actor_id: "mem_manager",
        seller_id: "seller_b1",
        seller_member_id: "sm_manager_a1",
      }),
      catalog,
    ),
    {},
  );
  assert.deepEqual(
    await service.resolvePermissions(
      makeActor({ actor_id: "mem_manager", seller_member_id: "sm_manager_a1" }),
      catalog,
    ),
    {},
  );
  assert.deepEqual(calls, [
    {
      id: "sm_manager_a1",
      member_id: "mem_manager",
      seller_id: "seller_b1",
    },
    {
      id: "sm_manager_a1",
      member_id: "mem_manager",
      seller_id: "seller_a1",
    },
  ]);
});

test("a membership result for another member, store, or membership ID grants no rights", async () => {
  const actor = makeActor({ actor_id: "mem_manager", seller_member_id: "sm_manager_a1" });
  const mismatchedMemberships = [
    { id: "sm_other_a1", member_id: "mem_manager", seller_id: "seller_a1" },
    { id: "sm_manager_a1", member_id: "mem_other", seller_id: "seller_a1" },
    { id: "sm_manager_a1", member_id: "mem_manager", seller_id: "seller_b1" },
  ];

  for (const membership of mismatchedMemberships) {
    const { service } = makeService(
      [{ ...membership, is_owner: true, role_id: SellerRole.SELLER_ADMINISTRATION }],
      { ignoreFilters: true },
    );
    assert.deepEqual(await service.resolvePermissions(actor, catalog), {});
  }
});
