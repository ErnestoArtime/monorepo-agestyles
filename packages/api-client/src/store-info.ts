import type { StoreInfo } from "@agestyles/domain/store-info";
import type { StoreClient } from "./transport";

export type { StoreInfo, DayHours, OpenStatus, SocialKey } from "@agestyles/domain/store-info";
export {
  addressLine,
  defaultHours,
  DAYS,
  emailHref,
  emptyStoreInfo,
  fulfillmentSummary,
  hasStoreInfo,
  hoursSummary,
  mapsHref,
  phoneHref,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  storeOpenStatus,
  whatsappHref,
} from "@agestyles/domain/store-info";

/**
 * The public information of an open store (AG-55), by seller id (Tienda) or handle (Catálogo).
 * Null when the store published nothing or it cannot be read: the apps then hide the section.
 */
export async function getPublicStoreInfo(
  client: StoreClient,
  by: { sellerId?: string; handle?: string },
): Promise<StoreInfo | null> {
  try {
    const result = await client.fetch<{ info: StoreInfo | null }>("/store/agestyles/store-info", {
      query: by.sellerId ? { seller_id: by.sellerId } : { handle: by.handle ?? "" },
    });
    return result.info ?? null;
  } catch {
    return null;
  }
}
