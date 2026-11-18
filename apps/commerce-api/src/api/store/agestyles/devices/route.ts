import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { customerRecipient, registerDeviceResponse } from "../../../../lib/notifications";

export const AUTHENTICATE = true;

/** Registers (or moves to this customer) the push token of the signed-in device. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.status(201).json(await registerDeviceResponse(req.scope, customerRecipient(req), req.body));
}
