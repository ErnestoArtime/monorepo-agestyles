import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117220000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_inventory_movement" ("id" text not null, "seller_id" text not null, "inventory_item_id" text not null, "location_id" text not null, "type" text check ("type" in ('alta', 'baja', 'venta', 'ajuste')) not null, "delta" integer not null, "quantity_before" integer not null, "quantity_after" integer not null, "reason" text null, "actor_id" text not null, "actor_email" text null, "title" text null, "sku" text null, "location_name" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_inventory_movement_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_inventory_movement_deleted_at" ON "agestyles_inventory_movement" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_inventory_movement_seller_created" ON "agestyles_inventory_movement" ("seller_id", "created_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_inventory_movement_item" ON "agestyles_inventory_movement" ("inventory_item_id") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_inventory_movement" cascade;`);
  }
}
