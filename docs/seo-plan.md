# SEO & AI-search plan

Brief written by Ben, 8 Oct 2026, from a separate research session on how the rebuild should
be structured for Google and AI search. **These are guidelines to work from, test against
and push back on, not a spec.** Where a point doesn't fit the business or the build, say so
and propose something better. The second half is the gap analysis against the build as it
stood that day.

Two things changed after the brief was written, and they override it:

- **The name is Hayward Stoveworks**, not "The Stove Works". Wherever the brief says
  "The Stove Works", read "Hayward Stoveworks".
- **No invented content** (see HANDOFF.md). The brief calls for prices, staff names,
  founding year, project photos, reviews and FAQs. All of that has to come from Steve. Don't
  ship a page type until there's real content to put on it. An empty shell is worse than no
  page.

---

## The brief

### 1. URL structure

Keep the existing category URLs. They're clean and match what people search.

```
/                               Home
/stoves/                        keep
    wood-stoves/  gas-stoves/  pellet-stoves/*
    → featured models nest here: /stoves/wood-stoves/blaze-king-princess/
/inserts/                       keep
    wood-inserts/  gas-inserts/
/fireplaces/                    keep
    gas-fireplaces/  wood-fireplaces/  electric-fireplaces/
/sauna-stoves/                  split from hot-tubs-sauna-stoves
/wood-fired-hot-tubs/           new
/cook-stoves/                   was refrigerators-cook-stoves
/outdoor/                       fire rings, grills
/hearth-accessories/            was specialty-hearth
    glass-doors/  hearth-pads/  gas-logs/
/mantels-surrounds/             was facings (trade jargon)
/home-cabin-decor/              keep

/services/                      keep URL, list the actual services
    wood-stove-installation/
    fireplace-insert-installation/
    gas-fireplace-installation/
    gas-fireplace-service-repair/
    chimney-liners/*   chimney-cleaning-inspection/*
    new-construction/           builders (already NAHB/NABA)
/brands/                        one page per line actively sold
    blaze-king/  jotul/  hearthstone/  pacific-energy/  kozy-heat/ …
/learn/                         evergreen guides, no dates in URLs
/projects/   /reviews/   /about/   /service-area/   /contact-us/ (keep)

* only if offered
```

Rules:

- **One URL per search intent.** "Hot tubs / sauna stoves" is two searches, so it's two pages.
- **Location goes in titles, H1s and copy, not URLs.** It's a single location.
- **Model pages only for floor units or frequent sellers.** Use the store's own photos and
  notes, not a mirror of the manufacturer's catalogue.
- **Cross-link along the buying path,** e.g. wood inserts → insert installation → chimney
  liners → cost guide.

301 redirects for URLs that change:

| Old | New |
| --- | --- |
| `/specialty-hearth/` (+ `glass-doors`, `hearth-pads`, `gas-logs`) | `/hearth-accessories/` (same child slugs) |
| `/specialty-hearth/outdoor-rings-grills/` | `/outdoor/` |
| `/specialty-hearth/refrigerators-cook-stoves/` | `/cook-stoves/` |
| `/specialty-hearth/hot-tubs-sauna-stoves/` | `/sauna-stoves/` (link to hot tubs from there) |
| `/facings/` | `/mantels-surrounds/` |
| `/2018/02/09/hello-world/` | 410 Gone |

Before launch, export every page with impressions from Search Console in case something
outside the sitemap gets traffic, and redirect those too.

### 2. Keywords: one primary intent per page

| Cluster | Examples | Page |
| --- | --- | --- |
| Store | fireplace store Hayward WI, wood stove store Hayward | Home |
| Product | wood stoves / gas inserts / electric fireplaces + Hayward WI, wood-fired sauna stove, wood cook stove | Category pages |
| Brand | Blaze King dealer Wisconsin, Jotul dealer near me, [model] price | Brand and model pages |
| Service | wood stove installation Hayward, gas fireplace repair Hayward WI | Service pages |
| Questions | cost to install a wood stove, best stove for a cabin, catalytic vs non-catalytic | `/learn/` |
| Towns | Spooner, Cable, Stone Lake, Seeley, Winter, Minong, Couderay | Service-area page, project captions |

- **Cabin owners search from elsewhere** (Twin Cities, Chicago). Google can't use their
  location, so they type "Hayward". Titles and H1s need it spelled out.
- **"Gas" usually means propane** up here. Gas pages should say "propane (LP) and natural
  gas", because people search "propane fireplace insert" and "propane stove for cabin".
- **Title pattern:** `Wood Stoves in Hayward, WI | Hayward Stoveworks`, about 50–60
  characters. Volumes weren't pulled, so check Search Console or Keyword Planner.

### 3. Content

The brief cites Google's May 2026 AI-search guidance: original, first-hand content matters
most. For a dealer, that means writing what the manufacturers can't.

- **Category pages:** a short intro in the store's own words that answers the main question
  first. Who each option suits, what's on the floor, typical installed price ranges. Then the
  stocked models (linking to our own pages), local install photos, 3–6 real customer
  questions, and a call to visit the showroom or get an estimate.
- **Service pages:** what's included, steps, lead times (the fall backlog), price ranges,
  area served, permits and inspection, and who does the work (names and certifications).
  Add photos and FAQs.
- **Brand pages:** why the store carries the line, which models are on the floor, who it
  suits, and the parts and warranty support. These win "where can I buy X near Hayward".
- **Projects:** every install as a photo captioned with town and product, e.g. "Jotul F 500
  in a log home near Cable".
- **About:** exact founding year, owners and staff with photos and years in the trade,
  associations, showroom photos.
- **First `/learn/` articles:**
  - What a wood stove install really costs in the Hayward area
  - Is there still a wood stove tax credit in 2026? (The 30% 25C credit ended with 2025. Many
    dealer pages still say otherwise, so an accurate page gets cited.)
  - Wood vs. propane vs. electric for a seasonal cabin
  - Heat that works when the power's out
  - Catalytic vs. non-catalytic: Blaze King vs. the other lines
  - Why your gas fireplace won't light after summer
  - Choosing a wood-fired sauna stove
  - Permits and insurance for a Sawyer County stove install (only with real local specifics)

### 4. AI search

Google's AI Overviews and AI Mode draw on its normal index and ranking systems, so
everything above is the Google AI strategy. A complete Business Profile also helps local
businesses show up. Other AI tools lean heavily on third-party confirmation. The research
cited surveys: 45% of consumers use AI tools for local recommendations; citations and
consistent business info make up three of the top five AI-visibility factors; businesses
surfaced by both ChatGPT and Perplexity averaged 133 Google reviews, versus 11 for those
that weren't.

Off-site work (Steve / Ben, not code):

- **One name, identical everywhere:** site, schema, Google Business Profile, Facebook,
  YellowPages, Yelp, Bing, Apple, the chamber, and every manufacturer's dealer locator.
  - YellowPages lists an unrelated-looking "The Stove Works" at 238 N Main St, Rice Lake
    (715-234-9784). If it was ever theirs, get it corrected. Either way, the rebrand to
    "Hayward Stoveworks" plus the Hayward address helps keep AI tools from blending the two.
- **Google Business Profile:** fill it out completely. Primary category *Fireplace store*;
  services and products; seasonal photos; holiday hours.
- **Reviews:** ask steadily and reply to them. Ask customers to mention what was installed
  and where, with no scripts or incentives.
- **Claim listings:** Bing Places and Bing Webmaster Tools (Copilot runs on Bing), Apple
  Business Connect, Yelp, BBB, the Hayward Area Chamber directory (a competitor, Northwoods
  Stove and Fireplace, is already listed there). Give Facebook a vanity URL.
- **Dealer locators:** every brand lists the store correctly, with a link to the site.
- **State facts plainly in page text:** "Authorized dealer for…", "We install throughout
  Sawyer, Washburn and Bayfield counties", "We service gas fireplaces we didn't sell" (only if
  true). AI tools answer yes/no questions from sentences like these.
- **Keep crawlers allowed in.** Check that the host or CDN doesn't block AI bots. In Search
  Console, check Settings → Search generative AI is on "Include".

Skip:

- **llms.txt:** Google Search doesn't use it.
- **A page per keyword variation or per town:** that's scaled content abuse. Only build a
  town page where there are real jobs to show.
- **FAQ schema for rich results:** Google restricted those years ago.

### 5. Technical

- Content in the initial HTML (most non-Google AI crawlers don't run JavaScript). No slider.
- No zoom lock in the viewport tag.
- Structured data: `LocalBusiness` (address, geo, hours, sameAs, areaServed, foundingDate) and
  `WebSite` on the home page, `BreadcrumbList` sitewide, `Product` on model pages, `Article`
  with an author on guides. **No star ratings on our own testimonials** (Google ignores
  self-serving review markup).
- Real alt text on every image.
- Short videos (showroom tour, gas fireplace service) on the relevant pages.
- Auto-updating © year; a real fax number (not the phone repeated); a domain email instead of
  Gmail.
- Monitoring: sitemaps to Search Console and Bing Webmaster Tools, IndexNow, watch for 404s
  after launch, Search Console's Generative AI performance report.

---

## Gap analysis: the build as of 8 Oct 2026

### Already in line with the brief

- All content is server-rendered into the initial HTML. No slider, no client-only copy.
- The viewport has no zoom lock (`width=device-width, initial-scale=1` only).
- `robots.ts` allows everything; the sitemap is generated from `pages.ts`.
- Account, admin, sign-in and `/d/` share pages are all `noindex`.
- `LocalBusiness`-family JSON-LD is sitewide (`HomeAndConstructionBusiness`) with address,
  geo, hours and sameAs.
- Visual breadcrumbs on every content page.
- All 55 images in `pages.ts` have non-empty alt text.
- The © year is computed (`new Date().getFullYear()`).
- No hello-world post. That URL just 404s, and it should become a 410.
- The name is consistent on-site: `site.ts` is the single source.

### Done on 8 Oct 2026

- **Trailing slashes kept.** The old URLs all end in `/`; the rebuild originally didn't, which
  would have redirected every page on launch. Now identical (see HANDOFF, "Every internal
  link needs its trailing slash").
- **Titles:** `{Page} in Hayward, WI | Hayward Stoveworks`, with `metaTitle` overrides in
  `pages.ts` where the page name alone is weak (Stoves → "Wood, Gas & Pellet Stoves",
  Services → "Stove & Fireplace Installation"). Home: "Fireplace & Stove Store in Hayward,
  WI". The double "Hayward" (town plus name) was kept: it reads naturally and matches the
  query.
- **Descriptions** name the brands each page carries (hub pages borrow their children's).
- **URL renames + 301s**, with these departures from the brief:
  - `facings` → **`/stonework-mantels/`**, not `/mantels-surrounds/`. The page is three stone
    veneer makers plus a log-mantel maker; "surrounds" usually means the metal trim around an
    insert, so it would mislabel the page. Its own heading was already "Stonework & Mantels".
  - The **Specialty Hearth** menu label stayed (it's the store's own term, used in the page
    copy), but its overview page is now "Hearth Accessories" at `/hearth-accessories/`. Its
    "All Specialty Hearth →" link therefore lands on a page with a different name. Minor;
    revisit if it bothers anyone.
  - The hot tub / sauna page is split into `/sauna-stoves/` (Nippa) and
    `/wood-fired-hot-tubs/` (Snorkel), each linking to the other. The old URL 301s to sauna
    stoves.
- **410** for `/2018/02/09/hello-world/`.
- **BreadcrumbList** JSON-LD on every content page, built from the URL path (so the visible
  breadcrumbs now follow the URL too). **WebSite** JSON-LD on the home page.
- **Fax removed** from the footer, contact page and schema (it repeated the phone number).
- **Sitemap** uses slash URLs and now includes `/visualizer/` and `/veneer/`. No `lastmod`:
  there are no real per-page dates, and a build-time stamp on everything teaches Google to
  ignore the field.
- The root layout had `canonical: "/"`, which every page without its own canonical inherited
  (pointing them at the home page). It's now set on the home page only.

### Still open from the list below

Item 8 (propane wording, waiting on Steve). Items 1–7 are done, as above.

### Code changes that need no new content (as listed before the 8 Oct work)

1. **Title template.** It's currently `%s – Hayward Stoveworks` with no location. Change it
   to `%s in Hayward, WI | Hayward Stoveworks` for category pages, with per-page overrides
   where the pattern reads badly. The home title is ~85 characters, so trim it.
2. **URL restructure + 301s.** The build mirrors the old slugs (`specialty-hearth/*`,
   `facings`). Rename per the table above and add `redirects()` to `next.config.ts`. Update
   `nav` in `site.ts`, `nav-data.ts`, and anywhere else that hard-codes these paths.
   - **Splitting hot tubs from sauna stoves** needs content for two pages. Check what the
     current page actually says about each before splitting.
   - **`/outdoor/`** and **`/cook-stoves/`** are straight moves.
   - Leave the old `/refrigerators` wording out of the new URL, but keep it in the copy if
     the store sells them.
3. **410 for `/2018/02/09/hello-world/`.**
4. **`BreadcrumbList` JSON-LD** from the existing `trailFor()`.
5. **`WebSite` JSON-LD** on the home page.
6. **Fax.** `site.ts` repeats the phone number as the fax. Remove `faxNumber` from the schema
   and the fax line from the footer until Steve gives a real one.
7. **Sitemap `lastModified`**, plus `/visualizer` and `/veneer` if they should be indexed
   (they're real, useful tools; probably yes).
8. **Gas pages say nothing about propane.** There are zero mentions in `pages.ts`. Adding
   "propane (LP) and natural gas" is a factual change Steve must confirm (that the units
   they sell and install run on LP). Very likely true, but ask.

### Needs Steve before it can exist (no-invented-content line)

- Founding year. The nameplate artwork reads "EST 1975"; confirm before it goes into
  `foundingDate` or About copy.
- Service list, lead times, price ranges, permit specifics, installer names and
  certifications, area served (which counties and towns, stated as fact).
- Which brands are actively sold vs. legacy mentions → `/brands/` pages.
- Floor models → model pages (ties into the product inventory and visualizer cutouts:
  one photo shoot serves both).
- Install photos with town and product → `/projects/`.
- Real customer questions → FAQs on category and service pages.
- Reviews → `/reviews/`, ideally pulled from Google rather than retyped.
- Whether they service units they didn't sell; pellet stoves; chimney liners/cleaning.

### Off-site (no code, but blocks AI visibility more than anything on the site)

The rebrand makes name consistency **more** urgent, not less. Right now Google Business
Profile says "Stove Works & Fireplace Center", the site says "Hayward Stoveworks", and
directories have other variants. Until every listing reads "Hayward Stoveworks", AI tools
see two or three businesses. This overlaps HANDOFF loose ends 12–16 (domain, Gmail, GBP,
sign photo, legal name).
