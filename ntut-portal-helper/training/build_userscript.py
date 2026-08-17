"""Inject float16 weights into the login template -> final .user.js"""
import json
tpl = open("login_template.js", encoding="utf-8").read()
b64 = open("char_weights.b64").read().strip()
man = json.load(open("char_manifest.json"))
version = "20260817.5"
out = (tpl
       .replace("__WEIGHTS_B64__", b64)
       .replace("__MANIFEST__", json.dumps(man["manifest"], separators=(",", ":")))
       .replace("__CHARS__", man["chars"])
       .replace("__VERSION__", version))
open("ntut-portal-helper.user.js", "w", encoding="utf-8").write(out)
print(f"built ntut-portal-helper.user.js  ({len(out)/1024:.0f} KB), version {version}, dtype {man.get('dtype')}")
