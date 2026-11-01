#!/usr/bin/env node
// Download the Stoveworks brain's product images and PDFs — into a local folder, or into
// Replit Object Storage.
//
// Local folder (no dependencies; run from your own terminal):
//   node brain/scripts/ingest-assets.mjs --manuals --out var/brain-assets   (newest US manuals)
//   node brain/scripts/ingest-assets.mjs --images --out var/brain-assets    (product photos,
//        plus images.html in that folder for browsing them by brand and model)
//
// Replit Object Storage:
//   npm install @replit/object-storage
//   node scripts/ingest-assets.mjs [--images] [--documents]
//
// Options:
//   --out <folder>     save files under <folder>/<storage key> instead of uploading them
//   --manuals          each model's newest US operation & installation manual(s), from
//                      assets/manuals.json (no older, Canadian or French editions, no accessory sheets)
//   --lang <code|all>  document language to keep; default "en" with --manuals, "all" otherwise
//   --brand <slug>     one brand only (e.g. jotul)
//   --images / --documents, --limit N, --concurrency N, --dry-run
//   --gallery          only rewrite <folder>/images.html from what's already downloaded
//
// Each file is fetched politely (two at a time per site, retries on 429/5xx honoring
// Retry-After), checked to really be an image or a PDF, and saved under its storage key.
// Progress is recorded (assets/ingest-results.json, or <folder>/_ingest-results.json), so
// re-running only fetches what is still missing.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const MANUALS = flag("--manuals");
const wantImages = !MANUALS && (flag("--images") || !flag("--documents"));
const wantDocs = MANUALS || flag("--documents") || !flag("--images");
const OUT = option("--out", null);
const LANG = option("--lang", MANUALS ? "en" : "all").toLowerCase();
const BRAND = option("--brand", null);
const LIMIT = Number(option("--limit", Infinity));
const CONCURRENCY = Number(option("--concurrency", 4));
const PER_HOST = 2;
const DRY_RUN = flag("--dry-run");
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 90_000;
const USER_AGENT = "StoveworksCatalog/1.0 (+https://stoveworksinc.com; dealer catalog sync)";
const MANUAL_TYPES = new Set(["installation_manual", "owners_manual"]);
const RESULTS_PATH = OUT ? path.resolve(OUT, "_ingest-results.json") : path.join(ROOT, "assets", "ingest-results.json");

async function loadJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "image/*,application/pdf;q=0.9,*/*;q=0.5" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 5000;
        lastError = new Error(`HTTP ${res.status}`);
        await sleep(Math.min(wait, 120_000));
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { permanent: true });
      const bytes = Buffer.from(await res.arrayBuffer());
      return { bytes, contentType: (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase() };
    } catch (err) {
      lastError = err;
      if (err.permanent) break;
      await sleep(2 ** attempt * 2000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// Identify the file from its first bytes rather than trusting headers or URLs.
function sniff(b) {
  const ascii = (start, end) => b.subarray(start, end).toString("latin1");
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && ascii(8, 11) === "avi") return "avif";
  if (ascii(0, 4) === "II*\0" || ascii(0, 4) === "MM\0*") return "tif";
  if (ascii(0, 5) === "%PDF-") return "pdf";
  const head = b.subarray(0, 1024).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return null;
}

const IMAGE_KINDS = new Set(["png", "jpg", "gif", "webp", "avif", "tif", "svg"]);

function finalKey(entry, kind) {
  if (entry.kind === "document") return entry.storage_key;
  return `${entry.storage_key}.${kind}`;
}

function looksRight(entry, kind, bytes) {
  if (bytes.length < 64) return false;
  return entry.kind === "document" ? kind === "pdf" : IMAGE_KINDS.has(kind);
}

function keep(entry) {
  if (BRAND && entry.brand_slug !== BRAND) return false;
  if (entry.kind !== "document") return true;
  if (MANUALS && !(entry.types || []).some((t) => MANUAL_TYPES.has(t))) return false;
  if (LANG !== "all") {
    const langs = (entry.languages || []).map((l) => String(l || "en").toLowerCase());
    if (!langs.some((l) => l === LANG || l.startsWith(LANG + "-"))) return false;
  }
  return true;
}

// Where each file goes: a local folder, or Replit Object Storage
async function makeSink() {
  if (OUT) {
    const base = path.resolve(OUT);
    return {
      where: base,
      async has(key) {
        try { return (await fs.stat(path.join(base, key))).size > 0; } catch { return false; }
      },
      async put(key, bytes) {
        const file = path.join(base, key);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file + ".part", bytes);
        await fs.rename(file + ".part", file);
      },
    };
  }
  const { Client } = await import("@replit/object-storage");
  const client = new Client();
  return {
    where: "Replit Object Storage",
    async has(key) { const r = await client.exists(key); return Boolean(r.ok && r.value); },
    async put(key, bytes) {
      const up = await client.uploadFromBytes(key, bytes);
      if (!up.ok) throw new Error(`upload failed: ${up.error?.message || up.error}`);
    },
  };
}

// A page for browsing the downloaded photos: <folder>/images.html, grouped by brand and model.
async function writeGallery(results) {
  const models = await loadJson(path.join(ROOT, "data", "models.json"), []);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const brands = new Map();
  let shown = 0, missing = 0;
  for (const m of models) {
    const imgs = (m.images || []).map((i) => ({ ...i, key: results[i.url]?.status === "ok" ? results[i.url].key : null }));
    if (!imgs.length) continue;
    if (!brands.has(m.brand)) brands.set(m.brand, []);
    brands.get(m.brand).push({ m, imgs });
  }
  let body = "";
  for (const [brand, list] of brands) {
    body += `<h2 id="${esc(list[0].m.brand_slug)}">${esc(brand)} <small>${list.length} models</small></h2>`;
    for (const { m, imgs } of list) {
      body += `<section><h3>${esc(m.name)}${m.product_url ? ` <a href="${esc(m.product_url)}" target="_blank" rel="noopener">maker's page ↗</a>` : ""}</h3><div class="grid">`;
      for (const i of imgs) {
        const cap = [i.role ? i.role.replace(/_/g, " ") : null, i.variant].filter(Boolean).map(esc).join(" · ");
        if (i.key) {
          shown++;
          body += `<figure><a href="${esc(i.key)}" target="_blank"><img loading="lazy" src="${esc(i.key)}" alt="${esc(m.name)}"></a><figcaption>${cap}</figcaption></figure>`;
        } else {
          missing++;
          body += `<figure class="miss"><div>not downloaded</div><figcaption>${cap}</figcaption></figure>`;
        }
      }
      body += `</div></section>`;
    }
  }
  const nav = [...brands.entries()].map(([b, l]) => `<a href="#${esc(l[0].m.brand_slug)}">${esc(b)}</a>`).join(" · ");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stoveworks product photos</title><style>
:root{--bg:#f6f3ee;--card:#fff;--ink:#22201c;--soft:#6d655b;--hair:#e2dbd0}
@media (prefers-color-scheme:dark){:root{--bg:#171513;--card:#211e1b;--ink:#efe9e1;--soft:#a39a8e;--hair:#36312b}}
body{margin:0;padding:24px 16px 60px;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
main{max-width:1180px;margin:0 auto} h1{margin:0 0 4px} p.meta{color:var(--soft);margin:0 0 14px} nav{margin-bottom:24px;line-height:2}
nav a,h3 a{color:inherit} h2{margin:36px 0 8px;border-bottom:1px solid var(--hair);padding-bottom:6px} h2 small{color:var(--soft);font-weight:400;font-size:14px}
h3{font-size:16px;margin:20px 0 8px} h3 a{font-weight:400;font-size:13px;color:var(--soft)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
figure{margin:0;background:var(--card);border:1px solid var(--hair);border-radius:10px;overflow:hidden}
figure img{display:block;width:100%;height:130px;object-fit:contain;background:#fff}
figure.miss div{height:130px;display:grid;place-items:center;color:var(--soft);font-size:13px}
figcaption{font-size:12px;color:var(--soft);padding:6px 8px}
</style></head><body><main><h1>Stoveworks product photos</h1>
<p class="meta">${shown} photos downloaded${missing ? `, ${missing} not downloaded yet` : ""} · click a photo for full size</p><nav>${nav}</nav>${body}</main></body></html>`;
  const file = path.resolve(OUT, "images.html");
  await fs.writeFile(file, html);
  console.log(`Photo gallery: ${file}`);
}

async function main() {
  if (flag("--gallery")) {
    if (!OUT) throw new Error("--gallery needs --out <folder>");
    await writeGallery(await loadJson(RESULTS_PATH, {}));
    return;
  }
  let entries = [];
  const curated = MANUALS ? await loadJson(path.join(ROOT, "assets", "manuals.json"), null) : null;
  if (curated) {
    entries = curated; // each model's newest US manual(s), chosen in advance
  } else {
    if (wantImages) entries.push(...(await loadJson(path.join(ROOT, "assets", "images.json"), [])));
    if (wantDocs) entries.push(...(await loadJson(path.join(ROOT, "assets", "documents.json"), [])));
  }
  entries = entries.filter(keep);
  const results = await loadJson(RESULTS_PATH, {});
  const todo = entries.filter((e) => results[e.url]?.status !== "ok").slice(0, LIMIT);
  const hosts = new Set(todo.map((e) => new URL(e.url).host));
  console.log(`${entries.length} files selected, ${entries.length - todo.length} already saved, ${todo.length} to fetch from ${hosts.size} sites${DRY_RUN ? " (dry run)" : ""}.`);
  if (DRY_RUN) return;
  if (todo.length === 0) {
    if (wantImages && OUT) await writeGallery(results);
    return;
  }

  const sink = await makeSink();
  console.log(`Saving to ${sink.where}`);
  await fs.mkdir(path.dirname(RESULTS_PATH), { recursive: true });

  const hostActive = new Map();
  let next = 0, done = 0, ok = 0, failed = 0, sinceSave = 0, totalBytes = 0;

  async function save() {
    await fs.writeFile(RESULTS_PATH, JSON.stringify(results, null, 1));
  }

  async function handle(entry) {
    const host = new URL(entry.url).host;
    while ((hostActive.get(host) || 0) >= PER_HOST) await sleep(250);
    hostActive.set(host, (hostActive.get(host) || 0) + 1);
    try {
      if (entry.kind === "document" && (await sink.has(entry.storage_key))) {
        results[entry.url] = { status: "ok", key: entry.storage_key, model_ids: entry.model_ids, note: "already present", at: new Date().toISOString() };
        ok++;
        return;
      }
      const { bytes, contentType } = await fetchWithRetry(entry.url);
      const kind = sniff(bytes);
      if (!looksRight(entry, kind, bytes)) {
        throw new Error(`unexpected content (${contentType || "unknown type"}, ${bytes.length} bytes)`);
      }
      const key = finalKey(entry, kind);
      if (!(await sink.has(key))) await sink.put(key, bytes);
      totalBytes += bytes.length;
      results[entry.url] = { status: "ok", key, bytes: bytes.length, contentType, model_ids: entry.model_ids, at: new Date().toISOString() };
      ok++;
    } catch (err) {
      results[entry.url] = { status: "failed", error: String(err.message || err), model_ids: entry.model_ids, at: new Date().toISOString() };
      failed++;
    } finally {
      hostActive.set(host, hostActive.get(host) - 1);
      done++;
      if (++sinceSave >= 25) {
        sinceSave = 0;
        await save();
        console.log(`  ${done}/${todo.length} processed (${ok} saved, ${failed} failed, ${(totalBytes / 1e6).toFixed(0)} MB)`);
      }
    }
  }

  async function worker() {
    while (next < todo.length) {
      const entry = todo[next++];
      await handle(entry);
      await sleep(300); // be gentle with manufacturer servers
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  await save();
  console.log(`Done: ${ok} saved, ${failed} failed, ${(totalBytes / 1e6).toFixed(0)} MB downloaded. Details in ${RESULTS_PATH}`);
  if (wantImages && OUT) await writeGallery(results);
  if (failed) console.log("Re-run the same command to retry failures; persistent failures usually mean the manufacturer moved the file.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
