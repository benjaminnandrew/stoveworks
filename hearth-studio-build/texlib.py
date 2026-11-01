"""Shared helpers for procedural, seamlessly tiling textures (numpy)."""
import numpy as np
from scipy import ndimage


def rng(seed):
    return np.random.default_rng(seed)


def pnoise(h, w, cell, seed, order=3):
    """Periodic smooth value noise. `cell` = feature size in px (y, x) or scalar.
    Tiles seamlessly across the (h, w) canvas."""
    if np.isscalar(cell):
        cy = cx = cell
    else:
        cy, cx = cell
    gy = max(2, int(round(h / cy)))
    gx = max(2, int(round(w / cx)))
    r = rng(seed)
    g = r.standard_normal((gy, gx)).astype(np.float32)
    out = ndimage.zoom(g, (h / gy, w / gx), order=order, mode="grid-wrap", grid_mode=True)
    out = out[:h, :w]
    if out.shape != (h, w):
        out = np.pad(out, ((0, h - out.shape[0]), (0, w - out.shape[1])), mode="wrap")
    s = out.std()
    return out / (s if s > 0 else 1)


def fbm(h, w, cell, seed, octaves=5, gain=0.5, lac=2.0):
    total = np.zeros((h, w), np.float32)
    amp = 1.0
    norm = 0.0
    c = np.array(cell if not np.isscalar(cell) else (cell, cell), float)
    for o in range(octaves):
        if min(c) < 1.5:
            break
        total += amp * pnoise(h, w, tuple(c), seed + 101 * o)
        norm += amp * amp
        amp *= gain
        c = c / lac
    return total / np.sqrt(norm)


def ridged(h, w, cell, seed, octaves=4):
    total = np.zeros((h, w), np.float32)
    amp = 1.0
    c = np.array(cell if not np.isscalar(cell) else (cell, cell), float)
    for o in range(octaves):
        if min(c) < 1.5:
            break
        n = pnoise(h, w, tuple(c), seed + 37 * o)
        total += amp * (1.0 - np.abs(n) / 1.5)
        amp *= 0.5
        c = c / 2
    return total


def wrap_blur(img, sigma):
    return ndimage.gaussian_filter(img, sigma, mode="wrap")


def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, np.float32), 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def hex2rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def to_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
