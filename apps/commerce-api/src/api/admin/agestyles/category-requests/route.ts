import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { categoryRequestsService, categoryTree } from "../../../../lib/category-requests";

/** Category requests from every store (AG-35), pending first, with store names and categories. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const filters =
    status === "all"
      ? {}
      : {
          status: ["pending", "approved", "merged", "rejected"].includes(status)
            ? status
            : "pending",
        };
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters?: Record<string, unknown>;
    }): Promise<{ data: { id: string; name: string }[] }>;
  };
  const requests = (await categoryRequestsService(req.scope).listCategoryRequests(filters, {
    order: { created_at: "DESC" },
    take: 200,
  })) as unknown as { seller_id: string }[];
  const sellerIds = [...new Set(requests.map((request) => request.seller_id))];
  const [{ data: sellers }, categories] = await Promise.all([
    sellerIds.length
      ? query.graph({ entity: "seller", fields: ["id", "name"], filters: { id: sellerIds } })
      : Promise.resolve({ data: [] }),
    categoryTree(req.scope),
  ]);
  const names = new Map(sellers.map((seller) => [seller.id, seller.name]));
  res.json({
    category_requests: requests.map((request) => ({
      ...request,
      seller_name: names.get(request.seller_id) ?? null,
    })),
    categories,
  });
}
