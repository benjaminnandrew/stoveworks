import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type { Client as ReplitClient } from "@replit/object-storage";

/**
 * Where files live: one interface over two places.
 *
 * - "local" (the default off Replit): folders on disk. var/brain-assets holds the
 *   catalog's photos and PDFs, var/uploads everything people upload.
 * - "replit" (the default on Replit): the app's App Storage bucket. A published
 *   Replit app has no lasting disk, so anything written there would be gone
 *   after the next deploy.
 *
 * FILE_STORE=local|replit overrides the default. Files are grouped into areas,
 * each with its own folder (local) or object-name prefix (replit):
 *
 *   area     what                                  local folder           App Storage
 *   catalog  photos + PDFs from the brain (public) var/brain-assets/      images/…, documents/…
 *   media    staff uploads: cutouts, swatches      var/uploads/media/     uploads/media/…
 *            (public)
 *   rooms    customers' room photos (private:      var/uploads/           uploads/rooms/…
 *            served only by /api/photos/<id>)
 *
 * Catalog keys are the brain's storage keys, so the var/brain-assets folders
 * upload to App Storage as they are.
 */

export type Area = "catalog" | "media" | "rooms";

const ON_REPLIT = Boolean(
  process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID,
);

function storeKind(): "local" | "replit" {
  const kind = (process.env.FILE_STORE || (ON_REPLIT ? "replit" : "local")).trim().toLowerCase();
  if (kind !== "local" && kind !== "replit") {
    throw new Error(`FILE_STORE must be "local" or "replit" (it is "${process.env.FILE_STORE}").`);
  }
  return kind;
}

const STORE = storeKind();

/** Byte ranges (PDF viewers fetch the page they need) are only served from disk. */
export const SUPPORTS_RANGES = STORE === "local";

// The paths below are built at runtime and marked ignorable, so the build's file
// tracer doesn't copy var/ (gigabytes of PDFs locally) into the standalone output.
const fromEnv = (value: string | undefined, ...fallback: string[]) =>
  value
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), value)
    : path.join(/* turbopackIgnore: true */ process.cwd(), ...fallback);

const UPLOAD_ROOT = fromEnv(process.env.UPLOAD_DIR, "var", "uploads");

const LOCAL_ROOT: Record<Area, string> = {
  catalog: fromEnv(process.env.BRAIN_ASSETS_DIR, "var", "brain-assets"),
  media: path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, "media"),
  rooms: UPLOAD_ROOT,
};

const OBJECT_PREFIX: Record<Area, string> = {
  catalog: "",
  media: "uploads/media/",
  rooms: "uploads/rooms/",
};

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

/** The content type for a key, or null if it isn't a type this site serves. */
export function contentTypeFor(key: string): string | null {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return null;
  return CONTENT_TYPES[key.slice(dot + 1).toLowerCase()] ?? null;
}

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._()+@,'&%~ -]*$/;

/**
 * A key is a relative path of plain segments: no "..", no hidden files, no
 * backslashes. Every key is checked before it touches a disk or a bucket.
 */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 512 || key.includes("\\") || key.includes("\0")) return false;
  return key.split("/").every((seg) => seg !== "." && seg !== ".." && SEGMENT.test(seg));
}

function checkedKey(key: string): string {
  if (!isSafeKey(key)) throw new Error(`Unsafe file key: ${JSON.stringify(key)}`);
  return key;
}

function localPath(area: Area, key: string): string {
  const root = LOCAL_ROOT[area];
  const full = path.resolve(/* turbopackIgnore: true */ root, checkedKey(key));
  if (!full.startsWith(root + path.sep)) throw new Error("Refusing a path outside the file store");
  return full;
}

const objectName = (area: Area, key: string) => OBJECT_PREFIX[area] + checkedKey(key);

const notFound = (err: unknown) =>
  (err as NodeJS.ErrnoException)?.code === "ENOENT" || (err as NodeJS.ErrnoException)?.code === "ENOTDIR";

/** One App Storage client per process (and per dev-server reload). */
const globalForStore = globalThis as unknown as { __swReplitClient?: Promise<ReplitClient> };

/**
 * Run fn with the App Storage client. The client looks up its bucket once, when
 * it starts; if that fails (no bucket yet, or Replit's storage service briefly
 * unreachable) every later call on it throws, so a throw drops the client and
 * the next request starts a fresh one. Ordinary request errors come back as
 * results, not throws, and keep the client.
 */
async function withReplit<T>(fn: (client: ReplitClient) => Promise<T>): Promise<T> {
  globalForStore.__swReplitClient ??= import("@replit/object-storage").then(({ Client }) => {
    const bucketId = process.env.APP_STORAGE_BUCKET || undefined;
    return new Client(bucketId ? { bucketId } : undefined);
  });
  const pending = globalForStore.__swReplitClient;
  try {
    return await fn(await pending);
  } catch (err) {
    if (globalForStore.__swReplitClient === pending) globalForStore.__swReplitClient = undefined;
    throw err;
  }
}

function failed(action: string, error: { message: string } | string): Error {
  return new Error(`App Storage ${action} failed: ${typeof error === "string" ? error : error.message}`);
}

// --- reading -------------------------------------------------------------------------

export type ByteRange = { start?: number; end?: number; suffix?: number };

export type OpenedFile = {
  body: ReadableStream<Uint8Array>;
  /** Total size in bytes, when the store says (App Storage doesn't, cheaply). */
  size: number | null;
  /** The slice being sent, when a byte range was asked for and satisfied. */
  range: { start: number; end: number } | null;
};

/**
 * Open a file for streaming. Null if it doesn't exist; "unsatisfiable" if a byte
 * range lies outside the file. Ranges are ignored by App Storage, which always
 * sends the whole file.
 */
export async function openFile(
  area: Area,
  key: string,
  range?: ByteRange | null,
): Promise<OpenedFile | "unsatisfiable" | null> {
  if (STORE === "replit") {
    const name = objectName(area, key);
    const exists = await withReplit((client) => client.exists(name));
    if (!exists.ok) throw failed("lookup", exists.error);
    if (!exists.value) return null;
    // Errors while streaming arrive on the stream itself.
    const stream = await withReplit(async (client) => client.downloadAsStream(name));
    return { body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, size: null, range: null };
  }

  const file = localPath(area, key);
  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    size = info.size;
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }

  let slice: { start: number; end: number } | null = null;
  if (range && size > 0) {
    let start: number;
    let end: number;
    if (range.suffix !== undefined) {
      start = Math.max(0, size - range.suffix);
      end = size - 1;
    } else {
      start = range.start ?? 0;
      end = Math.min(range.end ?? size - 1, size - 1);
    }
    if (start >= size || start > end) return "unsatisfiable";
    slice = { start, end };
  }

  const stream = size === 0 ? Readable.from([]) : createReadStream(file, slice ?? {});
  return { body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, size, range: slice };
}

/** Size and existence without reading the file (for HEAD requests). */
export async function statFile(area: Area, key: string): Promise<{ size: number | null } | null> {
  if (STORE === "replit") {
    const name = objectName(area, key);
    const exists = await withReplit((client) => client.exists(name));
    if (!exists.ok) throw failed("lookup", exists.error);
    return exists.value ? { size: null } : null;
  }
  try {
    const info = await stat(localPath(area, key));
    return info.isFile() ? { size: info.size } : null;
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}

/** The whole file in memory, or null if it doesn't exist. For small files. */
export async function readBytes(area: Area, key: string): Promise<Buffer | null> {
  if (STORE === "replit") {
    const name = objectName(area, key);
    const exists = await withReplit((client) => client.exists(name));
    if (!exists.ok) throw failed("lookup", exists.error);
    if (!exists.value) return null;
    const res = await withReplit((client) => client.downloadAsBytes(name));
    if (!res.ok) throw failed("download", res.error);
    return res.value[0];
  }
  try {
    return await readFile(localPath(area, key));
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}

// --- writing -------------------------------------------------------------------------

export async function writeBytes(area: Area, key: string, data: Buffer): Promise<void> {
  if (STORE === "replit") {
    const name = objectName(area, key);
    // Stored as-is: these are already-compressed images.
    const res = await withReplit((client) => client.uploadFromBytes(name, data, { compress: false }));
    if (!res.ok) throw failed("upload", res.error);
    return;
  }
  const file = localPath(area, key);
  await mkdir(path.dirname(file), { recursive: true });
  // Write then rename, so a reader never sees half a file.
  const temp = `${file}.${process.pid}.part`;
  await writeFile(temp, data);
  await rename(temp, file);
}

export async function removeFile(area: Area, key: string): Promise<void> {
  if (STORE === "replit") {
    const name = objectName(area, key);
    const res = await withReplit((client) => client.delete(name, { ignoreNotFound: true }));
    if (!res.ok) throw failed("delete", res.error);
    return;
  }
  try {
    await unlink(localPath(area, key));
  } catch (err) {
    if (!notFound(err)) throw err;
  }
}
