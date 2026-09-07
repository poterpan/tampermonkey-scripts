"""Inject float16 weights + OAuth2 CAPTCHA templates into the login template -> final .user.js

The built .user.js is the artefact users install and the one login-response.test.mjs
reads, so it must always be regenerated from login_template.js.  A hand-edit to the
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
version = "20260907.1"

out = (tpl
       .replace("__WEIGHTS_B64__", b64)
       .replace("__MANIFEST__", json.dumps(man["manifest"], separators=(",", ":")))
       .replace("__CHARS__", man["chars"])
       .replace("__DAC_TEMPLATES__", json.dumps(dac, separators=(",", ":")))
       .replace("__VERSION__", version))

for placeholder in ("__WEIGHTS_B64__", "__MANIFEST__", "__CHARS__", "__DAC_TEMPLATES__", "__VERSION__"):
    if placeholder in out:
        raise SystemExit(f"未替換的佔位符：{placeholder}")

OUT.write_text(out, encoding="utf-8")
print(f"built {OUT}  ({len(out)/1024:.0f} KB), version {version}, dtype {man.get('dtype')}")
print(f"  CharNet {len(man['chars'])} 類；OAuth2 模板 {len(dac['templates'])} 個"
      f" ({dac['image_size'][1]}x{dac['image_size'][0]})")
