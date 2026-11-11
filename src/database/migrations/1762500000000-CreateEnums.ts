import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnums1762500000000 implements MigrationInterface {
  name = 'CreateEnums1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "restaurant_status" AS ENUM ('ACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "restaurant_plan" AS ENUM ('FREE', 'BASIC', 'PRO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'COUNTER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "order_status" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'REJECTED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "waiter_call_status" AS ENUM ('OPEN', 'ATTENDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "theme_mode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE "theme_mode"`);
    await queryRunner.query(`DROP TYPE "waiter_call_status"`);
    await queryRunner.query(`DROP TYPE "order_status"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
    await queryRunner.query(`DROP TYPE "restaurant_plan"`);
    await queryRunner.query(`DROP TYPE "restaurant_status"`);
  }
}
