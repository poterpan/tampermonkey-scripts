# 個人 Tampermonkey 腳本集

這個倉庫包含我開發的各種實用 Tampermonkey 腳本，專為提升網站使用體驗而設計。

## 可用腳本

### [YAKITORY 控制面板](yakitory-helper/)

[![版本](https://img.shields.io/badge/版本-2.2-blue)](yakitory-helper/yakitory-helper.user.js)

為逢甲大學 iLearn 平台的 YAKITORY 影音系統提供增強功能：
- 自動點擊確認對話框
- 自動播放下一部影片
- 自動靜音功能
- 影片結束通知與提示音

[查看詳情與安裝說明](yakitory-helper/)

### [Facebook 優化版自動戳回](facebook-autopoke/)

[![版本](https://img.shields.io/badge/版本-3.5.1-blue)](facebook-autopoke/facebook-autopoke.user.js)

為 Facebook 提供自動戳回功能：
- 自動偵測並戳回朋友
- 智能延遲與閒置模式
- 完整的統計與日誌記錄

[查看詳情與安裝說明](facebook-autopoke/)

### [NTUT iStudy connect_lost 修復](istudy-connect-lost-fix/)

[![版本](https://img.shields.io/badge/版本-1.3.0-blue)](istudy-connect-lost-fix/istudy-connect-lost-fix.user.js)

修復臺北科技大學 iStudy 登入偶發 "connect lost" 錯誤：
- 自動偵測異常並清除殘留 session cookie
- 只清 istudy.ntut.edu.tw 的 cookie，不影響其他 NTUT 服務登入
- 30 秒防迴圈保護

[查看詳情與安裝說明](istudy-connect-lost-fix/)

### [北科入口網站 - 跳過驗證碼](ntut-portal-skip-captcha/) ⚠️ 已棄用

[![版本](https://img.shields.io/badge/版本-20260817.1-lightgrey)](ntut-portal-skip-captcha/ntut-portal-skip-captcha.user.js)
[![狀態](https://img.shields.io/badge/狀態-已棄用-red)](ntut-portal-skip-captcha/)

臺北科技大學校園入口網站免驗證碼登入（Fork 自 [umeow](https://greasyfork.org/zh-TW/scripts/508559)）。
**已棄用**：只能進入舊版 UI，學校改版後請改用上方的「驗證碼自動辨識登入（新版 cloudPortal）」。

[查看詳情與安裝說明](ntut-portal-skip-captcha/)

### [北科入口網站 - 驗證碼自動辨識登入（新版 cloudPortal）](ntut-portal-ocr-login/)

[![版本](https://img.shields.io/badge/版本-20260817.4-blue)](ntut-portal-ocr-login/ntut-portal-ocr-login.user.js)

臺北科技大學校園入口網站 2026 改版後，於瀏覽器**本地用 CNN 自動辨識驗證碼**並登入，直接進入新版 `cloudPortal` 介面：
- 顏色分割 + 每字 CNN，純本地推論、**不呼叫任何外部 API**
- 完整 web 登入 + 辨識失敗自動刷新重試、多次失敗回退手動
- 模型僅 ~190KB 內嵌，單張辨識 ≈94%、含重試 ≈99.99%

[查看詳情與安裝說明](ntut-portal-ocr-login/)

---

## 如何安裝

所有腳本都需要先安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展：
1. 訪問對應腳本頁面
2. 點擊腳本鏈接
3. Tampermonkey 會自動識別並提示安裝

## 更新方式

所有腳本都設置了自動更新功能，也可以：
1. 在 Tampermonkey 控制面板中檢查更新
2. 直接從本倉庫重新安裝腳本

## 貢獻

歡迎提交 Issues 或 Pull Requests 來改進這些腳本。

## 授權

所有腳本均採用 [MIT 授權](LICENSE)。
