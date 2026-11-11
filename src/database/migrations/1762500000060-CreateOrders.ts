import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders1762500000060 implements MigrationInterface {
  name = 'CreateOrders1762500000060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "table_id" uuid NOT NULL,
        "order_date" date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Luanda')::date),
        "number" integer NOT NULL,
        "public_code" varchar(32) NOT NULL,
        "guests_count" smallint NOT NULL,
        "customer_note" varchar(500),
        "status" "order_status" NOT NULL DEFAULT 'PENDING',
        "estimated_prep_minutes" smallint,
        "staff_note" varchar(500),
        "rejection_reason" varchar(255),
        "total_cents" integer NOT NULL DEFAULT 0,
        "idempotency_key" varchar(100) NOT NULL,
        "accepted_at" timestamptz,
        "ready_at" timestamptz,
        "delivered_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_orders_public_code" UNIQUE ("public_code"),
        CONSTRAINT "uq_orders_daily_number" UNIQUE ("restaurant_id", "order_date", "number"),
        CONSTRAINT "uq_orders_idempotency" UNIQUE ("restaurant_id", "idempotency_key"),
        CONSTRAINT "uq_orders_id_restaurant" UNIQUE ("id", "restaurant_id"),
        CONSTRAINT "ck_orders_guests" CHECK ("guests_count" BETWEEN 1 AND 50),
        CONSTRAINT "ck_orders_prep_minutes" CHECK ("estimated_prep_minutes" IS NULL OR "estimated_prep_minutes" BETWEEN 1 AND 240),
        CONSTRAINT "ck_orders_total" CHECK ("total_cents" >= 0),
        CONSTRAINT "ck_orders_accepted_needs_eta" CHECK (
          "status" IN ('PENDING', 'REJECTED', 'CANCELLED') OR "estimated_prep_minutes" IS NOT NULL
        ),
        CONSTRAINT "ck_orders_rejected_needs_reason" CHECK (
          "status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL
        ),
        CONSTRAINT "fk_orders_table" FOREIGN KEY ("table_id", "restaurant_id")
          REFERENCES "dining_tables" ("id", "restaurant_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_orders_queue" ON "orders" ("restaurant_id", "status", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_restaurant_date" ON "orders" ("restaurant_id", "order_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_pending_per_table" ON "orders" ("table_id") WHERE "status" = 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
