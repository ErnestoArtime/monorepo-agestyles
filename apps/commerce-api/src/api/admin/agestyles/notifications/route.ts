import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { adminRecipient, inboxResponse } from "../../../../lib/notifications";

/** The administrator's own inbox (AG-40): stores to approve, products to review, proofs… */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await inboxResponse(req.scope, adminRecipient(req), req.query));
}
