import { model } from "@medusajs/framework/utils";

const NotificationPreference = model
  .define("agestyles_notification_preference", {
    id: model.id({ prefix: "apref" }).primaryKey(),
    actor_type: model.enum(["customer", "member"]),
    actor_id: model.text(),
    group: model.enum(["orders", "payments", "inventory", "commissions", "catalog", "account"]),
    channel: model.enum(["push", "email"]),
    enabled: model.boolean(),
  })
  .indexes([
    {
      name: "IDX_agestyles_notification_preference_unique",
      on: ["actor_type", "actor_id", "group", "channel"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);

export default NotificationPreference;
