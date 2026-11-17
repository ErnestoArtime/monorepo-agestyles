import type { MedusaResponse } from "@medusajs/framework/http";
import {
  AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
  movementsToCsv,
  type InventoryMovementsService,
  type MovementRow,
} from "@agestyles/inventory-movements";
import {
  readFilters,
  requireInventoryAccess,
  toServiceFilters,
  type SellerRequest,
} from "../../../../../lib/vendor-inventory-movements";

const MAX_EXPORT_ROWS = 5000;

/** CSV export of the seller's movements with the same filters as the list. */
export async function GET(req: SellerRequest, res: MedusaResponse) {
  const sellerId = requireInventoryAccess(req, "view");
  const filters = readFilters(req);
  const service = req.scope.resolve<InventoryMovementsService>(
    AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
  );
  const movements = await service.listInventoryMovements(toServiceFilters(sellerId, filters), {
    order: { created_at: "DESC" },
    take: MAX_EXPORT_ROWS,
  });
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="movimientos-${date}.csv"`);
  res.setHeader("cache-control", "no-store");
  res.send(movementsToCsv(movements as unknown as MovementRow[]));
}
