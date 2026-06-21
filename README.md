# 打水接力賽

手機優先的三隊點擊遊戲。隊員人數不限，所有人以一群卡通隊員聚集在取水起點並輪流雙桶接力；每提滿一桶，就由一位隊員沈甸甸地提著兩桶水前往灌溉，倒水後折返，下一位同步起跑。水花會灑在終點五位卡通小人身上，小人依澆水比例平滑長大；最先全部長大的隊伍獲勝。

## 立即遊玩

- **[開啟遊戲主控台](https://jesuswaytaipeisrv.github.io/bucket/?view=host)**

主持人開啟連結後會自動產生六碼房間，網址與 QR Code 都會帶入該房間碼。玩家應掃描主持台 QR Code 加入；正式多人活動須確認頁面頂端顯示「即時多人模式」。

## 目前狀態

- 已完成可操作的單頁遊戲：不限人數加入、主持人自動三隊分配、起點群眾、雙桶去回接力、終點小人成長、倒數、點擊、勝負與重設。
- 主持頁採左側控制面板與右側三隊共用的水平沙地灌溉賽場；所有設定、QR Code 與玩家名單都在左側，隊員從右側取水起點往左側終點灌溉。玩家加入後僅顯示隊伍狀態與打水按鈕，不載入比賽賽場。
- 已啟用 Firebase Realtime Database 與匿名登入，可讓多支手機加入同一房間即時比賽；不同主持人自動產生的房間碼可同時進行且互不干擾。
- 公開 GitHub Pages 已確認可用版本為 `app.js?v=20260621-6`；本機最新的水平沙地賽場版本為 `app.js?v=20260621-7`，待同步至 GitHub 後才會出現在公開網址。
- Firebase 連線失敗時，程式會退回 `localStorage` 與 `BroadcastChannel` 的同一瀏覽器示範模式。

## 文件

- [使用說明](USER_GUIDE.md)
- [開發紀錄](DEVELOPMENT_LOG.md)
- [Firebase 設定範例](firebase-config.example.js)

## 快速開始

```sh
cd /Users/garyhuang/Documents/Codex/2026-06-19/new-chat/water-splash-race
python3 -m http.server 5175
```

開啟主持台：`http://127.0.0.1:5175/?view=host`。

主持頁會自動改成帶有房間碼的網址；同一台裝置示範時，可將該網址的 `room` 複製到 `?view=play&room=房間碼`。正式多人活動請先依 [使用說明](USER_GUIDE.md) 設定 Firebase，並使用公開 HTTPS 網址。

## 專案結構

- `index.html`：遊戲畫面與可及性標記
- `styles.css`：手機優先的遊戲介面與動畫
- `app.js`：狀態同步、點擊、倒水計算與主持控制
- `firebase-config.js`：Firebase Web 公開設定，供 GitHub Pages 前端連線使用
- `firebase-database.rules.json`：Realtime Database 規則範本

## 成本與安全

- 此專案的前端與 GitHub Pages 可免費使用；Firebase Realtime Database 有免費額度，超量或升級為 Blaze 方案才可能產生費用。活動前請至 Firebase Console 查看目前方案與用量，避免以為完全無上限。
- Firebase Web 設定不是私密金鑰；不要提交服務帳戶 JSON、`.env` 或任何後端金鑰。
- 目前規則範本適合短期現場活動，不是嚴格的帳號權限模型。公開活動應使用較難猜測的房間碼，並在活動後於 Firebase Console 清除該房間資料。
