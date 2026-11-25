import { Module } from "@medusajs/framework/utils";
import NotificationsService from "./service";

export const AGESTYLES_NOTIFICATIONS_MODULE = "agestylesNotifications";

export { NotificationsService };
export {
  EXPO_API_URL,
  EXPO_PUSH_URL,
  EXPO_RECEIPTS_URL,
  ExpoPushClient,
  ExpoRequestError,
  RECEIPT_BATCH,
  SEND_BATCH,
  classifyPushError,
  decodeTicketRef,
  encodeTicketRef,
} from "./expo";
export type { PushErrorAction, PushMessage, PushResult } from "./expo";
export {
  APPS,
  CHANNELS,
  DEFAULT_CHANNEL_ENABLED,
  DEFAULT_QUIET_HOURS,
  DELIVERY_STATUSES,
  EVENTS,
  EVENT_CODES,
  GENERIC_NOTIFICATION,
  GROUPS,
  MAX_ATTEMPTS,
  NotificationValidationError,
  PLATFORMS,
  RECIPIENT_TYPES,
  RETRY_DELAYS_MS,
  SELLER_ROLES,
  dedupeKey,
  eventAllowsEmail,
  isEventCode,
  isQuietHour,
  memberReceives,
  nextAllowedPushTime,
  parseDeviceInput,
  parsePreferencesInput,
  preferencesMatrix,
  quietHoursFromEnv,
  renderEmail,
  renderEventEmail,
  renderNotification,
  renderPasswordResetEmail,
  resolveDeliveryChannels,
  retryDelayMs,
} from "./rules";
export type {
  AppName,
  DeliveryChannel,
  DeliveryStatus,
  DeviceInput,
  EmailContent,
  EventCode,
  EventDefinition,
  MemberAudience,
  Membership,
  NotificationGroup,
  Params,
  Platform,
  PreferenceRow,
  RecipientType,
  Rendered,
  Target,
} from "./rules";
export type {
  Actor,
  DeliveryRecord,
  DeviceRecord,
  InboxQuery,
  NotificationRecord,
  NotifyInput,
} from "./service";

export default Module(AGESTYLES_NOTIFICATIONS_MODULE, {
  service: NotificationsService,
});
