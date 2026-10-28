# Stone Veneer Mock-up Studio: build details

> **Retired, 28 Oct 2026.** Hearth Studio, the "better version" this document was written for,
> replaced it: `/veneer/` redirects to `/hearth-studio/` (see [hearth-studio.md](hearth-studio.md)).
> Mock-ups saved in the old studio still open at `/account/veneer/<id>`, so its code stays.

**What this is:** a full outline of the stone mock-up studio as built for the Hayward
Stoveworks site, to develop a better version separately and bring it back.

**Snapshot:** 21 Oct 2026. Working copy on branch `redesign-up-north` (uncommitted), plus the
unmerged `room-studio` branch (section 11).

**Project:** `~/Projects/stoveworks` (Next.js 16).

- **Live route:** `/veneer/`
- **Staff:** `/admin/stone`
- **Customer:** `/account/veneer/[id]`
- **Share:** `/d/[slug]`

---

## 1. What it does, in one paragraph

A customer opens `/veneer/` and sees a sample A-frame cabin, or uploads a photo of their own
wall or fireplace. They pick a stone profile, and a box of stone appears on the photo. They drag
it onto the wall and resize it from its sides and corners. They type the wall's **real** width
and height in inches, which sizes the stone courses truthfully and drives a **material
estimate**: square feet, outside-corner linear feet, a 10% waste allowance and box counts.

They can also:

- cut openings (firebox, mantel, window) so the room shows through;
- match brightness, contrast and blend to the room's light;
- download a full-resolution PNG;
- sign in (magic link) to save the mock-up to their account;
- share a private link.

It works fully signed out; signing in is only for saving.

## 2. The customer flow, step by step

1. **`/veneer/` loads with the sample room.** `public/images/demo-room-a-frame.jpg` is
   1804×1200 and shows a banner saying it's a sample. There's a "Use your own photo" button,
   and drag-and-drop works anywhere on the stage.
2. **Uploading a photo.** It's read in the browser and downscaled to at most 2400 px on the long
   edge (WebP, quality 0.9). Nothing is uploaded until they save.
3. **Picking a stone** in the right-hand picker (search, plus maker chips when there's more than
   one maker). This adds a **region**: an upright box in the middle of the photo, 72″×96″ by
   default.
4. **Placing it.**
   - Drag the box to move it.
   - Eight handles (4 corners, 4 sides) resize it.
   - Arrow keys nudge it (Shift moves 5×).
   - The box stays an upright rectangle.
5. **The selected region's controls:**
   - real width and height (in), and the stone choice;
   - outside-corner edges (top, right, bottom, left checkboxes);
   - brightness, contrast and blend sliders;
   - openings: up to 3 per region, each positioned with Left/Top/Width/Height sliders;
   - "Remove this area".
6. **Up to 4 regions** per mock-up. The estimate panel totals them all, with a per-area
   breakdown when there's more than one.
7. **Download image** gives a PNG at the photo's resolution.
8. **"Sign in to save"** (signed out) stashes the work and goes to sign-in. When they come back,
   the work is restored. Signed in, "Save to my account" uploads the photo (once) and
   saves the mock-up.
9. **Account → the mock-up:** reopen to edit, share (creates or revokes an unguessable link),
   delete.
10. **The share link** `/d/[slug]` shows a static render plus the estimate to anyone holding
    the link, signed out.

## 3. Ground rules (they apply to any new version)

These are Ben's and the business's standing rules, not technical choices:

- **No prices** anywhere. The estimate is quantities only.
- **No invented content.** Stone names, colours, SKUs and coverage figures come from the maker
  or from Steve, never made up. Unknowns stay unknown and are labelled.
- **Sample images are labelled as samples** wherever they appear ("sample image"), with a page
  notice when no real swatches exist.
- **No scraped manufacturer photography** until Ben confirms the dealer agreement covers it.
  Staff upload swatches instead.
- **The estimate says it's an estimate.** It's "a starting point for a quote", and staff
  confirm against the current coverage chart before ordering.
- **Customers' photos are private**:
  - only the owner can see them;
  - a share slug unlocks only the photo that design is built on;
  - the cache is private.
- **Works signed out.** Sign-in is only a wall in front of saving, and work survives the round
  trip.
- **Ben's call, 8 Oct 2026: no perspective dragging.** The first version had four free corners
  so the box could match a wall's perspective. Ben found the warping off-putting, and it's now
  plain upright boxes with resize handles. Perspective support is still in the maths and the
  data (section 6), so it can come back as an option.

## 4. Architecture

- **Framework:** Next.js 16, App Router. The page is a server component that loads the swatches
  and the user; the studio is one client component.
- **Styling:** plain CSS (`src/app/veneer.css`, plus shared classes in `globals.css`), with
  tokens on `:root`. No Tailwind, no UI kit.
- **Database:** Postgres. Dev uses PGlite (Postgres in WASM, single-process). Queries are
  hand-written SQL through `src/lib/db.ts`.
- **Images:**
  - **in the browser:** canvas for downscaling and export, CSS `matrix3d` for the live render;
  - **on the server:** `sharp` for uploads and swatches.
  - No canvas, WebGL or graphics library.
- **Auth:** passwordless magic links (needs SMTP in production).
- **Storage:** local files in dev, Replit App Storage in production (`src/lib/storage.ts`).
  Files are served at `/files/…`; room photos are served privately at `/api/photos/[id]`.

### Files

| File | Lines | Role |
|---|---|---|
| `src/app/veneer/page.tsx` | 55 | Route: metadata, loads swatches + user, sample-texture notice, mounts the studio |
| `src/components/veneer/VeneerStudio.tsx` | 701 | The editor: photo, regions, drag/resize/keyboard, region controls, save, export, stash restore |
| `src/components/veneer/StoneRegion.tsx` | 117 | Draws one region: texture + homography (`matrix3d`) + openings mask + filters |
| `src/components/veneer/StonePicker.tsx` | 107 | Stone list with search and maker chips |
| `src/components/veneer/EstimatePanel.tsx` | 112 | Material estimate panel |
| `src/components/veneer/VeneerPreview.tsx` | 62 | Read-only render, for share pages and the account |
| `src/components/veneer/export.ts` | 193 | Full-resolution PNG export: the same homography via a triangle mesh on 2D canvas |
| `src/components/veneer/stash.ts` | 47 | `sessionStorage` stash across the sign-in round trip |
| `src/lib/veneer-types.ts` | 281 | Shared types, defaults, limits, the estimate maths, validation of saved data |
| `src/lib/homography.ts` | 134 | Projective maths: unit square or rect → quad, CSS `matrix3d`, convexity check |
| `src/lib/veneer.ts` | 109 | Server: CRUD on `veneer_designs`, share slugs |
| `src/lib/stone.ts` | 107 | Server: stone catalogue queries, placeholder choice, row → `StoneSwatch` |
| `src/app/api/veneer-designs/route.ts` | 49 | `POST` create (signed in, own photo, ≥1 region, 60-per-user limit) |
| `src/app/api/veneer-designs/[id]/route.ts` | 48 | `PUT` update, `DELETE` (both scoped to the owner) |
| `src/app/api/photos/route.ts`, `[id]/route.ts` | — | Room photo upload (12 MB, JPEG/PNG/WebP/HEIC) and private serving (`?share=` slug) |
| `src/app/account/veneer/[id]/page.tsx` | 58 | Reopen a saved mock-up in the studio |
| `src/app/account/actions.ts`, `DesignCard.tsx` | — | Delete, share and unshare (shared with the stove visualizer's designs) |
| `src/app/d/[slug]/page.tsx` | 192 | Share page; resolves stove designs or veneer mock-ups |
| `src/app/admin/stone/page.tsx`, `[id]/page.tsx`, `[id]/StoneForm.tsx` | 95 / 40 / 181 | Staff catalogue: list, edit, swatch upload, real tile size, coverage |
| `src/app/admin/actions.ts` | — | `saveStoneAction`, `clearSwatchAction` |
| `src/lib/storage.ts` → `storeStoneSwatch` | — | Swatch upload pipeline (sharp) |
| `src/lib/demo-room.ts` | — | Sample room image and alt text |
| `src/components/RoomPhoto.tsx` | — | `DemoBanner`, `usePhotoDrop` (shared with the stove visualizer) |
| `scripts/seed-stone.mjs` | 111 | Seeds the 10 Cultured Stone profile families (idempotent; `--if-empty`) |
| `scripts/generate-stone-tiles.mjs` | 194 | Generates the placeholder tiles in `public/stone/` (deterministic) |
| `src/app/veneer.css` | 233 | Studio styles |

## 5. Data model

### Types (`src/lib/veneer-types.ts`, shared by server and browser)

```ts
type StoneSwatch = {
  id: string; slug: string; name: string;
  texture: string;            // Cultured Stone organises by texture (profile) x colour
  color: string | null;
  brandName: string | null;
  image: string;              // tiling image; a generic placeholder until staff upload one
  isPlaceholder: boolean;
  tileWidthIn: number;        // REAL-WORLD area one tile of `image` covers
  tileHeightIn: number;
  flatSqftPerBox: number | null;     // coverage, for box counts
  cornerLnftPerBox: number | null;
  productUrl: string | null;
};

type Region = {
  id: string;
  stoneId: string;
  corners: [Point, Point, Point, Point];  // photo PERCENTAGES, order TL, TR, BR, BL
  realWidthIn: number;        // how big the area really is: drives scale AND the estimate
  realHeightIn: number;
  holes: Hole[];              // openings, in region-relative percentages
  cornerEdges: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  brightness: number;         // 0.4–1.8
  contrast: number;           // 0.4–1.8
  opacity: number;            // "Blend", 0.2–1
};

type Hole = { id: string; xPct: number; yPct: number; wPct: number; hPct: number };
type VeneerState = { regions: Region[] };
```

- **Limits:** `MAX_REGIONS = 4`, `MAX_HOLES = 3`. A new region is 72″ × 96″, at corners
  (32,24)–(68,82)%.
- **Validation:** `parseRegions()` validates everything coming from the database or a client
  save:
  - corners clamped to −50…150%;
  - real sizes clamped to 6…1200″;
  - hole values clamped;
  - filters clamped;
  - missing fields defaulted.

  Saved JSON is therefore always safe to render.

### Tables (`db/schema.sql`)

```sql
stone_products (
  id uuid PK, brand_id int → brands, slug text UNIQUE, name text,
  texture text NOT NULL, color text, summary text,
  swatch_path text,                       -- null until staff upload one
  swatch_width_in  numeric(6,2) DEFAULT 24,   -- real area one tile covers
  swatch_height_in numeric(6,2) DEFAULT 16,
  flat_sqft_per_box numeric(6,2), corner_lnft_per_box numeric(6,2),
  product_url text, is_active bool DEFAULT true, sort int, created_at, updated_at
)  -- indexes: (is_active, texture, sort), (brand_id)

veneer_designs (
  id uuid PK, user_id uuid → users ON DELETE CASCADE,
  room_photo_id uuid → room_photos ON DELETE CASCADE,
  title text DEFAULT 'Untitled mock-up',
  regions jsonb DEFAULT '[]',             -- Region[] as above
  share_slug text UNIQUE, created_at, updated_at
)  -- index: (user_id, updated_at DESC)

room_photos (id, user_id, storage_key, original_name, mime, width, height, bytes, created_at)
```

`design_enquiries` exists, but only for the stove designs, and has no UI yet.

## 6. Rendering: how stone sits on the wall

### Three coordinate spaces

1. **Photo percentages.** Region corners are stored as % of the photo, so they survive any
   display size.
2. **Stage pixels.** The stage element is measured with `ResizeObserver`, and corners are
   converted to px for the transform.
3. **Region reference space.** Each region has its own flat pixel box:
   - width is always `REF_WIDTH = 1000`;
   - height is `1000 × realHeightIn / realWidthIn`.

   The box therefore has the wall's real proportions, so a square foot is a square in it. The
   texture and the openings are laid out here.

### The homography (`src/lib/homography.ts`)

- **`unitSquareToQuad(quad)`** is the closed-form projective map from the unit square to four
  corners. If the corners are collinear, it falls back to an affine map instead of returning
  NaN.
- **`rectToQuad(refW, refH, quad)`** is the same map, from the region's reference box.
- **`toCssMatrix3d(m)`** turns that 3×3 into a column-major CSS `matrix3d(...)`, applied with
  `transform-origin: 0 0`.
- **`project(m, u, v)`** maps a point, for export. `isConvex(quad)` flags a folded quad (shown
  with a dashed outline).

With upright boxes the map is just a scale and translate, so nothing warps. With four free
corners it does true perspective: courses converge, and equal real steps shrink as they recede.
The machinery is all still there.

### Texture scale (`StoneRegion.tsx`)

```
tilePxW = REF_WIDTH × tileWidthIn  / realWidthIn
tilePxH = refH      × tileHeightIn / realHeightIn
```

These are set as the region's `background-size`. Worked example: a 72″ × 96″ area with a
24″ × 16″ tile shows 3 tiles across and 6 down. The editor and the export were checked to
compute the same values.

### Openings

On screen, openings are a CSS mask: one solid layer plus one per hole, combined with
`mask-composite: exclude` (`-webkit-mask-composite: xor`). The mask is applied in region space
*before* the transform, so a hole would ride the perspective too.

### Lighting

Each region's lighting is `filter: brightness() contrast()` on the stone layer, with `opacity`
for blend. Nothing is taken from the photo's own light.

### Export (`export.ts`)

1. Draw the photo at full resolution on a canvas.
2. For each region:
   - paint the tiled stone into a **flat** offscreen canvas in region space (exact tiling, with
     the filters applied);
   - punch the holes with `destination-out`;
   - warp it onto the photo with a **24 × 24 grid of triangles**, each drawn with the affine
     transform for that triangle and clipped to it.
3. Triangles are grown 0.6 px from their centroid before clipping. Without that, antialiasing
   leaves a faint grid of seams. A 2D canvas can only do affine transforms, so the mesh
   approximates the projective map to sub-pixel error.
4. The output is a PNG named from the mock-up title.

Both paths use the same matrix, which is what keeps the download matching the screen.

## 7. Interaction details (`VeneerStudio.tsx`)

- **A region is two layers:**
  - **`StoneRegion`**, the stone, which never takes pointer events;
  - **a plain frame** above it (`.region-frame`, `role="button"`, `tabIndex=0`) that carries
    move, the 8 resize handles and the keyboard nudge.
- **Pointer handling:**
  - Pointer capture on the dragged element; listeners on `window` for move and up.
  - Positions are converted to photo % from the stage's bounding rect.
- **Size and position limits:**
  - Resize keeps the box upright; the minimum size is 3% of the photo.
  - Edges are clamped to −20…120%, so a box can run slightly off the photo.
- **Selection:** clicking empty stage deselects. The region controls show only for the selected
  region; otherwise a hint line shows.
- **Photo reading:**
  - via `createImageBitmap`;
  - a non-image file gets a friendly message;
  - a new photo clears the regions.

## 8. The material estimate (`estimateRegion` / `totalEstimate`)

Per region, from the **real** dimensions the customer typed:

```
grossSqft        = realWidthIn × realHeightIn / 144
openingsSqft     = Σ (hole.w% × realWidthIn) × (hole.h% × realHeightIn) / 144
netSqft          = max(0, gross − openings)
cornerLnft       = (top? W) + (bottom? W) + (left? H) + (right? H)   ÷ 12
flatSqft         = max(0, net − cornerLnft × 0.5)     // 1 lin ft of corners covers ~0.5 sq ft of flats
flatSqftWithWaste   = flatSqft × 1.10                 // 10% cutting and breakage allowance
cornerLnftWithWaste = cornerLnft × 1.10
flatBoxes   = ceil(flatSqftWithWaste / flatSqftPerBox)      // null if no coverage figure
cornerBoxes = ceil(cornerLnftWithWaste / cornerLnftPerBox)
```

The totals sum the regions, and the box counts stay null when no stone has coverage figures.

**Checked by hand:** 72″ × 96″ gives 48 sq ft. With the top and left edges as outside corners,
that's 14 lin ft, which is (72 + 96) ÷ 12.

**On screen:** area to cover, openings deducted, outside corners, flats needed, the figures with
the allowance, a rough box count and a per-area breakdown. Then the caveat: "An estimate from
the sizes you entered, using typical coverage figures. We'll confirm quantities against the
current coverage chart before anything is ordered."

## 9. The stone catalogue and swatches

### Seeded (`scripts/seed-stone.mjs`)

10 **Cultured Stone** profile families, with no colours, because the live site names none:

- Country Ledgestone
- Southern Ledgestone
- Pro-Fit Alpine Ledgestone
- Dressed Fieldstone
- Cobblefield
- Limestone
- Hewn Stone
- River Rock
- Used Brick
- Handmade Brick

Their coverage is the *industry-typical* **10 sq ft per box of flats** and **6 lin ft per box of
corners**, flagged in admin as needing confirmation against the real chart.

The seed is idempotent, and `--if-empty` (used on deploy) never overwrites staff edits.

### Stone makers Stoveworks carries

From the site's Fireplace Walls & Mantels page and Ben:

- **Cultured Stone:** "more than 21 textures and more than 100 colors".
- **St. Croix Stone** by Environmental StoneWorks.
- **TriLite Stone Company.**
- **Buechel Stone** (natural thin veneer; Ben confirmed 8 Oct).

Stoll Industries is also on that page, but it makes steel and shiplap wall panels, not stone.
Only Cultured Stone is in the tool today, plus Buechel on the `room-studio` branch.

### Placeholder tiles (`public/stone/`, from `scripts/generate-stone-tiles.mjs`)

- **Size:** 768 × 512 px at 32 px per inch, so each tile is 24″ × 16″.
- **Generation:** deterministic, using a seeded random generator and sharp.
- **Files:** `ledgestone-grey`, `ledgestone-tan`, `fieldstone-grey`, `fieldstone-warm` and
  `brick-red`.
- **How they're chosen:** `placeholderFor(texture, slug)` in `src/lib/stone.ts` picks one by
  matching the texture name (brick, field/cobble/river/round, ledge/stack/split), alternating
  colourways so the list isn't monotone.
- **Labelling:** they're shown as "sample image", and the page shows a notice while no real
  swatch exists.

### Staff upload (`/admin/stone/[id]`)

Staff edit:

- texture, colour, display name and description;
- the **swatch image** (JPEG, PNG or WebP, up to 8 MB);
- **swatch real width and height** in inches;
- flats sq ft per box and corners lin ft per box;
- product URL and active status.

Uploads go through `storeStoneSwatch`: sharp `.rotate()`, resized to fit 1600 × 1600 (no
enlargement), saved as JPEG quality 88 with mozjpeg to `/files/media/stone/<slug>-<id>.jpg`. The
list page shows how many profiles still need a swatch.

**The real size of a swatch is the single most important number for realism.** A tile has to:

1. tile seamlessly, and
2. come with the real area it covers.

Otherwise the courses come out the wrong size.

### Making a photo tile seamlessly (on `room-studio`)

`scripts/make-seamless-tile.mjs <in> <out.jpg> [--width-in N] [--overlap 0.18] [--flatten 0.7]`
uses a minimum-error boundary cut (Efros & Freeman image quilting) on the image's own
wrap-around:

1. It trims an overlap off two sides.
2. It rebuilds the edges along the path where they match best, which on a stone wall is almost
   always a mortar joint.
3. `--flatten` evens out lighting falloff, which would otherwise repeat as light and dark bands.
4. Given `--width-in`, it prints the tile's real size to enter in admin.

The Buechel sample was made this way: a 621 × 904 px photo, tile size **estimated** at
29.5″ × 43″. Its product name and size are unknown and labelled as such.

## 10. Saving, accounts and sharing

- **Saving (signed in):**
  1. If the photo has no `roomPhotoId`, the downscaled blob is posted to `/api/photos`, which
     stores it privately and returns an id.
  2. The mock-up is posted (or updated with `PUT`) to `/api/veneer-designs[/id]` with
     `{ roomPhotoId, title, regions }`.
- **Server checks:**
  - signed in;
  - the photo belongs to the user;
  - at least one region, after `parseRegions`;
  - no more than 60 saved mock-ups per user;
  - updates and deletes scoped by `user_id`.
- **Signed out:**
  - The photo is re-encoded (1500 px max, WebP 0.72) to a data URL.
  - It's stashed in `sessionStorage` (`sw_veneer_stash`) with the regions and title, then the
    browser goes to `/sign-in/?next=/veneer/`.
  - On return the stash is restored: "Picked up where you left off."
  - The sample room yields to stashed work; a real photo never does.
- **Share links:**
  - `ensureVeneerShareSlug` makes a 12-byte random base64url slug; revoking sets it to null.
  - `/d/[slug]` renders `VeneerPreview` (the same `StoneRegion` component, no editing) and the
    estimate.
  - `/api/photos/[id]?share=<slug>` serves the photo only if that slug's design is built on it.
- **Access control** was tested with a second real customer:
  - their photo returns 404;
  - overwriting their mock-up returns 403;
  - deleting it returns 404.
- **A real bug was found that way:** shared veneer links showed a broken photo because the photo
  route only knew stove share slugs. Fixed.

## 11. The `room-studio` branch: the two tools merged (unmerged)

**Background:** Ben prototyped a merged experience in ChatGPT in September (the
"Stoveworks-Visualizer-Handoff" package), with stove and stone in one scene, A/B compare and a
shop mode.

**The branch, from 8 Oct:**

- It built that on this codebase's real cutouts, calibration, homography, estimate, accounts
  and sharing.
- `/veneer/` redirects into `/visualizer/` as "Room Studio".
- It **branched from an older base** (`1c7f29a`). It is 61 files and +4355/−2737 lines.
- It hasn't been merged and has diverged from the current work.

**It adds:**

- **One scene:** stove, insert or fireplace cutouts plus stone regions (`RoomStudio.tsx`, 1253
  lines; `Scene.tsx`; `src/lib/studio.ts`, 434 lines).
- **A/B compare** with linked placement. View B differs only in which products and stones it
  shows, and "Download A and B" exports them side by side.
- **A hand-fitted sample room** (`src/lib/sample-room.ts`): wall = 8 ft, plus "in front" shapes
  for the sofa, lamp, window and floor, so stone goes *behind* them. These exist for the sample
  room only. Customers can't draw them yet.
- **"Set scale"**, which re-sizes products and re-reads stone sizes.
- **Shop mode** for in-store use: no saving, and "New customer" signs out.
- **The stash moved to `localStorage`,** restored only for a matching `?resume=` id, because the
  emailed sign-in link opens in a new tab.
- **A migration** copying `veneer_designs` into `designs` as a layer type. Old edit URLs and
  share links still work.
- **`scripts/check-studio.ts`**, with 13 checks on the editing rules.
- **Buechel Stone** and `make-seamless-tile.mjs` (section 9).

**Next steps it listed:**

1. Real stove cutouts from the brain.
2. Customer-drawn "in front" shapes.
3. A hearth pad on the floor plane.
4. Design enquiries to Steve, with the stone estimate attached.
5. Dropping `veneer_designs` once the merge ships.

## 12. What has been tested

- **The homography:** 8 unit checks, including that equal real-world steps shrink steadily as
  they recede. That's the proof the perspective is right, not just that the corners land.
- **Editor and export** compute identical tile counts.
- **The estimate** was checked by hand (section 8).
- **Access control** was tested with two real accounts (section 10).
- **`room-studio` was driven in headless Chromium:** drag, compare, a 4032 × 3024 upload, sign-in
  in a new tab, save and reopen, share, shop mode, and phone (390 px) and tablet (820 px) widths.

**Not tested:**

- real Postgres or SMTP for this tool;
- **any real touch device** (touch was only emulated);
- any browser other than Chromium;
- load beyond one user.

## 13. Honest assessment: what doesn't work well yet

These are the places a better build should aim at.

1. **Walls are rarely square to the camera.**
   - Upright boxes look pasted on any wall photographed at an angle.
   - The four-corner version warped well mathematically but felt bad to use.
   - The real problem is the *interaction*, not the maths: how to get perspective without
     fiddly corner dragging.
2. **No occlusion.**
   - Stone covers whatever is in front of the wall: the stove, a mantel, furniture, a TV.
   - Rectangular openings are the only tool.
   - `room-studio` has "in front" shapes, but only hand-fitted for the sample room.
3. **Lighting is flat.**
   - Global brightness and contrast sliders don't reproduce the room's light falloff, shadows
     or colour cast.
   - The stone reads as a flat texture, not a lit surface.
4. **The swatches are fake.** Generic generated tiles at a nominal 24″ × 16″. Realism depends on
   real, seamless swatches with a true real-world size, and none are uploaded yet.
5. **The catalogue is thin.**
   - Only 10 Cultured Stone profile families, with no colours.
   - Coverage figures are typical, not published.
   - St. Croix and TriLite aren't in the tool; Buechel is only on `room-studio`.
6. **Scale relies on typing.** The customer must measure and enter the wall's width and height.
   There's no calibration from something in the photo: a door, a brick course, the stove's
   known width.
7. **Openings are clumsy.**
   - Rectangles only, at most 3.
   - Positioned with sliders in a side panel rather than dragged on the photo.
8. **The estimate is simple.** It handles flats and outside corners only:
   - no inside corners, returns, hearth or ledge stones, or sills;
   - no mortar or grout, lath or scratch coat;
   - corner edges can only be the region's own four edges.
9. **Mobile is untested on a real device.** The handles are small for fingers.
10. **Stale copy.** The page intro still says "drag the corners onto it", which is the old
    four-corner interaction.
11. **Two tools, not one.** On the current branch, a customer can't see the stove and the stone
    together. `room-studio` fixes that but has diverged.
12. **No way to send it to Steve.** There's no enquiry with the estimate attached; the
    `design_enquiries` table exists, but only for stove designs, and has no UI.

## 14. Directions for a version that works really well (suggestions, not decisions)

1. **Real swatches first.**
   - Photograph each sample board straight-on with a ruler in the shot.
   - Run it through the seamless-tile script and record its true size.
   - Without this, nothing else will look right.
2. **Perspective that doesn't feel like warping.** Options:
   - **Assisted:** the customer taps the wall's four corners (or traces two lines), and the
     studio fits the plane and snaps the box to it.
   - **Automatic:** detect the wall plane or vanishing lines from the photo (line detection, or
     a depth or segmentation model).

   Keep upright boxes as the default for straight-on photos.
3. **Occlusion.**
   - A brush or lasso to mark "in front of the stone" areas.
   - Or automatic segmentation (a Segment-Anything-style model, in the browser or a server
     call) where the customer taps the stove, mantel or furniture to keep it in front.
   - The same masks give clean openings.
4. **Light from the photo.**
   - Multiply a blurred luminance map of the original wall onto the stone, so shadows,
     falloff and colour cast carry through.
   - Add a soft contact shadow at openings and edges.
   - Normal or height maps per swatch would add relief under a raking light.
5. **Scale from the photo.** Tap a known object ("this door is 80″ tall", "this is the
   36″ insert", a standard brick course, or a tape measure in the shot) and derive real
   dimensions instead of asking for them.
6. **Openings and shapes on the canvas:** draggable, polygonal or arched (arched firebox
   surrounds are common), with snapping.
7. **A builder-grade estimate:**
   - flats, outside **and inside** corners;
   - hearth or ledge stones and returns;
   - mortar and grout colour;
   - each line labelled with its basis;
   - coverage per profile and colour, from the maker's chart.
8. **Phone first.** Most customers will photograph the wall on a phone, so large handles,
   pinch-zoom and one-handed controls matter.
9. **Hand-off to Steve.** "Send this to Hayward Stoveworks" with the image, the estimate and the
   location (to qualify it early). The enquiry inbox goes in `/admin`.
10. **Shop mode** (from `room-studio`), for staff on a showroom tablet.

## 15. Bringing it back into the site

What the site expects, or what would need changing:

- **Stack:** Next.js App Router, React, plain CSS with `:root` tokens, Postgres, no Tailwind.
  A self-contained client component, plus a few API routes, drops in most easily.
- **Data:**
  - Either keep `Region` / `VeneerState` compatible (extra fields are fine; `parseRegions`
    would need updating to keep them),
  - or ship a migration from `veneer_designs.regions` (and from `designs` if `room-studio` is
    merged first).
  - Saved mock-ups and share links customers have sent must keep working.
- **Catalogue:**
  - Read from `stone_products`, or extend it: colour variants, per-colour swatches, inside
    corners, published coverage.
  - Swatch real size stays on the row, and staff keep editing it at `/admin/stone`.
- **Photos:** use `/api/photos` (private storage, owner-only, `?share=` access) rather than a
  new store.
- **Auth:** the existing magic-link session (`currentUser()`). Saving requires sign-in;
  everything else works signed out.
- **Rules:** section 3 applies unchanged: no prices, no invented stone data, samples labelled,
  the estimate caveated, photos private.
- **Models:** if any step uses an AI model (segmentation, plane detection), say so in the
  hand-back, along with where it runs (browser or server) and what it costs per use.
