# Moving the site to Replit

Written 12 Oct 2026, brought up to date 2 Nov 2026. The site is complete and already set up for
Replit (the `.replit` file), so nothing needs building or changing there: these steps install
it, load its data and publish it. Three things move, and each has its own home on Replit:

| What | Where it goes on Replit | Size |
| --- | --- | --- |
| The code, including `brain/` (the catalog, the 186 guides and their manuals' page text) and `db/hearth-studio/` (Hearth Studio's sized products and their cutouts) | The Replit App, imported from GitHub | about 130 MB with its history |
| The catalog's photos and PDFs (`var/brain-assets/images` and `documents` on the laptop) | App Storage, Replit's file storage | about 2.1 GB |
| The database | Replit's PostgreSQL | about 30 MB once loaded |

Nothing is copied from the laptop's database. Everything the site shows is rebuilt from `brain/`
and `db/hearth-studio/` by the loaders: `npm run db:setup` in the workspace, and
`npm run start:live` each time the published site starts. What lives only in the laptop's
database is test data (sign-ins, test designs, logged searches), and it stays behind.

`var/` is git-ignored, so the photos and PDFs never go into the repo. They're uploaded once,
straight into App Storage.

## 1. Get the code into Replit

The code is in the private GitHub repository `benjaminnandrew/stoveworks`. Create the Replit App
from it (import from GitHub), on the `main` branch. The `.replit` file in the project sets Node 24,
the Reserved VM target, the build and run commands and the port mapping, so step 6's settings
arrive pre-filled. `.gitignore` already keeps out `node_modules`, `.next`, `var/` and
`.env.local`, plus `brain/archive/*.tgz` (local sync bundles) and `brain/guides-save.tgz`.

## 2. Add the database

Open the **Database** tool. A new Replit App usually comes with a development database; if there
isn't one, add PostgreSQL. Replit then sets `DATABASE_URL`, which the site already reads.

On Replit the site refuses to run without `DATABASE_URL` rather than quietly falling back to
PGlite, because PGlite would keep accounts and designs on the app's own disk, and a published
Replit app loses that disk on every redeploy. (`ALLOW_PGLITE=1` overrides this, for a
throwaway test only.)

## 3. Upload the photos and PDFs to App Storage

Open **App Storage** and create a bucket; it becomes the app's default bucket. Upload two
folders from `C:\Users\b_wel\Projects\stoveworks\var\brain-assets\` on the laptop, keeping their
names, with the "upload folder" button or by dragging them in:

- `images` (1,058 photos in a folder per maker, 0.45 GB)
- `documents` (317 PDFs in a folder per maker, 1.7 GB: the 200 manuals the guides open and 14
  other catalog PDFs, plus about 100 older PDFs that nothing uses any more; uploading them does
  no harm)

Only those two. The other folders beside them (`images-named`, `_to_delete_images-named-old`,
`_to_delete_images-named-old2`, `pages`) and the loose files are leftovers from building the
catalog, and the site doesn't read them.

Every object name must start with `images/` or `documents/`. Those are the storage keys
the catalog and the guides use.

Nothing else is needed. On Replit the site uses App Storage automatically (`FILE_STORE`
defaults to `replit` there), and the same bucket serves both the workspace and the published
app. Hearth Studio's cutouts (written there by `studio:load`), customer room photos, and the
cutouts and swatches staff upload all go into the same bucket, under `uploads/`.

## 4. Install and load

In the workspace Shell:

```bash
npm install
npm run db:setup
```

`db:setup` runs, in order:
- `db:migrate`, the tables;
- `db:seed`, the site's brands;
- the Cultured Stone profiles, the first time only;
- `brain:load`, the catalog: 200 models, their photos and PDFs, 186 guides and the search's
  guide sections and manual pages, plus one product per model;
- `studio:load`, Hearth Studio's cutouts and sizes (5 stoves, 8 fireplaces and 2 inserts on
  2 Nov 2026).

It takes under a minute on a laptop, and running it again is always safe.

`brain:load` prints what it loaded and how many photos and PDFs it found in App Storage. If
some guides' manuals are missing it names them, so upload those files and run it again.
It only changes what differs and changes no table structure outside the catalog's. It never
overwrites a `carry_status` staff have set, and a model staff have marked is kept (as retired)
even if it drops out of the brain. It also keeps the products in step with the models, without
touching what staff own there (cutouts, live or hidden, summary and sizes once set).

## 5. Check it

To sign in on the workspace's preview, first add a Secret `SITE_URL` set to its address (the
https://….replit.dev one): sign-in links are built from it, and without it they point at
stoveworksinc.com. The links are written to the Console, since there's no email set up.

Run the app (the Run button starts the dev server), then:
- open `/guides/blaze-king-ashford-20-2/`, open any tile and tap the link at the bottom of its
  panel ("Opens the official PDF at page N"): the manual should open from `/files/documents/…`
  at that page;
- open `/hearth-studio/` and its Stoves & fireplaces list: the stoves, fireplaces and inserts
  should all be there with their pictures.

## 6. Publish

- **Publish after step 4.** Replit makes the published app's own database when you publish,
  once the workspace's database has data in it.
- **Deployment type: Reserved VM.** It never sleeps. Autoscale costs less at low traffic but
  goes idle after 15 minutes without visitors, and the next visitor waits while it starts. The
  Dedicated 1 vCPU / 4 GB machine ($35/month) keeps photo uploads and image resizing quick;
  Shared 0.5 vCPU / 2 GB ($15/month) is fine to start on with light traffic.
- **Build command:** `npm run build`. **Run command:** `npm run start:live`.
- **Port:** the site listens on 3014. Map it to external port 80 and expose no other port;
  published apps allow one, and Replit checks the homepage on port 80 before going live.
- **Production app secrets** (a separate list from the workspace's Secrets, under Publishing):
  - `SITE_URL`: the exact public address, the .replit.app address while testing and then
    https://stoveworksinc.com. Sign-in links are built from it.
  - `SMTP_URL` and `MAIL_FROM`: without them nobody can sign in, because the emails only print
    to the log.
  - `ANTHROPIC_API_KEY`, for Hearth Studio's paint lookup and photo helper. Without it, both
    say they're not set up.
- **The live database fills itself.** The published app's database starts separate from the
  workspace's. `npm run start:live` brings the tables up to date (about a second), starts the
  site, then loads the brands, the stone profiles (first time only), the catalog and Hearth
  Studio's cutouts in the background. The first time that takes a minute or two; after that, a
  few seconds per restart. Each step is safe to repeat and never overwrites what staff own, and
  a step that fails leaves the site running on the data as last loaded. The deployment logs
  show each step.
- **Domain:** link stoveworksinc.com in the publishing settings when you're ready to move off
  WordPress, then change `SITE_URL` to it.
- **Backups:** the production database keeps point-in-time restore and daily backups (7 days on
  Core, 28 on Pro). Room photos in App Storage aren't part of that.

## 7. Staff on the live site

Sign-in is by an emailed link. Until `SMTP_URL` is set, the email is written to the deployment
logs instead of being sent, so you can sign in from there to test.

`/admin` (and Steve's `/admin/carry/`) needs a staff or admin account. To make one on the live
site, open the **Database** tool, pick the production database, open **My Data**, turn on
**Edit**, and run this in its SQL runner, with the right email:

```sql
INSERT INTO users (email, role) VALUES ('name@example.com', 'admin')
ON CONFLICT (lower(email)) DO UPDATE SET role = EXCLUDED.role;
```

The role is `admin` or `staff`. For the workspace's own database,
`npm run db:grant -- name@example.com admin` does the same.

## Updating later

- **The catalog:** when the brain changes, replace `brain/` with the new copy, commit, upload
  any new photos or PDFs to App Storage, and republish. `npm run start:live` loads the new
  catalog into the live database when the site restarts. Run `npm run brain:load` in the
  workspace for its own database.
- **Hearth Studio's products:** until the stove admin has its sizing step (7d), products are
  sized on the laptop with `scripts/set-stove-cutout.mjs`, which also writes
  `db/hearth-studio/`. Commit, push and republish, and `start:live` puts the new and re-measured
  ones on the live site. A cutout that staff change or remove on the live site stays as they
  left it.

## Reference

**Tables** (all loaded by `brain:load`, see `db/catalog.sql`): `catalog_brands`,
`catalog_models` (classification and headline figures as columns, the full record in `data`),
`catalog_images` and `catalog_documents` (one row per file; `object_path` is set when the file
is in storage, otherwise link to `url`, the maker's copy), the joins `catalog_model_images`,
`catalog_model_documents` and `catalog_model_guides`, `catalog_guides` (the pages themselves),
`catalog_candidates` (unverified, not part of the catalog) and `catalog_meta` (when it was last
loaded, and under `hearth_studio` which cutout `studio:load` last set for each product).
`src/lib/catalog.ts` has typed queries for building pages on top of them.

**Routes:**

| URL | What |
| --- | --- |
| `/guides/<id>/` | An owner & installer guide, served from the database |
| `/files/documents/<brand>/<file>` | A catalog PDF, inline, so `#page=N` works |
| `/files/images/<brand>/<file>` | A catalog photo |
| `/files/media/products/<file>`, `/files/media/stone/<file>` | Cutouts and swatches (Hearth Studio's and staff uploads) |
| `/api/photos/<id>` | A customer's room photo (unchanged: owner, staff or share link only) |

**Settings:** `FILE_STORE` (`local` or `replit`), `APP_STORAGE_BUCKET` (a bucket other than
the default), `BRAIN_ASSETS_DIR` and `UPLOAD_DIR` (local folders), `ALLOW_PGLITE`, and
`PGLITE_DIR` (another local database folder, for a test).

**The uuid override (30 Oct 2026):** `@replit/object-storage` 1.0.0, its latest, holds Google's
storage library at version 7, whose `gaxios` and `teeny-request` want uuid 9, which `npm audit`
flags (GHSA-w5hq-g745-h8pq; not reachable here, since both only call `uuid.v4()`). `overrides`
in `package.json` gives that package's tree uuid 11.1.1 instead. Take the override out once a
newer `@replit/object-storage` uses `@google-cloud/storage` 8 or later, and check that
`npm audit --omit=dev` stays clean.

**Brands:** `catalog_brands.slug` matches the site's `brands.slug` for 12 of the 13 makers.
Town & Country is `town-country` in the catalog and `town-and-country` on the site. True North
was added to the site's pages on 19 Oct 2026 (Wood Stoves, Wood Inserts, Gas Stoves), so its
slug now matches too.

**Products:** the products are the catalog's models (Ben, 13 Oct), one row per model, linked by
`products.catalog_model_id`. The first load on an existing database removes the old placeholder
rows, keeping hidden any that a saved design uses.
