# Build scripts

- `gen_room_textures.py`: floor, ceiling, rug, timber, flame and ember textures for the sample rooms.
- `scenes.py`: builds a sample room in Blender (bpy 5.x) and renders one pass. Modes:
  - `beauty`: the room;
  - `tilt_*`: light response to surface angle;
  - `mask1`/`mask2`: per-surface masks;
  - `fire`: firelight only;
  - `geo`: camera and surface geometry as JSON.
- `render_all.sh`: the full render queue. `render_open.sh`: the lake cabin with an empty hearth (variant `open`, for catalog stoves), then `merge_open.py` to post-process it with the other versions' exposures and merge it into the cabin's `scene.json` (with the camera and the stove spot). `render_stove_passes.sh` and `stove_post.py`: its extra passes for catalog stoves (direct sun, camera distance, a probe box for the light a stove gets) -> `open_shade.png` and `stoveSpot.light`.
- `post.py`: turns renders into browser assets: base image, irradiance, light gradients, masks, fire share, and scene.json with each surface's homography, area and corners.
- `prep_sam.py`: the photo helper's model files (MobileSAM, shrunk for the browser) from the ONNX exports in Intel's `@geti-ui/smart-tools`.
- `catalog_build.py`: Buechel's 122 building-stone veneers from what was collected off buechelstone.com (`catalog/`: product pages, spec sheets, color tone listings, Oct 2026) into `catalog_src.json`. See BUILD-NOTES, "Stone catalog".
- `gen_stone.py`: a sample texture for every stone in `catalog_src.json` (color, and a relief map with face height and joint distance), pattern from the collection and Buechel's sizes, colors from Buechel's color words; writes `assets/stone/` and its `catalog.json`. Replace with real swatches when available. `contact_sheet.py` puts the thumbnails side by side for a look.
- `make_brand.py`: the badge images in `assets/brand/` from the store's logo file (`brand_src/`).

Setup: `uv venv --python 3.11 blendenv && VIRTUAL_ENV=blendenv uv pip install bpy`; then `pip install numpy scipy pillow OpenEXR`.

## Running it on the Stoveworks computer (since 1 Nov 2026)

The build came from the Hearth Studio chat (its package in `handoff/hearth-studio/build/`). Since
1 Nov 2026 the sample rooms are built here, in the site's repo (Ben: "let's get it dialed here"),
and the chat is an occasional outside check.

**Setup:**
- Python 3.11.9 is installed for the user at `%LOCALAPPDATA%\Programs\Python\Python311`, without
  PATH changes.
- The venv is `var/blendenv` (git-ignored), holding bpy 5.0.1, numpy, scipy, Pillow and OpenEXR:
  `…\Python311\python.exe -m venv var/blendenv`, then
  `var/blendenv/Scripts/python.exe -m pip install bpy numpy scipy pillow OpenEXR`.

**Rendering:**
- Renders go to `var/hs-renders` (git-ignored). Pass Blender absolute output paths: it reads a
  relative one from the drive's root (a test landed in `C:\var\hs-renders` that way).
- `scenes.py` finds `roomtex/` beside itself; the chat's sandbox path `/home/claude/build/roomtex`
  is gone.
- The other scripts (`render_all.sh`, `render_open.sh`, `merge_open.py`, `stove_post.py`, …)
  still have the chat's sandbox paths. Fix them when they're next used.

**Checked:** a quarter-size render of the family room as shipped matches the chat's `linear_day.jpg`
to 2.4/255 on average (sample noise).

**The family room's empty wall (`linear` variant `open`, 1 Nov 2026):** catalog fireplaces of any
size go on it.
- `scenes.py` leaves out the firebox, the trim frame, the glass, the media and the flame cards, and
  gives `chase_front` no hole.
- The fire's light stays as a stand-in, just in front of the wall where the glass was, at
  `FIRE_OPEN_K` (0.935) of its energy. In front of the wall nothing shades it, so at full energy it
  gave the room 6–8% more glow than the room's own fireplace (fire passes compared).
- To make it: `bash hearth-studio-build/render_linear_open.sh`, then
  `var/blendenv/Scripts/python.exe hearth-studio-build/merge_linear_open.py`. The merge uses the
  `linear` version's exposures, checks the zones and camera match, and copies `open_*` into
  `public/hs/assets/scenes/linear`.
