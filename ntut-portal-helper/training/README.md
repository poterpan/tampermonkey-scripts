# 訓練管線（驗證碼辨識模型）

保存這支腳本的模型是怎麼做出來的，方便未來學校若更換驗證碼樣式時**重新訓練**。純本地、輕量、可重現。

## 需求

```
pip install torch numpy pillow ddddocr
```
（`ddddocr` 只在「自動標註」階段用來當老師產生訓練標籤，不會出現在最終腳本裡。）

## 流程

1. **收集真實驗證碼**（瀏覽器端，過得了學校 F5 防護）
   安裝 `ntut-captcha-collector.user.js`，到 `nportal.ntut.edu.tw` 登入頁點「開始收集」，會下載一個每行一張 base64 PNG 的 `.txt`。
   > 註：**不要用 curl／指令批量抓** `authImage.do`——學校 F5 會把該 IP 的連線在 TLS 交握就 reset。瀏覽器 fetch 沒問題。

2. **解碼進資料夾**：把 base64 的每一行 decode 成 PNG 放進 `caps_big/`。

3. **自動標註**（ddddocr 當老師）
   ```
   python relabel.py          # 讀 caps_big/ + caps3/ → auto_labels_big.json（只留乾淨的 4 碼 A–Z）
   ```

4. **訓練每字 CNN**
   ```
   python train_perchar.py 60 # 顏色分割 → 每字 40×40 → CharNet；以手標 GT（caps2/）誠實評估 → charnet.pt
   ```

5. **匯出權重並打包成 userscript**
   ```
   python export_charnet.py   # charnet.pt → char_weights.b64 + char_manifest.json（float16）
   python export_apswis.py    # 請購 ValidCode.asp 模型 → apswis_weights.b64 + manifest
   python export_ifirst.py    # 請購 ValidCode_2.asp 模型 → ifirst_weights.b64 + manifest
   python build_userscript.py # 注入兩個模型與 OAuth2 模板 → ../ntut-portal-helper.user.js
   ```

   `export_apswis.py` 的來源 checkpoint 在 NTUT_Tools 的
   `tools/apswis_captcha_training/apswis_fc32.pt`（該處也有完整的訓練管線與研究記錄）。
   請購模型只有本入口網模型的六成大小：字形乾淨得多，全連接層 cf1 從 64 降到 32
   後準確率不動（實測 60 張全新驗證碼整串全對）。

> **產出的 `.user.js` 是編譯結果，不要手改。** 它由 `login_template.js` 產生，
> 手改會在下次 build 時被無聲蓋掉——20260825.1 的 `classifyLoginResponse`
> 就是這樣只存在於產出檔、直到 2026-09-07 才補回模板。要改請改模板再 rebuild。

## 檔案

| 檔案 | 說明 |
|---|---|
| `segment.py` | 顏色分割（Python 版，`segment_infer.js` 是逐位對齊的 JS 版） |
| `gen_captcha.py` | 合成驗證碼生成器（預訓練用；本版每字 CNN 主要靠真圖，可選用） |
| `preprocess.py` | 舊版 whole-image 方案的 ink-map 前處理（每字 CNN 版已不需要） |
| `train_perchar.py` | 每字 CNN 訓練 + GT 評估 |
| `relabel.py` | ddddocr 自動標註 |
| `export_charnet.py` | 匯出 float16 權重 + 驗證用 GT 預測 |
| `build_userscript.py` | 注入權重與 OAuth2 模板、產生最終 `.user.js` |
| `login_template.js` | userscript 模板（分割＋CNN 推論＋登入流程＋UI；權重以 `__WEIGHTS_B64__` 佔位） |
| `dac_templates.json` | OAuth2 登入頁 `dacAuthImage.do` 的 26 個字形模板（以 `__DAC_TEMPLATES__` 佔位注入） |
| `fixtures/dac_samples.json` | `dac-captcha.test.mjs` 用的真圖樣本（兩色圖，只存 bitmask） |
| `export_apswis.py` | 匯出請購系統模型成 float16 + manifest（來源 checkpoint 在 NTUT_Tools） |
| `apswis_weights.b64` / `apswis_manifest.json` | 請購系統 CharNet，22 類、cf1=32（以 `__APSWIS_*__` 佔位注入） |
| `fixtures/apswis_samples.json` | `apswis-captcha.test.mjs` 用的真圖樣本 + Python 預測（逐位驗證用） |
| `export_ifirst.py` | 匯出 ValidCode_2（紅色數字）模型 |
| `ifirst_weights.b64` / `ifirst_manifest.json` | ValidCode_2 CharNet，10 類、16×16 輸入 |
| `fixtures/ifirst_samples.json` | ValidCode_2 的逐位驗證 fixture |
| `segment_infer.js` | JS 版分割＋CharNet 前向（供驗證與模板參考） |
| `real_labels.py` | 手工標註的 GT 測試集（caps2/ 對應） |
| `charnet.pt` / `char_weights.b64` / `char_manifest.json` | 訓練好的模型 |

## 方法重點

- **顏色分割 + 每字 CNN**：驗證碼每字不同飽和色，用顏色把 4 個字乾淨切開（甩掉交叉線與雜訊），再逐字辨識——比整張圖辨識穩定得多。
- **合成預訓練 + 真圖微調**：純合成有 domain gap（真圖只到 ~60%）；用 ddddocr 自動標註真圖微調是關鍵。
- **逐位驗證**：JS 前向與 Python 逐位元一致（分割、推論皆 35/35），確保部署與訓練同結果。
- 模型僅 ~190KB（float16），純手刻 JS 前向，不用 onnxruntime 之類重函式庫。

## OAuth2 登入頁的驗證碼（`dac_templates.json`）

`oauth2Server.do` 用的是另一個端點 `dacAuthImage.do`，和上面那套完全無關：4 碼純大寫
A–Z、不旋轉不扭曲無雜訊，而且**每個字形每次渲染的點陣圖完全一致**。110 張真圖切出的
440 個字元恰好收斂成 26 種點陣圖，所以這裡不需要模型，逐位元查表即可（模板約 1KB）。

網址參數 `r`/`g`/`b` 是**背景色**（文字固定白色，設成 255,255,255 會得到全白空圖），
`w`/`h`/`fontSize` 可任意指定。模板綁定 `w=100&h=35&fontSize=25`；學校若改尺寸或字型，
就要重新收圖並重建。重建腳本目前在 NTUT_Tools 的 `scripts/build_dac_templates.py`
（輸入：一個裝 PNG 的目錄 + `{檔名: 答案}` 的 JSON；它會斷言同一字母只能有一種點陣圖）。

兩個實作陷阱：切字**不可過濾窄塊**（`I` 只有 1px 寬），二值化**不可寫死灰階門檻**
（登入頁藍底亮度 144 > 128，會把整張圖反過來）——要用「最多數顏色＝背景」。
