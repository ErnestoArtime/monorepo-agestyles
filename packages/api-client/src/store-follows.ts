/**
 * Client for following stores (AG-70): the signed-in customer's list, follow / unfollow and the
 * opt-in alert for new products. It only needs a `fetcher` (the same one as notifications), so
 * the app keeps its own session handling. Errors are mapped to Spanish, never shown raw.
 */
import type { Fetcher } from "./notifications";

export type FollowedStore = {
  seller_id: string;
  name: string;
  handle: string | null;
  logo: string | null;
  /** Push alert when the store publishes a new product; off until the customer turns it on. */
  notify_new_products: boolean;
  created_at: string;
};

const base = "/store/agestyles/store-follows";

export async function listFollowedStores(fetcher: Fetcher): Promise<FollowedStore[]> {
  const result = await fetcher<{ follows: FollowedStore[] }>(base);
  return result.follows;
}

export async function followStore(
  fetcher: Fetcher,
  sellerId: string,
  notifyNewProducts?: boolean,
): Promise<FollowedStore> {
  const result = await fetcher<{ follow: FollowedStore }>(base, {
    method: "POST",
    body: {
      seller_id: sellerId,
      ...(notifyNewProducts === undefined ? {} : { notify_new_products: notifyNewProducts }),
    },
  });
  return result.follow;
}

export async function unfollowStore(fetcher: Fetcher, sellerId: string): Promise<void> {
  await fetcher<{ deleted: boolean }>(`${base}/${encodeURIComponent(sellerId)}`, {
    method: "DELETE",
  });
}

export async function setStoreAlert(
  fetcher: Fetcher,
  sellerId: string,
  enabled: boolean,
): Promise<FollowedStore> {
  const result = await fetcher<{ follow: FollowedStore }>(
    `${base}/${encodeURIComponent(sellerId)}`,
    { method: "POST", body: { notify_new_products: enabled } },
  );
  return result.follow;
}

// Spanish copy --------------------------------------------------------------------------

export const FOLLOW_COPY = {
  signedOut: "Inicia sesión para seguir tiendas.",
  followed: (name: string) => `Sigues a ${name}`,
  unfollowed: (name: string) => `Has dejado de seguir a ${name}`,
  alertOn: (name: string) => `Te avisaremos de los productos nuevos de ${name}`,
  alertOff: (name: string) => `Ya no te avisaremos de los productos nuevos de ${name}`,
  failed: "No se pudo completar la acción. Inténtalo de nuevo.",
  limit: "Has llegado al máximo de tiendas que se pueden seguir.",
} as const;

/** Never shows backend text: only the few cases the customer can act on get their own message. */
export function followErrorMessage(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return FOLLOW_COPY.signedOut;
  if (status === 405 || status === 400) return FOLLOW_COPY.failed;
  const message = error instanceof Error ? error.message : "";
  return /m[aá]ximo|NOT_ALLOWED/i.test(message) ? FOLLOW_COPY.limit : FOLLOW_COPY.failed;
}

/** What a store's follow button says and announces. */
export function followButtonLabel(
  following: boolean,
  name: string,
): {
  text: string;
  accessibility: string;
} {
  return following
    ? { text: "Siguiendo", accessibility: `Dejar de seguir a ${name}` }
    : { text: "Seguir", accessibility: `Seguir a ${name}` };
}
