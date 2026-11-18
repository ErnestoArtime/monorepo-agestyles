import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  AGESTYLES_SALES_COMMISSIONS_MODULE,
  type SalesCommissionsService,
} from "@agestyles/sales-commissions";

type SaleState = { status: string; lines?: unknown; note?: string | null };

export type SettleAgentSaleInput = {
  sale_id: string;
  /** State before the change, restored if a later step fails. */
  previous: SaleState;
  next: SaleState;
  entries: Record<string, unknown>[];
};

const updateSaleStep = createStep(
  "agestyles-settle-agent-sale-update",
  async (input: Pick<SettleAgentSaleInput, "sale_id" | "previous" | "next">, { container }) => {
    const service = container.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
    const sale = await service.updateAgentSales({ id: input.sale_id, ...input.next } as never);
    return new StepResponse(sale, { id: input.sale_id, previous: input.previous });
  },
  async (undo, { container }) => {
    if (!undo) return;
    await container
      .resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE)
      .updateAgentSales({ id: undo.id, ...undo.previous } as never);
  },
);

const createEntriesStep = createStep(
  "agestyles-settle-agent-sale-entries",
  async (input: { sale_id: string; entries: Record<string, unknown>[] }, { container }) => {
    if (!input.entries.length) return new StepResponse([], [] as string[]);
    const service = container.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
    const created = (await service.createCommissionEntries(
      input.entries.map((entry) => ({ ...entry, sale_id: input.sale_id })) as never,
    )) as unknown as { id: string }[];
    return new StepResponse(
      created,
      created.map((entry) => entry.id),
    );
  },
  async (ids, { container }) => {
    if (!ids?.length) return;
    await container
      .resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE)
      .deleteCommissionEntries(ids);
  },
);

/**
 * Changes an agent sale's status (pending → paid, or → reversed) together with the
 * ledger entries that change implies, compensating both if either fails. Callers
 * hold the agent's lock and re-read the sale inside it.
 */
export const settleAgentSaleWorkflow = createWorkflow(
  "agestyles-settle-agent-sale",
  (input: SettleAgentSaleInput) => {
    const sale = updateSaleStep({
      sale_id: input.sale_id,
      previous: input.previous,
      next: input.next,
    });
    const entries = createEntriesStep({ sale_id: input.sale_id, entries: input.entries });
    return new WorkflowResponse({ sale, entries });
  },
);
