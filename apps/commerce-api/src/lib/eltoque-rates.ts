/**
 * AG-54: reads the CUP-per-USD rate that elTOQUE publishes, without a browser.
 *
 * elTOQUE publishes its «Mercado informal» rates as schema.org `Dataset` JSON-LD on
 * https://eltoque.com/tasas-de-cambio-cuba (CC BY 4.0: reuse is allowed citing elTOQUE; the
 * apps show «Fuente: elTOQUE»). The page sits behind Cloudflare, which today answers a phone
 * user agent with the page and desktop or bot user agents with a challenge (403). This module
 * never tries to defeat that challenge: when it is blocked the caller keeps the last good
 * value and the official API token (or the manual rate) remains the fallback.
 *
 * Pure functions only (no Medusa imports) so they are unit-tested with real page samples.
 */

export const ELTOQUE_PAGE_URL = "https://eltoque.com/tasas-de-cambio-cuba";
export const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";

/** A phone user agent: the one Cloudflare lets through today (Utilitaria uses the same). */
export const ELTOQUE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Mobile Safari/537.36";

/** Mirrors MIN_RATE / MAX_RATE in `exchange-rate.ts` (kept apart so this file stays pure). */
export const RATE_BOUNDS = { min: 1, max: 100_000 } as const;
/** Data older than this is not published as «current». */
export const MAX_SOURCE_AGE_MS = 48 * 60 * 60 * 1000;
/** An automatic value moving more than this from the previous automatic one is held back. */
export const MAX_JUMP_RATIO = 0.25;
/** The jump check only compares against a previous automatic value younger than this. */
export const JUMP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export type ElToqueSnapshot = {
  usd: number;
  /** elTOQUE's own timestamp (ISO), when the page gives one. */
  source_updated_at: string | null;
  origin: "dataset" | "text" | "api";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/** The `Dataset` JSON-LD block: structured, numeric and dated. Preferred source. */
function parseDataset(html: string): ElToqueSnapshot | null {
  for (const block of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let data: unknown;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const candidates: unknown[] = Array.isArray(data)
      ? data
      : isRecord(data) && Array.isArray(data["@graph"])
        ? (data["@graph"] as unknown[])
        : [data];
    for (const item of candidates) {
      if (!isRecord(item)) continue;
      const type = item["@type"];
      const isDataset = type === "Dataset" || (Array.isArray(type) && type.includes("Dataset"));
      if (!isDataset || !Array.isArray(item.variableMeasured)) continue;
      const usd = item.variableMeasured.find(
        (entry) => isRecord(entry) && entry.name === "USD/CUP",
      );
      const value = isRecord(usd) ? numberOrNull(usd.value) : null;
      if (value === null) continue;
      return {
        usd: value,
        source_updated_at: isoOrNull(item.dateModified),
        origin: "dataset",
      };
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Fallback when the JSON-LD is missing: the visible «Mercado informal» block. */
function parseVisibleText(html: string): ElToqueSnapshot | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|nbsp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ");
  const block = text.match(
    /Mercado Informal de Divisas en Cuba\s*\(Tiempo Real\)(.*?)(?:Los valores de REFERENCIA|$)/i,
  );
  if (!block) return null;
  const usd = block[1].match(/\bUSD\b.{0,80}?(\d{2,}(?:[.,]\d{1,2})?)\s*CUP/i);
  const value = usd ? numberOrNull(usd[1]) : null;
  return value === null ? null : { usd: value, source_updated_at: null, origin: "text" };
}

/** Reads the USD/CUP rate out of the page HTML, or null when it cannot be found. */
export function parseElToqueHtml(html: string): ElToqueSnapshot | null {
  return parseDataset(html) ?? parseVisibleText(html);
}

/** The official TRMI API answer: `{ tasas: { USD: number, … }, date? }`. */
export function parseElToqueApi(body: unknown): ElToqueSnapshot | null {
  if (!isRecord(body) || !isRecord(body.tasas)) return null;
  const value = numberOrNull(body.tasas.USD);
  if (value === null) return null;
  return { usd: value, source_updated_at: isoOrNull(body.date), origin: "api" };
}

/** True when Cloudflare answered with its challenge page instead of the content. */
export function looksBlocked(status: number, body: string): boolean {
  return status === 403 || status === 429 || /<title>\s*(Just a moment|Un momento)/i.test(body);
}

export type RateVerdict =
  { ok: true } | { ok: false; reason: "invalid" | "stale" | "jump"; detail: string };

/**
 * Decides whether a read value may replace the published one. Never throws.
 * - `invalid`: outside the allowed range.
 * - `stale`: elTOQUE's own date is older than 48 hours.
 * - `jump`: moves more than 25 % from the previous AUTOMATIC value (so a typo typed by hand
 *   never blocks the automatic value from correcting it).
 */
export function evaluateRate(input: {
  candidate: ElToqueSnapshot;
  current: { rate: number; source: string; updated_at: string } | null;
  now: Date;
}): RateVerdict {
  const { candidate, current, now } = input;
  const value = candidate.usd;
  if (!(value >= RATE_BOUNDS.min && value <= RATE_BOUNDS.max)) {
    return { ok: false, reason: "invalid", detail: `${value} is outside the allowed range` };
  }
  if (candidate.source_updated_at) {
    const age = now.getTime() - Date.parse(candidate.source_updated_at);
    if (age > MAX_SOURCE_AGE_MS) {
      return {
        ok: false,
        reason: "stale",
        detail: `elTOQUE data is ${Math.round(age / 3_600_000)} h old`,
      };
    }
  }
  const automatic = current !== null && /^elToque/i.test(current.source);
  if (current && automatic && now.getTime() - Date.parse(current.updated_at) <= JUMP_WINDOW_MS) {
    const change = Math.abs(value - current.rate) / current.rate;
    if (change > MAX_JUMP_RATIO) {
      return {
        ok: false,
        reason: "jump",
        detail: `${current.rate} → ${value} is a ${Math.round(change * 100)} % change`,
      };
    }
  }
  return { ok: true };
}

export type FetchOutcome =
  | { ok: true; snapshot: ElToqueSnapshot }
  | { ok: false; reason: "blocked" | "http" | "unreadable" | "network"; detail: string };

type FetchLike = typeof fetch;

/** Layer 2: the public page, one polite request with a phone user agent. */
export async function fetchRateFromWeb(fetchImpl: FetchLike = fetch): Promise<FetchOutcome> {
  try {
    const response = await fetchImpl(ELTOQUE_PAGE_URL, {
      headers: {
        "user-agent": ELTOQUE_USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "es-ES,es;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    if (looksBlocked(response.status, body)) {
      return { ok: false, reason: "blocked", detail: `HTTP ${response.status} (challenge)` };
    }
    if (!response.ok) return { ok: false, reason: "http", detail: `HTTP ${response.status}` };
    const snapshot = parseElToqueHtml(body);
    return snapshot
      ? { ok: true, snapshot }
      : { ok: false, reason: "unreadable", detail: "no USD rate found in the page" };
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}

/** Layer 1: the official TRMI API, when a token is configured. */
export async function fetchRateFromApi(
  token: string,
  now: Date,
  fetchImpl: FetchLike = fetch,
): Promise<FetchOutcome> {
  const format = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
  const url = new URL(ELTOQUE_API_URL);
  url.searchParams.set("date_from", format(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  url.searchParams.set("date_to", format(now));
  try {
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, reason: "http", detail: `HTTP ${response.status}` };
    const snapshot = parseElToqueApi(await response.json());
    return snapshot
      ? { ok: true, snapshot }
      : { ok: false, reason: "unreadable", detail: "no USD rate in the API answer" };
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}
