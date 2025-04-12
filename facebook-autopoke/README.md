# Facebook 優化版自動戳回

![版本](https://img.shields.io/badge/版本-3.4-blue)
![兼容性](https://img.shields.io/badge/兼容性-Tampermonkey-green)

自動在 Facebook 上戳回朋友的腳本，帶有控制面板和統計功能，讓您的戳戳樂更加輕鬆。

## 功能介紹

### 主要功能
- **自動戳回** - 自動偵測並戳回朋友，無需手動操作
- **智能延遲** - 在不同時段智能調整戳回頻率，避免被系統偵測
- **閒置模式** - 無活動時自動切換到低頻率模式，節省資源

### 控制面板
- **實時統計** - 顯示總計戳回次數及每個人的戳回統計
- **自定義設置** - 可調整延遲時間和閒置閾值
- **運行日誌** - 記錄所有戳回活動，清晰可見
- **可折疊界面** - 簡潔的控制面板，可最小化

## 截圖

![Screenshot](/img/facebook-autopoke.png)

## 安裝方法

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展
2. 點擊下方安裝連結，或從 GitHub 頁面安裝
3. 確認安裝並前往 Facebook 的 pokes 頁面

[![安裝腳本](https://img.shields.io/badge/安裝腳本-Facebook_優化版自動戳回-blue)](https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/facebook-autopoke/facebook-autopoke.user.js)

## 使用說明

### 基本功能
腳本安裝後會自動運行，默認開啟自動戳回功能：

1. **自動戳回** - 自動點擊 "戳回去" 按鈕，無需手動操作
2. **智能延遲** - 根據活動情況自動調整檢查間隔
3. **個人統計** - 記錄每個人被戳回的次數

### 控制面板操作
- 點擊控制面板右上角的 "−" 可以收起面板
- 點擊 "立即戳回" 按鈕可以立即執行一次戳回檢查
- 調整各種延遲設置可以自定義檢查頻率
- 查看實時統計和日誌了解運行情況

## 兼容性

- **瀏覽器**: Chrome, Edge, Firefox (需安裝 Tampermonkey)
- **系統**: Windows, macOS, Linux
- **目標網站**: Facebook (www.facebook.com/pokes 和其他 Facebook 頁面)

## 自定義

您可以通過控制面板調整以下設置：

- **正常最小/最大延遲** - 活躍模式下的檢查間隔範圍
- **閒置最小/最大延遲** - 閒置模式下的檢查間隔範圍
- **閒置閾值** - 多少次無活動後進入閒置模式

## 數據保存

腳本會自動保存您的設置和統計數據到瀏覽器的本地存儲中，重新啟動瀏覽器後依然有效。

## 常見問題

**Q: 為什麼有時不會自動戳回？**  
A: 腳本需要找到帶有 "戳回去" 文字的按鈕。如果 Facebook 更改了界面，可能需要更新腳本。

**Q: 可以調整戳回頻率嗎？**  
A: 可以，通過控制面板調整最小/最大延遲時間來改變戳回頻率。

## 更新日誌

### 版本 3.4
- 添加了閒置模式功能
- 優化了用戶名稱識別
- 改進了控制面板界面
- 添加了個人戳回統計功能

## 貢獻和回報問題

歡迎提交 Issues 或 Pull Requests 來改進此腳本。

## 授權

此腳本採用 [MIT 授權](LICENSE)。

---

如有問題或建議，請在 [GitHub Issues](https://github.com/poterpan/tampermonkey-scripts/issues) 提出。