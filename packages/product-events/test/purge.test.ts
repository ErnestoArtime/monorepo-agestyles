import assert from "node:assert/strict";
import serviceExports from "../dist/service.js";

/**
 * Purge rule tests for product events (AG-61).
 *
 * purgeOlderThan must delete physically only the events strictly older
 * than the cutoff, oldest first, and never anything at or after it.
 * The service is exercised through its compiled output with stubbed
 * storage methods, so no database is needed. Run with
 * "node test/purge.test.ts" after "pnpm build".
 */

// dist is CommonJS: the ESM default import is the exports object,
// and the service class lives on its default property.
const ProductEventsService = (serviceExports as unknown as { default: { prototype: object } })
  .default;

type FakeRecord = {
  id: string;
  created_at: string;
};

function makeService(records: FakeRecord[], deleted: string[]) {
  const service = Object.create(ProductEventsService.prototype) as {
    purgeOlderThan: (before: Date, take?: number) => Promise<number>;
  };
  (service as unknown as Record<string, unknown>).listProductEvents = async () => records;
  (service as unknown as Record<string, unknown>).deleteProductEvents = async (ids: string[]) => {
    deleted.push(...ids);
  };
  return service;
}

const cutoff = new Date("2026-08-26T12:00:00.000Z");
const records: FakeRecord[] = [
  { id: "pevt_old1", created_at: "2026-08-20T12:00:00.000Z" },
  { id: "pevt_old2", created_at: "2026-08-26T11:59:59.999Z" },
  { id: "pevt_cutoff", created_at: "2026-08-26T12:00:00.000Z" },
  { id: "pevt_new", created_at: "2026-09-01T12:00:00.000Z" },
];

const deleted: string[] = [];
const service = makeService(records, deleted);
const removed = await service.purgeOlderThan(cutoff);
assert.equal(removed, 2);
assert.deepEqual(deleted, ["pevt_old1", "pevt_old2"]);

// Nothing old left: a second call removes nothing and never calls delete.
const deletedAgain: string[] = [];
const serviceAgain = makeService(
  records.filter((record) => !deleted.includes(record.id)),
  deletedAgain,
);
assert.equal(await serviceAgain.purgeOlderThan(cutoff), 0);
assert.deepEqual(deletedAgain, []);

console.log("product-events purge: ok");
