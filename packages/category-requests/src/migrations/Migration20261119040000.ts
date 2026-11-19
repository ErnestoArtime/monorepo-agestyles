import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261119040000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_category_request" ("id" text not null, "seller_id" text not null, "requested_by" text not null, "name" text not null, "description" text null, "suggested_parent_id" text null, "note" text null, "status" text check ("status" in ('pending', 'approved', 'merged', 'rejected')) not null default 'pending', "resolved_category_id" text null, "resolution_note" text null, "reviewed_by" text null, "reviewed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_category_request_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_category_request_deleted_at" ON "agestyles_category_request" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_category_request_seller" ON "agestyles_category_request" ("seller_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_category_request_status" ON "agestyles_category_request" ("status") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_category_request" cascade;`);
  }
}
