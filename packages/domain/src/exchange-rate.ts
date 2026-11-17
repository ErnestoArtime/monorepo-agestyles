/**
 * Informational CUP equivalent for USD prices. Payment stays in USD; the
 * equivalent only helps buyers who think in CUP, as the legacy catalog did.
 */
export type CupExchangeRate = {
  base_currency: "usd";
  currency_code: "cup";
  rate: number;
  source: string;
  updated_at: string;
};

/** Rounded CUP amount for a USD amount, or null when it cannot be computed. */
export function cupEquivalent(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
  rate: CupExchangeRate | null | undefined,
): number | null {
  if (!rate || !(rate.rate > 0)) return null;
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null;
  if ((currencyCode ?? "").toLowerCase() !== rate.base_currency) return null;
  return Math.round(amount * rate.rate);
}

/** "≈ 12.345 CUP" (es-ES grouping), or null when there is no equivalent. */
export function formatCupEquivalent(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
  rate: CupExchangeRate | null | undefined,
): string | null {
  const cup = cupEquivalent(amount, currencyCode, rate);
  if (cup == null) return null;
  return `≈ ${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: true }).format(cup)} CUP`;
}
