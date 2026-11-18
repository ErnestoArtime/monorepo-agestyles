import { getMenuCategories } from "@/lib/catalog";
import { SiteNav } from "./site-nav";

/** Server half of the shared header: reads the categories once for every page. */
export async function SiteHeader() {
  const categories = await getMenuCategories();
  return (
    <header>
      <div className="topline">UNA NUEVA FORMA DE DESCUBRIR · FASE PILOTO</div>
      <SiteNav categories={categories} />
    </header>
  );
}
