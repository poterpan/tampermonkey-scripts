"""Background-invariant preprocessing shared by train / eval / (JS reference).
Turns any captcha (synthetic or real) into a 1-channel 'ink strength' map so the
model sees glyphs-on-neutral regardless of the per-image pastel background colour.
Must be reimplemented identically in JS for the userscript.
"""
import numpy as np

def to_input_np(rgb):
    """rgb: HxWx3 uint8  ->  1xHxW float32 ink map in [0,1]."""
    a = rgb.astype(np.float32)
    H, W, _ = a.shape
    border = np.concatenate([a[0, :, :], a[H-1, :, :], a[:, 0, :], a[:, W-1, :]], axis=0)
    bg = np.median(border, axis=0)                 # robust background estimate
    d = np.abs(a - bg).sum(axis=2)                 # L1 distance from bg, 0..765
    d = np.clip(d / 180.0, 0.0, 1.0)               # ink strength
    return d[None].astype(np.float32)

def batch_to_tensor(X):
    import torch
    arr = np.stack([to_input_np(x) for x in X])    # N x 1 x H x W
    return torch.from_numpy(arr)
