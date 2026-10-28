# Hearth Studio on the site

Hearth Studio is the stone and stove visualizer Ben built in a separate Claude chat, as the better
version of `/veneer/`. It arrived on 28 Oct 2026 as `hearth-studio.zip`, unpacked to
`handoff/hearth-studio/`, which is kept out of git through `.git/info/exclude`. Its
`INTEGRATION.md` is the plan, in five phases.

**State, 28 Oct 2026 (branch `hearth-studio`, uncommitted):**
- Phases 1 and 2 are done, with `hearth-studio-update-1.zip` applied (below).
- It's live in the site's navigation: the bar's **Hearth Studio** menu (Online Studio for
  `/hearth-studio/`, Showroom Studio for `/showroom/`), the Shop menu, the footer, the home page,
  the sitemap and the search all lead here. `/veneer/` redirects here for good (301), and
  `/visualizer/` for now (307; Ben retired the room visualizer until this has stoves).
- The Phase 4 stove mapping is written but not wired in. Stoves can't go in until they have
  cutouts.
- **The app's files stay in `public/hs/` and ship with the site's files on Replit** (Ben, 28 Oct
  2026), not App Storage. About 124 MB, the biggest single file 11 MB.

## Where things are

| What | Where |
|---|---|
| The app (static, about 124 MB) | `public/hs/`: `index.html`, `js/`, `assets/`, `models/`, `vendor/`, `THIRD-PARTY-NOTICES.md` |
| Website page | `/hearth-studio/`, `src/app/hearth-studio/page.tsx`: the app framed full height |
| Showroom screen | `/showroom/`, `src/app/showroom/page.tsx`: the same app with `#showroom`, which locks showroom mode; noindex |
| No site header or footer on those two | `src/components/SiteChrome.tsx`, wrapped around the header, footer and trays in `src/app/layout.tsx` |
| Paint lookup (Phase 2) | `src/app/api/paint-lookup/route.ts` |
| Photo helper (Phase 2) | `src/app/api/find-surfaces/route.ts` |
| Stove catalog in section 7a's shape (Phase 4) | `src/app/api/hearth-studio/stoves/route.ts` (not in `HS_CONFIG` yet) |
| Cache headers | `next.config.ts` `headers()`: model and runtime for a year (`immutable`), assets for a day |

## Edits to the app's own files

**Re-apply these when a new version arrives from the Hearth Studio chat.** Only
`public/hs/index.html` was changed; nothing in `js/` was touched.

1. **Document skeleton at the top:** `<!doctype html>`, `<html lang="en">`, the charset and
   viewport tags. The claude.ai preview adds these itself; without them the page renders in quirks
   mode with an 8px margin and scrolls inside its frame.
2. **A block just before the `qrcode-generator` script:**
   - `window.HS_CONFIG = { paintLookupUrl: "/api/paint-lookup", findSurfacesUrl: "/api/find-surfaces" }`.
   - CSS that hides the switch's "Preview as" label and the attract screen's "Back to the website
     preview", and zeroes the body margin.
   - **The Website | Showroom switch goes between the two pages** (Ben, 28 Oct 2026: the shop's
     screen just runs the website, so staff need the switch there). A click handler, captured
     before the app's own, sends Showroom to `/showroom/` and the staff panel's "Switch this
     screen to the website" to `/hearth-studio/`. On `/showroom/` the app locks itself in
     showroom mode and hides the switch, so a customer at the shop's screen can't leave it and the
     idle reset always clears their photo. A reload keeps the mode.
   - On the website (not `#showroom`), a script that turns the top bar's badge and name into a
     link home (`target="_top"`), since the page has no site header. The same script stops the
     long-press staff panel there. The staff panel is the showroom screen's only.

To update: copy the new `js/` (and `assets/`, `models/`, `vendor/` if they changed) over
`public/hs/`. If `index.html` changed, copy it too and re-apply 1 and 2.

## Setup

- **`ANTHROPIC_API_KEY`**: Replit Secrets in production, `.env.local` in dev. Until it's set:
  - both routes answer 503 `not_configured`;
  - "Know the paint you want?" says it couldn't look the color up;
  - the photo helper asks the customer to tap the wall once, then finds the edges on the device.
- **Optional:** `PAINT_LOOKUP_MODEL` and `FIND_SURFACES_MODEL`. Both default to
  `claude-sonnet-5-5`; Haiku is decision 6 below.
- **How the two routes differ from the package's copies:**
  - Web search uses the current tool version, `web_search_20260209`.
  - A missing key gives a clean 503. The SDK only looks for credentials when a request goes out,
    and then raises a plain `Error`.
  - A declined request stops instead of being asked again. On Sonnet the API's server-side
    fallback (`fallbacks: "default"`) reruns the declines it can. Haiku has no fallback, so the
    parameter is left off for it.

## Checked, 28 Oct 2026

- **`/hearth-studio/` at 1440×900 and 390×844:**
  - The page fills the screen, in standards mode, with no site header or footer.
  - The badge links home.
  - Later the same day: Website | Showroom opens `/showroom/` (locked, switch hidden), and the
    staff panel's switch back opens `/hearth-studio/`; no console errors.
- **Sample room:**
  - Tapping the chimney opens its stone card, and picking a stone changes the room.
  - 122 stones are listed.
  - The estimate shows square feet, corners, boxes and tons, and no prices.
- **Use my photo → sample photo:**
  - The call to `/api/find-surfaces` returns 503 without a key, and the app asks for one tap.
  - The on-device model (served from `public/hs/models`) then outlined what was tapped.
- **`/showroom/` at 1920×1080:**
  - The welcome screen shows with the big badge and no preview button.
  - Touch to Start enters showroom mode (Send to my phone, Ask for help, labelled tools).
- **Headers:**
  - `.wasm` goes out as `application/wasm` and `.mjs` as JavaScript.
  - The model and runtime are cached for a year, stone assets and renders for a day.
- **Not checked:**
  - the idle reset (10 minutes by default);
  - Save & share's download;
  - the paint lookup and Claude's look at a photo, which need the key.

## Open

- **Privacy page.** The site has none. The guide asks it to say that photos used in Hearth Studio
  may be analyzed by an AI service (Anthropic) to find the wall. The app's photo dialog already
  says Claude may look at it.
- **`hearth-studio-update-1.zip` (applied 28 Oct 2026):** its `js/app.js` (no 1 ft grid button)
  is in `public/hs/js/`, and its `INTEGRATION.md` and `BUILD-NOTES.md` replace the ones in
  `handoff/hearth-studio/` (the zip as received is in `handoff/hearth-studio-update-1/`). It
  didn't change `index.html`, so the edits above stand.
- **Old saved designs:** mock-ups from `/veneer/` and designs from `/visualizer/` still open at
  `/account/veneer/<id>` and `/account/designs/<id>`, with share links at `/d/<slug>`. The site
  was never live, so no customer has any; the code stays as the pattern for Phase 5.
- **"Ask for help" on `/showroom/`** isn't wired yet. Once it alerts staff (Phase 5), remember that
  anyone can open `/showroom/` from the website's switch, not just the shop's screen.
- **Speed:** `Cross-Origin-Opener-Policy` and `-Embedder-Policy` aren't set, so the photo model runs
  on one thread. Turning them on needs a check of the Google Fonts and cdnjs scripts first.
- **Seen in the app** (for the Hearth Studio chat):
  - With the chimney's card open, picking a stone from the strip changes the chimney, but the
    card's title keeps the old stone's name.
  - That card stays open over a customer photo after switching to "Use my photo".

## Phase 4: stoves, mapped (section 7a)

`GET /api/hearth-studio/stoves` returns the visualizer's catalog in section 7a's shape:
- 195 entries: 79 freestanding, 31 inserts, 85 built-in fireplaces.
- Active products only; pellet is left out (`NOT_SOLD_FUELS`).
- Names are the catalog's model names, as each maker writes them, with brands from the catalog.

What it has and what it lacks:

- **Cutouts: none of the 195.**
  - The stove visualizer has been drawing category silhouettes. Those aren't the product, so
    they're never sent.
  - No stove can stand in Hearth Studio until staff upload real cutouts. The guide's rules allow
    no scraped manufacturer photography.
- **Which way the photo faces (`view`) and the cutout's real width (`imageWidthIn`):**
  - Not recorded anywhere yet, so both are left out.
  - They need fields on the product admin, filled in with each cutout upload.
- **Sizes (width, height, depth from the maker):**
  - Freestanding stoves: 54 of 79 have all three; 4 have some, 21 none.
  - Inserts and built-in fireplaces: none have sizes yet.
  - Freestanding stoves missing one or more:
    - **Blaze King:** Ashford 20.2, Ashford 30.2, Boxer 24, Chinook 30.2, King 40, Princess 32 (PE32),
      Sentry S14 (height only), Sirocco 20.2, Sirocco 30.2
    - **HearthStone:** Bari (height only), Bari Plus (height only), Champlain, Craftsbury (no depth),
      Shelburne, Stowe, Waitsfield DX
    - **Pacific Energy:** Alderlea T4 Classic LE2, Alderlea T4 LE2, Neo 1.6 LE2, NeoView 2.5 LE2,
      Vista Classic LE2, Vista LE2
    - **True North:** TN10, TN20, TN25c
  - Under the update's stove-size rules (7c), a stove without a size is still drawn, at a typical
    size by eye, and its card says so. So sizes no longer block a stove; cutouts do.
  - The update's 7d adds a sizing step to the stove admin, where cutouts are uploaded: the maker's
    three sizes, two markers on the cutout for `imageWidthIn`, and a check on the lake cabin's
    empty hearth. Not built yet.
- **`onDisplay`:** Steve hasn't marked any model "On our showroom floor" yet, so all are false.
- **`flue` and `glassBox`:** not on file. The app's defaults apply (top flue for wood, rear for gas).
- **No prices.**

## Decisions (INTEGRATION.md section 9)

**Made, 28 Oct 2026 (Ben):**
- Every stove gets a Stove size control; exact sizes come from staff sizing each image (7c, 7d).
- No 1 ft grid button.
- The app's files live in the site's files on Replit, not App Storage.
- `/veneer/` and `/visualizer/` are retired in favour of `/hearth-studio/`.
- The Website | Showroom switch stays on the website, since the shop's screen runs the website.

**Still open**, for Ben and Steve:

1. Kiosk "Send to my phone" links work without signing in. Should they expire after 30 days?
2. The estimate's 0.5 sq ft of flats per foot of corners and 10% allowance (Steve).
3. Show box counts and tons, or square feet only?
4. Which Buechel stones the store stocks and displays.
5. The microphone button on the showroom screen.
6. Paint-lookup model: Sonnet (default) or Haiku.
7. Let Claude look at customer photos (default), or keep photos on the device.
8. Which stoves to show, and whether to mark "On display in our showroom".
