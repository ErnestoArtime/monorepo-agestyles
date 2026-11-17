import { MedusaService } from "@medusajs/framework/utils";
import InventoryMovement from "./models/inventory-movement";

export type InventoryMovementRecord = {
  id: string;
  seller_id: string;
  inventory_item_id: string;
  location_id: string;
  type: "alta" | "baja" | "venta" | "ajuste";
  delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  actor_id: string;
  actor_email: string | null;
  title: string | null;
  sku: string | null;
  location_name: string | null;
  created_at: Date;
};

class InventoryMovementsService extends MedusaService({ InventoryMovement }) {}

export default InventoryMovementsService;
