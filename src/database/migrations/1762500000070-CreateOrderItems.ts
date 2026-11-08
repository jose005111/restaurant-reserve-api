import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderItems1762500000070 implements MigrationInterface {
  name = 'CreateOrderItems1762500000070';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "menu_item_id" uuid NOT NULL REFERENCES "menu_items"("id") ON DELETE RESTRICT,
        "name_snapshot" varchar(150) NOT NULL,
        "unit_price_cents" integer NOT NULL,
        "quantity" smallint NOT NULL,
        "note" varchar(255),
        "line_total_cents" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_order_items_price" CHECK ("unit_price_cents" >= 0),
        CONSTRAINT "ck_order_items_quantity" CHECK ("quantity" BETWEEN 1 AND 99),
        CONSTRAINT "ck_order_items_line" CHECK ("line_total_cents" = "unit_price_cents" * "quantity")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_order_items_order" ON "order_items" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_items_menu_item" ON "order_items" ("menu_item_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
  }
}
