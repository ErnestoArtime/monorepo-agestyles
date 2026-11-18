import { model } from "@medusajs/framework/utils";

const DeviceToken = model
  .define("agestyles_device_token", {
    id: model.id({ prefix: "adevice" }).primaryKey(),
    actor_type: model.enum(["customer", "member"]),
    actor_id: model.text(),
    app: model.enum(["buyer", "business"]),
    platform: model.enum(["android", "ios", "web"]),
    token: model.text(),
    app_version: model.text().nullable(),
    last_seen_at: model.dateTime(),
    revoked_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_device_token_token",
      on: ["token"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_device_token_actor",
      on: ["actor_type", "actor_id"],
      where: "deleted_at IS NULL",
    },
  ]);

export default DeviceToken;
