/**
 * Standalone file-store helper for the CLI scripts (load-brain).
 *
 * Mirrors src/lib/file-store.ts, which the site uses, without Next's module
 * resolution or its `server-only` guard. Same rule in both: FILE_STORE picks
 * the store, and when it isn't set the store is App Storage on Replit and the
 * local folders everywhere else.
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export function onReplit() {
  return Boolean(process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID);
}

export function storeKind() {
  const kind = (process.env.FILE_STORE || (onReplit() ? "replit" : "local")).trim().toLowerCase();
  if (kind !== "local" && kind !== "replit") {
    throw new Error(`FILE_STORE must be "local" or "replit" (it is "${process.env.FILE_STORE}").`);
  }
  return kind;
}

/** The catalog's folders: photos under images/, PDFs under documents/. */
const CATALOG_TOPS = ["images", "documents"];

/**
 * Every catalog file that is actually in storage, as a map of
 * object path (e.g. "images/jotul/0a1b….jpg") → size in bytes (null when the
 * store doesn't say).
 */
export async function listCatalogFiles() {
  if (storeKind() === "replit") {
    let Client;
    try {
      ({ Client } = await import("@replit/object-storage"));
    } catch {
      throw new Error("The Replit file store needs the @replit/object-storage package. Run `npm install`.");
    }
    const bucketId = process.env.APP_STORAGE_BUCKET || undefined;
    const client = new Client(bucketId ? { bucketId } : undefined);
    const files = new Map();
    for (const top of CATALOG_TOPS) {
      let res;
      try {
        res = await client.list({ prefix: `${top}/` });
      } catch (err) {
        // The client throws (rather than returning an error) when it can't find a bucket.
        res = { ok: false, error: err };
      }
      if (!res.ok) {
        throw new Error(
          `Couldn't read App Storage (${top}/): ${res.error?.message ?? res.error}\n` +
            "  Create a bucket in the App Storage tool first, or run with FILE_STORE=local.",
        );
      }
      for (const object of res.value) files.set(object.name, null);
    }
    return { label: `Replit App Storage${bucketId ? ` (bucket ${bucketId})` : ""}`, files };
  }

  const root = path.resolve(process.env.BRAIN_ASSETS_DIR || path.join("var", "brain-assets"));
  const files = new Map();
  for (const top of CATALOG_TOPS) await walk(path.join(root, top), top, files);
  const shown = path.relative(process.cwd(), root) || root;
  return { label: `${shown.split(path.sep).join("/")} (local folder)`, files };
}

async function walk(dir, key, files) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    // Skip hidden files and the ingest script's half-written downloads.
    if (entry.name.startsWith(".") || entry.name.endsWith(".part")) continue;
    const full = path.join(dir, entry.name);
    const childKey = `${key}/${entry.name}`;
    if (entry.isDirectory()) await walk(full, childKey, files);
    else if (entry.isFile()) files.set(childKey, (await stat(full)).size);
  }
}
