# @agestyles/product-events

Anonymous product and store view/click events (AG-59), for per-store and
per-product traffic in Negocio (Fase 5 del plan de Domenek.studio).

## What it stores

One row per event, in `agestyles_product_event`:

- `product_id` (null for `store_view`), `seller_id`
- `type`: `product_view`, `store_view`, `product_click`, `add_to_cart_click`
- `surface`: `vitrina`, `tienda-web`, `tienda-app`
- `session_id`: a random id the client generates and keeps in its own
  storage; it only lets the API ignore a repeated event from the same visit
- `created_at`: always the server time

It never stores personal data, an IP address, a user agent or a client
timestamp. A product page with several sellers records one `product_view`
per seller, so each store's traffic is its own.

## Decisions (assumed, reversible — see `docs/adr/ADR-006-product-events.md`)

- Views are counted in full, not unique per session. The service only
  ignores the same event from the same visit inside 60 seconds
  (reloads, double mounts, retries).
- Retention is 90 days. The daily job
  `apps/commerce-api/src/jobs/purge-product-events.ts` deletes older
  events; nothing newer than the cutoff is ever removed.
- Rate limiting on the public route is in-memory per IP (60/min); Redis
  is a later step, like the rest of the API's limits.

## Public route

`POST /store/agestyles/events`, validated with zod at the edge and again
in this service. The clients send it in the background and ignore errors,
so tracking can never break a page.

## Tests

`pnpm --filter @agestyles/product-events test` — validation rules only,
plain Node, no database.
