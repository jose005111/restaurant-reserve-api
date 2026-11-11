import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderStatusHistory1762500000080 implements MigrationInterface {
  name = 'CreateOrderStatusHistory1762500000080';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_status_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "from_status" "order_status",
        "to_status" "order_status" NOT NULL,
        "changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_order_history_order" ON "order_status_history" ("order_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_status_history"`);
  }
}
