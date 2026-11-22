import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmsSellerShippingStock } from "../src/lib/seller-shipping-stock.ts";

function line(sellerId, locationId, stocked, reserved = 0, quantity = 1, units = 1) {
  const id = "item_" + sellerId;
  return {
    quantity,
    offer: {
      seller_id: sellerId,
      inventory_item_link: [{ inventory_item_id: id, required_quantity: units }],
      inventory_items: [
        {
          id,
          requires_shipping: true,
          location_levels: [
            { location_id: locationId, stocked_quantity: stocked, reserved_quantity: reserved },
          ],
        },
      ],
    },
  };
}

test("each seller's shipping option ignores inventory at the other seller's location", () => {
  const cart = [line("a", "warehouse_a", 29), line("b", "warehouse_b", 17)];
  assert.equal(confirmsSellerShippingStock(cart, "a", "warehouse_a"), true);
  assert.equal(confirmsSellerShippingStock(cart, "b", "warehouse_b"), true);
  assert.equal(confirmsSellerShippingStock(cart, "a", "warehouse_b"), false);
});

test("reserved stock and shared inventory do not clear a genuine shortage", () => {
  const first = line("a", "warehouse_a", 7, 2, 2, 2);
  const second = line("a", "warehouse_a", 7, 2, 1, 2);
  assert.equal(confirmsSellerShippingStock([first], "a", "warehouse_a"), true);
  assert.equal(confirmsSellerShippingStock([first, second], "a", "warehouse_a"), false);
  assert.equal(
    confirmsSellerShippingStock([first, line("b", "warehouse_b", 1, 1)], "b", "warehouse_b"),
    false,
  );
});

test("missing inventory data cannot clear an upstream shortage", () => {
  const item = line("a", "warehouse_a", 8);
  delete item.offer.inventory_item_link;
  assert.equal(confirmsSellerShippingStock([item], "a", "warehouse_a"), false);
  assert.equal(
    confirmsSellerShippingStock([line("a", "warehouse_a", 8), { quantity: 1 }], "a", "warehouse_a"),
    false,
  );
});
