import type { Occluder } from "@/lib/design-types";
import { project, rectToQuad, type Quad } from "@/lib/homography";
import type { ResolvedItem, ResolvedRegion } from "@/lib/studio";
import type { Region, StoneSwatch } from "@/lib/veneer-types";

type Photo = { url: string; width: number; height: number };

export type ExportView = { label: string | null; items: ResolvedItem[]; regions: ResolvedRegion[] };

/**
 * Renders the design to a full-resolution PNG and hands it to the browser as a
 * download — one picture, or A and B side by side when comparing.
 *
 * Each view is drawn the way the editor stacks it: the room, the stone, the
 * parts of the photo that stand in front of the wall, then the products.
 * Everything is in the same percentage space the editor uses, scaled to the
 * photo's real pixel size, so what the customer arranged is what they get.
 *
 * A 2D canvas can only do affine transforms, so each stone area's projective
 * mapping is approximated by subdividing it into a grid and drawing each cell
 * as two affine-textured triangles. With enough cells the error is far below a
 * pixel, and the result matches what CSS `matrix3d` put on screen — both are
 * driven by the same homography from src/lib/homography.ts.
 */
const GRID = 24;
const GAP = 24;
const LABEL_H = 56;

export async function exportDesign(
  photo: Photo,
  views: ExportView[],
  occluders: Occluder[],
  filename: string,
): Promise<void> {
  const room = await loadImage(photo.url);
  const images = new Map<string, HTMLImageElement>();
  const image = async (src: string) => {
    if (!images.has(src)) images.set(src, await loadImage(src));
    return images.get(src)!;
  };

  const labelled = views.length > 1;
  const canvas = document.createElement("canvas");
  canvas.width = photo.width * views.length + GAP * (views.length - 1);
  canvas.height = photo.height + (labelled ? LABEL_H : 0);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const [i, view] of views.entries()) {
    const panel = document.createElement("canvas");
    panel.width = photo.width;
    panel.height = photo.height;
    const pctx = panel.getContext("2d")!;
    pctx.drawImage(room, 0, 0, panel.width, panel.height);

    for (const { region, stone } of view.regions) {
      drawRegion(pctx, panel.width, panel.height, region, stone, await image(stone.image));
    }
    if (view.regions.length > 0) drawInFront(pctx, room, occluders);
    for (const { item, product } of view.items) {
      drawItem(pctx, panel.width, panel.height, item, await image(product.image));
    }

    const x = i * (photo.width + GAP);
    ctx.drawImage(panel, x, 0);
    if (labelled && view.label) {
      ctx.fillStyle = "#111";
      ctx.font = `600 ${Math.round(LABEL_H * 0.42)}px "Source Sans 3", system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(view.label, x + 4, photo.height + LABEL_H / 2);
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the image");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(filename)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Re-paints the parts of the photo that stand in front of the wall. */
function drawInFront(ctx: CanvasRenderingContext2D, room: HTMLImageElement, occluders: Occluder[]) {
  if (occluders.length === 0) return;
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.beginPath();
  for (const o of occluders) {
    o.points.forEach((p, i) => {
      const x = (p.x / 100) * width;
      const y = (p.y / 100) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  // Nonzero: overlapping shapes add up rather than cancelling each other out.
  ctx.clip("nonzero");
  ctx.drawImage(room, 0, 0, width, height);
  ctx.restore();
}

/** A product, bottom-centre anchored, with its contact shadow drawn first. */
function drawItem(
  ctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  item: ResolvedItem["item"],
  img: HTMLImageElement,
) {
  const width = (item.widthPct / 100) * stageW;
  const height = width * (img.naturalHeight / img.naturalWidth || 1);
  ctx.save();
  ctx.translate((item.xPct / 100) * stageW, (item.yPct / 100) * stageH);
  ctx.rotate((item.rotation * Math.PI) / 180);

  if (item.shadow > 0) {
    ctx.save();
    ctx.globalAlpha = item.shadow * 0.55;
    ctx.filter = `blur(${Math.max(2, width * 0.045)}px)`;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, -height * 0.012, width * 0.52, width * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (item.flipped) ctx.scale(-1, 1);
  ctx.drawImage(img, -width / 2, -height, width, height);
  ctx.restore();
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  region: Region,
  stone: StoneSwatch,
  tile: HTMLImageElement,
) {
  // Region-local space, proportional to the real wall — the same convention the
  // on-screen component uses.
  const refW = 1000;
  const refH = Math.max(1, Math.round((refW * region.realHeightIn) / region.realWidthIn));

  const quad = region.corners.map((c) => ({
    x: (c.x / 100) * stageW,
    y: (c.y / 100) * stageH,
  })) as unknown as Quad;

  const m = rectToQuad(refW, refH, quad);

  // Paint the tiled, colour-adjusted stone once into an offscreen buffer, then
  // warp that. Tiling in flat space is exact; tiling per-triangle would seam.
  const flat = document.createElement("canvas");
  flat.width = refW;
  flat.height = refH;
  const fctx = flat.getContext("2d")!;

  const tilePxW = (refW * stone.tileWidthIn) / region.realWidthIn;
  const tilePxH = (refH * stone.tileHeightIn) / region.realHeightIn;

  const pattern = fctx.createPattern(tile, "repeat")!;
  pattern.setTransform(new DOMMatrix([tilePxW / tile.naturalWidth, 0, 0, tilePxH / tile.naturalHeight, 0, 0]));
  fctx.fillStyle = pattern;
  fctx.filter = `brightness(${region.brightness}) contrast(${region.contrast})`;
  fctx.fillRect(0, 0, refW, refH);
  fctx.filter = "none";

  // Punch the openings before warping, so they follow the perspective.
  fctx.globalCompositeOperation = "destination-out";
  for (const hole of region.holes) {
    fctx.fillStyle = "#000";
    fctx.fillRect(
      (hole.xPct / 100) * refW,
      (hole.yPct / 100) * refH,
      (hole.wPct / 100) * refW,
      (hole.hPct / 100) * refH,
    );
  }
  fctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalAlpha = region.opacity;

  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      const u0 = (col / GRID) * refW;
      const u1 = ((col + 1) / GRID) * refW;
      const v0 = (row / GRID) * refH;
      const v1 = ((row + 1) / GRID) * refH;

      const p00 = project(m, u0, v0);
      const p10 = project(m, u1, v0);
      const p11 = project(m, u1, v1);
      const p01 = project(m, u0, v1);

      drawTriangle(ctx, flat, u0, v0, u1, v0, u0, v1, p00, p10, p01);
      drawTriangle(ctx, flat, u1, v0, u1, v1, u0, v1, p10, p11, p01);
    }
  }

  ctx.restore();
}

/**
 * Draws the source triangle (s*) onto the destination triangle (d*) using the
 * affine transform that maps one to the other, clipped to the destination.
 */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  d0: { x: number; y: number },
  d1: { x: number; y: number },
  d2: { x: number; y: number },
) {
  const denom = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (Math.abs(denom) < 1e-9) return;

  const a = ((d1.x - d0.x) * (sy2 - sy0) - (d2.x - d0.x) * (sy1 - sy0)) / denom;
  const b = ((d2.x - d0.x) * (sx1 - sx0) - (d1.x - d0.x) * (sx2 - sx0)) / denom;
  const c = ((d1.y - d0.y) * (sy2 - sy0) - (d2.y - d0.y) * (sy1 - sy0)) / denom;
  const d = ((d2.y - d0.y) * (sx1 - sx0) - (d1.y - d0.y) * (sx2 - sx0)) / denom;
  const e = d0.x - a * sx0 - b * sy0;
  const f = d0.y - c * sx0 - d * sy0;

  // Push each vertex a hair outward from the centroid before clipping. Without
  // this, antialiasing along the shared edges leaves a faint grid of seams
  // across the whole wall.
  const cx = (d0.x + d1.x + d2.x) / 3;
  const cy = (d0.y + d1.y + d2.y) / 3;
  const grow = (p: { x: number; y: number }) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const k = (len + 0.6) / len;
    return { x: cx + dx * k, y: cy + dy * k };
  };
  const g0 = grow(d0);
  const g1 = grow(d1);
  const g2 = grow(d2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y);
  ctx.lineTo(g1.x, g1.y);
  ctx.lineTo(g2.x, g2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, c, b, d, e, f);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "design";
