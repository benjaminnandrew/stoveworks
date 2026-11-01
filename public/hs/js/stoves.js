// Hearth Studio: catalog stoves (INTEGRATION.md, section 7).
//
// The store's stove list comes from HS_CONFIG.stoveCatalogUrl (the site's /api/hearth-studio/stoves),
// or assets/stoves/stoves.json in the preview. Each stove is a cutout photo plus the maker's sizes.
// This module works out, for a sample room with a stove spot (the lake cabin's empty hearth):
//   - where the cutout lands: the room's camera and stove spot (scene.json) stand the stove on the
//     hearth at its real size. The part of the photo whose real width is known (imageSpan, which
//     covers imageWidthIn) sets the scale; the photo's lowest point stands on the hearth slab;
//   - the stovepipe from the flue collar, or the capped outlet the photo shows on the top, up to an
//     elbow into the chimney (capsules for the shader);
//   - the box the stove fills (for its contact shadow and its shadow in the sun);
//   - the light on it (measured on a probe box in the room's render: scene.json stoveSpot.light).
// And for a sample room with a fire spot (the family room's built-in, the den's masonry opening), where a
// catalog built-in fireplace's or insert's front goes (placeFace).
// No prices, and nothing about a stove is made up: a stove with no size on file is drawn at a
// typical size and its card says so.

const IN = 0.0254;                 // metres per inch
export const TYPICAL = { w: 24, h: 30, d: 22 };     // freestanding stove with no size on file, inches
export const SIZE_MIN = 0.5, SIZE_MAX = 1.5;        // the Stove size control's range (a final adjustment)
const FUELS = { wood: "Wood stove", gas: "Gas stove", pellet: "Pellet stove", electric: "Electric stove" };

// ------------------------------------------------------------------ catalog
export function normalize(raw) {
  if (!raw || !raw.id || !raw.image || !raw.name) return null;
  const s = { ...raw };
  const num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : null);
  s.id = String(s.id); s.brand = String(s.brand || ""); s.name = String(s.name);
  s.fuel = FUELS[s.fuel] ? s.fuel : "";
  s.kind = ["freestanding", "insert", "fireplace"].includes(s.kind) ? s.kind : "freestanding";
  s.view = ["front", "left34", "right34"].includes(s.view) ? s.view : "front";
  s.flue = ["top", "rear", "none"].includes(s.flue) ? s.flue : s.fuel === "gas" ? "rear" : s.fuel === "electric" ? "none" : "top";
  for (const k of ["widthIn", "heightIn", "depthIn", "imageWidthIn"]) s[k] = num(s[k]);
  const span = Array.isArray(s.imageSpan) ? s.imageSpan.map(Number) : null;
  s.imageSpan = span && span.length === 2 && span[0] >= 0 && span[1] <= 1 && span[1] - span[0] > 0.05 ? span : null;
  const gb = Array.isArray(s.glassBox) ? s.glassBox.map(Number) : null;
  s.glassBox = gb && gb.length === 4 && gb[2] > gb[0] && gb[3] > gb[1] ? gb : null;
  // where the top meets the front, as a fraction of the photo's height: the top of the maker's height
  // (the site's, 30 Oct 2026). With it, the front and the top are each fitted to the room (placeInRoom)
  const tf = Number(s.imageTopFront);
  s.imageTopFront = tf > 0 && tf < 0.9 ? tf : null;
  // where the photo shows the top flue outlet capped (a blanking plate, no collar), as fractions
  // (the site's, 31 Oct 2026): the pipe stands on the top there (placeInRoom)
  const fl = Array.isArray(s.imageFlue) ? s.imageFlue.map(Number) : null;
  s.imageFlue = fl && fl.length === 2 && fl[0] > 0 && fl[0] < 1 && fl[1] > 0 && fl[1] < 1 ? fl : null;
  // A built-in fireplace (the site's, 31 Oct 2026): its viewing area, the maker's published size of
  // what shows inside the front (inches, wide and tall), and where that is in the photo (fractions).
  // It's drawn flat on the room's wall at that size (placeFace). An insert's box is its surround's
  // outer edges, at the manual's surround size (1 Nov 2026)
  const vb = Array.isArray(s.viewingBox) ? s.viewingBox.map(Number) : null;
  s.viewingBox = vb && vb.length === 4 && vb.every((v) => v >= 0 && v <= 1) && vb[2] - vb[0] > 0.05 && vb[3] - vb[1] > 0.02 ? vb : null;
  const vi = Array.isArray(s.viewingIn) ? s.viewingIn.map(num) : null;
  s.viewingIn = vi && vi.length === 2 && vi[0] && vi[1] ? vi : null;
  s.finishes = Array.isArray(s.finishes) ? s.finishes.filter((f) => f && f.name && f.image) : [];
  s.sized = s.kind === "fireplace" || s.kind === "insert" ? !!(s.viewingBox && s.viewingIn) : !!(s.widthIn && s.heightIn);
  // The stove's page on our own site: a path on the site ("/...") or a full http(s) address. The card
  // links there; the maker's page (productUrl) isn't shown (Ben, 28 Oct).
  const pg = typeof s.pageUrl === "string" ? s.pageUrl.trim() : "";
  s.pageUrl = /^(https?:\/\/\S+|\/(?!\/)\S*)$/i.test(pg) ? pg : "";
  return s;
}
/** The stove's page as a phone opens it from a QR code: a path on the site goes on the store's address. */
export function pageForPhone(s, site) {
  if (!s || !s.pageUrl) return "";
  try { return new URL(s.pageUrl, `https://${site}/`).href; } catch (e) { return ""; }
}
export async function loadCatalog(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error(`stove list: ${r.status}`);
  const j = await r.json();
  // a built-in fireplace or an insert is drawn only at its own size (its viewing area): none is guessed
  return (Array.isArray(j) ? j : j.stoves || []).map(normalize).filter(Boolean).filter((s) => s.kind === "freestanding" || ((s.kind === "fireplace" || s.kind === "insert") && s.sized));
}

// ------------------------------------------------------------------ words for the cards
export const stoveName = (s) => `${s.brand ? s.brand + " " : ""}${s.name}`;
const FIREPLACES = { gas: "Gas fireplace", wood: "Wood fireplace", electric: "Electric fireplace" };
const INSERTS = { gas: "Gas insert", wood: "Wood insert", electric: "Electric insert" };
export const fuelWord = (s) => (s.kind === "fireplace" ? FIREPLACES[s.fuel] || "Fireplace" : s.kind === "insert" ? INSERTS[s.fuel] || "Fireplace insert" : FUELS[s.fuel] || "Stove");
/** "stove", "fireplace" or "insert", for the words round it. */
export const kindWord = (s) => (s && (s.kind === "fireplace" || s.kind === "insert") ? s.kind : "stove");
const FR = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];
/** 22.63 -> 22⅝″ (to the nearest eighth, the way spec sheets read). */
export function inches(v) {
  const e = Math.round(v * 8), w = Math.floor(e / 8), f = e % 8;
  return `${w || !f ? w : ""}${FR[f]}″`;
}
export function makerSize(s) {
  if (!s.sized) return "";
  if (s.kind === "fireplace" || s.kind === "insert") return `${inches(s.viewingIn[0])} × ${inches(s.viewingIn[1])} ${s.kind === "insert" ? "surround" : "viewing area"}`;
  return [`${inches(s.widthIn)} wide`, `${inches(s.heightIn)} tall`, s.depthIn ? `${inches(s.depthIn)} deep` : ""].filter(Boolean).join(" · ");
}
/** The size as drawn, in whole inches: what the customer checks against the real thing. */
export function drawnSize(s, k) {
  const d = dims(s);
  return `Drawn about ${Math.round(d.w * k)} in wide and ${Math.round(d.h * k)} in tall`;
}
/** Set by eye: no size on file, or the size control moved it more than a few percent. */
export const byEye = (s, k) => !s.sized || Math.abs(Math.log(k || 1)) > Math.log(1.03);
export function dims(s) {
  return { w: s.widthIn || TYPICAL.w, h: s.heightIn || TYPICAL.h, d: s.depthIn || TYPICAL.d };
}

// ------------------------------------------------------------------ the cutout
/**
 * Reads the cutout once: where its outline is (the lowest point stands on the hearth), the flue
 * collar (the topmost part, for a stove that vents out the top) and, so the light background the
 * photo was cut from doesn't show as a halo when it's scaled down, it gives the see-through and
 * half-see-through pixels the color of the stove next to them (the outline itself is unchanged).
 */
export function prepCutout(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  let top = h, bot = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      if (d[(y * w + i) * 4 + 3] > 128) {
        if (y < top) top = y; if (y > bot) bot = y;
        if (i < left) left = i; if (i > right) right = i;
      }
    }
  }
  if (bot < 0) { top = 0; bot = h - 1; left = 0; right = w - 1; }
  // the lowest point: middle of what's solid in the bottom three rows
  let sx = 0, n = 0;
  for (let y = Math.max(top, bot - 2); y <= bot; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 128) { sx += i; n++; }
  const botX = n ? sx / n : (left + right) / 2;
  // flue collar: what's solid in the top 2.5% of the outline, if that's narrow (a round collar)
  let cl = w, cr = -1;
  const cBand = Math.max(2, Math.round((bot - top) * 0.025));
  for (let y = top; y <= top + cBand; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 128) { if (i < cl) cl = i; if (i > cr) cr = i; }
  const collar = cr > cl && cr - cl < (right - left) * 0.45 ? { x: (cl + cr) / 2, w: cr - cl + 1, y: top } : null;
  // color bleed outward from the solid pixels (8 passes cover the soft edge and a margin past it)
  const solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = d[p * 4 + 3] >= 250 ? 1 : 0;
  const rgb = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p++) if (solid[p]) { rgb[p * 3] = d[p * 4]; rgb[p * 3 + 1] = d[p * 4 + 1]; rgb[p * 3 + 2] = d[p * 4 + 2]; }
  for (let pass = 0; pass < 8; pass++) {
    const add = [];
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < w; i++) {
        const p = y * w + i; if (solid[p]) continue;
        let r = 0, g = 0, b = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const ii = i + dx; if ((!dx && !dy) || ii < 0 || ii >= w) continue;
            const q = yy * w + ii; if (!solid[q]) continue;
            r += rgb[q * 3]; g += rgb[q * 3 + 1]; b += rgb[q * 3 + 2]; k++;
          }
        }
        if (k) add.push(p, r / k, g / k, b / k);
      }
    }
    if (!add.length) break;
    for (let j = 0; j < add.length; j += 4) { const p = add[j]; solid[p] = 1; rgb[p * 3] = add[j + 1]; rgb[p * 3 + 1] = add[j + 2]; rgb[p * 3 + 2] = add[j + 3]; }
  }
  for (let p = 0; p < w * h; p++) {
    if (d[p * 4 + 3] >= 250 || !solid[p]) continue;
    d[p * 4] = rgb[p * 3]; d[p * 4 + 1] = rgb[p * 3 + 1]; d[p * 4 + 2] = rgb[p * 3 + 2];
  }
  x.putImageData(id, 0, 0);
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];
  return { canvas: c, w, h, top, bot, left, right, botX, collar, alpha };
}

// ------------------------------------------------------------------ small vector maths
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulS = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
const mm = (A, B) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = f * g - d * i, Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  return [[A / det, (c * h - b * i) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, (c * d - a * f) / det], [Cc / det, (b * g - a * h) / det, (a * e - b * d) / det]];
}

/** The room's camera: world point (metres) -> scene image px; and px -> world ray. */
export function roomCamera(sj) {
  const { K, R, C } = sj.camera;
  const project = (P) => { const p = mv(R, sub(P, C)); return [K[0][0] * p[0] / p[2] + K[0][2], K[1][1] * p[1] / p[2] + K[1][2], p[2]]; };
  const ray = (x, y) => norm(mtv(R, [(x - K[0][2]) / K[0][0], (y - K[1][2]) / K[1][1], 1]));
  // px -> world direction (unnormalized) as one 3x3: R^T * K^-1
  const Ki = [[1 / K[0][0], 0, -K[0][2] / K[0][0]], [0, 1 / K[1][1], -K[1][2] / K[1][1]], [0, 0, 1]];
  const RtKi = [0, 1, 2].map((i) => [0, 1, 2].map((j) => R[0][i] * Ki[0][j] + R[1][i] * Ki[1][j] + R[2][i] * Ki[2][j]));
  return { K, R, C, project, ray, RtKi, f: K[0][0], fwd: [R[2][0], R[2][1], R[2][2]] };
}

/**
 * Where a stove stands in a sample room. k = the Stove size control (1 = the maker's size),
 * xIn = sideways offset from the stove spot in inches (positive = to the room's +x).
 * Returns the cutout's placement (scene px = t + s * cutout px), the pipe, the box it fills and
 * the screen box it covers.
 */
export function placeInRoom(st, cut, sj, cam, k = 1, xIn = 0) {
  const sp = sj.stoveSpot, dm = dims(st);
  const W = dm.w * IN * k, H = dm.h * IN * k, D = dm.d * IN * k;
  const cx = sp.x + xIn * IN, yb = sp.y_back, yf = yb + D, z0 = sp.z, zt = z0 + H;
  // scale: the photo's measured span is the front of the stove at the top (screen left = +x)
  const span = st.imageSpan || [cut.left / cut.w, (cut.right + 1) / cut.w];
  const Wi = (st.imageSpan && st.imageWidthIn ? st.imageWidthIn : dm.w) * IN * k;
  const a = cam.project([cx + Wi / 2, yf, zt]), b = cam.project([cx - Wi / 2, yf, zt]);
  const spanPx = (span[1] - span[0]) * cut.w;
  const s = (b[0] - a[0]) / spanPx;
  const tx = a[0] - s * span[0] * cut.w;
  // stand it on its lowest point, on the hearth at the front of its footprint
  const footX = tx + s * cut.botX;
  let lo = cx - 3, hi = cx + 3;               // screen x falls as world x rises (screen right = -x)
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (cam.project([m, yf, z0])[0] > footX) lo = m; else hi = m; }
  const fy = cam.project([(lo + hi) / 2, yf, z0])[1];
  const ty = fy - s * cut.bot;
  // Up the photo: makers shoot from above, so their photos show more of the top than the room's
  // camera does, and the front's height comes out wrong from the width's scale alone. With the
  // row where the top meets the front (imageTopFront), the front is fitted floor to that edge (the
  // maker's height) and the top to what the room's camera sees of it (the site's, 30 Oct 2026).
  // ymap: scene y of the top's back, the top's front, the floor; then those cutout rows.
  let ymap;
  if (st.imageTopFront && cut.top < st.imageTopFront * cut.h && st.imageTopFront * cut.h < cut.bot) {
    // the top's front edge where the stove's middle is (the photo's row is measured there), the feet
    // on the hearth where they stand (fy): the room's floor line isn't level on screen, so both ends
    // are placed exactly, each at its own point
    const yft = cam.project([cx, yf, zt])[1];
    const ybt = Math.min(yft, cam.project([cx, yb, zt])[1]);   // none of the top when the camera is below it
    ymap = [ybt, yft, fy, cut.top, st.imageTopFront * cut.h, cut.bot];
  } else {
    const mid = (cut.top + cut.bot) / 2;   // one scale both ways, as before
    ymap = [ty + s * cut.top, ty + s * mid, fy, cut.top, mid, cut.bot];
  }
  const mapY = (row) => row >= ymap[4]
    ? ymap[1] + (row - ymap[4]) * (ymap[2] - ymap[1]) / (ymap[5] - ymap[4])
    : ymap[0] + (row - ymap[3]) * (ymap[1] - ymap[0]) / Math.max(1e-6, ymap[4] - ymap[3]);
  const bbox = [tx + s * cut.left, mapY(cut.top), tx + s * (cut.right + 1), mapY(cut.bot + 1)];
  const place = { s, tx, ty, w: cut.w, h: cut.h, bbox, ymap };
  // the pipe: from the collar's top, straight up, a 90° elbow, then back into the chimney
  let pipe = null;
  if (st.flue === "top") {
    // A capped outlet in the photo (imageFlue, a blanking plate with no collar) stands the pipe on the
    // top where the drawn stove shows the outlet, so it comes out of the top opening. On the stove's
    // own centre line it came up beside the drawn top of a photo shot straight on, as if from behind
    // (the Morsø 6140 and 6148, Ben, 31 Oct 2026)
    const plate = !cut.collar && st.imageFlue && st.imageTopFront ? st.imageFlue : null;
    const col = plate ? { x: plate[0] * cut.w, y: plate[1] * cut.h } : cut.collar || { x: (span[0] + span[1]) / 2 * cut.w, w: 0.25 * spanPx, y: cut.top };
    const P = [tx + s * col.x, mapY(col.y)];
    // collars sit toward the back of the top; a plate is as far back as the photo shows it
    const back = plate ? (col.y - cut.top) / Math.max(1, st.imageTopFront * cut.h - cut.top) : 0.3;
    const yc = yb + Math.min(0.9, Math.max(0.1, back)) * D;
    const r0 = cam.ray(P[0], P[1]);
    const t = (yc - cam.C[1]) / r0[1];
    const base = add3(cam.C, mulS(r0, t));
    if (plate) base[2] = zt;
    const depth = Math.abs((base[0] - cam.C[0]) * cam.fwd[0] + (base[1] - cam.C[1]) * cam.fwd[1] + (base[2] - cam.C[2]) * cam.fwd[2]);
    // a hair inside the collar; with no collar in the photo, 7b's 6″ pipe (a quarter of the width,
    // the old guess, made the narrow Morsø 6140's pipe 4¼″; 30 Oct 2026)
    const rad = cut.collar ? Math.min(0.11, Math.max(0.045, (col.w * s / 2) * depth / cam.f * 0.94)) : 0.0762;
    const faceY = sp.chimney_face_y;
    let Rb = 0.13 * Math.max(0.8, Math.min(1.3, rad / 0.0762));
    if (base[1] - Rb < faceY + 0.03) Rb = Math.max(0.04, base[1] - faceY - 0.03);
    const zRun = Math.max(sp.thimble_z, base[2] + Rb + 0.12);
    // the pipe stands where the photo's own flue collar is. A photo with no collar gives only its top
    // edge, which is the back of the stove: guessing from that put the F 445's pipe 5.3″ off center,
    // so without a collar the pipe stands on the stove's center line (30 Oct 2026)
    const xc = cut.collar || plate ? base[0] : cx, caps = [];
    const capsule = (A, B) => caps.push([A[0], A[1], A[2], rad, B[0], B[1], B[2]]);
    capsule([xc, base[1], base[2] - 0.004], [xc, base[1], zRun - Rb]);
    let prev = [xc, base[1], zRun - Rb];
    for (let i = 1; i <= 6; i++) {
      const th = (Math.PI / 2) * i / 6;
      const q = [xc, base[1] - Rb + Rb * Math.cos(th), zRun - Rb + Rb * Math.sin(th)];
      capsule(prev, q); prev = q;
    }
    capsule(prev, [xc, faceY - 0.01, zRun]);
    // the stovepipe's trim ring on the chimney, round the hole
    const thimble = [xc, faceY + 0.004, zRun, rad + 0.045];
    // standing on the top (top: its height), the pipe is cut flat there and drawn over the top
    pipe = { caps, thimble, rad, base, zRun, top: plate ? zt : null };
    // grow the screen box over the pipe
    for (const c of caps) for (const Q of [[c[0], c[1], c[2]], [c[4], c[5], c[6]]]) {
      const p = cam.project(Q), rr = rad * cam.f / p[2] + 2;
      bbox[0] = Math.min(bbox[0], p[0] - rr); bbox[1] = Math.min(bbox[1], p[1] - rr);
      bbox[2] = Math.max(bbox[2], p[0] + rr); bbox[3] = Math.max(bbox[3], p[1] + rr);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = cam.project([xc + sx * thimble[3], faceY, zRun + sz * thimble[3]]);
      bbox[0] = Math.min(bbox[0], p[0] - 2); bbox[1] = Math.min(bbox[1], p[1] - 2);
      bbox[2] = Math.max(bbox[2], p[0] + 2); bbox[3] = Math.max(bbox[3], p[1] + 2);
    }
  }
  // the box it fills (legs: the lowest fifth is mostly open)
  const box = { min: [cx - W / 2, yb, z0 + 0.2 * H], max: [cx + W / 2, yf, zt] };
  const foot = [cx - W / 2, yb, cx + W / 2, yf];
  // how far off the photo's own perspective puts the top of the front (for the notes and checks)
  const topErr = mapY(cut.top) - Math.min(a[1], b[1]);
  return { place, pipe, box, foot, W, H, D, topErr, frontTop: [a, b] };
}

/**
 * Where a built-in fireplace's or an insert's front goes in a sample room with a fire spot: flat on the
 * wall, the photo straight on, its viewing area the maker's size (the site's, 31 Oct 2026).
 * - A fireplace (the family room): its viewing area centered where the room's own fireplace's is.
 * - An insert (the den, anchor "floor", 1 Nov 2026): centered across the opening, its surround's
 *   bottom (the box's) on the firebox floor, where the makers measure its height from. The photo's
 *   lowest point is often the ash lip, which stands out in front and so shows a little lower.
 * Returns the map from scene px to the photo (fractions; for the engine, and for taps), the screen box
 * it covers, and whether its front covers the room's own fireplace or opening: one that doesn't would
 * show it round the front.
 */
export function placeFace(st, cut, sj, cam) {
  const fs = sj.fireSpot, [vx0, vy0, vx1, vy1] = st.viewingBox;
  const Wv = st.viewingIn[0] * IN, Hv = st.viewingIn[1] * IN;
  // world (x, z) on the wall -> photo fractions. The photo's left is the room's +x (screen left)
  const ax = (vx1 - vx0) / Wv, az = (vy1 - vy0) / Hv;
  const xl = fs.x + Wv / 2, zt = fs.anchor === "floor" ? fs.z + Hv : fs.z + Hv / 2;
  const fu = (x) => vx0 + (xl - x) * ax, fv = (z) => vy0 + (zt - z) * az;
  const A = [[-ax, 0, vx0 + xl * ax], [0, -az, vy0 + zt * az], [0, 0, 1]];
  // world (x, z, 1) -> scene px: the camera on the wall's plane, y = fs.y
  const { K, R, C } = cam, o = mv(R, [-C[0], fs.y - C[1], -C[2]]);
  const M = mm(K, [[R[0][0], R[0][2], o[0]], [R[1][0], R[1][2], o[1]], [R[2][0], R[2][2], o[2]]]);
  const H = mm(A, inv3(M));
  // the front's outline on screen
  const xAt = (u) => xl - (u - vx0) / ax, zAt = (v) => zt - (v - vy0) / az;
  const pts = [[cut.left, cut.top], [cut.right + 1, cut.top], [cut.right + 1, cut.bot + 1], [cut.left, cut.bot + 1]]
    .map(([px, py]) => cam.project([xAt(px / cut.w), fs.y, zAt(py / cut.h)]));
  const bbox = [Math.min(...pts.map((p) => p[0])) - 1, Math.min(...pts.map((p) => p[1])) - 1, Math.max(...pts.map((p) => p[0])) + 1, Math.max(...pts.map((p) => p[1])) + 1];
  // the room's own fireplace (its trim and all) has to be under the front's solid part
  const [cx0, cz0, cx1, cz1] = fs.cover;
  let covers = true;
  for (let i = 0; i <= 24 && covers; i++) {
    for (let j = 0; j <= 8; j++) {
      const px = Math.floor(fu(cx0 + (cx1 - cx0) * i / 24) * cut.w), py = Math.floor(fv(cz0 + (cz1 - cz0) * j / 8) * cut.h);
      if (px < 0 || py < 0 || px >= cut.w || py >= cut.h || cut.alpha[py * cut.w + px] < 200) { covers = false; break; }
    }
  }
  return { H, bbox, covers };
}

/** The light on a stove at the room's stove spot, as measured on the probe box (scene.json). */
export function roomLight(sj, light) {
  const L = sj.stoveSpot?.light?.[light];
  if (L && L.front) return { front: L.front, side: L.side || L.front, top: L.top || L.front, slope: L.slope || 0 };
  return { front: [1, 0.97, 0.92], side: [1, 0.97, 0.92], top: [1.1, 1.07, 1.02], slope: 0 };
}
