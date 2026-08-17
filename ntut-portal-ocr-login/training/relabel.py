"""Re-run ddddocr auto-labeling over the full caps_big + caps3 set."""
import ddddocr, re, glob, json
ocr = ddddocr.DdddOcr(show_ad=False)
try: ocr.set_ranges("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
except Exception: pass
files = sorted(glob.glob("caps_big/*.png")) + sorted(glob.glob("caps3/*.png"))
labels = {}
for i, f in enumerate(files):
    raw = open(f, "rb").read()
    try:
        r = ocr.classification(raw, probability=True)
        s = "".join(r["charsets"][max(range(len(p)), key=lambda j: p[j])] for p in r["probability"])
    except Exception:
        s = ocr.classification(raw)
    s = re.sub(r"[^A-Za-z]", "", s).upper()
    if len(s) == 4:
        labels[f] = s
    if (i + 1) % 1000 == 0:
        print(f"  labeled {i+1}/{len(files)}", flush=True)
json.dump(labels, open("auto_labels_big.json", "w"))
print(f"DONE: {len(labels)}/{len(files)} clean 4-char labels")
