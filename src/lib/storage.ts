import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Customer room photos live outside /public and are served only through an
 * authenticated route. They are pictures of people's homes.
 *
 * Every upload is re-encoded by sharp, which drops EXIF — including the GPS
 * coordinates phones attach by default — while honouring the orientation tag
 * so portrait shots are not served sideways.
 */

/**
 * Anchored to a statically-known path so the build's file tracer does not decide
 * it needs to bundle the entire project into the standalone output. Every join
 * below is marked ignorable for the same reason: these paths are built from
 * server-generated ids, and `readRoomPhoto` re-checks containment before reading.
 */
const ROOT = process.env.UPLOAD_DIR
  ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "var", "uploads");

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const MAX_EDGE = 2400;
const THUMB_EDGE = 480;

export type StoredImage = {
  storageKey: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
};

const userDir = (userId: string) => path.join(/* turbopackIgnore: true */ ROOT, userId);
const fullPath = (key: string) => path.join(/* turbopackIgnore: true */ ROOT, key);
const thumbPath = (key: string) =>
  path.join(/* turbopackIgnore: true */ ROOT, key.replace(/\.webp$/, ".thumb.webp"));

export async function storeRoomPhoto(userId: string, file: File): Promise<StoredImage> {
  const sharp = (await import("sharp")).default;

  const input = Buffer.from(await file.arrayBuffer());
  const dir = userDir(userId);
  await mkdir(dir, { recursive: true });

  const pipeline = sharp(input, { failOn: "error" }).rotate(); // .rotate() applies the EXIF orientation
  const meta = await pipeline.metadata();

  if (!meta.width || !meta.height) throw new Error("Unreadable image");

  const full = await pipeline
    .clone()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await pipeline
    .clone()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const storageKey = path.posix.join(userId, `${randomUUID()}.webp`);
  await writeFile(fullPath(storageKey), full.data);
  await writeFile(thumbPath(storageKey), thumb);

  return {
    storageKey,
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.byteLength,
    mime: "image/webp",
  };
}

export async function readRoomPhoto(storageKey: string, variant: "full" | "thumb" = "full") {
  // storageKey is generated server-side, but never trust a path from the database
  // blindly — refuse anything that escapes the upload root.
  const target = variant === "thumb" ? thumbPath(storageKey) : fullPath(storageKey);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(ROOT) + path.sep)) {
    throw new Error("Refusing to read outside the upload directory");
  }
  return readFile(resolved);
}

export async function deleteRoomPhoto(storageKey: string): Promise<void> {
  await Promise.allSettled([unlink(fullPath(storageKey)), unlink(thumbPath(storageKey))]);
}

/** Product cutouts are catalog assets, not private — these live under /public. */
export const PRODUCT_CUTOUT_DIR = path.join(process.cwd(), "public", "products");

export async function storeProductCutout(slug: string, file: File): Promise<string> {
  const sharp = (await import("sharp")).default;

  await mkdir(PRODUCT_CUTOUT_DIR, { recursive: true });
  const input = Buffer.from(await file.arrayBuffer());

  // Trim the transparent margin so the stored width matches the product's real
  // width — the visualizer scales off that.
  const out = await sharp(input)
    .rotate()
    .trim()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const name = `${slug}-${randomUUID().slice(0, 8)}.png`;
  await writeFile(path.join(/* turbopackIgnore: true */ PRODUCT_CUTOUT_DIR, name), out);
  return `/products/${name}`;
}

/**
 * Stone swatches are catalogue assets like cutouts, but must tile seamlessly —
 * so unlike a cutout they are never trimmed or padded, only re-encoded and
 * capped in size. Cropping one would break the repeat.
 */
export const STONE_SWATCH_DIR = path.join(process.cwd(), "public", "stone");

export async function storeStoneSwatch(slug: string, file: File): Promise<string> {
  const sharp = (await import("sharp")).default;

  await mkdir(STONE_SWATCH_DIR, { recursive: true });
  const input = Buffer.from(await file.arrayBuffer());

  const out = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const name = `${slug}-${randomUUID().slice(0, 8)}.jpg`;
  await writeFile(path.join(/* turbopackIgnore: true */ STONE_SWATCH_DIR, name), out);
  return `/stone/${name}`;
}
