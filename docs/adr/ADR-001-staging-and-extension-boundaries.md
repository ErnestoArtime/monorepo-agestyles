# ADR-001: AgeStyles staging isolation and upstream extension boundaries

- **Status:** Accepted for the proof of concept; production cutover remains undecided.
- **Date:** 2026-11-16
- **Decision owners:** AgeStyles project

## Context

AgeStyles currently runs on the existing `Agestyles-Catalogo` Supabase project. The new Medusa + Mercur marketplace is a proof of concept and must not become a second writer or disturb the current site while its data model, identity, seller permissions, buyer journey, and migration are being validated.

The VPS hosts other services and is currently close to its storage limit. A successful application build alone does not demonstrate sufficient capacity for a database restore, media export, ETL rehearsal, or rollback artifacts.

## Decisions

1. Keep the existing AgeStyles site and Supabase project as the sole operational source of commerce data until the explicit production go/no-go.
2. Keep Mercur, Medusa, PostgreSQL, and Redis in the isolated lab. The lab PostgreSQL and Redis ports bind to loopback; test seller data and orders must never be seeded into Supabase.
3. Serve the buyer beta and catalog as previews. Their public availability is not approval to accept production orders or to route the primary AgeStyles domain to the new commerce API.
4. Do not start a full database/media backup, restore, ETL rehearsal, or large build on the VPS while disk capacity is critically low. First establish a reviewed backup destination or free space through an owner-reviewed retention plan. Do not prune Docker images or volumes belonging to other projects as a side effect of this work.
5. Do not apply the pending legacy media migration or change Supabase Auth, RLS, or data while the source-protection gate is open. Record findings and prepare migration code against isolated fixtures until a restore and go/no-go are available.
6. Implement AgeStyles business capabilities in owned packages and documented Medusa/Mercur extension points. A core fork requires a documented gap, version-specific evidence, upgrade cost, and a route back to supported extensions; see the repository `AGENTS.md`.
7. A production cutover requires a restored backup, reconciled ETL, one-writer plan, verified rollback, and explicit go/no-go. Keep Supabase available read-only/archival until the agreed retention period ends.

## Consequences

- Work can continue on the isolated lab, public preview, and migration tooling without writing to production.
- F0 and F6 remain open until PostgreSQL, Storage, and Auth preservation plus an isolated restore are proven.
- Current VPS storage pressure is an operational gate; no automated cleanup is authorized by this decision.
- No production DNS, Supabase schema, or production traffic changes are authorized by this ADR.

## Evidence to revisit this decision

- Current VPS capacity and Docker retention inventory.
- A private backup manifest with checksums and a successful restore in a separate environment.
- A repeatable ETL dry-run and reconciliation report.
- Pilot security, permissions, order isolation, rollback, and signed user acceptance results.
- A project owner go/no-go for the production cutover.
