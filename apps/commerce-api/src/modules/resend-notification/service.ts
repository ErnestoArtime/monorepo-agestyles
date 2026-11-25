import type { NotificationTypes } from "@medusajs/framework/types";
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils";

type Options = { apiKey: string; from: string };

export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-resend";
  private readonly options: Options;

  constructor(_dependencies: unknown, options: Options) {
    super();
    this.options = options;
  }

  async send(notification: NotificationTypes.ProviderSendNotificationDTO) {
    const { subject, html, text } = notification.content ?? {};
    if (!subject || (!html && !text)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Email needs a subject and content.");
    }

    const idempotencyKey = notification.provider_data?.idempotency_key;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
        ...(typeof idempotencyKey === "string" && { "idempotency-key": idempotencyKey }),
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [notification.to],
        subject,
        html,
        text,
        attachments: notification.attachments?.map(({ filename, content, content_type }) => ({
          filename,
          content,
          content_type,
        })),
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend rejected the email (HTTP ${response.status}).`,
      );
    }
    const result = (await response.json()) as { id?: string };
    if (!result.id) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Resend returned no email ID.");
    }
    return { id: result.id };
  }
}
