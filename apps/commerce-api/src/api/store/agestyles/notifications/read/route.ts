import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { customerRecipient, markReadResponse } from "../../../../../lib/notifications";

export const AUTHENTICATE = true;

/** Marks some (`ids`) or all (`all: true`) of the customer's own notifications as read. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await markReadResponse(req.scope, customerRecipient(req), req.body));
}
