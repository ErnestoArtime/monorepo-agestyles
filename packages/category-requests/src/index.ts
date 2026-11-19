import { Module } from "@medusajs/framework/utils";
import CategoryRequestsService from "./service";

export const AGESTYLES_CATEGORY_REQUESTS_MODULE = "agestylesCategoryRequests";

export { CategoryRequestsService };
export {
  categoryHandle,
  CategoryRequestValidationError,
  validateCategoryDecision,
  validateCategoryRequestInput,
} from "./validation";
export type { CategoryDecision, CategoryRequestInput } from "./validation";
export type { CategoryRequestRecord, CategoryRequestStatus } from "./service";
export { MAX_PENDING_PER_STORE } from "./service";

export default Module(AGESTYLES_CATEGORY_REQUESTS_MODULE, {
  service: CategoryRequestsService,
});
