import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117002638 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agestyles_order_quote" add column if not exists "seller_ids" jsonb null;`);
    this.addSql(`update "agestyles_order_quote" set "seller_ids" = jsonb_build_array("seller_id") where "seller_ids" is null;`);
    this.addSql(`alter table if exists "agestyles_order_quote" alter column "seller_ids" set not null;`);
    this.addSql(`alter table if exists "agestyles_order_quote" drop column if exists "seller_id";`);
    this.addSql(`alter table if exists "agestyles_order_quote" rename column "order_id" to "order_group_id";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agestyles_order_quote" add column if not exists "seller_id" text null;`);
    this.addSql(`update "agestyles_order_quote" set "seller_id" = "seller_ids"->>0 where "seller_id" is null;`);
    this.addSql(`alter table if exists "agestyles_order_quote" alter column "seller_id" set not null;`);
    this.addSql(`alter table if exists "agestyles_order_quote" drop column if exists "seller_ids";`);
    this.addSql(`alter table if exists "agestyles_order_quote" rename column "order_group_id" to "order_id";`);
  }

}
