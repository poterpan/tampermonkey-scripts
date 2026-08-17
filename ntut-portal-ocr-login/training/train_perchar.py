"""Per-character CNN on colour-segmented glyphs (40x40 binary) -> 26 classes.
Trained on ddddocr auto-labels; honest eval on hand-labeled GT (caps2)."""
import numpy as np, json, glob, random, sys, os
import torch, torch.nn as nn
from PIL import Image
from segment import glyphs40, SZ
from gen_captcha import CHARS
from real_labels import LABELS

torch.manual_seed(0); np.random.seed(0); random.seed(0)
C2I = {c: i for i, c in enumerate(CHARS)}; I2C = {i: c for i, c in enumerate(CHARS)}

# ---- auto-labels (reuse cache from train_real) ----
auto = json.load(open("auto_labels_big.json"))
print("source images:", len(auto))

# ---- build per-char dataset (segment; keep exactly-4) ----
def build():
    X, Y = [], []; ok = 0; bad = 0
    for f, lab in auto.items():
        rgb = np.asarray(Image.open(f).convert("RGB"))
        good, gs = glyphs40(rgb)
        if not good: bad += 1; continue
        ok += 1
        for i in range(4): X.append(gs[i]); Y.append(C2I[lab[i]])
    print(f"segmented ok={ok} (skipped {bad});  {len(X)} char samples")
    return np.stack(X)[:, None].astype(np.float32), np.array(Y, np.int64)
Xtr, Ytr = build()

class CharNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.f = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),   # 20
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 10
            nn.Conv2d(32, 48, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 5
        )
        self.fc = nn.Sequential(nn.Linear(48 * 5 * 5, 64), nn.ReLU(), nn.Linear(64, 26))
    def forward(self, x): return self.fc(self.f(x).flatten(1))

def aug(x):  # x: 40x40 float; light rotation+shift
    from PIL import Image as I
    im = I.fromarray((x * 255).astype("uint8"))
    im = im.rotate(random.uniform(-10, 10), resample=I.BILINEAR, fillcolor=0)
    dx, dy = random.randint(-2, 2), random.randint(-2, 2)
    im = im.transform(im.size, I.AFFINE, (1, 0, dx, 0, 1, dy), fillcolor=0)
    return (np.asarray(im).astype(np.float32) / 255.0)[None]

# ---- GT eval: segment each GT image, classify 4 glyphs, compare full string ----
gt = []
for k, lab in LABELS.items():
    rgb = np.asarray(Image.open(f"caps2/{k}.png").convert("RGB"))
    good, gs = glyphs40(rgb)
    gt.append((good, gs, lab))
segfail = sum(1 for g, _, _ in gt if not g)

def evaluate(net):
    net.eval(); ch = 0; chn = 0; full = 0
    with torch.no_grad():
        for good, gs, lab in gt:
            if not good:  # segmentation failed -> counts as miss (would retry at runtime)
                chn += 4; continue
            x = torch.from_numpy(np.stack(gs)[:, None].astype(np.float32))
            p = net(x).argmax(1).numpy()
            pred = "".join(I2C[c] for c in p)
            ch += sum(a == b for a, b in zip(pred, lab)); chn += 4
            full += (pred == lab)
    return ch / chn, full / len(gt)

net = CharNet()
nparam = sum(p.numel() for p in net.parameters())
print(f"CharNet params: {nparam:,}  ({nparam*2/1e3:.0f} KB float16); GT segmentation failures: {segfail}/{len(gt)}")
opt = torch.optim.Adam(net.parameters(), 1e-3)
sched = torch.optim.lr_scheduler.StepLR(opt, 40, 0.5)
lossf = nn.CrossEntropyLoss()
EP = int(sys.argv[1]) if len(sys.argv) > 1 else 60
BS = 128; best = 0
N = len(Xtr)
for ep in range(EP):
    net.train(); perm = np.random.permutation(N)
    for i in range(0, N, BS):
        idx = perm[i:i + BS]
        xb = torch.from_numpy(np.stack([aug(Xtr[j, 0]) for j in idx]))
        yb = torch.from_numpy(Ytr[idx])
        loss = lossf(net(xb), yb); opt.zero_grad(); loss.backward(); opt.step()
    sched.step()
    if (ep + 1) % 5 == 0 or ep == EP - 1:
        c, fu = evaluate(net)
        star = ""
        if fu >= best: best = fu; torch.save(net.state_dict(), "charnet.pt"); star = " *"
        print(f"  ep{ep+1:3d}  GT char={c*100:.1f}% full={fu*100:.1f}%{star}")
print(f"BEST full-acc: {best*100:.1f}%  -> charnet.pt")
