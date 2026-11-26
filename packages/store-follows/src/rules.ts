/**
 * Pure rules for following stores (AG-70): input validation and the «new product» window.
 * No Medusa imports, so it is testable with `node`.
 */

/** A customer can follow at most this many stores, so one account cannot flood the table. */
export const MAX_FOLLOWS_PER_CUSTOMER = 200;

/** Only products created within this many days trigger an alert (no flood when deploying). */
export const NEW_PRODUCT_WINDOW_DAYS = 14;

export class StoreFollowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreFollowValidationError";
  }
}

const SELLER_ID = /^sel_[A-Za-z0-9]{8,40}$/;

export function isSellerId(value: unknown): value is string {
  return typeof value === "string" && SELLER_ID.test(value);
}

export type FollowInput = { seller_id: string; notify_new_products: boolean | undefined };

/** `notify_new_products` is optional: absent means «leave as it is» (off for a new follow). */
export function parseFollowInput(body: unknown): FollowInput {
  const item = (body ?? {}) as Record<string, unknown>;
  if (!isSellerId(item.seller_id)) {
    throw new StoreFollowValidationError("Indica la tienda que quieres seguir.");
  }
  if (item.notify_new_products !== undefined && typeof item.notify_new_products !== "boolean") {
    throw new StoreFollowValidationError("Indica si quieres recibir avisos de productos nuevos.");
  }
  return { seller_id: item.seller_id, notify_new_products: item.notify_new_products };
}

export function parseNotifyInput(body: unknown): boolean {
  const item = (body ?? {}) as Record<string, unknown>;
  if (typeof item.notify_new_products !== "boolean") {
    throw new StoreFollowValidationError("Indica si quieres recibir avisos de productos nuevos.");
  }
  return item.notify_new_products;
}

/** A product «new» enough to alert followers about; older or undated ones never do. */
export function isRecentProduct(
  createdAt: Date | string | null | undefined,
  now: Date = new Date(),
  windowDays: number = NEW_PRODUCT_WINDOW_DAYS,
): boolean {
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const age = now.getTime() - created.getTime();
  if (Number.isNaN(age)) return false;
  // A creation date in the future (clock skew) still counts as recent.
  return age <= windowDays * 24 * 60 * 60 * 1000;
}
