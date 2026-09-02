/**
 * Generates seamlessly tiling placeholder stone textures.
 *
 * These are deliberately generic: they let the veneer tool work and demo before
 * Steve's team has uploaded real Cultured Stone swatches, and they are labelled
 * as placeholders everywhere they appear. They are not, and must not be passed
 * off as, any manufacturer's actual product.
 *
 *   node scripts/generate-stone-tiles.mjs
 *
 * Each tile represents a known real-world area (24" x 16" by default) so the
 * visualiser can scale courses correctly on a wall.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "public", "stone");
const PX_PER_IN = 32;
const TILE_IN = { w: 24, h: 16 };
const W = TILE_IN.w * PX_PER_IN; // 768
const H = TILE_IN.h * PX_PER_IN; // 512

/** Deterministic PRNG, so regenerating gives byte-identical tiles. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

function shade(base, r, spread = 0.16) {
  const t = 1 + (r() - 0.5) * 2 * spread;
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n * t)));
  return `rgb(${clamp(base[0])},${clamp(base[1])},${clamp(base[2])})`;
}

/**
 * Splits a run into pieces that sum to exactly `total`, so the pattern wraps
 * cleanly at the tile edge. That exactness is the whole trick to seamlessness.
 */
function partition(total, min, max, r) {
  const pieces = [];
  let used = 0;
  while (total - used > max) {
    const size = lerp(min, max, r());
    pieces.push(size);
    used += size;
  }
  const remainder = total - used;
  if (remainder < min && pieces.length) pieces[pieces.length - 1] += remainder;
  else pieces.push(remainder);
  return pieces;
}

const JOINT = "#6f6a63";

/** Thin stacked courses, the classic dry-stack ledgestone look. */
function ledgestone(seed, palette) {
  const r = rng(seed);
  const parts = [`<rect width="${W}" height="${H}" fill="${JOINT}"/>`];
  const gap = 1.5;

  let y = 0;
  for (const courseH of partition(H, 2 * PX_PER_IN * 0.55, 2 * PX_PER_IN, r)) {
    // Offset each course so vertical joints never line up.
    const offset = -r() * 6 * PX_PER_IN;
    let x = offset;
    for (const stoneW of partition(W + Math.abs(offset) + 4 * PX_PER_IN, 3 * PX_PER_IN, 11 * PX_PER_IN, r)) {
      const fill = shade(palette, r, 0.22);
      parts.push(
        `<rect x="${(x + gap).toFixed(1)}" y="${(y + gap).toFixed(1)}" ` +
          `width="${Math.max(1, stoneW - gap * 2).toFixed(1)}" height="${Math.max(1, courseH - gap * 2).toFixed(1)}" ` +
          `rx="2" fill="${fill}"/>`,
      );
      // Lit from above: highlight along the top arris, shadow under the bottom
      // and down the right-hand edge. This is what stops it reading as a chart.
      const w = Math.max(1, stoneW - gap * 2);
      const px = (x + gap).toFixed(1);
      parts.push(
        `<rect x="${px}" y="${(y + gap).toFixed(1)}" width="${w.toFixed(1)}" height="3" fill="#ffffff" opacity="0.26"/>`,
      );
      parts.push(
        `<rect x="${px}" y="${(y + courseH - gap - 4).toFixed(1)}" width="${w.toFixed(1)}" height="4" fill="#000000" opacity="0.34"/>`,
      );
      parts.push(
        `<rect x="${(x + stoneW - gap - 3).toFixed(1)}" y="${(y + gap).toFixed(1)}" ` +
          `width="3" height="${Math.max(1, courseH - gap * 2).toFixed(1)}" fill="#000000" opacity="0.22"/>`,
      );
      x += stoneW;
    }
    y += courseH;
  }
  return parts;
}

/** Rounded, irregular cobbles, tightly packed with chinking between. */
function fieldstone(seed, palette) {
  const r = rng(seed);
  const parts = [`<rect width="${W}" height="${H}" fill="${JOINT}"/>`];

  let y = 0;
  // Smaller, more varied stones than a first guess suggests — big even ovals
  // read as eggs, not fieldstone.
  for (const rowH of partition(H, 2.4 * PX_PER_IN, 4 * PX_PER_IN, r)) {
    const offset = -r() * 4 * PX_PER_IN;
    let x = offset;
    for (const cellW of partition(W + Math.abs(offset) + 4 * PX_PER_IN, 2.4 * PX_PER_IN, 5.5 * PX_PER_IN, r)) {
      const fill = shade(palette, r, 0.24);
      const cx = x + cellW / 2;
      const cy = y + rowH / 2;
      // Fill most of the cell so the joint reads as a line, not a background.
      const rx = (cellW / 2) * lerp(0.92, 1.02, r());
      const ry = (rowH / 2) * lerp(0.9, 1.02, r());
      const tilt = (r() - 0.5) * 24;

      parts.push(
        `<g transform="rotate(${tilt.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">` +
          `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" ` +
          `fill="${fill}" stroke="#000" stroke-opacity="0.16" stroke-width="1.5"/>` +
          // A small rim light at the upper left, not a blob across the face.
          `<ellipse cx="${(cx - rx * 0.3).toFixed(1)}" cy="${(cy - ry * 0.42).toFixed(1)}" ` +
          `rx="${(rx * 0.42).toFixed(1)}" ry="${(ry * 0.24).toFixed(1)}" fill="#fff" opacity="0.13"/>` +
          // A shallow shadow catching under the lower edge.
          `<ellipse cx="${(cx + rx * 0.12).toFixed(1)}" cy="${(cy + ry * 0.6).toFixed(1)}" ` +
          `rx="${(rx * 0.62).toFixed(1)}" ry="${(ry * 0.26).toFixed(1)}" fill="#000" opacity="0.15"/>` +
          `</g>`,
      );
      x += cellW;
    }
    y += rowH;
  }
  return parts;
}

/** Running-bond brick, for the Used Brick / Handmade Brick profiles. */
function brick(seed, palette) {
  const r = rng(seed);
  const parts = [`<rect width="${W}" height="${H}" fill="${JOINT}"/>`];
  const courseH = H / 6; // 6 courses over 16in => ~2.67in per course
  const brickW = W / 3; // 3 bricks over 24in => 8in
  const gap = 2.5;

  for (let row = 0; row < 6; row += 1) {
    const y = row * courseH;
    const offset = row % 2 === 0 ? 0 : -brickW / 2;
    for (let i = -1; i < 4; i += 1) {
      const x = offset + i * brickW;
      parts.push(
        `<rect x="${(x + gap).toFixed(1)}" y="${(y + gap).toFixed(1)}" ` +
          `width="${(brickW - gap * 2).toFixed(1)}" height="${(courseH - gap * 2).toFixed(1)}" ` +
          `rx="1.5" fill="${shade(palette, r, 0.12)}"/>`,
      );
    }
  }
  return parts;
}

const TILES = [
  { slug: "ledgestone-grey", build: ledgestone, palette: [138, 136, 130], seed: 11 },
  { slug: "ledgestone-tan", build: ledgestone, palette: [166, 143, 113], seed: 23 },
  { slug: "fieldstone-grey", build: fieldstone, palette: [130, 130, 126], seed: 37 },
  { slug: "fieldstone-warm", build: fieldstone, palette: [158, 132, 106], seed: 41 },
  { slug: "brick-red", build: brick, palette: [150, 84, 70], seed: 53 },
];

await mkdir(OUT_DIR, { recursive: true });

for (const tile of TILES) {
  const body = tile.build(tile.seed, tile.palette).join("\n  ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="bounds"><rect width="${W}" height="${H}"/></clipPath>
  </defs>
  <g clip-path="url(#bounds)">
  ${body}
  </g>
</svg>`;

  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toBuffer();

  const file = path.join(OUT_DIR, `${tile.slug}.png`);
  await writeFile(file, png);
  console.log(`  ${tile.slug}.png  ${W}x${H}  (${TILE_IN.w}" x ${TILE_IN.h}")  ${(png.length / 1024).toFixed(0)} KB`);
}

console.log(`\n✓ ${TILES.length} placeholder tiles written to public/stone/`);
