# 北科入口網站小幫手

![版本](https://img.shields.io/badge/版本-20260825.1-blue)
![兼容性](https://img.shields.io/badge/兼容性-Tampermonkey-green)
![推論](https://img.shields.io/badge/推論-100%25_本地-orange)

臺北科技大學校園入口網站（`nportal.ntut.edu.tw`）的增強小幫手，把常用功能整合成一支腳本：

1. **驗證碼自動辨識登入** — 於瀏覽器本地用 CNN 自動辨識登入驗證碼，走正規 web 登入，直接進入 **2026 改版後的新版 `cloudPortal` 介面**。
2. **保持登入（可選）** — 防止閒置 30 分鐘後被自動登出。

兩個功能可各別開關，純本地運作、**不呼叫任何外部 API、不上傳任何資料**。

## 功能一：驗證碼自動辨識登入

學校改版後，入口網從 `myPortal.do` 換成 `cloudPortal.do` 的新介面，而新介面必須走 **web session**、其驗證碼是**後端驗證**的（無法跳過，只能辨識）。本腳本在登入頁自動完成辨識與登入。

**運作原理**：驗證碼每個字是不同飽和色 → 用顏色把 4 個字乾淨切開（濾掉背景/交叉線/星點）→ 各字裁進 40×40 二值圖 → 每字 CNN（約 190KB float16 權重內嵌）辨識為 A–Z → 帶頁面 dojo Blowfish 加密的密碼 POST `login.do`；辨識失敗自動刷新重試（最多 6 次），連續失敗才回退手動輸入。

**準確率**：真實驗證碼單張辨識 char ≈ 98% / 整組 ≈ 94%，配合自動重試實際成功率 ≈ 99.99%。

模型以「合成預訓練 + 真實驗證碼（ddddocr 自動標註約 6,800 張）微調」訓練；管線與權重見 [`training/`](training/)。

**登入後的跳轉**：入口網的 `login.do` 不走 HTTP 302，而是回一段 HTML、在裡面用 JS 的 `location.href` 指定下一步。腳本因此不自行猜測目的地，一律跟隨伺服器的指示——密碼過期強制修改、手機簡訊驗證、服務條款同意等後續流程都會原樣呈現，交由入口網自己的頁面接手。

## 功能二：保持登入（預設關閉）

入口網有 30 分鐘閒置自動登出。勾選後，腳本會定時呼叫入口網自己的 `resetTime()` 把閒置計時器歸零（並自動關掉「即將登出」警告框），伺服器 session 由入口網既有的 `sessionCheck` 保活——只要開著分頁就不會因閒置被登出。

- **預設關閉**：在登入頁的「🤖 驗證碼自動辨識」狀態卡上有一個「**保持登入**」勾選框，勾選後會記住（`localStorage`）。
- 只擋「閒置逾時」；若學校另設「絕對最長 session」則無法避免。
- 公用電腦請斟酌是否開啟。

## 安裝

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展
2. 點擊下方安裝連結，Tampermonkey 會自動識別並提示安裝

[![安裝腳本](https://img.shields.io/badge/安裝腳本-北科入口網站小幫手-blue)](https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/ntut-portal-helper/ntut-portal-helper.user.js)

安裝後到 `nportal.ntut.edu.tw` 登入頁，輸入帳號密碼按登入即可（驗證碼欄已變成自動辨識狀態卡）；需要保持登入就勾一下卡片上的選項。

## 隱私與安全

- **全程本地**：驗證碼圖片只在你的瀏覽器內處理，不上傳任何伺服器。
- **無外部依賴**：模型權重內嵌於腳本，不從任何 CDN／gist 下載。
- 帳號密碼只送往學校官方 `login.do`，與正常登入相同。

## 致謝

- 顏色分割思路參考自 [umeow 的「自動填寫驗證碼」腳本](https://greasyfork.org/zh-TW/scripts/521693)（MIT）。本版改用每字 CNN、權重自足內嵌，並加上完整 web 登入、自動重試與保持登入。
- 訓練標註使用 [ddddocr](https://github.com/sml2h3/ddddocr)（離線，僅用於產生訓練標籤，不在腳本執行期使用）。

## 授權

MIT
