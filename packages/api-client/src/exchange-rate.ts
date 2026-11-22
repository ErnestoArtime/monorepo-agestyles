import type { StoreClient } from "./transport";
import type { CupExchangeRate } from "@agestyles/domain/exchange-rate";

export type { CupExchangeRate } from "@agestyles/domain/exchange-rate";
export {
  cupEquivalent,
  formatCupEquivalent,
  rateSourceLine,
} from "@agestyles/domain/exchange-rate";

/** Informational CUP-per-USD rate, or null when none is configured or it cannot be read. */
export async function getCupExchangeRate(client: StoreClient): Promise<CupExchangeRate | null> {
  try {
    const result = await client.fetch<{ exchange_rate: CupExchangeRate | null }>(
      "/store/agestyles/exchange-rate",
    );
    return result.exchange_rate ?? null;
  } catch {
    return null;
  }
}
