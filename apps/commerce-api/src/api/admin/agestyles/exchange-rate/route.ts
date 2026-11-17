import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  isValidRate,
  MAX_RATE,
  MIN_RATE,
  readExchangeRate,
  writeExchangeRate,
} from "../../../../lib/exchange-rate";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ exchange_rate: await readExchangeRate(req.scope) });
}

/** Sets the informational CUP-per-USD rate. Admin-only (Medusa protects /admin). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as { rate?: unknown; source?: unknown };
  const rate = typeof body.rate === "string" ? Number(body.rate) : body.rate;
  if (!isValidRate(rate)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `rate must be a number between ${MIN_RATE} and ${MAX_RATE}`,
    );
  }
  const source =
    typeof body.source === "string" && body.source.trim() ? body.source.trim() : "manual";
  res.json({ exchange_rate: await writeExchangeRate(req.scope, rate, source) });
}
