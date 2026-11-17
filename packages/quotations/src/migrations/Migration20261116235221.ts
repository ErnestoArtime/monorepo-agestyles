import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116235221 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agestyles_order_quote" drop constraint if exists "agestyles_order_quote_idempotency_key_unique";`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_order_quote_idempotency_key_unique" ON "agestyles_order_quote" ("idempotency_key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_agestyles_order_quote_idempotency_key_unique";`);
  }

}
