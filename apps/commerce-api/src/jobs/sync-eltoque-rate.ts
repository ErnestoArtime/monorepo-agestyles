import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  evaluateRate,
  fetchRateFromApi,
  fetchRateFromWeb,
  type ElToqueSnapshot,
} from "../lib/eltoque-rates";
import { readExchangeRate, writeExchangeRate } from "../lib/exchange-rate";

/**
 * Keeps the informational CUP-per-USD rate fresh (AG-54). Layers, in order:
 *  1. elTOQUE's official API when ELTOQUE_API_TOKEN is set (the stable, sanctioned route).
 *  2. The public page's `Dataset` data (CC BY 4.0, shown with «Fuente: elTOQUE»), unless
 *     ELTOQUE_WEB_SYNC is "false". If Cloudflare challenges the request nothing is forced.
 *  3. Otherwise the last good value stays published; the administrator can still set it by
 *     hand through the Admin route. A bad read never replaces a good value (see
 *     `evaluateRate`: range, 48 h freshness, 25 % jump).
 */
export default async function syncElToqueRate(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const now = new Date();
  const failures: string[] = [];
  let snapshot: ElToqueSnapshot | null = null;
  let source = "";

  const token = process.env.ELTOQUE_API_TOKEN;
  if (token) {
    const api = await fetchRateFromApi(token, now);
    if (api.ok) {
      snapshot = api.snapshot;
      source = "elTOQUE (API)";
    } else {
      failures.push(`API: ${api.reason} ${api.detail}`);
    }
  }

  if (!snapshot && !["false", "0"].includes((process.env.ELTOQUE_WEB_SYNC ?? "").toLowerCase())) {
    const web = await fetchRateFromWeb();
    if (web.ok) {
      snapshot = web.snapshot;
      source = "elTOQUE (web)";
    } else {
      failures.push(`web: ${web.reason} ${web.detail}`);
    }
  }

  if (!snapshot) {
    logger.warn(
      `elTOQUE rate sync: no value read, keeping the last one${failures.length ? ` (${failures.join("; ")})` : " (no source enabled)"}`,
    );
    return;
  }

  const current = await readExchangeRate(container);
  const verdict = evaluateRate({ candidate: snapshot, current, now });
  if (!verdict.ok) {
    logger.warn(
      `elTOQUE rate sync: ${snapshot.usd} not published (${verdict.reason}: ${verdict.detail}); keeping ${current?.rate ?? "none"}`,
    );
    return;
  }
  const saved = await writeExchangeRate(
    container,
    snapshot.usd,
    source,
    snapshot.source_updated_at,
  );
  logger.info(`elTOQUE CUP-per-USD rate updated to ${saved.rate} (${source})`);
}

export const config = {
  name: "sync-eltoque-cup-rate",
  // Every 30 minutes: one request per run, well within what the site tolerates.
  schedule: "*/30 * * * *",
};
