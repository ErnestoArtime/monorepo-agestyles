import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

/**
 * Informational CUP-per-USD rate shown next to USD prices. Checkout and payment
 * stay in USD: Medusa 2.22.3 has no `cup` currency. The rate lives in the store
 * metadata so it needs no schema of its own.
 */
export type ExchangeRate = {
  base_currency: "usd";
  currency_code: "cup";
  rate: number;
  source: string;
  updated_at: string;
  /** The publisher's own timestamp (elTOQUE), when known; null for manual values. */
  source_updated_at: string | null;
};

const METADATA_KEY = "agestyles_cup_per_usd";
export const MIN_RATE = 1;
export const MAX_RATE = 100_000;

export function isValidRate(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= MIN_RATE && value <= MAX_RATE
  );
}

export async function readExchangeRate(container: MedusaContainer): Promise<ExchangeRate | null> {
  const storeService = container.resolve(Modules.STORE);
  const [store] = await storeService.listStores({}, { select: ["id", "metadata"] });
  const stored = store?.metadata?.[METADATA_KEY] as Partial<ExchangeRate> | undefined;
  if (!stored || !isValidRate(stored.rate) || typeof stored.updated_at !== "string") return null;
  return {
    base_currency: "usd",
    currency_code: "cup",
    rate: stored.rate,
    source: typeof stored.source === "string" ? stored.source : "manual",
    updated_at: stored.updated_at,
    source_updated_at:
      typeof stored.source_updated_at === "string" ? stored.source_updated_at : null,
  };
}

export async function writeExchangeRate(
  container: MedusaContainer,
  rate: number,
  source: string,
  sourceUpdatedAt: string | null = null,
): Promise<ExchangeRate> {
  if (!isValidRate(rate)) throw new Error("invalid_exchange_rate");
  const storeService = container.resolve(Modules.STORE);
  const [store] = await storeService.listStores({}, { select: ["id", "metadata"] });
  if (!store) throw new Error("store_missing");
  const value: ExchangeRate = {
    base_currency: "usd",
    currency_code: "cup",
    rate: Math.round(rate * 100) / 100,
    source: source.slice(0, 80),
    updated_at: new Date().toISOString(),
    source_updated_at: sourceUpdatedAt,
  };
  await storeService.updateStores(store.id, {
    metadata: { ...(store.metadata ?? {}), [METADATA_KEY]: value },
  });
  return value;
}
