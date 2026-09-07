import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

// 與 login-response.test.mjs 同樣的做法：從產出的 .user.js 切出函式來跑，
// 確保測到的就是使用者實際安裝的那份程式碼。
const source = fs.readFileSync(
  new URL("./ntut-portal-helper.user.js", import.meta.url), "utf8");

const dacLine = source.match(/^ {2}const DAC = .*$/m);
assert.notEqual(dacLine, null, "const DAC must exist");

const buildStart = source.indexOf("function dacBuildMap(");
const recognizeStart = source.indexOf("function dacRecognizeImage(");
assert.notEqual(buildStart, -1, "dacBuildMap must exist");
assert.notEqual(recognizeStart, -1, "dacRecognizeImage must end the extracted range");

const api = vm.runInNewContext(
  `${dacLine[0]}\n${source.slice(buildStart, recognizeStart)}\n` +
  `({ DAC, buildMap: dacBuildMap, glyphKeys: dacGlyphKeys })`,
  { atob },
);

const samples = JSON.parse(fs.readFileSync(
  new URL("./training/fixtures/dac_samples.json", import.meta.url), "utf8"));

/** Rebuild a two-colour CAPTCHA's pixel reader from the packed fixture. */
function pixelReader(sample) {
  const bytes = Buffer.from(sample.mask, "base64");
  return (y, x) => {
    const i = y * sample.w + x;
    const on = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
    return on ? sample.fg : sample.bg;
  };
}

function recognize(sample) {
  const map = api.buildMap();
  return api.glyphKeys(pixelReader(sample), sample.w, sample.h)
    .map((k) => map.get(k) ?? "?")
    .join("");
}

test("templates cover A-Z exactly once", () => {
  const map = api.buildMap();
  assert.equal(map.size, 26);
  assert.equal([...map.values()].sort().join(""), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
});

test("template image size matches the login page's render parameters", () => {
  // 展開成宿主陣列：vm context 的 Array 原型與此處不同，strict deepEqual 會比對原型。
  assert.deepEqual([...api.DAC.image_size], [35, 100]);
});

for (const sample of samples) {
  test(`recognises ${sample.name} as ${sample.expected}`, () => {
    assert.equal(recognize(sample), sample.expected);
  });
}

test("keeps the 1px-wide I instead of filtering it out as noise", () => {
  // 每個 fixture 都含 I；若切字加了最小寬度過濾，字數會少於 4。
  for (const sample of samples) {
    assert.ok(sample.expected.includes("I"), `${sample.name} 應含 I`);
    const keys = api.glyphKeys(pixelReader(sample), sample.w, sample.h);
    assert.equal(keys.length, 4, `${sample.name} 應切出 4 個字元`);
  }
});

test("finds the background by frequency, not by a fixed luminance threshold", () => {
  // 登入頁藍底 (86,153,247) 的灰階亮度是 144 > 128，寫死門檻會整張反過來。
  const sample = samples[0];
  const luminance = (c) => (c[0] * 299 + c[1] * 587 + c[2] * 114 + 500) / 1000;
  assert.ok(luminance(sample.bg) > 128, "此 fixture 必須是亮背景才測得到這個回歸");
  assert.equal(recognize(sample), sample.expected);
});

test("a single-colour image yields no glyphs rather than one giant blob", () => {
  const solid = (_y, _x) => [86, 153, 247];
  assert.equal([...api.glyphKeys(solid, 100, 35)].length, 0);
});
