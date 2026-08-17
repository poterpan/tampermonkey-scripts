// JS mirror of segment.py + per-char CharNet forward. getPixel(y,x)->[r,g,b].
const SZ = 40;

function segmentGlyphs(getPixel, W, H) {
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
  const gh = s.ymax - s.ymin + 1, gw = s.xmax - s.xmin + 1;
  const out = new Float32Array(SZ * SZ);
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

// ---- CharNet forward: 1x40x40 -> 26 ----
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
function charForward(L, chars, glyph40) {
  let t = { d: glyph40, C: 1, H: SZ, W: SZ };
  t = pool2(conv3(t, L.cc1.w, L.cc1.ws, L.cc1.b));
  t = pool2(conv3(t, L.cc2.w, L.cc2.ws, L.cc2.b));
  t = pool2(conv3(t, L.cc3.w, L.cc3.ws, L.cc3.b));
  const h = linear(t.d, L.cf1.w, L.cf1.ws, L.cf1.b, true);
  const o = linear(h, L.cf2.w, L.cf2.ws, L.cf2.b, false);
  let bi = 0; for (let i = 1; i < o.length; i++) if (o[i] > o[bi]) bi = i;
  return chars[bi];
}
function solve(L, chars, getPixel, W, H) {
  const gs = segmentGlyphs(getPixel, W, H);
  if (!gs) return null;
  return gs.map((g) => charForward(L, chars, g)).join("");
}
module.exports = { segmentGlyphs, charForward, solve, SZ };
