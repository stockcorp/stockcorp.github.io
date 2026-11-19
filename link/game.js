/* 麻將連連看 — stockcorp.github.io/link/
   四川省規則：兩張相同的牌能用最多 3 段直線（2 個轉彎）、不穿過其他牌連起來就消除；路線可以走盤面外圍。
   沒步可走時自動洗牌。排行榜：mode = easy/normal/hard，時間由伺服器計算（越短越好）。 */
(function () {
  'use strict';
  var GAME = 'link', $ = K.$, L = K.L;
  var LV = { easy: { zh: '簡單', en: 'Easy', c: 10, r: 6 }, normal: { zh: '普通', en: 'Normal', c: 12, r: 7 }, hard: { zh: '困難', en: 'Hard', c: 14, r: 8 } };
  var NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'], HON = ['東', '南', '西', '北', '中', '發', '白'];
  var S = null, sel = null, tick = null, busy = false;

  function tileHtml(k) {
    if (k < 27) { var s = ['m', 'p', 's'][Math.floor(k / 9)], b = ['萬', '筒', '條'][Math.floor(k / 9)]; return '<div class="mj ' + s + '"><span class="a">' + NUM[k % 9] + '</span><span class="b">' + b + '</span></div>'; }
    var hc = k === 31 ? ' red' : k === 32 ? ' grn' : k === 33 ? ' wht' : '';
    return '<div class="mj h' + hc + '"><span class="a">' + (k === 33 ? '' : HON[k - 27]) + '</span></div>';
  }

  // ---------- 盤面 ----------
  // g 含外圍一圈空格：大小 (C+2)×(R+2)，-1 = 空
  function newGame(lv) {
    var cfg = LV[lv], portrait = window.innerWidth < window.innerHeight * 0.9;
    var C = portrait ? cfg.r : cfg.c, R = portrait ? cfg.c : cfg.r, n = C * R, kinds = n / 4;
    var pool = K.shuffle(Array.from({ length: 34 }, function (_, i) { return i; })).slice(0, kinds), tiles = [];
    pool.forEach(function (k) { for (var j = 0; j < 4; j++) tiles.push(k); });
    tiles = K.shuffle(tiles);
    var g = [];
    for (var y = 0; y < R + 2; y++) { g.push([]); for (var x = 0; x < C + 2; x++) g[y].push(x === 0 || y === 0 || x === C + 1 || y === R + 1 ? -1 : tiles.pop()); }
    S = { lv: lv, C: C, R: R, g: g, left: n, hints: 3, shufs: 2, t0: Date.now(), done: false };
    sel = null; busy = false;
    if (!findPair()) reshuffle(true);
    build(); run();
    $('bLb').href = '/leaderboard/?game=link&mode=' + lv;
    if (window.SCLB) SCLB.start(GAME, lv);
    if (window.SC) SC.post('start', { game: GAME, level: lv });
  }
  // 最多兩個轉彎的路徑（BFS，狀態 = 位置＋方向，記轉彎數）
  function path(a, b) {
    var g = S.g, W = S.C + 2, H = S.R + 2, D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var best = {}, q = [], prev = {};
    for (var d = 0; d < 4; d++) { q.push([a[0], a[1], d, 0]); best[a[0] + ',' + a[1] + ',' + d] = 0; }
    while (q.length) {
      var cur = q.shift(), x = cur[0], y = cur[1], dir = cur[2], t = cur[3];
      for (var nd = 0; nd < 4; nd++) {
        var nt = t + (nd === dir ? 0 : 1);
        if (x === a[0] && y === a[1]) nt = 0;
        if (nt > 2) continue;
        var nx = x + D[nd][0], ny = y + D[nd][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var key = nx + ',' + ny + ',' + nd;
        if (nx === b[0] && ny === b[1]) { prev[key] = [x, y, dir]; return trace(prev, key, a, [nx, ny]); }
        if (g[ny][nx] !== -1) continue;
        if (best[key] != null && best[key] <= nt) continue;
        best[key] = nt; prev[key] = [x, y, dir]; q.push([nx, ny, nd, nt]);
      }
    }
    return null;
  }
  function trace(prev, key, a, end) {
    var pts = [end], k = key, guard = 0;
    while (prev[k] && guard++ < 500) { var p = prev[k]; pts.unshift([p[0], p[1]]); if (p[0] === a[0] && p[1] === a[1]) break; k = p[0] + ',' + p[1] + ',' + p[2]; }
    // 只留轉彎點
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) { var A = out[out.length - 1], B = pts[i], Cp = pts[i + 1]; if ((B[0] - A[0]) * (Cp[1] - B[1]) !== (B[1] - A[1]) * (Cp[0] - B[0])) out.push(B); }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function findPair() {
    var by = {};
    for (var y = 1; y <= S.R; y++) for (var x = 1; x <= S.C; x++) { var k = S.g[y][x]; if (k >= 0) (by[k] = by[k] || []).push([x, y]); }
    for (var k2 in by) { var a = by[k2]; for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) if (path(a[i], a[j])) return [a[i], a[j]]; }
    return null;
  }
  function reshuffle(silent) {
    for (var tries = 0; tries < 50; tries++) {
      var pos = [], vals = [];
      for (var y = 1; y <= S.R; y++) for (var x = 1; x <= S.C; x++) if (S.g[y][x] >= 0) { pos.push([x, y]); vals.push(S.g[y][x]); }
      vals = K.shuffle(vals); pos.forEach(function (p, i) { S.g[p[1]][p[0]] = vals[i]; });
      if (findPair()) break;
    }
    if (!silent) { K.toast(L('重新洗牌了', 'Tiles shuffled')); K.beep(500, 0.2, 'triangle', 0.05, 900); }
  }

  // ---------- 畫面 ----------
  function size() {
    var W = S.C + 2, H = S.R + 2, avW = Math.min(window.innerWidth - 40, 980), avH = window.innerHeight - 190;
    var tw = Math.floor(Math.min((avW - 20) / W - 3, (avH - 20) / H / 1.3 - 3, 50));
    document.documentElement.style.setProperty('--tw', Math.max(18, tw) + 'px');
  }
  function build() {
    size();
    var grid = $('grid'); grid.style.gridTemplateColumns = 'repeat(' + (S.C + 2) + ', auto)'; grid.innerHTML = '';
    for (var y = 0; y < S.R + 2; y++) for (var x = 0; x < S.C + 2; x++) {
      var d = document.createElement('div'); d.className = 'cell'; d.dataset.x = x; d.dataset.y = y;
      if (S.g[y][x] >= 0) d.innerHTML = tileHtml(S.g[y][x]);
      grid.appendChild(d);
    }
    hud();
  }
  function cellEl(p) { return $('grid').children[p[1] * (S.C + 2) + p[0]]; }
  function hud() {
    $('left').textContent = S.left; $('hints').textContent = S.hints; $('shufs').textContent = S.shufs;
    $('bHint').disabled = !S.hints || S.done; $('bShuf').disabled = !S.shufs || S.done;
    $('sub').textContent = L(LV[S.lv].zh, LV[S.lv].en);
  }
  function run() { clearInterval(tick); tick = setInterval(function () { if (S && !S.done) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
  function drawPath(pts) {
    var svg = $('path'), br = $('board').getBoundingClientRect();
    var co = pts.map(function (p) { var r = cellEl(p).getBoundingClientRect(); return (r.left - br.left + r.width / 2) + ',' + (r.top - br.top + r.height / 2); }).join(' ');
    svg.innerHTML = '<polyline points="' + co + '"/>';
    setTimeout(function () { svg.innerHTML = ''; }, 280);
  }

  // ---------- 操作 ----------
  function click(p) {
    if (!S || S.done || busy || S.g[p[1]][p[0]] < 0) return;
    document.querySelectorAll('.mj.hint').forEach(function (e) { e.classList.remove('hint'); });
    if (!sel) { sel = p; cellEl(p).firstChild.classList.add('sel'); K.beep(700, 0.03, 'sine', 0.03); return; }
    if (sel[0] === p[0] && sel[1] === p[1]) { cellEl(p).firstChild.classList.remove('sel'); sel = null; return; }
    var a = sel, ea = cellEl(a).firstChild;
    if (S.g[a[1]][a[0]] !== S.g[p[1]][p[0]]) { ea.classList.remove('sel'); sel = p; cellEl(p).firstChild.classList.add('sel'); K.beep(700, 0.03, 'sine', 0.03); return; }
    var pt = path(a, p);
    if (!pt) { var eb = cellEl(p).firstChild; [ea, eb].forEach(function (e) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }); ea.classList.remove('sel'); sel = null; K.beep(160, 0.1, 'square', 0.04); return; }
    sel = null; busy = true;
    drawPath(pt);
    var e1 = cellEl(a).firstChild, e2 = cellEl(p).firstChild; e1.classList.add('sel'); e2.classList.add('sel');
    S.g[a[1]][a[0]] = -1; S.g[p[1]][p[0]] = -1; S.left -= 2;
    K.beep(880, 0.08, 'triangle', 0.05, 1320);
    setTimeout(function () {
      e1.classList.add('gone'); e2.classList.add('gone');
      setTimeout(function () { cellEl(a).innerHTML = ''; cellEl(p).innerHTML = ''; busy = false; after(); }, 220);
    }, 160);
    hud();
  }
  function after() {
    if (!S.left) return win();
    if (!findPair()) { reshuffle(false); build(); }
  }
  function win() {
    S.done = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('sclink_best', {});
    var nb = !best[S.lv] || t < best[S.lv]; if (nb) { best[S.lv] = t; K.save('sclink_best', best); }
    $('clock').textContent = K.fmtTime(t);
    $('endTime').textContent = K.fmtTime(t); $('endLv').textContent = L(LV[S.lv].zh, LV[S.lv].en);
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.lv]);
    K.beep(523, 0.5, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, level: S.lv, sec: t });
    setTimeout(function () {
      K.open('ovEnd');
      if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: L(LV[S.lv].zh, LV[S.lv].en) + ' ' + K.fmtTime(sec) }); }
    }, 500);
    hud();
  }
  $('grid').addEventListener('click', function (e) { var c = e.target.closest('.cell'); if (c) click([+c.dataset.x, +c.dataset.y]); });
  $('bHint').onclick = function () {
    if (!S || S.done || !S.hints) return;
    var pr = findPair(); if (!pr) return;
    S.hints--; hud();
    pr.forEach(function (p) { cellEl(p).firstChild.classList.add('hint'); });
  };
  $('bShuf').onclick = function () { if (!S || S.done || !S.shufs || busy) return; S.shufs--; sel = null; reshuffle(false); build(); };
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = ''; var best = K.load('sclink_best', {});
    Object.keys(LV).forEach(function (k) {
      var b = document.createElement('button'); b.innerHTML = L(LV[k].zh, LV[k].en) + '<small>' + (best[k] ? L('最佳 ', 'Best ') + K.fmtTime(best[k]) : '&nbsp;') + '</small>';
      b.onclick = function () { K.close('ovNew'); K.close('ovEnd'); newGame(k); }; ch.appendChild(b);
    });
    K.open('ovNew');
  }
  $('bNew').onclick = openNew;
  $('bAgain').onclick = function () { K.close('ovEnd'); openNew(); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', function () { if (S) size(); });
  if (window.SC) SC.onLang(function () { if (S) hud(); });
  if (location.hash === '#test') window.__link = { findPair: findPair, click: click };
  newGame('normal');
})();
