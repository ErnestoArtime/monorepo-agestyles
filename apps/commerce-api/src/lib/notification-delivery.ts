import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  ExpoPushClient,
  ExpoRequestError,
  decodeTicketRef,
  encodeTicketRef,
  isQuietHour,
  nextAllowedPushTime,
  quietHoursFromEnv,
  renderEmail,
  retryDelayMs,
  type DeliveryRecord,
  type DeviceRecord,
  type NotificationRecord,
  type PushMessage,
  type PushResult,
} from "@agestyles/notifications";
import { emailEnabled, notificationsService, queryGraph } from "./notifications";

const BATCH = 100;
const RECEIPT_MIN_AGE_MS = 15 * 60_000;
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60_000;

export type DeliverySummary = { sent: number; skipped: number; retried: number; failed: number };

type Logger = { info(message: string): void; warn(message: string): void };

function expoClient() {
  return new ExpoPushClient({
    accessToken: process.env.EXPO_ACCESS_TOKEN?.trim() || null,
    baseUrl: process.env.AGESTYLES_EXPO_API_URL?.trim() || undefined,
  });
}

/** The web page a button in an email should open for a recipient type. */
function appUrl(recipientType: string): string | null {
  const raw =
    recipientType === "customer"
      ? process.env.AGESTYLES_STORE_WEB_URL
      : process.env.AGESTYLES_BUSINESS_WEB_URL;
  const base = raw?.trim().replace(/\/+$/, "");
  if (!base?.startsWith("https://")) return null;
  // Administrators read their notices in Negocio's administration.
  return recipientType === "user" ? `${base}/admin/avisos` : base;
}

/** Failed attempts back off (1 min … 12 h); after the last one the delivery stays `failed`. */
async function scheduleRetry(
  container: MedusaContainer,
  delivery: DeliveryRecord,
  errorCode: string,
  now: Date,
  summary: DeliverySummary,
) {
  const service = notificationsService(container);
  const attempts = delivery.attempts + 1;
  const delay = retryDelayMs(attempts);
  if (delay === null) {
    await service.finishDelivery(delivery.id, {
      status: "failed",
      attempts,
      error_code: errorCode,
    });
    summary.failed += 1;
    return;
  }
  await service.finishDelivery(delivery.id, {
    status: "pending",
    attempts,
    error_code: errorCode,
    next_attempt_at: new Date(now.getTime() + delay),
  });
  summary.retried += 1;
}

async function skip(
  container: MedusaContainer,
  delivery: DeliveryRecord,
  errorCode: string,
  summary: DeliverySummary,
) {
  await notificationsService(container).finishDelivery(delivery.id, {
    status: "skipped",
    attempts: delivery.attempts,
    error_code: errorCode,
  });
  summary.skipped += 1;
}

async function deliverPush(
  container: MedusaContainer,
  deliveries: DeliveryRecord[],
  notifications: Map<string, NotificationRecord>,
  now: Date,
  summary: DeliverySummary,
) {
  const service = notificationsService(container);
  const quiet = quietHoursFromEnv(process.env.AGESTYLES_NOTIFICATIONS_QUIET_HOURS);
  const prepared: { delivery: DeliveryRecord; devices: DeviceRecord[]; messages: PushMessage[] }[] =
    [];

  for (const delivery of deliveries) {
    const notification = notifications.get(delivery.notification_id);
    if (!notification) {
      await skip(container, delivery, "notification_missing", summary);
      continue;
    }
    if (quiet && isQuietHour(now, quiet)) {
      await service.finishDelivery(delivery.id, {
        status: "pending",
        attempts: delivery.attempts,
        next_attempt_at: nextAllowedPushTime(now, quiet),
      });
      continue;
    }
    const devices = await service.activeDevices({
      actor_type: notification.recipient_type,
      actor_id: notification.recipient_id,
    });
    if (devices.length === 0) {
      await skip(container, delivery, "no_device", summary);
      continue;
    }
    prepared.push({
      delivery,
      devices,
      messages: devices.map((device) => ({
        to: device.token,
        title: notification.title,
        body: notification.body,
        data: { notification_id: notification.id, target: notification.target },
      })),
    });
  }
  if (prepared.length === 0) return;

  let results: PushResult[];
  try {
    results = await expoClient().send(prepared.flatMap((item) => item.messages));
  } catch (error) {
    const code = error instanceof ExpoRequestError ? error.message : "push_failed";
    for (const item of prepared) await scheduleRetry(container, item.delivery, code, now, summary);
    return;
  }

  let cursor = 0;
  for (const item of prepared) {
    const own = results.slice(cursor, cursor + item.devices.length);
    cursor += item.devices.length;
    const delivered: { deviceId: string; ticketId: string }[] = [];
    let retryCode: string | null = null;
    let fatalCode: string | null = null;
    for (const [index, result] of own.entries()) {
      const device = item.devices[index];
      if (result.ok) {
        delivered.push({ deviceId: device.id, ticketId: result.ticketId });
      } else if (result.action === "revoke") {
        await service.revokeDevice(device.id, now);
      } else if (result.action === "retry") {
        retryCode = result.code;
      } else {
        fatalCode = result.code;
      }
    }
    if (delivered.length > 0) {
      await service.finishDelivery(item.delivery.id, {
        status: "sent",
        attempts: item.delivery.attempts + 1,
        provider_ref: encodeTicketRef(delivered),
        sent_at: now,
      });
      summary.sent += 1;
    } else if (retryCode) {
      await scheduleRetry(container, item.delivery, retryCode, now, summary);
    } else if (fatalCode) {
      await service.finishDelivery(item.delivery.id, {
        status: "failed",
        attempts: item.delivery.attempts + 1,
        error_code: fatalCode,
      });
      summary.failed += 1;
    } else {
      await skip(container, item.delivery, "no_device", summary);
    }
  }
}

async function recipientEmail(
  container: MedusaContainer,
  notification: NotificationRecord,
): Promise<string | null> {
  const entity =
    notification.recipient_type === "customer"
      ? "customer"
      : notification.recipient_type === "user"
        ? "user"
        : "member";
  const { data } = await queryGraph(container).graph({
    entity,
    fields: ["id", "email"],
    filters: { id: notification.recipient_id },
  });
  const email = (data[0] as { email?: string | null } | undefined)?.email;
  return typeof email === "string" && email.includes("@") ? email : null;
}

async function deliverEmail(
  container: MedusaContainer,
  deliveries: DeliveryRecord[],
  notifications: Map<string, NotificationRecord>,
  now: Date,
  summary: DeliverySummary,
) {
  const service = notificationsService(container);
  const notificationModule = container.resolve(Modules.NOTIFICATION);
  for (const delivery of deliveries) {
    const notification = notifications.get(delivery.notification_id);
    if (!notification) {
      await skip(container, delivery, "notification_missing", summary);
      continue;
    }
    if (!emailEnabled()) {
      await skip(container, delivery, "email_provider_off", summary);
      continue;
    }
    const to = await recipientEmail(container, notification);
    if (!to) {
      await skip(container, delivery, "no_email", summary);
      continue;
    }
    try {
      const url = appUrl(notification.recipient_type);
      await notificationModule.createNotifications({
        to,
        channel: "email",
        template: notification.event_code,
        trigger_type: `agestyles.${notification.event_code}`,
        resource_id: notification.id,
        receiver_id: notification.recipient_id,
        idempotency_key: `agestyles-delivery:${delivery.id}`,
        data: { notification_id: notification.id },
        // The stored text is authoritative: it already carries the store and the stage.
        content: renderEmail({
          subject: notification.title,
          heading: notification.title,
          paragraphs: [notification.body],
          button: url ? { label: "Abrir AgeStyles", url } : undefined,
        }),
      });
      await service.finishDelivery(delivery.id, {
        status: "sent",
        attempts: delivery.attempts + 1,
        sent_at: now,
      });
      summary.sent += 1;
    } catch {
      await scheduleRetry(container, delivery, "email_failed", now, summary);
    }
  }
}

/** One pass of the queue: lease what is due, send it by channel, record each outcome. */
export async function processDeliveries(
  container: MedusaContainer,
  now = new Date(),
): Promise<DeliverySummary> {
  const summary: DeliverySummary = { sent: 0, skipped: 0, retried: 0, failed: 0 };
  const service = notificationsService(container);
  const due = await service.dueDeliveries(now, BATCH);
  if (due.length === 0) return summary;
  await service.leaseDeliveries(
    due.map((delivery) => delivery.id),
    now,
  );
  const notifications = new Map(
    (
      await service.notificationsByIds([
        ...new Set(due.map((delivery) => delivery.notification_id)),
      ])
    ).map((notification) => [notification.id, notification]),
  );
  await deliverPush(
    container,
    due.filter((delivery) => delivery.channel === "push"),
    notifications,
    now,
    summary,
  );
  await deliverEmail(
    container,
    due.filter((delivery) => delivery.channel === "email"),
    notifications,
    now,
    summary,
  );
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as Logger;
  logger.info(
    `Notification deliveries: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.retried} to retry, ${summary.failed} failed`,
  );
  return summary;
}

/**
 * Expo answers "ok" when it accepts a message; the receipt, minutes later, says whether the
 * device was reachable. A `DeviceNotRegistered` receipt revokes that device's token.
 */
export async function checkPushReceipts(
  container: MedusaContainer,
  now = new Date(),
): Promise<number> {
  const service = notificationsService(container);
  const waiting = await service.deliveriesAwaitingReceipt(now, RECEIPT_MIN_AGE_MS, 200);
  if (waiting.length === 0) return 0;

  const expired: DeliveryRecord[] = [];
  const live: DeliveryRecord[] = [];
  for (const delivery of waiting) {
    const age = now.getTime() - new Date(delivery.sent_at ?? now).getTime();
    (age > RECEIPT_MAX_AGE_MS ? expired : live).push(delivery);
  }
  await service.markReceiptsChecked(
    expired.map((delivery) => delivery.id),
    now,
  );
  if (live.length === 0) return expired.length;

  const pairs = live.flatMap((delivery) => decodeTicketRef(delivery.provider_ref));
  let receipts: Map<string, PushResult>;
  try {
    receipts = await expoClient().receipts(pairs.map((pair) => pair.ticketId));
  } catch {
    return expired.length;
  }
  for (const pair of pairs) {
    const receipt = receipts.get(pair.ticketId);
    if (receipt && !receipt.ok && receipt.action === "revoke") {
      await service.revokeDevice(pair.deviceId, now);
    }
  }
  await service.markReceiptsChecked(
    live.map((delivery) => delivery.id),
    now,
  );
  return expired.length + live.length;
}
