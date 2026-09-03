-- Hayward Stoveworks — customer accounts, product inventory, room visualizer.
-- Written for PostgreSQL 14+. Applied by `npm run db:migrate`, which runs this
-- file inside a transaction; every statement is idempotent so it is safe to
-- re-run against an existing database.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL,
  name          text,
  phone         text,
  role          text        NOT NULL DEFAULT 'customer',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT users_role_check CHECK (role IN ('customer', 'staff', 'admin'))
);

-- Email is the identity, matched case-insensitively.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

-- Single-use sign-in links. Only the hash is stored, so a database leak does
-- not hand out working links.
CREATE TABLE IF NOT EXISTS login_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  request_ip  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_tokens_user_idx ON login_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   text        NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent   text
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brands (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  website_url text,
  logo_path   text,
  sort        integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    integer     REFERENCES brands (id) ON DELETE SET NULL,
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  category    text        NOT NULL,
  fuel        text        NOT NULL,
  summary     text,
  -- Real-world size, used to scale the cutout truthfully in the visualizer.
  width_in    numeric(6, 2),
  height_in   numeric(6, 2),
  depth_in    numeric(6, 2),
  -- Transparent PNG of the product, shot square-on. Null until staff upload one.
  cutout_path text,
  product_url text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort        integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_category_check CHECK (category IN ('stove', 'insert', 'fireplace', 'hearth')),
  CONSTRAINT products_fuel_check CHECK (fuel IN ('gas', 'wood', 'electric', 'pellet', 'multi'))
);

CREATE INDEX IF NOT EXISTS products_browse_idx ON products (is_active, category, fuel, sort);
CREATE INDEX IF NOT EXISTS products_brand_idx ON products (brand_id);

-- ---------------------------------------------------------------------------
-- Visualizer
-- ---------------------------------------------------------------------------

-- Customer photos of their own rooms. Private: served only through an
-- authenticated route, never from /public.
CREATE TABLE IF NOT EXISTS room_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key   text        NOT NULL,
  original_name text,
  mime          text        NOT NULL,
  width         integer     NOT NULL,
  height        integer     NOT NULL,
  bytes         integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_photos_user_idx ON room_photos (user_id, created_at DESC);

-- A saved arrangement: one room photo plus the products placed on it.
-- `items` is a JSON array of
--   { productId, xPct, yPct, widthPct, rotation, flipped, shadow }
-- with positions stored as percentages so a design survives re-rendering the
-- photo at any size.
CREATE TABLE IF NOT EXISTS designs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  room_photo_id  uuid        NOT NULL REFERENCES room_photos (id) ON DELETE CASCADE,
  title          text        NOT NULL DEFAULT 'Untitled design',
  items          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Scale, once the customer calibrates against a known dimension: what
  -- percentage of the photo's width one real-world inch covers. Stored as a
  -- percentage rather than pixels so a design survives the photo being
  -- re-rendered at any size. Null means "not calibrated, scale is eyeballed".
  pct_per_inch   numeric(10, 6),
  -- Set when the customer shares a read-only link.
  share_slug     text UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS designs_user_idx ON designs (user_id, updated_at DESC);

-- Customers asking Steve's team about a saved design.
CREATE TABLE IF NOT EXISTS design_enquiries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id  uuid        NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message    text        NOT NULL,
  status     text        NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_enquiries_status_check CHECK (status IN ('new', 'read', 'closed'))
);

CREATE INDEX IF NOT EXISTS design_enquiries_status_idx ON design_enquiries (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Stone veneer
--
-- Manufacturers live in `brands` alongside the hearth brands — Cultured Stone,
-- TriLite and Environmental StoneWorks are all already there.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stone_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    integer     REFERENCES brands (id) ON DELETE SET NULL,
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  -- Cultured Stone organises its catalogue as texture (profile) x colour.
  texture     text        NOT NULL,
  color       text,
  summary     text,
  -- A seamlessly tiling image of the stone. Null until staff upload one.
  swatch_path text,
  -- The real-world area one tile of that image covers. This is what makes the
  -- courses come out the right size on a wall.
  swatch_width_in  numeric(6, 2) NOT NULL DEFAULT 24,
  swatch_height_in numeric(6, 2) NOT NULL DEFAULT 16,
  -- Manufacturer coverage figures, used for the material estimate.
  flat_sqft_per_box   numeric(6, 2),
  corner_lnft_per_box numeric(6, 2),
  product_url text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort        integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stone_browse_idx ON stone_products (is_active, texture, sort);
CREATE INDEX IF NOT EXISTS stone_brand_idx ON stone_products (brand_id);

-- A veneer mock-up: one room photo plus the stoned areas marked on it.
--
-- `regions` is a JSON array of
--   { id, stoneProductId, corners: [{xPct,yPct} x4], realWidthIn, realHeightIn,
--     holes: [{xPct,yPct,wPct,hPct}], brightness, contrast, opacity,
--     cornerEdges: {top,right,bottom,left} }
-- Corners are ordered top-left, top-right, bottom-right, bottom-left and stored
-- as percentages of the photo, so a region survives any render size.
--
-- Kept in its own table rather than folded into `designs`: the stove tool ships
-- and works, and this mechanic is different enough to prove separately. When the
-- two editors merge, this becomes a layer type and the rows migrate across.
CREATE TABLE IF NOT EXISTS veneer_designs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  room_photo_id uuid        NOT NULL REFERENCES room_photos (id) ON DELETE CASCADE,
  title         text        NOT NULL DEFAULT 'Untitled mock-up',
  regions       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  share_slug    text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS veneer_designs_user_idx ON veneer_designs (user_id, updated_at DESC);
