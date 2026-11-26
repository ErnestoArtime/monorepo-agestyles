import { model } from "@medusajs/framework/utils";

const Notification = model
  .define("agestyles_notification", {
    id: model.id({ prefix: "anotif" }).primaryKey(),
    recipient_type: model.enum(["customer", "member", "user"]),
    recipient_id: model.text(),
    seller_id: model.text().nullable(),
    event_code: model.text(),
    group: model.enum([
      "orders",
      "payments",
      "inventory",
      "commissions",
      "catalog",
      "account",
      "marketplace",
      "following",
    ]),
    title: model.text(),
    body: model.text(),
    target: model.json().nullable(),
    read_at: model.dateTime().nullable(),
    dedupe_key: model.text(),
  })
  .indexes([
    {
      name: "IDX_agestyles_notification_dedupe",
      on: ["dedupe_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_notification_recipient",
      on: ["recipient_type", "recipient_id", "created_at"],
      where: "deleted_at IS NULL",
    },
  ]);

export default Notification;
