"""Room textures for the rendered sample scenes: oak floor, pine ceiling, lodge rug,
rough-sawn timber. Not stone (stone is generated separately)."""
import numpy as np
from PIL import Image
from texlib import pnoise, fbm, wrap_blur, rng, hex2rgb, to_u8
import os, sys

OUT = "/home/claude/build/roomtex"
os.makedirs(OUT, exist_ok=True)


def planks(N, plank_w_px, len_range_px, base_cols, seed, grain_cell=(3, 220), gap=2,
           knot_rate=0.0, vertical=False, ray_flecks=False, bevel=3):
    """Wood planks running along x. Returns sRGB float image (N, N, 3) and height (N, N)."""
    r = rng(seed)
    H = W = N
    img = np.zeros((H, W, 3), np.float32)
    height = np.ones((H, W), np.float32)
    nrows = H // plank_w_px
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # distortion fields for grain
    d1 = fbm(H, W, (40, 300), seed + 1, octaves=4) * 9
    d2 = fbm(H, W, (8, 60), seed + 2, octaves=3) * 1.6
    fine = fbm(H, W, (1.5, 12), seed + 3, octaves=2)
    mott = fbm(H, W, (30, 160), seed + 4, octaves=4)
    for row in range(nrows):
        y0 = row * plank_w_px
        y1 = y0 + plank_w_px
        # random plank breaks along x, periodic
        cuts = []
        x = r.uniform(0, W)
        start = x
        total = 0
        lens = []
        while total < W:
            L = r.uniform(*len_range_px)
            lens.append(L)
            total += L
        # scale lengths to exactly W
        lens = np.array(lens) * (W / total)
        xs = (start + np.concatenate([[0], np.cumsum(lens)[:-1]])) % W
        for k, L in enumerate(lens):
            xa = xs[k]
            col = base_cols[r.integers(len(base_cols))] * r.uniform(0.86, 1.12) * np.array(
                [1, r.uniform(0.96, 1.04), r.uniform(0.92, 1.06)], np.float32)
            freq = r.uniform(0.18, 0.42)
            phase = r.uniform(0, 100)
            sub = (slice(y0, y1),)
            # pixels of this plank (with wrap)
            xr = (xx[y0:y1] - xa) % W
            m = xr < L
            ly = yy[y0:y1] - y0
            g = np.sin((ly + d1[y0:y1] + d2[y0:y1] + phase) * freq * 2 * np.pi * 0.25)
            grain = 0.5 + 0.5 * np.sign(g) * np.abs(g) ** 0.35
            tone = 1.0 - 0.10 * grain + 0.035 * fine[y0:y1] + 0.06 * mott[y0:y1]
            if ray_flecks:
                fl = (pnoise(y1 - y0, W, (2, 18), seed + 900 + row) > 2.1).astype(np.float32)
                tone = tone * (1 - 0.05 * fl[:, :])
            c = col[None, None, :] * tone[..., None]
            # knots
            if knot_rate > 0 and r.random() < knot_rate * L / 300:
                kx = (xa + r.uniform(0.2, 0.8) * L) % W
                ky = r.uniform(0.25, 0.75) * plank_w_px
                rx = r.uniform(7, 14)
                ry = rx * r.uniform(0.55, 0.8)
                dx = ((xx[y0:y1] - kx + W / 2) % W - W / 2)
                dy = ly - ky
                rr = np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
                knot = np.clip(1.3 - rr, 0, 1) ** 1.5
                ring = 0.5 + 0.5 * np.sin(rr * 9)
                c = c * (1 - 0.55 * knot[..., None] * (0.7 + 0.3 * ring[..., None]))
                halo = np.exp(-(rr - 1.0) ** 2 * 3) * 0.15
                c = c * (1 - halo[..., None] * 0.6)
            img[y0:y1][m] = c[m]
            # bevel / gap at ends
            dist_end = np.minimum(xr, L - xr)
            e = np.clip(dist_end / bevel, 0, 1)
            hh = np.where(m, e, 1.0)
            height[y0:y1] = np.where(m, np.minimum(height[y0:y1], hh), height[y0:y1])
            gapm = m & (dist_end < gap * 0.5)
            img[y0:y1][gapm] *= 0.35
        # long-edge bevel
        ey = np.minimum(yy[y0:y1] - y0, y1 - 1 - yy[y0:y1])
        e = np.clip(ey / bevel, 0, 1)
        height[y0:y1] = np.minimum(height[y0:y1], e)
        gm = ey < gap * 0.5
        img[y0:y1][gm] *= 0.35
    shade = 0.82 + 0.18 * height
    img *= shade[..., None]
    return np.clip(img, 0, 1), height


def oak_floor():
    N = 2048
    cols = [hex2rgb(c) for c in ["#b07e4f", "#a87447", "#ba8a5a", "#9c6a40", "#b5845a"]]
    img, h = planks(N, 128, (500, 1500), cols, 11, knot_rate=0.25, ray_flecks=True, bevel=3, gap=2)
    Image.fromarray(to_u8(img)).save(f"{OUT}/oak_floor.jpg", quality=92)
    Image.fromarray(to_u8(h)).save(f"{OUT}/oak_floor_h.png")


def pale_oak_floor():
    N = 2048
    cols = [hex2rgb(c) for c in ["#c7a582", "#bf9c78", "#cfae8b", "#b8946f", "#c9a987"]]
    img, h = planks(N, 160, (700, 1800), cols, 21, knot_rate=0.12, ray_flecks=True, bevel=2, gap=2)
    Image.fromarray(to_u8(img)).save(f"{OUT}/pale_oak_floor.jpg", quality=92)
    Image.fromarray(to_u8(h)).save(f"{OUT}/pale_oak_floor_h.png")


def pine_ceiling():
    N = 2048
    cols = [hex2rgb(c) for c in ["#c99a62", "#d1a46b", "#bf8f58", "#d6ad78", "#c4945c"]]
    img, h = planks(N, 120, (900, 2000), cols, 31, knot_rate=0.9, bevel=4, gap=3)
    Image.fromarray(to_u8(img)).save(f"{OUT}/pine_ceiling.jpg", quality=92)
    Image.fromarray(to_u8(h)).save(f"{OUT}/pine_ceiling_h.png")


def lodge_rug():
    W, H = 2048, 1434  # ~ 8' x 5'7"
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / W
    v = yy / H
    cream = hex2rgb("#d9cdb4")
    red = hex2rgb("#8a3328")
    char = hex2rgb("#3a3532")
    sage = hex2rgb("#7b876b")
    tan = hex2rgb("#a8865d")
    img = np.ones((H, W, 3), np.float32) * cream
    bx = np.minimum(u, 1 - u) * W
    by = np.minimum(v, 1 - v) * H
    b = np.minimum(bx, by)
    img[b < 60] = char
    img[(b >= 60) & (b < 82)] = red
    img[(b >= 82) & (b < 96)] = cream
    # stepped diamond band near border
    band = (b >= 96) & (b < 190)
    t = np.where(bx < by, yy, xx)
    phase = (t % 120) / 120
    dist = np.abs(b - 143) / 47
    tri = np.abs(phase - 0.5) * 2
    stepped = np.floor(tri * 6) / 6
    img[band & (dist < stepped)] = red
    img[band & (dist < stepped * 0.45)] = char
    # centre field: large stepped diamonds
    cu = (u - 0.5) * W
    cv = (v - 0.5) * H
    for cxp, col in [(-480, sage), (0, red), (480, sage)]:
        d = np.abs(cu - cxp) / 230 + np.abs(cv) / 330
        dd = np.floor(d * 8) / 8
        m = (b >= 230) & (dd < 1)
        img[m & (dd >= 0.75)] = col
        img[m & (dd >= 0.5) & (dd < 0.75)] = cream
        img[m & (dd >= 0.25) & (dd < 0.5)] = char if col is not red else tan
        img[m & (dd < 0.25)] = col
    # wool texture
    n1 = fbm(H, W, 3, 5, octaves=2)
    n2 = fbm(H, W, (40, 40), 6, octaves=3)
    fib = pnoise(H, W, (1.2, 6), 7)
    img *= (1 + 0.06 * n1 + 0.05 * n2 + 0.035 * fib)[..., None]
    img = wrap_blur(img, (0.8, 0.8, 0))
    Image.fromarray(to_u8(img)).save(f"{OUT}/lodge_rug.jpg", quality=92)


def timber():
    """Rough-sawn timber for the mantel; seamless along x."""
    W, H = 2048, 512  # 2.0 m x 0.5 m
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = hex2rgb("#7a5536")
    d = fbm(H, W, (60, 600), 41, octaves=4) * 14
    g = np.sin((yy + d) * 2 * np.pi / 26)
    grain = 0.5 + 0.5 * np.sign(g) * np.abs(g) ** 0.4
    saw = np.sin((xx * 0.98 + yy * 0.2 + fbm(H, W, (30, 80), 42) * 6) * 2 * np.pi / 34)
    mott = fbm(H, W, (50, 200), 43, octaves=4)
    fine = fbm(H, W, (1.5, 9), 44, octaves=2)
    tone = 1 - 0.16 * grain + 0.05 * saw + 0.1 * mott + 0.05 * fine
    img = base[None, None, :] * tone[..., None]
    # checks (cracks)
    r = rng(45)
    for _ in range(7):
        cx = r.uniform(0, W)
        cy = r.uniform(60, H - 60)
        L = r.uniform(150, 420)
        dx = (xx - cx + W / 2) % W - W / 2
        wob = fbm(H, W, (40, 100), 46 + _, octaves=2) * 3
        m = (np.abs(dx) < L / 2) & (np.abs(yy - cy - wob) < 1.6 * (1 - np.abs(dx) / (L / 2)) + 0.3)
        img[m] *= 0.3
    img = np.clip(img, 0, 1)
    Image.fromarray(to_u8(img)).save(f"{OUT}/timber.jpg", quality=92)
    h = 0.5 + 0.18 * saw + 0.12 * fine - 0.2 * grain
    Image.fromarray(to_u8(np.clip(h, 0, 1))).save(f"{OUT}/timber_h.png")


if __name__ == "__main__":
    oak_floor()
    pale_oak_floor()
    pine_ceiling()
    lodge_rug()
    timber()
    print("ok", os.listdir(OUT))
