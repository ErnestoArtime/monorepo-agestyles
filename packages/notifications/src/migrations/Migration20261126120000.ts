import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** AG-70: the `following` group (alerts from followed stores) in avisos and preferences. */
export class Migration20261126120000 extends Migration {
  override async up(): Promise<void> {
    const groups = `('orders', 'payments', 'inventory', 'commissions', 'catalog', 'account', 'marketplace', 'following')`;
    for (const table of ["agestyles_notification", "agestyles_notification_preference"]) {
      this.addSql(
        `alter table if exists "${table}" drop constraint if exists "${table}_group_check";`,
      );
      this.addSql(
        `alter table if exists "${table}" add constraint "${table}_group_check" check ("group" in ${groups});`,
      );
    }
  }

  override async down(): Promise<void> {
    // Only safe while no row uses the new value.
    const groups = `('orders', 'payments', 'inventory', 'commissions', 'catalog', 'account', 'marketplace')`;
    for (const table of ["agestyles_notification", "agestyles_notification_preference"]) {
      this.addSql(
        `alter table if exists "${table}" drop constraint if exists "${table}_group_check";`,
      );
      this.addSql(
        `alter table if exists "${table}" add constraint "${table}_group_check" check ("group" in ${groups});`,
      );
    }
  }
}
