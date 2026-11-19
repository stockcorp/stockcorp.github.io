# stockcorp.github.io 遊戲站

純前端（HTML + CSS + JavaScript）遊戲，部署在 GitHub Pages，main 分支推送後約 1 分鐘自動更新。

| 編號 | 遊戲 | 網址 | 資料夾 |
|---|---|---|---|
| 00 | 遊戲大廳（平台首頁，RWD） | https://stockcorp.github.io/ | 根目錄 `index.html`（卡片清單自動讀 `shared/games.js`） |
| 01 | 我愛操盤手 | https://stockcorp.github.io/trader/ | `trader/`（2026-11-19 從根目錄搬過來） |
| 02 | 搶救AI教父大作戰 | https://stockcorp.github.io/ai/ | `ai/` |
| 03 | 暗棋破壞神 | https://stockcorp.github.io/darkchess/ | `darkchess/` |
| 04 | 象棋 | https://stockcorp.github.io/xiangqi/ | `xiangqi/` |

本機備份：`Z:\程式開發專案\00.web\02.stockcorp.github.io(原stockcorp.tw)\<編號.遊戲名>\AI_Claude_Opus5.5\版本X.Y`

## 共用檔案 `shared/`

- `shared/app.js`：每頁 `<head>` 同步載入。偵測是否在 App（WebView 套殼）內，網頁版載入 Google AdSense（`ca-pub-3440199491716602`），App 內不載入（App 請用 AdMob）。
- `shared/games.js`：遊戲切換列。寬螢幕左右兩側顯示上一款／下一款，窄螢幕在頁面頂端。**新增遊戲只要在 `GAMES` 陣列加一筆**，所有頁面自動更新。App 內不顯示。
- `shared/lb.js`：全球排行榜前端。後端 API 在 Linode `https://game.ldigi.com.tw/api/score.php`（原始碼與 SQL 不放在這個公開倉儲，備份在 Z 槽 `00.遊戲大廳(Lobby)\排行榜Linode後端`）。開局 `SCLB.start(game, mode)` 取憑證，結算 `SCLB.offer({...})` 跳出上傳視窗。排行榜頁在 `/leaderboard/`。
- `shared/net.js`：線上玩家對戰（WebRTC 點對點，用 PeerJS 公用伺服器配對，房號 6 碼，也可用 `?room=房號` 連結直接加入）。**隨機配對**：20 個公開座位 ID（`stockcorp-<遊戲>-r1`～`r20`），按下後先探測座位，有人在等就連過去，沒人就自己坐一個位子等；等待人數＝探測到有人在等的座位數（估算值）。房主負責驗證每一步；暗棋的蓋牌只有房主知道。PeerJS 函式庫放在 `shared/vendor/`，不依賴外部 CDN。
- 中英切換：所有遊戲共用語言設定（`SC.lang`、`SC.setLang()`），網址加 `?lang=en` 或 `?lang=zh` 可指定語言。HTML 元素加 `data-en="英文"` 會自動替換，按鈕加 `data-lang-toggle` 就是切換鈕。

## sitemap.xml 自動更新

`sitemap.xml` 由 `tools/build-sitemap.js` 依 `shared/games.js` 產生（每款遊戲與隱私權頁，含中英 hreflang）。推送後 GitHub Actions（`.github/workflows/sitemap.yml`）會自動重新產生並提交；也可以手動執行 `node tools/build-sitemap.js`。新增遊戲時只要把資料夾放好、在 `GAMES` 加一筆即可。

各遊戲的雙語隱私權頁由 `python3 tools/privacy.py` 產生。

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

- 2026-11-19：全球排行榜上線（操盤手淨資產、AI教父各關最快通關、暗棋／象棋各難度最快擊敗電腦）；遊戲切換列的「🏠 遊戲大廳」改成金色醒目按鈕，寬螢幕右側加「🏆 排行榜」。

- 00 遊戲大廳 v1.0（2026-11-19）：平台首頁，手機兩欄、平板／電腦自動多欄；App 內不載入 AdSense。遊戲切換列加上「🏠 遊戲大廳」。
- 03 暗棋破壞神 v1.2、04 象棋 v1.1：線上對戰新增隨機配對與等待人數估算。

- 01 我愛操盤手 v1.2：與全站共用語言設定。
- 02 搶救AI教父大作戰 v1.2：中英雙語（畫面上、暫停選單都能切換）。
- 03 暗棋破壞神 v1.1：中英雙語、線上玩家對戰（房號／連結、表情、再來一局）。
- 04 象棋 v1.0：完整規則（王見王、拐馬腳、塞象眼、炮翻山、將死與困斃），電腦四種難度、悔棋、提示、執紅或執黑、中英雙語、線上玩家對戰。

- 01 我愛操盤手 v1.1：加入遊戲切換列與共用 App 設定。
- 02 搶救AI教父大作戰 v1.1：搬到 `/ai/`，加入 AdSense、App 返回鍵與背景暫停。
- 03 暗棋破壞神 v1.0：台灣暗棋規則，電腦四種難度（簡單、普通、困難、大師）、先後手、車直衝選項、悔棋與提示、戰績、手機直向自動轉棋盤、對局自動存檔。

## 2026-11-19 新增 6 款遊戲與分類
- 05 王者大老二 `/bigtwo/`、06 麻將大亨 `/mahjong/`、07 2048 `/2048/`、08 金幣大亨 `/coin/`、09 極速賽車 `/racing/`、10 數獨 `/sudoku/`
- 大廳分類：全部／棋牌／益智／動作／競速／模擬經營（`shared/games.js` 的 `cat` 與 `SC_CATS`，網址 `?cat=puzzle`）
- 新遊戲共用 `shared/kit.css`、`shared/kit.js`（標題列、彈窗、提示、音效、存檔）
- 全部接上 Linode 排行榜（`shared/lb.js`），後端 `score.php` 的 GAMES 需同步更新
- 王者大老二、麻將大亨加入線上對戰（`shared/net.js` v1.6 支援最多 4 人房間 `max: 4`）：房主電腦是裁判，空位由電腦補；真人 45／40 秒沒動作自動代打；線上對局不列入排行榜

## 2026-11-20 新增 5 款遊戲（11–15）
- 11 方塊疊疊樂 `/stack/`（12×22 井、3／4／5 格混合 10 種果凍方塊；刻意不用 Tetris 名稱與外觀）
- 12 方塊爆破 `/blast/`（8×8 拖放）、13 麻將連連看 `/link/`（四川省規則）、14 五子棋 `/gomoku/`（含線上對戰）、15 貪吃蛇 `/snake/`
- 後端 `score.php` 的 GAMES 已加入 stack、blast、link、gomoku、snake
