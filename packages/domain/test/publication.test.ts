import assert from "node:assert/strict"
import {
  isPubliclyVisible,
  planLegacyImportWrite,
  planPublicationWrite,
  PUBLICATION_STATE_METADATA_KEY,
  toLegacyPublicationStatus,
  toPublicationState,
  toReviewState,
} from "../src/publication.ts"

/**
 * Rule tests for the publication mapping. Run with
 * `node test/publication.test.ts` (Node 24 strips the types).
 */

const key = PUBLICATION_STATE_METADATA_KEY

// Medusa status wins when the product is not archived or rejected.
assert.equal(toPublicationState({ status: "published" }), "published")
assert.equal(toPublicationState({ status: "draft" }), "draft")
assert.equal(toPublicationState({ status: "proposed" }), "pending_review")
assert.equal(toPublicationState({ status: "rejected" }), "rejected")
assert.equal(
  toPublicationState({ status: "something_new" }),
  "draft",
  "unknown statuses are never public",
)

// The AgeStyles flag is authoritative for the two states Medusa cannot express.
assert.equal(
  toPublicationState({ status: "published", metadata: { [key]: "archived" } }),
  "archived",
  "an archived product cannot be published by a stale status",
)
assert.equal(
  toPublicationState({ status: "published", metadata: { [key]: "rejected" } }),
  "rejected",
)

// Legacy compatibility.
assert.equal(toLegacyPublicationStatus("published"), "published")
assert.equal(toLegacyPublicationStatus("archived"), "archived")
assert.equal(toLegacyPublicationStatus("draft"), "draft")
assert.equal(toLegacyPublicationStatus("pending_review"), "draft")
assert.equal(toLegacyPublicationStatus("rejected"), "draft")

// Writes always keep metadata and status consistent.
const published = planPublicationWrite("published")
assert.equal(published.status, "published")
assert.equal(published.metadata[key], "published")

for (const state of ["archived", "rejected", "pending_review", "draft"] as const) {
  const write = planPublicationWrite(state)
  assert.equal(write.status, "draft", `${state} must unpublish the product`)
  assert.equal(write.metadata[key], state)
}

assert.equal(planLegacyImportWrite("published").status, "published")
assert.equal(planLegacyImportWrite("published").metadata[key], "published")
assert.equal(planLegacyImportWrite("draft").status, "draft")
assert.equal(planLegacyImportWrite("archived").status, "draft")
assert.equal(planLegacyImportWrite("archived").metadata[key], "archived")
assert.throws(() => planLegacyImportWrite("borrador" as never))

// Only published is visible to buyers.
assert.equal(isPubliclyVisible("published"), true)
for (const state of ["draft", "pending_review", "rejected", "archived"] as const) {
  assert.equal(isPubliclyVisible(state), false, `${state} must not be public`)
}

// Mercur's change cycle is a review, not product visibility.
assert.equal(toReviewState("pending"), "pending")
assert.equal(toReviewState("confirmed"), "approved")
assert.equal(toReviewState("declined"), "declined")
assert.equal(toReviewState("canceled"), "canceled")
assert.equal(toReviewState("unknown"), null)
assert.equal(toReviewState(null), null)

console.log(
  "PASS: legacy/Medusa/Mercur publication mapping, archive precedence and review states",
)
