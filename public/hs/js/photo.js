// Customer-photo processing: light extraction, masks, magic select.
// All CPU work happens on a reduced working copy; results upload as textures.

/** Inverse of the shared tone curve (ACES fit + sRGB) for one channel value 0..1. */
export function invTone(y) {
  // sRGB -> linear display
  const l = y <= 0.04045 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4);
  const yy = Math.min(l, 0.9999);
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  const A = yy * c - a, B = yy * d - b, C = yy * e;
  const disc = Math.max(B * B - 4 * A * C, 0);
  const x = (-B - Math.sqrt(disc)) / (2 * A);
  return Math.max(x, 0);
}
const INV_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) INV_LUT[i] = invTone(i / 255);

/** Load a File/Blob into a canvas (max long edge), honoring EXIF orientation via <img>. */
export async function loadPhotoFile(file, maxEdge = 2400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("This file isn't an image we can open. Try a JPEG or PNG photo.")); i.src = url; });
    return imageToCanvas(img, maxEdge);
  } finally { URL.revokeObjectURL(url); }
}

export function imageToCanvas(img, maxEdge = 2400) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const k = Math.min(1, maxEdge / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function boxBlur(src, dst, w, h, r) {
  // horizontal
  const tmp = new Float32Array(w * h);
  const iw = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * iw;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * iw;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}
function gauss(a, w, h, r) {
  const b = new Float32Array(a.length);
  boxBlur(a, b, w, h, r); boxBlur(b, a, w, h, r); boxBlur(a, b, w, h, r);
  return b;
}

/**
 * Light falling on the wall, from the photo itself (normalized convolution).
 * weight: Float32Array (w*h, 0..1) = wall pixels we trust (outline minus things in front/openings).
 * Returns {w, h, data: Float32Array RGBA linear irradiance (wall albedo assumed), grad:[gx,gy]}
 */
export function extractLight(photoCanvas, weightCanvas, { workW = 560, wallAlbedo = 0.72, radiusFrac = 0.035, keepColor = 0.5, keepColorFor = null } = {}) {
  const W = photoCanvas.width, H = photoCanvas.height;
  const k = Math.min(1, workW / W);
  const w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(photoCanvas, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(weightCanvas, 0, 0, w, h);
  const wt = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), Wt = new Float32Array(n);
  let sumW = 0, sumL = 0, rawR = 0, rawG = 0, rawB = 0;
  const scene = [];
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    let wv = wt[i * 4] / 255;
    const mx = Math.max(r, g, b);
    if (mx > 252 || mx < 6) wv *= 0.15;         // clipped highlights / crushed shadows
    const lr = INV_LUT[r] / wallAlbedo, lg = INV_LUT[g] / wallAlbedo, lb = INV_LUT[b] / wallAlbedo;
    R[i] = lr * wv; G[i] = lg * wv; B[i] = lb * wv; Wt[i] = wv;
    sumW += wv; sumL += (0.2126 * lr + 0.7152 * lg + 0.0722 * lb) * wv;
    rawR += INV_LUT[r] * wv; rawG += INV_LUT[g] * wv; rawB += INV_LUT[b] * wv;
    if ((i & 3) === 0 && mx <= 250 && mx >= 6) scene.push(0.2126 * INV_LUT[r] + 0.7152 * INV_LUT[g] + 0.0722 * INV_LUT[b]);
  }
  const meanL = sumW > 0 ? sumL / sumW : 0.5;
  // what the wall looks like now, and how bright the room is around it (to judge the wall's material)
  scene.sort((a, b) => a - b);
  const stats = {
    wallRGB: sumW > 0 ? [rawR / sumW, rawG / sumW, rawB / sumW] : null,
    wallLum: sumW > 0 ? (0.2126 * rawR + 0.7152 * rawG + 0.0722 * rawB) / sumW : 0,
    sceneP75: scene.length ? scene[Math.floor(scene.length * 0.75)] : 0,
  };
  if (keepColorFor) keepColor = keepColorFor(stats);
  const rad = Math.max(2, Math.round(radiusFrac * Math.max(w, h)));
  const bR = gauss(R, w, h, rad), bG = gauss(G, w, h, rad), bB = gauss(B, w, h, rad), bW = gauss(Wt, w, h, rad);
  // far field (very wide) to fill areas with no wall nearby
  const fR = gauss(R.slice(), w, h, rad * 4), fG = gauss(G.slice(), w, h, rad * 4), fB = gauss(B.slice(), w, h, rad * 4), fW = gauss(Wt.slice(), w, h, rad * 4);
  const out = new Float32Array(n * 4);
  const cx = w / 2, cy = h / 2;
  // weighted least-squares plane fit of log-brightness over trusted wall pixels -> light direction
  let sw = 0, sx = 0, sy = 0, sl = 0;
  const Ls = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r, g, b;
    if (bW[i] > 0.02) { r = bR[i] / bW[i]; g = bG[i] / bW[i]; b = bB[i] / bW[i]; }
    else if (fW[i] > 0.002) { r = fR[i] / fW[i]; g = fG[i] / fW[i]; b = fB[i] / fW[i]; }
    else { r = g = b = meanL; }
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    Ls[i] = L;
    // keep part of the light's color; the rest is neutral (the wall paint color is unknown)
    out[i * 4] = L + (r - L) * keepColor; out[i * 4 + 1] = L + (g - L) * keepColor; out[i * 4 + 2] = L + (b - L) * keepColor; out[i * 4 + 3] = 1;
    const wv = Wt[i];
    if (wv > 0.5) { const x = i % w - cx, y = cy - ((i / w) | 0), l = Math.log(Math.max(L, 1e-4)); sw += wv; sx += wv * x; sy += wv * y; sl += wv * l; }
  }
  let gx = 0, gy = 0.15;
  if (sw > 50) {
    const mx = sx / sw, my = sy / sw, ml = sl / sw;
    let sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
    for (let i = 0; i < n; i++) {
      const wv = Wt[i];
      if (wv <= 0.5) continue;
      const x = i % w - cx - mx, y = cy - ((i / w) | 0) - my, l = Math.log(Math.max(Ls[i], 1e-4)) - ml;
      sxx += wv * x * x; syy += wv * y * y; sxy += wv * x * y; sxl += wv * x * l; syl += wv * y * l;
    }
    const det = sxx * syy - sxy * sxy;
    if (Math.abs(det) > 1e-9) {
      const bx = (sxl * syy - syl * sxy) / det, by = (syl * sxx - sxl * sxy) / det;
      gx = Math.max(-0.8, Math.min(0.8, bx * w * 0.5));
      gy = Math.max(-0.6, Math.min(0.8, by * h * 0.5 + 0.15));
    }
  }
  return { w, h, data: out, grad: [gx, gy], mean: meanL, stats };
}

/** Rasterize one polygon, or a list of polygons (image px), as white on transparent. */
export function polyMask(W, H, polys, scale = 1) {
  const list = polys.length && typeof polys[0][0] === "number" ? [polys] : polys;
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W * scale)); c.height = Math.max(1, Math.round(H * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  for (const poly of list) {
    if (!poly || poly.length < 3) continue;
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)));
    ctx.closePath(); ctx.fill();
  }
  return c;
}

/** A black copy of a painted mask. Drawn over a coverage canvas, it cuts the painted parts out. */
export function blackCut(src) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const x = c.getContext("2d");
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Pack up to 6 surface coverages into two RGB canvases (3 surfaces each).
 * zonePolys[k] = the polygons of surface k (its sections); cuts = black-cut canvases for
 * "in front" and "opening" paint. Pure canvas compositing, so it can run while a point is dragged.
 */
export function packMasks(W, H, zonePolys, cuts = []) {
  const cols = ["#ff0000", "#00ff00", "#0000ff"];
  return [0, 1].map((ci) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "lighter";            // sections of one surface add up (union)
    for (let ch = 0; ch < 3; ch++) {
      const polys = zonePolys[ci * 3 + ch]; if (!polys) continue;
      x.fillStyle = cols[ch];
      for (const poly of polys) {
        if (!poly || poly.length < 3) continue;
        x.beginPath(); poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
      }
    }
    x.globalCompositeOperation = "source-over";
    for (const cut of cuts) if (cut) x.drawImage(cut, 0, 0);
    return c;
  });
}

/** Weight map for light extraction: union of outlines minus painted areas. */
export function wallWeight(W, H, polys, occ, open) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  for (const poly of polys) {
    if (!poly || poly.length < 3) continue;
    ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = "destination-out";
  if (occ) ctx.drawImage(occ, 0, 0);
  if (open) ctx.drawImage(open, 0, 0);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  return c;
}

/**
 * Magic select: flood fill from (sx, sy) over similar color, stopping at strong edges.
 * Returns a canvas (image size) with the region painted white (alpha).
 */
export function magicSelect(photoCanvas, sx, sy, tolerance = 28, limitPoly = null) {
  const W = photoCanvas.width, H = photoCanvas.height;
  const k = Math.min(1, 900 / Math.max(W, H));
  const w = Math.round(W * k), h = Math.round(H * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.filter = "blur(1px)";
  ctx.drawImage(photoCanvas, 0, 0, w, h);
  ctx.filter = "none";
  const d = ctx.getImageData(0, 0, w, h).data;
  const x0 = Math.round(sx * k), y0 = Math.round(sy * k);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return null;
  // seed color = mean of 5x5 window
  let sr = 0, sg = 0, sb = 0, cnt = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = Math.min(w - 1, Math.max(0, x0 + dx)), y = Math.min(h - 1, Math.max(0, y0 + dy)), p = (y * w + x) * 4;
    sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; cnt++;
  }
  sr /= cnt; sg /= cnt; sb /= cnt;
  const sel = new Uint8Array(w * h);
  const stack = [y0 * w + x0];
  const tol2 = tolerance * tolerance;
  sel[y0 * w + x0] = 1;
  let filled = 0;
  while (stack.length) {
    const i = stack.pop();
    filled++;
    const x = i % w, y = (i / w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) {
      if (j < 0 || sel[j]) continue;
      const p = j * 4;
      const dr = d[p] - sr, dg = d[p + 1] - sg, db = d[p + 2] - sb;
      // weighted distance (green carries most luminance) + local edge penalty
      const dist2 = 0.3 * dr * dr + 0.5 * dg * dg + 0.2 * db * db;
      const q = i * 4;
      const er = d[p] - d[q], eg = d[p + 1] - d[q + 1], eb = d[p + 2] - d[q + 2];
      const edge2 = er * er + eg * eg + eb * eb;
      if (dist2 <= tol2 && edge2 < tol2 * 1.2) { sel[j] = 1; stack.push(j); }
    }
    if (filled > w * h * 0.6) break;   // runaway: probably selected the whole wall
  }
  // close small holes: dilate then erode once
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const sm = document.createElement("canvas"); sm.width = w; sm.height = h;
  const sctx = sm.getContext("2d");
  const id = sctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = sel[i] ? 255 : 0; id.data[i * 4] = 255; id.data[i * 4 + 1] = 255; id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = v; }
  sctx.putImageData(id, 0, 0);
  return { canvas: drawMagic(sm, W, H), small: sm, fraction: filled / (w * h) };
}

/** Scale a magic-select result up to photo size (softened edge). */
export function drawMagic(small, W, H, into = null) {
  const out = into || (() => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; })();
  const octx = out.getContext("2d");
  octx.filter = "blur(1.2px)";
  octx.drawImage(small, 0, 0, W, H);
  octx.filter = "none";
  return out;
}

/** Area (sq in) of painted openings inside a surface's sections, using the wall mapping. */
export function paintedAreaOnWall(maskCanvas, polys, Hpix, maxW = 700) {
  if (!maskCanvas || !polys || !polys.length) return 0;
  const W = maskCanvas.width, H = maskCanvas.height;
  const k = Math.min(1, maxW / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(maskCanvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const inside = polyMask(W, H, polys, k).getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const map = (x, y) => {
    const ww = Hpix[2][0] * x + Hpix[2][1] * y + Hpix[2][2];
    return [(Hpix[0][0] * x + Hpix[0][1] * y + Hpix[0][2]) / ww, (Hpix[1][0] * x + Hpix[1][1] * y + Hpix[1][2]) / ww];
  };
  const s = 1 / k;
  let area = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const a = (d[p + 3] / 255) * (inside[p + 3] / 255);
      if (a < 0.02) continue;
      const X = x * s, Y = y * s;
      const p0 = map(X, Y), p1 = map(X + s, Y), p2 = map(X, Y + s);
      area += a * Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]));
    }
  }
  return area;
}
