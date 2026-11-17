import assert from "node:assert/strict"
import {
  decideOrderQuoteAcceptance,
  orderQuoteAcceptedUpdate,
  orderQuoteAcceptingUpdate,
  orderQuoteExpiredUpdate,
  orderQuoteRepricedUpdate,
  orderQuoteUnavailableUpdate,
  type OrderQuote,
} from "../src/order-quotes.ts"

const now = Date.parse("2026-11-17T12:00:00.000Z")

const quote: OrderQuote = {
  id: "quote_test_1",
  cart_id: "cart_test_1",
  seller_ids: ["seller_a", "seller_b"],
  revision: 3,
  status: "quoted",
  currency_code: "eur",
  total: 125,
  available: true,
  expires_at: "2026-11-17T12:15:00.000Z",
  order_group_id: null,
  snapshot: {
    items: [
      {
        id: "line_a",
        variant_id: "variant_a",
        quantity: 1,
        unit_price: 50,
      },
      {
        id: "line_b",
        variant_id: "variant_b",
        quantity: 1,
        unit_price: 75,
      },
    ],
    seller_ids: ["seller_a", "seller_b"],
    price_hash: "price_hash_v3",
  },
}

assert.deepEqual(decideOrderQuoteAcceptance(quote, 3, now), {
  kind: "accept",
  revision: 3,
})

for (const invalidRevision of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.deepEqual(
    decideOrderQuoteAcceptance(quote, invalidRevision, now),
    { kind: "invalid_revision" },
    `revision ${invalidRevision} must be rejected`,
  )
}

assert.deepEqual(decideOrderQuoteAcceptance(quote, 2, now), {
  kind: "stale_revision",
  revision: 3,
})

const expired = {
  ...quote,
  expires_at: "2026-11-17T12:00:00.000Z",
}
assert.deepEqual(decideOrderQuoteAcceptance(expired, 3, now), {
  kind: "expired",
  revision: 3,
})
assert.deepEqual(
  decideOrderQuoteAcceptance(
    { ...quote, status: "expired", expires_at: "2026-11-17T12:30:00.000Z" },
    3,
    now,
  ),
  { kind: "expired", revision: 3 },
  "the persisted terminal state remains expired even if its date is later changed",
)

const unavailable = { ...quote, available: false }
assert.deepEqual(decideOrderQuoteAcceptance(unavailable, 3, now), {
  kind: "unavailable",
  revision: 3,
})
assert.deepEqual(
  decideOrderQuoteAcceptance({ ...quote, status: "unavailable" }, 3, now),
  { kind: "unavailable", revision: 3 },
)

const accepted = {
  ...quote,
  status: "accepted" as const,
  order_group_id: "og_test_1",
}
const repeatedAcceptance = decideOrderQuoteAcceptance(accepted, 3, now)
assert.deepEqual(repeatedAcceptance, {
  kind: "already_accepted",
  revision: 3,
  order_group_id: "og_test_1",
})
assert.deepEqual(
  decideOrderQuoteAcceptance(accepted, 1, now),
  repeatedAcceptance,
  "a repeated request resolves to the same accepted group even when its submitted revision is stale",
)

assert.deepEqual(orderQuoteExpiredUpdate(), { status: "expired" })
assert.deepEqual(orderQuoteUnavailableUpdate(quote), {
  status: "unavailable",
  available: false,
  revision: 4,
})
assert.deepEqual(
  orderQuoteRepricedUpdate(quote, {
    currency_code: "eur",
    total: 130,
    snapshot: { ...quote.snapshot, price_hash: "price_hash_v4" },
    expires_at: "2026-11-17T12:30:00.000Z",
  }),
  {
    currency_code: "eur",
    total: 130,
    snapshot: { ...quote.snapshot, price_hash: "price_hash_v4" },
    expires_at: "2026-11-17T12:30:00.000Z",
    revision: 4,
    status: "quoted",
  },
)
assert.deepEqual(orderQuoteAcceptingUpdate(), { status: "accepting" })
assert.deepEqual(orderQuoteAcceptedUpdate("og_test_1"), {
  status: "accepted",
  order_group_id: "og_test_1",
})

console.log(
  "PASS: quote acceptance preconditions, expiry, unavailable, revision transitions and repeated accepted-group decision",
)
