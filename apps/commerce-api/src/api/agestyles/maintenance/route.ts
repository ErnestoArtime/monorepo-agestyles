import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { readMaintenance } from "../../../lib/maintenance";

/**
 * Same as /store/agestyles/maintenance without a publishable key: the buyer gateway polls it
 * on the loopback to refuse carts and checkout while maintenance is on. Only on/off.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { enabled } = await readMaintenance(req.scope);
  res.json({ enabled });
}
