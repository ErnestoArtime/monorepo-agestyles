import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { customerRecipient, inboxResponse } from "../../../../lib/notifications";

export const AUTHENTICATE = true;

/** The customer's own inbox, newest first, with the unread count for the bell. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await inboxResponse(req.scope, customerRecipient(req), req.query));
}
