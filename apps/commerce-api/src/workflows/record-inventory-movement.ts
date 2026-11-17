import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updateInventoryLevelsStep } from "@medusajs/medusa/core-flows";
import type { InventoryMovementsService, MovementType } from "@agestyles/inventory-movements";
import { AGESTYLES_INVENTORY_MOVEMENTS_MODULE } from "@agestyles/inventory-movements";

export type RecordInventoryMovementInput = {
  seller_id: string;
  inventory_item_id: string;
  location_id: string;
  type: MovementType;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  actor_id: string;
  actor_email: string | null;
  title: string | null;
  sku: string | null;
  location_name: string | null;
};

const createMovementStep = createStep(
  "agestyles-create-inventory-movement",
  async (input: RecordInventoryMovementInput, { container }) => {
    const service = container.resolve<InventoryMovementsService>(
      AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
    );
    const movement = await service.createInventoryMovements(input);
    return new StepResponse(movement, movement.id);
  },
  async (movementId, { container }) => {
    if (!movementId) return;
    const service = container.resolve<InventoryMovementsService>(
      AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
    );
    await service.deleteInventoryMovements(movementId);
  },
);

/**
 * Sets the stocked quantity and appends the movement in one workflow: if the
 * history row cannot be written, the stock change is compensated, so stock and
 * history never disagree. Callers serialise per item/location with the locking
 * module and compute the effect from the current level inside that lock.
 */
export const recordInventoryMovementWorkflow = createWorkflow(
  "agestyles-record-inventory-movement",
  (input: RecordInventoryMovementInput) => {
    updateInventoryLevelsStep([
      {
        inventory_item_id: input.inventory_item_id,
        location_id: input.location_id,
        stocked_quantity: input.quantity_after,
      },
    ]);
    const movement = createMovementStep(input);
    return new WorkflowResponse(movement);
  },
);
