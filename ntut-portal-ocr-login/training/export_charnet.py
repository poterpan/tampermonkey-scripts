"""Export CharNet (per-char) weights float16 + GT predictions for JS verification."""
import numpy as np, json, base64, torch, torch.nn as nn
from PIL import Image
from segment import glyphs40
from gen_captcha import CHARS
from real_labels import LABELS

class CharNet(nn.Module):
    def __init__(s):
        super().__init__()
        s.f = nn.Sequential(nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                            nn.Conv2d(32, 48, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
        s.fc = nn.Sequential(nn.Linear(48 * 5 * 5, 64), nn.ReLU(), nn.Linear(64, 26))
    def forward(s, x): return s.fc(s.f(x).flatten(1))

net = CharNet(); net.load_state_dict(torch.load("charnet.pt", weights_only=True)); net.eval()
order = [("cc1", "f.0"), ("cc2", "f.3"), ("cc3", "f.6"), ("cf1", "fc.0"), ("cf2", "fc.2")]
sd = net.state_dict(); manifest, blobs = [], []
for jsn, p in order:
    w = sd[f"{p}.weight"].numpy().astype("<f2"); b = sd[f"{p}.bias"].numpy().astype("<f2")
    manifest.append({"name": jsn, "w_shape": list(w.shape), "b_shape": list(b.shape)})
    blobs.append(w.tobytes()); blobs.append(b.tobytes())
raw = b"".join(blobs)
open("char_weights.b64", "w").write(base64.b64encode(raw).decode())
json.dump({"manifest": manifest, "chars": CHARS, "dtype": "float16"}, open("char_manifest.json", "w"))
print(f"exported {len(raw)/1024:.0f} KB float16, base64 {len(base64.b64encode(raw))/1024:.0f} KB")

# GT predictions (Python) for JS to match
I2C = {i: c for i, c in enumerate(CHARS)}
preds = {}
for k, lab in LABELS.items():
    rgb = np.asarray(Image.open(f"caps2/{k}.png").convert("RGB"))
    ok, gs = glyphs40(rgb)
    if not ok: preds[k] = None; continue
    with torch.no_grad():
        x = torch.from_numpy(np.stack(gs)[:, None].astype(np.float32))
        p = net(x).argmax(1).numpy()
    preds[k] = "".join(I2C[c] for c in p)
json.dump(preds, open("char_preds.json", "w"))
full = np.mean([preds[k] == LABELS[k] for k in LABELS if preds[k]])
print(f"GT full-acc (python): {full*100:.1f}%  sample: {list(preds.items())[0]}")
