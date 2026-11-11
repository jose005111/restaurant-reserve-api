import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDiningTables1762500000030 implements MigrationInterface {
  name = 'CreateDiningTables1762500000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dining_tables" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "label" varchar(30) NOT NULL,
        "qr_token" varchar(64) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_tables_qr_token" UNIQUE ("qr_token"),
        CONSTRAINT "uq_tables_restaurant_label" UNIQUE ("restaurant_id", "label"),
        CONSTRAINT "uq_tables_id_restaurant" UNIQUE ("id", "restaurant_id"),
        CONSTRAINT "ck_tables_token_len" CHECK (char_length("qr_token") >= 24)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dining_tables"`);
  }
}
