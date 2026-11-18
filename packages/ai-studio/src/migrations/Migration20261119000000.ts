import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** Adds the `pending` status: the monthly quota is reserved before calling a provider. */
export class Migration20261119000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "agestyles_ai_request" drop constraint if exists "agestyles_ai_request_status_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_ai_request" add constraint "agestyles_ai_request_status_check" check ("status" in ('pending', 'ok', 'failed'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "agestyles_ai_request" set "status" = 'failed' where "status" = 'pending';`,
    );
    this.addSql(
      `alter table if exists "agestyles_ai_request" drop constraint if exists "agestyles_ai_request_status_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_ai_request" add constraint "agestyles_ai_request_status_check" check ("status" in ('ok', 'failed'));`,
    );
  }
}
