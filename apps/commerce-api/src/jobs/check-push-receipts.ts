import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { checkPushReceipts } from "../lib/notification-delivery";

/** Reads Expo receipts 15+ minutes after sending and revokes tokens of unreachable devices. */
export default async function checkReceipts(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    await container
      .resolve(Modules.LOCKING)
      .execute("agestyles-notifications:receipts", () => checkPushReceipts(container), {
        timeout: 1,
      });
  } catch (error) {
    logger.warn(
      `Push receipt check skipped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const config = { name: "agestyles-check-push-receipts", schedule: "*/10 * * * *" };
