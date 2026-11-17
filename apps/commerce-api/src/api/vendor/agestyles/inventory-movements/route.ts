import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import {
  AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
  applyMovement,
  parseMovementInput,
  type InventoryMovementsService,
} from "@agestyles/inventory-movements";
import {
  asInvalidData,
  queryGraph,
  readFilters,
  requireInventoryAccess,
  toServiceFilters,
  type SellerRequest,
} from "../../../../lib/vendor-inventory-movements";
import { recordInventoryMovementWorkflow } from "../../../../workflows/record-inventory-movement";

const MAX_PAGE = 100;

/** Seller-scoped movement history, newest first. */
export async function GET(req: SellerRequest, res: MedusaResponse) {
  const sellerId = requireInventoryAccess(req, "view");
  const filters = readFilters(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), MAX_PAGE);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const service = req.scope.resolve<InventoryMovementsService>(
    AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
  );
  const [movements, count] = await service.listAndCountInventoryMovements(
    toServiceFilters(sellerId, filters),
    { order: { created_at: "DESC" }, take: limit, skip: offset },
  );
  res.json({ inventory_movements: movements, count, limit, offset });
}

/**
 * Registers an entry, exit, sale or quick adjustment and applies it to the
 * stock of one of the seller's inventory items at one of its locations.
 */
export async function POST(req: SellerRequest, res: MedusaResponse) {
  const sellerId = requireInventoryAccess(req, "edit");
  const input = asInvalidData(() => parseMovementInput(req.body));
  const query = queryGraph(req);
  const actorId = req.auth_context?.actor_id;
  if (!actorId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "A member is required.");

  const [
    { data: ownedItems },
    { data: ownedLocations },
    { data: items },
    { data: locations },
    { data: members },
  ] = await Promise.all([
    query.graph({
      entity: "inventory_item_seller",
      fields: ["inventory_item_id"],
      filters: { seller_id: sellerId, inventory_item_id: input.inventory_item_id },
    }),
    query.graph({
      entity: "stock_location_seller",
      fields: ["stock_location_id"],
      filters: { seller_id: sellerId, stock_location_id: input.location_id },
    }),
    query.graph({
      entity: "inventory_item",
      fields: ["id", "title", "sku"],
      filters: { id: input.inventory_item_id },
    }),
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
      filters: { id: input.location_id },
    }),
    query.graph({ entity: "member", fields: ["id", "email"], filters: { id: actorId } }),
  ]);
  if (!ownedItems.length || !items[0]) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The inventory item was not found for this seller.",
    );
  }
  if (!ownedLocations.length || !locations[0]) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The stock location was not found for this seller.",
    );
  }
  const item = items[0] as { title?: string | null; sku?: string | null };
  const location = locations[0] as { name?: string | null };
  const member = members[0] as { email?: string | null } | undefined;

  const inventory = req.scope.resolve(Modules.INVENTORY);
  const locking = req.scope.resolve(Modules.LOCKING);
  const movement = await locking.execute(
    `agestyles-inventory:${input.inventory_item_id}:${input.location_id}`,
    async () => {
      const [level] = await inventory.listInventoryLevels({
        inventory_item_id: input.inventory_item_id,
        location_id: input.location_id,
      });
      if (!level) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "This inventory item has no stock level at that location.",
        );
      }
      const effect = asInvalidData(() =>
        applyMovement(input, {
          stocked: Number(level.stocked_quantity),
          reserved: Number(level.reserved_quantity),
        }),
      );
      const { result } = await recordInventoryMovementWorkflow(req.scope).run({
        input: {
          seller_id: sellerId,
          inventory_item_id: input.inventory_item_id,
          location_id: input.location_id,
          type: input.type,
          delta: effect.delta,
          quantity_before: effect.before,
          quantity_after: effect.after,
          reason: input.reason,
          actor_id: actorId,
          actor_email: member?.email ?? null,
          title: item.title ?? null,
          sku: item.sku ?? null,
          location_name: location.name ?? null,
        },
      });
      return result;
    },
    { timeout: 10 },
  );
  res.status(201).json({ inventory_movement: movement });
}
