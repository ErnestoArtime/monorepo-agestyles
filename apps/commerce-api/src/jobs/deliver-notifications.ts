import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { processDeliveries } from "../lib/notification-delivery";

/**
 * Sends the pending push/email deliveries every minute. The lock keeps one worker on
 * the queue at a time; a pass that cannot get it simply waits for the next minute.
 */
export default async function deliverNotifications(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    await container
      .resolve(Modules.LOCKING)
      .execute("agestyles-notifications:deliver", () => processDeliveries(container), {
        timeout: 1,
      });
  } catch (error) {
    logger.warn(
      `Notification delivery pass skipped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const config = { name: "agestyles-deliver-notifications", schedule: "* * * * *" };
