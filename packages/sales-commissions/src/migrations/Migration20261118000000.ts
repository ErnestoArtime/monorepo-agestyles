import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_sales_agent" ("id" text not null, "seller_id" text not null, "member_id" text not null, "member_email" text null, "code" text not null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_sales_agent_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_sales_agent_deleted_at" ON "agestyles_sales_agent" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_sales_agent_code" ON "agestyles_sales_agent" ("code") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_sales_agent_seller_member" ON "agestyles_sales_agent" ("seller_id", "member_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_commission_rule" ("id" text not null, "seller_id" text not null, "product_id" text null, "kind" text check ("kind" in ('percent', 'fixed')) not null, "value" numeric not null, "raw_value" jsonb not null, "unit_threshold" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_commission_rule_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_commission_rule_deleted_at" ON "agestyles_commission_rule" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_commission_rule_seller" ON "agestyles_commission_rule" ("seller_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_commission_rule_seller_product" ON "agestyles_commission_rule" ("seller_id", coalesce("product_id", '')) WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_agent_sale" ("id" text not null, "seller_id" text not null, "agent_id" text not null, "source" text check ("source" in ('manual', 'online')) not null, "order_id" text null, "payment_method" text check ("payment_method" in ('cash', 'transfer', 'online')) not null, "status" text check ("status" in ('pending', 'paid', 'reversed')) not null, "currency_code" text not null, "total" numeric not null, "raw_total" jsonb not null, "lines" jsonb not null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_agent_sale_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_agent_sale_deleted_at" ON "agestyles_agent_sale" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_agent_sale_seller_created" ON "agestyles_agent_sale" ("seller_id", "created_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_agent_sale_agent" ON "agestyles_agent_sale" ("agent_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_commission_entry" ("id" text not null, "seller_id" text not null, "agent_id" text not null, "kind" text check ("kind" in ('earned', 'reversed', 'withdrawn')) not null, "amount" numeric not null, "raw_amount" jsonb not null, "currency_code" text not null, "sale_id" text null, "withdrawal_id" text null, "product_id" text null, "units" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_commission_entry_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_commission_entry_deleted_at" ON "agestyles_commission_entry" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_commission_entry_agent" ON "agestyles_commission_entry" ("agent_id", "created_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "agestyles_commission_withdrawal" ("id" text not null, "seller_id" text not null, "agent_id" text not null, "amount" numeric not null, "raw_amount" jsonb not null, "currency_code" text not null, "status" text check ("status" in ('requested', 'paid', 'rejected')) not null, "confirmed_by" text null, "confirmed_at" timestamptz null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_commission_withdrawal_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_commission_withdrawal_deleted_at" ON "agestyles_commission_withdrawal" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_commission_withdrawal_seller" ON "agestyles_commission_withdrawal" ("seller_id", "status") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_commission_withdrawal" cascade;`);
    this.addSql(`drop table if exists "agestyles_commission_entry" cascade;`);
    this.addSql(`drop table if exists "agestyles_agent_sale" cascade;`);
    this.addSql(`drop table if exists "agestyles_commission_rule" cascade;`);
    this.addSql(`drop table if exists "agestyles_sales_agent" cascade;`);
  }
}
