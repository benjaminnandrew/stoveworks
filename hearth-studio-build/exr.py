"""EXR reading + the shared tone curve (mirrored exactly in the WebGL shader)."""
import numpy as np
import OpenEXR


def read_exr(path):
    with OpenEXR.File(path) as f:
        parts = f.parts
        ch = parts[0].channels
        keys = list(ch.keys())
        if "RGB" in ch:
            img = np.asarray(ch["RGB"].pixels, np.float32)
        elif "RGBA" in ch:
            img = np.asarray(ch["RGBA"].pixels, np.float32)[..., :3]
        else:
            r = [k for k in keys if k.endswith("R")][0]
            g = [k for k in keys if k.endswith("G")][0]
            b = [k for k in keys if k.endswith("B")][0]
            img = np.dstack([np.asarray(ch[k].pixels, np.float32) for k in (r, g, b)])
    return img


def aces(x):
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)


def oetf(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def tonemap(lin, exposure):
    return oetf(aces(lin * exposure))


def lum(img):
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722
