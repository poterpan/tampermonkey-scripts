# 北科入口網站 - 驗證碼自動辨識登入（新版 cloudPortal）

![版本](https://img.shields.io/badge/版本-20260817.4-blue)
![兼容性](https://img.shields.io/badge/兼容性-Tampermonkey-green)
![推論](https://img.shields.io/badge/推論-100%25_本地-orange)

臺北科技大學校園入口網站（`nportal.ntut.edu.tw`）**在瀏覽器本地用 CNN 自動辨識登入驗證碼**，走正規 web 登入流程，直接進入 **2026 改版後的新版 `cloudPortal` 介面**。

## 為什麼需要這支

學校改版後，入口網從 `myPortal.do` 換成 `cloudPortal.do` 的全新介面。舊的「跳過驗證碼」做法（用行動 App 式登入）只能拿到 App session、看不到新版介面；而新版介面必須走 **web session**，其驗證碼是**後端驗證**的，沒有辦法「跳過」——只能「辨識」。因此本腳本改用本地 OCR 自動填寫並登入。

## 功能

- **本地 CNN 自動辨識驗證碼**：純瀏覽器端推論，**不呼叫任何外部 API、不上傳任何圖片**
- **自動完成 web 登入** → 直接進入新版 `cloudPortal` 介面（密碼用頁面自帶的 dojo Blowfish 加密，與官方一致）
- **辨識失敗自動刷新重試**（最多 6 次）；連續失敗才回退成手動輸入
- 登入頁的驗證碼輸入框替換為「🤖 驗證碼自動辨識」狀態卡

## 運作原理

1. **顏色分割**：驗證碼每個字是不同的飽和色。統計影像顏色 → 濾掉背景（最多色）、淡色交叉線（亮度高或貫穿全寬）、星點雜訊（面積過小）→ 剩下的 4 色即 4 個字，依 x 由左至右排序。
2. **每字正規化**：各字裁進 40×40 二值圖（置中、不縮放）。
3. **每字 CNN**：小型卷積網路（約 9.7 萬參數、190KB float16 權重內嵌於腳本）分類每個字為 A–Z。
4. **登入與重試**：抓 `authImage.do` → 分割 → 辨識 → 帶 Blowfish 密碼 POST `login.do`；若被判驗證碼錯誤，換一張重試。

模型以「合成資料預訓練 + 真實驗證碼（ddddocr 自動標註約 6,800 張）微調」訓練；訓練管線與權重見 [`training/`](training/)。

## 準確率

在手工標註的真實驗證碼測試集上：單張辨識 **char ≈ 98% / 整組 ≈ 94%**（剩餘少數為同色重疊、人眼亦難辨的極端樣本）。配合自動刷新重試，實際登入成功率 **≈ 99.99%**。

## 隱私與安全

- **全程本地**：驗證碼圖片只在你的瀏覽器內處理，不會上傳到任何伺服器。
- **無外部依賴**：模型權重內嵌於腳本，不從任何 CDN／gist 下載。
- 帳號密碼只送往學校官方 `login.do`，與正常登入相同。

## 安裝

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展
2. 點擊下方安裝連結，Tampermonkey 會自動識別並提示安裝

[![安裝腳本](https://img.shields.io/badge/安裝腳本-驗證碼自動辨識登入-blue)](https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/ntut-portal-ocr-login/ntut-portal-ocr-login.user.js)

安裝後，到 `nportal.ntut.edu.tw` 登入頁輸入帳號密碼、按登入即可（驗證碼欄會顯示為自動辨識狀態卡）。若某次辨識連續失敗，會提示改為手動輸入。

## 致謝

- 顏色分割的思路參考自 [umeow 的「自動填寫驗證碼」腳本](https://greasyfork.org/zh-TW/scripts/521693)（MIT）。本版改用每字 CNN、權重自足內嵌、並加上完整 web 登入與自動重試。
- 訓練標註使用 [ddddocr](https://github.com/sml2h3/ddddocr)（離線，僅用於產生訓練標籤，不在腳本執行期使用）。

## 授權

MIT
