import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { isSellerId } from "@agestyles/store-follows";
import { customerRecipient } from "../../../../../lib/notifications";
import { setNotifyResponse, unfollowResponse } from "../../../../../lib/store-follows";

export const AUTHENTICATE = true;

function sellerParam(req: AuthenticatedMedusaRequest): string {
  const id = req.params.seller_id;
  if (!isSellerId(id)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Tienda no válida.");
  }
  return id;
}

/** Turn the «avisarme de productos nuevos» alert on or off for a store the customer follows. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellerId = sellerParam(req);
  res.json(
    await setNotifyResponse(req.scope, customerRecipient(req).recipient_id, sellerId, req.body),
  );
}

/** Stop following (idempotent: `deleted` is false when the customer did not follow it). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellerId = sellerParam(req);
  res.json(await unfollowResponse(req.scope, customerRecipient(req).recipient_id, sellerId));
}
