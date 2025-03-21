# 增強版 YAKITORY 控制面板

![版本](https://img.shields.io/badge/版本-2.2-blue)
![兼容性](https://img.shields.io/badge/兼容性-Tampermonkey-green)

為 逢甲大學 iLearn 系統 之影音平台（YAKITORY）增加多種實用功能的腳本，讓您在觀看教學影片時有更好的體驗。

## 功能介紹

### 主要功能
- **自動點擊確認** - 自動點擊 "您還在觀看嗎?" 的確認對話框，避免影片暫停
- **自動播放下一步** - 影片接近結束時自動跳轉到下一個活動並開始播放
- **自動靜音** - 自動將影片設置為靜音狀態，適合在公共場所使用
- **結束提醒** - 影片即將結束時通過通知和聲音提醒

### 控制面板
- 直觀的控制面板，可以開關各項功能
- 可拖動位置，可展開/收起
- 顯示當前影片信息與播放進度
- 記錄上次完成的影片

## 截圖

![Screenshot](/img/yakitory-helper.png)

## 安裝方法

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器擴展
2. 點擊下方安裝連結，或從 [GreasyFork 頁面](https://greasyfork.org/zh-TW/scripts/腳本ID) 安裝
3. 確認安裝並刷新 iLearn 頁面

[![安裝脚本](https://img.shields.io/badge/安裝腳本-增強版_YAKITORY_控制面板-blue)](https://raw.githubusercontent.com/poterpan/tampermonkey-scripts/main/yakitory-helper/yakitory-helper.user.js)

## 使用說明

### 基本功能
腳本安裝後會自動運行，默認開啟「自動點擊確認」功能，其他功能需手動開啟：

1. **自動點擊確認** - 默認開啟，自動回應「您還在觀看嗎?」提示
2. **自動播放下一步** - 需手動開啟，會在影片結束時自動跳到下一個影片並開始播放
3. **自動靜音** - 需手動開啟，自動將影片設為靜音狀態
4. **結束通知聲音** - 默認開啟，影片接近結束時播放提示音

### 控制面板操作
- 點擊控制面板右上角的 "_" 可以收起面板，只顯示一個小圖標
- 面板可以拖動到屏幕任意位置
- 「測試自動播放」按鈕可以手動觸發自動播放功能
- 控制面板顯示當前影片標題和進度
- 控制面板顯示上一個完成的影片和時間

## 兼容性

- **瀏覽器**: Chrome, Edge, Firefox (需安裝 Tampermonkey)
- **系統**: Windows, macOS, Linux
- **目標網站**: ilearn.fcu.edu.tw (逢甲大學 iLearn 平台)

## 自定義

您可以編輯腳本修改以下設定：

```javascript
// 設定檢查間隔（毫秒）
const checkInterval = 2000; // 每2秒檢查一次

// 影片接近結束的閾值（百分比）
const endThreshold = 95; // 當影片播放進度達到95%時發出通知

// 影片完全結束的閾值（百分比）
const completeThreshold = 99; // 當影片播放進度達到99%時視為已完成

// 通知聲音URL (公開可訪問的音效文件)
const notificationSound = 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_a29a673ef4.mp3?filename=decidemp3-14575.mp3';
```

## 常見問題

**Q: 為什麼自動播放下一步有時不起作用？**  
A: 確保影片正常播放到最後。如果影片頁面結構有變化，可能需要更新腳本。

**Q: 影片結束後沒有收到通知聲音？**  
A: 確保瀏覽器允許網站播放聲音，且系統音量已開啟。

**Q: 如何完全關閉腳本？**  
A: 在 Tampermonkey 擴展中禁用此腳本即可。

## 更新日誌

### 版本 2.2 (2025-03-21)
- 增加了自動靜音功能與開關
- 修復了自動下一步功能的錯誤
- 優化了DOM觀察器
- 改進了自動播放邏輯

### 版本 2.1 (2025-03-21)
- 添加自動播放功能
- 增加測試按鈕
- 改進跳轉邏輯

### 版本 2.0 (2025-03-21)
- 首次發布
- 添加控制面板
- 實現自動確認、自動下一步、結束通知功能

## 貢獻和回報問題

歡迎提交 Issues 或 Pull Requests 來改進此腳本。

## 授權

此腳本採用 [MIT 授權](LICENSE)。

---

如有問題或建議，請在 [GitHub Issues](https://github.com/poterpan/tampermonkey-scripts/issues) 提出。
