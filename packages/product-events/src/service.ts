import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import ProductEvent from "./models/product-event";
import {
  PRODUCT_EVENT_DEDUP_WINDOW_MS,
  ProductEventValidationError,
  retentionCutoff,
  validateProductEventInput,
  type ProductEventInput,
} from "./validation";

export type ProductEventRecord = {
  id: string;
  product_id: string | null;
  seller_id: string;
  type: ProductEventInput["type"];
  surface: ProductEventInput["surface"];
  session_id: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type RecordedProductEvent = {
  event: ProductEventRecord;
  /** True when the same visit already sent this event in the last minute. */
  deduped: boolean;
};

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

/**
 * Anonymous product and store events.
 *
 * Recording never fails the page that sent it: the clients send the event
 * in the background and ignore errors. The service only stores what the
 * validation allows, so a forged body cannot smuggle personal data, an IP
 * or a client timestamp into the table.
 */
class ProductEventsService extends MedusaService({ ProductEvent }) {
  async recordEvent(raw: unknown): Promise<RecordedProductEvent> {
    let input: ProductEventInput;
    try {
      input = validateProductEventInput(raw);
    } catch (error) {
      if (error instanceof ProductEventValidationError) invalid(error.message);
      throw error;
    }

    // Same visit, same event, under a minute: a reload, a double mount or a
    // retry is one view, not two. Views are still counted in full across
    // visits and sessions (AG-59).
    const windowStart = new Date(Date.now() - PRODUCT_EVENT_DEDUP_WINDOW_MS);
    const recent = (await this.listProductEvents({
      session_id: input.session_id,
      type: input.type,
    })) as unknown as ProductEventRecord[];
    const repeated = recent.find((event) => {
      if (event.seller_id !== input.seller_id) return false;
      if ((event.product_id ?? null) !== (input.product_id ?? null)) return false;
      return new Date(event.created_at).getTime() >= windowStart.getTime();
    });
    if (repeated) return { event: repeated, deduped: true };

    const created = (await this.createProductEvents(
      input as unknown as Record<string, unknown>,
    )) as unknown as ProductEventRecord;
    return { event: created, deduped: false };
  }

  /**
   * Delete events older than `before`, oldest first, in small batches.
   * Returns how many were removed. The daily job calls this until it
   * returns 0; it never deletes anything newer than the cutoff.
   */
  async purgeOlderThan(before: Date, take = 500): Promise<number> {
    const page = (await this.listProductEvents(
      {},
      { take, order: { created_at: "ASC" } },
    )) as unknown as ProductEventRecord[];
    const old = page.filter((event) => new Date(event.created_at).getTime() < before.getTime());
    if (!old.length) return 0;
    await this.softDeleteProductEvents(old.map((event) => event.id));
    return old.length;
  }
}

export { PRODUCT_EVENT_DEDUP_WINDOW_MS, retentionCutoff };
export type { ProductEventInput };
export default ProductEventsService;
