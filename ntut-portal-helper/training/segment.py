"""Colour-based glyph segmentation for NTUT captcha (umeow-inspired, hardened).
Each glyph is a distinct saturated colour; background is the commonest colour,
crossing lines are full-width or pale, star speckles are tiny.
Returns up to 4 glyphs as 40x40 binary maps, left-to-right. Must be mirrored in JS.
"""
import numpy as np
from collections import Counter

SZ = 40

def _lum(c): return (c[0] * 299 + c[1] * 587 + c[2] * 114 + 500) / 1000

def segment_masks(rgb):
    H, W, _ = rgb.shape
    flat = rgb.reshape(-1, 3)
    colors = Counter((int(p[0]), int(p[1]), int(p[2])) for p in flat)
    bg = colors.most_common(1)[0][0]
    xs = np.tile(np.arange(W), H).reshape(H, W)
    ys = np.repeat(np.arange(H), W).reshape(H, W)
    cand = []
    for col, n in colors.items():
        if col == bg or n < 18 or _lum(col) > 160:
            continue
        mask = (rgb[:, :, 0] == col[0]) & (rgb[:, :, 1] == col[1]) & (rgb[:, :, 2] == col[2])
        mx, my = xs[mask], ys[mask]
        if mx.max() - mx.min() > 55 or my.max() - my.min() < 8:   # skip full-width thin lines
            continue
        cand.append({"n": n, "xmin": int(mx.min()), "mask": mask})
    cand.sort(key=lambda c: -c["n"])
    cand = cand[:4]                     # 4 biggest remaining = glyphs
    cand.sort(key=lambda c: c["xmin"])  # left-to-right
    return cand

def norm40(mask):
    # center the glyph bbox in a 40x40 canvas; clip any overflow (no resize -> trivially portable to JS)
    ys, xs = np.where(mask)
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    gh, gw = crop.shape
    out = np.zeros((SZ, SZ), np.float32)
    oy, ox = (SZ - gh) // 2, (SZ - gw) // 2
    sy0, sx0 = max(0, -oy), max(0, -ox)
    dy0, dx0 = max(0, oy), max(0, ox)
    hh, ww = min(gh - sy0, SZ - dy0), min(gw - sx0, SZ - dx0)
    if hh > 0 and ww > 0:
        out[dy0:dy0 + hh, dx0:dx0 + ww] = crop[sy0:sy0 + hh, sx0:sx0 + ww]
    return out

def glyphs40(rgb):
    """-> (ok, [4x 40x40 float]). ok=True only if exactly 4 glyphs segmented."""
    cand = segment_masks(rgb)
    if len(cand) != 4:
        return False, None
    return True, [norm40(c["mask"]) for c in cand]
