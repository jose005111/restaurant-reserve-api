import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesAndMenu1762500000040 implements MigrationInterface {
  name = 'CreateCategoriesAndMenu1762500000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_categories_restaurant_name" UNIQUE ("restaurant_id", "name"),
        CONSTRAINT "uq_categories_id_restaurant" UNIQUE ("id", "restaurant_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_categories_menu" ON "categories" ("restaurant_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "category_id" uuid NOT NULL,
        "name" varchar(150) NOT NULL,
        "description" text,
        "price_cents" integer NOT NULL,
        "is_available" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_menu_items_price" CHECK ("price_cents" >= 0),
        CONSTRAINT "uq_menu_items_id_restaurant" UNIQUE ("id", "restaurant_id"),
        CONSTRAINT "fk_menu_items_category" FOREIGN KEY ("category_id", "restaurant_id")
          REFERENCES "categories" ("id", "restaurant_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_menu_items_menu" ON "menu_items" ("restaurant_id", "category_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "menu_item_images" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "menu_item_id" uuid NOT NULL,
        "url" varchar(500) NOT NULL,
        "storage_key" varchar(300),
        "alt_text" varchar(150),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_menu_item_images_item" FOREIGN KEY ("menu_item_id", "restaurant_id")
          REFERENCES "menu_items" ("id", "restaurant_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_menu_item_images_item" ON "menu_item_images" ("menu_item_id", "sort_order")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_menu_item_images_primary" ON "menu_item_images" ("menu_item_id") WHERE "is_primary"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "menu_item_images"`);
    await queryRunner.query(`DROP TABLE "menu_items"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
