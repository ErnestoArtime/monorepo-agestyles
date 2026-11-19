import type { MedusaResponse } from "@medusajs/framework/http";
import { categoryRequestsService, categoryTree } from "../../../../lib/category-requests";
import {
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";

/** This store's category requests (AG-35) and the current categories. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const [requests, categories] = await Promise.all([
    categoryRequestsService(req.scope).listCategoryRequests(
      { seller_id: actor.sellerId },
      { order: { created_at: "DESC" }, take: 100 },
    ),
    categoryTree(req.scope),
  ]);
  res.json({ category_requests: requests, categories, can_edit: actor.isManager });
}

/** Owner or store administration ask for a new marketplace category. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const request = await categoryRequestsService(req.scope).submitRequest(
    actor.sellerId,
    actor.memberId,
    req.body,
  );
  res.status(201).json({ category_request: request });
}
