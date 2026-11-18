import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { memberRecipient, preferencesResponse } from "../../../../lib/notifications";

type SellerRequest = AuthenticatedMedusaRequest & { seller_context?: { seller_id?: string } };

export async function GET(req: SellerRequest, res: MedusaResponse) {
  res.json(await preferencesResponse(req.scope, await memberRecipient(req)));
}

export async function POST(req: SellerRequest, res: MedusaResponse) {
  res.json(await preferencesResponse(req.scope, await memberRecipient(req), req.body ?? {}));
}
