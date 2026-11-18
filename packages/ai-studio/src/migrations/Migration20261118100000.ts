import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_ai_request" ("id" text not null, "seller_id" text not null, "member_id" text not null, "kind" text check ("kind" in ('describe', 'remove_background')) not null, "status" text check ("status" in ('ok', 'failed')) not null, "provider" text null, "model" text null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_ai_request_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_ai_request_deleted_at" ON "agestyles_ai_request" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_ai_request_seller_created" ON "agestyles_ai_request" ("seller_id", "created_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_ai_request" cascade;`);
  }
}
