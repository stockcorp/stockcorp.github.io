/* stockcorp.github.io 共用：遊戲切換列
   新增遊戲時只要在 GAMES 加一筆，所有遊戲頁面的左右切換就會自動更新；
   之後執行 node tools/build-sitemap.js（或推送後由 GitHub Actions 自動執行）就會更新 sitemap.xml。
   用法：<script src="/shared/games.js" data-game="遊戲 id" defer></script>
   寬螢幕：左右兩側固定「上一款／下一款」；窄螢幕：頁面最上方一條切換列。App 內（SC_IS_APP）不顯示。 */
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
    { id: 'sudoku', no: '10', url: '/sudoku/', icon: '🧩', color: '#0891b2', cat: ['puzzle'], zh: '數獨', en: 'Sudoku', dzh: '三種難度，筆記模式，比誰解得快', den: 'Three levels, pencil marks, beat the clock' }
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
  if (window.SC_IS_APP || cur === 'lobby') return;
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
    '.scg-bar .scg-home{flex:none;padding:8px 12px;font-size:13.5px}'
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
  var nodes = null, lastLang = null;
  function go() {
    var lg = en() ? 'en' : 'zh'; if (lg === lastLang) return; lastLang = lg;
    if (nodes) nodes.forEach(function (n) { n.remove(); });
    nodes = build();
  }
  // 語言切換後更新名稱（我愛操盤手有中英切換）
  if (window.MutationObserver) new MutationObserver(function () { if (nodes) go(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
