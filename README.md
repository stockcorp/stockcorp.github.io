# stockcorp.github.io 遊戲站

純前端（HTML + CSS + JavaScript）遊戲，部署在 GitHub Pages，main 分支推送後約 1 分鐘自動更新。

| 編號 | 遊戲 | 網址 | 資料夾 |
|---|---|---|---|
| 01 | 我愛操盤手 | https://stockcorp.github.io/ | 根目錄（`index.html`、`js/`、`style.css`） |
| 02 | 搶救AI教父大作戰 | https://stockcorp.github.io/ai/ | `ai/` |
| 03 | 暗棋破壞神 | https://stockcorp.github.io/darkchess/ | `darkchess/` |

本機備份：`Z:\程式開發專案\00.web\02.stockcorp.github.io(原stockcorp.tw)\<編號.遊戲名>\AI_Claude_Opus5.5\版本X.Y`

## 共用檔案 `shared/`

- `shared/app.js`：每頁 `<head>` 同步載入。偵測是否在 App（WebView 套殼）內，網頁版載入 Google AdSense（`ca-pub-3440199491716602`），App 內不載入（App 請用 AdMob）。
- `shared/games.js`：遊戲切換列。寬螢幕左右兩側顯示上一款／下一款，窄螢幕在頁面頂端。**新增遊戲只要在 `GAMES` 陣列加一筆**，所有頁面自動更新。App 內不顯示。

## App 套殼（Android／iOS WebView）

讓網頁知道自己在 App 裡，任一即可：

1. 開啟網址加上 `?app=1`（例如 `https://stockcorp.github.io/darkchess/?app=1`），會記住；`?app=0` 取消。
2. WebView 的 User-Agent 加上 `StockcorpApp/1.0`。
3. 使用原生橋接：React Native WebView、Capacitor、cordova、flutter_inappwebview、iOS `webkit.messageHandlers.stockcorp`、Android `window.StockcorpAndroid`。

App 內會：不載入 AdSense、隱藏遊戲切換列與說明區、套用瀏海與底部安全區、停用長按選單。

原生端可以呼叫：

- `window.SC.back()`：處理返回鍵，回傳 `true` 表示網頁已處理（關閉視窗、暫停遊戲），`false` 時 App 可以自行關閉。
- `window.SC.pause()`／`window.SC.resume()`：App 切到背景時呼叫（網頁也會自動偵測 visibilitychange）。

網頁會用 `SC.post(type, data)` 通知原生端，例如 `ready`、`gamestart`、`gameover`、`levelclear`，原生端可用來插入 AdMob 插頁廣告。

## 各遊戲版本

- 01 我愛操盤手 v1.1：加入遊戲切換列與共用 App 設定。
- 02 搶救AI教父大作戰 v1.1：搬到 `/ai/`，加入 AdSense、App 返回鍵與背景暫停。
- 03 暗棋破壞神 v1.0：台灣暗棋規則，電腦四種難度（簡單、普通、困難、大師）、先後手、車直衝選項、悔棋與提示、戰績、手機直向自動轉棋盤、對局自動存檔。
