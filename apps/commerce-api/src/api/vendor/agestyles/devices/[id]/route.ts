import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { memberRecipient, removeDeviceResponse } from "../../../../../lib/notifications";

type SellerRequest = AuthenticatedMedusaRequest & { seller_context?: { seller_id?: string } };

export async function DELETE(req: SellerRequest, res: MedusaResponse) {
  res.json(await removeDeviceResponse(req.scope, await memberRecipient(req), req.params.id));
}
