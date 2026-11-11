-- =============================================================================
-- API SaaS de Pedidos por QR Code para Restaurantes — PostgreSQL 14+
-- Multi-tenant: uma base de dados, isolamento por restaurant_id.
-- Valores monetários em inteiros (cêntimos). Datas em timestamptz (UTC).
-- =============================================================================

BEGIN;

---

-- ENUMS

---

CREATE TYPE restaurant_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE restaurant_plan AS ENUM ('FREE', 'BASIC', 'PRO');
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'COUNTER');
CREATE TYPE order_status AS ENUM (
'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'REJECTED', 'CANCELLED'
);
CREATE TYPE waiter_call_status AS ENUM ('OPEN', 'ATTENDED');
CREATE TYPE theme_mode AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

---

-- RESTAURANTS (tenant)

---

CREATE TABLE restaurants (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name varchar(150) NOT NULL,
slug varchar(80) NOT NULL,
phone varchar(30),
address varchar(255),
currency char(3) NOT NULL DEFAULT 'AOA',
public_token varchar(64) NOT NULL, -- link genérico (rotativo)
status restaurant_status NOT NULL DEFAULT 'ACTIVE',
plan restaurant_plan NOT NULL DEFAULT 'FREE',
subscription_expires_at timestamptz, -- NULL = sem expiração
max_tables integer NOT NULL DEFAULT 10,
max_menu_items integer NOT NULL DEFAULT 50,
max_users integer NOT NULL DEFAULT 5,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),

CONSTRAINT uq_restaurants_slug UNIQUE (slug),
CONSTRAINT uq_restaurants_public_token UNIQUE (public_token),
CONSTRAINT ck_restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
CONSTRAINT ck_restaurants_token_len CHECK (char_length(public_token) >= 24),
CONSTRAINT ck_restaurants_limits CHECK (max_tables > 0 AND max_menu_items > 0 AND max_users > 0)
);

---

-- RESTAURANT BRANDING (identidade visual — 1:1 com restaurants)
-- Linha criada automaticamente por trigger ao inserir o restaurante.
-- Imagens: guardar apenas a URL; o ficheiro vive no storage
-- (convenção de caminho: restaurants/{restaurant_id}/branding/{asset}).

---

CREATE TABLE restaurant_branding (
restaurant_id uuid PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,

-- imagens
logo_url varchar(500),
logo_dark_url varchar(500), -- logo para tema escuro (opcional)
favicon_url varchar(500),
banner_url varchar(500), -- topo do menu público
login_image_url varchar(500), -- imagem do ecrã de login do staff

-- cores (hex #RRGGBB) — valores por defeito neutros, o frontend nunca recebe NULL
primary_color char(7) NOT NULL DEFAULT '#111827',
secondary_color char(7) NOT NULL DEFAULT '#6B7280',
accent_color char(7) NOT NULL DEFAULT '#F59E0B',
background_color char(7) NOT NULL DEFAULT '#FFFFFF',
surface_color char(7) NOT NULL DEFAULT '#F9FAFB',
text_color char(7) NOT NULL DEFAULT '#111827',

-- estilo
theme_mode theme_mode NOT NULL DEFAULT 'LIGHT',
font_family varchar(60), -- validar contra lista permitida na aplicação
border_radius smallint NOT NULL DEFAULT 12,

-- textos
welcome_title varchar(120),
welcome_message varchar(300),
footer_text varchar(200),

-- contactos e redes sociais
instagram_url varchar(255),
facebook_url varchar(255),
website_url varchar(255),
whatsapp varchar(30),

created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),

CONSTRAINT ck_branding_colors CHECK (
primary_color ~ '^#[0-9A-Fa-f]{6}$' AND
secondary_color ~ '^#[0-9A-Fa-f]{6}$' AND
accent_color ~ '^#[0-9A-Fa-f]{6}$' AND
background_color ~ '^#[0-9A-Fa-f]{6}$' AND
surface_color ~ '^#[0-9A-Fa-f]{6}$' AND
text_color ~ '^#[0-9A-Fa-f]{6}$'
),
CONSTRAINT ck_branding_radius CHECK (border_radius BETWEEN 0 AND 32)
);

---

-- USERS (staff)

---

CREATE TABLE users (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE, -- NULL = SUPER_ADMIN
name varchar(120) NOT NULL,
email varchar(255) NOT NULL,
password_hash varchar(255) NOT NULL,
role user_role NOT NULL,
is_active boolean NOT NULL DEFAULT true,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),

-- SUPER_ADMIN não pertence a restaurante; ADMIN/COUNTER têm de pertencer
CONSTRAINT ck_users_role_tenant CHECK (
(role = 'SUPER_ADMIN' AND restaurant_id IS NULL) OR
(role <> 'SUPER_ADMIN' AND restaurant_id IS NOT NULL)
)
);
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_restaurant ON users (restaurant_id);

---

-- DINING TABLES (mesas)

---

CREATE TABLE dining_tables (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
label varchar(30) NOT NULL,
qr_token varchar(64) NOT NULL, -- link por mesa (rotativo)
is_active boolean NOT NULL DEFAULT true,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),

CONSTRAINT uq_tables_qr_token UNIQUE (qr_token),
CONSTRAINT uq_tables_restaurant_label UNIQUE (restaurant_id, label),
-- permite FKs compostas que garantem que filhos pertencem ao mesmo restaurante
CONSTRAINT uq_tables_id_restaurant UNIQUE (id, restaurant_id),
CONSTRAINT ck_tables_token_len CHECK (char_length(qr_token) >= 24)
);

---

-- CATEGORIES

---

CREATE TABLE categories (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
name varchar(100) NOT NULL,
sort_order integer NOT NULL DEFAULT 0,
is_active boolean NOT NULL DEFAULT true,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),

CONSTRAINT uq_categories_restaurant_name UNIQUE (restaurant_id, name),
CONSTRAINT uq_categories_id_restaurant UNIQUE (id, restaurant_id)
);
CREATE INDEX idx_categories_menu ON categories (restaurant_id, sort_order);

---

-- MENU ITEMS (pratos)

---

CREATE TABLE menu_items (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
category_id uuid NOT NULL,
name varchar(150) NOT NULL,
description text,
price_cents integer NOT NULL,
is_available boolean NOT NULL DEFAULT true,
sort_order integer NOT NULL DEFAULT 0,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),

CONSTRAINT ck_menu_items_price CHECK (price_cents >= 0),
CONSTRAINT uq_menu_items_id_restaurant UNIQUE (id, restaurant_id),
-- a categoria tem de ser do mesmo restaurante do prato
CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id, restaurant_id)
REFERENCES categories (id, restaurant_id)
);
CREATE INDEX idx_menu_items_menu ON menu_items (restaurant_id, category_id, sort_order);

---

-- MENU ITEM IMAGES (um prato pode ter várias imagens)
-- Limite de imagens por prato e validação de tipo/tamanho: na aplicação.

---

CREATE TABLE menu_item_images (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
restaurant_id uuid NOT NULL,
menu_item_id uuid NOT NULL,
url varchar(500) NOT NULL,
storage_key varchar(300), -- chave no storage, para apagar o ficheiro
alt_text varchar(150),
sort_order integer NOT NULL DEFAULT 0,
is_primary boolean NOT NULL DEFAULT false,
created_at timestamptz NOT NULL DEFAULT now(),

-- a imagem tem de pertencer ao mesmo restaurante do prato
CONSTRAINT fk_menu_item_images_item FOREIGN KEY (menu_item_id, restaurant_id)
REFERENCES menu_items (id, restaurant_id) ON DELETE CASCADE
);
CREATE INDEX idx_menu_item_images_item ON menu_item_images (menu_item_id, sort_order);
-- no máximo uma imagem principal por prato
CREATE UNIQUE INDEX uq_menu_item_images_primary ON menu_item_images (menu_item_id) WHERE is_primary;

---

-- ORDER COUNTERS (número sequencial diário por restaurante, seguro p/ concorrência)

---

CREATE TABLE order_counters (
restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
day date NOT NULL,
last_number integer NOT NULL DEFAULT 0,
PRIMARY KEY (restaurant_id, day)
);

-- Devolve o próximo número do dia (#1, #2, ...). Atómico: o UPSERT bloqueia a
-- linha do contador até ao fim da transacção do pedido.
-- Dia de negócio calculado no fuso de Luanda.
CREATE FUNCTION next_order_number(p_restaurant_id uuid)
RETURNS integer
LANGUAGE sql
AS $$
INSERT INTO order_counters (restaurant_id, day, last_number)
VALUES (p_restaurant_id, (now() AT TIME ZONE 'Africa/Luanda')::date, 1)
ON CONFLICT (restaurant_id, day)
DO UPDATE SET last_number = order_counters.last_number + 1
RETURNING last_number;

$$ ;

-- -----------------------------------------------------------------------------
-- ORDERS
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id          uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id               uuid        NOT NULL,              -- sempre preenchido (link genérico ou por mesa)
  order_date             date        NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Luanda')::date),
  number                 integer     NOT NULL,              -- #023, via next_order_number()
  public_code            varchar(32) NOT NULL,              -- consulta pública pelo cliente
  guests_count           smallint    NOT NULL,
  customer_note          varchar(500),
  status                 order_status NOT NULL DEFAULT 'PENDING',
  estimated_prep_minutes smallint,
  staff_note             varchar(500),
  rejection_reason       varchar(255),
  total_cents            integer     NOT NULL DEFAULT 0,
  idempotency_key        varchar(100) NOT NULL,
  accepted_at            timestamptz,
  ready_at               timestamptz,
  delivered_at           timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_orders_public_code    UNIQUE (public_code),
  CONSTRAINT uq_orders_daily_number   UNIQUE (restaurant_id, order_date, number),
  CONSTRAINT uq_orders_idempotency    UNIQUE (restaurant_id, idempotency_key),
  CONSTRAINT uq_orders_id_restaurant  UNIQUE (id, restaurant_id),
  CONSTRAINT ck_orders_guests         CHECK (guests_count BETWEEN 1 AND 50),
  CONSTRAINT ck_orders_prep_minutes   CHECK (estimated_prep_minutes IS NULL OR estimated_prep_minutes BETWEEN 1 AND 240),
  CONSTRAINT ck_orders_total          CHECK (total_cents >= 0),
  -- depois de aceite, o tempo estimado é obrigatório
  CONSTRAINT ck_orders_accepted_needs_eta CHECK (
    status IN ('PENDING', 'REJECTED', 'CANCELLED') OR estimated_prep_minutes IS NOT NULL
  ),
  -- rejeição exige motivo
  CONSTRAINT ck_orders_rejected_needs_reason CHECK (
    status <> 'REJECTED' OR rejection_reason IS NOT NULL
  ),
  -- a mesa tem de ser do mesmo restaurante do pedido
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id, restaurant_id)
    REFERENCES dining_tables (id, restaurant_id)
);
-- fila do balcão: pedidos do restaurante por estado, mais recentes primeiro
CREATE INDEX idx_orders_queue ON orders (restaurant_id, status, created_at DESC);
-- listagens/relatórios por data
CREATE INDEX idx_orders_restaurant_date ON orders (restaurant_id, order_date);
-- limite de PENDING simultâneos por mesa
CREATE INDEX idx_orders_pending_per_table ON orders (table_id) WHERE status = 'PENDING';

-- -----------------------------------------------------------------------------
-- ORDER ITEMS (com snapshot de nome e preço)
-- -----------------------------------------------------------------------------
CREATE TABLE order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     uuid         NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name_snapshot    varchar(150) NOT NULL,
  unit_price_cents integer      NOT NULL,
  quantity         smallint     NOT NULL,
  note             varchar(255),
  line_total_cents integer      NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT ck_order_items_price    CHECK (unit_price_cents >= 0),
  CONSTRAINT ck_order_items_quantity CHECK (quantity BETWEEN 1 AND 99),
  CONSTRAINT ck_order_items_line     CHECK (line_total_cents = unit_price_cents * quantity)
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_menu_item ON order_items (menu_item_id);

-- -----------------------------------------------------------------------------
-- ORDER STATUS HISTORY (opcional: auditoria e métricas de tempo de preparo)
-- -----------------------------------------------------------------------------
CREATE TABLE order_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,                                  -- NULL na criação
  to_status   order_status NOT NULL,
  changed_by  uuid REFERENCES users(id) ON DELETE SET NULL,  -- NULL = cliente/sistema
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_history_order ON order_status_history (order_id, created_at);

-- -----------------------------------------------------------------------------
-- WAITER CALLS (opcional: POST /public/call-waiter)
-- -----------------------------------------------------------------------------
CREATE TABLE waiter_calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id      uuid        NOT NULL,
  status        waiter_call_status NOT NULL DEFAULT 'OPEN',
  attended_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  attended_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_waiter_calls_table FOREIGN KEY (table_id, restaurant_id)
    REFERENCES dining_tables (id, restaurant_id)
);
CREATE INDEX idx_waiter_calls_open ON waiter_calls (restaurant_id, created_at DESC) WHERE status = 'OPEN';

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'restaurants', 'restaurant_branding', 'users', 'dining_tables', 'categories', 'menu_items', 'orders'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Branding por defeito: garante a relação 1:1 ao criar um restaurante
-- -----------------------------------------------------------------------------
CREATE FUNCTION create_default_branding() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO restaurant_branding (restaurant_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restaurants_default_branding
  AFTER INSERT ON restaurants
  FOR EACH ROW EXECUTE FUNCTION create_default_branding();

COMMIT;
$$
