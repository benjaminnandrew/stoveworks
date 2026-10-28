// Masks for the photo helper: {w, h, d} where d is a Uint8Array of 0/1, one per pixel, row by row.
// Everything here is plain arithmetic on those arrays, so it runs the same in tests and in the page.

export const blank = (w, h) => ({ w, h, d: new Uint8Array(w * h) });
export const clone = (m) => ({ w: m.w, h: m.h, d: m.d.slice() });
export function count(m) { let n = 0; const d = m.d; for (let i = 0; i < d.length; i++) n += d[i]; return n; }
export function union(a, b) { const o = clone(a); if (b) for (let i = 0; i < o.d.length; i++) o.d[i] |= b.d[i]; return o; }
export function minus(a, b) { const o = clone(a); if (b) for (let i = 0; i < o.d.length; i++) if (b.d[i]) o.d[i] = 0; return o; }
export function inter(a, b) { const o = clone(a); for (let i = 0; i < o.d.length; i++) o.d[i] &= b.d[i]; return o; }
export function countIn(a, b) { let n = 0; for (let i = 0; i < a.d.length; i++) if (a.d[i] && b.d[i]) n++; return n; }
export const at = (m, x, y) => { x = Math.floor(x); y = Math.floor(y); return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.d[y * m.w + x] : 0; };

export function bbox(m) {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
  for (let y = 0; y < m.h; y++) {
    const r = y * m.w;
    for (let x = 0; x < m.w; x++) if (m.d[r + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}
/** 1 inside the box [x0, y0, x1, y1] (pixels, clipped to the mask). */
export function boxMask(w, h, b) {
  const m = blank(w, h);
  const x0 = Math.max(0, Math.floor(b[0])), y0 = Math.max(0, Math.floor(b[1])), x1 = Math.min(w, Math.ceil(b[2])), y1 = Math.min(h, Math.ceil(b[3]));
  for (let y = y0; y < y1; y++) m.d.fill(1, y * w + x0, y * w + x1);
  return m;
}

/** Connected pieces (4-neighbor). Returns the label per pixel (0 = none) and each piece's size and box. */
export function components(m) {
  const { w, h, d } = m, lab = new Int32Array(w * h), comps = [];
  const stack = new Int32Array(w * h);
  let next = 0;
  for (let s = 0; s < d.length; s++) {
    if (!d[s] || lab[s]) continue;
    const id = ++next; let sp = 0, n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    stack[sp++] = s; lab[s] = id;
    while (sp) {
      const i = stack[--sp]; n++;
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && d[i - 1] && !lab[i - 1]) { lab[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && d[i + 1] && !lab[i + 1]) { lab[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && d[i - w] && !lab[i - w]) { lab[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && d[i + w] && !lab[i + w]) { lab[i + w] = id; stack[sp++] = i + w; }
    }
    comps.push({ id, n, box: [x0, y0, x1 + 1, y1 + 1] });
  }
  return { lab, comps };
}
/** Keep only the pieces `keep(piece)` says yes to. */
export function keepPieces(m, keep) {
  const { lab, comps } = components(m);
  const ok = new Uint8Array(comps.length + 1);
  for (const c of comps) ok[c.id] = keep(c, lab) ? 1 : 0;
  const o = blank(m.w, m.h);
  for (let i = 0; i < lab.length; i++) if (ok[lab[i]]) o.d[i] = 1;
  return o;
}

/** Background pixels that can't reach the picture's edge: the holes. */
export function holes(m) {
  const { w, h, d } = m, seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  let sp = 0;
  const push = (i) => { if (!d[i] && !seen[i]) { seen[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  const o = blank(w, h);
  for (let i = 0; i < d.length; i++) if (!d[i] && !seen[i]) o.d[i] = 1;
  return o;
}
export const fillHoles = (m) => union(m, holes(m));
/** Fill holes smaller than maxN pixels (specks of glare, a nail head), keep bigger ones. */
export function fillSmallHoles(m, maxN) {
  const hm = holes(m);
  return union(m, keepPieces(hm, (c) => c.n <= maxN));
}

/** Grow (r > 0) or shrink (r < 0) by |r| pixels, square neighborhood. */
export function morph(m, r) {
  if (!r) return clone(m);
  const grow = r > 0; r = Math.abs(r);
  const { w, h } = m, tmp = new Uint8Array(w * h), out = new Uint8Array(w * h), src = m.d;
  // rows: running count over a window of 2r+1
  for (let y = 0; y < h; y++) {
    const row = y * w; let c = 0;
    for (let x = -r; x <= r; x++) c += x >= 0 && x < w ? src[row + x] : grow ? 0 : 1;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = grow ? (c > 0 ? 1 : 0) : (c === 2 * r + 1 ? 1 : 0);
      const xa = x + r + 1, xr = x - r;
      c += (xa < w ? src[row + xa] : grow ? 0 : 1) - (xr >= 0 ? src[row + xr] : grow ? 0 : 1);
    }
  }
  for (let x = 0; x < w; x++) {
    let c = 0;
    for (let y = -r; y <= r; y++) c += y >= 0 && y < h ? tmp[y * w + x] : grow ? 0 : 1;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = grow ? (c > 0 ? 1 : 0) : (c === 2 * r + 1 ? 1 : 0);
      const ya = y + r + 1, yr = y - r;
      c += (ya < h ? tmp[ya * w + x] : grow ? 0 : 1) - (yr >= 0 ? tmp[yr * w + x] : grow ? 0 : 1);
    }
  }
  return { w, h, d: out };
}

/** Convex hull of the mask (pixel-corner coordinates), from each row's first and last pixel. */
export function hull(m) {
  const pts = [];
  for (let y = 0; y < m.h; y++) {
    const r = y * m.w; let a = -1, b = -1;
    for (let x = 0; x < m.w; x++) if (m.d[r + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) pts.push([a, y], [a, y + 1], [b + 1, y], [b + 1, y + 1]);
  }
  return convexHull(pts);
}
export function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Fill polygons (pixel coordinates) into a mask: even-odd scanline, sampled at pixel centers. */
export function fillPolys(w, h, polys) {
  const m = blank(w, h);
  for (const poly of polys) {
    if (!poly || poly.length < 3) continue;
    let yMin = Infinity, yMax = -Infinity;
    for (const q of poly) { if (q[1] < yMin) yMin = q[1]; if (q[1] > yMax) yMax = q[1]; }
    const ya = Math.max(0, Math.floor(yMin)), yb = Math.min(h - 1, Math.ceil(yMax));
    const xs = [];
    for (let y = ya; y <= yb; y++) {
      const cy = y + 0.5; xs.length = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [x1, y1] = poly[j], [x2, y2] = poly[i];
        if ((y1 > cy) !== (y2 > cy)) xs.push(x1 + ((cy - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) m.d[y * w + x] ^= 1;
      }
    }
  }
  return m;
}

/**
 * Outer outlines of every piece, as closed polygons through pixel corners, clockwise on screen.
 * Each boundary edge between a 1 and a 0 is walked with the 1 on its right; where two pieces touch
 * only at a corner the walk turns right, so diagonal neighbors stay separate pieces.
 */
export function outlines(m) {
  const { w, h, d } = m, W1 = w + 1;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[y * w + x] === 1;
  // outgoing edges per corner: bit k = an edge leaving in direction k (0 E, 1 S, 2 W, 3 N)
  const out = new Uint8Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!d[y * w + x]) continue;
    if (!on(x, y - 1)) out[y * W1 + x] |= 1;              // top: (x,y) -> (x+1,y), east
    if (!on(x + 1, y)) out[y * W1 + x + 1] |= 2;          // right: (x+1,y) -> (x+1,y+1), south
    if (!on(x, y + 1)) out[(y + 1) * W1 + x + 1] |= 4;    // bottom: (x+1,y+1) -> (x,y+1), west
    if (!on(x - 1, y)) out[(y + 1) * W1 + x] |= 8;        // left: (x,y+1) -> (x,y), north
  }
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const loops = [];
  for (let v = 0; v < out.length; v++) {
    while (out[v]) {
      let dir = out[v] & 1 ? 0 : out[v] & 2 ? 1 : out[v] & 4 ? 2 : 3;
      const start = v, sdir = dir;
      let x = v % W1, y = (v / W1) | 0;
      const poly = [[x, y]];
      let cur = v;
      for (let guard = 0; guard < out.length * 4; guard++) {
        out[cur] &= ~(1 << dir);
        x += DX[dir]; y += DY[dir]; cur = y * W1 + x;
        // the next edge: right turn first, then straight, then left. Back at the start, the first
        // edge counts as free again: choosing it closes the loop.
        const free = out[cur] | (cur === start ? 1 << sdir : 0);
        const r = (dir + 1) & 3, s = dir, l = (dir + 3) & 3;
        const nd = free & (1 << r) ? r : free & (1 << s) ? s : free & (1 << l) ? l : -1;
        if (nd < 0 || (cur === start && nd === sdir)) break;
        if (nd !== dir) poly.push([x, y]);
        dir = nd;
      }
      if (poly.length >= 3 && area(poly) > 0) loops.push(poly);
    }
  }
  return loops;
}

/** Signed area (positive = clockwise on screen, y down). */
export function area(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a / 2;
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** Douglas-Peucker on a closed loop. Returns the indices kept. */
export function simplifyIdx(pts, eps) {
  const n = pts.length;
  if (n < 4) return pts.map((_, i) => i);
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const dd = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (dd > fd) { fd = dd; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const stack = [[0, far], [far, n]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const pa = pts[a], pb = pts[b % n];
    let idx = -1, dm = eps;
    for (let i = a + 1; i < b; i++) { const dd = segDist(pts[i], pa, pb); if (dd > dm) { dm = dd; idx = i; } }
    if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}
export const simplify = (pts, eps) => simplifyIdx(pts, eps).map((i) => pts[i]);

/**
 * Straight edges and crisp corners: simplify to the main corners, fit a line through the outline
 * between each pair of corners (leaving out the rounded ends), and put each corner where its two
 * lines meet. Nearly straight runs of corners merge into one edge.
 */
export function straighten(pts, eps) {
  let idx = simplifyIdx(pts, eps);
  const n0 = pts.length;
  if (idx.length < 3) return idx.map((i) => pts[i]);
  const fit = (a, b) => {
    const run = [];
    const len = (b - a + n0) % n0 || n0;
    const trim = Math.floor(len * 0.12);
    for (let k = trim; k <= len - trim; k++) run.push(pts[(a + k) % n0]);
    if (run.length < 2) { run.length = 0; run.push(pts[a], pts[b % n0]); }
    let cx = 0, cy = 0; for (const q of run) { cx += q[0]; cy += q[1]; } cx /= run.length; cy /= run.length;
    let sxx = 0, syy = 0, sxy = 0; for (const q of run) { const dx = q[0] - cx, dy = q[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { c: [cx, cy], u: [Math.cos(ang), Math.sin(ang)] };
  };
  const meet = (L1, L2) => {
    const den = L1.u[0] * L2.u[1] - L1.u[1] * L2.u[0];
    if (Math.abs(den) < 0.17) return null;                     // under ~10 degrees apart: no clean corner
    const t = ((L2.c[0] - L1.c[0]) * L2.u[1] - (L2.c[1] - L1.c[1]) * L2.u[0]) / den;
    return [L1.c[0] + t * L1.u[0], L1.c[1] + t * L1.u[1]];
  };
  // drop corners where the outline barely turns (under about 6 degrees)
  for (let pass = 0; pass < 2 && idx.length > 3; pass++) {
    const keep = idx.filter((_, k) => {
      const a = pts[idx[(k - 1 + idx.length) % idx.length]], b = pts[idx[k]], c = pts[idx[(k + 1) % idx.length]];
      const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
      return (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]) || 1) < 0.995;
    });
    if (keep.length < 3 || keep.length === idx.length) break;
    idx = keep;
  }
  const n = idx.length;
  const lines = idx.map((a, k) => fit(a, idx[(k + 1) % n]));
  const len = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
  return idx.map((i, k) => {
    const prev = idx[(k - 1 + n) % n], next = idx[(k + 1) % n];
    if (len(prev, i) < eps * 2.5 || len(i, next) < eps * 2.5) return pts[i];   // short edges: their lines aren't reliable
    const p = meet(lines[(k - 1 + n) % n], lines[k]);
    return p && Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) < eps * 1.5 ? p : pts[i];
  });
}
/** Drop the corners that matter least (the smallest triangle with their neighbors, Visvalingam)
 *  while each one changes the shape's area by under `frac` of it: little notches and bumps go. */
export function dropDetours(poly, frac, minPts = 4) {
  const p = poly.slice();
  const total = Math.abs(area(p)) || 1;
  const tri = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  while (p.length > minPts) {
    let best = -1, bv = Infinity;
    for (let i = 0; i < p.length; i++) {
      const v = tri(p[(i - 1 + p.length) % p.length], p[i], p[(i + 1) % p.length]);
      if (v < bv) { bv = v; best = i; }
    }
    if (bv > total * frac) break;
    p.splice(best, 1);
  }
  return p;
}
/** Close gaps narrower than 2r pixels (grow, then shrink back). */
export const close = (m, r) => morph(morph(m, r), -r);

/** A mask as a white-on-transparent canvas (for painting "in front" and "opening" areas). */
export function toCanvas(m) {
  const c = document.createElement("canvas"); c.width = m.w; c.height = m.h;
  const x = c.getContext("2d");
  const im = x.createImageData(m.w, m.h);
  for (let i = 0; i < m.d.length; i++) if (m.d[i]) { const p = i * 4; im.data[p] = im.data[p + 1] = im.data[p + 2] = im.data[p + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c;
}
