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
   python build_userscript.py # 把權重注入 login_template.js → ntut-portal-ocr-login.user.js
   ```

## 檔案

| 檔案 | 說明 |
|---|---|
| `segment.py` | 顏色分割（Python 版，`segment_infer.js` 是逐位對齊的 JS 版） |
| `gen_captcha.py` | 合成驗證碼生成器（預訓練用；本版每字 CNN 主要靠真圖，可選用） |
| `preprocess.py` | 舊版 whole-image 方案的 ink-map 前處理（每字 CNN 版已不需要） |
| `train_perchar.py` | 每字 CNN 訓練 + GT 評估 |
| `relabel.py` | ddddocr 自動標註 |
| `export_charnet.py` | 匯出 float16 權重 + 驗證用 GT 預測 |
| `build_userscript.py` | 注入權重、產生最終 `.user.js` |
| `login_template.js` | userscript 模板（分割＋CNN 推論＋登入流程＋UI；權重以 `__WEIGHTS_B64__` 佔位） |
| `segment_infer.js` | JS 版分割＋CharNet 前向（供驗證與模板參考） |
| `real_labels.py` | 手工標註的 GT 測試集（caps2/ 對應） |
| `charnet.pt` / `char_weights.b64` / `char_manifest.json` | 訓練好的模型 |

## 方法重點

- **顏色分割 + 每字 CNN**：驗證碼每字不同飽和色，用顏色把 4 個字乾淨切開（甩掉交叉線與雜訊），再逐字辨識——比整張圖辨識穩定得多。
- **合成預訓練 + 真圖微調**：純合成有 domain gap（真圖只到 ~60%）；用 ddddocr 自動標註真圖微調是關鍵。
- **逐位驗證**：JS 前向與 Python 逐位元一致（分割、推論皆 35/35），確保部署與訓練同結果。
- 模型僅 ~190KB（float16），純手刻 JS 前向，不用 onnxruntime 之類重函式庫。
