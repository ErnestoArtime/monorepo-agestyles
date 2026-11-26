import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** AG-70: customers following stores. Additive: one new table, nothing else is touched. */
export class Migration20261126120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_store_follow" ("id" text not null, "customer_id" text not null, "seller_id" text not null, "notify_new_products" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_store_follow_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_store_follow_deleted_at" ON "agestyles_store_follow" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_store_follow_unique" ON "agestyles_store_follow" ("customer_id", "seller_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_store_follow_seller" ON "agestyles_store_follow" ("seller_id") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_store_follow" cascade;`);
  }
}
