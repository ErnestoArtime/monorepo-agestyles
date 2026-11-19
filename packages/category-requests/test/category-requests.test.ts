import assert from "node:assert/strict";
import {
  categoryHandle,
  CategoryRequestValidationError,
  validateCategoryDecision,
  validateCategoryRequestInput,
} from "../src/validation.ts";

/** Rule tests for category requests. Run with `node test/category-requests.test.ts`. */

const input = validateCategoryRequestInput({
  name: "  Artesanía   cubana ",
  suggested_parent_id: "pcat_01ABC",
  note: "Para cerámica",
});
assert.equal(input.name, "Artesanía cubana");
assert.equal(input.suggested_parent_id, "pcat_01ABC");
assert.equal(input.description, null);
assert.throws(() => validateCategoryRequestInput({ name: " " }), CategoryRequestValidationError);
assert.throws(
  () => validateCategoryRequestInput({ name: "Ok", suggested_parent_id: "x" }),
  CategoryRequestValidationError,
);
assert.equal(
  validateCategoryRequestInput({ name: "Ok", suggested_parent_id: "" }).suggested_parent_id,
  null,
);

assert.deepEqual(
  validateCategoryDecision({ action: "approve", name: "Artesanía", parent_id: "pcat_1" }),
  {
    action: "approve",
    name: "Artesanía",
    parent_id: "pcat_1",
    note: null,
  },
);
assert.equal(validateCategoryDecision({ action: "approve", name: "Artesanía" }).action, "approve");
assert.throws(() => validateCategoryDecision({ action: "merge" }), CategoryRequestValidationError);
assert.equal(validateCategoryDecision({ action: "merge", category_id: "pcat_2" }).action, "merge");
assert.throws(() => validateCategoryDecision({ action: "reject" }), CategoryRequestValidationError);
assert.throws(() => validateCategoryDecision({ action: "delete" }), CategoryRequestValidationError);

assert.equal(categoryHandle("Artesanía y Regalos!"), "artesania-y-regalos");
assert.equal(categoryHandle("¿?"), "categoria");

console.log("category-requests: ok");
