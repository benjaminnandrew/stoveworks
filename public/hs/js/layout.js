// Photo helper, the "what's what" half: Claude looks at the customer's photo and says where stone would
// go, what stands in front of it and where the openings are, as rough boxes and spots. The
// segmentation model then finds the exact edges from those hints (see segment.js).
//
// In this preview Claude is reached through the artifact runtime (window.claude, "sample" with images).
// On the store's own site, set window.HS_CONFIG.findSurfacesUrl and the server route in
// production/find-surfaces/route.ts asks Claude with the same instructions.

export const SURFACE_KINDS = ["Chimney face", "Chimney side", "Main wall", "Hearth front", "Hearth side", "Accent wall"];

export function layoutPrompt(w, h) {
  return `This photo (${w} x ${h} pixels) comes from a customer of a fireplace and stove shop. The shop's app is about to show them what stone veneer would look like in this room, and needs to know where the stone would go and what stands in front of it.

Reply with only a JSON object in this shape, no other text:
{"surfaces":[{"label":"Chimney face","box":[x0,y0,x1,y1],"points":[[x,y],[x,y]],"whole":true}],"in_front":[{"label":"Wood stove","box":[x0,y0,x1,y1],"points":[[x,y]]}],"openings":[{"label":"Fireplace opening","box":[x0,y0,x1,y1]}],"confidence":"high","note":""}

Coordinates are pixels in this photo: x from 0 at the left edge to ${w} at the right, y from 0 at the top to ${h} at the bottom. A box is [left, top, right, bottom].

surfaces: the upright, flat surfaces that would get stone veneer, biggest first, at most 4.
- If there is a chimney, chimney breast, fireplace surround or raised hearth, those are the stone areas: the face, each side you can see, and the front of a raised hearth, each as its own surface.
- If a stove stands against a plain wall, the stone area is the wall behind the stove, from the floor (or the hearth) up to the ceiling, out to the nearest natural edges such as a corner, a window or door trim. If the wall runs on much farther, take a section about twice as wide as the stove, centered behind it.
- Never a floor, ceiling, hearth top (the slab a stove stands on), window, door or piece of furniture.
- label: one of ${SURFACE_KINDS.map((k) => `"${k}"`).join(", ")}.
- box: the surface's full extent, including any part hidden behind things in front of it. Be as exact as you can about its edges.
- points: 2 or 3 spots clearly on the visible surface itself: not on anything in front of it (stove, pipe, mantel, TV, decor), not near an edge, spread apart.
- whole: true when the stone would cover the surface out to its own edges (a chimney face); false when the box marks only a section of a bigger wall.

in_front: things standing in front of those surfaces that stay in front of the stone: stove, stove pipe, mantel shelf or beam, TV, wood rack, stacked logs, furniture, lamps, plants. Only things that overlap a surface's box. A tight box and 1 or 2 points on the thing itself.

openings: places inside a surface that get no stone: a fireplace opening or its glass front, a window, a door, a niche. A tight box.

confidence: "high" when the photo clearly shows a fireplace, chimney or a wall with a stove; "low" when you can't tell where stone would go. Then leave surfaces empty and say why in note, under 15 words, written to the customer.`;
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && isFinite(+v) ? +v : NaN);
function boxOf(b, sx, sy, W, H) {
  if (!Array.isArray(b) || b.length !== 4) return null;
  let [x0, y0, x1, y1] = b.map(num);
  if (![x0, y0, x1, y1].every(isFinite)) return null;
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  const r = [Math.max(0, x0 * sx), Math.max(0, y0 * sy), Math.min(W, x1 * sx), Math.min(H, y1 * sy)];
  return r[2] - r[0] > W * 0.01 && r[3] - r[1] > H * 0.01 ? r : null;
}
function ptsOf(p, sx, sy, W, H) {
  if (!Array.isArray(p)) return [];
  return p.map((q) => (Array.isArray(q) && q.length >= 2 ? [num(q[0]) * sx, num(q[1]) * sy] : null))
    .filter((q) => q && isFinite(q[0]) && isFinite(q[1]) && q[0] >= 0 && q[1] >= 0 && q[0] <= W && q[1] <= H).slice(0, 3);
}
const short = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Check and convert Claude's answer: coordinates from the sent image's pixels to the photo's. */
export function normalizeLayout(raw, sentW, sentH, W, H) {
  const sx = W / sentW, sy = H / sentH;
  const r = raw && typeof raw === "object" ? raw : {};
  const surfaces = (Array.isArray(r.surfaces) ? r.surfaces : []).map((s) => {
    const box = boxOf(s?.box, sx, sy, W, H); if (!box) return null;
    const label = SURFACE_KINDS.find((k) => k.toLowerCase() === short(s.label, 40).toLowerCase()) || "Main wall";
    return { label, box, points: ptsOf(s.points, sx, sy, W, H), whole: s.whole !== false };
  }).filter(Boolean).slice(0, 4);
  const things = (list, n) => (Array.isArray(list) ? list : []).map((s) => {
    const box = boxOf(s?.box, sx, sy, W, H); if (!box) return null;
    return { label: short(s.label, 40) || "Something", box, points: ptsOf(s.points, sx, sy, W, H) };
  }).filter(Boolean).slice(0, n);
  return {
    surfaces, front: things(r.in_front, 8), openings: things(r.openings, 6),
    confidence: ["high", "medium", "low"].includes(r.confidence) ? r.confidence : "medium",
    note: short(r.note, 140),
  };
}

/** The photo, scaled down for Claude (it reads about a megapixel), as a JPEG. */
function photoForClaude(canvas, maxEdge = 1280) {
  const k = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res({ blob: b, w: c.width, h: c.height }), "image/jpeg", 0.88));
}

let samplePromise = null;
async function sampleFn() {
  if (!samplePromise) samplePromise = (async () => {
    try { return window.claude?.use ? await window.claude.use("sample") : null; } catch (e) { return null; }
  })();
  return samplePromise;
}

/** Is there a way to ask Claude about a photo here? (No prompt to the customer yet.) */
export async function available() {
  if (window.HS_CONFIG?.findSurfacesUrl) return true;
  const s = await sampleFn();
  if (!s || typeof s.json !== "function") return false;
  const lim = await s.limits?.().catch(() => null);
  return !!lim?.images;
}

/**
 * Ask. Resolves {layout} or {off: reason} when Claude can't be asked here; rejects only on cancel.
 * fresh: ask again instead of reusing an answer from the last few minutes.
 */
export async function findLayout(canvas, { signal, fresh = false } = {}) {
  const W = canvas.width, H = canvas.height;
  const img = await photoForClaude(canvas);
  const url = window.HS_CONFIG?.findSurfacesUrl;
  if (url) {
    const fd = new FormData();
    fd.append("photo", img.blob, "photo.jpg"); fd.append("width", String(img.w)); fd.append("height", String(img.h));
    try {
      const res = await fetch(url, { method: "POST", body: fd, signal });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.layout) return { off: j.error || "server" };
      return { layout: normalizeLayout(j.layout, img.w, img.h, W, H) };
    } catch (e) {
      if (e?.name === "AbortError") throw { code: "cancelled" };
      return { off: "network" };
    }
  }
  const sample = await sampleFn();
  if (!sample || typeof sample.json !== "function") return { off: "unavailable" };
  try {
    // a second look asks again rather than replaying the first answer
    const raw = await sample.json(layoutPrompt(img.w, img.h), { images: [img.blob], modelTier: "default", effort: "low", signal, ...(fresh ? { cache: false } : {}) });
    return { layout: normalizeLayout(raw, img.w, img.h, W, H) };
  } catch (e) {
    if (e?.code === "cancelled") throw e;
    return { off: e?.code || "error" };
  }
}
