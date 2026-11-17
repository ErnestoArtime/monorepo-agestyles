import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { normalizeAgentCode } from "@agestyles/sales-commissions";
import {
  commissionsService,
  queryGraph,
  requireManager,
  resolveCommissionActor,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";

/** Managers list the store's agents; an agent sees only their own record. */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const service = commissionsService(req);
  const agents = actor.isManager
    ? await service.listSalesAgents({ seller_id: actor.sellerId }, { order: { created_at: "ASC" } })
    : actor.agent
      ? [actor.agent]
      : [];
  res.json({
    sales_agents: agents,
    is_manager: actor.isManager,
    own_agent_id: actor.agent?.id ?? null,
  });
}

/** Flags a member of the store as sales agent with a unique code for online sales. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  requireManager(actor);
  const body = (req.body ?? {}) as { member_id?: unknown; code?: unknown };
  const memberId = typeof body.member_id === "string" ? body.member_id.trim() : "";
  if (!memberId)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Elige el miembro de la tienda.");
  const code = normalizeAgentCode(body.code);
  if (!code) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El código del gestor debe tener entre 4 y 12 letras o números.",
    );
  }
  const seller = req.scope.resolve<{
    listSellerMembers(filters: { seller_id: string; member_id: string }): Promise<unknown[]>;
  }>("seller");
  if (
    !(await seller.listSellerMembers({ seller_id: actor.sellerId, member_id: memberId })).length
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "That member does not belong to this store.",
    );
  }
  const service = commissionsService(req);
  if ((await service.listSalesAgents({ seller_id: actor.sellerId, member_id: memberId })).length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Ese miembro ya es gestor de venta.");
  }
  if ((await service.listSalesAgents({ code })).length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Ese código ya está en uso.");
  }
  const { data: members } = await queryGraph(req).graph({
    entity: "member",
    fields: ["id", "email"],
    filters: { id: memberId },
  });
  const agent = await service.createSalesAgents({
    seller_id: actor.sellerId,
    member_id: memberId,
    member_email: (members[0] as { email?: string } | undefined)?.email ?? null,
    code,
    active: true,
  });
  res.status(201).json({ sales_agent: agent });
}
