"""Export the APSWIS CharNet (cf1=32, 22 classes) as float16 + manifest.

Same layout as export_charnet.py so the userscript's existing JS forward pass
reads both models with the same loader; only the layer shapes differ.

Source checkpoint lives in NTUT_Tools (where the model was trained):
    NTUT_Tools/tools/apswis_captcha_training/apswis_fc32.pt
"""
import base64
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn

HERE = Path(__file__).resolve().parent
DEFAULT_CKPT = Path.home() / (
    "Documents/Coding/NTUT/NTUT_Tools/.claude/worktrees/apswis-captcha-doc/"
    "tools/apswis_captcha_training/apswis_fc32.pt")


class Net(nn.Module):
    def __init__(self, n_classes, fc):
        super().__init__()
        self.cc1 = nn.Conv2d(1, 16, 3, padding=1)
        self.cc2 = nn.Conv2d(16, 32, 3, padding=1)
        self.cc3 = nn.Conv2d(32, 48, 3, padding=1)
        self.cf1 = nn.Linear(48 * 5 * 5, fc)
        self.cf2 = nn.Linear(fc, n_classes)


def main(ckpt_path):
    ck = torch.load(ckpt_path, weights_only=True)
    classes = [str(c) for c in ck["classes"]]
    fc = int(ck["fc"])
    net = Net(len(classes), fc)
    net.load_state_dict(ck["state"])
    net.eval()

    sd = net.state_dict()
    manifest, blobs = [], []
    for name in ("cc1", "cc2", "cc3", "cf1", "cf2"):
        w = sd[f"{name}.weight"].numpy().astype("<f2")
        b = sd[f"{name}.bias"].numpy().astype("<f2")
        manifest.append({"name": name, "w_shape": list(w.shape), "b_shape": list(b.shape)})
        blobs.append(w.tobytes())
        blobs.append(b.tobytes())
    raw = b"".join(blobs)

    (HERE / "apswis_weights.b64").write_text(base64.b64encode(raw).decode(), encoding="ascii")
    (HERE / "apswis_manifest.json").write_text(
        json.dumps({"manifest": manifest, "chars": "".join(classes), "dtype": "float16"}),
        encoding="utf-8")
    print(f"exported {len(raw)/1024:.0f} KB float16, "
          f"base64 {len(base64.b64encode(raw))/1024:.0f} KB, "
          f"{len(classes)} classes ({''.join(classes)}), cf1={fc}")


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CKPT
    if not p.exists():
        raise SystemExit(f"找不到 checkpoint：{p}\n用法: python export_apswis.py [路徑]")
    main(p)
