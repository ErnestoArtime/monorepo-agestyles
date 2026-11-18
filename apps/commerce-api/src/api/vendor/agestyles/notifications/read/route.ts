import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { markReadResponse, memberRecipient } from "../../../../../lib/notifications";

type SellerRequest = AuthenticatedMedusaRequest & { seller_context?: { seller_id?: string } };

export async function POST(req: SellerRequest, res: MedusaResponse) {
  res.json(await markReadResponse(req.scope, await memberRecipient(req), req.body));
}
