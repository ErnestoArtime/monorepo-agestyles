import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  emitAgestylesEvent,
  notificationsService,
  OUTBOX_MAX_ATTEMPTS,
} from "../lib/notifications";

type OutboxRow = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  attempts: number;
  created_at: Date;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Emits AgeStyles events that stayed in the outbox because Redis failed when they happened.
 * Rows younger than a minute are left alone (their own request may still be emitting them).
 * Emitted rows older than 7 days are purged.
 */
export default async function relayEventOutbox(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = notificationsService(container) as unknown as {
    listEventOutboxes(
      filters: Record<string, unknown>,
      config: Record<string, unknown>,
    ): Promise<OutboxRow[]>;
    updateEventOutboxes(data: Record<string, unknown>): Promise<unknown>;
    softDeleteEventOutboxes(ids: string[]): Promise<unknown>;
  };
  try {
    await container.resolve(Modules.LOCKING).execute(
      "agestyles-event-outbox:relay",
      async () => {
        const due = await service.listEventOutboxes(
          { status: "pending", created_at: { $lt: new Date(Date.now() - 60_000) } },
          { take: 100, order: { created_at: "ASC" } },
        );
        for (const row of due) {
          const attempts = row.attempts + 1;
          try {
            await emitAgestylesEvent(container, row.name as never, row.data);
            await service.updateEventOutboxes({
              id: row.id,
              status: "emitted",
              attempts,
              emitted_at: new Date(),
            });
          } catch (error) {
            await service.updateEventOutboxes({
              id: row.id,
              attempts,
              status: attempts >= OUTBOX_MAX_ATTEMPTS ? "failed" : "pending",
              last_error: (error instanceof Error ? error.message : "unknown error").slice(0, 300),
            });
          }
        }
        if (due.length) logger.info(`Event outbox relayed ${due.length} pending events`);
        const old = await service.listEventOutboxes(
          { status: "emitted", emitted_at: { $lt: new Date(Date.now() - 7 * DAY) } },
          { take: 500, select: ["id"] },
        );
        if (old.length) await service.softDeleteEventOutboxes(old.map((row) => row.id));
      },
      { timeout: 1 },
    );
  } catch (error) {
    logger.warn(
      `Event outbox relay skipped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const config = { name: "agestyles-relay-event-outbox", schedule: "* * * * *" };
