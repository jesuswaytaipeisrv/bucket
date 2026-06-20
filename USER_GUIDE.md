# 使用說明

## 遊戲規則

1. 玩家只輸入名字加入等待名單，不自行選隊。
2. 主持人按「自動分隊」，系統會依加入順序平均分配到晨露隊、河浪隊與嫩芽隊，隊員人數不限。
3. 每次點擊會增加隊伍的一單位水量；所有隊員顯示在取水起點，等待輪流雙桶接力。
4. 提滿主持人設定的打水次數，就完成一桶水。系統會讓一位隊員雙手各提一桶前往終點灌溉，倒水後折返；下一位在灌溉完成時同步從起點出發。
5. 每位小人累積主持人設定的淋水次數後會長成正常大小。
6. 最先讓五位小人全部長大的隊伍獲勝。

## 主持流程

1. 用主持網址開啟：`?view=host&room=WATER2026`。
2. 依活動需求調整「提滿一桶」的打水次數、「每人長大」所需淋水次數與倒數秒數。
3. 把玩家網址 `?view=play&room=WATER2026` 做成 QR code 或傳給參賽者。
4. 參賽者全部加入後，按「自動分隊」，確認所有人已分配到三隊；人數不受每隊五人限制。
5. 按「開始倒數」。
5. 比賽結束後，按「下一輪」建立乾淨的新回合。

## 本機測試

```sh
cd /Users/garyhuang/Documents/Codex/2026-06-19/new-chat/water-splash-race
python3 -m http.server 5175
```

瀏覽 `http://127.0.0.1:5175/?view=host&room=WATER2026`。未設定 Firebase 的示範模式只會同步同一瀏覽器與相同網域下的分頁，不能作為多手機活動測試。

## Firebase 多手機設定

1. 在 Firebase 專案新增 Web App，啟用 Realtime Database，並在 Authentication 的「登入方式」啟用「匿名」。
2. 以 Firebase Console 產生的 Web 設定填入 `firebase-config.js`。只填設定物件，不能把 Console 顯示的 npm 範例程式整段貼入。
3. 在 Realtime Database 的 Rules 頁貼上 `firebase-database.rules.json` 內容並發布。
4. 將本專案部署到 GitHub Pages、Zeabur 靜態網站或其他 HTTPS 網址。
5. 用部署後的網址開啟主持與玩家頁，確認頂端顯示「即時多人模式」。

## Firebase 規則與活動風險

規則範本需要匿名登入。程式會匿名登入後才連線資料庫，能避免未登入的直接讀寫，但不會阻止已加入者偽造更多點擊或重設資料。此限制對輕量現場遊戲可接受；若獎品或公平性要求高，應新增後端驗證或受控主持人 API。

Firebase 可能依讀寫量計費。小型短時活動通常可落在免費額度內，但沒有保證；先確認目前 Firebase 方案與預算警示。

## 結束活動

在 Firebase Console 刪除 `water-splash-race/rooms/<房間碼>`，或直接刪除整個 `water-splash-race` 節點。不要將服務帳戶檔案或後端金鑰放進本專案。
