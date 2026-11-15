import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreparingAtToOrders1762500000110 implements MigrationInterface {
  name = 'AddPreparingAtToOrders1762500000110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "preparing_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "preparing_at"`);
  }
}
