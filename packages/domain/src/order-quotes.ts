/**
 * Store API projection for the AgeStyles quote-first flow.
 *
 * A quote covers the whole cart, which may include several sellers. The server
 * resolves the seller list from the cart offers; the client only sends the cart
 * id. Acceptance creates one order group with one child order per seller, so
 * the client must send the revision it confirmed.
 */

export type OrderQuoteStatus =
  | "quoted"
  | "accepting"
  | "accepted"
  | "expired"
  | "unavailable"

export type OrderQuoteLine = {
  id: string
  variant_id: string
  /** Present on freshly quoted snapshots; re-quotes may omit it. */
  title?: string
  quantity: number
  unit_price: number
}

export type OrderQuoteSnapshot = {
  items: OrderQuoteLine[]
  seller_ids: string[]
  price_hash: string
}

export type OrderQuote = {
  id: string
  cart_id: string
  /** Server-resolved sellers, sorted; one quote can span several sellers. */
  seller_ids: string[]
  revision: number
  status: OrderQuoteStatus
  currency_code: string
  total: number
  available: boolean
  expires_at: string
  order_group_id: string | null
  snapshot: OrderQuoteSnapshot
}

export type OrderQuoteChildOrder = {
  id: string
  seller_id: string | null
}

export type OrderQuoteCreateResult =
  | { status: "requoted"; quote: OrderQuote }
  | { quote: OrderQuote }

export type OrderQuoteAcceptResult =
  | {
      status: "accepted"
      revision: number
      order_group_id: string
      orders: OrderQuoteChildOrder[]
    }
  | { status: "requoted"; quote: OrderQuote }
  | { status: "expired"; revision: number }
  | { status: "unavailable"; revision: number }

export type OrderQuoteAcceptanceDecision =
  | { kind: "invalid_revision" }
  | {
      kind: "already_accepted"
      revision: number
      order_group_id: string | null
    }
  | { kind: "stale_revision"; revision: number }
  | { kind: "expired"; revision: number }
  | { kind: "unavailable"; revision: number }
  | { kind: "accept"; revision: number }

/**
 * Decide whether acceptance may proceed without performing I/O.
 * An accepted quote returns its existing group so callers can recover the
 * prior response instead of completing the cart a second time.
 */
export function decideOrderQuoteAcceptance(
  quote: Pick<
    OrderQuote,
    "status" | "revision" | "expires_at" | "available" | "order_group_id"
  >,
  requestedRevision: number,
  nowMs = Date.now(),
): OrderQuoteAcceptanceDecision {
  if (!Number.isInteger(requestedRevision) || requestedRevision < 1) {
    return { kind: "invalid_revision" }
  }

  if (quote.status === "accepted") {
    return {
      kind: "already_accepted",
      revision: quote.revision,
      order_group_id: quote.order_group_id,
    }
  }

  if (requestedRevision !== quote.revision) {
    return { kind: "stale_revision", revision: quote.revision }
  }

  if (
    quote.status === "expired" ||
    Date.parse(quote.expires_at) <= nowMs
  ) {
    return { kind: "expired", revision: quote.revision }
  }

  if (!quote.available || quote.status === "unavailable") {
    return { kind: "unavailable", revision: quote.revision }
  }

  return { kind: "accept", revision: quote.revision }
}

export function orderQuoteExpiredUpdate() {
  return { status: "expired" as const }
}

export function orderQuoteUnavailableUpdate(
  quote: Pick<OrderQuote, "revision">,
) {
  return {
    status: "unavailable" as const,
    available: false,
    revision: quote.revision + 1,
  }
}

export function orderQuoteRepricedUpdate(
  quote: Pick<OrderQuote, "revision">,
  changes: Omit<
    Pick<OrderQuote, "currency_code" | "total" | "snapshot" | "expires_at">,
    "expires_at"
  > & { expires_at: string | Date; available?: boolean },
) {
  return {
    ...changes,
    revision: quote.revision + 1,
    status: "quoted" as const,
  }
}

export function orderQuoteAcceptingUpdate() {
  return { status: "accepting" as const }
}

export function orderQuoteAcceptedUpdate(orderGroupId: string) {
  return { status: "accepted" as const, order_group_id: orderGroupId }
}
