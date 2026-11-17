# ADR-002: Buyer and seller actors on one AgeStyles identity

- **Status:** Validated for the isolated proof of concept; app-level mode switching remains open.
- **Date:** 2026-11-16
- **Decision owners:** AgeStyles project

## Context

The buyer app authenticates as a Medusa `customer`; the business app authenticates as a Mercur `member`. AgeStyles needs one person to use both capabilities without letting a buyer token authorize seller operations or vice versa.

## Evidence

On the isolated Mercur lab (Medusa 2.22.3 / Mercur 2.4.1), a disposable `@agestyles.example` identity was:

1. Registered through `customer/emailpass` and linked to a customer profile.
2. Invited to the `Sole Society` seller with a read-only role.
3. Reused through `member/emailpass`; a second registration returned `Identity with email already exists`.
4. Linked to the seller by accepting the invitation, followed by a fresh member login.
5. Verified with separate actor-scoped sessions: the customer session reads the customer profile, the member session reads seller memberships, and cross-actor requests return 401.

The reproducible check is `apps/commerce-api/scripts/verify-dual-actor-identity.mjs`. It uses only the loopback lab and revokes the temporary seller membership. A synthetic customer identity remains in the isolated database so the check can be repeated.

## Decision

- Use the supported Medusa/Mercur emailpass identity and seller invitation flow for the current proof of concept; no core fork or custom authentication provider is needed to link buyer and seller actors.
- Treat buyer and member JWTs as separate credentials. The client must not reuse one token for both API surfaces. After accepting a seller invitation, obtain a fresh member token before using the seller surface.
- In `business-app`, store and select actor sessions independently when buyer mode is implemented. A single sign-in screen can authenticate the same email/password for both actors and keep both resulting tokens; do not persist the raw password for token exchange.
- Validate refresh, logout-all/single-actor, changed email, revocation, and a complete app-level mode switch before production. Evaluate an external OIDC provider only if the required lifecycle or seamless cross-app sign-on cannot be met with supported actor sessions.

## Consequences

- The proof of concept confirms one login identity can be linked to both actors while server authorization remains actor-scoped.
- App-level seamless switching is not implemented yet; this ADR does not close F5 or authorize production migration.
- The customer-side identity created by the verifier is synthetic and stays in the isolated lab. No real user or Supabase identity is changed.
