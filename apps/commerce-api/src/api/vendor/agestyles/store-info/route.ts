import type { MedusaResponse } from "@medusajs/framework/http";
import {
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";
import { parseInfoBody, readSellerInfo, writeSellerInfo } from "../../../../lib/store-info";

/** The store's own information, for its team. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  res.json({ info: await readSellerInfo(req.scope, actor.sellerId), can_edit: actor.isManager });
}

/** Only the owner or the store's administration may change it. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const info = await parseInfoBody(req.body);
  res.json({ info: await writeSellerInfo(req.scope, actor.sellerId, info), can_edit: true });
}
