import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117004833 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agestyles_catalog_family_version" drop constraint if exists "agestyles_catalog_family_version_unique";`);
    this.addSql(`alter table if exists "agestyles_catalog_family" drop constraint if exists "agestyles_catalog_family_handle_unique";`);
    this.addSql(`create table if not exists "agestyles_catalog_family" ("id" text not null, "handle" text not null, "name" text not null, "category_id" text not null, "description" text null, "is_active" boolean not null default true, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_catalog_family_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_catalog_family_deleted_at" ON "agestyles_catalog_family" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_catalog_family_handle_unique" ON "agestyles_catalog_family" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_catalog_family_category" ON "agestyles_catalog_family" ("category_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agestyles_catalog_family_version" ("id" text not null, "family_id" text not null, "version" integer not null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "fields" jsonb not null, "frozen_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agestyles_catalog_family_version_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_catalog_family_version_deleted_at" ON "agestyles_catalog_family_version" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agestyles_catalog_family_version_unique" ON "agestyles_catalog_family_version" ("family_id", "version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agestyles_catalog_family_version_status" ON "agestyles_catalog_family_version" ("family_id", "status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agestyles_catalog_family" cascade;`);

    this.addSql(`drop table if exists "agestyles_catalog_family_version" cascade;`);
  }

}
