/**
 * Enlarges the "- Since 1975 -" tagline inside the pencil-sketch fireplace logo.
 *
 * NOTE: that logo is not currently in use — the site uses the cast nameplate
 * instead. The pixel bounds below are measured against the sketch artwork and
 * mean nothing for any other image. Kept for if the sketch mark comes back.
 *
 * The tagline is baked into the raster artwork, so it is scaled rather than
 * re-typeset — that keeps the letterforms exactly as the designer drew them,
 * with no font matching to get wrong.
 *
 *   1. Lift the tagline off the artwork as its own soft-edged layer.
 *   2. Inpaint the hole it leaves, so the pencil-sketch flames behind it are
 *      reconstructed rather than punched out.
 *   3. Composite the layer back, scaled, centred on the same point.
 *
 *   node scripts/logo-resize-tagline.mjs [scale]      # default 1.45
 *
 * Writes public/images/logo-hayward-stoveworks.png.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const SCALE = Number(process.argv[2] ?? 1.45);
const SOURCE = path.join(
  process.env.HOME ?? process.env.USERPROFILE,
  "Downloads",
  "hayward-stoveworks-fireplace-since-below-black.png",
);
const OUT = path.join(process.cwd(), "public", "images", "logo-hayward-stoveworks.png");
const MASTER_WIDTH = 1200;

/** Tagline bounds in the trimmed 2162x1180 source, measured from the ink. */
const BOX = { x0: 774, x1: 1351, y0: 845, y1: 893 };
const PAD = 6; // catch antialiased edges

// ---------------------------------------------------------------------------

const trimmed = await sharp(SOURCE).trim({ threshold: 0 }).png().toBuffer();
const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

const base = Buffer.from(data); // mutable copy
const ink = Buffer.alloc(W * H); // 0..255 "how much tagline is here"

const x0 = BOX.x0 - PAD;
const x1 = BOX.x1 + PAD;
const y0 = BOX.y0 - PAD;
const y1 = BOX.y1 + PAD;

for (let y = y0; y <= y1; y += 1) {
  for (let x = x0; x <= x1; x += 1) {
    const i = (y * W + x) * 4;
    const a = data[i + 3];
    if (a < 40) continue;
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    // Solid black is tagline; the sketch sits far lighter than this.
    if (lum > 150) continue;
    // Ramp so antialiased edges come across softly instead of jagged.
    const coverage = Math.min(255, Math.round(((150 - lum) / 150) * (a / 255) * 255));
    ink[y * W + x] = coverage;
  }
}

const inkCount = ink.reduce((n, v) => n + (v > 8 ? 1 : 0), 0);
console.log(`tagline lifted: ${inkCount} px across ${x1 - x0 + 1}x${y1 - y0 + 1}`);

// --- 1. the tagline as its own layer ---------------------------------------

const layerW = x1 - x0 + 1;
const layerH = y1 - y0 + 1;
const layer = Buffer.alloc(layerW * layerH * 4);

for (let y = 0; y < layerH; y += 1) {
  for (let x = 0; x < layerW; x += 1) {
    const src = ((y + y0) * W + (x + x0)) * 4;
    const dst = (y * layerW + x) * 4;
    const cov = ink[(y + y0) * W + (x + x0)];
    layer[dst] = data[src];
    layer[dst + 1] = data[src + 1];
    layer[dst + 2] = data[src + 2];
    layer[dst + 3] = cov;
  }
}

// --- 2. remove it, then inpaint the hole ------------------------------------

// Knock the tagline out of the base, proportionally to its coverage.
for (let y = y0; y <= y1; y += 1) {
  for (let x = x0; x <= x1; x += 1) {
    const cov = ink[y * W + x];
    if (!cov) continue;
    const i = (y * W + x) * 4;
    base[i + 3] = Math.round(base[i + 3] * (1 - cov / 255));
  }
}

// Push-pull fill: repeatedly average each hole pixel from its filled
// neighbours. The holes are thin letter strokes, so this closes in a few
// passes and carries the sketch lines across rather than leaving gaps.
const hole = new Uint8Array(W * H);
for (let y = y0; y <= y1; y += 1) {
  for (let x = x0; x <= x1; x += 1) if (ink[y * W + x] > 8) hole[y * W + x] = 1;
}

for (let pass = 0; pass < 24; pass += 1) {
  let filled = 0;
  const snapshot = Buffer.from(base);
  const stillHole = new Uint8Array(hole);

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!hole[y * W + x]) continue;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (hole[ny * W + nx]) continue;
          const j = (ny * W + nx) * 4;
          r += snapshot[j]; g += snapshot[j + 1]; b += snapshot[j + 2]; a += snapshot[j + 3];
          n += 1;
        }
      }
      if (!n) continue;
      const i = (y * W + x) * 4;
      base[i] = Math.round(r / n);
      base[i + 1] = Math.round(g / n);
      base[i + 2] = Math.round(b / n);
      base[i + 3] = Math.round(a / n);
      stillHole[y * W + x] = 0;
      filled += 1;
    }
  }
  hole.set(stillHole);
  if (!filled) break;
}
console.log(`hole inpainted`);

// --- 3. composite the tagline back, larger ---------------------------------

const scaledW = Math.round(layerW * SCALE);
const scaledH = Math.round(layerH * SCALE);
const scaled = await sharp(layer, { raw: { width: layerW, height: layerH, channels: 4 } })
  .resize(scaledW, scaledH, { kernel: "lanczos3" })
  .png()
  .toBuffer();

// Keep the tagline centred exactly where it was.
const cx = (x0 + x1) / 2;
const cy = (y0 + y1) / 2;
const left = Math.round(cx - scaledW / 2);
const top = Math.round(cy - scaledH / 2);

const cleaned = await sharp(base, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
const composed = await sharp(cleaned)
  .composite([{ input: scaled, left, top }])
  .png()
  .toBuffer();

const master = await sharp(composed)
  .resize({ width: MASTER_WIDTH })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(OUT, master);

const m = await sharp(master).metadata();
console.log(
  `\n✓ tagline scaled ${SCALE}x  (${layerW}x${layerH} -> ${scaledW}x${scaledH})\n` +
    `  wrote ${OUT}  ${m.width}x${m.height}  ${(master.length / 1024).toFixed(0)} KB`,
);
