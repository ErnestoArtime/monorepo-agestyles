import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** AG-40: the marketplace administration (`user`) as recipient and the `marketplace` group. */
export class Migration20261119120000 extends Migration {
  override async up(): Promise<void> {
    const actors = `('customer', 'member', 'user')`;
    const groups = `('orders', 'payments', 'inventory', 'commissions', 'catalog', 'account', 'marketplace')`;
    this.addSql(
      `alter table if exists "agestyles_notification" drop constraint if exists "agestyles_notification_recipient_type_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification" add constraint "agestyles_notification_recipient_type_check" check ("recipient_type" in ${actors});`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification" drop constraint if exists "agestyles_notification_group_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification" add constraint "agestyles_notification_group_check" check ("group" in ${groups});`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" drop constraint if exists "agestyles_notification_preference_actor_type_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" add constraint "agestyles_notification_preference_actor_type_check" check ("actor_type" in ${actors});`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" drop constraint if exists "agestyles_notification_preference_group_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" add constraint "agestyles_notification_preference_group_check" check ("group" in ${groups});`,
    );
    this.addSql(
      `alter table if exists "agestyles_device_token" drop constraint if exists "agestyles_device_token_actor_type_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_device_token" add constraint "agestyles_device_token_actor_type_check" check ("actor_type" in ${actors});`,
    );
  }

  override async down(): Promise<void> {
    // Only safe while no row uses the new values.
    this.addSql(
      `alter table if exists "agestyles_notification" drop constraint if exists "agestyles_notification_recipient_type_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification" add constraint "agestyles_notification_recipient_type_check" check ("recipient_type" in ('customer', 'member'));`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification" drop constraint if exists "agestyles_notification_group_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification" add constraint "agestyles_notification_group_check" check ("group" in ('orders', 'payments', 'inventory', 'commissions', 'catalog', 'account'));`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" drop constraint if exists "agestyles_notification_preference_actor_type_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" add constraint "agestyles_notification_preference_actor_type_check" check ("actor_type" in ('customer', 'member'));`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" drop constraint if exists "agestyles_notification_preference_group_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_notification_preference" add constraint "agestyles_notification_preference_group_check" check ("group" in ('orders', 'payments', 'inventory', 'commissions', 'catalog', 'account'));`,
    );
    this.addSql(
      `alter table if exists "agestyles_device_token" drop constraint if exists "agestyles_device_token_actor_type_check";`,
    );
    this.addSql(
      `alter table if exists "agestyles_device_token" add constraint "agestyles_device_token_actor_type_check" check ("actor_type" in ('customer', 'member'));`,
    );
  }
}
