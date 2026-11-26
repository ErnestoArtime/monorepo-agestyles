import { mayEmail } from "../lib/email-throttle";
import { withNotificationRetries } from "../lib/notifications";
import { createHash } from "node:crypto";
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { renderPasswordResetEmail } from "@agestyles/notifications";

type PasswordResetEvent = {
  entity_id: string;
  actor_type: string;
  token: string;
};

/** Where each actor type lands to choose a new password. Not set → no link can be built. */
function resetBaseUrl(actorType: string): string | null {
  const raw =
    actorType === "customer"
      ? process.env.AGESTYLES_STORE_WEB_URL
      : actorType === "member"
        ? process.env.AGESTYLES_BUSINESS_WEB_URL
        : undefined;
  const base = raw?.trim().replace(/\/+$/, "");
  return base?.startsWith("https://") ? base : null;
}

/**
 * Medusa only emits `auth.password_reset`; nothing sends the email by itself. The token
 * is never written to the inbox or the logs: it goes straight into the email link.
 */
async function sendPasswordResetEmail({ event, container }: SubscriberArgs<PasswordResetEvent>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const { entity_id: rawEmail, actor_type: actorType, token } = event.data;
  const email = rawEmail?.trim().toLowerCase();
  const base = resetBaseUrl(actorType);
  if (!base || !email || !token) {
    logger.warn(
      `Password reset email skipped for actor type "${actorType}": no web URL configured.`,
    );
    return;
  }
  const notifications = container.resolve(Modules.NOTIFICATION);
  if (!(await mayEmail(notifications, email, "password-reset"))) {
    logger.warn(`Password reset email held back for one address: too many in the last hour.`);
    return;
  }
  const url = `${base}/reset-password?${new URLSearchParams({ token, email }).toString()}`;
  const idempotencyKey = `password-reset:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
  await notifications.createNotifications({
    to: email,
    channel: "email",
    template: "password-reset",
    trigger_type: "auth.password_reset",
    idempotency_key: idempotencyKey,
    provider_data: { idempotency_key: idempotencyKey },
    data: { actor_type: actorType },
    content: renderPasswordResetEmail(url),
  });
}

export default withNotificationRetries("send-password-reset-email", sendPasswordResetEmail);

export const config: SubscriberConfig = {
  event: "auth.password_reset",
  context: { subscriberId: "agestyles-send-password-reset-email" },
};
