import { Migration } from "@medusajs/framework/mikro-orm/migrations";

const GROUPS = `'orders', 'payments', 'inventory', 'commissions', 'catalog', 'account'`;

export class Migration20261118180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_notification" ("id" text not null, "recipient_type" text check ("recipient_type" in ('customer', 'member')) not null, "recipient_id" text not null, "seller_id" text null, "event_code" text not null, "group" text check ("group" in (${GROUPS})) not null, "title" text not null, "body" text not null, "target" jsonb null, "read_at" timestamptz null, "dedupe_key" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_notification_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_notification_deleted_at" ON "agestyles_notification" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_notification_dedupe" ON "agestyles_notification" ("dedupe_key") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_notification_recipient" ON "agestyles_notification" ("recipient_type", "recipient_id", "created_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_notification_delivery" ("id" text not null, "notification_id" text not null, "channel" text check ("channel" in ('push', 'email')) not null, "status" text check ("status" in ('pending', 'sending', 'sent', 'failed', 'skipped')) not null default 'pending', "attempts" integer not null default 0, "next_attempt_at" timestamptz not null, "locked_until" timestamptz null, "error_code" text null, "provider_ref" text null, "sent_at" timestamptz null, "receipt_checked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_notification_delivery_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_notification_delivery_deleted_at" ON "agestyles_notification_delivery" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_notification_delivery_channel" ON "agestyles_notification_delivery" ("notification_id", "channel") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_notification_delivery_due" ON "agestyles_notification_delivery" ("status", "next_attempt_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_device_token" ("id" text not null, "actor_type" text check ("actor_type" in ('customer', 'member')) not null, "actor_id" text not null, "app" text check ("app" in ('buyer', 'business')) not null, "platform" text check ("platform" in ('android', 'ios', 'web')) not null, "token" text not null, "app_version" text null, "last_seen_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_device_token_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_device_token_deleted_at" ON "agestyles_device_token" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_device_token_token" ON "agestyles_device_token" ("token") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_device_token_actor" ON "agestyles_device_token" ("actor_type", "actor_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_notification_preference" ("id" text not null, "actor_type" text check ("actor_type" in ('customer', 'member')) not null, "actor_id" text not null, "group" text check ("group" in (${GROUPS})) not null, "channel" text check ("channel" in ('push', 'email')) not null, "enabled" boolean not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_notification_preference_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_notification_preference_deleted_at" ON "agestyles_notification_preference" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_notification_preference_unique" ON "agestyles_notification_preference" ("actor_type", "actor_id", "group", "channel") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_notification_preference" cascade;`);
    this.addSql(`drop table if exists "agestyles_device_token" cascade;`);
    this.addSql(`drop table if exists "agestyles_notification_delivery" cascade;`);
    this.addSql(`drop table if exists "agestyles_notification" cascade;`);
  }
}
