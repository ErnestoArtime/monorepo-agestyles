import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  AGENT_CODE_METADATA_KEY,
  AGESTYLES_SALES_COMMISSIONS_MODULE,
  commissionForLine,
  normalizeAgentCode,
  onlineSaleLines,
  resolveRule,
  reversalEntries,
  roundMoney,
  saleTotal,
  type CommissionRule,
  type LedgerEntry,
  type OrderItemInput,
  type SalesCommissionsService,
} from "@agestyles/sales-commissions";
import { orderSellerId } from "./notifications";
import { settleAgentSaleWorkflow } from "../workflows/settle-agent-sale";

/**
 * AG-06 phase 4: online purchases made with a sales agent's code, and reversals.
 * Decisions in docs/design/AG-06-gestores-y-comisiones.md: online sales earn commission
 * when the payment is confirmed; a cancellation (or a manager's reversal) undoes it.
 */

type Scope = Pick<MedusaContainer, "resolve">;

type AgentRecord = { id: string; seller_id: string; code: string; active: boolean };
type SaleRecord = {
  id: string;
  seller_id: string;
  agent_id: string;
  source: "manual" | "online";
  order_id: string | null;
  status: "pending" | "paid" | "reversed";
  currency_code: string;
  lines: { product_id: string; quantity: number; unit_price: number; [key: string]: unknown }[];
  note: string | null;
};

type QueryGraph = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }): Promise<{ data: Record<string, unknown>[] }>;
};

const LOCK_TIMEOUT_SECONDS = 15;

function commissions(scope: Scope) {
  return scope.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
}

function query(scope: Scope) {
  return scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;
}

function locking(scope: Scope) {
  return scope.resolve(Modules.LOCKING);
}

async function saleById(scope: Scope, id: string): Promise<SaleRecord | null> {
  const [sale] = (await commissions(scope).listAgentSales({ id })) as unknown as SaleRecord[];
  return sale ?? null;
}

async function saleForOrder(scope: Scope, orderId: string): Promise<SaleRecord | null> {
  const [sale] = (await commissions(scope).listAgentSales({
    order_id: orderId,
  })) as unknown as SaleRecord[];
  return sale ?? null;
}

/** Active agent of the given store with that code, or null. */
export async function agentForCode(
  scope: Scope,
  rawCode: unknown,
  sellerId?: string,
): Promise<AgentRecord | null> {
  const code = normalizeAgentCode(rawCode);
  if (!code) return null;
  const [agent] = (await commissions(scope).listSalesAgents({
    code,
    active: true,
  })) as unknown as AgentRecord[];
  if (!agent || (sellerId && agent.seller_id !== sellerId)) return null;
  return agent;
}

/**
 * When an order is placed with an agent code of its own store, records a pending online
 * sale. Orders of other stores split from the same cart are ignored. Idempotent per order.
 */
export async function recordOnlineAgentSale(scope: Scope, orderId: string) {
  const { data } = await query(scope).graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "currency_code",
      "items.product_id",
      "items.variant_id",
      "items.title",
      "items.product_title",
      "items.variant_sku",
      "items.quantity",
      "items.unit_price",
    ],
    filters: { id: orderId },
  });
  const order = data[0] as
    | {
        id: string;
        metadata?: Record<string, unknown> | null;
        currency_code: string;
        items?: OrderItemInput[];
      }
    | undefined;
  const code = order?.metadata?.[AGENT_CODE_METADATA_KEY];
  if (!order || !code) return null;
  const sellerId = await orderSellerId(scope, orderId);
  if (!sellerId) return null;
  const agent = await agentForCode(scope, code, sellerId);
  if (!agent) return null;
  const lines = onlineSaleLines(order.items ?? []);
  if (!lines.length) return null;

  return locking(scope).execute(
    `agestyles-agent-order:${orderId}`,
    async () => {
      const existing = await saleForOrder(scope, orderId);
      if (existing) return existing;
      return commissions(scope).createAgentSales({
        seller_id: sellerId,
        agent_id: agent.id,
        source: "online",
        order_id: orderId,
        payment_method: "online",
        status: "pending",
        currency_code: order.currency_code,
        total: saleTotal(lines),
        lines,
        note: null,
      } as never);
    },
    { timeout: LOCK_TIMEOUT_SECONDS },
  );
}

/** Units of each product the agent already sold in paid sales (for cumulative thresholds). */
async function unitsSoldByAgent(scope: Scope, agentId: string) {
  const sales = (await commissions(scope).listAgentSales({
    agent_id: agentId,
    status: "paid",
  })) as unknown as SaleRecord[];
  const units = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines ?? []) {
      units.set(line.product_id, (units.get(line.product_id) ?? 0) + Number(line.quantity));
    }
  }
  return units;
}

/** The order's payment was confirmed: the pending online sale earns its commission. */
export async function creditOnlineAgentSale(scope: Scope, orderId: string) {
  // The payment may be confirmed before the order.placed subscriber ran (auto-capture).
  const found =
    (await saleForOrder(scope, orderId)) ??
    ((await recordOnlineAgentSale(scope, orderId)) as unknown as SaleRecord | null);
  if (!found || found.status !== "pending") return null;
  return locking(scope).execute(
    `agestyles-agent:${found.agent_id}`,
    async () => {
      const sale = await saleById(scope, found.id);
      if (!sale || sale.status !== "pending") return null;
      const rules = (
        (await commissions(scope).listCommissionRules({
          seller_id: sale.seller_id,
        })) as unknown as CommissionRule[]
      ).map((rule) => ({ ...rule, value: Number(rule.value) }));
      const unitsSold = await unitsSoldByAgent(scope, sale.agent_id);
      const entries: Record<string, unknown>[] = [];
      const lines = sale.lines.map((line) => {
        const commission = commissionForLine(
          resolveRule(rules, line.product_id),
          {
            product_id: line.product_id,
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price),
          },
          unitsSold.get(line.product_id) ?? 0,
        );
        unitsSold.set(
          line.product_id,
          (unitsSold.get(line.product_id) ?? 0) + Number(line.quantity),
        );
        if (commission.amount > 0) {
          entries.push({
            seller_id: sale.seller_id,
            agent_id: sale.agent_id,
            kind: "earned",
            amount: commission.amount,
            currency_code: sale.currency_code,
            product_id: line.product_id,
            units: Number(line.quantity),
          });
        }
        return { ...line, commission: commission.amount, rule_id: commission.rule_id };
      });
      const { result } = await settleAgentSaleWorkflow(scope as MedusaContainer).run({
        input: {
          sale_id: sale.id,
          previous: { status: sale.status, lines: sale.lines },
          next: { status: "paid", lines },
          entries,
        },
      });
      return {
        sale: result.sale,
        commission: roundMoney(entries.reduce((sum, entry) => sum + Number(entry.amount), 0)),
      };
    },
    { timeout: LOCK_TIMEOUT_SECONDS },
  );
}

/**
 * Reverses a sale: appends `reversed` entries for whatever it earned and was not reversed
 * yet, and marks it reversed. Stock is not touched here; returned goods are registered as
 * an «alta» in Movimientos. Idempotent.
 */
export async function reverseAgentSale(
  scope: Scope,
  saleId: string,
  options: { note?: string | null } = {},
) {
  const found = await saleById(scope, saleId);
  if (!found) return null;
  return locking(scope).execute(
    `agestyles-agent:${found.agent_id}`,
    async () => {
      const sale = await saleById(scope, saleId);
      if (!sale) return null;
      if (sale.status === "reversed") return { sale, reversed: 0 };
      const ledger = (await commissions(scope).listCommissionEntries({
        sale_id: sale.id,
      })) as unknown as LedgerEntry[];
      const entries = reversalEntries(ledger).map((entry) => ({
        ...entry,
        seller_id: sale.seller_id,
        agent_id: sale.agent_id,
        currency_code: sale.currency_code,
      }));
      const note = options.note
        ? [sale.note, `Anulada: ${options.note}`].filter(Boolean).join(" · ").slice(0, 600)
        : sale.note;
      const { result } = await settleAgentSaleWorkflow(scope as MedusaContainer).run({
        input: {
          sale_id: sale.id,
          previous: { status: sale.status, note: sale.note },
          next: { status: "reversed", note },
          entries,
        },
      });
      return {
        sale: result.sale,
        reversed: roundMoney(entries.reduce((sum, entry) => sum + entry.amount, 0)),
      };
    },
    { timeout: LOCK_TIMEOUT_SECONDS },
  );
}

/** Reverses the online sale of a canceled order, if there is one. */
export async function reverseOnlineAgentSale(scope: Scope, orderId: string) {
  const sale = await saleForOrder(scope, orderId);
  if (!sale || sale.status === "reversed") return null;
  return reverseAgentSale(scope, sale.id, { note: "pedido cancelado" });
}

/** Order of a captured Medusa payment (through its payment collection), or null. */
export async function orderIdForPayment(scope: Scope, paymentId: string): Promise<string | null> {
  try {
    const { data } = await query(scope).graph({
      entity: "payment",
      fields: ["id", "payment_collection.order.id"],
      filters: { id: paymentId },
    });
    const payment = data[0] as
      { payment_collection?: { order?: { id?: string } | null } } | undefined;
    return payment?.payment_collection?.order?.id ?? null;
  } catch {
    // A payment outside an order (or a link this Medusa version does not expose) is not ours.
    return null;
  }
}
