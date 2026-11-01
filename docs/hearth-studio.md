# Hearth Studio on the site

Hearth Studio is the stone and stove visualizer Ben built in a separate Claude chat, as the better
version of `/veneer/`. It arrived on 28 Oct 2026 as `hearth-studio.zip`, unpacked to
`handoff/hearth-studio/`, which is kept out of git through `.git/info/exclude`. Its
`INTEGRATION.md` is the plan, in five phases.

**Since 1 Nov 2026 Hearth Studio is built here, sample-room renders included** (Ben: "let's get it
dialed here so we're doing the best in the same spot. I can use chat as an outside check every so
often").
- The chat's Blender build is in `hearth-studio-build/` (its README says how it runs here). Python
  3.11 and bpy 5.0.1 are installed for this computer's user, in `var/blendenv`.
- The first thing made with it is the family room's empty wall (`open`), for catalog fireplaces of
  any size.

**State, 28 Oct 2026 (branch `hearth-studio`, uncommitted):**
- Phases 1 and 2 are done, and updates 1 to 3 from the Hearth Studio chat are applied (below).
- It's live in the site's navigation: the bar's **Hearth Studio** menu (Online Studio for
  `/hearth-studio/`, Showroom Studio for `/showroom/`), the Shop menu, the footer, the home page,
  the sitemap and the search all lead here. `/veneer/` redirects here for good (301), and
  `/visualizer/` for now (307; Ben retired the room visualizer until this has stoves).
- **Phase 4: the stove layer works in the lake cabin**, with five stoves so far: the Morsø 7110 B,
  6140 B with low base and 6148 B on pedestal, and the Jøtul F 445 Holliday and F 602 V3. All are
  drawn at the maker's width and height.
  - `hearth-studio-update-2.zip` added it and `-update-3.zip` links each stove card to the stove's
    own page here (`pageUrl`); both were applied 28 Oct 2026.
  - The Hearth Studio chat builds most of the app; next there: stoves on customer photos (7c).
    Changes made here, like the stove card (tap the stove to edit it), are merged into each of its
    updates (see "Edits to the app's own files").
  - **Built-in fireplaces in the family room** (31 Oct 2026, Ben: "do the same with the Sample
    Room family room"). Eight so far, each drawn at its viewing area's size:
    - Mendota's ML48 Décor, ML48 FireIn and ML48 Timberline (47⅞″ × 19½″);
    - Mendota's ML54 Décor and ML54 Timberline (55⅛″ × 19½″);
    - Mendota's ML60 Décor and ML60 Timberline (61⅛″ × 19½″);
    - Kozy Heat's Nordik 60 TL (60″ × 20″).

    Since 1 Nov 2026 they go on the room's **empty wall**, rendered here, so any size fits. The
    room's own fireplace stays as the sample. See "Phase 4" below.
  - **The round Morsøs' pipes come out of the top opening** and every pipe is black (31 Oct 2026,
    Ben). See edit 3, "The stovepipe".
  - **A third sample room for inserts: the lake house den** (1 Nov 2026; Ben chose "the insert
    options" next). Built and rendered here (`build_masonry()`, `hearth-studio-build/README.md`).
    - **The room:** a masonry fireplace with a 34 × 24 in opening on an 8 in raised hearth, an open
      wood fire, and Cabin Creek River Rock on the breast and hearth by default.
    - **In the app:** the room `masonry`, with `inserts: true`. Our inserts are drawn flat over the
      opening, standing on the firebox floor (`fireSpot.anchor: "floor"` in `placeFace()`). Each has
      to cover the opening. The tab, card and panel say "Insert".
    - **Two inserts so far (1 Nov 2026, dev data only), sized by their surrounds.** An insert's
      box is its surround's outer edges, and its size the manual's surround size. Their glass
      didn't work: the overlay or frame hides part of it, so the photos were 4–7% off.
      - **Pacific Energy Neo 1.6 Insert LE2:** the regular surround, 37″ × 26¾″ (manual p. 14).
        The photo (maker's, transparent) is trimmed to 794 × 575. The surround is at 2.0, 3.6 to
        791.0, 570.4, 0.64% off that shape. The glass is at 233, 233 to 564, 439.
      - **Pacific Energy Vista Insert LE2:** the regular surround, 37″ × 28″ (manual p. 14; the
        manual's "965mm" beside 37″ is 38″, and the photo fits 37″). Trimmed to 789 × 615, the
        surround is at 0.7, 3.7 to 785.8, 601.3 (−0.58%). The glass is at 234, 276 to 558, 468,
        inside the nickel door frame so the frame doesn't glow.
      - **How they were measured:** the half-opacity edge, the median over many rows and columns.
        The bottom is where the side panels end. The ash lip stands 5–7″ in front of the surround,
        so it shows ½″ lower in the photo; the makers' drawings measure the height to the
        surround's bottom.
      - Both fit the den's fireplace by their manuals' minimum openings (30 × 21 × 17 and
        24½ × 21 × 17 in), and both surrounds cover its 34 × 24 in opening.
      - **Not yet:**
        - Neo 2.5 Insert (1.4% off its 41″ × 28″, tilted photo) and Super Insert (4.5–7%).
        - Alderlea T5 Insert (its surround table doesn't read clearly).
        - TN20 (6% off its 38″ × 27″).
        - Jøtul C 550 (the photo's surround is one of three, 0.7% or 1.6% off).
        - Jøtul GI 535/545/635/645: the manuals give the overlay's largest opening, not its
          size.
        - Morsø 5660: the front (27.95″ × 23.07″) doesn't cover the den's opening.
        - Kozy Heat, HearthStone and Blaze King: no straight-on photo on its own.
    - **The light on an insert's front:** the opening isn't a zone. `post.py` used to fill it with
      the nearest surface's light, so the hearth face's made a dark wedge on the front.
      `opening_fill()` now carries the breast's light across it row by row. Only the den's two
      `_irr.png` changed. The front also doesn't take the room's open-fire flicker
      (`steady`: `uUseFire` off in the face pass); its own glass fire still flickers.
    - **`placeFace()`** stands an insert's box bottom on the firebox floor (it was the photo's
      lowest point, the ash lip). The card says "37″ × 28″ surround" (`makerSize()`), and
      `scripts/set-stove-cutout.mjs face` takes inserts.
    - **"See it in a room"** on an insert's model page and in its column on the compare page
      (`studioStoveFor()` in `src/lib/hearth-studio.ts` takes inserts with a surround). It opens
      the den with the insert in.
  - **An easier way in** (1 Nov 2026, Ben). One **Stoves & fireplaces** tab lists everything, in
    every room; picking one goes to the room that shows it, already in place. A first-visit
    **"What would you like to see?"** goes straight to stone, a stove, a fireplace, an insert or
    your own photo. See edit 3, "The easier way in".
  - Next here: 7d, the staff sizing step on the stove admin.
  - Notes for the chat from testing: `handoff/hearth-studio-notes-3/` (`MESSAGE.md` and a picture).
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
| Stove catalog in section 7a's shape (Phase 4) | `src/app/api/hearth-studio/stoves/route.ts`, as `HS_CONFIG.stoveCatalogUrl` |
| Packages for the Hearth Studio chat (git-excluded) | `handoff/hearth-studio-stove-test/` and `.zip` (the 7110, sent), `handoff/hearth-studio-notes-3/` (testing notes) |
| Its updates as received (git-excluded) | `handoff/hearth-studio-update-1/`, `-2/`, `-3/`; `handoff/hearth-studio/` is the whole package with all three applied |
| Cache headers | `next.config.ts` `headers()`: model and runtime for a year (`immutable`), each stone's textures for a day, everything else checked on every load |

## Edits to the app's own files

**Re-apply these when a new version arrives from the Hearth Studio chat.** Items 1 and 2 are in
`public/hs/index.html`. Item 3 is in `js/app.js` and `css/stoves.css`, since 28 Oct 2026.

1. **Document skeleton at the top:** `<!doctype html>`, `<html lang="en">`, the charset and
   viewport tags. The claude.ai preview adds these itself; without them the page renders in quirks
   mode with an 8px margin and scrolls inside its frame.
2. **A block just before the `qrcode-generator` script:**
   - `window.HS_CONFIG = { paintLookupUrl: "/api/paint-lookup", findSurfacesUrl: "/api/find-surfaces", stoveCatalogUrl: "/api/hearth-studio/stoves" }`
     (`stoveCatalogUrl` since 28 Oct 2026, read by update-2's stove layer).
   - `estimate: false` in `HS_CONFIG` (28 Oct 2026): keeps the stone estimate from customers
     ("Still open", item 2). `SHOW_ESTIMATE` in `js/app.js` reads it (part of edit 3).
   - CSS that hides the switch's "Preview as" label and the attract screen's "Back to the website
     preview", and zeroes the body margin.
   - `[hidden] { display: none !important; }` (28 Oct 2026). The app hides its loading spinner and
     its messages with the `hidden` attribute, but their own `display` rules overrode it. So the
     spinner sat in the middle of the picture for good, right on the stove, and messages never
     went away. Reported to the chat; keep the line until an update fixes it at the source.
   - **The Website | Showroom switch goes between the two pages** (Ben, 28 Oct 2026: the shop's
     screen just runs the website, so staff need the switch there). A click handler, captured
     before the app's own, sends Showroom to `/showroom/` and the staff panel's "Switch this
     screen to the website" to `/hearth-studio/`. On `/showroom/` the app stays in showroom mode
     and hides the switch. A reload keeps the mode.
   - **The badge links home on both pages:** a script turns the top bar's badge and name into a
     link home (`target="_top"`), since these pages have no site header.
     - **`/showroom/` isn't locked** (Ben, 28 Oct 2026). It's likely to be the shop screen's home
       page, and staff use the rest of the site from it while they talk with people.
     - The staff panel is the showroom's only. There, a press held past a tap (the app opens the
       panel at 1.4 s) or a shift-click opens it without following the link.
     - After a long press, the click from lifting the finger is ignored. Otherwise it lands on the
       panel's backdrop and closes it again (seen with touch).
     - On the website the press never reaches the app's handler.
     - Leaving `/showroom/` drops whatever a customer had loaded, since showroom mode saves nothing
       on the device.

3. **The stove card** (Ben, 28 Oct 2026). Tapping the stove opens a card on the picture, like an
   area's card. Before, it only switched the side panel to the Stove tab, and on a phone that
   scrolled the picture off screen.
   - **What the card does:**
     - It holds the stove, the maker's size, the size control (kept in step with the Stove
       tab's), Change stove, Back to the maker's size, No stove, the clearances note and More
       about this stove (the QR button in the showroom).
     - It uses the area card's placement, dragging and phone layout, kept off the stove. In a
       narrow window it docks at the top of the picture, not the bottom where the stove stands.
     - With a stove on the hearth, the first-visit hint names the stove too.
     - **Sample stoves can be tapped too.** They get a shorter card: the name, "Drawn for scale,
       not a specific model.", Change stove and No stove. A sample stove is part of the room's
       picture, so its outline comes from the masks: where the empty-hearth picture's surfaces
       show and this one's don't. No new files.
     - **Stove size folds away** (Ben). It's a row with the size and a chevron, in the Stove tab
       and in the card. It's closed when the page loads, then open or closed in both places
       together until the next load.
   - **In the code (`js/app.js`):**
     - the card: `STOVE_CARD`, `stoveCardHTML()`, `renderCard()` with its placement split out as
       `placeCard()`, `areaCover()`, `cardActions.cardstoves`;
     - taps and hovers: the stove branches of `tapAt()` and `hoverAt()`, `prepSampleStove()` (run
       from `setRoom()`), `sampleStoveAtUV()`;
     - the size control: `stoveSize()`, the `toggle` listener after it, the fold in
       `stoveDetail()`;
     - also: the end of `pickStove()`, the hint in the caption, and `boot()` reading `?stove=`.
   - **"See it in a room" on stove pages** (Ben, 28 Oct 2026). It's on a model's page, beside Save
     and Compare, only when Hearth Studio has that stove (`studioStoveFor()` in
     `src/lib/hearth-studio.ts`: an active freestanding stove with a cutout, or since 31 Oct 2026 a
     built-in fireplace with a cutout and its viewing area).
     - It opens `/hearth-studio/?stove=<id>`, and the page passes `?stove=` to the app.
     - The app puts that stove on the cabin's hearth with the Stove tab open, over whatever the
       visitor had saved. A fireplace goes in the family room's wall, with the Fireplace tab open.
     - It's on the page of every stove with a cutout (five on 30 Oct). Each stove that gets one
       gains it.
   - **Styles:** the fold, the card's rules, and the sample tiles in `css/stoves.css`.
   - **The fire window lights only fire (`js/engine.js`, one line in the stove shader):**
     - Inside `glassBox`, only pixels bright enough to be fire are drawn as fire. The door's iron
       inside the box is lit like the rest of the stove: an arched window's top corners, or a grille
       over the glass.
     - Before this, the Jøtul F 445's arched window glowed as a rectangle in the evening.
     - The 7110 looks the same, apart from darker dark glass.
   - **Stove heights (`js/stoves.js`, `js/engine.js`, `js/app.js`, 30 Oct 2026):** each photo is
     fitted up in two parts, the front to the maker's height and the top to the room's camera, from
     `imageTopFront`. See "Phase 4" below for how, and how it was checked.
   - **The stovepipe (`js/stoves.js`, `placeInRoom()`, 30 Oct 2026):**
     - A flue collar found in the photo places the pipe and sets its width, as before. The 7110's
       pipe is 0.4″ off center, 5.9″ across.
     - Without a collar, the pipe stands on the stove's center line and is 7b's 6″ pipe. The old
       guesses were made from the photo's top edge, which is the back of the stove. They put the
       F 445's pipe 5.3″ off center, and made the narrow 6140's pipe only 4¼″ across, a quarter of
       its width.
     - Ben first asked for every pipe on the center line, then chose the photo's collar where there
       is one.
     - **Out of the top opening (`imageFlue`, 31 Oct 2026, Ben: "make the stove pipe go out the
       top opening"):** the 6140's and 6148's photos show the top outlet's blanking plate, not a
       collar.
       - On the stove's center line, the pipe came up about 3½″ to one side of the drawn top, so it
         looked as if it rose from behind. Their photos are straight on, but the cabin's camera
         sees the stove from 15° to the side, so a pipe placed in the room didn't line up with
         the photo.
       - Now the pipe stands where the drawn stove shows the plate, at the plate's depth on the
         top. It's cut flat there and drawn over the top (`uPipeTop` in `engine.js`).
       - A collar in the photo still wins, so the 7110 is unchanged.
       - From the cabin's eye height (1.22 m) the 6140's top is 2″ below eye level and the 6148's
         5½″ above it. So the 6148's top plate hides the very bottom of its pipe, as it would in a
         photo taken from there.
     - **Black (31 Oct 2026, Ben: "it's looking real grayish"):** the pipe and the trim ring had
       been about twice as light as the stoves' own black.
       - The pipe's color went from 0.018 to 0.008 and its sheen from 0.03 to 0.012.
       - The ring's went from 0.03 + 0.02 at the rim to 0.012 + 0.008.
   - **Built-in fireplaces in the family room (31 Oct 2026):** a catalog fireplace's front is drawn
     flat on the bump-out, over the room's own fireplace, at the maker's viewing-area size.
     - **The room's data:** `assets/scenes/linear/scene.json` gained a `camera` and a `fireSpot`
       (the wall's plane, the middle of the room's own viewing area, and the box its fireplace and
       trim take up). Both are worked out from `build_linear()` in the chat's `build/scenes.py`.
       The camera was checked by drawing the bump-out and the fireplace's opening over the
       picture. **An update that brings a new `linear/scene.json` drops them:** add them back, or
       better, ask the chat to write them in its build.
     - **`js/stoves.js`:** `viewingBox` and `viewingIn` in `normalize()`; `loadCatalog()` keeps
       fireplaces that have them; `placeFace()` (the map from the picture to the photo, the screen
       box, and whether the front covers the room's own fireplace); `kindWord()`, and fireplace words
       in `fuelWord()` and `makerSize()`.
     - **`js/engine.js`:** the stove pass draws a fireplace's front (`uFace`, `uFaceH`) without the
       stove spot. It's lit per pixel by the room's own light map, so the sun patch carries across
       it. Behind the glass, the flames are the photo's own and the firebox is lit by them (a light
       liner drawn as fire, the stoves' way, glowed like a lamp in the evening).
     - **`js/app.js`:** the room's `fireplaces: true`, `fitsRoom()`/`catalogFor()` (stoves for the
       cabin, fireplaces for the family room), `fireplaceLook()`, the face branch of `stoveAtUV()`,
       the room's own fireplace as a tappable sample (`prepSampleStove()`), the Fireplace tab
       (`fireplacePanel()`), the card's fireplace words ("Change fireplace", "The room's own"; no
       size control), "Fireplace: …" under a saved picture, and `?stove=` opening the family room
       for a fireplace.
     - **`css/stoves.css`:** the room's own fireplace's sample tiles (`.s-linear`).
     - With no fireplaces in the list, the family room is just as it was.
   - **The family room's empty wall (1 Nov 2026, rendered here):**
     - **The picture:** `assets/scenes/linear/open_*` and `variants.open` in its `scene.json`, made
       with `hearth-studio-build/`.
     - **`js/app.js`:**
       - `{ id: "open", label: "No fireplace", noFire: true }` in the room's variants, after
         `linear`, which stays first because it's the room's own (the sample).
       - With a catalog fireplace in, `onOpen()` and `effectiveVariant()` show the empty-wall
         picture, and `fireplaceLook()` takes a front of any size on it.
       - The room's own picture still needs a front that covers its fireplace; a room without an
         `open` picture is as before.
     - **Wording, in `js/app.js` too:**
       - `stoveNow()` gives the variant's own label for `open` ("No stove" or "No fireplace").
       - The room panel's eyebrow and note go by `fireplaces`, not by the number of variants
         (the family room has two now).
     - **"Pellet" taken out of the app's text** (Stoveworks doesn't sell pellet, Ben):
       - The note "Ask us about the wood, gas and pellet models we carry" now reads "Ask us about
         the models we carry".
       - Send to the store's heat sources no longer list "Pellet stove".
   - **The lake house den, for inserts (1 Nov 2026, rendered here):** the room `masonry` in
     `ROOMS`, with `inserts: true`, and its pictures in `assets/scenes/masonry/`.
     - **`js/stoves.js`:** inserts are `sized` and kept like fireplaces (`viewingBox`,
       `viewingIn`), with insert words in `fuelWord()` and `kindWord()`. `placeFace()` stands an
       insert on the opening's floor (`fireSpot.anchor: "floor"`).
     - **`js/app.js`:** `faceRoom()` (fireplaces or inserts), `fitsRoom()` for inserts, and the
       den in `S.variant`, `persist()` and the resets. An insert's front has to cover the opening,
       since the den has no `open` picture.
   - **The easier way in (1 Nov 2026; Ben: "if they just have a stove/fireplace/insert/etc in
     mind, how they could just easily see an example … without having to dig around by going to
     sample rooms").**
     - **One Stoves & fireplaces tab, the same in every room.** It lists all of ours: stoves,
       fireplaces and inserts, with a search box and a pill for each kind that has any. Each kind
       says which room shows it, and the room on screen's kind comes first. Picking one from
       another room goes to that room with it in place (`showInRoom()`, from `pickStove()`). Below
       the list is the room's own: the cabin's No stove and sample stoves, the family room's
       fireplace, the den's open fire.
     - **"What would you like to see?"** (`openWelcome()`): stone on a fireplace or wall, a stove,
       a fireplace, an insert (only when some are listed), or stone on your own photo. A kind
       opens its room with the list showing that kind. It shows on a first visit to the website
       (not from a stove's "See it in a room" link), after Start over (Undo closes it), at the
       start of each showroom session, and from the Room tab's "What would you like to see?".
     - **`js/app.js`:**
       - `KINDS`, `kindRoom()`, `prodMatches()`, `stovePanel()` (now the one list),
         `prodKinds()`, `prodResults()`, `refreshProducts()`, `roomOwn()` (replaces
         `fireplacePanel()`), `showInRoom()`, `openWelcome()`, `welcomePick()`;
       - `S.prodQ`, `S.prodKind`, and the actions `prodkind`, `prodclear`, `welcome`,
         `welcomeopen`;
       - the welcome's triggers in `boot()` (`hs.welcomed` in storage), `startOverWeb()` and
         `exitAttract()`;
       - `resetKiosk()` clears the search;
       - the card's Change button scrolls to its kind.
     - **Search folds accents** (`normQ()`, the stone search's too): "morso" finds Morsø, "jotul"
       Jøtul, "decor" Décor.
     - **`css/stoves.css`:** the chooser (`.wpicks`, `.wpick`), `.prodgroup .where`, and the
       den's sample tiles (`.s-masonry`).
   - **Also in it:** `sceneEntry()` fetches the room's `scene.json` with `cache: "no-cache"`, so it
     always matches the app. A browser holding the copy from before update-2 drew no stove: Ben's
     own browser on 28 Oct, after the pane. That copy had been cached for a day under the old
     header rule.
   - **The patch:** `handoff/hearth-studio-notes-3/stove-card.patch`. It's against update-3, and
     against update-2 for `engine.js`, which update-3 didn't change. It's sent to the chat to build
     on.

To update: apply the zips in order (each `UPDATE-N.md` says what it goes on top of and lists every
changed file). Copy the changed `assets/` files (and `models/`, `vendor/` if they changed) over
`public/hs/`. Leave out `assets/stoves/`: it's the preview's stove list, and the site serves its
own. A new `assets/scenes/linear/scene.json` without `camera` and `fireSpot` needs them added back
(item 3).
- **Changed `js/` and `css/` files:**
  - Unless the update says it already has item 3, merge them instead of copying. Run
    `git merge-file public/hs/js/app.js <the last update's app.js> <the new app.js>`, and the same
    for `js/stoves.js`, `js/engine.js` and `css/stoves.css`. Each file's base is the last update
    that had it (`engine.js`: update-2). That keeps item 3 and takes the chat's changes; fix any
    conflicts it
    marks.
  - Other changed files can be copied.
- **If `index.html` changed:** copy it too and re-apply 1 and 2.

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
  - The model and runtime are cached for a year. That evening the rest changed: see below.
- **Not checked:**
  - the idle reset (10 minutes by default);
  - Save & share's download;
  - the paint lookup and Claude's look at a photo, which need the key.

## Checked, 28 Oct 2026 evening: updates 2 and 3

- **Headless Chrome at 1440×900** (the software renderer and the Intel graphics card), **and the
  browser pane:**
  - **The Stove tab:** the 7110's card with the maker's size, No stove, and the two sample stoves.
  - **Picking the 7110:** it stands on the cabin's hearth, with its pipe and elbow into the chimney
    and a contact shadow. In the evening it's dark and warm, with the fire window glowing.
  - **Stove size:** at the top (149%) the card reads "Drawn about 34 in wide and 39 in tall, set
    by eye", and the pipe follows. "Back to the maker's size" resets it.
  - **No stove and before/after:** No stove in the evening has no fire glow. Before/after keeps the
    stove on both sides.
  - **Save & share:** the picture (1800 × 1431) shows the stove, and its summary ends "Stove: Morsø
    7110 B".
  - **More about this stove:** opens `/brands/morso/7110-b/` in a new tab. On `/showroom/`, "More
    about this stove on your phone" shows a QR code and the address.
  - No console errors.
- **Found and fixed here:**
  - **The day cache on all of `/hs/assets/`:** a browser that had the cabin open earlier kept the
    old `scene.json` with the new app, so no stove was drawn. Now only stone textures keep a day.
  - **The spinner and messages never hid:** fixed by the `[hidden]` line above.
- **Found, for the chat** (`handoff/hearth-studio-notes-3/`):
  - a speckled sun patch on the wall right of the firewood, with the 7110 in daylight;
  - `STORE.site` (`haywardstoveworks.com`) isn't the site's address, which stays stoveworksinc.com
    (Ben).

## Open

- **Privacy page.** The site has none. The guide asks it to say that photos used in Hearth Studio
  may be analyzed by an AI service (Anthropic) to find the wall. The app's photo dialog already
  says Claude may look at it.
- **Updates 1 to 3 (applied 28 Oct 2026):**
  - **Update-1:** `js/app.js`, without the 1 ft grid button.
  - **Update-2, the stove layer:** `js/engine.js`, `js/stoves.js`, `css/stoves.css`, the cabin's
    `scene.json` and `open_shade.png`.
  - **Update-3, the links to our stove pages:** `js/app.js`, `js/stoves.js`, `css/stoves.css`.
  - Their `INTEGRATION.md`, `BUILD-NOTES.md` and build scripts are in `handoff/hearth-studio/`.
  - None changed `index.html`, so the edits above stand.
- **The store's web address in the app:** `STORE.site` in `js/app.js` is `haywardstoveworks.com`.
  - The site stays at stoveworksinc.com for now (Ben, 28 Oct 2026).
  - The share text and the `/d/` and `/up/` phone codes use `STORE.site`; the codes are previews
    until Phase 5.
  - The stove links don't use it: the site sends them as full addresses.
  - The notes for the chat ask it to read `HS_CONFIG.site` and fall back to stoveworksinc.com.
  - When that update arrives, add `site: location.host` to `HS_CONFIG` in our block, so the
    address is right on the live domain and on the Replit test address.
  - Until then, the share text names the wrong address. Nothing is live yet, so it can wait.
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
  - With the 7110 in daylight, the sun patch on the wall right of the firewood turns speckled
    (sent in `handoff/hearth-studio-notes-3/`).
  - Tapping the stove only switched the panel to the Stove tab. That's fixed here: the stove card,
    edit 3 above, also sent to the chat as a patch.

## Phase 4: stoves, mapped (section 7a)

`GET /api/hearth-studio/stoves` returns the stoves Hearth Studio can draw, in section 7a's shape.
`HS_CONFIG.stoveCatalogUrl` points at it.
- **Only stoves with a cutout are listed:** five stoves by 30 Oct 2026 and one fireplace by 31 Oct,
  below. `?all=1` lists all 195: 79 freestanding, 31 inserts, 85 built-in fireplaces.
- Active products only; pellet is left out (`NOT_SOLD_FUELS`).
- Names are the catalog's model names, as each maker writes them. Brands are spelled the site's
  way (Jøtul, Morsø), from `src/content/brands.ts`.
- **Facts about each cutout** live in product columns (`db/schema.sql`), which `brain:load` never
  touches: six for stoves, and two more for built-in fireplaces (below). They go out only with a
  cutout:
  - `cutout_view` → `view`;
  - `cutout_span` → `imageSpan`, where the maker's width runs across the photo, as fractions. This
    is the site's addition to 7a: it's 7d's two markers;
  - `cutout_width_in` → `imageWidthIn`;
  - `glass_box` → `glassBox`;
  - `cutout_top_front` → `imageTopFront` (30 Oct 2026, also the site's addition): the row where the
    stove's top meets its front, at its middle, as a fraction of the photo's height. That's the top
    of the maker's height;
  - `cutout_flue` → `imageFlue` (31 Oct 2026, the site's addition): where the photo shows the top
    flue outlet with a blanking plate on it (no collar), [x, y] as fractions. The pipe stands on
    the top there.
- **How the sizes are fitted** (30 Oct 2026, Ben: "make sure they're accurate sizes on these sample
  images", as the base for customer photos).
  - **The problem:** makers shoot from above, so their photos show more of the top than the
    cabin's camera at 1.22 m does. Scaling by the width alone drew the 7110 about 16% too tall
    overall, the F 445 15%, and the 6140's front 7% short.
  - **Across:** one scale, from the span.
  - **Up:** two parts. The front (floor to the top's front edge) is fitted to the maker's height,
    and the top to what the room's camera sees of it (`placeInRoom()`'s `ymap`, the shader's
    `uCutY`/`uCutR`, and the reverse in `stoveAtUV()` for taps). The top's front edge goes where
    the stove's middle is, and the feet on the hearth where they stand.
  - **Checked:** each stove's maker-size front outline, drawn over its render in the cabin, meets
    its top edge, front corners and feet.
- **`pageUrl`** is the stove's own model page here, as a full address from `SITE_URL`, since the
  showroom puts it on a phone as a QR code. It's sent only when the model has a page (the model
  page's own rule; 187 of the 195 do). The maker's page (`productUrl`) isn't sent: stove cards
  link to our pages, never the maker's (Ben, 28 Oct 2026).

**The Morsø 7110 B (the test stove, 28 Oct 2026):**
- **Cutout:** Morsø's own product photo, from the catalog. Ben confirmed that day that the makers'
  photos may be used. It was trimmed exactly as an admin upload is (`storeProductCutout`): 689 × 832.
- **Facts, measured on the trimmed photo:**
  - `front` view, with a sliver of the left side, the side the cabin's camera sees.
  - Span 0.196 to 0.997: the top plate's front corners, taken as the maker's 22.63″.
  - Top front at row 111 of 832 (0.133), the top plate's front edge, below the flue collar. Since
    30 Oct the stove is drawn its maker's height too. It had been drawn about 16% too tall overall,
    because the photo was taken from higher than the cabin's camera.
  - Glass box [0.364, 0.221, 0.843, 0.565].
  - Flue collar at the top edge, about 35–56% across.
- **It's dev data only:** the file is in `var/uploads/media/products/` and the row is in local
  PGlite. On the live site, upload the cutout again at `/admin/products/…` and set the four
  facts. There's no admin field for them yet: that's 7d's sizing step, still to build, here on
  the site side.

**The Jøtul F 445 Holliday (the second stove, 28 Oct 2026, Ben's ask; dev data only, like the
7110):**
- **Cutout:** Jøtul's own photo (1000 × 1000, transparent), trimmed to 574 × 633.
- **View `front`:** it's from about 15° left, the cabin camera's own angle. The stove is 25″ deep,
  so more of its left side shows than the 7110's.
- **Span 0.206 to 0.991:** the top plate's front corners, pixels 118 to 569, for the maker's
  26¼″.
  - The body is narrower (pixels 130 to 546).
  - The ash lip near the floor is about as wide as the top plate.
  - Left of pixel 118 is the stove's side, going back.
- **Top front at row 46 of 633 (0.073):** the top plate's front lip. It had been drawn about 15%
  too tall overall.
- **Glass box [0.361, 0.186, 0.836, 0.545]:** around the whole arched window. With the fire-only
  line in `engine.js` (edit 3), the arch's corners and the grille stay iron.
- **Flue:** no collar shows in the photo, so it gets a 6″ pipe on its center line (edit 3).
- **Checked in the cabin:** day and evening, its card, and switching with the 7110 both ways
  (the summary follows).

**The Morsø 6140 B with low base (the third stove, 30 Oct 2026; Ben: "whatever works best"; dev
data only):**
- **Why this one:** it's round, so it looks the same from the cabin camera's angle as from any
  other, and its flue is in the middle of the top.
  - Kuma's photos (Ashwood, Aspen, Tamarack) show a pipe stub to place the pipe from, but all three
    are shot from the right.
  - Of the left-side photos, only the Morsø 2B Standard shows a collar, and it's shot at a much
    steeper angle than the camera's.
- **Cutout:** Morsø's own photo, trimmed to 448 × 788.
- **Span 0.002 to 0.998:** the top plate's rim, its widest part, for the maker's 17¾″.
- **Top front at row 57 of 788 (0.072):** the front of the top's rim. Its front had been drawn 7%
  short. It looked a little small to Ben next to the other two, which were then too tall.
- **Glass box [0.179, 0.266, 0.808, 0.647]:** the whole window.
- **Flue:** no collar in the photo, so a 6″ pipe.
  - The 6100 series has a top and a rear outlet, each with a round blanking plate from the factory
    (Morsø's manual, 1.3).
  - The photo shows the top plate's: a 6½″ ring, its middle at pixels 223, 27.5. That's `imageFlue`
    [0.498, 0.035], set 31 Oct 2026, so the pipe comes out of the top opening.
- **Checked in the cabin:** day and evening. Its page has "See it in a room".

**Two more, 30 Oct 2026 (Ben: "add a couple more"); both dev data only, and both checked against
their maker-size outline in the cabin:**
- **Jøtul F 602 V3** (12⅝″ × 25¼″ × 21¼″: narrow and deep):
  - Jøtul's photo from the left, trimmed to 383 × 621.
  - Span pixels 98 to 372 (0.256 to 0.971): the top plate's front corners. Left of 98 is the
    plate's left side.
  - Top front at row 28 (0.045).
  - Glass box [0.488, 0.193, 0.828, 0.414]: the diamond-grille window. The grille stays iron.
  - No collar, so a 6″ pipe on the center line.
- **Morsø 6148 B on pedestal** (17¾″ × 37⅜″ × 15¼″, round like the 6140):
  - Morsø's photo, trimmed to 366 × 805.
  - Span the rim, pixels 1 to 365.
  - Top front at row 48 (0.060), the rim's top edge.
  - Glass box [0.180, 0.217, 0.809, 0.524].
  - No collar, so a 6″ pipe. The top's blanking plate is at pixels 182.5, 23.5: `imageFlue`
    [0.499, 0.029] (31 Oct 2026).

**Adding the next stove** (until 7d), with `scripts/set-stove-cutout.mjs`:
1. Run `trim` on the maker's transparent photo. It trims exactly like an admin upload.
2. Measure on the trimmed photo:
   - the span: for a front view, the top plate's front corners;
   - the fire window's box;
   - the top's front edge: the row at the stove's middle where the top surface meets the front,
     the top of the maker's height. It's below any flue collar. On a round stove it's the front of
     the top's rim.
3. Stop the dev server, run `set` with the product's slug (the top front is its last value), then
   start the server again. For a stove already set up, `top <slug> <row>` adds the top front.
4. Pick a photo that's front-on, or from the left like the cabin's camera, or a round stove. A
   photo from the right shows the wrong side, and mirroring one would put the door's handle on the
   wrong side.
5. The pipe:
   - A flue collar showing in the photo places it best.
   - When the top shows the outlet capped instead (a blanking plate), run `flue <slug> <x,y>`
     with the plate's middle in pixels. The pipe then stands on the top there.
   - With neither, it's a 6″ pipe on the center line.

**Built-in fireplaces in the family room (31 Oct 2026; Ben: "do the same with the Sample Room
family room and the insert options. Start with one that would work well").**
- **How it's drawn:** a fireplace is a flat front in the wall, so its photo, taken straight on, is
  mapped onto the bump-out's face. Its viewing area (what shows inside the front) is drawn at the
  maker's published size, centered where the room's own fireplace's is. There's no size control:
  the size is the maker's.
  - **The empty wall (1 Nov 2026):** with one of ours in, the room shows its `open` picture, the
    same room rendered with no fireplace, so a front of any size fits.
  - **Before that** it went over the room's own, so it had to cover it (53.7″ × 18.3″ with its
    trim), and smaller ones were refused. That rule still applies to a fireplace room that has no
    `open` picture.
- **The facts** live in two more product columns: `viewing_box` → `viewingBox` (where the viewing
  area is in the photo, as fractions) and `viewing_in` → `viewingIn` (its size in inches, wide and
  tall). The card shows "55⅛″ × 19½″ viewing area" as the maker's size.
- **The Mendota ML54 Décor (dev data only):**
  - **Why this one:** Mendota's photos are transparent and straight on, and the ML54's front
    (about 58″ × 22½″) covers the room's own with about 2″ to spare all round. The ML48's
    wouldn't; the ML60's would.
  - **Viewing area 55⅛″ × 19½″,** Mendota's figure (the manual's "inner guide", p. 18, the same).
    In the photo it's the box at the frame's inner edge. Three Mendota photos (ML48, ML54, ML60)
    agree with their published viewing areas to within 0.3%, so it's the right box.
  - **Cutout:** Mendota's photo, trimmed to 715 × 277. Viewing area pixels 18.5, 18.4 to 698.7,
    258.8, glass box 35, 39.5 to 679, 240.
  - **Checked:** Mendota's viewing area, drawn over the render from the room's camera alone,
    runs along the drawn frame's inner edge on all four sides, and the room's own fireplace is
    hidden under the front. Day and evening, its card, "The room's own", the Fireplace tab, and
    "See it in a room" from its page.
- **Two more, 31 Oct 2026 (Ben: "that ML54 decor looks good. Can we do a couple others"); dev data
  only.** Both are Mendota's photos, transparent and straight on. Each viewing area was found the
  same way as the ML54 Décor's: where the frame's level falls to half going into the dark gap
  inside it, the median of every row and column. That method gives back three sides of the ML54
  Décor's box to within 0.2 px. Its fourth, the bottom, has a frame too dark for it, so that one
  is measured by eye.
  - **ML54 Timberline** (the log set; the same size as the Décor, so the two looks can be
    compared):
    - Trimmed to 706 × 264. Viewing area pixels 11.2, 10.3 to 695.3, 252.1, which is 0.08% off the
      shape of 55⅛″ × 19½″. Glass box 34, 34 to 672, 232.5 (where the black liner starts).
    - Its front comes to 56.9″ × 21.3″, so it covers the room's own with about 1½″ to spare each
      side.
  - **ML60 Décor** (stacked-stone liner, white stones, nickel frame; 6″ wider):
    - Trimmed to 748 × 256. Viewing area 11.8, 13.2 to 733.4, 243.8, 0.17% off the shape of 61⅛″
      × 19½″. Glass box 37, 38 to 707, 214.
    - Its front comes to 63.4″ × 21.6″, which leaves about 10″ of the 7-ft bump-out on each side.
  - **Not these:**
    - **The ML72s:** Mendota gives 86″ of framing at the back, more than the bump-out's 84″.
    - **The ML48s:** too small to cover the room's own.
    - **Kozy Heat's Callaway 50, with its Gallery surround:** the studio shot is straight on, but
      its opening is 2% off the shape of Kozy Heat's glass figure (49⅞″ × 13⅜″). So it would
      only be accurate to about half an inch. The Callaway 72's front would almost fill the
      bump-out.
  - **Checked:** each maker's viewing area, drawn from the room's camera alone, runs along the
    drawn frame's inner edge on all four sides. Both were checked day and evening, and the
    Fireplace tab lists all three.
- **Two more, 1 Nov 2026 (Ben: "any more fireplaces you can do"); dev data only:**
  - **Mendota ML60 Timberline** (birch logs, gray wave liner, nickel frame):
    - Trimmed to 752 × 259. Viewing area 11.4, 14.6 to 735.2, 245.6, 0.04% off the shape of 61⅛″
      × 19½″. Glass box 31.5, 34 to 714.5, 224.5.
    - Its front comes to 63.5″ × 21.9″.
  - **Kozy Heat Nordik 60 TL** (logs on a brick liner; the first that isn't a Mendota):
    - **The photo:** Kozy Heat has no cutout of it, but its product page has a straight-on picture
      of it in a stone wall (a 256-colour image, 1024 × 647; it holds up close). The front is cut
      from that at its outer frame, pixels 104, 319 to 717, 546 (613 × 227). The frame's edges
      are level and plumb across the picture.
    - **Viewing area 60″ × 20″,** Kozy Heat's figure. In the photo it's the opening inside the
      inner (screen) frame: 16.93, 16.71 to 595.0, 207.7 in the cutout. That's 0.89% off the
      figure's shape. Kozy Heat gives round numbers, and the box inside the outer frame is 4.8%
      off, so it's this one. Glass box: the opening.
    - Its front comes to 63.6″ × 23.8″.
  - **Checked:** each maker's viewing area, drawn from the room's camera alone, runs along the
    frame's inner edge on all four sides, day and evening. The card reads "Kozy Heat · Gas
    fireplace, Nordik 60TL, 60″ × 20″ viewing area".
- **The empty wall, and three more: the ML48s (1 Nov 2026; Ben: "why can't we put the 50″ on the
  wall?", then "let's get it dialed here").**
  - **The picture:** the family room rendered here with no fireplace (`open`, see
    `hearth-studio-build/README.md`).
    - The rest of the room matches the room's own picture to 1.3/255 (render grain).
    - The afternoon sun patch runs straight across where the fireplace was.
    - A stand-in fire glow lights the room in the evening as the fireplace did. It leaves no edge
      on the wall that a smaller front would show, and with no fireplace shown it's taken away.
  - **The ML48s** (Mendota's photos, each trimmed; viewing area 47⅞″ × 19½″):
    - **ML48 Décor:** 628 × 276. Viewing area 16.2, 16.9 to 611.4, 259.4 (0.03% off the shape).
      Glass box 36.5, 38 to 589, 237.5. Its front comes to 50.5″ × 22.2″.
    - **ML48 FireIn:** 652 × 286. Viewing area 18.2, 17.0 to 636.1, 268.4 (0.11% off). Glass box
      39.5, 39.5 to 614, 247. Front 50.5″ × 22.2″.
    - **ML48 Timberline:** 671 × 306, with its forged frame. Viewing area 26.1, 26.5 to 643.9,
      279.1 (0.38% off). Glass box 47, 36 to 622, 257.5. Front 52.0″ × 23.6″.
  - **Checked:**
    - The ML48 Décor's viewing area, drawn from the room's camera alone, runs along its frame's
      inner edge, and the stone runs on round it.
    - Day and evening, and switching back to the room's own.
    - With no fireplaces in the list, as on the live site, the Room tab offers "Linear gas
      fireplace" and "No fireplace". The latter is the bare wall of stone.
- **Not added, 1 Nov 2026:**
  - **The photos don't match Mendota's figures:**
    - **ML39 Décor:** no box in its photo has the shape of 41¾″ × 15¼″; the nearest is 3.5% off.
    - **ML39 Timberline:** 1% off, but its photo has a dark band round the frame that may be the
      backdrop rather than the front.
    - **FV36, FV42 and FV48 (traditional):** nearest boxes 2.7%, 9.7% and 3.2% off.
  - **No viewing area on file:** HearthStone's WFP-75 and WFP-100.
  - **Too wide for the bump-out:** the ML72s (86″ framing at the back) and the Callaway 72
    (86½″).
  - **The photos don't match the maker's figures:**
    - **Kozy Heat Bellingham 52:** its picture's opening is 8% off the shape of 52 7/16″ × 30⅞″.
    - **Kozy Heat Callaway 50 (Gallery surround):** 2.1% off 49⅞″ × 13⅜″.
    - **Kozy Heat Generation 6020:** its picture is the 60″ × 18½″ version (the 6020S's
      figure), while the model's own figure is 60″ × 20″.
    - **Kozy Heat Osseo X64 (electric):** two different viewing heights are published (15⅞″ and
      15¼″).
    - **Town & Country TC54:** only drawings and a close-up of the glass beads.
  - **Not checked yet:** Kozy Heat's Bayport, Springfield and Nordik DV (room photos to cut out,
    like the Nordik 60 TL's), Town & Country's TC36 and TC42, Mendota's DXVs, and the wood-burning
    fireplaces. Each needs a straight-on photo that matches the maker's figures.
- **Adding the next fireplace:** `trim` the maker's straight-on photo, measure the viewing area's
  box and the glass's in pixels, stop the dev server, run
  `face <slug> <trimmed.png> <x0,y0,x1,y1> <wide,tall> <gx0,gy0,gx1,gy1>`, and start it again. The
  script refuses a box whose shape doesn't match the maker's figures by 3% (a photo that isn't
  straight on), and prints the front's size.
- **Inserts** go in a masonry fireplace's opening, and neither sample room has one. They need a
  third room: a render with an open masonry firebox, its camera, and the opening's size. Since
  1 Nov 2026 that can be built here (`hearth-studio-build/`).

What it has and what it lacks:

- **Cutouts: 5 of the 195** stoves (the 7110, F 445, 6140, F 602 and 6148), and 8 built-in
  fireplaces (Mendota's ML48 Décor, FireIn and Timberline, ML54 Décor and Timberline, and ML60
  Décor and Timberline, and Kozy Heat's Nordik 60 TL), in dev only.
  - The stove visualizer has been drawing category silhouettes. Those aren't the product, so
    they're never sent.
  - A stove can't stand in Hearth Studio until it has a real cutout. The makers' own photos are
    allowed (Decisions, below).
- **The cutout facts (`view`, `imageSpan`, `imageWidthIn`, `glassBox`):**
  - Set by hand for those five only.
  - They need fields on the product admin, filled in with each cutout upload (7d).
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
  - Under the stove-size rules (7b), a stove without a size is still drawn, at a typical size by
    eye, and its card says so. So sizes no longer block a stove; cutouts do.
  - The update's 7d adds a sizing step to the stove admin, where cutouts are uploaded: the maker's
    three sizes, two markers on the cutout for `imageWidthIn`, and a check on the lake cabin's
    empty hearth. Not built yet.
- **`onDisplay`:** Steve hasn't marked any model "On our showroom floor" yet, so all are false.
- **`flue`:** not sent. The app's defaults apply (top for wood, rear for gas), and it finds a top
  collar in the photo itself.
- **No prices.**

## Decisions (INTEGRATION.md section 9)

**Made, 28 Oct 2026 (Ben):**
- Every stove gets a Stove size control; exact sizes come from staff sizing each image (7b, 7d).
- No 1 ft grid button.
- The app's files live in the site's files on Replit, not App Storage.
- `/veneer/` and `/visualizer/` are retired in favour of `/hearth-studio/`.
- The Website | Showroom switch stays on the website, since the shop's screen runs the website.
- `/showroom/` isn't locked: its badge leads home. It's likely the shop screen's home page, and
  staff use the whole site from it.
- **The makers' own product photos may be used** for stove cutouts (Ben, 28 Oct 2026). That
  settles section 2's "no scraped manufacturer photography" for stoves. The Jøtul, Kuma and Morsø
  catalog photos are already transparent cutouts; HearthStone's are on white with the pipe in.
- Phase 4 starts with one stove, the Morsø 7110 B, and the Hearth Studio chat builds the stove
  layer.
- Stove cards link to the stove's page on our site (`pageUrl`), never the maker's (update-3).
- The site's address stays stoveworksinc.com for now, not the app's `haywardstoveworks.com`.

**Still open**, for Ben and Steve:

1. Kiosk "Send to my phone" links work without signing in. Should they expire after 30 days?
2. **The estimate is kept from customers for now** (Ben, 28 Oct 2026: keep it in the system, not
   public, until it's confirmed and worked on).
   - **What's hidden:** in the app, the Estimate tab, the estimate in "Send to the store" ("Attached:
     … the estimate"), and the estimate row in its thank-you card. On the site, the lines that
     promised it: the home page card, the Shop and Hearth Studio menus, and search.
   - **What stays:** it's still worked out, the staff panel's estimate settings stay, and Phase 5
     can still send it to the store with an enquiry.
   - **To confirm or work on before it comes back:**
     - the 0.5 sq ft of flats per foot of corners and the 10% cutting allowance (Steve);
     - box counts and tons, or square feet only;
     - the sample rooms' sizes the numbers use: the lake cabin's 6 ft chimney, 9½ ft tall, on an
       8 ft hearth; the lake home's 7 ft bump-out, 9 ft tall;
     - on customer photos, how far to trust sizes that are guessed or set by eye.
   - **To turn it back on:** delete `estimate: false` from `HS_CONFIG` in `public/hs/index.html`,
     and put the site's lines back.
3. (Part of 2.)
4. Which Buechel stones the store stocks and displays.
5. The microphone button on the showroom screen.
6. Paint-lookup model: Sonnet (default) or Haiku.
7. Let Claude look at customer photos (default), or keep photos on the device.
8. Which stoves and fireplaces to show, and whether to mark "On display in our showroom".
9. **Inserts** (31 Oct 2026): a third sample room with a masonry fireplace opening. The Hearth
   Studio chat could build it with its Blender pipeline, or Blender could be installed here.
