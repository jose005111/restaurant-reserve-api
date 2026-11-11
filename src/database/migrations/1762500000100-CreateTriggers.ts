import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTriggers1762500000100 implements MigrationInterface {
  name = 'CreateTriggers1762500000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "set_updated_at"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$
    `);

    const tables = [
      'restaurants',
      'restaurant_branding',
      'users',
      'dining_tables',
      'categories',
      'menu_items',
      'orders',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `CREATE TRIGGER "trg_${table}_updated_at" BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"()`,
      );
    }

    await queryRunner.query(`
      CREATE FUNCTION "create_default_branding"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO "restaurant_branding" ("restaurant_id") VALUES (NEW.id);
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(
      `CREATE TRIGGER "trg_restaurants_default_branding" AFTER INSERT ON "restaurants" FOR EACH ROW EXECUTE FUNCTION "create_default_branding"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "trg_restaurants_default_branding" ON "restaurants"`,
    );
    await queryRunner.query(`DROP FUNCTION "create_default_branding"()`);

    const tables = [
      'restaurants',
      'restaurant_branding',
      'users',
      'dining_tables',
      'categories',
      'menu_items',
      'orders',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `DROP TRIGGER "trg_${table}_updated_at" ON "${table}"`,
      );
    }

    await queryRunner.query(`DROP FUNCTION "set_updated_at"()`);
  }
}
