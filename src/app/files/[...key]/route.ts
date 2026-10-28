import { type NextRequest } from "next/server";

import {
  contentTypeFor,
  isSafeKey,
  openFile,
  statFile,
  SUPPORTS_RANGES,
  type Area,
  type ByteRange,
} from "@/lib/file-store";

/**
 * Public files, from the file store (src/lib/file-store.ts):
 *
 *   /files/images/<brand>/<file>       catalog photo (from the brain)
 *   /files/documents/<brand>/<file>    catalog PDF; the guides open manuals here at #page=N
 *   /files/media/products/<file>       product cutout uploaded at /admin
 *   /files/media/stone/<file>          stone swatch uploaded at /admin/stone
 *
 * Nothing else is reachable through this route. Customers' room photos live in a
 * separate area and are served only by /api/photos/<id>, which checks who's asking.
 */

type Params = { params: Promise<{ key: string[] }> };

function locate(segments: string[]): { area: Area; key: string } | null {
  const [top, sub] = segments;
  if ((top === "images" || top === "documents") && segments.length >= 3) {
    return { area: "catalog", key: segments.join("/") };
  }
  if (top === "media" && (sub === "products" || sub === "stone") && segments.length === 3) {
    return { area: "media", key: segments.slice(1).join("/") };
  }
  return null;
}

/** One byte range ("bytes=0-1023", "bytes=1024-", "bytes=-500"); anything else means the whole file. */
function parseRange(header: string | null): ByteRange | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") return { suffix: Number(m[2]) };
  const start = Number(m[1]);
  const end = m[2] === "" ? undefined : Number(m[2]);
  // "bytes=500-100" isn't a valid range, so it's ignored and the whole file is sent.
  if (end !== undefined && end < start) return null;
  return { start, end };
}

function headersFor(area: Area, key: string, type: string): Headers {
  const name = key.slice(key.lastIndexOf("/") + 1);
  const headers = new Headers({
    "content-type": type,
    "content-disposition": `inline; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"`,
    "x-content-type-options": "nosniff",
    // Staff uploads get a fresh name every time, so they never change. Catalog
    // files keep their names across brain updates, so they're cached for a day.
    "cache-control":
      area === "media"
        ? "public, max-age=31536000, immutable"
        : "public, max-age=86400, stale-while-revalidate=604800",
  });
  // The makers' PDFs are theirs; keep search results pointing at our guides instead.
  if (type === "application/pdf") headers.set("x-robots-tag", "noindex");
  if (SUPPORTS_RANGES) headers.set("accept-ranges", "bytes");
  return headers;
}

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
const unavailable = () =>
  new Response("Files are unavailable right now.", { status: 503, headers: { "content-type": "text/plain" } });

async function serve(request: NextRequest, segments: string[], headOnly: boolean): Promise<Response> {
  const target = locate(segments);
  if (!target || !isSafeKey(target.key)) return notFound();
  const type = contentTypeFor(target.key);
  if (!type) return notFound();
  const headers = headersFor(target.area, target.key, type);

  try {
    if (headOnly) {
      const info = await statFile(target.area, target.key);
      if (!info) return notFound();
      if (info.size !== null) headers.set("content-length", String(info.size));
      return new Response(null, { status: 200, headers });
    }

    const range = SUPPORTS_RANGES ? parseRange(request.headers.get("range")) : null;
    const file = await openFile(target.area, target.key, range);
    if (!file) return notFound();
    if (file === "unsatisfiable") {
      const info = await statFile(target.area, target.key);
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${info?.size ?? "*"}` },
      });
    }

    if (file.range) {
      headers.set("content-range", `bytes ${file.range.start}-${file.range.end}/${file.size}`);
      headers.set("content-length", String(file.range.end - file.range.start + 1));
      return new Response(file.body, { status: 206, headers });
    }
    if (file.size !== null) headers.set("content-length", String(file.size));
    return new Response(file.body, { status: 200, headers });
  } catch (err) {
    console.error(`[files] ${target.area}/${target.key}:`, err);
    return unavailable();
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  return serve(request, (await params).key, false);
}

export async function HEAD(request: NextRequest, { params }: Params) {
  return serve(request, (await params).key, true);
}
