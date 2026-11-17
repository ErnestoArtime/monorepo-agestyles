import type { CatalogComparison } from "@agestyles/domain/catalog-pim";
import type { StoreClient } from "./transport";

export type CatalogComparisonResponse = {
  comparison: CatalogComparison;
  products: Array<{
    id: string;
    name: string;
    catalog_family_version_id: string | null;
  }>;
};

/** Compares two to four publicly published products through the Store API. */
export function compareStoreProducts(client: StoreClient, productIds: string[]) {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length < 2 || ids.length > 4) {
    throw new Error("Selecciona entre 2 y 4 productos para comparar.");
  }
  return client.fetch<CatalogComparisonResponse>("/store/catalog-comparison", {
    query: { ids: ids.join(",") },
  });
}
