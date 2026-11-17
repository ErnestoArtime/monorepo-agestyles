# AgeStyles project rules

## Extend Medusa and Mercur without forking their cores

Medusa and Mercur are the commerce foundation; AgeStyles-specific business rules and user experiences belong in maintained project code. Before implementing a capability, inspect the versions pinned in this repository and confirm the supported extension points for those versions in the official documentation or upstream source. Do not assume an extension available in another version is available here.

Use this order when adding or changing commerce behavior:

1. Prefer supported configuration, Medusa modules/plugins, providers, workflows, hooks, events, and API extensions.
2. For Mercur administration and seller experiences, prefer its supported Dashboard SDK extensions, slots/blocks, and documented extension APIs. For a substantially different experience, build an AgeStyles-owned web or mobile interface against the APIs.
3. Keep AgeStyles business logic in owned packages and register/integrate it with `apps/commerce-api`; keep shared API clients, SDKs, and UI components framework-appropriate and reusable.
4. Modify or fork Medusa/Mercur core only when a documented, supported extension cannot meet a concrete requirement. Record the limitation, affected upstream version/files, upgrade and merge cost, and a path back to a supported extension in the project docs before relying on the fork.

Do not patch installed dependencies, vendor upstream application source into the monorepo as a substitute for an extension, or make product-specific changes directly in Medusa/Mercur core when a supported project-owned extension can do the job.

## Organize AgeStyles-owned capabilities

Place independently maintained business capabilities under `packages/`, using clear names such as `organizations`, `catalog-pim`, `publication`, `quotations`, or `ai-studio` when the work is approved and needed. These packages may be Medusa modules/plugins or application libraries; make that role explicit in their package metadata and documentation. Put API/mobile/web clients and shared components in packages that describe their actual role. Keep app-specific screens and composition in `apps/`.

Do not create empty placeholder packages just to reserve names. Add a package when there is a concrete capability to implement, and document how it is registered, which apps consume it, and which upstream extension points it relies on. Keep UI packages independent of server-only Medusa modules.

## Compatibility and integration record

When introducing an AgeStyles extension or upgrading Medusa/Mercur:

- Record the relevant Medusa, Mercur, SDK, and framework versions and the supported extension points used in the applicable architecture or feature documentation.
- Keep business rules, authorization, and tenant/store boundaries enforced on the server; hiding controls in a dashboard or app is not authorization.
- Identify affected flows and define the integration checks needed for them, such as product publication, inventory, checkout/orders, payment/shipping, and per-store permissions. Run checks appropriate to the requested work before declaring it complete.
- Prefer narrow adapters and documented APIs so upstream upgrades affect a small, identifiable integration surface.

The default rule is: **do not modify Medusa or Mercur core while a supported extension point can satisfy the requirement.** A fork is an explicit, documented last resort, not the normal customization path.

## Shared light and dark themes

Every AgeStyles interface must support light and dark themes using `@agestyles/design-tokens` as its canonical palette. Expo applications follow `useColorScheme()`/the device preference; web applications follow `prefers-color-scheme` unless a persisted user preference is explicitly implemented. Use semantic foreground/background pairs such as `onAction`, `onSuccess`, and `onError`; do not hardcode `Colors.light` or duplicate base hex colors in components. Validate WCAG AA contrast and include empty, error, selected, focused, and loading states in theme reviews. See `docs/design-system.md` for implementation guidance.

## Spanish user-facing copy

Spanish is the default language for customer, seller, and administration interfaces across web and mobile. Write labels, navigation, empty/loading/error states, accessibility labels, dates, and status names in natural Spanish (`es-ES` formatting unless a locale setting is available). Map API enums and errors to Spanish labels/messages; do not display raw backend error text or unknown enum values. Preserve proper names, trademarks, and product titles; translate descriptive catalog content when its meaning is clear, and do not invent product claims. Keep internal code identifiers, protocol fields, and logs in their established technical language.

## Coordination between agents

Codex, Claude Code and OpenCode work on this repository together toward one goal, stated at the top of `docs/TABLERO.md`. That board is the single source of tasks, owners and progress: take a task there (commit and push the claim before changing code), keep its state current, and close it with the commits and checks that prove it. Append each turn's changes, commands and results to `docs/CODEX_HANDOFF.md`. Codex consolidates `docs/STATUS_PLAN_MAESTRO.md`; other agents propose phase-status changes in the handoff instead of editing it. Do not change files declared by another agent's in-progress task, and leave production, infrastructure, migrated-data or business-rule changes marked for cross-review by the other agent. Production deploys, migrations and data writes need the user's explicit authorization in that session.

