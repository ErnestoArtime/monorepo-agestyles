import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { isValidRate, writeExchangeRate } from "../lib/exchange-rate";

/**
 * Refreshes the informational CUP-per-USD rate from elTOQUE's TRMI API
 * (https://tasas.eltoque.com) when ELTOQUE_API_TOKEN is configured. Without a
 * token the job does nothing and the rate is set manually through the Admin
 * route. The web page itself blocks automated downloads, so only the API is used.
 */
export default async function syncElToqueRate(container: MedusaContainer) {
  const token = process.env.ELTOQUE_API_TOKEN;
  if (!token) return;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const format = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
  const url = new URL("https://tasas.eltoque.com/v1/trmi");
  url.searchParams.set("date_from", format(from));
  url.searchParams.set("date_to", format(now));
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      logger.warn(`elTOQUE rate sync failed with HTTP ${response.status}`);
      return;
    }
    const body = (await response.json()) as { tasas?: Record<string, unknown> };
    const rate = Number(body.tasas?.USD);
    if (!isValidRate(rate)) {
      logger.warn("elTOQUE rate sync returned no valid USD rate");
      return;
    }
    await writeExchangeRate(container, rate, "elTOQUE");
    logger.info(`elTOQUE CUP-per-USD rate updated to ${rate}`);
  } catch (error) {
    logger.warn(`elTOQUE rate sync error: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

export const config = {
  name: "sync-eltoque-cup-rate",
  schedule: "15 */4 * * *",
};
