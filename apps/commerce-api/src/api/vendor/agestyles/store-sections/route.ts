import type { MedusaResponse } from "@medusajs/framework/http";
import { sellerProducts } from "../../../../lib/seller-products";
import { parseSections, readSections, writeSections } from "../../../../lib/store-sections";
import {
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";

/** The store's own sections (AG-35) with its products to choose from. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const [sections, products] = await Promise.all([
    readSections(req.scope, actor.sellerId),
    sellerProducts(req, actor.sellerId),
  ]);
  res.json({ sections, products, can_edit: actor.isManager });
}

/** Owner or store administration only; only this store's products. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const products = await sellerProducts(req, actor.sellerId);
  const sections = parseSections(req.body, new Set(products.map((product) => product.id)));
  res.json({ sections: await writeSections(req.scope, actor.sellerId, sections) });
}
