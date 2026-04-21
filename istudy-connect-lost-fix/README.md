# NTUT iStudy connect_lost 修復

![版本](https://img.shields.io/badge/版本-1.3.0-blue)
![兼容性](https://img.shields.io/badge/兼容性-Tampermonkey-green)

修復 NTUT iStudy (`istudy.ntut.edu.tw`) 登入後偶發「connect lost」錯誤的 Tampermonkey 腳本。偵測到異常時自動清除 iStudy 殘留的 session cookie 並重新登入，無需手動清 cookie 或重開瀏覽器。

## 問題情境

從校務系統 SSO 登入 iStudy 時，偶爾會在 `login2.php` 被導向 `connect_lost.php`，畫面出現 "connect lost" 錯誤，之後需要手動清 `istudy.ntut.edu.tw` 的 cookie 才能重新登入。此腳本自動化處理這個流程。

## 功能

- **自動偵測** - 攔截導向 `connect_lost.php` 的行為，或從頁面內容偵測 "connect lost" 字樣
- **精準清除 cookie** - 只清 `istudy.ntut.edu.tw` 這個 exact host 的 cookie，不動 `ntut.edu.tw` 上共享給其他校務服務的 SSO cookie
- **防迴圈保護** - 30 秒內只重試一次，避免清 cookie 後仍失敗造成無限 reload
- **過程可見** - 清除時顯示遮罩提示，Console 會列出被清掉和被保留的 cookie 清單

## 安裝

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展
2. 點擊下方安裝連結，Tampermonkey 會自動識別並提示安裝

[![安裝腳本](https://img.shields.io/badge/安裝腳本-NTUT_iStudy_connect__lost_修復-blue)](https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/istudy-connect-lost-fix/istudy-connect-lost-fix.user.js)

## 使用說明

安裝後完全自動運作，不需要設定。正常登入 iStudy 時腳本不會介入；只在遇到 connect_lost 錯誤時才會自動觸發清除與重新登入。

### 觸發時的行為

1. 偵測到異常 → 停止原本的載入
2. 顯示白色遮罩「偵測到 iStudy session 異常，清除中…」
3. 清除 `istudy.ntut.edu.tw` 的 cookie
4. 以相同 URL 重新載入頁面

若清完 cookie 後 30 秒內又再次觸發，腳本會放行原本的 connect_lost 流程，避免無限迴圈。此時通常表示不是 cookie 問題，請手動處理。

## 兼容性

- **瀏覽器**: Chrome, Edge, Firefox (需安裝 Tampermonkey)
- **系統**: Windows, macOS, Linux
- **目標網站**: `istudy.ntut.edu.tw/login2.php`

### 關於 GM.cookie 權限

腳本需要 `GM.cookie` 權限以清除 HttpOnly cookie（一般網頁 JS 無法存取）。Tampermonkey 原生支援；其他 userscript 管理器（如 Violentmonkey）若不支援此 API，腳本會在 Console 顯示錯誤訊息並放行原本流程。

## 權限說明

此腳本會在偵測到錯誤時**刪除** `istudy.ntut.edu.tw` 網域下的 cookie。不會讀取、傳送或儲存任何個人資料，所有邏輯都在本機執行。完整原始碼公開可檢視。

## 常見問題

**Q: 會不會影響其他 NTUT 服務（如 app.ntut.edu.tw）的登入狀態？**
A: 不會。腳本只清除 `domain` 精確等於 `istudy.ntut.edu.tw` 的 cookie，跨服務共享的 SSO cookie（掛在 `.ntut.edu.tw` parent domain）不會動到。

**Q: 腳本觸發後還是登入失敗？**
A: 30 秒內若再次觸發 connect_lost，腳本不會再重試，會放行原本的錯誤頁面。這通常代表問題不在 cookie，請嘗試重新從校務系統登入。

**Q: 如何確認腳本有在運作？**
A: 開啟瀏覽器開發者工具的 Console，觸發時會看到 `[istudy-fix]` 開頭的訊息，包含被清除和被保留的 cookie 清單。

## 更新日誌

### 版本 1.3.0
- 首次公開發佈
- 三路偵測：導航攔截、DOM observer、onload 兜底
- 30 秒防迴圈保護
- 精準清除 exact-host cookie

## 貢獻和回報問題

歡迎提交 Issues 或 Pull Requests 來改進此腳本。

## 授權

此腳本採用 [MIT 授權](../LICENSE)。

---

如有問題或建議，請在 [GitHub Issues](https://github.com/poterpan/tampermonkey-scripts/issues) 提出。
