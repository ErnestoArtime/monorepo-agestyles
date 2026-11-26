import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { customerRecipient } from "../../../../lib/notifications";
import { followResponse, listFollowsResponse } from "../../../../lib/store-follows";

export const AUTHENTICATE = true;

/** AG-70: the signed-in customer's followed stores (the identity always comes from the session). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader("cache-control", "no-store");
  res.json(await listFollowsResponse(req.scope, customerRecipient(req).recipient_id));
}

/** Follow a store (idempotent). The new-product alert starts off unless `notify_new_products: true`. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await followResponse(req.scope, customerRecipient(req).recipient_id, req.body));
}
