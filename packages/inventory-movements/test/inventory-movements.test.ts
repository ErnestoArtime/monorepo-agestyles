import assert from "node:assert/strict";
import {
  applyMovement,
  movementsToCsv,
  MovementValidationError,
  parseMovementFilters,
  parseMovementInput,
} from "../src/rules.ts";

/** Rule tests for inventory movements. Run with `node test/inventory-movements.test.ts`. */

const base = { inventory_item_id: "iitem_1", location_id: "sloc_1" };
const invalid = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(
    fn,
    (error: unknown) => error instanceof MovementValidationError && pattern.test(error.message),
  );

// Input parsing
assert.deepEqual(parseMovementInput({ ...base, type: "alta", quantity: 5 }), {
  ...base,
  type: "alta",
  quantity: 5,
  reason: null,
});
assert.equal(
  parseMovementInput({ ...base, type: "baja", quantity: "2", reason: "  rotura   en  tienda " })
    .reason,
  "rotura en tienda",
);
invalid(() => parseMovementInput({ ...base, type: "ajuste", quantity: 3 }), /motivo/);
invalid(() => parseMovementInput({ ...base, type: "ajuste", quantity: 3, reason: "x" }), /motivo/);
invalid(() => parseMovementInput({ ...base, type: "alta", quantity: 0 }), /mayor que cero/);
invalid(() => parseMovementInput({ ...base, type: "alta", quantity: 1.5 }), /entero/);
invalid(() => parseMovementInput({ ...base, type: "alta", quantity: -1 }), /entero/);
invalid(() => parseMovementInput({ ...base, type: "robo", quantity: 1 }), /tipo/);
invalid(() => parseMovementInput({ location_id: "sloc_1", type: "alta", quantity: 1 }), /artículo/);
invalid(
  () => parseMovementInput({ ...base, type: "baja", quantity: 1, reason: "x".repeat(301) }),
  /300/,
);
assert.equal(
  parseMovementInput({ ...base, type: "ajuste", quantity: 0, reason: "Conteo físico" }).quantity,
  0,
);

// Effects on stock
assert.deepEqual(applyMovement({ type: "alta", quantity: 5 }, { stocked: 1, reserved: 0 }), {
  delta: 5,
  before: 1,
  after: 6,
});
assert.deepEqual(applyMovement({ type: "baja", quantity: 1 }, { stocked: 3, reserved: 0 }), {
  delta: -1,
  before: 3,
  after: 2,
});
assert.deepEqual(applyMovement({ type: "venta", quantity: 3 }, { stocked: 3, reserved: 0 }), {
  delta: -3,
  before: 3,
  after: 0,
});
assert.deepEqual(applyMovement({ type: "ajuste", quantity: 7 }, { stocked: 10, reserved: 2 }), {
  delta: -3,
  before: 10,
  after: 7,
});
invalid(
  () => applyMovement({ type: "baja", quantity: 4 }, { stocked: 3, reserved: 0 }),
  /suficiente stock/,
);
invalid(
  () => applyMovement({ type: "venta", quantity: 2 }, { stocked: 3, reserved: 2 }),
  /reservadas/,
);
invalid(
  () => applyMovement({ type: "ajuste", quantity: 1 }, { stocked: 3, reserved: 2 }),
  /reservadas/,
);
invalid(
  () => applyMovement({ type: "ajuste", quantity: 3 }, { stocked: 3, reserved: 0 }),
  /coincide/,
);

// Filters
const filters = parseMovementFilters({
  type: "venta",
  from: "2026-11-01",
  to: "2026-11-30",
  inventory_item_id: " iitem_1 ",
});
assert.equal(filters.type, "venta");
assert.equal(filters.inventory_item_id, "iitem_1");
assert.equal(filters.from?.toISOString(), "2026-11-01T00:00:00.000Z");
invalid(() => parseMovementFilters({ type: "robo" }), /tipo/);
invalid(() => parseMovementFilters({ from: "ayer" }), /fecha/);
invalid(() => parseMovementFilters({ from: "2026-12-01", to: "2026-11-01" }), /posterior/);

// CSV export
const csv = movementsToCsv([
  {
    created_at: "2026-11-17T21:00:00.000Z",
    type: "ajuste",
    title: 'Nike "Air"',
    sku: "AGS-OF-1015",
    location_name: "AgeStyles Oficial",
    delta: -1,
    quantity_before: 3,
    quantity_after: 2,
    reason: '=HYPERLINK("x");conteo',
    actor_email: "dueno@example.com",
  },
]);
assert.ok(csv.startsWith("\uFEFFFecha (UTC);Tipo;Producto"));
const row = csv.trim().split("\r\n")[1];
assert.match(
  row,
  /^2026-11-17 21:00:00;Ajuste;"Nike ""Air""";AGS-OF-1015;AgeStyles Oficial;-1;3;2;/,
);
assert.match(row, /;"'=HYPERLINK\(""x""\);conteo";/, "formulas are neutralised and quoted");

console.log("inventory-movements rules: ok");
