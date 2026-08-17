# 北科入口網站 - 跳過驗證碼（已棄用）

![版本](https://img.shields.io/badge/版本-20260817.1-lightgrey)
![狀態](https://img.shields.io/badge/狀態-已棄用-red)
![兼容性](https://img.shields.io/badge/兼容性-Tampermonkey-green)

> ⚠️ **已棄用**：本腳本用 App 式登入跳過驗證碼，但只能進入**舊版**入口 UI。學校改版後入口已改為新版 `cloudPortal`。
> 👉 請改用 **[北科入口網站 - 驗證碼自動辨識登入（新版 cloudPortal）](../ntut-portal-ocr-login/)**——本地 CNN 自動辨識驗證碼、走正規 web 登入、直接進入新版介面。
>
> 以下內容保留作為存檔。

臺北科技大學校園入口網站（`nportal.ntut.edu.tw`）跳過登入驗證碼的 Tampermonkey 腳本，並修復登入後偶發卡在白屏的問題。

## 關於此版本

本腳本 **Fork** 自 [umeow 的原始腳本](https://greasyfork.org/zh-TW/scripts/508559)（MIT 授權）。感謝原作者的貢獻。

### 本版本的修改

- **修復白屏問題**：原版在登入後偶爾會卡在空白頁面，需要手動訪問 `logout.do` 才能恢復。新增 `extractJSON` 容錯解析器，當瀏覽器（特別是 Chrome）把 JSON 包在 `<pre>` 或 HTML 標籤裡時仍能正確抓出資料
- **重試機制**：JSON 尚未完整傳輸時重試最多 5 秒，避免過早放棄渲染
- **預判已登入狀態**：在登入頁先檢查是否已登入，若是則直接跳轉到入口頁，避免重複登入造成的異常

## 功能

- 登入時自動跳過驗證碼輸入
- 自動修復 JSON 解析失敗造成的白屏問題
- 自訂渲染入口頁 UI（取代原本的 Dojo 框架載入流程）
- 支援公告、行事曆、個人資料等功能的內嵌顯示

## 安裝

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展
2. 點擊下方安裝連結，Tampermonkey 會自動識別並提示安裝

[![安裝腳本](https://img.shields.io/badge/安裝腳本-北科入口網站_跳過驗證碼-blue)](https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/ntut-portal-skip-captcha/ntut-portal-skip-captcha.user.js)

## 使用說明

安裝後完全自動運作，不需要設定。

1. 前往 `https://nportal.ntut.edu.tw/index.do`
2. 輸入學號與密碼（驗證碼欄位會被自動移除）
3. 點擊登入

若發生密碼錯誤、帳號鎖住、密碼過期、需驗證手機等狀況，腳本會跳出對應的提示訊息。

## 兼容性

- **瀏覽器**: Chrome, Edge, Firefox (需安裝 Tampermonkey)
- **系統**: Windows, macOS, Linux
- **目標網站**: `nportal.ntut.edu.tw`

## 已知限制

以下功能在此腳本的自訂渲染模式下不支援，需停用腳本使用原生介面：

- 工作區 (`taskMain`)
- 電子資料夾 (`efolderMain`)
- 個人照片檢視
- 密碼修改（請透過網頁原生流程修改）

## 常見問題

**Q: 登入後還是卡在白屏怎麼辦？**
A: 開啟 Console 觀察 `[istudy-fix]` 或 retry 的 log。若重試 50 次仍失敗會停止。此時請手動訪問 `https://nportal.ntut.edu.tw/logout.do` 後重新登入。

**Q: 為什麼部分功能按下去會提示不支援？**
A: 由於自訂渲染模式重建了 DOM 結構，部分依賴原生 UI 元件的功能無法直接使用。需使用該功能時請於 Tampermonkey 中暫時停用此腳本。

**Q: 密碼可以透過腳本修改嗎？**
A: 不行。腳本會攔截密碼修改按鈕並提示關閉腳本後重新登入再修改。

## 更新日誌

### 20250302.1
- 首次以 PoterPan fork 版本公開發佈
- 基於 umeow [20250302 版本](https://greasyfork.org/zh-TW/scripts/508559)
- 新增白屏問題修復（`extractJSON` 容錯解析、重試機制）
- 新增已登入狀態預判

## 歸屬與授權

- **原作者**: [umeow](https://greasyfork.org/zh-TW/users/) — [原始腳本](https://greasyfork.org/zh-TW/scripts/508559)
- **本 Fork**: PoterPan
- **授權**: [MIT](../LICENSE)

## 貢獻和回報問題

歡迎提交 Issues 或 Pull Requests。若問題涉及上游核心邏輯，建議同時回報至原作者。

---

如有問題或建議，請在 [GitHub Issues](https://github.com/poterpan/tampermonkey-scripts/issues) 提出。
