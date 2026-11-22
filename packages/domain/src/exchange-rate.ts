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
  /** The publisher's own timestamp (elTOQUE), when known. */
  source_updated_at?: string | null;
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

const SOURCE_DATE_ZONE = "America/Havana";

function formatSourceDate(stamp: string): string | null {
  const time = Date.parse(stamp);
  if (!Number.isFinite(time)) return null;
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  try {
    return new Intl.DateTimeFormat("es-ES", { ...options, timeZone: SOURCE_DATE_ZONE }).format(
      time,
    );
  } catch {
    // Some runtimes lack named time zones: fall back to UTC rather than failing.
    return new Intl.DateTimeFormat("es-ES", { ...options, timeZone: "UTC" }).format(time);
  }
}

/**
 * The line shown next to a CUP equivalent. elTOQUE's data is CC BY 4.0, so the source is
 * always named when the rate comes from it: «Tasa informativa · Fuente: elTOQUE · 22 nov 2026».
 */
export function rateSourceLine(rate: CupExchangeRate | null | undefined): string | null {
  if (!rate) return null;
  const date = formatSourceDate(rate.source_updated_at ?? rate.updated_at);
  const parts = ["Tasa informativa"];
  if (/eltoque/i.test(rate.source)) parts.push("Fuente: elTOQUE");
  if (date) parts.push(date);
  return parts.join(" · ");
}
