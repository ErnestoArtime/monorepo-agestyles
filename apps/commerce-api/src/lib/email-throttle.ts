/**
 * Per-address limit for the emails anyone can trigger for somebody else (password reset,
 * team invitations): the gateway only limits by IP, so a bot rotating IPs could still fill one
 * person's inbox. Counts the notifications already created for that address and template.
 */
export const EMAIL_LIMITS = {
  "password-reset": { max: 3, windowMs: 60 * 60 * 1000 },
  "member-invite": { max: 5, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export type ThrottledTemplate = keyof typeof EMAIL_LIMITS;

type NotificationLister = {
  listNotifications(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<unknown[]>;
};

/**
 * True when one more email of this template to this address stays within its limit. A failed
 * lookup lets the email through: blocking would lock people out of recovering their account.
 */
export async function mayEmail(
  notifications: NotificationLister,
  to: string,
  template: ThrottledTemplate,
  now: Date = new Date(),
): Promise<boolean> {
  const { max, windowMs } = EMAIL_LIMITS[template];
  try {
    const recent = await notifications.listNotifications(
      { to, template, created_at: { $gte: new Date(now.getTime() - windowMs) } },
      { take: max, select: ["id"] },
    );
    return recent.length < max;
  } catch {
    return true;
  }
}
