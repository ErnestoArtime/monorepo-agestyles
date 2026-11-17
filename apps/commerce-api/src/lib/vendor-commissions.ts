import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  AGESTYLES_SALES_COMMISSIONS_MODULE,
  CommissionValidationError,
  type SalesCommissionsService,
} from "@agestyles/sales-commissions";

export type CommissionRequest = AuthenticatedMedusaRequest & {
  seller_context?: { seller_id?: string };
};

type SellerMembership = {
  member_id: string;
  seller_id: string;
  role_id: string | null;
  is_owner: boolean;
};
type SellerModule = {
  listSellerMembers(filters: { seller_id: string; member_id: string }): Promise<SellerMembership[]>;
};

export type SalesAgentRecord = {
  id: string;
  seller_id: string;
  member_id: string;
  member_email: string | null;
  code: string;
  active: boolean;
};

export type CommissionActor = {
  sellerId: string;
  memberId: string;
  /** Owner or store administration: configures rules and agents, confirms withdrawals. */
  isManager: boolean;
  /** Active sales agent record of this member in the selected store, if any. */
  agent: SalesAgentRecord | null;
};

const ADMINISTRATION_ROLE = "role_seller_administration";

export function commissionsService(req: CommissionRequest) {
  return req.scope.resolve<SalesCommissionsService>(AGESTYLES_SALES_COMMISSIONS_MODULE);
}

export function queryGraph(req: CommissionRequest) {
  return req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters?: Record<string, unknown>;
    }): Promise<{ data: Record<string, unknown>[] }>;
  };
}

/**
 * Resolves who is calling, always scoped to the selected store. Authorization
 * is decided here on the server, never from what the app shows.
 */
export async function resolveCommissionActor(req: CommissionRequest): Promise<CommissionActor> {
  const sellerId = req.seller_context?.seller_id;
  const memberId = req.auth_context?.actor_id;
  if (!sellerId || !memberId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "A selected seller is required.");
  }
  const seller = req.scope.resolve<SellerModule>("seller");
  const [membership] = await seller.listSellerMembers({ seller_id: sellerId, member_id: memberId });
  if (!membership || membership.seller_id !== sellerId || membership.member_id !== memberId) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "You are not a member of this store.");
  }
  const [agent] = (await commissionsService(req).listSalesAgents({
    seller_id: sellerId,
    member_id: memberId,
    active: true,
  })) as unknown as SalesAgentRecord[];
  return {
    sellerId,
    memberId,
    isManager: membership.is_owner || membership.role_id === ADMINISTRATION_ROLE,
    agent: agent ?? null,
  };
}

export function requireManager(actor: CommissionActor) {
  if (!actor.isManager) {
    throw new MedusaError(
      MedusaError.Types.FORBIDDEN,
      "Only the store owner or administration can do this.",
    );
  }
}

export function requireAgent(actor: CommissionActor): SalesAgentRecord {
  if (!actor.agent) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Only active sales agents can do this.");
  }
  return actor.agent;
}

/** Agents see only their own data; managers may look at any agent of the store. */
export function scopedAgentId(actor: CommissionActor, requested: unknown): string | undefined {
  if (actor.isManager) return typeof requested === "string" && requested ? requested : undefined;
  return requireAgent(actor).id;
}

export function asInvalidData<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof CommissionValidationError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
    }
    throw error;
  }
}

export const toNumber = (value: unknown) => Number(value ?? 0);
