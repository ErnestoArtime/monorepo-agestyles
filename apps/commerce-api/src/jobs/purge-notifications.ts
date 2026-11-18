import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { notificationsService } from "../lib/notifications";

const DAY = 24 * 60 * 60 * 1000;

/** Retention: inbox entries last 90 days and delivery records 30 days. */
export default async function purgeNotifications(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const now = Date.now();
  let total = 0;
  try {
    for (let pass = 0; pass < 20; pass += 1) {
      const removed = await notificationsService(container).purge({
        notificationsBefore: new Date(now - 90 * DAY),
        deliveriesBefore: new Date(now - 30 * DAY),
      });
      total += removed;
      if (removed === 0) break;
    }
    if (total > 0) logger.info(`Notification retention removed ${total} records`);
  } catch (error) {
    logger.warn(
      `Notification retention failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const config = { name: "agestyles-purge-notifications", schedule: "30 4 * * *" };
