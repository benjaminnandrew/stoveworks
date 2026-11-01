"""Procedural SAMPLE stone veneer textures (seamless), one per Buechel veneer in catalog_src.json.

Outputs per product into <out>/<id>/:
  albedo.jpg  sRGB stone color with the face's cavity shading, defined right up to the joint center lines
  relief.jpg  grayscale, two tiles stacked: on top the face height (0..1 -> 0..reliefIn inches), below the
              distance to the joint center line (0..1 -> 0..DMAX inches)
  thumb.jpg   small preview with joints and simple lighting (for the picker)
  meta.json   what the app needs to tile and light it
and <out>/catalog.json: Buechel's data for every stone plus those texture facts.
These are stand-ins until real swatches are loaded; the app labels them "Sample texture".
Usage: python3 gen_stone.py [--jobs=2] [--only=id,id] [--force] [--out=dir]
"""
import json, math, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from texlib import pnoise, fbm, ridged, srgb_to_lin, lin_to_srgb, hex2rgb, to_u8

PX = 32          # pixels per inch
DMAX = 1.5       # inches encoded in data.R
_HERE = os.path.dirname(os.path.abspath(__file__))
# the app's stone folder next to this build folder (as in the package), else the dev copy; --out=<dir> to write elsewhere
OUT = os.path.join(_HERE, "..", "assets", "stone") if os.path.isdir(os.path.join(_HERE, "..", "assets", "stone")) else "/home/claude/visualizer/assets/stone"


# ------------------------------------------------------------------ layouts (label images)
def warp(H, W, ax_in, ay_in, cell_in, seed):
    """Periodic domain-warp offsets (pixels)."""
    c = max(2, cell_in * PX)
    wx = pnoise(H, W, c, seed) * ax_in * PX * 0.5 + pnoise(H, W, c / 3, seed + 1) * ax_in * PX * 0.25
    wy = pnoise(H, W, c, seed + 2) * ay_in * PX * 0.5 + pnoise(H, W, c / 3, seed + 3) * ay_in * PX * 0.25
    return wx, wy


def rows_layout(W_in, H_in, rng, heights, lengths, split_p=0.0, stagger=True):
    """Courses of random height; stones of random length. Returns list of rects (x0,y0,w,h) in inches."""
    hs = []
    while sum(hs) < H_in:
        hs.append(heights(rng))
    hs = np.array(hs) * (H_in / sum(hs))
    rects = []
    y = 0.0
    for h in hs:
        ls = []
        while sum(ls) < W_in:
            ls.append(lengths(rng, h))
        ls = np.array(ls) * (W_in / sum(ls))
        x = rng.uniform(0, W_in)
        for L in ls:
            if split_p and rng.random() < split_p and h > 1.4:
                f = rng.uniform(0.35, 0.65)
                rects.append((x, y, L, h * f)); rects.append((x, y + h * f, L, h * (1 - f)))
            else:
                rects.append((x, y, L, h))
            x += L
        y += h
    return rects


def bands_layout(W_in, H_in, rng, band_h, col_w, split):
    """Ashlar-style: horizontal bands, split into columns, each column stacked with 1-4 stones."""
    bs = []
    while sum(bs) < H_in:
        bs.append(band_h(rng))
    bs = np.array(bs) * (H_in / sum(bs))
    rects = []
    y = 0.0
    for b in bs:
        ws = []
        while sum(ws) < W_in:
            ws.append(col_w(rng, b))
        ws = np.array(ws) * (W_in / sum(ws))
        x = rng.uniform(0, W_in)
        for w in ws:
            parts = split(rng, b, w)
            yy = y
            for p in parts:
                rects.append((x, yy, w, p)); yy += p
            x += w
        y += b
    return rects


def rasterize_rects(rects, W_in, H_in, wx, wy):
    H, W = int(round(H_in * PX)), int(round(W_in * PX))
    lab = np.full((H, W), -1, np.int32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    X = (xx + wx) / PX
    Y = (yy + wy) / PX
    Y = np.mod(Y, H_in)
    X = np.mod(X, W_in)
    for i, (x0, y0, w, h) in enumerate(rects):
        dx = np.mod(X - x0, W_in)
        inside = (dx < w) & (Y >= y0) & (Y < y0 + h)
        lab[inside] = i
    # any unassigned (numerical gaps) -> nearest label
    if (lab < 0).any():
        idx = ndimage.distance_transform_edt(lab < 0, return_distances=False, return_indices=True)
        lab = lab[idx[0], idx[1]]
    return lab


def voronoi_layout(W_in, H_in, rng, sizes, wx, wy, jitter_power=1.0):
    """Power-diagram mosaic on a torus. sizes(rng) -> radius in inches. Dart throwing."""
    seeds = []
    tries = 0
    target_area = W_in * H_in
    filled = 0.0
    while tries < 20000 and filled < target_area * 0.92:
        tries += 1
        r = sizes(rng)
        p = np.array([rng.uniform(0, W_in), rng.uniform(0, H_in)])
        ok = True
        for (q, rq) in seeds:
            d = p - q
            d -= np.round(d / [W_in, H_in]) * [W_in, H_in]
            if np.hypot(*d) < (r + rq) * 0.82:
                ok = False
                break
        if ok:
            seeds.append((p, r)); filled += math.pi * r * r
    pts = np.array([s[0] for s in seeds]); rad = np.array([s[1] for s in seeds])
    from scipy.spatial import cKDTree
    H, W = int(round(H_in * PX)), int(round(W_in * PX))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    X = ((xx + wx) / PX) % W_in
    Y = ((yy + wy) / PX) % H_in
    tp, tw, ti = [], [], []
    for ox in (-W_in, 0, W_in):
        for oy in (-H_in, 0, H_in):
            tp.append(pts + [ox, oy]); tw.append((rad * jitter_power) ** 2); ti.append(np.arange(len(pts)))
    tp = np.concatenate(tp); tw = np.concatenate(tw); ti = np.concatenate(ti)
    tree = cKDTree(tp)
    q = np.column_stack([X.ravel(), Y.ravel()])
    dd, ii = tree.query(q, k=8)
    pd = dd ** 2 - tw[ii]
    j = np.argmin(pd, axis=1)
    lab = ti[ii[np.arange(len(j)), j]].reshape(H, W).astype(np.int32)
    return lab, len(seeds)


def dist_to_boundary(lab):
    """Distance (px) from each pixel to the nearest label boundary, periodic."""
    pad = 96
    L = np.pad(lab, pad, mode="wrap")
    b = np.zeros(L.shape, bool)
    b[:, 1:] |= L[:, 1:] != L[:, :-1]
    b[:, :-1] |= L[:, 1:] != L[:, :-1]
    b[1:, :] |= L[1:, :] != L[:-1, :]
    b[:-1, :] |= L[1:, :] != L[:-1, :]
    d = ndimage.distance_transform_edt(~b)
    # boundary pixels straddle the line: shift by half a pixel
    d = np.maximum(d - 0.5, 0)
    return d[pad:-pad, pad:-pad].astype(np.float32)


# ------------------------------------------------------------------ surface
def palette_pick(rng, pal, n):
    cols = np.array([hex2rgb(c) for c, w in pal]); ws = np.array([w for c, w in pal], float)
    ws /= ws.sum()
    idx = rng.choice(len(pal), size=n, p=ws)
    return cols[idx]


def build(p, seed=1):
    rng = np.random.default_rng(seed)
    W_in, H_in = p["tile_in"]
    H, W = int(round(H_in * PX)), int(round(W_in * PX))
    kind = p["kind"]
    wx, wy = warp(H, W, p.get("warp_x", 0.3), p.get("warp_y", 0.12), p.get("warp_cell", 3.0), seed + 10)
    if kind in ("ledge", "fieldledge", "tailored_fieldledge"):
        rects = rows_layout(W_in, H_in, rng, p["row_h"], p["stone_l"], p.get("split_p", 0.0))
        lab = rasterize_rects(rects, W_in, H_in, wx, wy)
        n = len(rects)
        centers = np.array([[x + w / 2, y + h / 2] for x, y, w, h in rects])
        sizes = np.array([[w, h] for x, y, w, h in rects])
    elif kind in ("ashlar", "castle", "dimensional"):
        rects = bands_layout(W_in, H_in, rng, p["band_h"], p["col_w"], p["split"])
        lab = rasterize_rects(rects, W_in, H_in, wx, wy)
        n = len(rects)
        centers = np.array([[x + w / 2, y + h / 2] for x, y, w, h in rects])
        sizes = np.array([[w, h] for x, y, w, h in rects])
    else:  # mosaic
        lab, n = voronoi_layout(W_in, H_in, rng, p["radius"], wx, wy, p.get("power", 1.0))
        centers = None
        sizes = None
    d_in = dist_to_boundary(lab) / PX
    # per-stone attributes (muted, natural variation)
    cols = palette_pick(rng, p["palette"], n)
    lin = srgb_to_lin(cols)
    lum = (lin @ np.array([0.2126, 0.7152, 0.0722]))[:, None]
    desat = rng.uniform(0.05, p.get("desat", 0.3), (n, 1))
    lin = lin * (1 - desat) + lum * desat
    u = p.get("unify", 0.0)
    if u:
        # stones of one blend are related: pull each a little toward the blend's overall color
        pc = srgb_to_lin(np.array([hex2rgb(c) for c, w in p["palette"]])); pw = np.array([w for c, w in p["palette"]], float)
        lin = lin * (1 - u) + (pw @ pc / pw.sum())[None, :] * u
    lin = lin * np.exp(rng.normal(0, p.get("tone_jitter", 0.09), (n, 1)))
    prot = rng.uniform(0, 1, n) ** 1.3
    # "50% rockfaced" blends: about half the stones stand proud with a rough face, the rest are flatter
    rf = p.get("rockfaced", 0.0)
    rock = rng.random(n) < rf if rf else np.zeros(n, bool)
    if rf:
        prot = np.where(rock, 0.65 + 0.35 * rng.uniform(0, 1, n), prot * 0.3)
    famp_stone = np.where(rock, 1.7, 0.45 if rf else 1.0)
    tiltx = rng.normal(0, p.get("tilt", 0.04), n)
    tilty = rng.normal(0, p.get("tilt", 0.04), n)
    ox = rng.integers(0, W, n); oy = rng.integers(0, H, n)
    yy, xx = np.mgrid[0:H, 0:W]
    gy = (yy + oy[lab]) % H; gx = (xx + ox[lab]) % W
    X = xx / PX; Y = yy / PX
    # periodic fields, sampled with a per-stone offset so neighbours differ
    big = fbm(H, W, p.get("mottle_in", 5.0) * PX, seed + 20, octaves=4)[gy, gx]
    mid = fbm(H, W, 1.2 * PX, seed + 21, octaves=4)[gy, gx]
    fine = fbm(H, W, 0.12 * PX, seed + 22, octaves=2)[gy, gx]
    strata = fbm(H, W, (p.get("strata_h", 0.75) * PX, p.get("strata_w", 9.0) * PX), seed + 24, octaves=3)[gy, gx]
    vein = fbm(H, W, (0.25 * PX, 9.0 * PX), seed + 25, octaves=3)[gy, gx]
    spots = fbm(H, W, 1.5 * PX, seed + 26, octaves=3)[gy, gx]
    # split-face facets: periodic cellular noise, a random plane per cell
    from scipy.spatial import cKDTree
    fin = p.get("facet_in", 1.6); aniso = p.get("facet_aniso", 1.0)
    nf = int(W_in * H_in / (fin * fin) * aniso)
    fp = np.column_stack([rng.uniform(0, W_in, nf), rng.uniform(0, H_in, nf)])
    tp = np.concatenate([fp + [ox_, oy_] for ox_ in (-W_in, 0, W_in) for oy_ in (-H_in, 0, H_in)])
    ti = np.tile(np.arange(nf), 9)
    tree = cKDTree(tp * [1, aniso])
    _, ii = tree.query(np.column_stack([X.ravel(), Y.ravel() * aniso]), k=1)
    fid = ti[ii].reshape(H, W)
    fsl = rng.normal(0, p.get("facet_slope", 0.12), (nf, 2)); foff = rng.normal(0, 1, nf)
    fpx = tp[ii, 0].reshape(H, W); fpy = tp[ii, 1].reshape(H, W)
    facets = fsl[fid, 0] * (X - fpx) + fsl[fid, 1] * (Y - fpy) * aniso + foff[fid] * p.get("facet_step", 0.05)
    facets = ndimage.gaussian_filter(facets, p.get("facet_blur", 1.7), mode="wrap")
    ftone = rng.normal(0, p.get("facet_tone", 0.035), nf)[fid]
    # terraced layering for bedded stones
    steps = p.get("terraces", 0)
    if steps:
        t = strata * steps
        terr = (np.floor(t) + np.clip((t - np.floor(t) - 0.75) * 4, 0, 1)) / steps
    else:
        terr = strata * 0
    # ---- height (inches)
    face = prot[lab] * p.get("prot_in", 0.25)
    if centers is not None:
        cx = centers[lab, 0]; cy = centers[lab, 1]
        dxs = (X - cx + W_in / 2) % W_in - W_in / 2
        dys = (Y - cy + H_in / 2) % H_in - H_in / 2
        face = face + tiltx[lab] * dxs * 0.1 + tilty[lab] * dys * 0.1
        sw = sizes[lab, 0]; sh = sizes[lab, 1]
        dome = 1 - (np.clip(np.abs(dxs) / (sw / 2), 0, 1) ** 2 * 0.5 + np.clip(np.abs(dys) / (sh / 2), 0, 1) ** 2 * 0.5)
        face = face + dome * p.get("dome_in", 0.1)
    else:
        face = face + np.clip(d_in / 4, 0, 1) ** 0.6 * p.get("dome_in", 0.15)
    face = (face + p.get("facet_amp", 1.0) * famp_stone[lab] * facets + p.get("undul_in", 0.06) * mid
            + p.get("terrace_in", 0.0) * terr + p.get("strata_in", 0.0) * strata + 0.005 * fine)
    bevel = p.get("bevel_in", 0.35)
    # chipped edges: the rounded fall-off starts further in where the chip noise is high (edges only)
    chip = np.clip(pnoise(H, W, 0.35 * PX, seed + 30) * 0.5 + 0.5, 0, 1)
    edge = np.clip((d_in - bevel * 0.6 * chip) / bevel, 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    hface = face - np.percentile(face, 0.5)
    height = np.maximum(hface, 0) * edge + (1 - edge) * (-0.04)
    relief = float(np.percentile(height, 99.7) - height.min())
    hnorm = np.clip((height - height.min()) / relief, 0, 1)
    # ---- albedo
    a = lin[lab]
    tone = (1 + p.get("mottle", 0.10) * big + 0.04 * mid + p.get("grain", 0.04) * fine + ftone
            + p.get("strata_col", 0.0) * strata + p.get("terrace_col", 0.0) * (terr - 0.5))
    a = a * np.clip(tone, 0.5, 1.6)[..., None]
    if p.get("white_veins", 0) > 0:
        v = ((np.abs(vein) < 0.035) & (spots > 0.2)).astype(np.float32)
        v = ndimage.gaussian_filter(v, 1.1) * 0.8
        wv = p["white_veins"] * (rng.random(n) < p.get("vein_share", 0.4))[lab]
        a = a * (1 - v * wv)[..., None] + srgb_to_lin(hex2rgb(p.get("vein_col", "#d4d1ca")))[None, None, :] * (v * wv)[..., None]
    if p.get("speckle", 0) > 0:
        # granite: crystals, a fine salt-and-pepper over the stone color
        sp = pnoise(H, W, 0.07 * PX, seed + 41)
        a = a * np.clip(1 + p["speckle"] * np.clip(sp, -2.2, 2.2) / 2.2, 0.35, 1.8)[..., None]
    if p.get("rust", 0) > 0:
        r = np.clip((spots - 0.9) * 1.2, 0, 1) * (rng.random(n) < 0.4)[lab]
        r = ndimage.gaussian_filter(r, 2)
        rc = srgb_to_lin(hex2rgb(p.get("rust_col", "#9b5a2e")))
        a = a * (1 - r[..., None] * p["rust"]) + rc[None, None, :] * r[..., None] * p["rust"]
    a = a * (0.93 + 0.07 * edge)[..., None]
    # AO of the face texture (cavities between facets/layers)
    blur = ndimage.gaussian_filter(height, 6, mode="wrap")
    rel = max(float(np.percentile(height, 99.5) - np.percentile(height, 0.5)), 1e-3)
    cav = np.clip((blur - height) / rel * 3.0, 0, 1)
    ao = np.clip(1 - 0.6 * cav, 0.55, 1)
    alb = lin_to_srgb(np.clip(a, 0, 1))
    d_enc = np.clip(d_in / DMAX, 0, 1)
    return dict(albedo=alb, d=d_enc, h=hnorm, ao=ao, relief=relief, n=n, lab=lab, lin=a, height=height, d_in=d_in)


def thumb(res, p, size=320, joint_in=0.25, mortar="#b9b3a7"):
    """Preview shaded like the app does (light from upper left)."""
    H, W = res["d"].shape
    k = int(min(H, W, 24 * PX))  # show ~24 in square
    alb = srgb_to_lin(res["albedo"][:k, :k])
    h = res["height"][:k, :k]
    d = res["d_in"][:k, :k]
    gy, gx = np.gradient(h * PX * 0.0 + h, 1 / PX)
    L = np.array([-0.45, 0.45, 0.77]); L /= np.linalg.norm(L)
    nrm = np.dstack([-gx, gy, np.ones_like(h)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    shade = 0.4 + 0.6 * np.clip((nrm @ L) / L[2], 0.0, 1.8)
    jm = np.clip((d - joint_in) / 0.04 + 0.5, 0, 1)
    m = srgb_to_lin(hex2rgb(mortar))
    col = alb * (shade * res["ao"][:k, :k])[..., None]
    mort = m[None, None, :] * (0.55 + 0.45 * np.clip((joint_in - d) / max(joint_in, 1e-3), 0, 1))[..., None]
    out = col * jm[..., None] + mort * (1 - jm[..., None])
    img = Image.fromarray(to_u8(lin_to_srgb(np.clip(out * 0.95, 0, 1)))).resize((size, size), Image.LANCZOS)
    return img


# ------------------------------------------------------------------ catalog: Buechel's data (catalog_src.json), sample textures
# Every product's name, colors, sizes and coverage come from catalog_build.py. This part only decides how
# its SAMPLE texture is drawn: the pattern from the collection and Buechel's sizes, the colors from
# Buechel's own color words. Nine stones keep looks tuned by hand; other cuts of those stones borrow
# their colors so a stone looks the same in every cut.
import zlib
from multiprocessing import Pool

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog_src.json")
U = lambda a, b: (lambda r, *_: r.uniform(a, b))


def choice(vals, w=None):
    vals = list(vals)
    return lambda r, *_: vals[r.choice(len(vals), p=w)]


BLACK_FROST = [("#2e2f31", 3), ("#3c3e41", 4), ("#525458", 3), ("#686b6f", 2), ("#4b545c", 2.0),
               ("#58604f", 0.22), ("#7a6e5c", 0.25), ("#5c4c3f", 0.2)]


def ledge_lengths(r, h):
    return r.uniform(4, 16)


def ashlar_split(r, b, w):
    k = r.choice([1, 2, 3], p=[0.4, 0.42, 0.18])
    if k == 1 or b < 2.5:
        return [b]
    cuts = np.sort(r.uniform(0.18, 0.82, k - 1))
    parts = np.diff(np.concatenate([[0], cuts, [1]])) * b
    if parts.min() < 0.9:
        return [b]
    return list(parts)


def castle_split(r, b, w):
    if b > 9 and r.random() < 0.55:
        f = r.uniform(0.38, 0.62)
        return [b * f, b * (1 - f)]
    return [b]


def single(r, b, w):
    return [b]


MOD = 2.75  # sawn heights 2-1/4, 5, 7-3/4, 10-1/2 in + 1/2 in joints = 1..4 modules of 2-3/4 in
def dimensional_split(r, b, w):
    combos = [[4], [1, 3], [3, 1], [2, 2], [1, 1, 2], [2, 1, 1], [1, 2, 1], [1, 1, 1, 1]]
    wts = np.array([0.16, 0.14, 0.14, 0.16, 0.1, 0.1, 0.1, 0.1]); wts /= wts.sum()
    c = combos[r.choice(len(combos), p=wts)]
    return [k * MOD for k in c]


def dimensional_split3(r, b, w):
    """Blends with three sawn heights (no 10-1/2 in): bands of 3 modules."""
    combos = [[3], [1, 2], [2, 1], [1, 1, 1]]
    wts = np.array([0.3, 0.25, 0.25, 0.2])
    c = combos[r.choice(len(combos), p=wts / wts.sum())]
    return [k * MOD for k in c]


def fieldledge_h(r):
    return r.uniform(2, 8) if r.random() < 0.7 else r.uniform(2, 4)


# The nine looks tuned by hand (generator settings only; the data is Buechel's, from catalog_src.json)
HAND = {
    "black-frost-ledgestone": dict(
        kind="ledge", tile_in=(36, 36), palette=BLACK_FROST, row_h=lambda r: (r.uniform(0.5, 1.5) if r.random() < 0.45 else r.uniform(1.4, 3.0)),
        stone_l=ledge_lengths, split_p=0.12, warp_x=0.35, warp_y=0.10, warp_cell=2.0, facet_in=1.3, facet_aniso=3.2, facet_slope=0.07, facet_step=0.03, terraces=3, terrace_in=0.14, terrace_col=0.07, strata_in=0.03, strata_col=0.05, undul_in=0.04, desat=0.4, prot_in=0.35, dome_in=0.05, bevel_in=0.22, white_veins=0.4, mottle=0.08, defaultJoint="dry", seed=100),
    "fond-du-lac-country-squire": dict(
        kind="ashlar", tile_in=(48, 48),
        palette=[("#aba9a2", 4), ("#9c9a94", 3), ("#bab7af", 3), ("#c6c3bb", 2), ("#8b8983", 1.5)],
        band_h=lambda r: r.uniform(6.5, 9.0), col_w=lambda r, b: r.uniform(6, 22), split=ashlar_split,
        warp_x=0.25, warp_y=0.12, warp_cell=4, facet_in=2.6, facet_aniso=1.4, facet_slope=0.08, facet_step=0.025, undul_in=0.08, strata_col=0.03, prot_in=0.25, dome_in=0.12, bevel_in=0.35, mottle=0.10, defaultJoint="standard", seed=107),
    "fond-du-lac-castle-rock": dict(
        kind="castle", tile_in=(48, 48),
        palette=[("#a9a59d", 4), ("#9b978f", 3), ("#bdb5a5", 2.2), ("#c9c4b9", 1.6), ("#6f6d69", 0.8)],
        band_h=lambda r: r.uniform(8, 13), col_w=lambda r, b: r.uniform(7, 22), split=castle_split,
        warp_x=0.5, warp_y=0.35, warp_cell=3, facet_in=3.6, facet_aniso=1.15, facet_slope=0.2, facet_step=0.015, facet_blur=4.0, undul_in=0.07, prot_in=0.45, dome_in=0.35, bevel_in=0.6, mottle=0.12, defaultJoint="standard", seed=114),
    "chilton-tailored-blend": dict(
        kind="dimensional", tile_in=(48, 44),
        palette=[("#857d82", 3), ("#736d72", 2.5), ("#97948d", 3), ("#7c838a", 2), ("#b0a28a", 2), ("#c8bfac", 1.6)],
        band_h=lambda r: 4 * MOD, col_w=lambda r, b: r.uniform(6, 22), split=dimensional_split,
        warp_x=0.25, warp_y=0.03, warp_cell=4, facet_in=2.0, facet_aniso=1.6, facet_slope=0.08, facet_step=0.02, undul_in=0.06, desat=0.5, prot_in=0.18, dome_in=0.06, bevel_in=0.25, mottle=0.10, defaultJoint="standard", seed=121),
    "highland-scotch-siena": dict(
        kind="fieldledge", tile_in=(48, 48),
        palette=[("#b69b75", 3), ("#a18563", 3), ("#b38d52", 2), ("#a96c3e", 1.4), ("#77583e", 1.6), ("#8c8981", 1.6), ("#c4ad7a", 1.2), ("#985a35", 1), ("#d3cabb", 0.8)],
        row_h=fieldledge_h, stone_l=lambda r, h: r.uniform(4, 16), split_p=0.1,
        warp_x=0.7, warp_y=0.45, warp_cell=3, facet_in=1.5, facet_aniso=2.5, facet_slope=0.12, facet_step=0.03, terraces=3, terrace_in=0.12, terrace_col=0.05, undul_in=0.08, desat=0.35, strata_in=0.08, strata_col=0.08, prot_in=0.4, dome_in=0.2, bevel_in=0.5, rust=0.5, rust_col="#8f4f28", mottle=0.14, defaultJoint="standard", seed=128),
    "spalted-oak-tailored-fieldledge": dict(
        kind="tailored_fieldledge", tile_in=(48, 48),
        palette=[("#8a8984", 3), ("#4a4a49", 2), ("#cbc8c0", 1.5), ("#66707a", 2), ("#ab9879", 2), ("#7a624a", 1.6)],
        row_h=lambda r: [2.5, 4.5, 6.5][r.choice(3, p=[0.45, 0.35, 0.2])], stone_l=lambda r, h: r.uniform(5, 20),
        warp_x=0.5, warp_y=0.02, warp_cell=3, facet_in=1.6, facet_aniso=3.0, facet_slope=0.08, facet_step=0.025, terraces=3, terrace_in=0.1, terrace_col=0.08, undul_in=0.04, desat=0.35, strata_in=0.12, strata_col=0.14, strata_w=10, prot_in=0.2, dome_in=0.05, bevel_in=0.25, mottle=0.1, defaultJoint="dry", seed=135),
    "barnwood-blue-ashlar": dict(
        kind="ashlar", tile_in=(48, 48),
        palette=[("#5f6a75", 3), ("#43474c", 2.5), ("#c6c3bb", 1.3), ("#868886", 2.5), ("#a69780", 1.6)],
        band_h=lambda r: r.uniform(5.5, 8.5), col_w=lambda r, b: r.uniform(6, 22), split=ashlar_split,
        warp_x=0.3, warp_y=0.08, warp_cell=4, facet_in=1.8, facet_aniso=3.0, facet_slope=0.08, facet_step=0.025, terraces=3, terrace_in=0.09, terrace_col=0.08, undul_in=0.04, desat=0.35, strata_in=0.12, strata_col=0.18, strata_w=12, strata_h=0.25, prot_in=0.2, dome_in=0.06, bevel_in=0.3, white_veins=0.25, mottle=0.1, defaultJoint="standard", seed=142),
    "antique-bronze-fieldstone": dict(
        kind="mosaic", tile_in=(48, 48),
        palette=[("#a88f6c", 4), ("#806752", 3), ("#8a8680", 2.2), ("#86594a", 0.5), ("#b9a183", 1.8)],
        radius=lambda r: r.uniform(3.5, 7.5) if r.random() < 0.55 else r.uniform(1.6, 3.2), power=1.0,
        warp_x=0.6, warp_y=0.6, warp_cell=2.5, facet_in=2.2, facet_aniso=1.0, facet_slope=0.08, facet_step=0.02, undul_in=0.08, desat=0.4, prot_in=0.35, dome_in=0.3, bevel_in=0.55, mottle=0.12, grain=0.08, defaultJoint="standard", seed=149),
    "black-frost-webwall": dict(
        kind="mosaic", tile_in=(48, 48), palette=BLACK_FROST,
        radius=lambda r: r.uniform(4, 8) if r.random() < 0.6 else r.uniform(1.8, 3.5), power=1.0,
        warp_x=0.12, warp_y=0.12, warp_cell=4, facet_in=1.8, facet_aniso=2.0, facet_slope=0.06, facet_step=0.04, terraces=3, terrace_in=0.08, terrace_col=0.05, undul_in=0.03, desat=0.4, strata_in=0.05, prot_in=0.2, dome_in=0.05, bevel_in=0.25, white_veins=0.45, mottle=0.08, defaultJoint="standard", seed=156),
}
# what other cuts of a hand-tuned stone borrow from it: its colors, not its pattern
CARRY = ("palette", "desat", "mottle", "white_veins", "vein_col", "rust", "rust_col", "strata_col", "terrace_col", "grain")

# ---- colors from Buechel's color words (sRGB, muted the way quarried stone is)
COLOR = {
    "black": "#2b2c2e", "dark charcoal": "#343537", "charcoal": "#3f4042", "dark gray": "#5a5b5b", "gray": "#85847f",
    "cool gray": "#7f8285", "light gray": "#aba8a0", "silver": "#a8a9a7", "white": "#d2cec4", "ivory": "#d6cdba",
    "cream": "#cfc4aa", "linen": "#d4cab7", "butter": "#cfc095", "beige": "#c0b197", "taupe": "#8d8274",
    "light buff": "#c8b794", "buff": "#b8a17f", "silver-buff": "#b1a997", "tan": "#a58e6f", "mocha": "#7c6753",
    "brown": "#7a6049", "dark brown": "#58432f", "burnt brown": "#6a4a36", "gold": "#ad8c5a", "honey": "#b39463",
    "yellow": "#b9a06a", "mustard": "#a08850", "light orange": "#bb916a", "orange": "#a8784f", "rust": "#8f5d40",
    "light red": "#a07264", "red": "#8a5446", "pink": "#ad8b80", "bronze": "#86694a", "mauve": "#8b7d80",
    "lavender": "#9b94a0", "purple": "#776b7a", "blue": "#6a737c", "green": "#707566",
}
WORDS = [(r"dark charcoals?", "dark charcoal"), (r"charcoals?", "charcoal"), (r"blacks?", "black"),
         (r"dark gr[ae]ys?", "dark gray"), (r"light gr[ae]ys?", "light gray"), (r"gr[ae]ys?", "gray"),
         (r"silver-buffs?", "silver-buff"), (r"silvers?", "silver"), (r"whites?", "white"), (r"ivory", "ivory"),
         (r"creamy|creams?", "cream"), (r"linens?", "linen"), (r"butter", "butter"), (r"beiges?", "beige"),
         (r"taupe", "taupe"), (r"light buffs?", "light buff"), (r"buffs?", "buff"), (r"tans?", "tan"),
         (r"mochas?", "mocha"), (r"dark browns?", "dark brown"), (r"burnt browns?", "burnt brown"), (r"browns?", "brown"),
         (r"golds?", "gold"), (r"honey", "honey"), (r"yellows?", "yellow"), (r"mustards?", "mustard"),
         (r"light oranges?", "light orange"), (r"oranges?", "orange"), (r"rusts?|rusty", "rust"), (r"light reds?", "light red"),
         (r"reds?", "red"), (r"pinks?", "pink"), (r"bronze", "bronze"), (r"mauves?", "mauve"), (r"lavenders?", "lavender"),
         (r"purples?", "purple"), (r"blues?", "blue"), (r"greens?", "green")]
WORD_RE = re.compile(r"\b(" + "|".join(f"(?:{w})" for w, _ in WORDS) + r")\b")
RANGES = [(r"light gr[ae]ys to dark gr[ae]ys|light to dark gr[ae]ys", "light grays, grays, dark grays"),
          (r"gr[ae]ys to charcoals", "grays, dark grays, charcoals"),
          (r"whites? to gr[ae]ys|gr[ae]y to white", "whites, light grays, grays"),
          (r"light gr[ae]ys to whites", "light grays, whites"),
          (r"browns? to buffs?( tones)?", "browns, tans, buffs"),
          (r"cream to white", "creams, ivory, whites"),
          (r"creamy range from butter to linen", "butter, creams, linens"),
          (r"a range of blacks and charcoals", "blacks, charcoals"),
          (r"earth tones", "browns, buffs, tans")]
FEW = re.compile(r"\b(occasional(ly)?|possibl[ey]|may|small percentage|hints?|accents?|touch(es)?|subtle|a percentage|some)\b")


def palette_from_words(words, stone_type):
    """Buechel's color words -> weighted palette and a few surface effects (veins, striations, mottling)."""
    pal, fx = {}, {}
    shift = np.array([1.0, 1.0, 1.0])
    for i, phrase in enumerate(words):
        s = phrase.lower()
        w = 3.0 * 0.72 ** i          # Buechel lists the main colors first
        if FEW.search(s):
            w *= 0.25
        elif "slightly" in s:
            w *= 0.35
        elif "undertone" in s and i > 0:
            w *= 0.45
        if "warm" in s:
            shift = shift * [1.025, 1.0, 0.965]
        if "cool" in s:
            shift = shift * [0.975, 1.0, 1.03]
        if "consistent" in s or "uniform" in s:
            fx["tone_jitter"] = 0.045; fx["desat"] = 0.55
        if "mottled" in s:
            fx["mottle"] = 0.18
        if re.search(r"swirl|interwoven|graining|streaks? of brown|brown streaks", s):
            fx["strata_col"] = max(fx.get("strata_col", 0), 0.12)
        # veins and striations are drawn as veins, not as stone colors
        if re.search(r"(streaks|striations|veins|veining|fossils)", s):
            if "blue" in s:
                fx["white_veins"] = 0.28; fx["vein_col"] = "#7d8995"; continue
            if "light gray" in s:
                fx["strata_col"] = max(fx.get("strata_col", 0), 0.12); pal["light gray"] = pal.get("light gray", 0) + 0.4; continue
            if "brown" in s:
                fx["strata_col"] = max(fx.get("strata_col", 0), 0.12); pal["brown"] = pal.get("brown", 0) + 0.4; continue
            if "white" in s:
                fx["white_veins"] = 0.15 if "fossil" in s else (0.3 if "black" in s else 0.4)
                if "fossil" in s:
                    fx["vein_share"] = 0.25
                if "black" in s:
                    pal["black"] = pal.get("black", 0) + 0.3
                continue
        if i > 0 and re.search(r"\brust", s):
            fx["rust"] = 0.3; fx["rust_col"] = "#8f5536"      # rusty tones show as stains on some stones
        for pat, rep in RANGES:
            s = re.sub(pat, rep, s)
        found = [next(k for p, k in WORDS if re.fullmatch(p, m)) for m in WORD_RE.findall(s)]
        if "gray tone" in s and "cool" in s:
            found = ["cool gray" if f == "gray" else f for f in found]
        for k in found:
            pal[k] = pal.get(k, 0) + w * (1.0 if len(found) == 1 else 1.3 / len(found))
    if not pal:
        pal = {"gray": 1.0}
    out = []
    for k, w in sorted(pal.items(), key=lambda t: -t[1]):
        rgb = np.clip(hex2rgb(COLOR[k]) * shift, 0, 1)
        out.append(("#%02x%02x%02x" % tuple(int(round(v * 255)) for v in rgb), round(w, 3)))
        if w >= 1.5:   # natural variation inside one color: a little lighter and darker stones
            for f in (1.09, 0.9):
                v = np.clip(rgb * f, 0, 1)
                out.append(("#%02x%02x%02x" % tuple(int(round(x * 255)) for x in v), round(w * 0.3, 3)))
    return out, fx


# ---- how each kind of stone (Buechel's stone type) wears its surface
MATERIAL = {
    "Schist": dict(desat=0.35, mottle=0.1, grain=0.04, terraces=3, terrace_in=0.1, terrace_col=0.07, strata_in=0.1, strata_col=0.12, strata_w=11, strata_h=0.3, facet_aniso=3.0, facet_slope=0.08, facet_step=0.025),
    "Quartzitic sandstone": dict(desat=0.4, mottle=0.08, grain=0.05, terraces=3, terrace_in=0.1, terrace_col=0.05, strata_in=0.04, strata_col=0.05, facet_aniso=2.6, facet_slope=0.07, facet_step=0.03),
    "Fine-grained sandstone": dict(desat=0.4, mottle=0.08, grain=0.05, terraces=3, terrace_in=0.1, terrace_col=0.05, strata_in=0.04, strata_col=0.05, facet_aniso=2.6, facet_slope=0.07, facet_step=0.03),
    "Quartzitic sandstone and schist": dict(desat=0.38, mottle=0.09, grain=0.05, terraces=3, terrace_in=0.1, terrace_col=0.06, strata_in=0.07, strata_col=0.09, facet_aniso=2.8, facet_slope=0.075, facet_step=0.028),
    "Dolomitic limestone": dict(desat=0.4, mottle=0.12, grain=0.04, strata_col=0.03, facet_aniso=1.4, facet_slope=0.09, facet_step=0.025),
    "Limestone": dict(desat=0.45, mottle=0.09, grain=0.03, strata_col=0.04, facet_aniso=1.5, facet_slope=0.06, facet_step=0.015),
    "Sandstone": dict(desat=0.35, mottle=0.1, grain=0.08, strata_col=0.07, strata_in=0.04, facet_aniso=2.0, facet_slope=0.08, facet_step=0.02),
    "Granite": dict(desat=0.25, mottle=0.06, grain=0.05, speckle=0.35, facet_aniso=1.2, facet_slope=0.1, facet_step=0.03),
    "Gneiss (a type of granite)": dict(desat=0.3, mottle=0.07, grain=0.05, speckle=0.2, strata_col=0.22, strata_in=0.05, strata_w=12, strata_h=0.35, terraces=2, terrace_in=0.06, facet_aniso=2.8, facet_slope=0.07, facet_step=0.02),
}
KINDS = {"Ledgestone": "ledge", "Fieldledge": "fieldledge", "Tailored Fieldledge": "tailored_fieldledge", "Ashlar": "ashlar",
         "Castle Rock": "castle", "Dimensional": "dimensional", "Mosaic": "mosaic"}
SHAPE_WORD = {"ledge": "Random Ends", "fieldledge": "Random Ends", "tailored_fieldledge": "Random Ends", "ashlar": "Squares & Rectangles",
              "castle": "Squares & Rectangles", "dimensional": "Squares & Rectangles", "mosaic": "Irregular"}


def auto_params(c, by_id):
    """Generator settings for a product without a hand-tuned look."""
    kind = KINDS[c["collection"]]
    name, d = c["name"], c.get("dims") or {}
    p = dict(kind=kind, tile_in=(48, 48))
    p.update(MATERIAL.get(c.get("stoneType"), dict(desat=0.4, mottle=0.1, grain=0.04, facet_aniso=1.6, facet_slope=0.08, facet_step=0.02)))
    pal, fx = palette_from_words(c["colorWords"], c.get("stoneType"))
    p["palette"] = pal; p["unify"] = 0.22; p.update(fx)
    h0, h1 = d.get("height", [None, None])[:2]
    l0, l1 = (d.get("length") or [None, None])[:2]
    if kind == "ledge":
        h0, h1 = h0 or 0.5, h1 or 3.0; l0, l1 = l0 or 4, l1 or 16
        mid = (h0 + h1) / 2
        p.update(tile_in=(36, 36), row_h=lambda r, a=h0, b=h1, m=mid: (r.uniform(a, m) if r.random() < 0.45 else r.uniform(m * 0.92, b)),
                 stone_l=lambda r, h, a=l0, b=l1: r.uniform(a, b), split_p=0.12, warp_x=0.35, warp_y=0.10, warp_cell=2.0,
                 facet_in=1.3, undul_in=0.04, prot_in=0.35, dome_in=0.05, bevel_in=0.22, defaultJoint="dry")
        p["facet_aniso"] = max(p.get("facet_aniso", 1.6), 2.4)
        if "Pioneer Blend" in name:     # 75% ledgestone, 25% fieldstone: the ledgestone part drawn
            p.update(row_h=lambda r: r.uniform(1, 2.2) if r.random() < 0.5 else r.uniform(2, 4.2), stone_l=lambda r, h: r.uniform(6, 24))
    elif kind == "fieldledge":
        if "Colonial Blend" in name:    # Castle Rock, Country Squire and Webwall pieces: drawn as mixed blocks
            p.update(kind="ashlar", band_h=lambda r: r.uniform(6, 12.5), col_w=lambda r, b: r.uniform(5, 22), split=ashlar_split,
                     warp_x=0.5, warp_y=0.3, warp_cell=3, facet_in=2.8, undul_in=0.07, prot_in=0.4, dome_in=0.3, bevel_in=0.55)
        elif "Pioneer Blend" in name:
            p.update(kind="ledge", tile_in=(36, 36), row_h=lambda r: r.uniform(1, 2.2) if r.random() < 0.5 else r.uniform(2, 4.2),
                     stone_l=lambda r, h: r.uniform(6, 24), split_p=0.1, warp_x=0.4, warp_y=0.12, warp_cell=2.0,
                     facet_in=1.4, undul_in=0.05, prot_in=0.35, dome_in=0.08, bevel_in=0.25, defaultJoint="dry")
        else:
            h0, h1 = h0 or 2, h1 or 8; l0, l1 = l0 or 4, l1 or 16
            p.update(row_h=lambda r, a=h0, b=h1: r.uniform(a, b) if r.random() < 0.7 else r.uniform(a, a + (b - a) * 0.33),
                     stone_l=lambda r, h, a=l0, b=l1: r.uniform(a, b), split_p=0.1, warp_x=0.7, warp_y=0.45, warp_cell=3,
                     facet_in=1.5, undul_in=0.08, prot_in=0.4, dome_in=0.2, bevel_in=0.5)
            p["facet_slope"] = max(p.get("facet_slope", 0.08), 0.1)
    elif kind == "tailored_fieldledge":
        hs = d.get("heights") or [2, 4, 6]
        rows = [h + 0.5 for h in hs]
        wts = np.array([0.45, 0.35, 0.2][: len(rows)]); wts = wts / wts.sum()
        p.update(row_h=lambda r, rows=rows, wts=wts: rows[r.choice(len(rows), p=wts)],
                 stone_l=lambda r, h: r.uniform(5, 20), warp_x=0.5, warp_y=0.02, warp_cell=3, facet_in=1.6, undul_in=0.04,
                 prot_in=0.2, dome_in=0.05, bevel_in=0.25, defaultJoint="dry")
    elif kind == "ashlar":
        h0, h1 = h0 or 0.5, h1 or 8; l0, l1 = l0 or 6, l1 or 24
        top = min(h1, 12) + 0.5
        p.update(band_h=lambda r, t=top: r.uniform(max(4.5, t * 0.72), t), col_w=lambda r, b, a=l0, z=l1: r.uniform(a, min(z, 24) - 2),
                 split=ashlar_split, warp_x=0.25, warp_y=0.12, warp_cell=4, facet_in=2.6, undul_in=0.08,
                 prot_in=0.25, dome_in=0.12, bevel_in=0.35)
        if "Jumpers" in name:
            p.update(band_h=lambda r: r.uniform(5.5, 10.5), split=single)
        if "River Rock" in name:        # tumbled: soft, rounded edges
            p.update(bevel_in=0.85, dome_in=0.32, prot_in=0.3, warp_x=0.4, warp_y=0.25, facet_slope=0.04, facet_step=0.01)
        if "Splitface" in name:         # split faces: flat and even
            p.update(prot_in=0.12, dome_in=0.03, bevel_in=0.2)
    elif kind == "castle":
        l0, l1 = l0 or 6, l1 or 24
        p.update(band_h=lambda r: r.uniform(8, 13), col_w=lambda r, b, a=l0, z=l1: r.uniform(max(5, a + 1), min(z, 24) - 2),
                 split=castle_split, warp_x=0.5, warp_y=0.35, warp_cell=3, facet_in=3.6, facet_blur=4.0, undul_in=0.07,
                 prot_in=0.45, dome_in=0.35, bevel_in=0.6)
        p["facet_slope"] = max(p.get("facet_slope", 0.08) * 1.6, 0.14); p["facet_aniso"] = min(p.get("facet_aniso", 1.4), 1.8)
    elif kind == "dimensional":
        hs = d.get("heights") or [2.25, 5, 7.75, 10.5]
        three = len(hs) == 3
        p.update(tile_in=(48, 41.25) if three else (48, 44), band_h=(lambda r: 3 * MOD) if three else (lambda r: 4 * MOD),
                 col_w=lambda r, b: r.uniform(6, 22), split=dimensional_split3 if three else dimensional_split,
                 warp_x=0.25, warp_y=0.03, warp_cell=4, facet_in=2.0, undul_in=0.06, prot_in=0.18, dome_in=0.06, bevel_in=0.25)
        if "Rockfaced" in name:
            p.update(rockfaced=0.5, prot_in=0.4, bevel_in=0.3)
        if "Indiana" in name:           # "some of the most consistent color available"
            p.update(tone_jitter=0.04, desat=0.55)
    else:  # mosaic
        p.update(radius=lambda r: r.uniform(3.5, 7.5) if r.random() < 0.55 else r.uniform(1.6, 3.2), power=1.0,
                 warp_x=0.6, warp_y=0.6, warp_cell=2.5, facet_in=2.2, undul_in=0.08, prot_in=0.35, dome_in=0.3, bevel_in=0.55)
        if "Webwall" in name:           # flatter, sharper pieces
            p.update(radius=lambda r: r.uniform(4, 8) if r.random() < 0.6 else r.uniform(1.8, 3.5),
                     warp_x=0.12, warp_y=0.12, warp_cell=4, facet_in=1.8, undul_in=0.03, prot_in=0.2, dome_in=0.05, bevel_in=0.25)
        if "River Rock" in name:        # tumbled, rounded
            p.update(warp_x=0.45, warp_y=0.45, warp_cell=2.5, dome_in=0.5, bevel_in=0.7, prot_in=0.35, undul_in=0.05, facet_slope=0.03, facet_step=0.005)
    if c.get("coverage") and c["coverage"].get("dryOnly"):
        p["defaultJoint"] = "dry"
    p.setdefault("defaultJoint", "standard")
    # other cuts of a hand-tuned stone wear its colors
    for sid in c.get("siblings", []):
        if sid in HAND:
            p["unify"] = 0.0
            for k in CARRY:
                if k in HAND[sid]:
                    p[k] = HAND[sid][k]
                elif k in ("white_veins", "rust"):
                    p.pop(k, None)
            break
    p["seed"] = 1000 + zlib.crc32(c["id"].encode()) % 9000
    return p


def params_for(c, by_id):
    return dict(HAND[c["id"]]) if c["id"] in HAND else auto_params(c, by_id)


def render_one(args):
    c, out, force = args
    by_id = None
    p = params_for(c, by_id)
    d = os.path.join(out, c["id"]); os.makedirs(d, exist_ok=True)
    meta_path = os.path.join(d, "meta.json")
    if not force and os.path.exists(meta_path) and all(os.path.exists(os.path.join(d, f)) for f in ("albedo.jpg", "relief.jpg", "thumb.jpg")):
        return json.load(open(meta_path))
    res = build(p, seed=p["seed"])
    alb_ao = lin_to_srgb(np.clip(srgb_to_lin(res["albedo"]) * (res["ao"] ** 0.8)[..., None], 0, 1))
    Image.fromarray(to_u8(alb_ao)).save(f"{d}/albedo.jpg", quality=86, optimize=True, progressive=True)
    # relief.jpg: the face height on top, the distance to the joint below, as one grayscale JPEG. Tile sizes are
    # multiples of 8 px, so no JPEG block straddles the two halves; at quality 92 the joint distance is off by at
    # most 4 of 255 levels (0.02 in), and the site needs one file less per stone.
    Image.fromarray(np.vstack([to_u8(res["h"]), to_u8(res["d"])]), "L").save(f"{d}/relief.jpg", quality=92, optimize=True)
    for old in ("height.jpg", "dist.png"):
        if os.path.exists(f"{d}/{old}"):
            os.remove(f"{d}/{old}")
    jt = {"dry": 0.06, "standard": 0.25, "overgrout": 0.5}[p.get("defaultJoint", "standard")]
    thumb(res, p, joint_in=jt, mortar="#2a2a2a" if p.get("defaultJoint") == "dry" else "#b9b3a7").save(f"{d}/thumb.jpg", quality=86)
    meta = dict(kind=p["kind"], defaultJoint=p.get("defaultJoint", "standard"), tileIn=[float(v) for v in p["tile_in"]],
                reliefIn=round(res["relief"], 3), dMaxIn=DMAX, rowShuffle=p["kind"] not in ("mosaic",), stones=int(res["n"]),
                swatchColors=[col for col, w in sorted(p["palette"], key=lambda t: -t[1])[:5]])
    json.dump(meta, open(meta_path, "w"))
    print(c["id"], p["kind"], "stones", res["n"], "relief_in", round(res["relief"], 3), flush=True)
    return meta


def main(argv):
    only = None; jobs = 2; force = False; out = OUT
    for a in argv:
        if a.startswith("--only="):
            only = set(a[7:].split(","))
        elif a.startswith("--jobs="):
            jobs = int(a[7:])
        elif a == "--force":
            force = True
        elif a.startswith("--out="):
            out = a[6:]
    src = json.load(open(SRC))
    todo = [(c, out, force or (only is not None and c["id"] in only)) for c in src if only is None or c["id"] in only]
    with Pool(jobs) as pool:
        metas = pool.map(render_one, todo, chunksize=1)
    by = {c["id"]: m for (c, _, _), m in zip(todo, metas)}
    if only is None or os.path.exists(os.path.join(out, "catalog.json")):
        # the app's catalog: Buechel's data plus what the sample texture needs
        cat = []
        for c in src:
            m = by.get(c["id"]) or json.load(open(os.path.join(out, c["id"], "meta.json")))
            e = {k: c[k] for k in ("id", "name", "collection", "family", "cut", "tones", "tone", "stoneType", "colorWords", "sizes", "veneer", "url", "specUrl", "coverage", "siblings")}
            e.update(shape=SHAPE_WORD[KINDS[c["collection"]]], **m, sample=True)
            cat.append(e)
        json.dump(cat, open(os.path.join(out, "catalog.json"), "w"), separators=(",", ":"), ensure_ascii=False)
        print("catalog.json:", len(cat), "stones")


if __name__ == "__main__":
    main(sys.argv[1:])
