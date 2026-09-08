// ==UserScript==
// @name         北科入口網站小幫手
// @namespace    https://github.com/poterpan/tampermonkey-scripts/ntut-portal-helper
// @version      __VERSION__
// @description  臺北科大校園入口網站小幫手：①驗證碼自動辨識登入（進入新版 cloudPortal）②防閒置自動登出（可選）③OAuth2 授權登入頁自動填驗證碼④網路請購系統自動填驗證碼（③④只填不送，帳密與送出留給使用者）。純本地推論、不呼叫任何外部 API；辨識失敗自動刷新重試，多次失敗回退手動。
// @author       PoterPan
// @match        https://nportal.ntut.edu.tw/*
// @match        https://account.ao.ntut.edu.tw/*
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

  // ============ 功能三：OAuth2 授權登入頁自動填驗證碼 ============
  // 第三方 client 導到 oauth2Server.do 時出現的登入頁，用的是 dacAuthImage.do，
  // 與 index.do 的 authImage.do 不同：4 碼純大寫 A-Z、無扭曲無雜訊，而且每個字形
  // 每次渲染的 bitmap 完全一致，所以不必動用 CharNet，逐位元查表即可。
  // 這裡只把驗證碼填進欄位，帳密與送出都留給使用者。
  const DAC = __DAC_TEMPLATES__;

  function dacBuildMap() {
    const map = new Map();
    for (const t of DAC.templates) {
      const gh = t.shape[0], gw = t.shape[1], bin = atob(t.bits);
      let bits = "";
      for (let i = 0; i < bin.length; i++) bits += bin.charCodeAt(i).toString(2).padStart(8, "0");
      map.set(gh + "x" + gw + ":" + bits.slice(0, gh * gw), t.char);
    }
    return map;
  }

  // 取像素的方式抽成 callback，測試時可直接餵陣列。
  function dacGlyphKeys(getPixel, w, h) {
    const stat = new Map();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = getPixel(y, x), k = p[0] * 65536 + p[1] * 256 + p[2];
      stat.set(k, (stat.get(k) || 0) + 1);
    }
    // 背景色由網址的 r/g/b 決定，只能取眾數；寫死灰階門檻會在登入頁的藍底
    // （亮度 144 > 128）把整張圖反過來。
    let bg = -1, bgn = -1;
    for (const kv of stat) if (kv[1] > bgn) { bgn = kv[1]; bg = kv[0]; }
    const ink = (y, x) => { const p = getPixel(y, x); return p[0] * 65536 + p[1] * 256 + p[2] !== bg; };

    const runs = []; let start = null;
    for (let x = 0; x < w; x++) {
      let filled = false;
      for (let y = 0; y < h; y++) if (ink(y, x)) { filled = true; break; }
      if (filled && start === null) start = x;
      if (!filled && start !== null) { runs.push([start, x - 1]); start = null; }
    }
    if (start !== null) runs.push([start, w - 1]);

    return runs.map(function (r) {          // 不設最小寬度：I 只有 1px 寬
      const l = r[0], rt = r[1];
      let top = -1, bot = -1;
      for (let y = 0; y < h; y++) {
        let any = false;
        for (let x = l; x <= rt; x++) if (ink(y, x)) { any = true; break; }
        if (any) { if (top < 0) top = y; bot = y; }
      }
      let bits = "";
      for (let y = top; y <= bot; y++) for (let x = l; x <= rt; x++) bits += ink(y, x) ? "1" : "0";
      return (bot - top + 1) + "x" + (rt - l + 1) + ":" + bits;
    });
  }

  function dacRecognizeImage(img, map) {
    const h = DAC.image_size[0], w = DAC.image_size[1];
    if (img.naturalWidth !== w || img.naturalHeight !== h) {
      throw new Error("驗證碼尺寸 " + img.naturalWidth + "x" + img.naturalHeight + " 與模板不符");
    }
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    const keys = dacGlyphKeys((y, x) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; }, w, h);
    if (keys.length !== 4) throw new Error("切出 " + keys.length + " 個字元");
    return keys.map(function (k) {
      const c = map.get(k);
      if (!c) throw new Error("字形不在模板表中，驗證碼樣式可能已改版");
      return c;
    }).join("");
  }

  function dacAwaitImage(img) {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", () => reject(new Error("驗證碼圖片載入失敗")), { once: true });
    });
  }

  async function startOAuth2Fill() {
    const input = document.querySelector("#code") || document.querySelector('[name="authcode"]');
    const img = document.querySelector("#authImage");
    if (!input || !img) return;

    const badge = document.createElement("div");
    badge.style.cssText = "margin:6px 0;font:12px/1.6 system-ui,sans-serif;color:#0a58ca";
    input.insertAdjacentElement("afterend", badge);
    const map = dacBuildMap();

    async function run() {
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          await dacAwaitImage(img);
          // 直接讀已顯示的那張圖，不另外 fetch——每次請求 dacAuthImage.do 都會換一組
          // 答案，另外抓會讓畫面上的圖和有效答案對不起來。
          input.value = dacRecognizeImage(img, map);
          badge.style.color = "#2a6";
          badge.textContent = "已自動填入驗證碼（請自行確認後按登入）";
          return;
        } catch (e) {
          if (attempt === 6) {
            badge.style.color = "#c0392b";
            badge.textContent = "驗證碼自動辨識失敗，請手動輸入（" + e.message + "）";
            return;
          }
          badge.textContent = "辨識失敗，換一張重試…（" + attempt + "/6）";
          try { unsafeWindow.reloadRedo(); } catch (e2) {
            img.src = "dacAuthImage.do?r=86&g=153&b=247&w=100&h=35&fontSize=25&t=" + Date.now();
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    // 使用者按頁面上的「重整」時重新辨識
    const redo = document.querySelector('a[href*="reloadRedo"]');
    if (redo) redo.addEventListener("click", () => setTimeout(run, 250));
    run();
  }

  // ============ 功能四：網路請購系統登入頁自動填驗證碼 ============
  // 主計室請購系統 (account.ao.ntut.edu.tw) 的驗證碼與入口網完全不同：
  // 124x24 只有兩色、5 碼、折線字體、字集 22 類 (無 0AEFGOQSTUVWYZ)、單像素鹽粒雜訊。
  // 分割靠連通元件而非顏色；模型與功能一同架構 (3conv+2fc, 40x40)，cf1 減為 32、輸出 22 類。
  // 只填驗證碼，帳密與送出留給使用者——請購送單不可逆。
  const APSWIS = { b64: "__APSWIS_WEIGHTS_B64__", manifest: __APSWIS_MANIFEST__, chars: "__APSWIS_CHARS__" };
  const AP_SZ = 40, AP_MIN_PX = 20, AP_TRIES = 6;

  // 切字：去雜訊 + 8-連通元件。元件大小的空隙是 6..53 px，門檻取 20 落在中央。
  function apswisGlyphs(getPixel, w, h) {
    const stat = new Map();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = getPixel(y, x), k = p[0] * 65536 + p[1] * 256 + p[2];
      stat.set(k, (stat.get(k) || 0) + 1);
    }
    let bg = -1, bgn = -1;                       // 背景取眾數，不寫死顏色
    for (const kv of stat) if (kv[1] > bgn) { bgn = kv[1]; bg = kv[0]; }

    const ink = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = getPixel(y, x);
      ink[y * w + x] = (p[0] * 65536 + p[1] * 256 + p[2]) !== bg ? 1 : 0;
    }

    const lab = new Int32Array(w * h), boxes = [];
    let cur = 0;
    for (let i = 0; i < w * h; i++) {
      if (!ink[i] || lab[i]) continue;
      cur++;
      const stack = [i], px = [];
      lab[i] = cur;
      while (stack.length) {
        const c = stack.pop();
        px.push(c);
        const cy = (c / w) | 0, cx = c % w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const ny = cy + dy, nx = cx + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          const ni = ny * w + nx;
          if (ink[ni] && !lab[ni]) { lab[ni] = cur; stack.push(ni); }
        }
      }
      if (px.length < AP_MIN_PX) continue;       // 鹽粒雜訊
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (const c of px) {
        const cy = (c / w) | 0, cx = c % w;
        if (cx < x0) x0 = cx;
        if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy;
        if (cy > y1) y1 = cy;
      }
      boxes.push({ px: px, x0: x0, x1: x1, y0: y0, y1: y1 });
    }
    // 少於 5 塊 = 有字相黏（約 10%）。不做切割，交給呼叫端換一張——重抓是免費的。
    if (boxes.length !== 5) return null;
    boxes.sort((a, b) => a.x0 - b.x0);

    return boxes.map(function (bx) {
      const gh = bx.y1 - bx.y0 + 1, gw = bx.x1 - bx.x0 + 1;
      const out = new Float32Array(AP_SZ * AP_SZ);
      const oy = Math.floor((AP_SZ - gh) / 2), ox = Math.floor((AP_SZ - gw) / 2);
      for (const c of bx.px) {
        const cy = ((c / w) | 0) - bx.y0 + oy, cx = (c % w) - bx.x0 + ox;
        if (cy >= 0 && cy < AP_SZ && cx >= 0 && cx < AP_SZ) out[cy * AP_SZ + cx] = 1;
      }
      return out;
    });
  }

  function apswisForward(g, AL) {
    let t = { d: g, C: 1, H: AP_SZ, W: AP_SZ };
    t = pool2(conv3(t, AL.cc1.w, AL.cc1.ws, AL.cc1.b));
    t = pool2(conv3(t, AL.cc2.w, AL.cc2.ws, AL.cc2.b));
    t = pool2(conv3(t, AL.cc3.w, AL.cc3.ws, AL.cc3.b));
    const hid = linear(t.d, AL.cf1.w, AL.cf1.ws, AL.cf1.b, true);
    const o = linear(hid, AL.cf2.w, AL.cf2.ws, AL.cf2.b, false);
    let bi = 0;
    for (let i = 1; i < o.length; i++) if (o[i] > o[bi]) bi = i;
    return APSWIS.chars[bi];
  }

  function apswisAwaitImage(img) {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", () => reject(new Error("驗證碼圖片載入失敗")), { once: true });
    });
  }

  async function startApswisFill() {
    const input = document.querySelector("#CheckCode") || document.querySelector('[name="CheckCode"]');
    const img = document.querySelector('img[src*="ValidCode"]');   // 該圖沒有 id
    if (!input || !img) return;

    const badge = document.createElement("div");
    badge.style.cssText = "margin:6px 0;font:12px/1.6 system-ui,sans-serif;color:#0a58ca";
    input.insertAdjacentElement("afterend", badge);

    let AL = null;
    async function run() {
      for (let attempt = 1; attempt <= AP_TRIES; attempt++) {
        try {
          await apswisAwaitImage(img);
          const w = img.naturalWidth, h = img.naturalHeight;
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          // 直接讀畫面上這張圖，不另外 fetch——每請求一次 ValidCode.asp 伺服器就換一組
          // 答案，另外抓會讓畫面上的圖與填入值對不起來。
          const ctx = cv.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, w, h).data;
          const getPixel = (y, x) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
          const gs = apswisGlyphs(getPixel, w, h);
          if (!gs) throw new Error("字元相黏，換一張");
          if (!AL) AL = loadWeights(APSWIS);     // 只有真的要辨識時才解碼權重
          input.value = gs.map((g) => apswisForward(g, AL)).join("");
          badge.style.color = "#2a6";
          badge.textContent = "已自動填入驗證碼（請自行確認後按確定）";
          return;
        } catch (e) {
          if (attempt === AP_TRIES) {
            badge.style.color = "#c0392b";
            badge.textContent = "驗證碼自動辨識失敗，請手動輸入（" + e.message + "）";
            return;
          }
          badge.textContent = "辨識失敗，換一張重試…（" + attempt + "/" + AP_TRIES + "）";
          // 頁面自己的「重整」是 RE_PAGE()，會整頁重載並清掉已輸入的帳密，所以自己換 src。
          const base = img.getAttribute("src").split("?")[0];
          img.src = base + "?t=" + Date.now() + "_" + attempt;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }
    run();
  }

  if (location.hostname === "account.ao.ntut.edu.tw") {
    startApswisFill();
    return; // 請購系統與入口網無關，別載入入口網的 CharNet
  }

  if (location.pathname === "/oauth2Server.do") {
    startOAuth2Fill();
    return; // OAuth2 頁不需要 CharNet，別白解 253KB 權重
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
  // 參數化：nPortal 與請購系統兩個模型的權重格式相同，只有層形狀與類別數不同。
  function loadWeights(model) {
    const bin = atob(model.b64), n = bin.length, bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    const dv = new DataView(bytes.buffer), f32 = new Float32Array(n / 2);
    for (let i = 0; i < f32.length; i++) f32[i] = halfToFloat(dv.getUint16(i * 2, true));
    const L = {}; let off = 0;
    for (const m of model.manifest) {
      const wn = m.w_shape.reduce((a, b) => a * b, 1), bn = m.b_shape.reduce((a, b) => a * b, 1);
      L[m.name] = { w: f32.subarray(off, off + wn), ws: m.w_shape, b: f32.subarray(off + wn, off + wn + bn) };
      off += wn + bn;
    }
    return L;
  }
  const L = loadWeights(MODEL);

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

  // POST /login.do 的結果：redirect → 跟隨，登入頁 → 重試，其餘→ 交給校方後續頁面。
  function classifyLoginResponse(resp, text) {
    if (resp.redirected && !/\/(?:index|login)\.do(?:[?#]|$)/i.test(resp.url)) return "success";
    if (/<form[^>]+(?:name=["']login["']|id=["']login["'])|id=["']authcode["']/i.test(text)) return "login_page";
    return "follow_up";
  }

  function renderLoginResponse(doc, text) {
    doc.open();
    doc.write(text);
    doc.close();
  }

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
        const result = classifyLoginResponse(resp, text);
        if (result === "success") {
          setStatus("登入成功，跟隨重定向…", "ok"); location.href = resp.url; return;
        }
        if (result === "login_page") {
          say("驗證碼錯誤，刷新後重試…");
        } else {
          setStatus("正在處理後續頁面…", "work");
          renderLoginResponse(document, text);
          return;
        }
      } catch (e) { say("連線問題，重試中…"); continue; }
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
