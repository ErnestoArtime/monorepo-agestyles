import { useEffect, useMemo, useState } from "react";
import { sdk } from "@/lib/sdk";

type Category = {
  id: string;
  name: string;
  parent_category_id?: string | null;
};

export type TopCategory = Category & { ids: string[] };

/** Top-level categories, each carrying its own id and those of all its subcategories. */
export function useTopCategories(): TopCategory[] {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    sdk.client
      .fetch<{ product_categories: Category[] }>("/store/product-categories", {
        query: { limit: 100, fields: "id,name,parent_category_id" },
      })
      .then(({ product_categories }) => active && setCategories(product_categories))
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const byParent = new Map<string, string[]>();
    for (const category of categories) {
      if (category.parent_category_id) {
        byParent.set(category.parent_category_id, [
          ...(byParent.get(category.parent_category_id) ?? []),
          category.id,
        ]);
      }
    }
    const descendants = (id: string): string[] => [
      id,
      ...(byParent.get(id) ?? []).flatMap((child) => descendants(child)),
    ];
    return categories
      .filter((category) => !category.parent_category_id)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((category) => ({ ...category, ids: descendants(category.id) }));
  }, [categories]);
}
