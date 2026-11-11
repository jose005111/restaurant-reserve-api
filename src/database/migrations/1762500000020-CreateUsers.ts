import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1762500000020 implements MigrationInterface {
  name = 'CreateUsers1762500000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" "user_role" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_users_role_tenant" CHECK (
          ("role" = 'SUPER_ADMIN' AND "restaurant_id" IS NULL) OR
          ("role" <> 'SUPER_ADMIN' AND "restaurant_id" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" (lower("email"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_restaurant" ON "users" ("restaurant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
