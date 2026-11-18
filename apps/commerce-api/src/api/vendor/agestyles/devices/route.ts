import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { memberRecipient, registerDeviceResponse } from "../../../../lib/notifications";

type SellerRequest = AuthenticatedMedusaRequest & { seller_context?: { seller_id?: string } };

export async function POST(req: SellerRequest, res: MedusaResponse) {
  res
    .status(201)
    .json(await registerDeviceResponse(req.scope, await memberRecipient(req), req.body));
}
