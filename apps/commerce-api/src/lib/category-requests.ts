import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  AGESTYLES_CATEGORY_REQUESTS_MODULE,
  type CategoryRequestsService,
} from "@agestyles/category-requests";

type Scope = Pick<MedusaContainer, "resolve">;

export function categoryRequestsService(scope: Scope) {
  return scope.resolve<CategoryRequestsService>(AGESTYLES_CATEGORY_REQUESTS_MODULE);
}

export type CategoryNode = { id: string; name: string; parent_category_id: string | null };

/** Every marketplace category with its parent, for choosing where a new one goes. */
export async function categoryTree(scope: Scope): Promise<CategoryNode[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: { entity: string; fields: string[] }): Promise<{ data: CategoryNode[] }>;
  };
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "parent_category_id"],
  });
  return data.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
