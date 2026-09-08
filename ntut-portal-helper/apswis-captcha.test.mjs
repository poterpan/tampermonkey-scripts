import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

// 與 login-response.test.mjs 同樣的做法：從產出的 .user.js 切出程式碼來跑，
// 確保測到的就是使用者實際安裝的那份。
const source = fs.readFileSync(
  new URL("./ntut-portal-helper.user.js", import.meta.url), "utf8");

function slice(from, to, label) {
  const a = source.indexOf(from);
  const b = source.indexOf(to, a + 1);
  assert.notEqual(a, -1, `${label}: 找不到起點 ${from}`);
  assert.notEqual(b, -1, `${label}: 找不到終點 ${to}`);
  return source.slice(a, b);
}

// 請購區塊（常數 + 切字 + 前向）、權重載入器、共用的卷積/池化/線性層
const apswisBlock = slice("  const APSWIS = {", "  if (location.hostname ===", "APSWIS 區塊");
const weightLoader = slice("  function halfToFloat(", "  const L = loadWeights(MODEL);", "權重載入器");
const kernels = slice("  function conv3(", "  function charForward(", "卷積核心");

const api = vm.runInNewContext(
  `${apswisBlock}\n${weightLoader}\n${kernels}\n` +
  `({ APSWIS, AP_SZ, apswisGlyphs, apswisForward, loadWeights })`,
  { atob, Promise, Math, Uint8Array, Int32Array, Float32Array, DataView, Map },
);

const samples = JSON.parse(fs.readFileSync(
  new URL("./training/fixtures/apswis_samples.json", import.meta.url), "utf8"));

/** Rebuild a two-colour CAPTCHA's pixel reader from the packed fixture. */
function pixelReader(s) {
  const bytes = Buffer.from(s.mask, "base64");
  return (y, x) => {
    const i = y * s.w + x;
    return ((bytes[i >> 3] >> (7 - (i & 7))) & 1) ? s.fg : s.bg;
  };
}

let weights = null;
function recognise(s) {
  if (!weights) weights = api.loadWeights(api.APSWIS);
  const gs = api.apswisGlyphs(pixelReader(s), s.w, s.h);
  assert.ok(gs, `${s.name}: 切字回傳 null`);
  return gs.map((g) => api.apswisForward(g, weights)).join("");
}

test("charset is the 22 classes the training data actually contains", () => {
  assert.equal(api.APSWIS.chars, "123456789BCDHIJKLMNPRX");
  assert.equal(api.APSWIS.chars.length, 22);
  // 沒有 0，也沒有 AEFGOQSTUVWYZ——這是從 4660 個字元的分群得出的，不是猜的
  for (const c of "0AEFGOQSTUVWYZ") {
    assert.ok(!api.APSWIS.chars.includes(c), `字集不該含 ${c}`);
  }
});

test("manifest output layer matches the charset", () => {
  const last = api.APSWIS.manifest[api.APSWIS.manifest.length - 1];
  assert.equal(last.name, "cf2");
  assert.equal(last.w_shape[0], api.APSWIS.chars.length);
});

test("glyphs are centred on the 40x40 canvas the model was trained on", () => {
  assert.equal(api.AP_SZ, 40);
  const gs = api.apswisGlyphs(pixelReader(samples[0]), samples[0].w, samples[0].h);
  assert.equal(gs.length, 5);
  for (const g of gs) assert.equal(g.length, 40 * 40);
});

// 逐位驗證：JS 前向必須與訓練時的 Python 完全一致（fixture 的答案由 Python 產生
// 並經人眼確認），任何分割或推論的偏移都會在這裡爆掉。
for (const s of samples) {
  test(`matches Python on ${s.name} (${s.expected})`, () => {
    assert.equal(recognise(s), s.expected);
  });
}

test("a single-colour image yields no glyphs rather than one giant blob", () => {
  const solid = () => [235, 235, 235];
  assert.equal(api.apswisGlyphs(solid, 124, 24), null);
});

test("salt noise below the size threshold is dropped", () => {
  // 在真圖上灑幾顆孤立雜點，切字結果必須不變——雜訊與筆畫的大小空隙是 6..53px。
  const s = samples[0];
  const bytes = Buffer.from(s.mask, "base64");
  const base = (y, x) => {
    const i = y * s.w + x;
    return ((bytes[i >> 3] >> (7 - (i & 7))) & 1) ? s.fg : s.bg;
  };
  const specks = new Set(["1,1", "2,60", "22,120", "5,5", "20,3"]);
  const noisy = (y, x) => (specks.has(`${y},${x}`) ? s.fg : base(y, x));
  const gs = api.apswisGlyphs(noisy, s.w, s.h);
  assert.ok(gs, "加了雜點後切字不該失敗");
  assert.equal(gs.map((g) => api.apswisForward(g, weights || (weights = api.loadWeights(api.APSWIS)))).join(""),
               s.expected);
});
