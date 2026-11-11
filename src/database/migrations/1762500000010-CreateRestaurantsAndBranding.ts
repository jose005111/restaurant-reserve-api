import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRestaurantsAndBranding1762500000010 implements MigrationInterface {
  name = 'CreateRestaurantsAndBranding1762500000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "restaurants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(150) NOT NULL,
        "slug" varchar(80) NOT NULL,
        "phone" varchar(30),
        "address" varchar(255),
        "currency" char(3) NOT NULL DEFAULT 'AOA',
        "public_token" varchar(64) NOT NULL,
        "status" "restaurant_status" NOT NULL DEFAULT 'ACTIVE',
        "plan" "restaurant_plan" NOT NULL DEFAULT 'FREE',
        "subscription_expires_at" timestamptz,
        "max_tables" integer NOT NULL DEFAULT 10,
        "max_menu_items" integer NOT NULL DEFAULT 50,
        "max_users" integer NOT NULL DEFAULT 5,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_restaurants_slug" UNIQUE ("slug"),
        CONSTRAINT "uq_restaurants_public_token" UNIQUE ("public_token"),
        CONSTRAINT "ck_restaurants_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "ck_restaurants_token_len" CHECK (char_length("public_token") >= 24),
        CONSTRAINT "ck_restaurants_limits" CHECK ("max_tables" > 0 AND "max_menu_items" > 0 AND "max_users" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "restaurant_branding" (
        "restaurant_id" uuid PRIMARY KEY REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "logo_url" varchar(500),
        "logo_dark_url" varchar(500),
        "favicon_url" varchar(500),
        "banner_url" varchar(500),
        "login_image_url" varchar(500),
        "primary_color" char(7) NOT NULL DEFAULT '#111827',
        "secondary_color" char(7) NOT NULL DEFAULT '#6B7280',
        "accent_color" char(7) NOT NULL DEFAULT '#F59E0B',
        "background_color" char(7) NOT NULL DEFAULT '#FFFFFF',
        "surface_color" char(7) NOT NULL DEFAULT '#F9FAFB',
        "text_color" char(7) NOT NULL DEFAULT '#111827',
        "theme_mode" "theme_mode" NOT NULL DEFAULT 'LIGHT',
        "font_family" varchar(60),
        "border_radius" smallint NOT NULL DEFAULT 12,
        "welcome_title" varchar(120),
        "welcome_message" varchar(300),
        "footer_text" varchar(200),
        "instagram_url" varchar(255),
        "facebook_url" varchar(255),
        "website_url" varchar(255),
        "whatsapp" varchar(30),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_branding_colors" CHECK (
          "primary_color" ~ '^#[0-9A-Fa-f]{6}$' AND
          "secondary_color" ~ '^#[0-9A-Fa-f]{6}$' AND
          "accent_color" ~ '^#[0-9A-Fa-f]{6}$' AND
          "background_color" ~ '^#[0-9A-Fa-f]{6}$' AND
          "surface_color" ~ '^#[0-9A-Fa-f]{6}$' AND
          "text_color" ~ '^#[0-9A-Fa-f]{6}$'
        ),
        CONSTRAINT "ck_branding_radius" CHECK ("border_radius" BETWEEN 0 AND 32)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "restaurant_branding"`);
    await queryRunner.query(`DROP TABLE "restaurants"`);
  }
}
