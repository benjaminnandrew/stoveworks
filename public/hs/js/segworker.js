// Photo helper, worker side: runs the segmentation model (MobileSAM image encoder + SAM mask decoder,
// ONNX, through ONNX Runtime Web on WebAssembly) off the main thread, so the page keeps moving while
// it works. Messages in: load, encode, decode. Messages out: progress, a reply per request id.
import * as ort from "../vendor/ort/ort.wasm.min.mjs";

const SIZE = 1024;                          // the encoder's input is 1024 x 1024
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
let enc = null, dec = null, emb = null, cur = null;   // cur = {w, h}: the encoded picture's size (long side 1024)

const post = (m, transfer) => self.postMessage(m, transfer || []);

/** Fetch a file, reporting bytes as they arrive. `expect` keeps the bar honest when the server compresses. */
async function fetchBytes(url, expect, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url.split("/").pop()} (${res.status})`);
  if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); onBytes(b.length); return b; }
  const reader = res.body.getReader();
  const parts = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length; onBytes(got);
  }
  const out = new Uint8Array(got); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Base64 text (as ASCII bytes) back to bytes. Hosts that only serve web file types get the models this way. */
function fromBase64(a) {
  const T = new Uint8Array(256).fill(255);
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("").forEach((c, i) => { T[c.charCodeAt(0)] = i; });
  const out = new Uint8Array(Math.floor((a.length * 3) / 4));
  let o = 0, acc = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const v = T[a[i]]; if (v === 255) continue;            // padding, line breaks
    acc = (acc << 6) | v; nb += 6;
    if (nb >= 8) { nb -= 8; out[o++] = (acc >> nb) & 255; }
  }
  return out.subarray(0, o);
}
/** A model file: the .onnx itself, or its base64 text copy where the host can't serve .onnx files. */
async function fetchModel(f, base, onBytes) {
  try {
    const b = await fetchBytes(new URL(f.url, base).href, f.bytes, onBytes);
    if (b.length > 16 && b[0] === 0x08) return b;            // an ONNX file starts with its version field
  } catch (e) { if (!f.alt) throw e; }
  if (!f.alt) throw new Error(`Couldn't load ${f.url}`);
  return fromBase64(await fetchBytes(new URL(f.alt, base).href, f.altBytes, (n) => onBytes(Math.round((n * 3) / 4))));
}

async function load({ base, files }) {
  // files: [{key, url, bytes, alt?, altBytes?}] for the runtime's wasm and the two models
  const got = Object.fromEntries(files.map((f) => [f.key, 0]));
  const total = files.reduce((t, f) => t + f.bytes, 0);
  let last = 0;
  const tick = (key) => (n) => {
    got[key] = n;
    const now = performance.now();
    if (now - last > 120) { last = now; post({ type: "progress", done: Object.values(got).reduce((a, b) => a + b, 0), total }); }
  };
  const bytes = await Promise.all(files.map((f) => (f.alt ? fetchModel(f, base, tick(f.key)) : fetchBytes(new URL(f.url, base).href, f.bytes, tick(f.key)))));
  post({ type: "progress", done: total, total });
  const by = Object.fromEntries(files.map((f, i) => [f.key, bytes[i]]));
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = new URL("../vendor/ort/", import.meta.url).href;
  ort.env.wasm.wasmBinary = by.wasm.buffer;
  const opt = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  enc = await ort.InferenceSession.create(by.encoder, opt);
  dec = await ort.InferenceSession.create(by.decoder, opt);
  return { threads: ort.env.wasm.numThreads };
}

/** rgba: the picture already scaled so its long side is 1024 (w x h). */
async function encode({ rgba, w, h }) {
  const plane = SIZE * SIZE, x = new Float32Array(3 * plane);    // zero padding below and to the right, as SAM was trained
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      const p = (y * w + i) * 4, q = y * SIZE + i;
      x[q] = (rgba[p] / 255 - MEAN[0]) / STD[0];
      x[plane + q] = (rgba[p + 1] / 255 - MEAN[1]) / STD[1];
      x[2 * plane + q] = (rgba[p + 2] / 255 - MEAN[2]) / STD[2];
    }
  }
  const t0 = performance.now();
  const out = await enc.run({ x: new ort.Tensor("float32", x, [1, 3, SIZE, SIZE]) });
  emb = out[enc.outputNames[0]];
  cur = { w, h };
  return { ms: Math.round(performance.now() - t0) };
}

/**
 * points: [[x, y, label]] in the encoded picture's pixels; label 1 = this, 0 = not this.
 * box: [x0, y0, x1, y1] or null. Returns the four masks (the model's single best guess first, then
 * three of different sizes) as 0/1 bytes at w x h, with the model's own score for each.
 */
async function decode({ points = [], box = null }) {
  if (!emb) throw new Error("No picture encoded yet");
  const coords = [], labels = [];
  for (const [x, y, l] of points) { coords.push(x, y); labels.push(l); }
  if (box) { coords.push(box[0], box[1], box[2], box[3]); labels.push(2, 3); }
  else { coords.push(0, 0); labels.push(-1); }
  const n = labels.length;
  const feeds = {
    image_embeddings: emb,
    point_coords: new ort.Tensor("float32", new Float32Array(coords), [1, n, 2]),
    point_labels: new ort.Tensor("float32", new Float32Array(labels), [1, n]),
    mask_input: new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor("float32", new Float32Array([0]), [1]),
    orig_im_size: new ort.Tensor("float32", new Float32Array([cur.h, cur.w]), [2]),
  };
  const out = await dec.run(feeds, ["low_res_masks", "iou_predictions"]);
  const low = out.low_res_masks.data, scores = Array.from(out.iou_predictions.data);
  const k = out.low_res_masks.dims[1];
  const masks = [], areas = [];
  for (let m = 0; m < k; m++) { const r = upsample(low, m * 65536, cur.w, cur.h); masks.push(r.mask); areas.push(r.on / (cur.w * cur.h)); }
  return { masks, scores, areas, w: cur.w, h: cur.h };
}

/** A 256 x 256 logit map covers the padded 1024 square: scale it up (bilinear, like the model's own
 *  post-processing) over just the picture's part and keep what's above zero. */
function upsample(low, off, w, h) {
  const mask = new Uint8Array(w * h);
  let on = 0;
  for (let y = 0; y < h; y++) {
    let v = (y + 0.5) / 4 - 0.5; if (v < 0) v = 0; if (v > 255) v = 255;
    const y0 = Math.floor(v), y1 = Math.min(255, y0 + 1), fy = v - y0;
    const r0 = off + y0 * 256, r1 = off + y1 * 256;
    for (let x = 0; x < w; x++) {
      let u = (x + 0.5) / 4 - 0.5; if (u < 0) u = 0; if (u > 255) u = 255;
      const x0 = Math.floor(u), x1 = Math.min(255, x0 + 1), fx = u - x0;
      const a = low[r0 + x0] + (low[r0 + x1] - low[r0 + x0]) * fx;
      const b = low[r1 + x0] + (low[r1 + x1] - low[r1 + x0]) * fx;
      if (a + (b - a) * fy > 0) { mask[y * w + x] = 1; on++; }
    }
  }
  return { mask, on };
}

self.onmessage = async (e) => {
  const { id, type, args } = e.data || {};
  try {
    let result;
    if (type === "load") result = await load(args);
    else if (type === "encode") result = await encode(args);
    else if (type === "decode") result = await decode(args);
    else throw new Error("Unknown request " + type);
    post({ id, ok: true, result }, result && result.masks ? result.masks.map((m) => m.buffer) : []);
  } catch (err) {
    post({ id, ok: false, error: String(err && err.message || err) });
  }
};
post({ type: "ready" });
