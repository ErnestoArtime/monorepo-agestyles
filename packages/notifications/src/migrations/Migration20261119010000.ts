import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261119010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_event_outbox" ("id" text not null, "name" text not null, "data" jsonb not null, "status" text check ("status" in ('pending', 'emitted', 'failed')) not null default 'pending', "attempts" integer not null default 0, "last_error" text null, "emitted_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_event_outbox_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_event_outbox_deleted_at" ON "agestyles_event_outbox" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_event_outbox_pending" ON "agestyles_event_outbox" ("status", "created_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_event_outbox" cascade;`);
  }
}
