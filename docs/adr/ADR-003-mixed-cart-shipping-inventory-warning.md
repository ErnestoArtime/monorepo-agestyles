# ADR-003: Mercur mixed-cart shipping inventory warning

- **Status:** Confirmed upstream defect; current buyer flow is not blocked; no core patch.
- **Date:** 2026-11-16
- **Decision owners:** AgeStyles project

## Context and evidence

In Mercur 2.4.1, `list-seller-shipping-options-for-cart` sets `insufficient_inventory` by comparing every cart line with the stock location of each shipping option. The loop does not first scope cart lines to the seller that owns that option.

The isolated A2 + B2 cart showed two shipped inventory items, each with `available_quantity: 20`, `stocked_quantity: 25`, and `reserved_quantity: 5` at its own seller location. Both offers were in stock, yet the A2 and B2 shipping options were each marked `insufficient_inventory: true`. This matches the upstream loop: while evaluating A2 shipping, B2's line has no level at A2's location, and vice versa.

The reproducible checkout verifier observed both warnings, successfully selected shipping for each seller, completed checkout, and produced two seller orders. The current Expo buyer screen does not use the `insufficient_inventory` field to disable options.

## Decision

- Do not edit Mercur or Medusa package source.
- The buyer client must not use this field as its stock authority for a mixed cart. Use the offer's computed stock state for adding items and the checkout's authoritative inventory validation; continue to surface actual API errors.
- Keep the warning visible in the lab verifier so a future upstream update can be checked.
- Before another client relies on `insufficient_inventory`, implement a documented AgeStyles-owned adapter/route extension or adopt an upstream fix, then verify both mixed-seller false positives and genuine insufficient-stock rejection.

## Consequences

- Current API checkout remains usable in the isolated proof of concept; this boolean is diagnostic and inaccurate for multi-seller carts.
- F1 can record the defect as understood, but the extension/upstream remediation decision remains a release gate before the field is used to block or promise inventory.
- No direct dependency source or production system was changed.
