# ADR-005: Manual payment proofs live in an AgeStyles module

- **Status:** Accepted for the isolated lab (v1); not wired to production payments.
- **Date:** 2026-11-17
- **Decision owners:** AgeStyles project
- **Upstream versions:** Medusa 2.22.3, Mercur 2.4.1.

## Context

AgeStyles collects transfers, deposits and cash payments outside a payment provider. The legacy site stores the receipt, the reference and the administrator's decision, then records the payment against the order.

Mercur 2.4.1 ships `payout` (money owed to sellers) and Medusa ships payment providers, but neither has a buyer-submitted proof of a manual payment, its review status or a rejection reason. Inspecting `@mercurjs/core/.medusa/server/src/modules` confirms there is no receipt or manual-payment module.

Faking this in `order.metadata` was rejected: the review lifecycle needs status transitions, one-open-proof enforcement and a queryable queue.

## Decisions

1. **Owned module, no core fork.** `@agestyles/manual-payments` is a standard Medusa module registered in `apps/commerce-api/medusa-config.ts`. It defines one model, `agestyles_manual_payment`, with a generated migration. No file under `@mercurjs/*` or `@medusajs/*` is modified.
2. **Money stays in Medusa.** The proof stores the amount the buyer claims to have paid and its currency; it never recalculates the order total, moves stock or captures a payment.
3. **One open proof per order and seller.** A partial unique index on `(order_id, seller_id)` where `status = 'pending'` makes a double submit a `DUPLICATE_ERROR` at the database level, not only in application code. Rejected and verified proofs stay as history.
4. **Explicit review lifecycle.** `pending → verified` or `pending → rejected`. Verifying is idempotent. A rejected proof cannot be verified and a verified proof cannot be rejected. Rejection requires a reason of 3–240 characters.
5. **Reconciliation happens at verification.** The submit route accepts a deposit up to the order total and requires the order currency. The verify route re-reads the order and requires the proof amount and currency to match the order exactly, because the order could have changed between submit and review.
6. **Buyer data is authenticated.** `POST/GET /store/orders/:id/manual-payments` export `AUTHENTICATE = true` and compare the order's `customer_id` with the authenticated actor. A foreign order id and an unknown id return the same 404, so the endpoint cannot be used to probe orders.
7. **Administrators use the framework guard.** `/admin/manual-payments*` inherits Medusa's `/admin` user authentication; no custom middleware is added.

## Consequences

- The admin queue can filter by status and is the only place where money is confirmed.
- The two-decimal validation prevents storing sub-cent amounts that would not reconcile with Medusa totals.
- Deposits are allowed; a final reconciliation check at verification ensures the confirmed amount matches the order.
- Product/seller UI, notifications on review and a report over verified proofs remain to be built on these endpoints.
- No payment provider integration is implied: when a provider is added, this module remains the record of proofs collected outside it.

## Evidence

- `packages/manual-payments/src/models/manual-payment.ts` + `src/migrations/Migration20261117011559.ts` (generated, `amount numeric`).
- `packages/manual-payments/test/manual-payments.test.ts`: input bounds, method/currency/amount rules, exact reconciliation and within-order rules.
- `apps/commerce-api/src/scripts/verify-manual-payments.ts`: deposit accepted, over-total and wrong-currency rejected, foreign order hidden, duplicate pending rejected, rejection requires a reason, resubmit after rejection, verification matches the order, verify idempotent, verified cannot be rejected.
- `pnpm typecheck`: 11/11 projects.
