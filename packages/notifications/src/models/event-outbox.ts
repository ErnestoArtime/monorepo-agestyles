import { model } from "@medusajs/framework/utils";

/**
 * AgeStyles domain events written to PostgreSQL before they go to the Redis event bus.
 * If Redis is down when an order stage, payment or withdrawal changes, the row stays
 * `pending` and the relay job emits it later (subscribers are idempotent by dedupe key).
 */
const EventOutbox = model
  .define("agestyles_event_outbox", {
    id: model.id({ prefix: "aevout" }).primaryKey(),
    name: model.text(),
    data: model.json(),
    status: model.enum(["pending", "emitted", "failed"]).default("pending"),
    attempts: model.number().default(0),
    last_error: model.text().nullable(),
    emitted_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_event_outbox_pending",
      on: ["status", "created_at"],
      where: "deleted_at IS NULL",
    },
  ]);

export default EventOutbox;
