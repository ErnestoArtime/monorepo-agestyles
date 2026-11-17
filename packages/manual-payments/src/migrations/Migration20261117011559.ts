import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117011559 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agestyles_manual_payment" drop constraint if exists "agestyles_manual_payment_pending_unique";`);
    this.addSql(`create table if not exists "agestyles_manual_payment" ("id" text not null, "order_id" text not null, "order_group_id" text null, "customer_id" text not null, "seller_id" text null, "amount" numeric not null, "currency_code" text not null, "method" text check ("method" in ('transfer', 'deposit', 'cash', 'other')) not null, "reference" text not null, "receipt_url" text null, "notes" text null, "status" text check ("status" in ('pending', 'verified', 'rejected')) not null default 'pending', "reviewed_by" text null, "reviewed_at" timestamptz null, "rejection_reason" text null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_manual_payment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_manual_payment_deleted_at" ON "agestyles_manual_payment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_manual_payment_order" ON "agestyles_manual_payment" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_manual_payment_customer" ON "agestyles_manual_payment" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_manual_payment_pending_unique" ON "agestyles_manual_payment" ("order_id", "seller_id") WHERE deleted_at IS NULL AND status = 'pending';`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_manual_payment" cascade;`);
  }

}
