import { model } from "@medusajs/framework/utils";

const NotificationDelivery = model
  .define("agestyles_notification_delivery", {
    id: model.id({ prefix: "adeliv" }).primaryKey(),
    notification_id: model.text(),
    channel: model.enum(["push", "email"]),
    status: model.enum(["pending", "sending", "sent", "failed", "skipped"]).default("pending"),
    attempts: model.number().default(0),
    next_attempt_at: model.dateTime(),
    locked_until: model.dateTime().nullable(),
    error_code: model.text().nullable(),
    provider_ref: model.text().nullable(),
    sent_at: model.dateTime().nullable(),
    receipt_checked_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_notification_delivery_channel",
      on: ["notification_id", "channel"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_notification_delivery_due",
      on: ["status", "next_attempt_at"],
      where: "deleted_at IS NULL",
    },
  ]);

export default NotificationDelivery;
