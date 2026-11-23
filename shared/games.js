/* stockcorp.github.io 共用：遊戲切換列
   新增遊戲時只要在 GAMES 加一筆，所有遊戲頁面的左右切換就會自動更新；
   之後執行 node tools/build-sitemap.js（或推送後由 GitHub Actions 自動執行）就會更新 sitemap.xml。
   用法：<script src="/shared/games.js" data-game="遊戲 id" defer></script>
   寬螢幕：左右兩側固定「上一款／下一款」；窄螢幕：頁面最上方一條切換列。大廳 App 內照常顯示；單一遊戲的舊套殼（SC_APP_NAV === false）不顯示。 */
(function () {
  'use strict';
  // cat：board 棋牌、puzzle 益智、action 動作、racing 競速、sim 模擬經營（可多個）
  var GAMES = [
    { id: 'trader', no: '01', url: '/trader/', icon: '📈', color: '#ef4444', cat: ['sim'], zh: '我愛操盤手', en: 'I Love Trading', dzh: '用真實股價與加密貨幣模擬投資 10 年', den: 'Trade real stocks and crypto over 10 years' },
    { id: 'ai', no: '02', url: '/ai/', icon: '🤖', color: '#f5b83d', cat: ['action'], zh: '搶救AI教父大作戰', en: 'Save the AI Godfather', dzh: '六關橫向闖關，打倒董事會機器人', den: 'Six-stage platformer with a boss fight' },
    { id: 'darkchess', no: '03', url: '/darkchess/', icon: '帥', color: '#c0392b', cat: ['board'], zh: '暗棋破壞神', en: 'Dark Chess Destroyer', dzh: '翻棋對決電腦，或線上隨機配對真人', den: 'Dark chess vs. AI, or a random opponent online' },
    { id: 'xiangqi', no: '04', url: '/xiangqi/', icon: '將', color: '#16181d', fg: '#16181d', cat: ['board'], zh: '象棋', en: 'Xiangqi', dzh: '楚河漢界，對戰電腦或線上隨機配對', den: 'Chinese chess vs. AI, or a random opponent online' },
    { id: 'bigtwo', no: '05', url: '/bigtwo/', icon: '🃏', color: '#7c3aed', cat: ['board'], zh: '王者大老二', en: 'Big Two King', dzh: '台灣規則大老二，對戰電腦或線上真人', den: 'Taiwanese Big Two vs. AI or real players online' },
    { id: 'mahjong', no: '06', url: '/mahjong/', icon: '🀄', color: '#0f766e', cat: ['board'], zh: '麻將大亨', en: 'Mahjong Tycoon', dzh: '台灣十六張麻將，對戰電腦或線上真人', den: 'Taiwanese 16-tile mahjong vs. AI or players online' },
    { id: '2048', no: '07', url: '/2048/', icon: '🔢', color: '#edc22e', cat: ['puzzle'], zh: '2048', en: '2048', dzh: '滑動合併數字，挑戰 2048 以上', den: 'Slide and merge tiles to reach 2048' },
    { id: 'coin', no: '08', url: '/coin/', icon: '💰', color: '#d97706', cat: ['sim'], zh: '金幣大亨', en: 'Coin Tycoon', dzh: '10 分鐘急速經營，看誰賺最多', den: '10-minute idle business race' },
    { id: 'racing', no: '09', url: '/racing/', icon: '🏎️', color: '#2563eb', cat: ['racing', 'action'], zh: '極速賽車', en: 'Turbo Racer', dzh: '高速公路閃車、吃金幣、開氮氣', den: 'Dodge traffic, grab coins, hit the nitro' },
    { id: 'sudoku', no: '10', url: '/sudoku/', icon: '🧩', color: '#0891b2', cat: ['puzzle'], zh: '數獨', en: 'Sudoku', dzh: '三種難度，筆記模式，比誰解得快', den: 'Three levels, pencil marks, beat the clock' },
    { id: 'stack', no: '11', url: '/stack/', icon: '🧱', color: '#db2777', cat: ['puzzle', 'action'], zh: '方塊疊疊樂', en: 'Block Stacker', dzh: '落下的方塊排滿一行就消除，越疊越快', den: 'Fill rows with falling blocks as the pace speeds up' },
    { id: 'blast', no: '12', url: '/blast/', icon: '💥', color: '#ea580c', cat: ['puzzle'], zh: '方塊爆破', en: 'Block Blast', dzh: '把方塊拖進 8×8，排滿就爆破，慢慢想不趕時間', den: 'Drag pieces into an 8×8 grid and clear lines' },
    { id: 'link', no: '13', url: '/link/', icon: '🀄', color: '#16a34a', cat: ['puzzle', 'board'], zh: '麻將連連看', en: 'Mahjong Link', dzh: '找出能連線的兩張相同牌，清空整個盤面', den: 'Connect matching tiles and clear the board' },
    { id: 'gomoku', no: '14', url: '/gomoku/', icon: '⚫', color: '#a16207', fg: '#a16207', cat: ['board'], zh: '五子棋', en: 'Gomoku', dzh: '先連成五子就贏，對戰電腦或線上真人', den: 'Five in a row vs. AI or real players online' },
    { id: 'snake', no: '15', url: '/snake/', icon: '🐍', color: '#65a30d', cat: ['action'], zh: '貪吃蛇', en: 'Snake', dzh: '經典貪吃蛇，吃越多越長也越快', den: 'Classic snake — eat, grow and speed up' },
    { id: 'go', no: '16', url: '/go/', icon: '⚪', color: '#334155', fg: '#334155', cat: ['board'], zh: '圍棋', en: 'Go', dzh: '9／13／19 路，對戰電腦或線上真人', den: '9×9 to 19×19 vs. AI or real players online' },
    { id: 'mines', no: '17', url: '/mines/', icon: '💣', color: '#475569', fg: '#475569', cat: ['puzzle'], zh: '踩地雷', en: 'Minesweeper', dzh: '初級／中級／高級，比誰掃得快', den: 'Three sizes — clear the field fastest' },
    { id: 'reversi', no: '18', url: '/reversi/', icon: '⚫', color: '#15803d', cat: ['board'], zh: '黑白棋', en: 'Reversi', dzh: '夾住就翻面，對戰電腦或線上真人', den: 'Flip discs vs. AI or real players online' },
    { id: 'klondike', no: '19', url: '/klondike/', icon: '🃏', color: '#047857', cat: ['board', 'puzzle'], zh: '新接龍', en: 'Solitaire', dzh: '經典接龍，翻一張／翻三張', den: 'Classic Klondike, draw one or three' },
    { id: 'breakout', no: '20', url: '/breakout/', icon: '🧱', color: '#ea580c', cat: ['action'], zh: '打磚塊', en: 'Brick Breaker', dzh: '彈球打碎磚塊，道具多球加長板', den: 'Smash bricks with power-ups' },
    { id: 'bubble', no: '21', url: '/bubble/', icon: '🫧', color: '#7c3aed', cat: ['puzzle', 'action'], zh: '泡泡射擊', en: 'Bubble Shooter', dzh: '瞄準發射，三顆同色就消除', den: 'Aim, shoot and pop three of a colour' },
    { id: 'jewel', no: '22', url: '/jewel/', icon: '💎', color: '#db2777', cat: ['puzzle'], zh: '寶石消消樂', en: 'Jewel Match', dzh: '兩分鐘三消挑戰，炸彈彩虹寶石', den: 'Two-minute match-3 with bombs and rainbows' },
    { id: 'connect4', no: '23', url: '/connect4/', icon: '🔴', color: '#1d4ed8', cat: ['board'], zh: '四子棋', en: 'Connect Four', dzh: '先連四顆就贏，對戰電腦或線上真人', den: 'Four in a row vs. AI or real players online' },
    { id: 'mole', no: '24', url: '/mole/', icon: '🔨', color: '#a16207', cat: ['action'], zh: '打地鼠', en: 'Whack-a-Mole', dzh: '60 秒反應力挑戰', den: '60-second reaction challenge' },
    { id: 'shooter', no: '25', url: '/shooter/', icon: '🚀', color: '#0891b2', cat: ['action'], zh: '太空射擊', en: 'Space Shooter', dzh: '自動開火打下一波波敵機與魔王', den: 'Blast waves of enemies and bosses' },
    { id: 'bird', no: '26', url: '/bird/', icon: '🐦', color: '#16a34a', cat: ['action'], zh: '飛飛鳥', en: 'Hop Bird', dzh: '點一下就飛，穿過竹林空隙', den: 'One tap to fly through the bamboo' },
    { id: 'chess', no: '27', url: '/chess/', icon: '♞', color: '#92400e', cat: ['board'], zh: '西洋棋', en: 'Chess', dzh: '完整國際規則，對戰電腦或線上真人', den: 'Full rules vs. AI or real players online' },
    { id: 'cchk', no: '28', url: '/cchk/', icon: '🔴', color: '#b91c1c', cat: ['board'], zh: '中國跳棋', en: 'Chinese Checkers', dzh: '連跳過河，對戰電腦或線上真人', den: 'Hop across the star vs. AI or online' },
    { id: 'uttt', no: '29', url: '/uttt/', icon: '⭕', color: '#4f46e5', cat: ['board', 'puzzle'], zh: '超級井字棋', en: 'Ultimate Tic-Tac-Toe', dzh: '井字棋裡的井字棋，可線上對戰', den: 'Tic-tac-toe inside tic-tac-toe, online too' },
    { id: 'spider', no: '30', url: '/spider/', icon: '🕷️', color: '#15803d', cat: ['board', 'puzzle'], zh: '蜘蛛紙牌', en: 'Spider Solitaire', dzh: '單色／雙色／四色蜘蛛接龍', den: 'Spider with one, two or four suits' },
    { id: 'hearts', no: '31', url: '/hearts/', icon: '♥️', color: '#be123c', cat: ['board'], zh: '紅心大戰', en: 'Hearts', dzh: '經典吃墩牌戲，分數越少越好', den: 'Classic trick-taking — low score wins' },
    { id: 'pickred', no: '32', url: '/pickred/', icon: '🀄', color: '#dc2626', cat: ['board'], zh: '撿紅點', en: 'Chinese Ten', dzh: '湊十吃牌，台灣過年經典', den: 'Make tens to capture red cards' },
    { id: 'blackjack', no: '33', url: '/blackjack/', icon: '🂡', color: '#166534', cat: ['board'], zh: '21點', en: 'Blackjack', dzh: '虛擬籌碼和莊家比 21 點', den: 'Beat the dealer with virtual chips' },
    { id: 'ab', no: '34', url: '/ab/', icon: '🔢', color: '#0e7490', cat: ['puzzle'], zh: '猜數字 1A2B', en: '1A2B Guessing', dzh: '幾A幾B推理出四位數', den: 'Bulls and cows number logic' },
    { id: 'wordle', no: '35', url: '/wordle/', icon: '🟩', color: '#16a34a', cat: ['puzzle'], zh: '猜單字', en: 'Word Guess', dzh: '六次猜出五個字母的英文單字', den: 'Guess the five-letter word in six' },
    { id: 'nonogram', no: '36', url: '/nonogram/', icon: '🧩', color: '#7c3aed', cat: ['puzzle'], zh: '數織', en: 'Nonogram', dzh: '看數字提示塗格子的邏輯題', den: 'Picross logic picture puzzles' },
    { id: 'sokoban', no: '37', url: '/sokoban/', icon: '📦', color: '#b45309', cat: ['puzzle'], zh: '推箱子', en: 'Sokoban', dzh: '30 關推箱子，只能推不能拉', den: '30 box-pushing levels' },
    { id: 'oneline', no: '38', url: '/oneline/', icon: '✏️', color: '#0891b2', cat: ['puzzle'], zh: '一筆畫', en: 'One Line', dzh: '一筆走完所有格子，3 分鐘挑戰', den: 'One stroke through every square' },
    { id: 'pipes', no: '39', url: '/pipes/', icon: '🚰', color: '#0284c7', cat: ['puzzle'], zh: '接水管', en: 'Pipe Connect', dzh: '轉動水管讓水流遍每一格', den: 'Rotate pipes to connect the water' },
    { id: 'slide', no: '40', url: '/slide/', icon: '🔢', color: '#ea580c', cat: ['puzzle'], zh: '數字華容道', en: 'Sliding Puzzle', dzh: '把數字方塊依序推回原位', den: 'Classic 15 sliding puzzle' },
    { id: 'popstar', no: '41', url: '/popstar/', icon: '⭐', color: '#e11d48', cat: ['puzzle'], zh: '消滅星星', en: 'Pop Star', dzh: '點同色方塊消除，一次越多越高分', den: 'Tap to pop groups of colour' },
    { id: 'merge', no: '42', url: '/merge/', icon: '🍉', color: '#16a34a', cat: ['puzzle', 'action'], zh: '水果合成', en: 'Fruit Merge', dzh: '一樣的水果碰在一起就合成', den: 'Drop and merge fruit up to a melon' },
    { id: 'miner', no: '43', url: '/miner/', icon: '⛏️', color: '#ca8a04', cat: ['action'], zh: '黃金礦工', en: 'Gold Miner', dzh: '看準時機放鉤抓金塊鑽石', den: 'Time the claw to grab gold' },
    { id: 'jump', no: '44', url: '/jump/', icon: '🦘', color: '#6366f1', cat: ['action'], zh: '跳一跳', en: 'Jump Jump', dzh: '按住蓄力，放開跳上平台', den: 'Hold, release, land on the block' },
    { id: 'tiles', no: '45', url: '/tiles/', icon: '🎹', color: '#111827', fg: '#94a3b8', cat: ['action'], zh: '別踩白塊', en: 'Piano Tiles', dzh: '只點黑塊，50 塊比速度', den: 'Tap only the black tiles — fast' },
    { id: 'runner', no: '46', url: '/runner/', icon: '🦖', color: '#ea580c', cat: ['action'], zh: '恐龍跑酷', en: 'Dino Dash', dzh: '跳過仙人掌、蹲下躲飛鳥', den: 'Jump cacti and duck the birds' },
    { id: 'tank', no: '47', url: '/tank/', icon: '🪖', color: '#4d7c0f', cat: ['action'], zh: '坦克大戰', en: 'Tank Battle', dzh: '守住基地、擊毀所有敵軍坦克', den: 'Defend your base from enemy tanks' },
    { id: 'blob', no: '48', url: '/blob/', icon: '🔵', color: '#0d9488', cat: ['action'], zh: '吞噬球球', en: 'Blob Eater', dzh: '大球吃小球，越吃越大', den: 'Eat smaller blobs and grow' },
    { id: 'hockey', no: '49', url: '/hockey/', icon: '🏒', color: '#dc2626', cat: ['action'], zh: '空氣曲棍球', en: 'Air Hockey', dzh: '把冰球撞進對方球門', den: 'Slam the puck past the computer' },
    { id: 'memory', no: '50', url: '/memory/', icon: '🃏', color: '#0ea5e9', cat: ['puzzle'], zh: '記憶翻牌', en: 'Memory Match', dzh: '翻牌配對，考驗記憶力', den: 'Flip cards and find the pairs' },
    { id: 'highway', no: '51', url: '/highway/', icon: '🏎️', color: '#f97316', cat: ['racing'], zh: '極速公路', en: 'Highway Rush', dzh: '偽 3D 公路狂飆，閃車流衝檢查點', den: 'Pseudo-3D highway racing through traffic' },
    { id: 'circuit', no: '52', url: '/circuit/', icon: '🏁', color: '#ef4444', cat: ['racing'], zh: '甩尾賽車場', en: 'Drift Circuit', dzh: '俯視賽道甩尾過彎，三條賽道', den: 'Top-down drift racing on three tracks' },
    { id: 'drag', no: '53', url: '/drag/', icon: '🚦', color: '#eab308', cat: ['racing'], zh: '直線加速賽', en: 'Drag Race', dzh: '抓起跑、抓換檔，四分之一英里對決', den: 'Nail the launch and shifts over a quarter mile' },
    { id: 'hill', no: '54', url: '/hill/', icon: '🚙', color: '#84cc16', cat: ['racing'], zh: '登山越野車', en: 'Hill Climber', dzh: '物理越野車，顧油量別翻車', den: 'Physics hill climbing — watch your fuel' },
    { id: 'slot', no: '55', url: '/slot/', icon: '🛞', color: '#f43f5e', cat: ['racing'], zh: '軌道賽車', en: 'Slot Racer', dzh: '一鍵軌道車，過彎太快會飛出去', den: 'One-button slot cars — too fast and you fly off' },
    { id: 'ski', no: '56', url: '/ski/', icon: '⛷️', color: '#0ea5e9', cat: ['racing'], zh: '滑雪競速', en: 'Ski Racer', dzh: '高山曲道滑雪，穿旗門衝終點', den: 'Downhill slalom through the gates' },
    { id: 'tunnel', no: '57', url: '/tunnel/', icon: '🚀', color: '#a855f7', cat: ['racing'], zh: '太空隧道', en: 'Space Tunnel', dzh: '3D 霓虹隧道高速閃避', den: 'Dodge panels in a 3D neon tunnel' },
    { id: 'derby', no: '58', url: '/derby/', icon: '🏇', color: '#16a34a', cat: ['racing'], zh: '賽馬', en: 'Derby Day', dzh: '配速、超車、最後直線衝刺', den: 'Pace yourself, overtake and sprint home' },
    { id: 'taxi', no: '59', url: '/taxi/', icon: '🚕', color: '#f59e0b', cat: ['racing'], zh: '計程車衝衝衝', en: 'Taxi Rush', dzh: '開放城市接客送客，3 分鐘賺最多', den: 'Open-city fares against a 3-minute clock' },
    { id: 'parking', no: '60', url: '/parking/', icon: '🅿️', color: '#3b82f6', cat: ['racing'], zh: '停車大師', en: 'Parking Master', dzh: '20 關真實手感的停車挑戰', den: '20 levels of realistic parking' },
    { id: 'boba', no: '61', url: '/boba/', icon: '🧋', color: '#d97706', cat: ['sim'], zh: '珍奶手搖店', en: 'Boba Shop', dzh: '接單、做飲料、賺小費', den: 'Take orders, mix drinks, earn tips' },
    { id: 'farm', no: '62', url: '/farm/', icon: '🌾', color: '#65a30d', cat: ['sim'], zh: '開心農場', en: 'Happy Farm', dzh: '4 分鐘一季的農場經營', den: 'Run a farm for a 4-minute season' },
    { id: 'nightmarket', no: '63', url: '/nightmarket/', icon: '🏮', color: '#ef4444', cat: ['sim'], zh: '夜市大亨', en: 'Night Market Tycoon', dzh: '14 天的夜市攤販經營', den: '14 days of street-food business' },
    { id: 'city', no: '64', url: '/city/', icon: '🏙️', color: '#0ea5e9', cat: ['sim'], zh: '迷你城市', en: 'Mini City', dzh: '20 年蓋出你的迷你城市', den: 'Build a city in 20 years' },
    { id: 'metro', no: '65', url: '/metro/', icon: '🚇', color: '#2563eb', cat: ['sim'], zh: '地鐵大亨', en: 'Metro Tycoon', dzh: '拉線蓋地鐵，別讓車站擠爆', den: 'Draw metro lines and keep stations flowing' },
    { id: 'aquarium', no: '66', url: '/aquarium/', icon: '🐠', color: '#06b6d4', cat: ['sim'], zh: '夢幻水族箱', en: 'Dream Aquarium', dzh: '餵魚、收金幣、打鯊魚', den: 'Feed fish, collect coins, fight sharks' },
    { id: 'diner', no: '67', url: '/diner/', icon: '🍽️', color: '#f43f5e', cat: ['sim'], zh: '美味餐廳', en: 'Tasty Diner', dzh: '一人服務生的餐廳時間管理', den: 'One-waiter restaurant time management' },
    { id: 'studio', no: '68', url: '/studio/', icon: '🎮', color: '#8b5cf6', cat: ['sim'], zh: '遊戲工作室', en: 'Game Studio', dzh: '經營遊戲公司 10 年', den: 'Run a game company for 10 years' },
    { id: 'colony', no: '69', url: '/colony/', icon: '🪐', color: '#ea580c', cat: ['sim'], zh: '太空殖民地', en: 'Space Colony', dzh: '火星基地的資源管理生存', den: 'Mars base survival and resource management' },
    { id: 'atc', no: '70', url: '/atc/', icon: '🛫', color: '#0ea5e9', cat: ['sim'], zh: '塔台管制員', en: 'Tower Control', dzh: '畫航線引導飛機安全降落', den: 'Draw flight paths and land every plane' }
  ];
  window.SC_CATS = [
    { id: 'all', zh: '全部', en: 'All', icon: '🎮' },
    { id: 'board', zh: '棋牌', en: 'Board & Cards', icon: '♟️' },
    { id: 'puzzle', zh: '益智', en: 'Puzzle', icon: '🧠' },
    { id: 'action', zh: '動作', en: 'Action', icon: '⚡' },
    { id: 'racing', zh: '競速', en: 'Racing', icon: '🏁' },
    { id: 'sim', zh: '模擬經營', en: 'Simulation', icon: '💼' }
  ];
  window.SC_GAMES = GAMES;
  var me = document.currentScript, cur = (me && me.getAttribute('data-game')) || '';
  // 大廳頁只需要遊戲清單，不顯示切換列；App 內也不顯示
  if ((window.SC_IS_APP && window.SC_APP_NAV === false) || cur === 'lobby') return;
  var idx = -1; for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === cur) idx = i;
  if (GAMES.length < 2) return;
  var en = function () { return /^en/i.test(document.documentElement.lang || ''); };
  var nm = function (g) { return en() ? g.en : g.zh; };
  var prev = GAMES[(idx - 1 + GAMES.length) % GAMES.length], next = GAMES[(idx + 1) % GAMES.length];
  if (idx < 0) { prev = GAMES[GAMES.length - 1]; next = GAMES[0]; }

  var css = [
    ':root{--sc-rail:0px}',
    'html.scg-rails{--sc-rail:64px}',
    '@media(min-width:1400px){html.scg-rails{--sc-rail:148px}}',
    'html.scg-rails body{padding-left:var(--sc-rail);padding-right:var(--sc-rail)}',
    '.scg-rail{position:fixed;top:0;bottom:0;width:var(--sc-rail);z-index:35;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none}',
    'html.scg-rails .scg-rail{display:flex}',
    '.scg-rail.l{left:0}.scg-rail.r{right:0}',
    '.scg-card{pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:#e6ebf5;background:rgba(20,26,41,.92);border:1px solid #2a3550;border-radius:16px;padding:12px 6px;width:calc(var(--sc-rail) - 12px);box-shadow:0 6px 18px rgba(0,0,0,.35);transition:transform .15s,border-color .15s;font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}',
    '.scg-card:hover{transform:scale(1.04);border-color:#f5b83d}',
    '.scg-arrow{font-size:18px;color:#f5b83d;line-height:1}',
    '.scg-no{font:800 13px/1 ui-monospace,Menlo,Consolas,monospace;color:#8b97b3;letter-spacing:1px}',
    '.scg-ico{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}',
    '.scg-ico.t{font-family:"Kaiti TC","STKaiti","DFKai-SB","BiauKai",serif;background:#fdf3dc!important;color:#b91c1c;border:3px solid #b91c1c}',
    '.scg-name{font-size:13px;font-weight:700;line-height:1.35;text-align:center;writing-mode:vertical-rl;letter-spacing:2px;max-height:190px}',
    '@media(min-width:1400px){.scg-name{writing-mode:horizontal-tb;letter-spacing:0;font-size:14px}.scg-desc{display:block!important}}',
    '.scg-desc{display:none;font-size:11.5px;color:#8b97b3;text-align:center;line-height:1.45;padding:0 4px}',
    '.scg-all{pointer-events:auto;border:1px solid #2a3550;background:rgba(20,26,41,.92);color:#cfd8ea;border-radius:999px;padding:6px 10px;font-size:12px;cursor:pointer;white-space:nowrap}',
    '.scg-all:hover{border-color:#f5b83d;color:#fff}',
    '.scg-bar{display:none;align-items:center;gap:6px;padding:6px 8px;background:#0b0f19;border-bottom:1px solid #222b40;font:13px/1.2 -apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}',
    'html.scg-narrow .scg-bar{display:flex}',
    '.scg-bar a{flex:1;min-width:0;display:flex;align-items:center;gap:6px;color:#e6ebf5;text-decoration:none;padding:6px 8px;border-radius:10px;background:#141a29;border:1px solid #222b40}',
    '.scg-bar a.n{justify-content:flex-end;text-align:right}',
    '.scg-bar a span.t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.scg-bar b{color:#f5b83d}',
    '.scg-bar .scg-all{flex:none}',
    '@media(orientation:landscape) and (max-height:520px){html.scg-narrow .scg-bar{display:none}}',
    '.scg-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(5,8,15,.82);display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}',
    '.scg-ov.on{display:flex}',
    '.scg-box{background:#141a29;border:1px solid #2a3550;border-radius:18px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:18px;color:#e6ebf5;font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}',
    '.scg-box h3{margin:0 0 12px;font-size:18px;display:flex;justify-content:space-between;align-items:center}',
    '.scg-box h3 button{background:none;border:0;color:#8b97b3;font-size:22px;cursor:pointer}',
    '.scg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}',
    '.scg-item{display:flex;gap:10px;align-items:center;padding:12px;border-radius:14px;background:#0f1420;border:1px solid #222b40;color:#e6ebf5;text-decoration:none}',
    '.scg-item:hover{border-color:#f5b83d}',
    '.scg-item.cur{border-color:#35e08a;background:#10231b}',
    '.scg-item small{display:block;color:#8b97b3;font-size:12px;margin-top:3px;line-height:1.4}',
    '.scg-item .scg-ico{flex:none}',
    '.scg-home{pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;white-space:nowrap;font-weight:800;color:#1a1205!important;background:linear-gradient(135deg,#f5b83d,#ef8f3d)!important;border:0!important;border-radius:999px;box-shadow:0 4px 14px rgba(245,184,61,.35);font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}',
    '.scg-home:hover{filter:brightness(1.08);transform:translateY(-1px)}',
    '.scg-rail .scg-home{width:calc(var(--sc-rail) - 12px);padding:10px 4px;font-size:13px;flex-direction:column;gap:2px;border-radius:14px}',
    '.scg-rail .scg-home i{font-style:normal;font-size:22px;line-height:1}',
    '@media(min-width:1400px){.scg-rail .scg-home{flex-direction:row;font-size:15px;gap:6px;padding:12px 6px}.scg-rail .scg-home i{font-size:18px}}',
    '.scg-bar .scg-home{flex:none;padding:8px 12px;font-size:13.5px}',
    // 切換列固定在最上面，結算視窗開著時也看得到、按得到
    'html.scg-narrow .scg-bar{position:sticky;top:0;z-index:60}',
    'html.scg-rails .scg-rail{z-index:60}',
    // 結算畫面：回大廳＋推薦下一款
    '.scg-next{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12);text-align:center;font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}',
    '.scg-next-h{font-size:13px;font-weight:700;color:#aab4cc;margin-bottom:8px;letter-spacing:1px}',
    '.scg-next-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
    '.scg-nx{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px 8px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#e6ebf5!important;text-decoration:none!important;min-width:0;transition:transform .12s,border-color .12s}',
    '.scg-nx:hover,.scg-nx:active{transform:translateY(-2px);border-color:#f5b83d}',
    '.scg-nx b{font-size:12.5px;font-weight:700;line-height:1.3;max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
    '.scg-nx i{position:absolute;top:-7px;left:50%;transform:translateX(-50%);font-style:normal;font-size:10px;font-weight:800;background:#f5b83d;color:#1a1205;border-radius:999px;padding:1px 7px;white-space:nowrap}',
    '.scg-next-r{display:flex;gap:8px;margin-top:10px}',
    '.scg-next-r .scg-home{flex:1;padding:11px 10px;font-size:14.5px}',
    '.scg-next-r .scg-all{padding:10px 14px;font-size:13px}',
    '.scg-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;display:flex;justify-content:center;padding:8px;pointer-events:none;transform:translateY(110%);transition:transform .28s ease}',
    '.scg-sheet.on{transform:none}',
    // 全螢幕按鈕（右下角）與全螢幕時的版面
    '.scg-fsb{position:fixed;right:10px;bottom:calc(10px + var(--sc-anchor,0px) + env(safe-area-inset-bottom,0px));z-index:2147480000;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(15,20,32,.66);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;margin:0;opacity:.82;-webkit-tap-highlight-color:transparent;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,.4);transition:opacity .2s,transform .15s,bottom .25s;touch-action:manipulation}',
    '.scg-fsb:hover{opacity:1}.scg-fsb:active{transform:scale(.9)}',
    '.scg-fsb svg{width:22px;height:22px;display:block;pointer-events:none}',
    'html.scg-fs .scg-fsb{opacity:.55;width:40px;height:40px}',
    'html.scg-fs .scg-bar,html.scg-fs .scg-rail,html.scg-fs .k-help,html.scg-fs .k-foot,html.scg-fs section.info,html.scg-fs footer.foot{display:none!important}',
    'html.scg-fs.scg-rails body{padding-left:0;padding-right:0}',
    'html.scg-fs,html.scg-fs body{overscroll-behavior:none}',
    'html.scg-land,html.scg-land body{height:100%;overflow:hidden}',
    // 橫向全螢幕的共用精簡：標題列變矮、彈窗塞進矮畫面；主要區塊由各遊戲自己的 style.css 排
    'html.scg-land body{display:flex;flex-direction:column;min-height:0}',
    'html.scg-land .k-top{padding:4px 10px;gap:6px;flex-wrap:nowrap;flex:none}',
    'html.scg-land .k-logo{width:32px;height:32px;font-size:18px;border-radius:10px}',
    'html.scg-land .k-brand h1{font-size:17px}html.scg-land .k-brand small{font-size:11px}',
    'html.scg-land .k-acts{flex-wrap:nowrap;gap:4px}',
    'html.scg-land .k-acts .btn{padding:6px 10px;font-size:13px;border-radius:10px;white-space:nowrap}',
    'html.scg-land .k-ov{padding:8px}',
    'html.scg-land .k-modal{max-height:calc(100vh - 16px);padding:12px 16px;max-width:min(680px,96vw)}',
    'html.scg-land .k-modal h2{margin:0 0 6px;font-size:19px}html.scg-land .k-modal h3{margin:8px 0 5px}',
    'html.scg-land .k-big{font-size:40px;line-height:1.1}',
    '.scg-tip{position:fixed;left:50%;top:18%;transform:translate(-50%,-8px);z-index:2147480500;background:rgba(15,20,32,.94);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 16px;font:700 14px/1.3 -apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;max-width:86vw;text-align:center}',
    '.scg-tip.on{opacity:1;transform:translate(-50%,0)}',
    '.scg-sheet>div{pointer-events:auto;position:relative;width:100%;max-width:460px;background:#141a29;border:1px solid #2a3550;border-radius:18px;padding:4px 14px 12px;box-shadow:0 -8px 30px rgba(0,0,0,.5)}',
    '.scg-sheet .scg-next{margin-top:0;border-top:0}',
    '.scg-sheet .scg-x{position:absolute;right:6px;top:2px;background:none;border:0;color:#8b97b3;font-size:22px;line-height:1;padding:6px 8px;cursor:pointer;z-index:1}'
  ].join('\n');

  function ico(g, size) { var t = g.icon.length === 1 && /[一-鿿]/.test(g.icon); return '<span class="scg-ico' + (t ? ' t' : '') + '" style="background:' + g.color + (g.fg ? ';color:' + g.fg + ';border-color:' + g.fg : '') + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '">' + g.icon + '</span>'; }
  function card(g, dir) {
    return '<a class="scg-card" href="' + g.url + '" title="' + nm(g) + '">' + (dir < 0 ? '<span class="scg-arrow">◀</span>' : '') +
      '<span class="scg-no">' + g.no + '</span>' + ico(g) + '<span class="scg-name">' + nm(g) + '</span><span class="scg-desc">' + (en() ? g.den : g.dzh) + '</span>' +
      (dir > 0 ? '<span class="scg-arrow">▶</span>' : '') + '</a>';
  }
  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var allTxt = en() ? '☰ All games' : '☰ 全部遊戲';
    var l = document.createElement('nav'); l.className = 'scg-rail l'; l.setAttribute('aria-label', 'previous game');
    l.innerHTML = '<a class="scg-home" href="/"><i>🏠</i>' + (en() ? 'Lobby' : '遊戲大廳') + '</a>' + card(prev, -1) + '<button class="scg-all" type="button">' + allTxt + '</button>';
    var r = document.createElement('nav'); r.className = 'scg-rail r'; r.setAttribute('aria-label', 'next game');
    r.innerHTML = '<a class="scg-home" href="/leaderboard/"><i>🏆</i>' + (en() ? 'Ranks' : '排行榜') + '</a>' + card(next, 1) + '<button class="scg-all" type="button">' + allTxt + '</button>';
    var bar = document.createElement('nav'); bar.className = 'scg-bar'; bar.setAttribute('aria-label', 'games');
    bar.innerHTML = '<a class="p" href="' + prev.url + '"><b>◀</b><span class="t">' + prev.no + ' ' + nm(prev) + '</span></a>' +
      '<a class="scg-home" href="/">🏠 ' + (en() ? 'Lobby' : '大廳') + '</a><button class="scg-all" type="button">☰</button>' +
      '<a class="n" href="' + next.url + '"><span class="t">' + next.no + ' ' + nm(next) + '</span><b>▶</b></a>';
    var ov = document.createElement('div'); ov.className = 'scg-ov';
    ov.innerHTML = '<div class="scg-box" role="dialog"><h3><span>' + (en() ? 'More games' : '更多遊戲') + '　<a href="/" style="font-size:13px;color:#f5b83d;text-decoration:none">🏠 ' + (en() ? 'Lobby' : '遊戲大廳') + '</a></span><button type="button" aria-label="close">×</button></h3><div class="scg-grid">' +
      GAMES.map(function (g, i) { return '<a class="scg-item' + (i === idx ? ' cur' : '') + '" href="' + g.url + '">' + ico(g, 44) + '<span><b>' + g.no + '　' + nm(g) + '</b><small>' + (i === idx ? (en() ? 'Now playing · ' : '目前遊戲・') : '') + (en() ? g.den : g.dzh) + '</small></span></a>'; }).join('') + '</div></div>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.appendChild(l); document.body.appendChild(r); document.body.appendChild(ov);
    var open = function () { ov.classList.add('on'); }, close = function () { ov.classList.remove('on'); };
    [l, r, bar].forEach(function (n) { n.querySelector('.scg-all').addEventListener('click', open); });
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('h3 button')) close(); });
    if (window.SC) window.SC.onBack(function () { if (ov.classList.contains('on')) { close(); return true; } return false; });
    var mode = function () { var wide = window.innerWidth >= 900; document.documentElement.classList.toggle('scg-rails', wide); document.documentElement.classList.toggle('scg-narrow', !wide); };
    mode(); window.addEventListener('resize', mode);
    return [st, l, r, bar, ov];
  }
  // ---------- 結算畫面：回大廳＋推薦下一款 ----------
  var openAll = function () { var o = document.querySelector('.scg-ov'); if (o) o.classList.add('on'); };
  function picks() {
    var out = [], used = {}, me = GAMES[idx], i; used[cur] = 1;
    var add = function (g) { if (g && !used[g.id] && out.length < 3) { used[g.id] = 1; out.push(g); } };
    add(next);
    var same = GAMES.filter(function (g) { return me && g.cat.some(function (c) { return me.cat.indexOf(c) >= 0; }); }), rest = GAMES.slice();
    for (i = same.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = same[i]; same[i] = same[j]; same[j] = t; }
    for (i = rest.length - 1; i > 0; i--) { var k = (Math.random() * (i + 1)) | 0, u = rest[i]; rest[i] = rest[k]; rest[k] = u; }
    add(same[0]); add(rest[0]); same.forEach(add); rest.forEach(add);
    return out;
  }
  function nextBlock() {
    var d = document.createElement('div'); d.className = 'scg-next';
    d.innerHTML = '<div class="scg-next-h">' + (en() ? 'What to play next?' : '接下來玩什麼？') + '</div><div class="scg-next-g">' +
      picks().map(function (g, i) { return '<a class="scg-nx" href="' + g.url + '">' + (i === 0 ? '<i>' + (en() ? 'Next' : '下一款') + '</i>' : '') + ico(g, 42) + '<b>' + nm(g) + '</b></a>'; }).join('') +
      '</div><div class="scg-next-r"><a class="scg-home" href="/">🏠 ' + (en() ? 'Back to lobby' : '回遊戲大廳') + '</a><button class="scg-all" type="button">☰ ' + (en() ? 'All' : '全部') + '</button></div>';
    d.querySelector('.scg-all').addEventListener('click', openAll);
    return d;
  }
  function isOn(o) { return o && o.classList.contains('on'); }
  function attach(ov) { // 把推薦區塊放進彈窗；彈窗關掉就拿掉（下次開會換一批推薦）
    if (!ov) return false; var box = ov.firstElementChild; if (!box) return false;
    var old = box.querySelector('.scg-next'); if (old) old.remove();
    box.appendChild(nextBlock()); return true;
  }
  function watch(ov) {
    if (!ov || ov._scg) return; ov._scg = 1;
    new MutationObserver(function () { var b = ov.querySelector('.scg-next'); if (isOn(ov)) { if (!b) attach(ov); } else if (b) b.remove(); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    if (isOn(ov)) attach(ov);
  }
  var sheet = null;
  function showSheet() {
    if (!sheet) { sheet = document.createElement('div'); sheet.className = 'scg-sheet'; sheet.innerHTML = '<div><button class="scg-x" type="button" aria-label="close">×</button></div>'; document.body.appendChild(sheet); sheet.querySelector('.scg-x').addEventListener('click', function () { sheet.classList.remove('on'); }); }
    var box = sheet.firstElementChild, old = box.querySelector('.scg-next'); if (old) old.remove(); box.appendChild(nextBlock());
    setTimeout(function () { sheet.classList.add('on'); }, 30);
  }
  function onGameOver() {
    if (sheet) sheet.classList.remove('on');
    setTimeout(function () {
      var vis = [].some.call(document.querySelectorAll('.scg-next'), function (n) { return n.offsetParent !== null; }); if (vis) return;
      var ovs = document.querySelectorAll('.k-ov.on, .ov.on'), top = ovs[ovs.length - 1];
      if (top && top.firstElementChild) { watch(top); if (!top.querySelector('.scg-next')) attach(top); } else showSheet();
    }, 2600);
  }
  function hookEnd() {
    watch(document.getElementById('ovEnd'));
    if (window.SC && !SC._scgPost) { var raw = SC.post; SC._scgPost = 1; SC.post = function (type, data) { try { if (type === 'gameover') { onGameOver(); if (data && data.win === true && window.K && K.confetti) K.confetti(); } else if (type === 'start' && sheet) sheet.classList.remove('on'); } catch (e) { /* 略過 */ } return raw.apply(SC, arguments); }; }
  }
  // ── 全螢幕（右下角按鈕）：依遊戲決定橫向或直向 ──────────────────────────
  // 橫向的遊戲要在自己的 style.css 用 html.scg-land 寫好橫向版面，才能加進這張表
  var FS_LAND = { darkchess: 1, bigtwo: 1, mahjong: 1, hearts: 1, runner: 1, blob: 1 };
  var fsOrient = FS_LAND[cur] ? 'landscape' : 'portrait', fsOn = false, fsMode = '', fsBtn = null, fsSlot = 0, root = document.documentElement;
  var ICO_IN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var ICO_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  function fsNative() { try { var a = window.StockcorpAndroid; return a && typeof a.setFullscreen === 'function' ? a : null; } catch (e) { return null; } }
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsLand() {
    var land = fsOn && fsOrient === 'landscape' && !window.SC_VH_FIX && window.innerWidth > window.innerHeight * 1.1;
    if (root.classList.contains('scg-land') !== land) root.classList.toggle('scg-land', land);
  }
  function fsLabel() {
    if (!fsBtn) return;
    var t = fsOn ? (en() ? 'Exit full screen' : '離開全螢幕') : (en() ? 'Full screen' : '全螢幕');
    fsBtn.innerHTML = fsOn ? ICO_OUT : ICO_IN; fsBtn.title = t; fsBtn.setAttribute('aria-label', t);
  }
  function fsApply(on) {
    if (fsOn === on) { fsLand(); return; }
    fsOn = on; root.classList.toggle('scg-fs', on); fsLand(); fsLabel();
    try { window.scrollTo(0, 0); } catch (e) { /* 略過 */ }
    try { if (window.SC && SC.post) SC.post('fullscreen', { on: on, orientation: fsOrient }); } catch (e) { /* 略過 */ }
    // 畫布遊戲靠 resize 重新量尺寸
    [60, 350, 900].forEach(function (ms) { setTimeout(function () { fsLand(); try { window.dispatchEvent(new Event('resize')); } catch (e) { /* 略過 */ } fsPlace(true); }, ms); });
  }
  function fsHint() {
    if (fsOrient !== 'landscape' || window.SC_VH_FIX || window.innerWidth > window.innerHeight) return;
    var m = en() ? 'Rotate your phone sideways for a bigger view' : '把手機轉成橫向，畫面會更大';
    var t = document.createElement('div'); t.className = 'scg-tip'; t.textContent = m; document.body.appendChild(t);
    setTimeout(function () { t.classList.add('on'); }, 30); setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 400); }, 2800);
  }
  function fsEnter() {
    var n = fsNative();
    if (n) { fsMode = 'native'; try { n.setFullscreen(true, fsOrient); } catch (e) { /* 略過 */ } fsApply(true); return; }
    var req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (req && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      fsMode = 'api';
      var lock = function () { try { var o = screen.orientation; if (o && o.lock) { var q = o.lock(fsOrient); if (q && q.catch) q.catch(function () { fsHint(); }); } } catch (e) { /* 略過 */ } };
      var fail = function () { fsMode = 'css'; fsApply(true); fsHint(); };
      try { var p = req.call(root, { navigationUI: 'hide' }); if (p && p.then) p.then(lock, fail); else setTimeout(lock, 80); } catch (e) { fail(); }
      return;
    }
    fsMode = 'css'; fsApply(true); fsHint();
  }
  function fsExit() {
    if (fsMode === 'native') { var n = fsNative(); try { if (n) n.setFullscreen(false, ''); } catch (e) { /* 略過 */ } fsApply(false); }
    else if (fsMode === 'api' && fsEl()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { fsApply(false); } }
    else fsApply(false);
  }
  function fsChange() {
    var on = !!fsEl();
    if (on) { fsMode = 'api'; fsApply(true); }
    else if (fsMode === 'api') { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* 略過 */ } fsApply(false); }
  }
  // 按鈕預設在右下角；底下剛好有遊戲的按鈕時，沿著右邊往上讓開
  function fsHits(strict) {
    var r = fsBtn.getBoundingClientRect(), pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 5, r.top + 5], [r.right - 5, r.bottom - 5], [r.left + 5, r.bottom - 5]];
    for (var i = 0; i < pts.length; i++) {
      var els = document.elementsFromPoint ? document.elementsFromPoint(pts[i][0], pts[i][1]) : [];
      for (var j = 0; j < els.length; j++) {
        var e = els[j]; if (e === fsBtn || e === root || e === document.body) continue;
        var tg = e.tagName; if (e.id === 'k-fx' || (e.closest && e.closest('.scg-sheet,.scg-ov'))) continue;
        if (tg === 'BUTTON' || tg === 'A' || tg === 'INPUT' || tg === 'SELECT') return true;
        var cs = getComputedStyle(e); if (cs.cursor === 'pointer') return true;
        if (strict && tg === 'CANVAS' && cs.pointerEvents !== 'none') return true;
      }
    }
    return false;
  }
  function fsSet(k) {
    fsSlot = k;
    // WebView 高度異常（app.js 的 SC_VH_FIX）時 bottom 不可靠，改用估算的可視高度由上往下定位
    if (window.SC_VH_FIX) { fsBtn.style.bottom = 'auto'; fsBtn.style.top = Math.max(60, window.SC_VH_FIX - 56 - k * 54) + 'px'; return; }
    fsBtn.style.top = ''; fsBtn.style.bottom = k ? 'calc(' + (10 + k * 54) + 'px + var(--sc-anchor,0px) + env(safe-area-inset-bottom,0px))' : '';
  }
  function fsPlace(reset) {
    if (!fsBtn || !fsBtn.isConnected) return;
    if (!reset && !fsHits(false)) return;
    var max = Math.max(1, Math.min(7, Math.floor((window.innerHeight * 0.55 - 10) / 54))), k, pass;
    var tr = fsBtn.style.transition; fsBtn.style.transition = 'none';
    for (pass = 0; pass < 2; pass++) { for (k = 0; k <= max; k++) { fsSet(k); if (!fsHits(pass === 0)) { fsBtn.style.transition = tr; return; } } }
    fsSet(0); fsBtn.style.transition = tr;
  }
  function fsBuild() {
    if (fsBtn && fsBtn.isConnected) { fsLabel(); return; }
    fsBtn = document.createElement('button'); fsBtn.type = 'button'; fsBtn.className = 'scg-fsb';
    fsBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (fsOn) fsExit(); else fsEnter(); });
    document.body.appendChild(fsBtn); fsLabel();
    [400, 1500].forEach(function (ms) { setTimeout(function () { fsPlace(true); }, ms); });
  }
  if (cur && idx >= 0) {
    document.addEventListener('fullscreenchange', fsChange); document.addEventListener('webkitfullscreenchange', fsChange);
    window.addEventListener('resize', function () { fsLand(); if (fsBtn) fsPlace(true); });
    setInterval(function () { if (fsBtn) fsPlace(false); }, 2500);
    if (window.SC && SC.onBack) SC.onBack(function () { if (fsOn) { fsExit(); return true; } return false; });
    // 原生端自己離開全螢幕（例如系統手勢）時呼叫 SC_FS.sync(false)
    window.SC_FS = { orientation: fsOrient, isOn: function () { return fsOn; }, enter: fsEnter, exit: fsExit, sync: function (on) { fsMode = on ? (fsNative() ? 'native' : 'css') : fsMode; fsApply(!!on); } };
  }
  var nodes = null, lastLang = null;
  function go() {
    var lg = en() ? 'en' : 'zh'; if (lg === lastLang) return; lastLang = lg;
    if (nodes) nodes.forEach(function (n) { n.remove(); });
    nodes = build(); hookEnd(); if (cur && idx >= 0) fsBuild();
    [].forEach.call(document.querySelectorAll('.scg-next'), function (n) { var p = n.parentNode; n.remove(); if (p) p.appendChild(nextBlock()); });
  }
  // 語言切換後更新名稱（我愛操盤手有中英切換）
  if (window.MutationObserver) new MutationObserver(function () { if (nodes) go(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
