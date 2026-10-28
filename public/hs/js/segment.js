// Photo helper, page side: starts the worker that runs the segmentation model, reports download
// progress, and turns "what's at this spot?" into masks. One picture is encoded at a time.

// Sizes are what the files weigh on disk, so the progress bar can count even when the server compresses.
const FILES = [
  { key: "wasm", url: "vendor/ort/ort-wasm-simd-threaded.wasm", bytes: 11210254 },
  // the .onnx files, or (where the host serves only web file types, as in this preview) their base64 text copies
  { key: "encoder", url: "models/sam-encoder.onnx", bytes: 9753216, alt: "models/sam-encoder.onnx.b64.txt", altBytes: 13004288 },
  { key: "decoder", url: "models/sam-decoder.onnx", bytes: 4753882, alt: "models/sam-decoder.onnx.b64.txt", altBytes: 6338512 },
];
export const DOWNLOAD_MB = Math.round(FILES.reduce((t, f) => t + f.bytes, 0) / 1e6);

let worker = null, loading = null, seq = 0, encodedFor = null, encoding = null;
const pending = new Map();
const subs = new Set();
export const status = { state: "idle", done: 0, total: 1, error: "", threads: 1 };
const emit = () => subs.forEach((f) => { try { f(status); } catch (e) { /* a listener's problem */ } });
export function onStatus(f) { subs.add(f); return () => subs.delete(f); }

/** Can this browser run it at all? (Module workers and WebAssembly with SIMD.) */
export function supported() {
  try {
    if (typeof Worker === "undefined" || typeof WebAssembly !== "object") return false;
    // a tiny module using a SIMD instruction: fails to validate where SIMD is missing
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch (e) { return false; }
}

function call(type, args, transfer) {
  return new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    worker.postMessage({ id, type, args }, transfer || []);
  });
}
function fail(err) {
  status.state = "failed"; status.error = String(err?.message || err || "failed");
  for (const p of pending.values()) p.rej(new Error(status.error));
  pending.clear();
  try { worker && worker.terminate(); } catch (e) { /* gone */ }
  worker = null;
  emit();
}

/** Start the download and the model (once). Resolves when it can encode pictures. */
export function load() {
  if (loading) return loading;
  if (!supported()) { status.state = "failed"; status.error = "unsupported"; emit(); return (loading = Promise.reject(new Error("unsupported"))); }
  status.state = "loading"; status.done = 0; status.total = FILES.reduce((t, f) => t + f.bytes, 0); emit();
  loading = new Promise((res, rej) => {
    try { worker = new Worker(new URL("./segworker.js", import.meta.url), { type: "module" }); }
    catch (e) { fail(e); rej(e); return; }
    let started = false;
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "ready" && !started) {
        started = true;
        call("load", { base: document.baseURI, files: FILES }).then((r) => { status.state = "ready"; status.threads = r.threads; status.done = status.total; emit(); res(); }, (err) => { fail(err); rej(err); });
        return;
      }
      if (m.type === "progress") { status.done = m.done; status.total = m.total; emit(); return; }
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.res(m.result); else p.rej(new Error(m.error));
    };
    worker.onerror = (e) => { e.preventDefault?.(); const err = new Error(e.message || "The photo helper couldn't start"); fail(err); rej(err); };
    worker.onmessageerror = () => { const err = new Error("message error"); fail(err); rej(err); };
  });
  loading.catch(() => {});
  return loading;
}
/** Begin loading in the background (when the customer opens the photo options). */
export function preload() {
  if (navigator.connection?.saveData) return;
  load().catch(() => {});
}

/**
 * Get a picture ready for questions: scaled so its long side is 1024, encoded once (a few seconds).
 * Returns {w, h, k}: the mask size and photo-pixels-to-mask-pixels scale.
 */
export async function encode(canvas) {
  if (encodedFor && encodedFor.canvas === canvas) return encodedFor.info;
  if (encoding && encoding.canvas === canvas) return encoding.p;
  const p = (async () => {
    await load();
    const W = canvas.width, H = canvas.height, k = 1024 / Math.max(W, H);
    const w = Math.round(W * k), h = Math.round(H * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.imageSmoothingQuality = "high";
    x.drawImage(canvas, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data;
    const r = await call("encode", { rgba: px, w, h }, [px.buffer]);
    const info = { w, h, k, ms: r.ms };
    encodedFor = { canvas, info };
    return info;
  })();
  encoding = { canvas, p };
  try { return await p; } finally { if (encoding?.p === p) encoding = null; }
}
export const encodedCanvas = () => encodedFor?.canvas || null;

/**
 * Ask what's at some spots, in mask pixels. points: [[x, y, 1 | 0]]; box: [x0, y0, x1, y1] | null.
 * Resolves {masks: [{w, h, d}], scores, areas}: the model's best single guess first, then three sizes.
 */
export async function segment(canvas, { points = [], box = null } = {}) {
  const info = await encode(canvas);
  if (encodedFor?.canvas !== canvas) throw new Error("stale");
  const r = await call("decode", { points, box });
  return { masks: r.masks.map((d) => ({ w: info.w, h: info.h, d })), scores: r.scores, areas: r.areas, info };
}
