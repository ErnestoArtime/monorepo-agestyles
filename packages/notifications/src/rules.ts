/**
 * Pure rules for AgeStyles notifications (AG-19): event catalog with Spanish
 * texts, recipient audiences, channel preferences, retry backoff, quiet hours
 * and input validation. No Medusa imports, so it is testable with `node`.
 */

export const RECIPIENT_TYPES = ["customer", "member"] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

/** In-app inbox is implicit and always on; these are the external channels. */
export const CHANNELS = ["push", "email"] as const;
export type DeliveryChannel = (typeof CHANNELS)[number];

export const GROUPS = [
  "orders",
  "payments",
  "inventory",
  "commissions",
  "catalog",
  "account",
] as const;
export type NotificationGroup = (typeof GROUPS)[number];

export const APPS = ["buyer", "business"] as const;
export type AppName = (typeof APPS)[number];

export const PLATFORMS = ["android", "ios", "web"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DELIVERY_STATUSES = ["pending", "sending", "sent", "failed", "skipped"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

export type Target = { screen: string; params?: Record<string, string> };
export type Params = Record<string, string | number | null | undefined>;
export type Rendered = { title: string; body: string; target: Target | null };

/** Which store members receive a business notification. */
export type MemberAudience = "orders" | "inventory" | "managers" | "member";

export type EventDefinition = {
  recipient: RecipientType;
  group: NotificationGroup;
  /** External channels offered for this event; the inbox is always written. */
  channels: DeliveryChannel[];
  /** Account/security events: external channels cannot be turned off. */
  mandatory?: boolean;
  audience?: MemberAudience;
  render(params: Params): Rendered;
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const quoted = (value: unknown): string => {
  const name = text(value);
  return name ? `«${name}»` : "El producto";
};

function orderTarget(params: Params): Target {
  const id = text(params.order_id);
  return id ? { screen: "order", params: { id } } : { screen: "orders" };
}

const store = (params: Params) => text(params.store) || "La tienda";
const storeLower = (params: Params) => text(params.store) || "la tienda";

export const EVENTS = {
  order_placed: {
    recipient: "customer",
    group: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido recibido",
      body: "Hemos recibido tu pedido. Te avisaremos de cada novedad.",
      target: orderTarget(p),
    }),
  },
  order_preparing: {
    recipient: "customer",
    group: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido en preparación",
      body: `${store(p)} está preparando tu pedido.`,
      target: orderTarget(p),
    }),
  },
  order_ready: {
    recipient: "customer",
    group: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido listo",
      body: `Tu pedido de ${storeLower(p)} está listo.`,
      target: orderTarget(p),
    }),
  },
  order_dispatched: {
    recipient: "customer",
    group: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido despachado",
      body: `Tu pedido de ${storeLower(p)} va en camino.`,
      target: orderTarget(p),
    }),
  },
  order_delivered: {
    recipient: "customer",
    group: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido entregado",
      body: `Tu pedido de ${storeLower(p)} se ha entregado.`,
      target: orderTarget(p),
    }),
  },
  order_canceled: {
    recipient: "customer",
    group: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido cancelado",
      body: "Se ha cancelado uno de tus pedidos. Consulta los detalles en Mis pedidos.",
      target: orderTarget(p),
    }),
  },
  payment_verified: {
    recipient: "customer",
    group: "payments",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pago verificado",
      body: `${store(p)} ha verificado tu comprobante de pago.`,
      target: orderTarget(p),
    }),
  },
  payment_rejected: {
    recipient: "customer",
    group: "payments",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pago rechazado",
      body: "No se ha podido verificar tu comprobante de pago. Revísalo y vuelve a enviarlo.",
      target: orderTarget(p),
    }),
  },
  seller_order_placed: {
    recipient: "member",
    group: "orders",
    audience: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Pedido nuevo",
      body: `Ha entrado un pedido nuevo en ${storeLower(p)}.`,
      target: {
        screen: "orders",
        ...(text(p.order_id) ? { params: { id: text(p.order_id) } } : {}),
      },
    }),
  },
  seller_payment_proof: {
    recipient: "member",
    group: "payments",
    audience: "orders",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Comprobante de pago",
      body: "Un cliente ha enviado un comprobante de pago para revisar.",
      target: {
        screen: "orders",
        ...(text(p.order_id) ? { params: { id: text(p.order_id) } } : {}),
      },
    }),
  },
  seller_low_stock: {
    recipient: "member",
    group: "inventory",
    audience: "inventory",
    channels: ["push", "email"],
    render: (p) => {
      const available = Number(p.available);
      const units = Number.isFinite(available)
        ? ` (${available} ${available === 1 ? "unidad" : "unidades"})`
        : "";
      return {
        title: "Stock bajo",
        body: `${quoted(p.product)} tiene pocas unidades${units}.`,
        target: { screen: "inventory" },
      };
    },
  },
  seller_product_approved: {
    recipient: "member",
    group: "catalog",
    audience: "managers",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Producto aprobado",
      body: `${quoted(p.product)} ya está publicado.`,
      target: { screen: "products" },
    }),
  },
  seller_product_rejected: {
    recipient: "member",
    group: "catalog",
    audience: "managers",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Producto rechazado",
      body: `${quoted(p.product)} no se ha publicado. Revisa los comentarios y corrígelo.`,
      target: { screen: "products" },
    }),
  },
  seller_product_changes_requested: {
    recipient: "member",
    group: "catalog",
    audience: "managers",
    channels: ["push", "email"],
    render: (p) => ({
      title: "Cambios solicitados",
      body: `${quoted(p.product)} necesita cambios antes de publicarse.`,
      target: { screen: "products" },
    }),
  },
  commission_withdrawal_requested: {
    recipient: "member",
    group: "commissions",
    audience: "managers",
    channels: ["push", "email"],
    render: () => ({
      title: "Retiro solicitado",
      body: "Un gestor ha solicitado un retiro de comisiones.",
      target: { screen: "commissions" },
    }),
  },
  commission_withdrawal_paid: {
    recipient: "member",
    group: "commissions",
    audience: "member",
    channels: ["push", "email"],
    render: () => ({
      title: "Retiro entregado",
      body: "Tu retiro de comisiones se ha marcado como entregado.",
      target: { screen: "commissions" },
    }),
  },
  commission_withdrawal_rejected: {
    recipient: "member",
    group: "commissions",
    audience: "member",
    channels: ["push", "email"],
    render: () => ({
      title: "Retiro rechazado",
      body: "Tu solicitud de retiro de comisiones se ha rechazado.",
      target: { screen: "commissions" },
    }),
  },
} satisfies Record<string, EventDefinition>;

export type EventCode = keyof typeof EVENTS;
export const EVENT_CODES = Object.keys(EVENTS) as EventCode[];

export function isEventCode(value: unknown): value is EventCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EVENTS, value);
}

/** What the apps show when they meet a code they do not know: never the raw code. */
export const GENERIC_NOTIFICATION: Rendered = {
  title: "Tienes una novedad",
  body: "Abre la app para ver los detalles.",
  target: null,
};

export function renderNotification(code: string, params: Params = {}): Rendered {
  if (!isEventCode(code)) return GENERIC_NOTIFICATION;
  const definition: EventDefinition = EVENTS[code];
  return definition.render(params);
}

export function dedupeKey(...parts: (string | null | undefined)[]): string {
  const clean = parts.map((part) => (part ?? "").trim());
  if (clean.length === 0 || clean.some((part) => !part)) {
    throw new NotificationValidationError("A dedupe key needs non-empty parts.");
  }
  return clean.join(":");
}

// Audiences ------------------------------------------------------------------

export const SELLER_ROLES = {
  administration: "role_seller_administration",
  inventory: "role_seller_inventory_management",
  support: "role_seller_support",
} as const;

export type Membership = { member_id: string; role_id: string | null; is_owner: boolean };

/**
 * Mirrors what `seller-permissions` grants: owner and administration manage
 * everything, support reads orders, inventory management edits stock.
 */
export function memberReceives(
  audience: MemberAudience,
  membership: Membership,
  targetMemberId?: string | null,
): boolean {
  const manager = membership.is_owner || membership.role_id === SELLER_ROLES.administration;
  switch (audience) {
    case "managers":
      return manager;
    case "orders":
      return manager || membership.role_id === SELLER_ROLES.support;
    case "inventory":
      return manager || membership.role_id === SELLER_ROLES.inventory;
    case "member":
      return !!targetMemberId && membership.member_id === targetMemberId;
  }
}

// Preferences ----------------------------------------------------------------

export const DEFAULT_CHANNEL_ENABLED: Record<DeliveryChannel, boolean> = {
  push: true,
  email: false,
};

export type PreferenceRow = {
  group: NotificationGroup;
  channel: DeliveryChannel;
  enabled: boolean;
};

export function channelEnabled(
  definition: EventDefinition,
  channel: DeliveryChannel,
  preferences: PreferenceRow[],
): boolean {
  if (!definition.channels.includes(channel)) return false;
  if (definition.mandatory) return true;
  const stored = preferences.find(
    (row) => row.group === definition.group && row.channel === channel,
  );
  return stored ? stored.enabled : DEFAULT_CHANNEL_ENABLED[channel];
}

export function resolveDeliveryChannels(
  definition: EventDefinition,
  preferences: PreferenceRow[],
): DeliveryChannel[] {
  return CHANNELS.filter((channel) => channelEnabled(definition, channel, preferences));
}

/** The settings screen: every group the recipient can receive, with each channel resolved. */
export function preferencesMatrix(
  recipientType: RecipientType,
  stored: PreferenceRow[],
): PreferenceRow[] {
  const groups = GROUPS.filter(
    (group) =>
      group !== "account" &&
      Object.values(EVENTS).some(
        (definition: EventDefinition) =>
          definition.recipient === recipientType && definition.group === group,
      ),
  );
  return groups.flatMap((group) =>
    CHANNELS.map((channel) => {
      const row = stored.find((item) => item.group === group && item.channel === channel);
      return { group, channel, enabled: row ? row.enabled : DEFAULT_CHANNEL_ENABLED[channel] };
    }),
  );
}

export function parsePreferencesInput(body: unknown): PreferenceRow[] {
  const items = (body as { preferences?: unknown } | null)?.preferences;
  if (!Array.isArray(items) || items.length === 0 || items.length > 32) {
    throw new NotificationValidationError("Indica las preferencias que quieres cambiar.");
  }
  return items.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    if (!GROUPS.includes(item.group as NotificationGroup)) {
      throw new NotificationValidationError("Grupo de avisos no válido.");
    }
    if (item.group === "account") {
      throw new NotificationValidationError("Los avisos de cuenta no se pueden desactivar.");
    }
    if (!CHANNELS.includes(item.channel as DeliveryChannel)) {
      throw new NotificationValidationError("Canal de avisos no válido.");
    }
    if (typeof item.enabled !== "boolean") {
      throw new NotificationValidationError("Indica si el aviso está activado.");
    }
    return {
      group: item.group as NotificationGroup,
      channel: item.channel as DeliveryChannel,
      enabled: item.enabled,
    };
  });
}

// Devices --------------------------------------------------------------------

const EXPO_TOKEN = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{8,}\]$/;

export type DeviceInput = {
  token: string;
  app: AppName;
  platform: Platform;
  app_version: string | null;
};

export function parseDeviceInput(body: unknown): DeviceInput {
  const item = (body ?? {}) as Record<string, unknown>;
  if (typeof item.token !== "string" || !EXPO_TOKEN.test(item.token)) {
    throw new NotificationValidationError("El token del dispositivo no es válido.");
  }
  if (!APPS.includes(item.app as AppName)) {
    throw new NotificationValidationError("Aplicación no válida.");
  }
  if (!PLATFORMS.includes(item.platform as Platform)) {
    throw new NotificationValidationError("Plataforma no válida.");
  }
  const version = typeof item.app_version === "string" ? item.app_version.trim() : "";
  if (version.length > 32) {
    throw new NotificationValidationError("La versión de la app es demasiado larga.");
  }
  return {
    token: item.token,
    app: item.app as AppName,
    platform: item.platform as Platform,
    app_version: version || null,
  };
}

// Retries --------------------------------------------------------------------

export const MAX_ATTEMPTS = 5;
export const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] as const;

/** Delay before the next attempt after `attempts` failures, or null when exhausted. */
export function retryDelayMs(attempts: number): number | null {
  if (!Number.isInteger(attempts) || attempts < 1) return RETRY_DELAYS_MS[0];
  if (attempts >= MAX_ATTEMPTS) return null;
  return RETRY_DELAYS_MS[attempts - 1];
}

// Quiet hours ----------------------------------------------------------------

export type QuietHours = { timeZone: string; startHour: number; endHour: number };
export const DEFAULT_QUIET_HOURS: QuietHours = {
  timeZone: "America/Havana",
  startHour: 22,
  endHour: 7,
};

/** `AGESTYLES_NOTIFICATIONS_QUIET_HOURS=off` disables the pause (used by disposable test data). */
export function quietHoursFromEnv(value: string | undefined): QuietHours | null {
  return value?.trim().toLowerCase() === "off" ? null : DEFAULT_QUIET_HOURS;
}

function localHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(parts);
}

export function isQuietHour(date: Date, quiet: QuietHours = DEFAULT_QUIET_HOURS): boolean {
  const hour = localHour(date, quiet.timeZone);
  return quiet.startHour > quiet.endHour
    ? hour >= quiet.startHour || hour < quiet.endHour
    : hour >= quiet.startHour && hour < quiet.endHour;
}

/** First moment outside quiet hours (15-minute grid); `date` itself when not quiet. */
export function nextAllowedPushTime(date: Date, quiet: QuietHours = DEFAULT_QUIET_HOURS): Date {
  let cursor = date;
  for (let step = 0; step < 24 * 4 && isQuietHour(cursor, quiet); step += 1) {
    cursor = new Date(cursor.getTime() + 15 * 60_000);
  }
  return cursor;
}

// Email ----------------------------------------------------------------------

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export type EmailContent = { subject: string; html: string };

export function renderEmail(input: {
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
}): EmailContent {
  const button =
    input.button && /^https:\/\//.test(input.button.url)
      ? `<tr><td style="padding:24px 0 0"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(input.button.label)}</a></td></tr>`
      : "";
  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<tr><td style="padding:8px 0 0;font-size:14px;line-height:1.6;color:#3f3f46">${escapeHtml(paragraph)}</td></tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px"><tr><td style="font-size:20px;font-weight:600;color:#18181b">${escapeHtml(input.heading)}</td></tr>${paragraphs}${button}<tr><td style="padding-top:32px;font-size:12px;color:#71717a">AgeStyles · Si no esperabas este mensaje, puedes ignorarlo.</td></tr></table></body></html>`;
  return { subject: input.subject, html };
}

export function renderEventEmail(
  code: string,
  params: Params,
  webUrl: string | null,
): EmailContent {
  const rendered = renderNotification(code, params);
  return renderEmail({
    subject: rendered.title,
    heading: rendered.title,
    paragraphs: [rendered.body],
    button: webUrl ? { label: "Abrir AgeStyles", url: webUrl } : undefined,
  });
}

export function renderPasswordResetEmail(resetUrl: string): EmailContent {
  return renderEmail({
    subject: "Restablece tu contraseña de AgeStyles",
    heading: "Restablece tu contraseña",
    paragraphs: [
      "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.",
      "El enlace caduca pronto. Si no la hiciste tú, ignora este mensaje: tu contraseña no cambiará.",
    ],
    button: { label: "Elegir una contraseña nueva", url: resetUrl },
  });
}
