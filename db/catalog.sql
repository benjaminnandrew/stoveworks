-- Hayward Stoveworks — the manufacturer catalog, loaded from the brain (brain/).
--
-- Manufacturer information only: the 200 models from 13 brands, every
-- published spec, the photos and PDFs (and whether each file is in storage),
-- and the owner & installer guides. `npm run brain:load` owns these tables and
-- brings them in line with the brain on every run, inside one transaction.
-- The exception is carry_status: once staff set it, the loader never changes
-- it, and a model staff have marked is kept (with retired_at set) if it drops
-- out of the brain, rather than deleted.
--
-- Applied by `npm run db:migrate` (after schema.sql) and by `npm run brain:load`
-- inside its transaction. Every statement is idempotent, and nothing here
-- touches the site's own tables, so a load never locks them. The loader does
-- keep the visualizer's products in step with the models (one row per model,
-- products.catalog_model_id; see db/schema.sql), adding any brand the site's
-- brands table lacks, but never changes those tables' structure.
-- catalog_brands.slug matches brands.slug for most makers (see docs/replit.md).

CREATE TABLE IF NOT EXISTS catalog_brands (
  slug        text PRIMARY KEY,
  name        text        NOT NULL,
  website     text,
  status      text,
  about       text,
  model_count integer,
  -- How the maker sorts its own lineup (shapes, flame patterns), where checked.
  browse      jsonb,
  data        jsonb       NOT NULL,            -- the full brands.json record
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_models (
  id                 text PRIMARY KEY,         -- e.g. blaze-king-ashford-20-2
  brand_slug         text        NOT NULL REFERENCES catalog_brands (slug) ON DELETE CASCADE,
  name               text        NOT NULL,
  official_name      text,
  model_numbers      text[]      NOT NULL DEFAULT '{}',
  form               text,                     -- stove | insert | fireplace | cook_stove | outdoor_fireplace
  fuel               text,                     -- wood | gas | electric | pellet
  install_type       text,                     -- freestanding | insert | zero_clearance | masonry | outdoor
  venting            text,                     -- chimney | direct_vent | b_vent | vent_free | none
  series             text,
  style              text,
  shape_group        text,                     -- shape->>'group', for cross-brand filters
  shape              jsonb,
  flame_pattern      jsonb,
  viewing            jsonb,
  lineup_status      text,
  us_availability    text,
  availability_note  text,
  description        text,
  features           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Headline figures as columns, for grids and sorting. Efficiency bases differ
  -- by brand (HHV, LHV, CSA P.4.1, AFUE…): always show efficiency_basis with it.
  heating_area_sqft_max numeric,
  btu                numeric,
  btu_basis          text,
  efficiency_pct     numeric,
  efficiency_basis   text,
  log_length_max_in  numeric,
  burn_time_hr_max   numeric,
  headline           jsonb,
  specs              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sizes              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  specs_raw          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Where the maker's website and its manual disagree (both are reported).
  manual_differences jsonb       NOT NULL DEFAULT '[]'::jsonb,
  hero_image_url     text,
  product_url        text,
  checked_on         date,
  data               jsonb       NOT NULL,     -- the full models.json record
  -- Staff: what Stoveworks carries. Loaded as 'unconfirmed'; once staff set it
  -- (carry_status_set_at not null) the loader leaves it alone.
  carry_status        text        NOT NULL DEFAULT 'unconfirmed',
  carry_status_set_by uuid,                    -- users.id of whoever set it
  carry_status_set_at timestamptz,
  -- Set when the model is no longer in the brain but is kept because staff had
  -- set its carry_status. Cleared if it comes back. Pages should skip these.
  retired_at         timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- For catalogs created before retired_at existed.
ALTER TABLE catalog_models ADD COLUMN IF NOT EXISTS retired_at timestamptz;

CREATE INDEX IF NOT EXISTS catalog_models_brand_idx ON catalog_models (brand_slug);
CREATE INDEX IF NOT EXISTS catalog_models_browse_idx ON catalog_models (form, fuel);

-- One row per photo. object_path is where the file is kept (the storage key plus
-- its extension); null until the file is in storage, in which case use url.
CREATE TABLE IF NOT EXISTS catalog_images (
  id           text PRIMARY KEY,               -- storage key, e.g. images/blaze-king/0087414707377b73
  url          text        NOT NULL,           -- the maker's original
  brand_slug   text,
  object_path  text,
  content_type text,
  bytes        bigint,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_images_url_key ON catalog_images (url);

CREATE TABLE IF NOT EXISTS catalog_model_images (
  model_id    text    NOT NULL REFERENCES catalog_models (id) ON DELETE CASCADE,
  sort        integer NOT NULL,
  image_id    text    NOT NULL REFERENCES catalog_images (id) ON DELETE CASCADE,
  role        text,                            -- primary_cutout | cutout | lifestyle | detail | line_drawing | other
  variant     text,
  alt         text,
  width       integer,
  height      integer,
  source_page text,
  PRIMARY KEY (model_id, sort)
);

CREATE INDEX IF NOT EXISTS catalog_model_images_image_idx ON catalog_model_images (image_id);

-- One row per PDF (many models share one manual). latest_manual marks the newest
-- US operation & installation manuals, the ones the guides open.
CREATE TABLE IF NOT EXISTS catalog_documents (
  id            text PRIMARY KEY,              -- storage key, e.g. documents/jotul/…pdf
  url           text        NOT NULL,
  brand_slug    text,
  title         text,
  types         text[]      NOT NULL DEFAULT '{}',
  languages     text[]      NOT NULL DEFAULT '{}',
  latest_manual boolean     NOT NULL DEFAULT false,
  pages         integer,
  object_path   text,                          -- null until the file is in storage
  bytes         bigint,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_model_documents (
  model_id      text    NOT NULL REFERENCES catalog_models (id) ON DELETE CASCADE,
  document_id   text    NOT NULL REFERENCES catalog_documents (id) ON DELETE CASCADE,
  sort          integer NOT NULL,
  doc_type      text,                          -- installation_manual | owners_manual | spec_sheet | brochure | epa_report | parts_list | warranty | other
  language      text,
  -- Set when this is one of the model's newest US operation & installation manuals.
  latest_manual boolean NOT NULL DEFAULT false,
  configuration text,
  role          text,
  revision      text,
  revision_date text,                          -- as printed: YYYY-MM or YYYY-MM-DD
  PRIMARY KEY (model_id, document_id)
);

CREATE INDEX IF NOT EXISTS catalog_model_documents_doc_idx ON catalog_model_documents (document_id);

-- The owner & installer guides: one self-contained page per manual set, served
-- at /guides/<id>/.
CREATE TABLE IF NOT EXISTS catalog_guides (
  id                 text PRIMARY KEY,
  title              text        NOT NULL,
  configuration      text,
  manuals            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  conflicts_flagged  integer,
  conflicts_by_class jsonb,
  manual_differences integer,
  html               text        NOT NULL,
  html_sha256        text        NOT NULL,
  data               jsonb       NOT NULL,     -- the guides.json entry
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_model_guides (
  model_id      text    NOT NULL REFERENCES catalog_models (id) ON DELETE CASCADE,
  guide_id      text    NOT NULL REFERENCES catalog_guides (id) ON DELETE CASCADE,
  sort          integer NOT NULL,
  configuration text,
  PRIMARY KEY (model_id, guide_id)
);

CREATE INDEX IF NOT EXISTS catalog_model_guides_guide_idx ON catalog_model_guides (guide_id);

-- Models seen on makers' sites but not yet checked. Unverified: not part of the
-- catalog, kept so staff can see what might be added.
CREATE TABLE IF NOT EXISTS catalog_candidates (
  id       integer PRIMARY KEY,                -- position in candidates.json
  brand    text,
  name     text,
  url      text,
  category text,
  note     text,
  data     jsonb   NOT NULL
);

-- 'load': when and what was last loaded. 'shapes': filter labels for shape and
-- viewing. 'guides': the guide set's description.
CREATE TABLE IF NOT EXISTS catalog_meta (
  key        text PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Search rows, for the site search (docs/smart-search-plan.md). Generated by the
-- loader from the guides: never edited by hand, rebuilt when the guides change.

-- One row per thing a guide explains: an owner or installer topic (the guide's
-- own drawers, linked as /guides/<id>/#<key>), an install step, a fault panel or
-- a status code, with the manual page it rests on.
CREATE TABLE IF NOT EXISTS catalog_guide_sections (
  guide_id    text    NOT NULL REFERENCES catalog_guides (id) ON DELETE CASCADE,
  key         text    NOT NULL,                -- the guide's section id: 'glass', 'specClear', 'step3', 'fault0', 'code2'
  sort        integer NOT NULL,
  audience    text    NOT NULL,                -- owner | installer
  kind        text    NOT NULL,                -- the guide's tag (operation, maintenance, spec…) or step | fault | code
  title       text    NOT NULL,
  terms       text,                            -- the guide's extra index words for this section
  body        text    NOT NULL,                -- plain text
  document_id text,                            -- the manual (storage key) the page number refers to
  page        integer,
  link        text    NOT NULL,                -- fragment in the guide: '#glass', or '#installer' for steps, faults, codes
  -- Clearances, gas, venting, chimney and floor protection: the search links
  -- these and never quotes their figures (see CLAUDE.md).
  safety      boolean NOT NULL DEFAULT false,
  tsv         tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('english', title), 'A') ||
                setweight(to_tsvector('english', coalesce(terms, '')), 'B') ||
                setweight(to_tsvector('english', body), 'C')) STORED,
  PRIMARY KEY (guide_id, key)
);

CREATE INDEX IF NOT EXISTS catalog_guide_sections_tsv_idx ON catalog_guide_sections USING gin (tsv);

-- The text of every manual page the guides open, one row per page.
CREATE TABLE IF NOT EXISTS catalog_manual_pages (
  document_id text    NOT NULL,                -- storage key, as catalog_documents.id
  page        integer NOT NULL,
  body        text    NOT NULL,
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED,
  PRIMARY KEY (document_id, page)
);

CREATE INDEX IF NOT EXISTS catalog_manual_pages_tsv_idx ON catalog_manual_pages USING gin (tsv);
