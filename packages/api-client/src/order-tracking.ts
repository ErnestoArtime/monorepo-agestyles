import type { OrderTracking } from "@agestyles/domain/tracking"
import type { StoreClient } from "./transport"

export type { OrderTracking } from "@agestyles/domain/tracking"

/** Reads line-level fulfillment and tracking for an authenticated buyer order. */
export function getOrderTracking(client: StoreClient, orderId: string) {
  return client.fetch<{ tracking: OrderTracking }>(
    `/store/orders/${encodeURIComponent(orderId)}/tracking`,
  )
}
