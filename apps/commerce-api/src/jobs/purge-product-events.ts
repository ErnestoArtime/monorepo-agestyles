import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  AGESTYLES_PRODUCT_EVENTS_MODULE,
  retentionCutoff,
  type ProductEventsService,
} from "@agestyles/product-events";

/** Retention: product events last 90 days (AG-59, assumed decision). */
export default async function purgeProductEvents(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const cutoff = retentionCutoff(new Date());
  let total = 0;
  try {
    const service = container.resolve(
      AGESTYLES_PRODUCT_EVENTS_MODULE,
    ) as unknown as ProductEventsService;
    for (let pass = 0; pass < 20; pass += 1) {
      const removed = await service.purgeOlderThan(cutoff);
      total += removed;
      if (removed === 0) break;
    }
    if (total > 0) logger.info(`Product event retention removed ${total} records`);
  } catch (error) {
    logger.warn(
      `Product event retention failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const config = { name: "agestyles-purge-product-events", schedule: "30 4 * * *" };
