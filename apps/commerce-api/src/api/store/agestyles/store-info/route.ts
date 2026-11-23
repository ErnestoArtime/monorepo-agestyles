import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { isSellerId, readPublicInfo } from "../../../../lib/store-info";

/**
 * Public «Información» of an open store, by `seller_id` (Tienda) or `handle` (Catálogo).
 * `info` is null when the store published nothing, so the apps simply hide the section.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.query.seller_id;
  const handle = req.query.handle;
  const by = isSellerId(sellerId)
    ? { sellerId }
    : typeof handle === "string" && /^[a-z0-9][a-z0-9-]{0,80}$/.test(handle)
      ? { handle }
      : null;
  if (!by) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "seller_id or handle is required.");
  }
  const found = await readPublicInfo(req.scope, by);
  res.setHeader("cache-control", "public, max-age=60");
  res.json({ seller_id: found?.seller_id ?? null, info: found?.info ?? null });
}
