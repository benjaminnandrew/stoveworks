/**
 * Projective mapping of the unit square onto an arbitrary convex quadrilateral.
 *
 * This is what makes a stone texture sit *on* a wall rather than look pasted
 * over it: courses converge toward the vanishing point exactly as the wall does.
 *
 * One solver, two consumers — the live editor feeds the matrix to CSS
 * `matrix3d` (the browser rasterises it on the GPU), and the PNG export feeds
 * the same matrix to a triangle mesh on a 2D canvas. Sharing the maths is what
 * keeps the download identical to what the customer arranged on screen.
 */

export type Point = { x: number; y: number };

/** Row-major 3x3: [a, b, c, d, e, f, g, h, i]. */
export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = readonly [Point, Point, Point, Point];

/**
 * Solves the homography taking (0,0), (1,0), (1,1), (0,1) to the four corners.
 *
 * Closed form rather than a general least-squares solve: with exactly four
 * correspondences the system is determined, and this is both faster and
 * numerically better behaved for the degenerate-ish quads users actually drag.
 */
export function unitSquareToQuad(quad: Quad): Matrix3 {
  const [tl, tr, br, bl] = quad;

  const dx1 = tr.x - br.x;
  const dy1 = tr.y - br.y;
  const dx2 = bl.x - br.x;
  const dy2 = bl.y - br.y;
  const sx = tl.x - tr.x + br.x - bl.x;
  const sy = tl.y - tr.y + br.y - bl.y;

  const den = dx1 * dy2 - dx2 * dy1;

  // Collinear corners: fall back to the affine map so the UI degrades to a
  // sheared rectangle instead of producing NaNs and vanishing.
  if (Math.abs(den) < 1e-12) {
    return [tr.x - tl.x, bl.x - tl.x, tl.x, tr.y - tl.y, bl.y - tl.y, tl.y, 0, 0, 1];
  }

  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;

  return [
    tr.x - tl.x + g * tr.x,
    bl.x - tl.x + h * bl.x,
    tl.x,
    tr.y - tl.y + g * tr.y,
    bl.y - tl.y + h * bl.y,
    tl.y,
    g,
    h,
    1,
  ];
}

/**
 * Homography from a `refW` x `refH` rectangle — the element's own pixel box —
 * onto the quad, rather than from the unit square.
 *
 * Working in a real pixel space rather than 0..1 is what lets the texture be
 * sized in px and the openings be positioned in px, both of which then ride the
 * perspective for free.
 */
export function rectToQuad(refW: number, refH: number, quad: Quad): Matrix3 {
  const m = unitSquareToQuad(quad);
  // Post-multiplying by diag(1/refW, 1/refH, 1) scales the input coordinates.
  return [
    m[0] / refW,
    m[1] / refH,
    m[2],
    m[3] / refW,
    m[4] / refH,
    m[5],
    m[6] / refW,
    m[7] / refH,
    m[8],
  ];
}

/** Maps a point in unit-square space through the homography. */
export function project(m: Matrix3, u: number, v: number): Point {
  const w = m[6] * u + m[7] * v + m[8];
  return {
    x: (m[0] * u + m[1] * v + m[2]) / w,
    y: (m[3] * u + m[4] * v + m[5]) / w,
  };
}

/** Inverse of a 3x3 homography, or null when it is singular. */
export function invert(m: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

/**
 * Where a point on the photo lands in the quad's own unit square — the inverse
 * of `project`. Used to tell whether a tap falls on stone or in an opening.
 */
export function unproject(quad: Quad, x: number, y: number): Point | null {
  const inv = invert(unitSquareToQuad(quad));
  if (!inv) return null;
  return project(inv, x, y);
}

/** Even-odd point-in-polygon test; works for any simple polygon. */
export function pointInPolygon(points: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * CSS `matrix3d(...)` for the same transform, in the column-major order the
 * spec expects. Apply to an element sized 1x1 with `transform-origin: 0 0`.
 */
export function toCssMatrix3d(m: Matrix3): string {
  const [a, b, c, d, e, f, g, h, i] = m;
  const values = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i];
  return `matrix3d(${values.map((n) => (Number.isFinite(n) ? n.toFixed(6) : "0")).join(",")})`;
}

/** Shoelace area of the quad, in whatever units the points are given in. */
export function quadArea(quad: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i += 1) {
    const p = quad[i];
    const q = quad[(i + 1) % 4];
    area += p.x * q.y - q.x * p.y;
  }
  return Math.abs(area) / 2;
}

/**
 * True when the quad is convex and wound consistently — the condition under
 * which the homography is well behaved. Used to warn before the texture folds
 * back on itself.
 */
export function isConvex(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}
