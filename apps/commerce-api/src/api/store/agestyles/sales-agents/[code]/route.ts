import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { agentForCode } from "../../../../../lib/agent-online-sales";

/**
 * Lets the buyer check an agent code at checkout. It only reveals the code's store name,
 * never who the agent is; the attribution itself is decided on the server when the order
 * is placed.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const agent = await agentForCode(req.scope, req.params.code);
  if (!agent) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Agent code not found.");
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: { id: string; name?: string | null }[] }>;
  };
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name"],
    filters: { id: agent.seller_id },
  });
  res.setHeader("cache-control", "no-store");
  res.json({
    sales_agent: {
      code: agent.code,
      seller_id: agent.seller_id,
      seller_name: data[0]?.name ?? null,
    },
  });
}
