import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "../lib/permissions.ts";

test("seller permissions meet the requested minimum without granting higher rights", () => {
  const viewer = { permissions: { products: "view" } };
  const manager = { permissions: { products: "edit" } };
  const owner = { is_owner: true };

  assert.equal(hasPermission(viewer, "products", "view"), true);
  assert.equal(hasPermission(viewer, "products", "edit"), false);
  assert.equal(hasPermission(viewer, "products", "manage"), false);
  assert.equal(hasPermission(manager, "products", "edit"), true);
  assert.equal(hasPermission(manager, "products", "manage"), false);
  assert.equal(hasPermission(owner, "products", "manage"), true);
  assert.equal(hasPermission(null, "products", "view"), false);
  assert.equal(hasPermission({ permissions: { products: "unknown" } }, "products"), false);
});
