import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { updateSellersWorkflow } from "@mercurjs/core/workflows";
import type { StoreInfo } from "@agestyles/domain/store-info" with { "resolution-mode": "import" };

/**
 * AG-55: a store's public «Información» (pickup/delivery, contacts, address, hours, social
 * networks), kept in the seller's metadata like the home and sections (no migration). The
 * rules live in `@agestyles/domain/store-info`; this file only reads and writes them.
 */
const KEY = "agestyles_info";

/**
 * `@agestyles/domain` is ESM and this app compiles to CommonJS, so the pure rules are loaded
 * with a cached dynamic import instead of a value import (same approach as the PIM routes).
 */
type Rules = {
  parseStoreInfo(body: unknown): StoreInfo;
  readStoreInfo(stored: unknown): StoreInfo;
  hasStoreInfo(info: StoreInfo): boolean;
  StoreInfoError: new (message?: string) => Error;
};
let rules: Promise<Rules> | undefined;
const loadRules = () =>
  (rules ??= import("@agestyles/domain/store-info") as unknown as Promise<Rules>);

type Scope = Pick<MedusaContainer, "resolve">;
type SellerRow = {
  id: string;
  handle?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function findSeller(
  scope: Scope,
  filters: Record<string, unknown>,
): Promise<SellerRow | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: SellerRow[] }>;
  };
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "handle", "status", "metadata"],
    filters,
  });
  return data[0] ?? null;
}

export const isSellerId = (value: unknown): value is string =>
  typeof value === "string" && /^sel_[A-Za-z0-9]+$/.test(value);

/** Turns the domain's validation error into a 400 with its Spanish message. */
export async function parseInfoBody(body: unknown): Promise<StoreInfo> {
  const { parseStoreInfo, StoreInfoError } = await loadRules();
  try {
    return parseStoreInfo(body);
  } catch (error) {
    if (error instanceof StoreInfoError)
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
    throw error;
  }
}

export async function readSellerInfo(scope: Scope, sellerId: string): Promise<StoreInfo> {
  const seller = await findSeller(scope, { id: sellerId });
  if (!seller) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Store not found.");
  return (await loadRules()).readStoreInfo(seller.metadata?.[KEY]);
}

export async function writeSellerInfo(
  scope: Scope,
  sellerId: string,
  info: StoreInfo,
): Promise<StoreInfo> {
  const seller = await findSeller(scope, { id: sellerId });
  if (!seller) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Store not found.");
  await updateSellersWorkflow(scope as MedusaContainer).run({
    input: {
      selector: { id: sellerId },
      update: { metadata: { ...(seller.metadata ?? {}), [KEY]: info } },
    },
  });
  return info;
}

/**
 * What buyers may see: only for an open store and only when something was published, so a
 * suspended or pending store shows nothing. By seller id (Tienda) or handle (Catálogo).
 */
export async function readPublicInfo(
  scope: Scope,
  by: { sellerId?: string; handle?: string },
): Promise<{ seller_id: string; info: StoreInfo } | null> {
  const seller = await findSeller(
    scope,
    by.sellerId ? { id: by.sellerId } : { handle: by.handle ?? "" },
  );
  if (!seller || seller.status !== "open") return null;
  const { readStoreInfo, hasStoreInfo } = await loadRules();
  const info = readStoreInfo(seller.metadata?.[KEY]);
  return hasStoreInfo(info) ? { seller_id: seller.id, info } : null;
}
