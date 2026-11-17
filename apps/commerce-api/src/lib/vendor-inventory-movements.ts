import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  MovementValidationError,
  parseMovementFilters,
  type MovementFilters,
} from "@agestyles/inventory-movements";

export type SellerRequest = AuthenticatedMedusaRequest & {
  seller_context?: { seller_id?: string };
  permissions?: Record<string, string | undefined>;
  permissions_enforced?: boolean;
};

export type QueryGraph = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }): Promise<{ data: Record<string, unknown>[] }>;
};

/** Selected seller plus the inventory right the member holds in it. */
export function requireInventoryAccess(req: SellerRequest, mode: "view" | "edit"): string {
  const sellerId = req.seller_context?.seller_id;
  if (!sellerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "A selected seller is required.");
  }
  const right = req.permissions?.inventory_items;
  const allowed =
    mode === "view"
      ? ["view", "edit", "manage"].includes(right ?? "")
      : ["edit", "manage"].includes(right ?? "");
  if (req.permissions_enforced !== true || !allowed) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Inventory movements are not allowed.");
  }
  return sellerId;
}

export function asInvalidData<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof MovementValidationError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
    }
    throw error;
  }
}

export function readFilters(req: SellerRequest): MovementFilters {
  return asInvalidData(() => parseMovementFilters((req.query ?? {}) as Record<string, unknown>));
}

/** Service filters for a seller-scoped listing. */
export function toServiceFilters(sellerId: string, filters: MovementFilters) {
  const created: Record<string, Date> = {};
  if (filters.from) created.$gte = filters.from;
  if (filters.to) created.$lte = filters.to;
  return {
    seller_id: sellerId,
    ...(filters.inventory_item_id ? { inventory_item_id: filters.inventory_item_id } : {}),
    ...(filters.location_id ? { location_id: filters.location_id } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.actor_id ? { actor_id: filters.actor_id } : {}),
    ...(Object.keys(created).length ? { created_at: created } : {}),
  };
}

export function queryGraph(req: SellerRequest): QueryGraph {
  return req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;
}
