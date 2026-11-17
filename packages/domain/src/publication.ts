/**
 * Publication state mapping between the legacy Agestyles-Catalogo statuses,
 * Medusa's product status and Mercur's product-change review cycle.
 *
 * The three systems answer different questions:
 *
 * - Legacy Catalogo: `draft | published | archived` (a single flag).
 * - Medusa product: `draft | proposed | published | rejected` (whether the
 *   product is visible in a sales channel).
 * - Mercur `product-change`: `pending | confirmed | declined | canceled` (the
 *   review of a seller's requested edit, not the product's visibility).
 *
 * AgeStyles exposes one derived state so web, native and admin views agree, and
 * keeps `archived` because Medusa has no archived product status: an archived
 * product is unpublished and flagged in its metadata.
 */

export const AGESTYLES_PUBLICATION_STATES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "archived",
] as const

export type AgeStylesPublicationState =
  (typeof AGESTYLES_PUBLICATION_STATES)[number]

/** Legacy Catalogo vocabulary, kept for CSV/ETL compatibility. */
export const LEGACY_PUBLICATION_STATUSES = ["draft", "published", "archived"] as const
export type LegacyPublicationStatus = (typeof LEGACY_PUBLICATION_STATUSES)[number]

/** Medusa's product status enum. */
export type MedusaProductStatus = "draft" | "proposed" | "published" | "rejected"

/** Mercur's product-change review enum. */
export type MercurProductChangeStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "canceled"

/** Metadata key owned by AgeStyles; never read from seller input. */
export const PUBLICATION_STATE_METADATA_KEY = "agestyles_publication_state"

export type PublicationSource = {
  status: MedusaProductStatus | string
  metadata?: Record<string, unknown> | null
}

function isLegacyStatus(value: unknown): value is LegacyPublicationStatus {
  return (
    typeof value === "string" &&
    (LEGACY_PUBLICATION_STATUSES as readonly string[]).includes(value)
  )
}

export function isAgeStylesPublicationState(
  value: unknown,
): value is AgeStylesPublicationState {
  return (
    typeof value === "string" &&
    (AGESTYLES_PUBLICATION_STATES as readonly string[]).includes(value)
  )
}

/**
 * Derives the single state shown to buyers and administrators.
 *
 * `archived` wins over the product status: an archived product must stay
 * unpublished even if someone sets its status back to `published`, so the flag
 * is checked first instead of trusting the status alone.
 */
export function toPublicationState(
  product: PublicationSource,
): AgeStylesPublicationState {
  const flag = product.metadata?.[PUBLICATION_STATE_METADATA_KEY]
  if (flag === "archived") return "archived"
  if (flag === "rejected") return "rejected"

  switch (product.status) {
    case "published":
      return "published"
    case "proposed":
      return "pending_review"
    case "rejected":
      return "rejected"
    case "draft":
      return "draft"
    default:
      // Unknown upstream statuses are never treated as published.
      return "draft"
  }
}

/**
 * Converts to the legacy vocabulary used by the current site and its CSV
 * exports. `pending_review` and `rejected` are unpublished, so they map to
 * `draft`; the detailed state is available from `toPublicationState`.
 */
export function toLegacyPublicationStatus(
  state: AgeStylesPublicationState,
): LegacyPublicationStatus {
  switch (state) {
    case "published":
      return "published"
    case "archived":
      return "archived"
    default:
      return "draft"
  }
}

export type PublicationWrite = {
  /** Value to write to `product.status` in Medusa. */
  status: "draft" | "published"
  /** Metadata patch to merge on the product. */
  metadata: Record<string, unknown>
}

/**
 * Plans the write for an administrator's publication decision.
 *
 * Only `published` is publicly visible; `archived` and `rejected` unpublish the
 * product in the same operation so a stale `published` status can never leak an
 * archived item.
 */
export function planPublicationWrite(
  state: AgeStylesPublicationState,
): PublicationWrite {
  switch (state) {
    case "published":
      return {
        status: "published",
        metadata: { [PUBLICATION_STATE_METADATA_KEY]: "published" },
      }
    case "archived":
      return {
        status: "draft",
        metadata: { [PUBLICATION_STATE_METADATA_KEY]: "archived" },
      }
    case "rejected":
      return {
        status: "draft",
        metadata: { [PUBLICATION_STATE_METADATA_KEY]: "rejected" },
      }
    case "pending_review":
      return {
        status: "draft",
        metadata: { [PUBLICATION_STATE_METADATA_KEY]: "pending_review" },
      }
    case "draft":
      return {
        status: "draft",
        metadata: { [PUBLICATION_STATE_METADATA_KEY]: "draft" },
      }
  }
}

/**
 * Translates a legacy import row into a write. The ETL uses this instead of
 * inventing its own mapping; `published` rows keep their legacy status and
 * everything else stays unpublished.
 */
export function planLegacyImportWrite(
  legacy: LegacyPublicationStatus,
): PublicationWrite {
  if (!isLegacyStatus(legacy)) {
    throw new Error(`Unknown legacy publication status: ${String(legacy)}`)
  }
  return planPublicationWrite(legacy === "published" ? "published" : legacy)
}

export function isPubliclyVisible(state: AgeStylesPublicationState): boolean {
  return state === "published"
}

/**
 * Describes Mercur's review of a seller edit. It is deliberately separate from
 * the product state: a pending change does not necessarily unpublish a product
 * that is already live.
 */
export type ReviewState = "pending" | "approved" | "declined" | "canceled"

export function toReviewState(
  change: MercurProductChangeStatus | string | null | undefined,
): ReviewState | null {
  switch (change) {
    case "pending":
      return "pending"
    case "confirmed":
      return "approved"
    case "declined":
      return "declined"
    case "canceled":
      return "canceled"
    default:
      return null
  }
}
