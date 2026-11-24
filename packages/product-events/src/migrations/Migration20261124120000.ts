import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261124120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "agestyles_product_event" ("id" text not null, "product_id" text null, "seller_id" text not null, "type" text check ("type" in ('product_view', 'store_view', 'product_click', 'add_to_cart_click')) not null, "surface" text check ("surface" in ('vitrina', 'tienda-web', 'tienda-app')) not null, "session_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_product_event_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_product_event_deleted_at" ON "agestyles_product_event" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_product_event_seller" ON "agestyles_product_event" ("seller_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_product_event_product" ON "agestyles_product_event" ("product_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_product_event_created" ON "agestyles_product_event" ("created_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_agestyles_product_event_session" ON "agestyles_product_event" ("session_id", "type", "created_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_product_event" cascade;`);
  }
}
