import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderCounters1762500000050 implements MigrationInterface {
  name = 'CreateOrderCounters1762500000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_counters" (
        "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "day" date NOT NULL,
        "last_number" integer NOT NULL DEFAULT 0,
        PRIMARY KEY ("restaurant_id", "day")
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "next_order_number"("p_restaurant_id" uuid)
      RETURNS integer
      LANGUAGE sql
      AS $$
        INSERT INTO "order_counters" ("restaurant_id", "day", "last_number")
        VALUES ("p_restaurant_id", (now() AT TIME ZONE 'Africa/Luanda')::date, 1)
        ON CONFLICT ("restaurant_id", "day")
        DO UPDATE SET "last_number" = "order_counters"."last_number" + 1
        RETURNING "last_number";
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION "next_order_number"(uuid)`);
    await queryRunner.query(`DROP TABLE "order_counters"`);
  }
}
