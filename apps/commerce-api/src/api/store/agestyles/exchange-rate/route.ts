import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { readExchangeRate } from "../../../../lib/exchange-rate";

/** Public, informational CUP-per-USD rate. `exchange_rate` is null until one is set. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const exchangeRate = await readExchangeRate(req.scope);
  res.setHeader("cache-control", "public, max-age=300");
  res.json({ exchange_rate: exchangeRate });
}
