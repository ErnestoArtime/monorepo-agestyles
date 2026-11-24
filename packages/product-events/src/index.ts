import { Module } from "@medusajs/framework/utils";
import ProductEventsService from "./service";

export const AGESTYLES_PRODUCT_EVENTS_MODULE = "agestylesProductEvents";

export { ProductEventsService };
export {
  PRODUCT_EVENT_DEDUP_WINDOW_MS,
  PRODUCT_EVENT_RETENTION_DAYS,
  PRODUCT_EVENT_SURFACES,
  PRODUCT_EVENT_TYPES,
  ProductEventValidationError,
  retentionCutoff,
  validateProductEventInput,
} from "./validation";
export type { ProductEventInput, ProductEventSurface, ProductEventType } from "./validation";
export type { ProductEventRecord, RecordedProductEvent } from "./service";

export default Module(AGESTYLES_PRODUCT_EVENTS_MODULE, {
  service: ProductEventsService,
});
