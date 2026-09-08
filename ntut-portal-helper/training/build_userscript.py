"""Inject the two float16 models + OAuth2 templates into login_template.js -> final .user.js

The built .user.js is the artefact users install and the one the *.test.mjs files
read, so it must always be regenerated from login_template.js.  A hand-edit to the
built file is silently lost the next time this runs -- that is how 20260825.1's
classifyLoginResponse work went missing from the template until 2026-09-07.

Paths are resolved relative to this file, so it can be run from any directory and
always writes the artefact to ../ntut-portal-helper.user.js (it used to write into
training/ whenever it was run from there, leaving the real artefact untouched).
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "ntut-portal-helper.user.js"

tpl = (HERE / "login_template.js").read_text(encoding="utf-8")
b64 = (HERE / "char_weights.b64").read_text(encoding="utf-8").strip()
man = json.loads((HERE / "char_manifest.json").read_text(encoding="utf-8"))
dac = json.loads((HERE / "dac_templates.json").read_text(encoding="utf-8"))
ap_b64 = (HERE / "apswis_weights.b64").read_text(encoding="utf-8").strip()
ap_man = json.loads((HERE / "apswis_manifest.json").read_text(encoding="utf-8"))
if_b64 = (HERE / "ifirst_weights.b64").read_text(encoding="utf-8").strip()
if_man = json.loads((HERE / "ifirst_manifest.json").read_text(encoding="utf-8"))
version = "20260908.2"

# 帶前綴的佔位符先替換：它們與入口網那組沒有子字串衝突
# (__APSWIS_WEIGHTS_B64__ 裡 WEIGHTS 前只有一個底線)，先做只是保險。
out = (tpl
       .replace("__APSWIS_WEIGHTS_B64__", ap_b64)
       .replace("__APSWIS_MANIFEST__", json.dumps(ap_man["manifest"], separators=(",", ":")))
       .replace("__APSWIS_CHARS__", ap_man["chars"])
       .replace("__IFIRST_WEIGHTS_B64__", if_b64)
       .replace("__IFIRST_MANIFEST__", json.dumps(if_man["manifest"], separators=(",", ":")))
       .replace("__IFIRST_CHARS__", if_man["chars"])
       .replace("__WEIGHTS_B64__", b64)
       .replace("__MANIFEST__", json.dumps(man["manifest"], separators=(",", ":")))
       .replace("__CHARS__", man["chars"])
       .replace("__DAC_TEMPLATES__", json.dumps(dac, separators=(",", ":")))
       .replace("__VERSION__", version))

for placeholder in ("__WEIGHTS_B64__", "__MANIFEST__", "__CHARS__", "__DAC_TEMPLATES__",
                    "__APSWIS_WEIGHTS_B64__", "__APSWIS_MANIFEST__", "__APSWIS_CHARS__",
                    "__IFIRST_WEIGHTS_B64__", "__IFIRST_MANIFEST__", "__IFIRST_CHARS__",
                    "__VERSION__"):
    if placeholder in out:
        raise SystemExit(f"未替換的佔位符：{placeholder}")

OUT.write_text(out, encoding="utf-8")
print(f"built {OUT}  ({len(out)/1024:.0f} KB), version {version}")
print(f"  入口網 CharNet {len(man['chars'])} 類 ({len(b64)/1024:.0f} KB b64)")
print(f"  請購 CharNet {len(ap_man['chars'])} 類 ({len(ap_b64)/1024:.0f} KB b64)"
      f" cf1={ap_man['manifest'][3]['w_shape'][0]}")
print(f"  請購(ValidCode_2) {len(if_man['chars'])} 類 ({len(if_b64)/1024:.0f} KB b64)"
      f" cf1={if_man['manifest'][3]['w_shape'][0]} 輸入={if_man.get('size')}x{if_man.get('size')}")
print(f"  OAuth2 模板 {len(dac['templates'])} 個 ({dac['image_size'][1]}x{dac['image_size'][0]})")
