import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  isSellerId,
  parseInfoBody,
  readSellerInfo,
  writeSellerInfo,
} from "../../../../../../lib/store-info";

function sellerIdOf(req: AuthenticatedMedusaRequest): string {
  if (!isSellerId(req.params.id))
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid store id.");
  return req.params.id;
}

/** Marketplace administration: the information of any store (Medusa protects /admin). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ info: await readSellerInfo(req.scope, sellerIdOf(req)) });
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellerId = sellerIdOf(req);
  const info = await parseInfoBody(req.body);
  res.json({ info: await writeSellerInfo(req.scope, sellerId, info) });
}
