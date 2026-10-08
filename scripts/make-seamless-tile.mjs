/**
 * Turns a photo of a stone wall into a swatch that tiles without seams.
 *
 * A photographed sample doesn't repeat cleanly: laid side by side, its left and
 * right edges meet in a hard vertical line, and its top and bottom in a hard
 * horizontal one. This trims an overlap off one side and the top, then rebuilds
 * the other side out of both edges, switching from one to the other along the
 * path where they look most alike — which on a stone wall is almost always a
 * mortar joint. The result tiles with no straight seam to catch the eye.
 *
 * (The technique is the minimum-error boundary cut from Efros & Freeman's
 * image quilting, applied to the image's own wrap-around.)
 *
 *   node scripts/make-seamless-tile.mjs <input> <output.jpg> [--width-in N]
 *        [--overlap 0.18] [--flatten 0.7]
 *
 *   --width-in   real width the *input* photo covers, in inches. When given, the
 *                real size of the output tile is printed — that's what goes in
 *                the stone's swatch width/height in /admin/stone.
 *   --overlap    share of each edge given over to the blend (0.1–0.3).
 *   --flatten    evens out lighting falloff across the photo (0 = off, 1 = full),
 *                which otherwise shows up as a repeating light-dark band.
 *
 * Uses sharp, already a dependency. Deterministic: same input, same tile.
 */

import sharp from "sharp";

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : fallback;
};

const [input, output] = positional;
if (!input || !output) {
  console.error("usage: node scripts/make-seamless-tile.mjs <input> <output.jpg> [--width-in N] [--overlap 0.18] [--flatten 0.7]");
  process.exit(1);
}

const OVERLAP = Math.min(0.3, Math.max(0.1, option("--overlap", 0.18)));
const FLATTEN = Math.min(1, Math.max(0, option("--flatten", 0.7)));
const WIDTH_IN = option("--width-in", NaN);
const FEATHER = 3;

const { data, info } = await sharp(input).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const C = info.channels;

/** Float RGB image: { w, h, px: Float32Array } */
let img = { w: W, h: H, px: Float32Array.from(data) };

// --- 1. even out the lighting ------------------------------------------------

if (FLATTEN > 0) {
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i += 1) {
    lum[i] = 0.299 * img.px[i * C] + 0.587 * img.px[i * C + 1] + 0.114 * img.px[i * C + 2];
  }
  // A very wide blur is the lighting; dividing it out keeps the stone detail.
  const sigma = Math.max(W, H) / 5;
  const blurred = await sharp(Buffer.from(lum.map((v) => Math.max(0, Math.min(255, v)))), {
    raw: { width: W, height: H, channels: 1 },
  })
    .blur(sigma)
    .raw()
    .toBuffer();
  let mean = 0;
  for (let i = 0; i < W * H; i += 1) mean += blurred[i];
  mean /= W * H;
  for (let i = 0; i < W * H; i += 1) {
    const gain = Math.pow(mean / Math.max(1, blurred[i]), FLATTEN);
    for (let c = 0; c < C; c += 1) img.px[i * C + c] = Math.min(255, img.px[i * C + c] * gain);
  }
}

// --- 2. horizontal wrap: rebuild the left edge from both edges ---------------

const at = (im, x, y, c) => im.px[(y * im.w + x) * C + c];

/** Squared colour difference between two pixels. */
function diff(im, x0, y0, x1, y1) {
  let d = 0;
  for (let c = 0; c < C; c += 1) {
    const e = at(im, x0, y0, c) - at(im, x1, y1, c);
    d += e * e;
  }
  return d;
}

/**
 * Cheapest path across `len` steps through an `span`-wide band, moving at most
 * one cell per step and staying FEATHER cells clear of either edge. With
 * `periodic`, the last cell must land next to the first, so the path closes on
 * itself where the tile wraps.
 */
function cheapestPath(costAt, len, span, periodic) {
  const lo = FEATHER;
  const hi = span - 1 - FEATHER;
  let best = { total: Infinity, path: null };

  // Each cell's cost once, rather than once per candidate start.
  const table = new Float64Array(len * span);
  for (let t = 0; t < len; t += 1) for (let k = 0; k < span; k += 1) table[t * span + k] = costAt(t, k);
  const cost = (t, k) => table[t * span + k];

  const starts = periodic ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : [null];
  for (const start of starts) {
    const acc = new Float64Array(span).fill(Infinity);
    const from = Array.from({ length: len }, () => new Int16Array(span));
    for (let k = lo; k <= hi; k += 1) {
      if (start === null || k === start) acc[k] = cost(0, k);
    }
    for (let t = 1; t < len; t += 1) {
      const next = new Float64Array(span).fill(Infinity);
      for (let k = lo; k <= hi; k += 1) {
        let m = Infinity;
        let arg = k;
        for (let d = -1; d <= 1; d += 1) {
          const j = k + d;
          if (j < lo || j > hi) continue;
          if (acc[j] < m) {
            m = acc[j];
            arg = j;
          }
        }
        if (m === Infinity) continue;
        next[k] = m + cost(t, k);
        from[t][k] = arg;
      }
      acc.set(next);
    }
    for (let k = lo; k <= hi; k += 1) {
      if (periodic && Math.abs(k - start) > 1) continue;
      if (acc[k] < best.total) {
        const path = new Int16Array(len);
        path[len - 1] = k;
        for (let t = len - 1; t > 0; t -= 1) path[t - 1] = from[t][path[t]];
        best = { total: acc[k], path };
      }
    }
  }
  return best.path;
}

/** Linear blend weight for the "from B" side, feathered across the cut. */
const weight = (k, cut) => Math.min(1, Math.max(0, (k - cut + FEATHER) / (2 * FEATHER)));

function wrapHorizontally(im) {
  const ox = Math.round(im.w * OVERLAP);
  const T = im.w - ox;
  // A: the right-hand strip; B: the left-hand strip. Columns k of each line up
  // where the tile wraps.
  const path = cheapestPath((y, k) => diff(im, T + k, y, k, y), im.h, ox, false);
  const out = { w: T, h: im.h, px: new Float32Array(T * im.h * C) };
  for (let y = 0; y < im.h; y += 1) {
    for (let x = 0; x < T; x += 1) {
      for (let c = 0; c < C; c += 1) {
        let v = at(im, x, y, c);
        if (x < ox) {
          const w = weight(x, path[y]);
          v = (1 - w) * at(im, T + x, y, c) + w * at(im, x, y, c);
        }
        out.px[(y * T + x) * C + c] = v;
      }
    }
  }
  return out;
}

// --- 3. vertical wrap: same again for top and bottom -------------------------

function wrapVertically(im) {
  const oy = Math.round(im.h * OVERLAP);
  const T = im.h - oy;
  // The cut runs across the tile, so it has to meet itself where the tile wraps
  // left to right as well — hence periodic.
  const path = cheapestPath((x, k) => diff(im, x, T + k, x, k), im.w, oy, true);
  const out = { w: im.w, h: T, px: new Float32Array(im.w * T * C) };
  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < im.w; x += 1) {
      for (let c = 0; c < C; c += 1) {
        let v = at(im, x, y, c);
        if (y < oy) {
          const w = weight(y, path[x]);
          v = (1 - w) * at(im, x, T + y, c) + w * at(im, x, y, c);
        }
        out.px[(y * im.w + x) * C + c] = v;
      }
    }
  }
  return out;
}

const tile = wrapVertically(wrapHorizontally(img));

await sharp(Buffer.from(tile.px.map((v) => Math.round(Math.max(0, Math.min(255, v))))), {
  raw: { width: tile.w, height: tile.h, channels: C },
})
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(output);

console.log(`✓ ${output}: ${tile.w} × ${tile.h} px (from ${W} × ${H})`);
if (Number.isFinite(WIDTH_IN)) {
  const pxPerIn = W / WIDTH_IN;
  console.log(
    `  covers ${(tile.w / pxPerIn).toFixed(1)}″ × ${(tile.h / pxPerIn).toFixed(1)}″ — enter that as the swatch size.`,
  );
}
