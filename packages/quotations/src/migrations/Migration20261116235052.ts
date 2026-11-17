import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116235052 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agestyles_order_quote" ("id" text not null, "cart_id" text not null, "customer_id" text not null, "seller_id" text not null, "idempotency_key" text not null, "intent_hash" text not null, "revision" integer not null default 1, "status" text check ("status" in ('quoted', 'accepting', 'accepted', 'expired', 'unavailable')) not null, "currency_code" text not null, "total" numeric not null, "available" boolean not null default true, "snapshot" jsonb not null, "expires_at" timestamptz not null, "order_id" text null, "raw_total" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_order_quote_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_order_quote_deleted_at" ON "agestyles_order_quote" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_order_quote" cascade;`);
  }

}
