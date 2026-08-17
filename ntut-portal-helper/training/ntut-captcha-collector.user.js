// ==UserScript==
// @name         NTUT 驗證碼收集器（暫時工具）
// @namespace    ntut-captcha-collect
// @version      1.0
// @description  在瀏覽器內抓取 authImage.do 驗證碼圖（過得了 F5），收完下載成單一檔給模型訓練用。用完可停用。
// @match        https://nportal.ntut.edu.tw/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const blobToB64 = (b) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]); // strip data: prefix
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });

  // ---- floating UI ----
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:999999;background:#fff;border:2px solid #2a6;" +
    "border-radius:10px;padding:12px 14px;font:14px/1.5 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.2);width:230px";
  box.innerHTML =
    '<div style="font-weight:700;color:#2a6;margin-bottom:6px">驗證碼收集器</div>' +
    '<label>數量 <input id="ccN" type="number" value="1200" style="width:70px"></label>' +
    '<label style="display:block;margin:4px 0">間隔ms <input id="ccD" type="number" value="300" style="width:70px"></label>' +
    '<button id="ccGo" style="width:100%;margin-top:6px;padding:6px;background:#2a6;color:#fff;border:0;border-radius:6px;cursor:pointer">開始收集</button>' +
    '<div id="ccStat" style="margin-top:8px;color:#333;font-size:12px">閒置中</div>';
  document.body.appendChild(box);

  const stat = box.querySelector("#ccStat");
  box.querySelector("#ccGo").onclick = async function () {
    const N = Math.max(1, parseInt(box.querySelector("#ccN").value) || 1200);
    const D = Math.max(0, parseInt(box.querySelector("#ccD").value) || 300);
    this.disabled = true; this.textContent = "收集中…";
    const out = [];
    let fails = 0;
    for (let i = 0; i < N; i++) {
      try {
        const r = await fetch("/authImage.do?t=" + Date.now() + "_" + i, { cache: "no-store", credentials: "include" });
        if (!r.ok) throw new Error("http " + r.status);
        const b64 = await blobToB64(await r.blob());
        if (b64 && b64.length > 100) { out.push(b64); fails = 0; }
        else { fails++; }
      } catch (e) {
        fails++;
        if (fails >= 15) { stat.textContent = "連續失敗過多，可能 F5 仍在冷卻，先停在 " + out.length + " 張"; break; }
        await sleep(1500);
      }
      if (i % 20 === 0) stat.textContent = "已收 " + out.length + " / " + N;
      await sleep(D);
    }
    // download one file (one base64 PNG per line)
    const blob = new Blob([out.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ntut_captchas_" + out.length + ".txt";
    document.body.appendChild(a); a.click(); a.remove();
    stat.textContent = "完成！已下載 " + out.length + " 張到 Downloads";
    this.disabled = false; this.textContent = "開始收集";
  };
})();
