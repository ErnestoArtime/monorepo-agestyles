import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { updateSellersWorkflow } from "@mercurjs/core/workflows";

/**
 * A store's own sections (AG-35): categories that only organise its page in Tienda
 * («Ofertas», «Para regalar»…), defined by the store without approval. They live in the
 * seller's metadata and only list that store's products. Marketplace categories are
 * requested to the administration instead (category-requests module).
 */
export type StoreSection = { id: string; name: string; product_ids: string[] };

const KEY = "agestyles_sections";
export const MAX_SECTIONS = 20;
export const MAX_SECTION_PRODUCTS = 200;

type Scope = Pick<MedusaContainer, "resolve">;

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

export function parseSections(body: unknown, ownProductIds: Set<string>): StoreSection[] {
  const raw = (body as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(raw)) invalid("Faltan las secciones.");
  if (raw.length > MAX_SECTIONS) invalid(`Puedes tener como máximo ${MAX_SECTIONS} secciones.`);
  const names = new Set<string>();
  return raw.map((entry, index) => {
    const section = (entry ?? {}) as Record<string, unknown>;
    const name =
      typeof section.name === "string" ? section.name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
    if (name.length < 2) invalid(`La sección ${index + 1} necesita un nombre.`);
    if (names.has(name.toLowerCase())) invalid(`La sección «${name}» está repetida.`);
    names.add(name.toLowerCase());
    const ids = Array.isArray(section.product_ids) ? [...new Set(section.product_ids)] : [];
    if (ids.length > MAX_SECTION_PRODUCTS)
      invalid(`La sección «${name}» admite como máximo ${MAX_SECTION_PRODUCTS} productos.`);
    for (const id of ids) {
      if (typeof id !== "string" || !ownProductIds.has(id))
        invalid(`La sección «${name}» solo puede tener productos de tu tienda.`);
    }
    const id =
      typeof section.id === "string" && /^sec_[a-z0-9]{1,30}$/.test(section.id)
        ? section.id
        : `sec_${Date.now().toString(36)}${index}`;
    return { id, name, product_ids: ids as string[] };
  });
}

async function sellerMetadata(scope: Scope, sellerId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: { id: string; metadata?: Record<string, unknown> | null }[] }>;
  };
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "metadata"],
    filters: { id: sellerId },
  });
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Store not found.");
  return data[0].metadata ?? {};
}

export async function readSections(scope: Scope, sellerId: string): Promise<StoreSection[]> {
  const stored = (await sellerMetadata(scope, sellerId))[KEY];
  return Array.isArray(stored) ? (stored as StoreSection[]) : [];
}

export async function writeSections(scope: Scope, sellerId: string, sections: StoreSection[]) {
  const metadata = await sellerMetadata(scope, sellerId);
  await updateSellersWorkflow(scope as MedusaContainer).run({
    input: { selector: { id: sellerId }, update: { metadata: { ...metadata, [KEY]: sections } } },
  });
  return sections;
}
