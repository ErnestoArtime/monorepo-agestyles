import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { adminRecipient, markReadResponse } from "../../../../../lib/notifications";

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await markReadResponse(req.scope, adminRecipient(req), req.body));
}
