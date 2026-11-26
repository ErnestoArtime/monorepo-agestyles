import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  AGESTYLES_NOTIFICATIONS_MODULE,
  dedupeKey,
  type NotificationsService,
} from "@agestyles/notifications";
import {
  AGESTYLES_STORE_FOLLOWS_MODULE,
  StoreFollowValidationError,
  isRecentProduct,
  parseFollowInput,
  parseNotifyInput,
  type StoreFollowRecord,
  type StoreFollowsService,
} from "@agestyles/store-follows";

// Self-contained on purpose (no relative imports), so the node test runner can load it.
type Scope = Pick<MedusaContainer, "resolve">;

type QueryGraph = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
    pagination?: { take?: number; skip?: number };
  }): Promise<{ data: Record<string, unknown>[] }>;
};

const queryGraph = (scope: Scope) =>
  scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;

export function storeFollowsService(scope: Scope) {
  return scope.resolve<StoreFollowsService>(AGESTYLES_STORE_FOLLOWS_MODULE);
}

type SellerRow = {
  id: string;
  name?: string | null;
  handle?: string | null;
  status?: string | null;
  logo?: string | null;
};

const SELLER_FIELDS = ["id", "name", "handle", "status", "logo"];

function asInvalidData<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof StoreFollowValidationError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
    }
    throw error;
  }
}

async function findSellers(scope: Scope, ids: string[]): Promise<Map<string, SellerRow>> {
  if (ids.length === 0) return new Map();
  const { data } = await queryGraph(scope).graph({
    entity: "seller",
    fields: SELLER_FIELDS,
    filters: { id: ids },
    pagination: { take: ids.length },
  });
  return new Map((data as SellerRow[]).map((seller) => [seller.id, seller]));
}

/** Only an open store (the same rule as its public page) can be followed or shown. */
const isOpen = (seller: SellerRow | undefined): seller is SellerRow => seller?.status === "open";

function serialize(follow: StoreFollowRecord, seller: SellerRow) {
  return {
    seller_id: follow.seller_id,
    name: seller.name?.trim() || "Tienda",
    handle: seller.handle ?? null,
    logo: seller.logo ?? null,
    notify_new_products: follow.notify_new_products,
    created_at: follow.created_at,
  };
}

/** The customer's followed stores that are still open, newest first. */
export async function listFollowsResponse(scope: Scope, customerId: string) {
  const follows = await storeFollowsService(scope).listFollows(customerId);
  const sellers = await findSellers(
    scope,
    follows.map((follow) => follow.seller_id),
  );
  return {
    follows: follows.flatMap((follow) => {
      const seller = sellers.get(follow.seller_id);
      return isOpen(seller) ? [serialize(follow, seller)] : [];
    }),
  };
}

export async function followResponse(scope: Scope, customerId: string, body: unknown) {
  const input = asInvalidData(() => parseFollowInput(body));
  const seller = (await findSellers(scope, [input.seller_id])).get(input.seller_id);
  if (!isOpen(seller)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tienda no encontrada.");
  }
  const { follow, created } = await storeFollowsService(scope).follow(
    customerId,
    input.seller_id,
    input.notify_new_products,
  );
  return { follow: serialize(follow, seller), created };
}

export async function setNotifyResponse(
  scope: Scope,
  customerId: string,
  sellerId: string,
  body: unknown,
) {
  const enabled = asInvalidData(() => parseNotifyInput(body));
  const follow = await storeFollowsService(scope).setNotify(customerId, sellerId, enabled);
  const seller = (await findSellers(scope, [sellerId])).get(sellerId);
  return { follow: serialize(follow, seller ?? { id: sellerId }) };
}

export async function unfollowResponse(scope: Scope, customerId: string, sellerId: string) {
  return { deleted: await storeFollowsService(scope).unfollow(customerId, sellerId) };
}

/**
 * Alerts the followers who turned the alert on about a product that just became published.
 * Never repeats: the notification is deduplicated by product and customer. Products that
 * are not recent (re-published old ones, or everything that exists when this ships) are ignored.
 */
export async function notifyFollowersOfNewProduct(
  scope: Scope,
  productId: string,
  now: Date = new Date(),
): Promise<number> {
  const query = queryGraph(scope);
  const [{ data: products }, { data: links }] = await Promise.all([
    query.graph({
      entity: "product",
      fields: ["id", "title", "status", "created_at"],
      filters: { id: productId },
    }),
    query.graph({
      entity: "product_seller",
      fields: ["seller_id"],
      filters: { product_id: productId },
    }),
  ]);
  const product = products[0] as
    | { id: string; title?: string | null; status?: string | null; created_at?: string | Date }
    | undefined;
  const sellerId = (links[0] as { seller_id?: string } | undefined)?.seller_id;
  if (!product || !sellerId || product.status !== "published") return 0;
  if (!isRecentProduct(product.created_at, now)) return 0;

  const seller = (await findSellers(scope, [sellerId])).get(sellerId);
  if (!isOpen(seller)) return 0;

  const customerIds = await storeFollowsService(scope).notifiableCustomerIds(sellerId);
  let notified = 0;
  for (const customerId of customerIds) {
    await scope.resolve<NotificationsService>(AGESTYLES_NOTIFICATIONS_MODULE).notify({
      event_code: "followed_store_new_product",
      recipient_type: "customer",
      recipient_id: customerId,
      params: { store: seller.name, product: product.title, product_id: product.id },
      // One alert per product and customer, however often the product is published.
      dedupe_key: dedupeKey("followed_store_new_product", product.id, customerId),
    });
    notified += 1;
  }
  return notified;
}
