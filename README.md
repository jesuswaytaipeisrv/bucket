# 打水接力賽

手機優先的三隊點擊遊戲。隊員人數不限，所有人以一群卡通隊員聚集在取水起點並輪流雙桶接力；每提滿一桶，就由一位隊員沈甸甸地提著兩桶水前往灌溉，倒水後折返，下一位同步起跑。水花會灑在終點五位卡通小人身上，小人依澆水比例平滑長大；最先全部長大的隊伍獲勝。

## 線上遊戲

- [開啟主持台](https://jesuswaytaipeisrv.github.io/bucket/?view=host&room=WATER2026)
- [開啟玩家頁](https://jesuswaytaipeisrv.github.io/bucket/?view=play&room=WATER2026)

兩個連結使用同一個預設房間 `WATER2026`。正式多人活動須完成 Firebase 設定，並確認頁面頂端顯示「即時多人模式」。

## 目前狀態

- 已完成可操作的單頁遊戲：不限人數加入、主持人自動三隊分配、起點群眾、雙桶去回接力、終點小人成長、倒數、點擊、勝負與重設。
- 未設定 Firebase 時，使用 `localStorage` 與 `BroadcastChannel` 作同一瀏覽器示範。
- 設定 Firebase Realtime Database 後，可讓多支手機加入同一房間即時比賽。

## 文件

- [使用說明](USER_GUIDE.md)
- [開發紀錄](DEVELOPMENT_LOG.md)
- [Firebase 設定範例](firebase-config.example.js)

## 快速開始

```sh
cd /Users/garyhuang/Documents/Codex/2026-06-19/new-chat/water-splash-race
python3 -m http.server 5175
```

開啟主持台：`http://127.0.0.1:5175/?view=host&room=WATER2026`。

同一台裝置示範時，可另開 `?view=play&room=WATER2026`。正式多人活動請先依 [使用說明](USER_GUIDE.md) 設定 Firebase，並使用公開 HTTPS 網址。

## 專案結構

- `index.html`：遊戲畫面與可及性標記
- `styles.css`：手機優先的遊戲介面與動畫
- `app.js`：狀態同步、點擊、倒水計算與主持控制
- `firebase-config.js`：本機 Firebase Web 設定，預設不啟用
- `firebase-database.rules.json`：Realtime Database 規則範本

## 成本與安全

- 此專案的前端與 GitHub Pages 可免費使用；Firebase Realtime Database 有免費額度，超量或升級為 Blaze 方案才可能產生費用。活動前請至 Firebase Console 查看目前方案與用量，避免以為完全無上限。
- Firebase Web 設定不是私密金鑰；不要提交服務帳戶 JSON、`.env` 或任何後端金鑰。
- 目前規則範本適合短期現場活動，不是嚴格的帳號權限模型。公開活動應使用較難猜測的房間碼，並在活動後於 Firebase Console 清除該房間資料。
