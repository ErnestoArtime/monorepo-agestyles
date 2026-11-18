import type { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { checkPushReceipts, processDeliveries } from "../lib/notification-delivery";

/**
 * Runs one pass of the notification queue right now (`medusa exec`): useful to flush after an
 * outage and for disposable-data checks. It takes the same lock as the scheduled job.
 */
export default async function runNotificationDeliveries({ container }: ExecArgs) {
  const locking = container.resolve(Modules.LOCKING);
  const summary = await locking.execute(
    "agestyles-notifications:deliver",
    () => processDeliveries(container),
    { timeout: 30 },
  );
  const receipts = await checkPushReceipts(container);
  console.log(JSON.stringify({ deliveries: summary, receipts }));
}
