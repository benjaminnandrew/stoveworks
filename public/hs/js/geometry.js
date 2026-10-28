// Wall-plane geometry for customer photos.
// Camera coords: x right, y down, z forward (pixels via K). The wall is a plane with
// horizontal axis U and vertical axis V (pointing up), set by yaw (theta) and camera
// pitch (phi). Perspective never comes from dragging corners: the outline only clips.

export const D2R = Math.PI / 180;

/** Focal length in pixels from a 35 mm-equivalent focal length (diagonal-based). */
export function focalPx(w, h, f35 = 26) {
  return (f35 / 43.27) * Math.hypot(w, h);
}

export function planeAxes(theta, phi) {
  const ct = Math.cos(theta), st = Math.sin(theta), cp = Math.cos(phi), sp = Math.sin(phi);
  return { U: [ct, st * sp, st * cp], V: [0, -cp, sp] };
}

const mul3 = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const apply3 = (M, v) => [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);

export function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-14) return null;
  const k = 1 / det;
  return [
    [A * k, -(b * i - c * h) * k, (b * f - c * e) * k],
    [B * k, (a * i - c * g) * k, -(a * f - c * d) * k],
    [C * k, -(a * h - b * g) * k, (a * e - b * d) * k],
  ];
}

export function applyH(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w];
}

export function camK(W, H, f) {
  return [[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]];
}

/**
 * Plane through the ray of anchor pixel (ax, ay) at depth 1.
 * Returns Hfwd mapping (u, v, 1) plane units -> pixel, and Hinv pixel -> plane units.
 */
export function planeHomography(W, H, f, theta, phi, ax, ay) {
  const K = camK(W, H, f);
  const { U, V } = planeAxes(theta, phi);
  const P = [(ax - W / 2) / f, (ay - H / 2) / f, 1];
  const A = [[U[0], V[0], P[0]], [U[1], V[1], P[1]], [U[2], V[2], P[2]]];
  const Hfwd = mul3(K, A);
  return { Hfwd, Hinv: inv3(Hfwd) };
}

/**
 * Complete wall mapping for a surface: normalized image coords -> wall inches.
 * surf: {poly:[[x,y]..] px, theta, phi, measure:{a:[x,y], b:[x,y], inches}}
 */
export function surfaceMapping(W, Hh, f, surf) {
  const m = areaMapping(W, Hh, f, { sections: [surf.poly], theta: surf.theta, phi: surf.phi, measure: surf.measure });
  return m && { H: m.H, Hpix: m.Hpix, inchesPerUnit: m.inchesPerUnit, wallPts: m.wallSecs[0] };
}

/**
 * Wall mapping for an area: one or more outlined sections on the same flat surface
 * (for example the wall on each side of a stove pipe). All sections share one plane and
 * one texture origin, so the stone courses line up across the gap between them.
 * area: {sections: [[[x,y]..]..] (image px), theta, phi, measure: {a, b, inches}, rot}
 * rot (radians, optional) turns the stone on the wall about the area's middle, to level its
 * courses with a photo taken slightly crooked; positive turns them clockwise on screen.
 * Returns H (normalized image -> stone inches, with rot), Hpix (image px -> wall inches),
 * Htex (image px -> stone inches, with rot), and the sections in wall inches (wallSecs, origin
 * at the lowest-left point of all of them) and in stone inches (texSecs).
 */
export function areaMapping(W, Hh, f, area) {
  const all = area.sections.flat();
  if (all.length < 3) return null;
  const c = centroid(all);
  const { Hinv } = planeHomography(W, Hh, f, area.theta, area.phi, c[0], c[1]);
  if (!Hinv) return null;
  // scale: inches per plane unit, from the measuring line
  let s = 100;
  if (area.measure && area.measure.inches > 0) {
    const pa = applyH(Hinv, area.measure.a[0], area.measure.a[1]);
    const pb = applyH(Hinv, area.measure.b[0], area.measure.b[1]);
    const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    if (d > 1e-9 && isFinite(d)) s = area.measure.inches / d;
  }
  const secPts = area.sections.map((poly) => poly.map(([x, y]) => applyH(Hinv, x, y).map((v) => v * s)));
  const flat = secPts.flat();
  const u0 = Math.min(...flat.map((p) => p[0]));
  const v0 = Math.min(...flat.map((p) => p[1]));
  const S = [[s, 0, -u0], [0, s, -v0], [0, 0, 1]];
  const wallSecs = secPts.map((pts) => pts.map(([u, v]) => [u - u0, v - v0]));
  // the stone's own frame: the wall's, turned by rot about the middle of the area
  let T = S, texSecs = wallSecs;
  const rot = area.rot || 0;
  if (rot) {
    const wf = wallSecs.flat(), us = wf.map((p) => p[0]), vs = wf.map((p) => p[1]);
    const cu = (Math.min(...us) + Math.max(...us)) / 2, cv = (Math.min(...vs) + Math.max(...vs)) / 2;
    const c = Math.cos(rot), sn = Math.sin(rot);
    T = mul3([[c, -sn, cu - c * cu + sn * cv], [sn, c, cv - sn * cu - c * cv], [0, 0, 1]], S);
    texSecs = wallSecs.map((pts) => pts.map(([u, v]) => [c * (u - cu) - sn * (v - cv) + cu, sn * (u - cu) + c * (v - cv) + cv]));
  }
  const N = [[W, 0, 0], [0, Hh, 0], [0, 0, 1]];
  const Hn = mul3(mul3(T, Hinv), N);
  // projective matrix: any scale works in the shader; normalize by the largest entry for precision
  const k = Math.max(...Hn.flat().map(Math.abs)) || 1;
  return {
    H: Hn.map((r) => r.map((v) => v / k)),
    Hpix: mul3(S, Hinv),
    Htex: mul3(T, Hinv),
    inchesPerUnit: s,
    wallSecs,
    texSecs,
  };
}

export function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

export function shoelace(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Projected direction (unit, pixels) of the wall's horizontal or vertical axis at pixel m. */
export function axisDirAt(W, H, f, theta, phi, m, which = "U") {
  const K = camK(W, H, f);
  const ax = planeAxes(theta, phi)[which];
  const vp = apply3(K, ax);
  let dx, dy;
  if (Math.abs(vp[2]) < 1e-9) { dx = vp[0]; dy = vp[1]; }
  else { dx = vp[0] / vp[2] - m[0]; dy = vp[1] / vp[2] - m[1]; if (vp[2] < 0) { dx = -dx; dy = -dy; } }
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

function lineErr(W, H, f, th, ph, seg) {
  const [a, b] = seg;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  const d = axisDirAt(W, H, f, th, ph, m, horiz ? "U" : "V");
  const cross = (dx / l) * d[1] - (dy / l) * d[0];
  return cross * cross * Math.min(1, l / 80);
}

/** Solve wall yaw (and pitch when there are 2+ lines or a vertical line) from guide segments. */
export function solveFromLines(W, H, f, segs, phi0 = 0) {
  if (!segs.length) return null;
  const hasV = segs.some(([a, b]) => Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]));
  const solvePhi = segs.length > 1 || hasV;
  let best = { e: Infinity, th: 0, ph: phi0 };
  for (let th = -80; th <= 80; th += 1) {
    for (let ph = solvePhi ? -30 : phi0 / D2R; ph <= (solvePhi ? 30 : phi0 / D2R); ph += 1) {
      const e = segs.reduce((s, sg) => s + lineErr(W, H, f, th * D2R, ph * D2R, sg), 0);
      if (e < best.e) best = { e, th: th * D2R, ph: ph * D2R };
    }
  }
  // refine
  let step = 0.5 * D2R;
  for (let it = 0; it < 30; it++) {
    let improved = false;
    for (const [dt, dp] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      if (!solvePhi && dp) continue;
      const th = best.th + dt, ph = best.ph + dp;
      const e = segs.reduce((s, sg) => s + lineErr(W, H, f, th, ph, sg), 0);
      if (e < best.e) { best = { e, th, ph }; improved = true; }
    }
    if (!improved) step /= 2;
  }
  return { theta: best.th, phi: best.ph };
}

/** DLT homography from 4 source points to 4 destination points. */
export function homography4(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Order 4 points as bottom-left, bottom-right, top-right, top-left. */
export function orderQuad(pts) {
  const c = centroid(pts);
  const ang = pts.map((p) => [Math.atan2(p[1] - c[1], p[0] - c[0]), p]);
  ang.sort((a, b) => a[0] - b[0]);
  const s = ang.map((a) => a[1]);  // clockwise in screen space starting from left
  // find bottom-left: max(y - x)
  let bl = 0;
  for (let i = 1; i < 4; i++) if (s[i][1] - s[i][0] > s[bl][1] - s[bl][0]) bl = i;
  const r = [0, 1, 2, 3].map((k) => s[(bl + k) % 4]);
  // ensure next is bottom-right (to the right)
  if (r[1][0] < r[3][0]) return [r[0], r[3], r[2], r[1]];
  return r;
}

/** If the 4-point outline is a real rectangle, recover yaw and pitch. */
export function solveFromRectangle(W, H, f, pts) {
  const q = orderQuad(pts);
  const G = homography4([[0, 0], [1, 0], [1, 1], [0, 1]], q);
  if (!G) return null;
  const Ki = inv3(camK(W, H, f));
  const dh = apply3(Ki, [G[0][0], G[1][0], G[2][0]]);
  const dv = apply3(Ki, [G[0][1], G[1][1], G[2][1]]);
  const nh = Math.hypot(...dh), nv = Math.hypot(...dv);
  let [ux, uy, uz] = dh.map((v) => v / nh);
  let [vx, vy, vz] = dv.map((v) => v / nv);
  if (ux < 0) { ux = -ux; uy = -uy; uz = -uz; }
  if (vy > 0) { vx = -vx; vy = -vy; vz = -vz; }
  const phi = Math.atan2(vz, -vy);
  const theta = Math.atan2(uy * Math.sin(phi) + uz * Math.cos(phi), ux);
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  return { theta: clamp(theta, 78 * D2R), phi: clamp(phi, 35 * D2R) };
}

/** Read FocalLengthIn35mmFilm from a JPEG's EXIF block (or null). */
export function exifFocal35(buf) {
  try {
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o < v.byteLength - 4) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10;                       // TIFF header start
        const le = v.getUint16(t) === 0x4949;
        const g16 = (p) => v.getUint16(t + p, le), g32 = (p) => v.getUint32(t + p, le);
        const find = (ifd, tag) => {
          const n = g16(ifd);
          for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (g16(e) === tag) return e + 8; }
          return -1;
        };
        const ptr = find(g32(4), 0x8769);       // Exif sub-IFD pointer
        if (ptr < 0) return null;
        const f = find(g32(ptr), 0xa405);       // FocalLengthIn35mmFilm (SHORT)
        return f < 0 ? null : (g16(f) || null);
      }
      if ((marker & 0xff00) !== 0xff00) break;
      o += 2 + len;
    }
  } catch (e) { /* not a JPEG with EXIF */ }
  return null;
}
