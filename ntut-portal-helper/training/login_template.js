// ==UserScript==
// @name         北科入口網站小幫手
// @namespace    https://github.com/poterpan/tampermonkey-scripts/ntut-portal-helper
// @version      __VERSION__
// @description  臺北科大校園入口網站小幫手：①驗證碼自動辨識登入（進入新版 cloudPortal）②防閒置自動登出（可選）。純本地推論、不呼叫任何外部 API；辨識失敗自動刷新重試，多次失敗回退手動。
// @author       PoterPan
// @match        https://nportal.ntut.edu.tw/*
// @icon         https://www.ntut.edu.tw/var/file/7/1007/msys_1007_5994215_49612.png
// @run-at       document-idle
// @grant        unsafeWindow
// @homepageURL  https://github.com/poterpan/tampermonkey-scripts
// @supportURL   https://github.com/poterpan/tampermonkey-scripts/issues
// @updateURL    https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/ntut-portal-helper/ntut-portal-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/ntut-portal-helper/ntut-portal-helper.user.js
// @license      MIT
// ==/UserScript==
(function () {
  "use strict";
  var KEEP_KEY = "ntutHelper_keepAlive"; // 「保持登入」設定（localStorage，同源跨頁共用）

  // ============ 功能二：保持登入（登入後的內頁執行） ============
  // cloudPortal/EIP 的登出由前端閒置倒數觸發（InitTime=30*60 秒，updateTime 每秒遞減，
  // 以 sessionActTime 計算閒置）。resetTime() 會把閒置歸零並關掉警告框；定時呼叫即可不因閒置登出。
  function startKeepAlive() {
    function ka() {
      try { if (typeof unsafeWindow.resetTime === "function") { unsafeWindow.resetTime(); return; } } catch (e) {}
      try {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Shift" }));
      } catch (e) {}
    }
    ka();
    setInterval(ka, 60 * 1000);
    console.log("[NTUT小幫手] 保持登入已啟用（防閒置自動登出）");
  }

  if (location.pathname !== "/index.do") {
    try { if (localStorage.getItem(KEEP_KEY) === "1") startKeepAlive(); } catch (e) {}
    return; // 內頁只跑保持登入，不載入辨識模型
  }

  // ============ 功能一：驗證碼自動辨識登入（登入頁執行） ============
  const MODEL = { b64: "__WEIGHTS_B64__", manifest: __MANIFEST__, chars: "__CHARS__" };
  const W = 135, H = 39, SZ = 40, MAX_TRIES = 6;

  // ---- 權重（float16）----
  function halfToFloat(h) {
    const s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
    if (e === 0x1f) return f ? NaN : (s ? -1 : 1) * Infinity;
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  function loadWeights() {
    const bin = atob(MODEL.b64), n = bin.length, bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    const dv = new DataView(bytes.buffer), f32 = new Float32Array(n / 2);
    for (let i = 0; i < f32.length; i++) f32[i] = halfToFloat(dv.getUint16(i * 2, true));
    const L = {}; let off = 0;
    for (const m of MODEL.manifest) {
      const wn = m.w_shape.reduce((a, b) => a * b, 1), bn = m.b_shape.reduce((a, b) => a * b, 1);
      L[m.name] = { w: f32.subarray(off, off + wn), ws: m.w_shape, b: f32.subarray(off + wn, off + wn + bn) };
      off += wn + bn;
    }
    return L;
  }
  const L = loadWeights();

  // ---- 顏色分割（對齊 segment.py）----
  function segmentGlyphs(getPixel) {
    const stat = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = getPixel(y, x), k = p[0] * 65536 + p[1] * 256 + p[2];
      let s = stat.get(k);
      if (!s) { s = { r: p[0], g: p[1], b: p[2], n: 0, xmin: x, xmax: x, ymin: y, ymax: y }; stat.set(k, s); }
      s.n++; if (x < s.xmin) s.xmin = x; if (x > s.xmax) s.xmax = x; if (y < s.ymin) s.ymin = y; if (y > s.ymax) s.ymax = y;
    }
    let bg = null, bgn = -1;
    for (const s of stat.values()) if (s.n > bgn) { bgn = s.n; bg = s; }
    const lum = (s) => (s.r * 299 + s.g * 587 + s.b * 114 + 500) / 1000;
    const cand = [];
    for (const s of stat.values()) {
      if (s === bg || s.n < 18 || lum(s) > 160) continue;
      if (s.xmax - s.xmin > 55 || s.ymax - s.ymin < 8) continue;
      cand.push(s);
    }
    cand.sort((a, b) => b.n - a.n);
    const g4 = cand.slice(0, 4);
    if (g4.length !== 4) return null;
    g4.sort((a, b) => a.xmin - b.xmin);
    return g4.map((s) => norm40(getPixel, s));
  }
  function norm40(getPixel, s) {
    const gh = s.ymax - s.ymin + 1, gw = s.xmax - s.xmin + 1, out = new Float32Array(SZ * SZ);
    const oy = Math.floor((SZ - gh) / 2), ox = Math.floor((SZ - gw) / 2);
    for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
      const p = getPixel(s.ymin + yy, s.xmin + xx);
      if (p[0] === s.r && p[1] === s.g && p[2] === s.b) {
        const dy = oy + yy, dx = ox + xx;
        if (dy >= 0 && dy < SZ && dx >= 0 && dx < SZ) out[dy * SZ + dx] = 1;
      }
    }
    return out;
  }

  // ---- CharNet 前向 ----
  function conv3(inp, w, ws, b) {
    const [OC, IC] = ws, { d, H: h, W: wd } = inp, out = new Float32Array(OC * h * wd);
    for (let oc = 0; oc < OC; oc++) {
      const wb = oc * IC * 9, bias = b[oc];
      for (let y = 0; y < h; y++) for (let x = 0; x < wd; x++) {
        let s = bias;
        for (let ic = 0; ic < IC; ic++) {
          const ib = ic * h * wd, wcb = wb + ic * 9;
          for (let ky = 0; ky < 3; ky++) { const iy = y + ky - 1; if (iy < 0 || iy >= h) continue; const ir = ib + iy * wd, wr = wcb + ky * 3;
            for (let kx = 0; kx < 3; kx++) { const ix = x + kx - 1; if (ix < 0 || ix >= wd) continue; s += d[ir + ix] * w[wr + kx]; } }
        }
        out[oc * h * wd + y * wd + x] = s > 0 ? s : 0;
      }
    }
    return { d: out, C: OC, H: h, W: wd };
  }
  function pool2(inp) {
    const { d, C, H: h, W: wd } = inp, OH = ((h - 2) >> 1) + 1, OW = ((wd - 2) >> 1) + 1, out = new Float32Array(C * OH * OW);
    for (let c = 0; c < C; c++) { const ib = c * h * wd, ob = c * OH * OW;
      for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) { const iy = y * 2, ix = x * 2; let m = -Infinity;
        for (let a = 0; a < 2; a++) for (let bx = 0; bx < 2; bx++) { const v = d[ib + (iy + a) * wd + (ix + bx)]; if (v > m) m = v; }
        out[ob + y * OW + x] = m; } }
    return { d: out, C, H: OH, W: OW };
  }
  function linear(x, w, ws, b, relu) {
    const [OUT, IN] = ws, out = new Float32Array(OUT);
    for (let o = 0; o < OUT; o++) { let s = b[o], wb = o * IN; for (let i = 0; i < IN; i++) s += x[i] * w[wb + i]; out[o] = relu && s < 0 ? 0 : s; }
    return out;
  }
  function charForward(g) {
    let t = { d: g, C: 1, H: SZ, W: SZ };
    t = pool2(conv3(t, L.cc1.w, L.cc1.ws, L.cc1.b));
    t = pool2(conv3(t, L.cc2.w, L.cc2.ws, L.cc2.b));
    t = pool2(conv3(t, L.cc3.w, L.cc3.ws, L.cc3.b));
    const h = linear(t.d, L.cf1.w, L.cf1.ws, L.cf1.b, true);
    const o = linear(h, L.cf2.w, L.cf2.ws, L.cf2.b, false);
    let bi = 0; for (let i = 1; i < o.length; i++) if (o[i] > o[bi]) bi = i;
    return MODEL.chars[bi];
  }

  async function solveCaptcha() {
    const r = await fetch("/authImage.do?t=" + Date.now() + "_" + Math.random(), { cache: "no-store", credentials: "include" });
    const bmp = await createImageBitmap(await r.blob());
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"); ctx.drawImage(bmp, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const getPixel = (y, x) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
    const gs = segmentGlyphs(getPixel);
    if (!gs) return null;
    return gs.map((g) => charForward(g)).join("");
  }

  // ---- 驗證碼區塊 -> 狀態卡（含保持登入開關）----
  let statusText = null, statusCard = null, captchaRow = null, captchaLabel = null;
  function setStatus(text, kind) {
    if (!statusText) return;
    statusText.textContent = text;
    const c = kind === "work" ? "#0a58ca" : kind === "warn" ? "#b8860b" : kind === "err" ? "#c0392b" : "#2a6";
    statusText.style.color = c; if (statusCard) statusCard.style.borderColor = c;
  }
  function setupUI() {
    const authInput = document.querySelector("#authcode");
    if (!authInput) { setTimeout(setupUI, 150); return; }
    captchaRow = authInput.closest(".mb-3") || authInput.parentElement;
    const prev = captchaRow && captchaRow.previousElementSibling;
    captchaLabel = prev && prev.tagName === "LABEL" ? prev : null;
    if (captchaRow) captchaRow.style.display = "none";
    if (captchaLabel) captchaLabel.style.display = "none";
    statusCard = document.createElement("div");
    statusCard.className = "mb-3";
    statusCard.style.cssText = "border:1px solid #2a6;border-radius:8px;padding:9px 12px;background:#f4fbf7";
    statusCard.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:20px">🤖</span>' +
        '<div style="line-height:1.35"><div style="font-weight:700;color:#2a6;font-size:13px">驗證碼自動辨識</div>' +
        '<div id="__ocrStatus" style="font-size:12px;color:#2a6">已啟用 · 直接按登入即可</div></div>' +
      '</div>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #d6ecdf;font-size:12px;color:#555;cursor:pointer">' +
        '<input type="checkbox" id="__keepAlive" style="margin:0;cursor:pointer"> 保持登入（防閒置 30 分鐘自動登出）' +
      '</label>';
    if (captchaRow && captchaRow.parentNode) captchaRow.parentNode.insertBefore(statusCard, captchaRow);
    statusText = statusCard.querySelector("#__ocrStatus");
    const kaBox = statusCard.querySelector("#__keepAlive");
    try { kaBox.checked = localStorage.getItem(KEEP_KEY) === "1"; } catch (e) {}
    kaBox.addEventListener("change", function () {
      try { localStorage.setItem(KEEP_KEY, kaBox.checked ? "1" : "0"); } catch (e) {}
    });
  }
  function revealCaptcha() {
    if (captchaLabel) captchaLabel.style.display = "";
    if (captchaRow) captchaRow.style.display = "";
    if (statusCard) statusCard.style.display = "none";
  }
  const say = (t) => setStatus(t, "work");

  // ---- 登入流程 ----
  let autoMode = true;
  function getField(id) { const el = document.getElementById(id) || document.querySelector('[name="' + id + '"]'); return el ? el.value : ""; }

  async function ocrLogin() {
    const uw = unsafeWindow;
    const muid = getField("muid"), pwd = getField("mpassword");
    if (!muid || !pwd) { alert("請輸入帳號密碼"); return; }
    let enc;
    try { enc = "{ENCODE}" + uw.dojox.encoding.crypto.Blowfish.encrypt(pwd, muid.toLowerCase()); }
    catch (e) { alert("無法載入加密模組，請重新整理頁面再試"); return; }
    const token = getField("token"), md5Code = getField("md5Code") || "1111", ssoId = getField("ssoId") || "";

    for (let tryN = 1; tryN <= MAX_TRIES; tryN++) {
      say("驗證碼自動辨識中… (" + tryN + "/" + MAX_TRIES + ")");
      let code;
      try { code = await solveCaptcha(); } catch (e) { continue; }
      if (!code) continue;
      const body = new URLSearchParams({ muid, mpassword: enc, authcode: code, token, md5Code, ssoId });
      let text = "";
      try {
        const resp = await fetch("/login.do", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, credentials: "include" });
        text = await resp.text();
        if ((resp.redirected && !/index\.do/.test(resp.url)) || (!/authImage|authcode/.test(text) && !/驗證碼|密碼|帳號|鎖/.test(text))) {
          setStatus("登入成功，載入新版入口…", "ok"); location.href = "https://nportal.ntut.edu.tw/cloudPortal.do"; return;
        }
      } catch (e) { say("連線問題，重試中…"); continue; }
      if (/密碼錯誤|帳號或密碼/.test(text)) { setStatus("帳號或密碼錯誤", "err"); alert("帳號或密碼錯誤，請重新輸入"); return; }
      if (/已被鎖住|鎖/.test(text)) { setStatus("帳號已被鎖住", "err"); alert("帳號已被鎖住"); return; }
      if (/密碼已過期/.test(text)) { setStatus("密碼已過期", "err"); alert("密碼已過期，請用網頁端重設"); return; }
    }
    autoMode = false;
    revealCaptcha();
    try { unsafeWindow.changeAuthImage && unsafeWindow.changeAuthImage(); } catch (e) {}
    alert("自動辨識驗證碼多次失敗，已切換手動：請輸入畫面上的驗證碼後再按一次登入。");
  }

  // ---- 掛住登入按鈕 ----
  let nativeLogin1 = null, hooked = false;
  function hook() {
    const uw = unsafeWindow;
    if (typeof uw.login1 === "function" && !hooked) {
      nativeLogin1 = uw.login1;
      uw.login1 = function () { if (autoMode) { ocrLogin(); } else { return nativeLogin1.apply(this, arguments); } };
      hooked = true; return;
    }
    if (!hooked) setTimeout(hook, 150);
  }
  setupUI();
  hook();
})();
