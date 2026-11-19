import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { readMaintenance } from "../../../../lib/maintenance";

/** Public: whether Tienda and the Catálogo are in maintenance, and what to show. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const maintenance = await readMaintenance(req.scope);
  res.setHeader("cache-control", "public, max-age=15");
  res.json({ maintenance });
}
