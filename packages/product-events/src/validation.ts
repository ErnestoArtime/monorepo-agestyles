/** Rules for product events, without Medusa (tested with plain Node). */

export class ProductEventValidationError extends Error {}

export type ProductEventType =
  "product_view" | "store_view" | "product_click" | "add_to_cart_click";

export type ProductEventSurface = "vitrina" | "tienda-web" | "tienda-app";

export const PRODUCT_EVENT_TYPES: ProductEventType[] = [
  "product_view",
  "store_view",
  "product_click",
  "add_to_cart_click",
];

export const PRODUCT_EVENT_SURFACES: ProductEventSurface[] = [
  "vitrina",
  "tienda-web",
  "tienda-app",
];

export type ProductEventInput = {
  product_id: string | null;
  seller_id: string;
  type: ProductEventType;
  surface: ProductEventSurface;
  session_id: string;
};

/** Views are counted in full, not unique per session (AG-59, assumed decision). */
export const PRODUCT_EVENT_DEDUP_WINDOW_MS = 60_000;

/** Events older than this are purged by the daily job (AG-59, assumed decision). */
export const PRODUCT_EVENT_RETENTION_DAYS = 90;

const id = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max
    ? value.trim()
    : null;

const sessionId = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;

export function validateProductEventInput(raw: unknown): ProductEventInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const type = body.type;
  if (typeof type !== "string" || !(PRODUCT_EVENT_TYPES as string[]).includes(type)) {
    throw new ProductEventValidationError("El tipo de evento no es válido.");
  }
  const surface = body.surface;
  if (typeof surface !== "string" || !(PRODUCT_EVENT_SURFACES as string[]).includes(surface)) {
    throw new ProductEventValidationError("La superficie del evento no es válida.");
  }
  const sellerId = id(body.seller_id, 120);
  if (!sellerId) {
    throw new ProductEventValidationError("Falta la tienda del evento.");
  }
  const session = sessionId(body.session_id);
  if (!session) {
    throw new ProductEventValidationError("Falta el identificador anónimo de sesión.");
  }
  const productId = id(body.product_id, 120);
  if (type === "store_view") {
    if (productId !== null) {
      throw new ProductEventValidationError("La vista de tienda no lleva producto.");
    }
  } else if (productId === null) {
    throw new ProductEventValidationError("El evento necesita el producto.");
  }
  return {
    product_id: productId,
    seller_id: sellerId,
    type: type as ProductEventType,
    surface: surface as ProductEventSurface,
    session_id: session,
  };
}

/** Cutoff for the retention purge: events created before this date go away. */
export function retentionCutoff(now: Date, days: number = PRODUCT_EVENT_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
