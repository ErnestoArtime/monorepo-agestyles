import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { inboxResponse, memberRecipient } from "../../../../lib/notifications";

type SellerRequest = AuthenticatedMedusaRequest & { seller_context?: { seller_id?: string } };

/** The member's inbox for the selected store only. */
export async function GET(req: SellerRequest, res: MedusaResponse) {
  res.json(await inboxResponse(req.scope, await memberRecipient(req), req.query));
}
