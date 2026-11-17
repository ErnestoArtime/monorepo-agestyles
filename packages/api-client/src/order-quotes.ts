import type {
  OrderQuoteAcceptResult,
  OrderQuoteCreateResult,
} from "@agestyles/domain/order-quotes"
import type { StoreClient } from "./transport"

/**
 * Quote-first Store API client.
 *
 * The server resolves the sellers from the cart offers, so the client only
 * sends the cart id. Non-2xx responses are thrown by the Medusa SDK with the
 * API error body (`code` included); callers decide whether to show a re-quote,
 * an expiry or a generic failure. Acceptance is not retried here: it is only
 * safe to resend with the same revision.
 */

export type CreateOrderQuoteInput = {
  cartId: string
  /** Stable per attempt; the API returns the same quote for a repeated key. */
  idempotencyKey: string
}

export function createOrderQuote(
  client: StoreClient,
  { cartId, idempotencyKey }: CreateOrderQuoteInput,
) {
  return client.fetch<OrderQuoteCreateResult>("/store/order-quotes", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { cart_id: cartId },
  })
}

export function acceptOrderQuote(
  client: StoreClient,
  quoteId: string,
  revision: number,
) {
  return client.fetch<OrderQuoteAcceptResult>(
    `/store/order-quotes/${quoteId}/accept`,
    { method: "POST", body: { revision } },
  )
}
