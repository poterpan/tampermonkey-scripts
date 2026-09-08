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
const apswisBlock = slice("  const APSWIS = {", "  // 請購系統有多個主機", "APSWIS 區塊");
const weightLoader = slice("  function halfToFloat(", "  const L = loadWeights(MODEL);", "權重載入器");
const kernels = slice("  function conv3(", "  function charForward(", "卷積核心");

const api = vm.runInNewContext(
  `${apswisBlock}\n${weightLoader}\n${kernels}\n` +
  `({ APSWIS, IFIRST, AP_SZ, IF_SZ, apswisGlyphs, ifirstGlyphs, charNetForward, loadWeights })`,
  { atob, Promise, Math, Uint8Array, Int32Array, Float32Array, DataView, Map },
);

const samples = JSON.parse(fs.readFileSync(
  new URL("./training/fixtures/apswis_samples.json", import.meta.url), "utf8"));
const ifirstSamples = JSON.parse(fs.readFileSync(
  new URL("./training/fixtures/ifirst_samples.json", import.meta.url), "utf8"));

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
  return gs.map((g) => api.charNetForward(g, weights, api.APSWIS.chars, api.AP_SZ)).join("");
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
  if (!weights) weights = api.loadWeights(api.APSWIS);
  assert.equal(
    gs.map((g) => api.charNetForward(g, weights, api.APSWIS.chars, api.AP_SZ)).join(""),
    s.expected);
});

// ---- ValidCode_2（accweb.ifirst 等）：另一個產生器，10 類純數字 ----

let ifWeights = null;
function recogniseIfirst(s) {
  if (!ifWeights) ifWeights = api.loadWeights(api.IFIRST);
  const gs = api.ifirstGlyphs(pixelReader(s), s.w, s.h);
  assert.ok(gs, `${s.name}: 切字回傳 null`);
  return gs.map((g) => api.charNetForward(g, ifWeights, api.IFIRST.chars, api.IF_SZ)).join("");
}

test("ValidCode_2 charset is the ten digits", () => {
  assert.equal(api.IFIRST.chars, "0123456789");
  const last = api.IFIRST.manifest[api.IFIRST.manifest.length - 1];
  assert.equal(last.w_shape[0], 10);
});

test("ValidCode_2 glyphs are centred on 16x16", () => {
  assert.equal(api.IF_SZ, 16);
  const gs = api.ifirstGlyphs(pixelReader(ifirstSamples[0]), ifirstSamples[0].w, ifirstSamples[0].h);
  assert.equal(gs.length, 6);
  for (const g of gs) assert.equal(g.length, 16 * 16);
});

// 逐位驗證：JS 前向必須與訓練時的 Python 完全一致
for (const s of ifirstSamples) {
  test(`ValidCode_2 matches Python on ${s.name} (${s.expected})`, () => {
    assert.equal(recogniseIfirst(s), s.expected);
  });
}

test("ValidCode_2 keeps digits and drops the 1-5px specks by height", () => {
  // 數字高度一律 10px、雜訊 1~5px，空隙 6~9 完全沒有樣本，所以用高度過濾。
  const s = ifirstSamples[0];
  const bytes = Buffer.from(s.mask, "base64");
  const base = (y, x) => {
    const i = y * s.w + x;
    return ((bytes[i >> 3] >> (7 - (i & 7))) & 1) ? s.fg : s.bg;
  };
  const specks = new Set(["0,1", "9,58", "1,30", "8,15"]);
  const noisy = (y, x) => (specks.has(`${y},${x}`) ? s.fg : base(y, x));
  const gs = api.ifirstGlyphs(noisy, s.w, s.h);
  assert.ok(gs, "加了雜點後切字不該失敗");
  assert.equal(gs.length, 6);
});

test("the two 請購 models are distinct and not interchangeable", () => {
  // 兩個主機介面相同但驗證碼產生器不同；用錯模型會自信地填錯答案。
  assert.notEqual(api.APSWIS.chars, api.IFIRST.chars);
  assert.equal(api.APSWIS.chars.length, 22);
  assert.equal(api.IFIRST.chars.length, 10);
  assert.notEqual(api.AP_SZ, api.IF_SZ);
});
