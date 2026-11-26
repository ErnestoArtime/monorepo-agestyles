import { createHash } from "node:crypto";
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { renderMemberInviteEmail } from "@agestyles/notifications";
import { mayEmail } from "../lib/email-throttle";
import { withNotificationRetries } from "../lib/notifications";

type MemberInviteEvent = { id: string; token: string; expires_at?: string }[];

/** Where Negocio accepts a team invitation. Not set or not HTTPS → no link can be built. */
function acceptBaseUrl(): string | null {
  const base = process.env.AGESTYLES_BUSINESS_WEB_URL?.trim().replace(/\/+$/, "");
  return base?.startsWith("https://") ? base : null;
}

/**
 * Mercur emits `member_invite.created` (also when an invitation is resent) but nothing sends
 * the email. Sends the Spanish invitation with the link to Negocio. The token only goes into
 * the link: it is never written to the logs or the inbox.
 */
async function sendMemberInviteEmail({ event, container }: SubscriberArgs<MemberInviteEvent>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const base = acceptBaseUrl();
  if (!base) {
    logger.warn("Team invitation email skipped: AGESTYLES_BUSINESS_WEB_URL is not an HTTPS URL.");
    return;
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notifications = container.resolve(Modules.NOTIFICATION);

  for (const { id, token } of event.data ?? []) {
    if (!id || !token) continue;
    const { data } = await query.graph({
      entity: "member_invite",
      fields: ["id", "email", "accepted", "seller.name"],
      filters: { id },
    });
    const invite = data[0] as
      { email?: string; accepted?: boolean; seller?: { name?: string } | null } | undefined;
    const email = invite?.email?.trim().toLowerCase();
    if (!invite || invite.accepted || !email) continue;
    if (!(await mayEmail(notifications, email, "member-invite"))) {
      logger.warn("Team invitation email held back for one address: too many in the last day.");
      continue;
    }
    const acceptUrl = `${base}/aceptar-invitacion?${new URLSearchParams({ token }).toString()}`;
    const idempotencyKey = `member-invite:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
    await notifications.createNotifications({
      to: email,
      channel: "email",
      template: "member-invite",
      trigger_type: "member_invite.created",
      idempotency_key: idempotencyKey,
      provider_data: { idempotency_key: idempotencyKey },
      data: { invite_id: id },
      content: renderMemberInviteEmail({ storeName: invite.seller?.name ?? null, acceptUrl }),
    });
  }
}

export default withNotificationRetries("send-member-invite-email", sendMemberInviteEmail);

export const config: SubscriberConfig = {
  event: "member_invite.created",
  context: { subscriberId: "agestyles-send-member-invite-email" },
};
