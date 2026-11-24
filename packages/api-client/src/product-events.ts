import type { StoreClient } from "./transport";

/**
 * Anonymous product and store events (AG-59). The API stores one row per
 * event with the server time; it never receives personal data, an IP or a
 * client timestamp. Sending is best effort by design: a failed event
 * returns null and must never break the page that sent it.
 */

export type ProductEventType =
  "product_view" | "store_view" | "product_click" | "add_to_cart_click";

export type ProductEventSurface = "vitrina" | "tienda-web" | "tienda-app";

export type ProductEventInput = {
  product_id?: string | null;
  seller_id: string;
  type: ProductEventType;
  surface: ProductEventSurface;
  session_id: string;
};

export type RecordedProductEvent = {
  event: {
    id: string;
    product_id: string | null;
    seller_id: string;
    type: ProductEventType;
    surface: ProductEventSurface;
    created_at: string;
  };
  deduped: boolean;
};

export async function recordProductEvent(
  client: StoreClient,
  input: ProductEventInput,
): Promise<RecordedProductEvent | null> {
  try {
    return await client.fetch<RecordedProductEvent>("/store/agestyles/events", {
      method: "POST",
      body: {
        product_id: input.product_id ?? null,
        seller_id: input.seller_id,
        type: input.type,
        surface: input.surface,
        session_id: input.session_id,
      },
    });
  } catch {
    return null;
  }
}
