import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import {
  AGESTYLES_NOTIFICATIONS_MODULE,
  EVENTS,
  GROUPS,
  NotificationValidationError,
  dedupeKey,
  memberReceives,
  parseDeviceInput,
  parsePreferencesInput,
  preferencesMatrix,
  type EventCode,
  type EventDefinition,
  type NotificationRecord,
  type NotificationsService,
  type Params,
  type RecipientType,
} from "@agestyles/notifications";

type Scope = Pick<MedusaContainer, "resolve">;

export const AGESTYLES_EVENTS = {
  ORDER_STAGE: "agestyles.order.stage_changed",
  PAYMENT_SUBMITTED: "agestyles.manual_payment.submitted",
  PAYMENT_VERIFIED: "agestyles.manual_payment.verified",
  PAYMENT_REJECTED: "agestyles.manual_payment.rejected",
  WITHDRAWAL_REQUESTED: "agestyles.commission_withdrawal.requested",
  WITHDRAWAL_RESOLVED: "agestyles.commission_withdrawal.resolved",
} as const;

export function notificationsService(scope: Scope) {
  return scope.resolve<NotificationsService>(AGESTYLES_NOTIFICATIONS_MODULE);
}

export type QueryGraph = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
    pagination?: { take?: number; skip?: number };
  }): Promise<{ data: Record<string, unknown>[] }>;
};

export function queryGraph(scope: Scope): QueryGraph {
  return scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;
}

/** Emits an AgeStyles domain event; the notification subscribers turn it into avisos. */
export async function emitAgestylesEvent(
  scope: Scope,
  name: (typeof AGESTYLES_EVENTS)[keyof typeof AGESTYLES_EVENTS],
  data: Record<string, unknown>,
): Promise<void> {
  const eventBus = scope.resolve(Modules.EVENT_BUS) as unknown as {
    emit(event: { name: string; data: Record<string, unknown> }): Promise<void>;
  };
  await eventBus.emit({ name, data });
}

/** Re-emission stops after this many failed attempts; the row stays for inspection. */
export const OUTBOX_MAX_ATTEMPTS = 10;

type OutboxService = {
  createEventOutboxes(data: {
    name: string;
    data: Record<string, unknown>;
  }): Promise<{ id: string }>;
  updateEventOutboxes(data: Record<string, unknown>): Promise<unknown>;
};

/**
 * A failed notification must never break the sale, payment or stock change that caused it.
 * The event is first written to the PostgreSQL outbox, then emitted; if Redis is down the
 * row stays pending and `relay-event-outbox` emits it later.
 */
export async function emitAgestylesEventSafely(
  scope: Scope,
  name: (typeof AGESTYLES_EVENTS)[keyof typeof AGESTYLES_EVENTS],
  data: Record<string, unknown>,
): Promise<void> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER) as {
    warn(message: string): void;
  };
  const outbox = notificationsService(scope) as unknown as OutboxService;
  let row: { id: string } | null = null;
  try {
    row = await outbox.createEventOutboxes({ name, data });
  } catch (error) {
    logger.warn(
      `Could not record ${name} in the outbox: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
  try {
    await emitAgestylesEvent(scope, name, data);
    if (row) {
      await outbox
        .updateEventOutboxes({ id: row.id, status: "emitted", attempts: 1, emitted_at: new Date() })
        .catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (row) {
      await outbox
        .updateEventOutboxes({ id: row.id, attempts: 1, last_error: message.slice(0, 300) })
        .catch(() => undefined);
    }
    logger.warn(`Could not emit ${name} (kept in the outbox): ${message}`);
  }
}

/**
 * Runs an AgeStyles notification subscriber with a few in-process retries. Only these
 * subscribers retry (they are idempotent by dedupe key); the Redis event bus keeps its
 * default of one attempt so Medusa/Mercur subscribers with external effects never repeat.
 */
export function withNotificationRetries<A extends { container: Scope }>(
  name: string,
  handler: (args: A) => Promise<void>,
  attempts = 3,
  delayMs = 2000,
): (args: A) => Promise<void> {
  return async (args: A) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await handler(args);
      } catch (error) {
        if (attempt >= attempts) throw error;
        const logger = args.container.resolve(ContainerRegistrationKeys.LOGGER) as {
          warn(message: string): void;
        };
        logger.warn(
          `${name} failed (attempt ${attempt}/${attempts}), retrying: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  };
}

export async function sellerName(scope: Scope, sellerId: string): Promise<string | null> {
  const { data } = await queryGraph(scope).graph({
    entity: "seller",
    fields: ["id", "name"],
    filters: { id: sellerId },
  });
  const name = (data[0] as { name?: string | null } | undefined)?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** The store that owns a (child) order, via Mercur's order-seller link. */
export async function orderSellerId(scope: Scope, orderId: string): Promise<string | null> {
  const { data } = await queryGraph(scope).graph({
    entity: "order_seller",
    fields: ["seller_id"],
    filters: { order_id: orderId },
  });
  const sellerId = (data[0] as { seller_id?: string } | undefined)?.seller_id;
  return sellerId ?? null;
}

export async function orderCustomerId(scope: Scope, orderId: string): Promise<string | null> {
  const { data } = await queryGraph(scope).graph({
    entity: "order",
    fields: ["id", "customer_id"],
    filters: { id: orderId },
  });
  const customerId = (data[0] as { customer_id?: string | null } | undefined)?.customer_id;
  return customerId ?? null;
}

export async function notifyCustomer(
  scope: Scope,
  input: { event_code: EventCode; customer_id: string; params?: Params; key: string[] },
) {
  return notificationsService(scope).notify({
    event_code: input.event_code,
    recipient_type: "customer",
    recipient_id: input.customer_id,
    params: input.params,
    dedupe_key: dedupeKey(...input.key, input.customer_id),
  });
}

type SellerModule = {
  listSellerMembers(filters: {
    seller_id: string;
  }): Promise<
    { member_id: string; seller_id: string; role_id: string | null; is_owner: boolean }[]
  >;
};

/**
 * One entry per marketplace administrator (Medusa `user` actors, AG-40): new stores to
 * approve, products to review, payment proofs and category requests.
 */
export async function notifyAdmins(
  scope: Scope,
  input: { event_code: EventCode; params?: Params; key: string[] },
): Promise<number> {
  const { data: users } = await queryGraph(scope).graph({ entity: "user", fields: ["id"] });
  const service = notificationsService(scope);
  for (const user of users as { id: string }[]) {
    await service.notify({
      event_code: input.event_code,
      recipient_type: "user",
      recipient_id: user.id,
      params: input.params,
      dedupe_key: dedupeKey(...input.key, user.id),
    });
  }
  return users.length;
}

/** Notifications must never break the action that triggered them. */
export async function notifySafely(label: string, send: () => Promise<unknown>) {
  try {
    await send();
  } catch (error) {
    console.error(`[notifications] ${label}:`, error instanceof Error ? error.message : error);
  }
}

/** One entry per store member allowed to see this kind of event. */
export async function notifySellerMembers(
  scope: Scope,
  input: {
    event_code: EventCode;
    seller_id: string;
    params?: Params;
    key: string[];
    target_member_id?: string | null;
  },
): Promise<number> {
  const definition: EventDefinition = EVENTS[input.event_code];
  const audience = definition.audience;
  if (!audience) throw new Error(`${input.event_code} has no member audience.`);
  const members = await scope.resolve<SellerModule>("seller").listSellerMembers({
    seller_id: input.seller_id,
  });
  const service = notificationsService(scope);
  let notified = 0;
  for (const membership of members) {
    if (!memberReceives(audience, membership, input.target_member_id)) continue;
    await service.notify({
      event_code: input.event_code,
      recipient_type: "member",
      recipient_id: membership.member_id,
      seller_id: input.seller_id,
      params: input.params,
      dedupe_key: dedupeKey(...input.key, membership.member_id),
    });
    notified += 1;
  }
  return notified;
}

// Request helpers -------------------------------------------------------------

export type Recipient = {
  recipient_type: RecipientType;
  recipient_id: string;
  seller_id: string | null;
};

type SellerRequest = AuthenticatedMedusaRequest & { seller_context?: { seller_id?: string } };

export function customerRecipient(req: AuthenticatedMedusaRequest): Recipient {
  const actorId = req.auth_context?.actor_id;
  if (!actorId || req.auth_context?.actor_type !== "customer") {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication is required.");
  }
  return { recipient_type: "customer", recipient_id: actorId, seller_id: null };
}

/** The signed-in member, always bound to the selected store they actually belong to. */
/** A marketplace administrator (Medusa `user`, AG-40). */
export function adminRecipient(req: AuthenticatedMedusaRequest): Recipient {
  const actorId = req.auth_context?.actor_id;
  if (!actorId || req.auth_context?.actor_type !== "user") {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "An administrator session is required.");
  }
  return { recipient_type: "user", recipient_id: actorId, seller_id: null };
}

export async function memberRecipient(req: SellerRequest): Promise<Recipient> {
  const sellerId = req.seller_context?.seller_id;
  const memberId = req.auth_context?.actor_id;
  if (!sellerId || !memberId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "A selected seller is required.");
  }
  const [membership] = await req.scope
    .resolve<
      SellerModule & {
        listSellerMembers(filters: {
          seller_id: string;
          member_id: string;
        }): Promise<{ member_id: string; seller_id: string }[]>;
      }
    >("seller")
    .listSellerMembers({ seller_id: sellerId, member_id: memberId });
  if (!membership || membership.seller_id !== sellerId || membership.member_id !== memberId) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "You are not a member of this store.");
  }
  return { recipient_type: "member", recipient_id: memberId, seller_id: sellerId };
}

export function asInvalidData<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof NotificationValidationError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
    }
    throw error;
  }
}

export function serializeNotification(notification: NotificationRecord) {
  return {
    id: notification.id,
    event_code: notification.event_code,
    group: notification.group,
    title: notification.title,
    body: notification.body,
    target: notification.target,
    read_at: notification.read_at,
    created_at: notification.created_at,
  };
}

function intParam(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export async function inboxResponse(
  scope: Scope,
  recipient: Recipient,
  query: Record<string, unknown>,
) {
  const limit = intParam(query.limit, 20, 1, 50);
  const offset = intParam(query.offset, 0, 0, 100_000);
  const result = await notificationsService(scope).listInbox({
    ...recipient,
    unread_only: query.unread_only === "true" || query.unread_only === "1",
    limit,
    offset,
  });
  return {
    notifications: result.notifications.map(serializeNotification),
    count: result.count,
    unread_count: result.unread_count,
    limit,
    offset,
  };
}

export async function markReadResponse(scope: Scope, recipient: Recipient, body: unknown) {
  const input = (body ?? {}) as { ids?: unknown; all?: unknown };
  let ids: string[] | undefined;
  if (input.all === true) ids = undefined;
  else if (
    Array.isArray(input.ids) &&
    input.ids.length > 0 &&
    input.ids.length <= 100 &&
    input.ids.every((id) => typeof id === "string" && id.length > 0 && id.length < 64)
  ) {
    ids = input.ids as string[];
  } else {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Indica qué avisos marcar como leídos.");
  }
  const updated = await notificationsService(scope).markRead(recipient, ids);
  return { updated };
}

export async function registerDeviceResponse(scope: Scope, recipient: Recipient, body: unknown) {
  const input = asInvalidData(() => parseDeviceInput(body));
  if (recipient.recipient_type === "member" && input.app !== "business") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Aplicación no válida.");
  }
  const device = await notificationsService(scope).registerDevice(
    { actor_type: recipient.recipient_type, actor_id: recipient.recipient_id },
    input,
  );
  return {
    device: {
      id: device.id,
      app: device.app,
      platform: device.platform,
      last_seen_at: device.last_seen_at,
    },
  };
}

export async function removeDeviceResponse(scope: Scope, recipient: Recipient, id: string) {
  const removed = await notificationsService(scope).removeDevice(
    { actor_type: recipient.recipient_type, actor_id: recipient.recipient_id },
    id,
  );
  if (!removed) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Device not found.");
  return { deleted: true };
}

export async function preferencesResponse(scope: Scope, recipient: Recipient, update?: unknown) {
  const service = notificationsService(scope);
  const actor = { actor_type: recipient.recipient_type, actor_id: recipient.recipient_id };
  const allowed = preferencesMatrix(recipient.recipient_type, []).map((row) => row.group);
  if (update !== undefined) {
    const rows = asInvalidData(() => parsePreferencesInput(update));
    for (const row of rows) {
      if (!allowed.includes(row.group) || !GROUPS.includes(row.group)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Grupo de avisos no válido.");
      }
    }
    await service.setPreferences(actor, rows);
  }
  return {
    preferences: preferencesMatrix(recipient.recipient_type, await service.preferencesFor(actor)),
  };
}

export const emailEnabled = () =>
  Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.SENDGRID_FROM_EMAIL?.trim());
