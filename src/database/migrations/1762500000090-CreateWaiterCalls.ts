import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWaiterCalls1762500000090 implements MigrationInterface {
  name = 'CreateWaiterCalls1762500000090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "waiter_calls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "table_id" uuid NOT NULL,
        "status" "waiter_call_status" NOT NULL DEFAULT 'OPEN',
        "attended_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "attended_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_waiter_calls_table" FOREIGN KEY ("table_id", "restaurant_id")
          REFERENCES "dining_tables" ("id", "restaurant_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_waiter_calls_open" ON "waiter_calls" ("restaurant_id", "created_at" DESC) WHERE "status" = 'OPEN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "waiter_calls"`);
  }
}
