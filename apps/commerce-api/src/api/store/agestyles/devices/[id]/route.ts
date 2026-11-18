import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { customerRecipient, removeDeviceResponse } from "../../../../../lib/notifications";

export const AUTHENTICATE = true;

/** Signing out removes the device's token; only its owner can do it. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await removeDeviceResponse(req.scope, customerRecipient(req), req.params.id));
}
