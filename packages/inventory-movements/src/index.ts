import { Module } from "@medusajs/framework/utils";
import InventoryMovementsService from "./service";

export const AGESTYLES_INVENTORY_MOVEMENTS_MODULE = "agestylesInventoryMovements";

export { InventoryMovementsService };
export type { InventoryMovementRecord } from "./service";
export {
  applyMovement,
  MAX_REASON_LENGTH,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPES,
  MovementValidationError,
  movementsToCsv,
  parseMovementFilters,
  parseMovementInput,
} from "./rules";
export type {
  MovementEffect,
  MovementFilters,
  MovementInput,
  MovementRow,
  MovementType,
} from "./rules";

export default Module(AGESTYLES_INVENTORY_MOVEMENTS_MODULE, {
  service: InventoryMovementsService,
});
