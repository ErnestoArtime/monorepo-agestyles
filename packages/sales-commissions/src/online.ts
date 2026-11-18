/**
 * Online purchases attributed to a sales agent (AG-06 phase 4) and reversals.
 *
 * - The buyer enters the agent's code at checkout; it is stored in the cart metadata
 *   under `AGENT_CODE_METADATA_KEY`, and Mercur copies the cart metadata to every
 *   seller order it splits from the cart.
 * - Only the order of the agent's own store is attributed; other stores' orders of
 *   the same cart are ignored.
 * - The sale is recorded as `pending` when the order is placed and earns commission
 *   when the payment is confirmed. A canceled order reverses it.
 * - Reversing never edits the ledger: it appends `reversed` entries that cancel what
 *   the sale earned (and only what was not reversed already), so it is idempotent.
 */
// Local copy (same as rules.ts) so Node's test runner can load this file directly.
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const AGENT_CODE_METADATA_KEY = "agestyles_agent_code";

export type OrderItemInput = {
  product_id?: string | null;
  variant_id?: string | null;
  title?: string | null;
  product_title?: string | null;
  variant_sku?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
};

export type OnlineSaleLine = {
  product_id: string;
  variant_id: string | null;
  title: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
};

/** Sale lines from the order items; items without a product (e.g. custom lines) are skipped. */
export function onlineSaleLines(items: OrderItemInput[]): OnlineSaleLine[] {
  const lines: OnlineSaleLine[] = [];
  for (const item of items) {
    const quantity = Number(item.quantity);
    const unitPrice = roundMoney(Number(item.unit_price));
    if (!item.product_id || !Number.isSafeInteger(quantity) || quantity < 1) continue;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    lines.push({
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      title: item.product_title ?? item.title ?? null,
      sku: item.variant_sku ?? null,
      quantity,
      unit_price: unitPrice,
    });
  }
  return lines;
}

export function saleTotal(lines: { quantity: number; unit_price: number }[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0));
}

export type LedgerEntry = {
  kind: "earned" | "reversed" | "withdrawn";
  amount: number | string;
  product_id?: string | null;
  units?: number | null;
};

export type ReversalEntry = {
  kind: "reversed";
  amount: number;
  product_id: string | null;
  units: number | null;
};

/**
 * Entries that cancel what a sale earned and was not reversed yet, one per product.
 * Returns nothing when the sale earned nothing or is already fully reversed.
 */
export function reversalEntries(saleEntries: LedgerEntry[]): ReversalEntry[] {
  const pending = new Map<string, { amount: number; units: number }>();
  for (const entry of saleEntries) {
    if (entry.kind === "withdrawn") continue;
    const key = entry.product_id ?? "";
    const current = pending.get(key) ?? { amount: 0, units: 0 };
    const amount = Math.abs(Number(entry.amount));
    const units = Math.abs(Number(entry.units ?? 0));
    const sign = entry.kind === "earned" ? 1 : -1;
    pending.set(key, {
      amount: current.amount + sign * amount,
      units: current.units + sign * units,
    });
  }
  const reversals: ReversalEntry[] = [];
  for (const [productId, { amount, units }] of pending) {
    const rounded = roundMoney(amount);
    if (rounded <= 0) continue;
    reversals.push({
      kind: "reversed",
      amount: rounded,
      product_id: productId || null,
      units: units > 0 ? units : null,
    });
  }
  return reversals;
}

export const MAX_REVERSAL_NOTE = 300;

/** Optional note of a manager's reversal of a sale. */
export function parseReversalNote(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const note = (body as Record<string, unknown>).note;
  if (typeof note !== "string") return null;
  const trimmed = note.trim().slice(0, MAX_REVERSAL_NOTE);
  return trimmed || null;
}
