import { MedusaService } from "@medusajs/framework/utils";
import DeviceToken from "./models/device-token";
import NotificationDelivery from "./models/notification-delivery";
import NotificationPreference from "./models/notification-preference";
import Notification from "./models/notification";
import {
  EVENTS,
  NotificationValidationError,
  nextAllowedPushTime,
  quietHoursFromEnv,
  renderNotification,
  resolveDeliveryChannels,
  type DeliveryChannel,
  type DeliveryStatus,
  type DeviceInput,
  type EventCode,
  type NotificationGroup,
  type Params,
  type PreferenceRow,
  type RecipientType,
  type Target,
} from "./rules";

export type NotificationRecord = {
  id: string;
  recipient_type: RecipientType;
  recipient_id: string;
  seller_id: string | null;
  event_code: string;
  group: NotificationGroup;
  title: string;
  body: string;
  target: Target | null;
  read_at: Date | null;
  dedupe_key: string;
  created_at: Date;
};

export type DeliveryRecord = {
  id: string;
  notification_id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  attempts: number;
  next_attempt_at: Date;
  locked_until: Date | null;
  error_code: string | null;
  provider_ref: string | null;
  sent_at: Date | null;
  receipt_checked_at: Date | null;
};

export type DeviceRecord = {
  id: string;
  actor_type: RecipientType;
  actor_id: string;
  app: "buyer" | "business";
  platform: "android" | "ios" | "web";
  token: string;
  app_version: string | null;
  last_seen_at: Date;
  revoked_at: Date | null;
};

export type Actor = { actor_type: RecipientType; actor_id: string };

export type NotifyInput = {
  event_code: EventCode;
  recipient_type: RecipientType;
  recipient_id: string;
  seller_id?: string | null;
  params?: Params;
  dedupe_key: string;
  now?: Date;
};

export type InboxQuery = {
  recipient_type: RecipientType;
  recipient_id: string;
  seller_id?: string | null;
  unread_only?: boolean;
  limit: number;
  offset: number;
};

/** A duplicate event inside this window may still complete a half-created notification. */
const REPAIR_WINDOW_MS = 10 * 60_000;
const LEASE_MS = 5 * 60_000;

class NotificationsService extends MedusaService({
  Notification,
  NotificationDelivery,
  DeviceToken,
  NotificationPreference,
}) {
  private async findByDedupe(dedupeKey: string): Promise<NotificationRecord | null> {
    const [found] = (await this.listNotifications({
      dedupe_key: dedupeKey,
    })) as unknown as NotificationRecord[];
    return found ?? null;
  }

  /**
   * Writes the inbox entry and plans its external deliveries. Idempotent by
   * `dedupe_key`: emitting the same event twice never duplicates anything.
   */
  async notify(
    input: NotifyInput,
  ): Promise<{ notification: NotificationRecord; created: boolean; channels: DeliveryChannel[] }> {
    const definition = EVENTS[input.event_code];
    if (!definition) throw new NotificationValidationError("Evento de aviso desconocido.");
    if (definition.recipient !== input.recipient_type) {
      throw new NotificationValidationError("El destinatario no corresponde al evento.");
    }
    if (input.recipient_type === "member" && !input.seller_id) {
      throw new NotificationValidationError("Los avisos de negocio necesitan una tienda.");
    }
    const now = input.now ?? new Date();

    let notification = await this.findByDedupe(input.dedupe_key);
    let created = false;
    if (!notification) {
      const rendered = renderNotification(input.event_code, input.params ?? {});
      try {
        notification = (await this.createNotifications({
          recipient_type: input.recipient_type,
          recipient_id: input.recipient_id,
          seller_id: input.seller_id ?? null,
          event_code: input.event_code,
          group: definition.group,
          title: rendered.title,
          body: rendered.body,
          target: rendered.target as unknown as Record<string, unknown> | null,
          dedupe_key: input.dedupe_key,
        })) as unknown as NotificationRecord;
        created = true;
      } catch (error) {
        notification = await this.findByDedupe(input.dedupe_key);
        if (!notification) throw error;
      }
    }

    const repairing =
      now.getTime() - new Date(notification.created_at).getTime() < REPAIR_WINDOW_MS;
    if (!created && !repairing) return { notification, created, channels: [] };

    const preferences = await this.preferencesFor({
      actor_type: input.recipient_type,
      actor_id: input.recipient_id,
    });
    const channels = resolveDeliveryChannels(definition, preferences);
    const quiet = quietHoursFromEnv(process.env.AGESTYLES_NOTIFICATIONS_QUIET_HOURS);
    const existing = (await this.listNotificationDeliveries({
      notification_id: notification.id,
    })) as unknown as DeliveryRecord[];
    for (const channel of channels) {
      if (existing.some((delivery) => delivery.channel === channel)) continue;
      try {
        await this.createNotificationDeliveries({
          notification_id: notification.id,
          channel,
          status: "pending",
          attempts: 0,
          next_attempt_at: channel === "push" && quiet ? nextAllowedPushTime(now, quiet) : now,
        });
      } catch (error) {
        const [again] = await this.listNotificationDeliveries({
          notification_id: notification.id,
          channel,
        });
        if (!again) throw error;
      }
    }
    return { notification, created, channels };
  }

  // Inbox ---------------------------------------------------------------------

  async listInbox(query: InboxQuery) {
    const filters: Record<string, unknown> = {
      recipient_type: query.recipient_type,
      recipient_id: query.recipient_id,
    };
    if (query.seller_id) filters.seller_id = query.seller_id;
    const [notifications, count] = await this.listAndCountNotifications(
      query.unread_only ? { ...filters, read_at: null } : filters,
      { order: { created_at: "DESC" }, take: query.limit, skip: query.offset },
    );
    const [, unread] = await this.listAndCountNotifications(
      { ...filters, read_at: null },
      { take: 1 },
    );
    return {
      notifications: notifications as unknown as NotificationRecord[],
      count,
      unread_count: unread,
    };
  }

  async markRead(
    scope: { recipient_type: RecipientType; recipient_id: string; seller_id?: string | null },
    ids?: string[],
    now = new Date(),
  ): Promise<number> {
    const filters: Record<string, unknown> = {
      recipient_type: scope.recipient_type,
      recipient_id: scope.recipient_id,
      read_at: null,
    };
    if (scope.seller_id) filters.seller_id = scope.seller_id;
    if (ids) filters.id = ids;
    const unread = (await this.listNotifications(filters, {
      select: ["id"],
      take: 500,
    })) as unknown as { id: string }[];
    if (unread.length === 0) return 0;
    await this.updateNotifications(unread.map((row) => ({ id: row.id, read_at: now })));
    return unread.length;
  }

  // Devices -------------------------------------------------------------------

  /** A token belongs to one device: registering it again moves it to the signed-in actor. */
  async registerDevice(actor: Actor, input: DeviceInput, now = new Date()): Promise<DeviceRecord> {
    const [existing] = (await this.listDeviceTokens({
      token: input.token,
    })) as unknown as DeviceRecord[];
    const fields = {
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      app: input.app,
      platform: input.platform,
      app_version: input.app_version,
      last_seen_at: now,
      revoked_at: null,
    };
    if (existing) {
      return (await this.updateDeviceTokens({
        id: existing.id,
        ...fields,
      })) as unknown as DeviceRecord;
    }
    return (await this.createDeviceTokens({
      token: input.token,
      ...fields,
    })) as unknown as DeviceRecord;
  }

  /** Only the owner removes a token; anything else reads as not found. */
  async removeDevice(actor: Actor, id: string): Promise<boolean> {
    const [device] = (await this.listDeviceTokens({
      id,
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
    })) as unknown as DeviceRecord[];
    if (!device) return false;
    await this.deleteDeviceTokens(device.id);
    return true;
  }

  async activeDevices(actor: Actor): Promise<DeviceRecord[]> {
    return (await this.listDeviceTokens({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      revoked_at: null,
    })) as unknown as DeviceRecord[];
  }

  async revokeToken(token: string, now = new Date()): Promise<void> {
    const [device] = (await this.listDeviceTokens({ token })) as unknown as DeviceRecord[];
    if (device && !device.revoked_at) {
      await this.updateDeviceTokens({ id: device.id, revoked_at: now });
    }
  }

  async revokeDevice(id: string, now = new Date()): Promise<void> {
    const [device] = (await this.listDeviceTokens({ id })) as unknown as DeviceRecord[];
    if (device && !device.revoked_at) {
      await this.updateDeviceTokens({ id: device.id, revoked_at: now });
    }
  }

  // Preferences ---------------------------------------------------------------

  async preferencesFor(actor: Actor): Promise<PreferenceRow[]> {
    const rows = (await this.listNotificationPreferences({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
    })) as unknown as PreferenceRow[];
    return rows.map(({ group, channel, enabled }) => ({ group, channel, enabled }));
  }

  async setPreferences(actor: Actor, rows: PreferenceRow[]): Promise<PreferenceRow[]> {
    const stored = (await this.listNotificationPreferences({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
    })) as unknown as (PreferenceRow & { id: string })[];
    for (const row of rows) {
      const current = stored.find(
        (item) => item.group === row.group && item.channel === row.channel,
      );
      if (current) {
        if (current.enabled !== row.enabled) {
          await this.updateNotificationPreferences({ id: current.id, enabled: row.enabled });
        }
      } else {
        await this.createNotificationPreferences({ ...actor, ...row });
      }
    }
    return this.preferencesFor(actor);
  }

  // Delivery queue ------------------------------------------------------------

  /** Deliveries due now, plus those whose worker died holding the lease. */
  async dueDeliveries(now: Date, limit: number): Promise<DeliveryRecord[]> {
    return (await this.listNotificationDeliveries(
      {
        $or: [
          { status: "pending", next_attempt_at: { $lte: now } },
          { status: "sending", locked_until: { $lt: now } },
        ],
      } as unknown as Record<string, unknown>,
      { order: { next_attempt_at: "ASC" }, take: limit },
    )) as unknown as DeliveryRecord[];
  }

  async leaseDeliveries(ids: string[], now: Date): Promise<void> {
    if (ids.length === 0) return;
    const until = new Date(now.getTime() + LEASE_MS);
    await this.updateNotificationDeliveries(
      ids.map((id) => ({ id, status: "sending" as const, locked_until: until })),
    );
  }

  async finishDelivery(
    id: string,
    patch: {
      status: DeliveryStatus;
      attempts: number;
      next_attempt_at?: Date;
      error_code?: string | null;
      provider_ref?: string | null;
      sent_at?: Date | null;
    },
  ): Promise<void> {
    await this.updateNotificationDeliveries({
      id,
      status: patch.status,
      attempts: patch.attempts,
      locked_until: null,
      error_code: patch.error_code ?? null,
      provider_ref: patch.provider_ref ?? null,
      ...(patch.next_attempt_at ? { next_attempt_at: patch.next_attempt_at } : {}),
      ...(patch.sent_at !== undefined ? { sent_at: patch.sent_at } : {}),
    });
  }

  async markReceiptsChecked(ids: string[], now: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.updateNotificationDeliveries(ids.map((id) => ({ id, receipt_checked_at: now })));
  }

  /** Push deliveries sent at least `minAgeMs` ago whose Expo receipt was never read. */
  async deliveriesAwaitingReceipt(now: Date, minAgeMs: number, limit: number) {
    return (await this.listNotificationDeliveries(
      {
        channel: "push",
        status: "sent",
        receipt_checked_at: null,
        sent_at: { $lte: new Date(now.getTime() - minAgeMs) },
      } as unknown as Record<string, unknown>,
      { order: { sent_at: "ASC" }, take: limit },
    )) as unknown as DeliveryRecord[];
  }

  async notificationsByIds(ids: string[]): Promise<NotificationRecord[]> {
    if (ids.length === 0) return [];
    return (await this.listNotifications({ id: ids })) as unknown as NotificationRecord[];
  }

  /** Retention: inbox entries and deliveries older than the given ages are removed. */
  async purge(input: { notificationsBefore: Date; deliveriesBefore: Date }): Promise<number> {
    let removed = 0;
    const olderDeliveries = (await this.listNotificationDeliveries(
      { created_at: { $lt: input.deliveriesBefore } } as unknown as Record<string, unknown>,
      { select: ["id"], take: 500 },
    )) as unknown as { id: string }[];
    if (olderDeliveries.length) {
      await this.deleteNotificationDeliveries(olderDeliveries.map((row) => row.id));
      removed += olderDeliveries.length;
    }
    const olderNotifications = (await this.listNotifications(
      { created_at: { $lt: input.notificationsBefore } } as unknown as Record<string, unknown>,
      { select: ["id"], take: 500 },
    )) as unknown as { id: string }[];
    if (olderNotifications.length) {
      await this.deleteNotifications(olderNotifications.map((row) => row.id));
      removed += olderNotifications.length;
    }
    return removed;
  }
}

export default NotificationsService;
