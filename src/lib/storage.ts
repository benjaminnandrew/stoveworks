import "server-only";

import { randomUUID } from "node:crypto";

import { readBytes, removeFile, writeBytes } from "@/lib/file-store";

/**
 * Customer room photos are private and served only through an authenticated
 * route (/api/photos/<id>). They are pictures of people's homes.
 *
 * Every upload is re-encoded by sharp, which drops EXIF — including the GPS
 * coordinates phones attach by default — while honouring the orientation tag
 * so portrait shots are not served sideways.
 *
 * Where the bytes live is the file store's business (src/lib/file-store.ts):
 * folders under var/ locally, the app's App Storage bucket on Replit.
 */

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

/** Keys look like <userId>/<uuid>.webp, with the thumbnail beside it. */
const thumbKey = (key: string) => key.replace(/\.webp$/, ".thumb.webp");

export async function storeRoomPhoto(userId: string, file: File): Promise<StoredImage> {
  const sharp = (await import("sharp")).default;

  const input = Buffer.from(await file.arrayBuffer());

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

  const storageKey = `${userId}/${randomUUID()}.webp`;
  await writeBytes("rooms", storageKey, full.data);
  await writeBytes("rooms", thumbKey(storageKey), thumb);

  return {
    storageKey,
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.byteLength,
    mime: "image/webp",
  };
}

export async function readRoomPhoto(storageKey: string, variant: "full" | "thumb" = "full") {
  // storageKey is generated server-side, but the file store still refuses any key
  // that could escape its folder.
  const data = await readBytes("rooms", variant === "thumb" ? thumbKey(storageKey) : storageKey);
  if (!data) throw new Error("Room photo not found");
  return data;
}

export async function deleteRoomPhoto(storageKey: string): Promise<void> {
  await Promise.allSettled([removeFile("rooms", storageKey), removeFile("rooms", thumbKey(storageKey))]);
}

/** A slug as a safe file-name stem. */
const stem = (slug: string, fallback: string) =>
  slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || fallback;

/**
 * Product cutouts are catalog assets, not private. They go to the file store's
 * public "media" area and are served at /files/media/products/<name>. (Writing
 * them into /public would not survive: Next only serves files that were in
 * /public at build time, and a published Replit app has no lasting disk.)
 */
export async function storeProductCutout(slug: string, file: File): Promise<string> {
  const sharp = (await import("sharp")).default;

  const input = Buffer.from(await file.arrayBuffer());

  // Trim the transparent margin so the stored width matches the product's real
  // width — the visualizer scales off that.
  const out = await sharp(input)
    .rotate()
    .trim()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const name = `${stem(slug, "product")}-${randomUUID().slice(0, 8)}.png`;
  await writeBytes("media", `products/${name}`, out);
  return `/files/media/products/${name}`;
}

/**
 * Stone swatches are catalogue assets like cutouts, but must tile seamlessly —
 * so unlike a cutout they are never trimmed or padded, only re-encoded and
 * capped in size. Cropping one would break the repeat.
 */
export async function storeStoneSwatch(slug: string, file: File): Promise<string> {
  const sharp = (await import("sharp")).default;

  const input = Buffer.from(await file.arrayBuffer());

  const out = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const name = `${stem(slug, "stone")}-${randomUUID().slice(0, 8)}.jpg`;
  await writeBytes("media", `stone/${name}`, out);
  return `/files/media/stone/${name}`;
}
