import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows";
import {
  categoryHandle,
  CategoryRequestValidationError,
  validateCategoryDecision,
} from "@agestyles/category-requests";
import { categoryRequestsService, categoryTree } from "../../../../../lib/category-requests";
import { notifySafely, notifySellerMembers } from "../../../../../lib/notifications";

/** The store's managers hear the decision (AG-40); never blocks the decision itself. */
function tellStore(
  scope: AuthenticatedMedusaRequest["scope"],
  request: { id: string; seller_id: string; name: string },
  outcome: "approved" | "merged" | "rejected",
  category: string | null,
  note: string | null,
) {
  return notifySafely("seller_category_request_resolved", () =>
    notifySellerMembers(scope, {
      event_code: "seller_category_request_resolved",
      seller_id: request.seller_id,
      params: { outcome, request: request.name, category, note },
      key: ["seller_category_request_resolved", request.id],
    }),
  );
}

/**
 * The administration decides a request (AG-35): create the category as a main one or under
 * a parent, point the store to an existing one, or reject it with a reason.
 */
export async function POST(req: AuthenticatedMedusaRequest<unknown>, res: MedusaResponse) {
  const service = categoryRequestsService(req.scope);
  const request = await service.retrievePending(req.params.id);
  let decision;
  try {
    decision = validateCategoryDecision(req.body);
  } catch (error) {
    if (error instanceof CategoryRequestValidationError)
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
    throw error;
  }
  const categories = await categoryTree(req.scope);
  const exists = (id: string) => categories.some((category) => category.id === id);
  const reviewer = req.auth_context.actor_id;

  if (decision.action === "approve") {
    if (decision.parent_id && !exists(decision.parent_id))
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "La categoría superior no existe.");
    const siblings = categories.filter(
      (category) => (category.parent_category_id ?? null) === decision.parent_id,
    );
    if (siblings.some((category) => category.name.toLowerCase() === decision.name.toLowerCase()))
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "Ya existe una categoría con ese nombre en ese lugar.",
      );
    const base = categoryHandle(decision.name);
    const { result } = await createProductCategoriesWorkflow(req.scope).run({
      input: {
        product_categories: [
          {
            name: decision.name,
            // Handles are unique across the catalog; a suffix avoids clashes with other levels.
            handle: `${base}-${Date.now().toString(36)}`,
            parent_category_id: decision.parent_id,
            is_active: true,
            is_internal: false,
          },
        ],
      },
    });
    const created = result[0]!;
    const resolved = await service.resolveRequest(request.id, {
      status: "approved",
      resolved_category_id: created.id,
      resolution_note: decision.note,
      reviewed_by: reviewer,
    });
    await tellStore(req.scope, request, "approved", created.name, decision.note);
    res.json({ category_request: resolved, category: { id: created.id, name: created.name } });
    return;
  }
  if (decision.action === "merge") {
    if (!exists(decision.category_id))
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Esa categoría no existe.");
    const target = categories.find((category) => category.id === decision.category_id);
    const merged = await service.resolveRequest(request.id, {
      status: "merged",
      resolved_category_id: decision.category_id,
      resolution_note: decision.note,
      reviewed_by: reviewer,
    });
    await tellStore(req.scope, request, "merged", target?.name ?? null, decision.note);
    res.json({ category_request: merged });
    return;
  }
  const rejected = await service.resolveRequest(request.id, {
    status: "rejected",
    resolved_category_id: null,
    resolution_note: decision.note,
    reviewed_by: reviewer,
  });
  await tellStore(req.scope, request, "rejected", null, decision.note);
  res.json({ category_request: rejected });
}
