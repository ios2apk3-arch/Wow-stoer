-- WAW Smart Commerce — initial schema.
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid on older servers

-- Money is NUMERIC(14,4): never float, because cents must not drift.
-- Bilingual text is stored as two columns rather than JSON so it can be indexed.

CREATE TABLE countries (
  code            CHAR(2) PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  currency        CHAR(3) NOT NULL,
  dial_code       TEXT NOT NULL
);

CREATE TABLE cities (
  id              BIGSERIAL PRIMARY KEY,
  country_code    CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  UNIQUE (country_code, name_en)
);

CREATE TABLE categories (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT REFERENCES categories(id) ON DELETE SET NULL,
  slug            TEXT NOT NULL UNIQUE,
  icon            TEXT NOT NULL DEFAULT '',
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL
);
CREATE INDEX categories_parent_idx ON categories(parent_id);

CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  legal_name      TEXT NOT NULL DEFAULT '',
  tax_id          TEXT NOT NULL DEFAULT '',
  logo            TEXT NOT NULL DEFAULT '',
  description_ar  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  country_code    CHAR(2) NOT NULL REFERENCES countries(code),
  city            TEXT NOT NULL DEFAULT '',
  website         TEXT,
  phone           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  verification    verification_status NOT NULL DEFAULT 'pending',
  member_since    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX companies_country_idx ON companies(country_code);
CREATE INDEX companies_verification_idx ON companies(verification);

CREATE TABLE addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label_ar        TEXT NOT NULL DEFAULT '',
  label_en        TEXT NOT NULL DEFAULT '',
  line            TEXT NOT NULL,
  city            TEXT NOT NULL,
  country_code    CHAR(2) NOT NULL REFERENCES countries(code),
  contact_name    TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX addresses_company_idx ON addresses(company_id);

CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  email           CITEXT NOT NULL UNIQUE,
  phone           TEXT NOT NULL DEFAULT '',
  role            user_role NOT NULL,
  password_hash   TEXT NOT NULL,
  avatar_color    TEXT NOT NULL DEFAULT '#0369a1',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_company_idx ON users(company_id);

-- Refresh tokens are stored hashed: a database leak must not grant sessions.
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  replaced_by     UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);
CREATE INDEX refresh_tokens_expiry_idx ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE suppliers (
  id              UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count    INTEGER NOT NULL DEFAULT 0,
  response_hours  NUMERIC(6,2) NOT NULL DEFAULT 24,
  on_time_rate    NUMERIC(4,3) NOT NULL DEFAULT 0,
  fulfilled_orders INTEGER NOT NULL DEFAULT 0,
  years_active    INTEGER NOT NULL DEFAULT 0,
  badges          TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE supplier_categories (
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id     TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, category_id)
);

CREATE TYPE product_unit AS ENUM ('carton', 'pallet', 'kg', 'piece', 'liter', 'box');
CREATE TYPE availability_status AS ENUM ('in_stock', 'low_stock', 'made_to_order', 'out_of_stock');

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id     TEXT NOT NULL REFERENCES categories(id),
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  description_ar  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  brand           TEXT NOT NULL DEFAULT '',
  image           TEXT NOT NULL DEFAULT '',
  specs           JSONB NOT NULL DEFAULT '[]',
  unit            product_unit NOT NULL,
  moq             INTEGER NOT NULL CHECK (moq > 0),
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  lead_time_days  INTEGER NOT NULL DEFAULT 1 CHECK (lead_time_days >= 0),
  currency        CHAR(3) NOT NULL DEFAULT 'SAR',
  origin_country  CHAR(2) NOT NULL REFERENCES countries(code),
  availability    availability_status NOT NULL DEFAULT 'in_stock',
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count    INTEGER NOT NULL DEFAULT 0,
  sold_units      INTEGER NOT NULL DEFAULT 0,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_supplier_idx ON products(supplier_id);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_origin_idx ON products(origin_country);
CREATE INDEX products_availability_idx ON products(availability);
CREATE INDEX products_sold_idx ON products(sold_units DESC);
CREATE INDEX products_tags_idx ON products USING GIN (tags);

-- Bilingual full-text search. 'simple' rather than a language config: Arabic
-- has no Postgres stemmer, and 'simple' avoids mangling English brand names.
-- Tags are deliberately excluded: array_to_string is only STABLE, which a
-- generated column forbids, and tags are filtered through their GIN index.
ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name_ar,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(brand,''))
  ) STORED;
CREATE INDEX products_search_idx ON products USING GIN (search_vector);

CREATE TABLE price_tiers (
  id              BIGSERIAL PRIMARY KEY,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty         INTEGER NOT NULL CHECK (min_qty > 0),
  price           NUMERIC(14,4) NOT NULL CHECK (price >= 0),
  UNIQUE (product_id, min_qty)
);
CREATE INDEX price_tiers_product_idx ON price_tiers(product_id, min_qty);

CREATE TABLE price_history (
  id              BIGSERIAL PRIMARY KEY,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  observed_on     DATE NOT NULL,
  avg_price       NUMERIC(14,4) NOT NULL,
  volume          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, observed_on)
);
CREATE INDEX price_history_product_idx ON price_history(product_id, observed_on);

CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  buyer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body_ar         TEXT NOT NULL DEFAULT '',
  body_en         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_supplier_idx ON reviews(supplier_id);

CREATE TABLE cart_items (
  id              BIGSERIAL PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty             INTEGER NOT NULL CHECK (qty > 0),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id)
);

CREATE TABLE favorites (
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, product_id)
);

CREATE TYPE order_status AS ENUM ('pending','confirmed','processing','shipped','delivered','cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid','authorized','paid','refunded','failed');

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE,
  buyer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  subtotal        NUMERIC(14,4) NOT NULL,
  shipping        NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax             NUMERIC(14,4) NOT NULL DEFAULT 0,
  total           NUMERIC(14,4) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'SAR',
  status          order_status NOT NULL DEFAULT 'pending',
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  payment_method  TEXT NOT NULL DEFAULT '',
  payment_ref     TEXT,
  shipping_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  carrier         TEXT,
  tracking_number TEXT,
  eta_days        INTEGER NOT NULL DEFAULT 0,
  source_rfq_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON orders(buyer_company_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders(status);

CREATE TABLE order_lines (
  id              BIGSERIAL PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  -- Names are copied, not joined: an invoice must not change when a product is renamed.
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  qty             INTEGER NOT NULL CHECK (qty > 0),
  unit_price      NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  unit            product_unit NOT NULL
);
CREATE INDEX order_lines_order_idx ON order_lines(order_id);
CREATE INDEX order_lines_supplier_idx ON order_lines(supplier_id);

CREATE TABLE order_events (
  id              BIGSERIAL PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status          order_status NOT NULL,
  note_ar         TEXT,
  note_en         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events(order_id, created_at);

CREATE TYPE rfq_status AS ENUM ('open','quoted','awarded','closed','expired');

CREATE TABLE rfqs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE,
  buyer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title_ar        TEXT NOT NULL,
  title_en        TEXT NOT NULL,
  category_id     TEXT NOT NULL REFERENCES categories(id),
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  qty             INTEGER NOT NULL CHECK (qty > 0),
  unit            product_unit NOT NULL,
  target_price    NUMERIC(14,4),
  currency        CHAR(3) NOT NULL DEFAULT 'SAR',
  specs           TEXT NOT NULL DEFAULT '',
  needed_by       DATE NOT NULL,
  delivery_city   TEXT NOT NULL DEFAULT '',
  delivery_country CHAR(2) NOT NULL REFERENCES countries(code),
  payment_terms   TEXT NOT NULL DEFAULT '',
  shipping_terms  TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  status          rfq_status NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX rfqs_buyer_idx ON rfqs(buyer_company_id, created_at DESC);
CREATE INDEX rfqs_status_idx ON rfqs(status);

CREATE TABLE rfq_invitations (
  rfq_id          UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rfq_id, supplier_id)
);
CREATE INDEX rfq_invitations_supplier_idx ON rfq_invitations(supplier_id);

CREATE TYPE quote_status AS ENUM ('submitted','revised','accepted','rejected','expired');

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id          UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price      NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  currency        CHAR(3) NOT NULL DEFAULT 'SAR',
  moq             INTEGER NOT NULL CHECK (moq > 0),
  lead_time_days  INTEGER NOT NULL CHECK (lead_time_days >= 0),
  shipping_cost   NUMERIC(14,4) NOT NULL DEFAULT 0,
  shipping_terms  TEXT NOT NULL DEFAULT '',
  payment_terms   TEXT NOT NULL DEFAULT '',
  valid_until     TIMESTAMPTZ NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  status          quote_status NOT NULL DEFAULT 'submitted',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One live quote per supplier per RFQ; revisions update in place.
  UNIQUE (rfq_id, supplier_id)
);
CREATE INDEX quotes_rfq_idx ON quotes(rfq_id);
CREATE INDEX quotes_supplier_idx ON quotes(supplier_id);

CREATE TYPE negotiation_status AS ENUM ('active','accepted','rejected','converted');
CREATE TYPE negotiation_party AS ENUM ('buyer','supplier');
CREATE TYPE negotiation_round_kind AS ENUM ('offer','counter','accept','reject');

CREATE TABLE negotiations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  rfq_id          UUID REFERENCES rfqs(id) ON DELETE SET NULL,
  quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'SAR',
  status          negotiation_status NOT NULL DEFAULT 'active',
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX negotiations_buyer_idx ON negotiations(buyer_company_id, created_at DESC);
CREATE INDEX negotiations_supplier_idx ON negotiations(supplier_id, created_at DESC);

CREATE TABLE negotiation_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id  UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  by_party        negotiation_party NOT NULL,
  actor_name      TEXT NOT NULL DEFAULT '',
  kind            negotiation_round_kind NOT NULL,
  unit_price      NUMERIC(14,4) NOT NULL,
  qty             INTEGER NOT NULL,
  moq             INTEGER NOT NULL,
  shipping_cost   NUMERIC(14,4) NOT NULL DEFAULT 0,
  shipping_terms  TEXT NOT NULL DEFAULT '',
  payment_terms   TEXT NOT NULL DEFAULT '',
  message         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX negotiation_rounds_idx ON negotiation_rounds(negotiation_id, created_at);

CREATE TABLE threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  subject_ar      TEXT NOT NULL DEFAULT '',
  subject_en      TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_company_id, supplier_id)
);

CREATE TYPE message_kind AS ENUM ('text','quote','product','order','file','ai');

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name     TEXT NOT NULL DEFAULT '',
  side            negotiation_party NOT NULL,
  kind            message_kind NOT NULL DEFAULT 'text',
  body            TEXT NOT NULL,
  attachment_ref  TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON messages(thread_id, created_at);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  title_ar        TEXT NOT NULL,
  title_en        TEXT NOT NULL,
  body_ar         TEXT NOT NULL DEFAULT '',
  body_en         TEXT NOT NULL DEFAULT '',
  href            TEXT NOT NULL DEFAULT '',
  channels        TEXT[] NOT NULL DEFAULT '{in_app}',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target          TEXT NOT NULL DEFAULT '',
  metadata        JSONB NOT NULL DEFAULT '{}',
  ip              INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_id, created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log(action);
