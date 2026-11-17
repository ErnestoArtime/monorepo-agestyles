import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updateInventoryLevelsStep } from "@medusajs/medusa/core-flows";
import {
  AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
  type InventoryMovementsService,
} from "@agestyles/inventory-movements";
import {
  AGESTYLES_SALES_COMMISSIONS_MODULE,
  type SalesCommissionsService,
} from "@agestyles/sales-commissions";

export type AgentSaleWorkflowInput = {
  stock: { inventory_item_id: string; location_id: string; stocked_quantity: number }[];
  movements: Record<string, unknown>[];
  sale: Record<string, unknown>;
  entries: Record<string, unknown>[];
};

const createSaleMovementsStep = createStep(
  "agestyles-create-agent-sale-movements",
  async (movements: Record<string, unknown>[], { container }) => {
    const service = container.resolve<InventoryMovementsService>(
      AGESTYLES_INVENTORY_MOVEMENTS_MODULE,
    );
    const created = (await service.createInventoryMovements(movements as never)) as unknown as {
      id: string;
    }[];
    return new StepResponse(
      created,
      created.map((movement) => movement.id),
    );
  },
  async (ids, { container }) => {
    if (!ids?.length) return;
    await container
      .resolve<InventoryMovementsService>(AGESTYLES_INVENTORY_MOVEMENTS_MODULE)
      .deleteInventoryMovements(ids);
  },
);

const createSaleAndEntriesStep = createStep(
  "agestyles-create-agent-sale",
  async (input: Pick<AgentSaleWorkflowInput, "sale" | "entries">, { container }) => {
    const service = container.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
    const sale = (await service.createAgentSales(input.sale as never)) as unknown as { id: string };
    const entries = input.entries.length
      ? ((await service.createCommissionEntries(
          input.entries.map((entry) => ({ ...entry, sale_id: sale.id })) as never,
        )) as unknown as { id: string }[])
      : [];
    return new StepResponse(
      { sale, entries },
      { saleId: sale.id, entryIds: entries.map((entry) => entry.id) },
    );
  },
  async (created, { container }) => {
    if (!created) return;
    const service = container.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
    if (created.entryIds.length) await service.deleteCommissionEntries(created.entryIds);
    await service.deleteAgentSales(created.saleId);
  },
);

/**
 * A sale registered by a sales agent: stock leaves the location, each line is
 * written to the inventory history as a `venta`, and the sale and its
 * commission entries are recorded. Any failure compensates the earlier steps.
 * Callers hold locks for the agent and every item/location involved.
 */
export const recordAgentSaleWorkflow = createWorkflow(
  "agestyles-record-agent-sale",
  (input: AgentSaleWorkflowInput) => {
    updateInventoryLevelsStep(input.stock);
    createSaleMovementsStep(input.movements);
    const result = createSaleAndEntriesStep({ sale: input.sale, entries: input.entries });
    return new WorkflowResponse(result);
  },
);
