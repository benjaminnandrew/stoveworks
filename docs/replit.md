# Moving the site to Replit

Written 12 Oct 2026. Three things move, and each has its own home on Replit:

| What | Where it goes on Replit | Size |
| --- | --- | --- |
| The code, including `brain/` (the catalog data and the 186 guide pages) | The Replit App, imported from GitHub | about 60 MB |
| The catalog's photos and PDFs (`var/brain-assets/images` and `documents` on the laptop) | App Storage, Replit's file storage | about 1.7 GB in use |
| The database | Replit's PostgreSQL | about 30 MB once loaded |

`var/` is git-ignored, so the photos and PDFs never go into the repo. They're uploaded once,
straight into App Storage.

## 1. Get the code into Replit

Either upload the project zip (13 Oct 2026: code, `brain/` and docs, without
`node_modules`, `.next`, `var/` or `.env.local`), or create a private GitHub repository,
push this folder to it, and create the Replit App from that repository. The `.replit` file
in the project sets Node 24, the Reserved VM target, the build and run commands and the
port mapping, so step 6's settings arrive pre-filled. `.gitignore` already keeps
out `node_modules`, `.next`, `var/` and `.env.local`, plus `brain/archive/` (local sync
bundles and the set-aside non-US models) and `brain/guides-save.tgz`.

## 2. Add the database

In the Replit workspace, open the **Database** tool and add PostgreSQL. Replit then sets
`DATABASE_URL`, which the site already reads.

On Replit the site refuses to run without `DATABASE_URL` rather than quietly falling back to
PGlite, because PGlite would keep accounts and designs on the app's own disk, and a published
Replit app loses that disk on every redeploy. (`ALLOW_PGLITE=1` overrides this, for a
throwaway test only.)

## 3. Upload the photos and PDFs to App Storage

Open **App Storage** and create a bucket; it becomes the app's default bucket. Upload two
folders from `var/brain-assets/` on the laptop, keeping their names, with the "upload folder"
button or by dragging them in:

- `images` (1,058 photos, 0.47 GB)
- `documents` (the 200 manuals the guides open and 14 other catalog PDFs, 1.2 GB, plus about
  100 older PDFs, 0.6 GB, that nothing uses any more; uploading them does no harm)

Every object name must start with `images/` or `documents/`. Those are the storage keys
the catalog and the guides use.

Nothing else is needed. On Replit the site uses App Storage automatically (`FILE_STORE`
defaults to `replit` there), and the same bucket serves both the workspace and the published
app. Customer room photos and the cutouts and swatches staff upload go into the same bucket,
under `uploads/`.

## 4. Install and load

In the workspace Shell:

```bash
npm install
npm run db:migrate
npm run db:seed          # the site's brands
npm run db:seed:stone    # Cultured Stone profiles
npm run brain:load       # the catalog (200 models, photos, PDFs, 186 guides) and the visualizer's products
```

`brain:load` prints what it loaded and how many photos and PDFs it found in App Storage. If
some guides' manuals are missing it names them, so upload those files and run it again. Re-running
is always safe. It only changes what differs and changes no table structure outside the
catalog's. It never overwrites a `carry_status` staff have set, and a model staff have marked is
kept (as retired) even if it drops out of the brain. It also keeps the visualizer's products in
step with the models, without touching what staff own there (cutouts, live or hidden, summary
and sizes once set).

## 5. Check it

Run the app and open `/guides/blaze-king-ashford-20-2/`. Open any tile and tap the link at the
bottom of its panel ("Opens the official PDF at page N"): the manual should open from
`/files/documents/…` at that page.

## 6. Publish

- **Deployment type: Reserved VM.** It never sleeps. Autoscale costs less at low traffic but
  goes idle after 15 minutes without visitors, and the next visitor waits while it starts. The
  Dedicated 1 vCPU / 4 GB machine ($35/month) keeps photo uploads and image resizing quick;
  Shared 0.5 vCPU / 2 GB ($15/month) is fine to start on with light traffic.
- **Build command:** `npm run build`. **Run command:** `npm run start:live`.
- **Port:** the site listens on 3014. Map it to external port 80 and expose no other port;
  published apps allow one, and Replit checks the homepage on port 80 before going live.
- **Production app secrets** (a separate list from the workspace's Secrets, under Publishing):
  `SITE_URL` (the exact public address: the .replit.app address while testing, then
  https://stoveworksinc.com; sign-in links are built from it), `SMTP_URL` and `MAIL_FROM`
  (without them nobody can sign in, because the emails only print to the log).
- **The live database fills itself.** Publishing creates a production database, separate from
  the workspace's and empty. `npm run start:live` brings the tables up to date (about a
  second), starts the site, then loads the brands, the stone profiles (first time only) and the
  catalog in the background. The first time that takes a minute or two; after that, a few
  seconds per restart. Each step is safe to repeat and never overwrites what staff own, and a
  step that fails leaves the site running on the data as last loaded. The deployment logs show
  each step.
- **Domain:** link stoveworksinc.com in the publishing settings when you're ready to move off
  WordPress, then change `SITE_URL` to it.
- **Backups:** the production database keeps point-in-time restore and daily backups (7 days on
  Core, 28 on Pro). Room photos in App Storage aren't part of that.

## Updating the catalog later

When the brain changes: replace `brain/` with the new copy, commit, upload any new photos or
PDFs to App Storage, and republish. `npm run start:live` loads the new catalog into the live
database when the site restarts. Run `npm run brain:load` in the workspace for its own
database.

## Reference

**Tables** (all loaded by `brain:load`, see `db/catalog.sql`): `catalog_brands`,
`catalog_models` (classification and headline figures as columns, the full record in `data`),
`catalog_images` and `catalog_documents` (one row per file; `object_path` is set when the file
is in storage, otherwise link to `url`, the maker's copy), the joins `catalog_model_images`,
`catalog_model_documents` and `catalog_model_guides`, `catalog_guides` (the pages themselves),
`catalog_candidates` (unverified, not part of the catalog) and `catalog_meta` (when it was last
loaded). `src/lib/catalog.ts` has typed queries for building pages on top of them.

**Routes:**

| URL | What |
| --- | --- |
| `/guides/<id>/` | An owner & installer guide, served from the database |
| `/files/documents/<brand>/<file>` | A catalog PDF, inline, so `#page=N` works |
| `/files/images/<brand>/<file>` | A catalog photo |
| `/files/media/products/<file>`, `/files/media/stone/<file>` | Cutouts and swatches staff upload |
| `/api/photos/<id>` | A customer's room photo (unchanged: owner, staff or share link only) |

**Settings:** `FILE_STORE` (`local` or `replit`), `APP_STORAGE_BUCKET` (a bucket other than
the default), `BRAIN_ASSETS_DIR` and `UPLOAD_DIR` (local folders), `ALLOW_PGLITE`.

**Brands:** `catalog_brands.slug` matches the site's `brands.slug` for 12 of the 13 makers.
Town & Country is `town-country` in the catalog and `town-and-country` on the site. True North
was added to the site's pages on 19 Oct 2026 (Wood Stoves, Wood Inserts, Gas Stoves), so its
slug now matches too.

**Products:** the visualizer's `products` are the catalog's models (Ben, 13 Oct), one row per
model, linked by `products.catalog_model_id`. The first load on an existing database removes
the old placeholder rows, keeping hidden any that a saved design uses.
