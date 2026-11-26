import { Module } from "@medusajs/framework/utils";
import StoreFollowsService from "./service";

export const AGESTYLES_STORE_FOLLOWS_MODULE = "agestylesStoreFollows";

export { StoreFollowsService };
export {
  MAX_FOLLOWS_PER_CUSTOMER,
  NEW_PRODUCT_WINDOW_DAYS,
  StoreFollowValidationError,
  isRecentProduct,
  isSellerId,
  parseFollowInput,
  parseNotifyInput,
} from "./rules";
export type { FollowInput } from "./rules";
export type { StoreFollowRecord } from "./service";

export default Module(AGESTYLES_STORE_FOLLOWS_MODULE, {
  service: StoreFollowsService,
});
