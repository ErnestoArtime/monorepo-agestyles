import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { customerRecipient, preferencesResponse } from "../../../../lib/notifications";

export const AUTHENTICATE = true;

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await preferencesResponse(req.scope, customerRecipient(req)));
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await preferencesResponse(req.scope, customerRecipient(req), req.body ?? {}));
}
