"""Export the ValidCode_2 digit model (10 classes, 16x16 input) as float16 + manifest.

Same blob layout as export_charnet.py / export_apswis.py so the userscript's
single JS loader reads all three models; only shapes and class count differ.

Source checkpoint is produced by the training pipeline in NTUT_Tools.
"""
import base64
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn

HERE = Path(__file__).resolve().parent
DEFAULT_CKPT = Path("/private/tmp/claude-503/-Users-poterpan-Documents-Coding-NTUT-NTUT-Tools/"
                    "e6c1e6ba-bf59-4b9b-a506-ff5da814cca6/scratchpad/v2_fc32.pt")


class Net(nn.Module):
    def __init__(self, n_classes, fc):
        super().__init__()
        self.cc1 = nn.Conv2d(1, 16, 3, padding=1)
        self.cc2 = nn.Conv2d(16, 32, 3, padding=1)
        self.cc3 = nn.Conv2d(32, 48, 3, padding=1)
        self.cf1 = nn.Linear(48 * 2 * 2, fc)
        self.cf2 = nn.Linear(fc, n_classes)


def main(ckpt_path):
    ck = torch.load(ckpt_path, weights_only=True)
    classes = [str(c) for c in ck["classes"]]
    fc, sz = int(ck["fc"]), int(ck.get("sz", 16))
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

    (HERE / "ifirst_weights.b64").write_text(base64.b64encode(raw).decode(), encoding="ascii")
    (HERE / "ifirst_manifest.json").write_text(
        json.dumps({"manifest": manifest, "chars": "".join(classes),
                    "dtype": "float16", "size": sz}),
        encoding="utf-8")
    print(f"exported {len(raw)/1024:.0f} KB float16, "
          f"base64 {len(base64.b64encode(raw))/1024:.0f} KB, "
          f"{len(classes)} classes ({''.join(classes)}), cf1={fc}, input={sz}x{sz}")


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CKPT
    if not p.exists():
        raise SystemExit(f"找不到 checkpoint：{p}\n用法: python export_ifirst.py [路徑]")
    main(p)
