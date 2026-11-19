/* 2048 — stockcorp.github.io/2048/
   4x4、方向鍵/WASD/滑動、悔棋 3 次、自動存檔、全球排行榜（mode 4x4，分數越高越好） */
(function () {
  'use strict';
  var N = 4, GAME = '2048', MODE = '4x4', SAVE = 'sc2048_save', BEST = 'sc2048_best';
  var $ = K.$, L = K.L;
  var S, nextId = 1, busy = false;

  function blank() { var g = []; for (var i = 0; i < N * N; i++) g.push(null); return g; }
  function fresh() {
    S = { g: blank(), score: 0, undo: 3, hist: [], won: false, keep: false, over: false, moves: 0 };
    add(); add(); render(true); persist();
    if (window.SCLB) SCLB.start(GAME, MODE);
    if (window.SC) SC.post('start', { game: GAME });
  }
  function empties() { var e = []; for (var i = 0; i < N * N; i++) if (!S.g[i]) e.push(i); return e; }
  function add() {
    var e = empties(); if (!e.length) return;
    var i = e[(Math.random() * e.length) | 0];
    S.g[i] = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, isNew: true };
  }
  function snapshot() { return { g: S.g.map(function (t) { return t ? { id: t.id, v: t.v } : null; }), score: S.score }; }

  // dir: 0 上 1 右 2 下 3 左
  function line(dir, k) {
    var idx = [];
    for (var j = 0; j < N; j++) {
      var r, c;
      if (dir === 0) { c = k; r = j; } else if (dir === 2) { c = k; r = N - 1 - j; }
      else if (dir === 3) { r = k; c = j; } else { r = k; c = N - 1 - j; }
      idx.push(r * N + c);
    }
    return idx;
  }
  function move(dir) {
    if (busy || S.over || K.isOpen('ovEnd')) return;
    var before = snapshot(), moved = false, gain = 0, gone = [];
    S.g.forEach(function (t) { if (t) { t.isNew = false; t.merged = false; } });
    for (var k = 0; k < N; k++) {
      var idx = line(dir, k), tiles = idx.map(function (i) { return S.g[i]; }).filter(Boolean), out = [];
      for (var a = 0; a < tiles.length; a++) {
        var t = tiles[a];
        if (a + 1 < tiles.length && tiles[a + 1].v === t.v) {
          var b = tiles[a + 1];
          var m = { id: nextId++, v: t.v * 2, merged: true };
          gone.push({ id: t.id, v: t.v, to: out.length }, { id: b.id, v: b.v, to: out.length });
          out.push(m); gain += m.v; a++;
        } else out.push(t);
      }
      for (var j = 0; j < N; j++) {
        var nt = out[j] || null;
        if ((S.g[idx[j]] && (!nt || S.g[idx[j]].id !== nt.id)) || (!S.g[idx[j]] && nt)) moved = true;
        S.g[idx[j]] = nt;
        gone.forEach(function (gt) { if (gt.to === j && gt.k == null) { gt.k = k; gt.pos = idx[j]; } });
      }
    }
    if (!moved) return;
    S.hist.push(before); if (S.hist.length > 3) S.hist.shift();
    S.score += gain; S.moves++;
    // 先讓被合併的兩塊滑到目的地，再換成新方塊
    busy = true;
    renderGhosts(gone);
    setTimeout(function () {
      busy = false;
      add(); render();
      if (gain) { K.beep(300 + Math.min(900, Math.log2(gain) * 60), 0.08, 'triangle', 0.05); bump(gain); }
      else K.beep(180, 0.04, 'sine', 0.025);
      var mx = maxTile();
      if (mx >= 2048 && !S.won) { S.won = true; persist(); return end(true); }
      if (!canMove()) { S.over = true; persist(); return end(false); }
      persist();
    }, 110);
  }
  function canMove() {
    if (empties().length) return true;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = S.g[r * N + c].v;
      if (c + 1 < N && S.g[r * N + c + 1].v === v) return true;
      if (r + 1 < N && S.g[(r + 1) * N + c].v === v) return true;
    }
    return false;
  }
  function maxTile() { var m = 0; S.g.forEach(function (t) { if (t && t.v > m) m = t.v; }); return m; }

  // ---------- 畫面 ----------
  var tilesEl = $('tiles'), els = {};
  function pos(i) { var r = Math.floor(i / N), c = i % N; return 'translate(calc(' + c + ' * (100% + var(--gap))), calc(' + r + ' * (100% + var(--gap))))'; }
  function cls(v) { return 'tile ' + (v > 2048 ? 'tsuper' : 't' + v); }
  function fontSize(v) { var d = String(v).length; return d <= 2 ? 'min(11vw,48px)' : d === 3 ? 'min(9vw,40px)' : d === 4 ? 'min(7vw,32px)' : 'min(5.4vw,24px)'; }
  function mk(t) {
    var e = document.createElement('div'); e.innerHTML = '<div class="v"></div>';
    e.firstChild.textContent = t.v; e.style.fontSize = fontSize(t.v); tilesEl.appendChild(e); return e;
  }
  function renderGhosts(gone) {
    // 把即將消失的兩塊移到合併位置
    gone.forEach(function (gt) { var e = els[gt.id]; if (e) { e.style.transform = pos(gt.pos); e.style.zIndex = 1; } });
    // 其他還在的方塊也先移動
    S.g.forEach(function (t, i) { if (t && els[t.id]) els[t.id].style.transform = pos(i); });
  }
  function render(reset) {
    if (reset) { tilesEl.innerHTML = ''; els = {}; }
    var keep = {};
    S.g.forEach(function (t, i) {
      if (!t) return; keep[t.id] = 1;
      var e = els[t.id];
      if (!e) { e = els[t.id] = mk(t); e.style.transition = 'none'; e.style.transform = pos(i); void e.offsetWidth; e.style.transition = ''; }
      e.className = cls(t.v) + (t.isNew ? ' new' : '') + (t.merged ? ' merged' : '');
      e.style.transform = pos(i);
    });
    Object.keys(els).forEach(function (id) { if (!keep[id]) { els[id].remove(); delete els[id]; } });
    $('score').textContent = S.score;
    var best = Math.max(K.load(BEST, 0), S.score); K.save(BEST, best); $('best').textContent = best;
    $('undoLeft').textContent = S.undo;
    $('bUndo').disabled = !S.undo || !S.hist.length;
  }
  function bump(n) { var p = $('plus'); p.textContent = '+' + n; p.classList.remove('go'); void p.offsetWidth; p.classList.add('go'); }

  function end(win) {
    var mx = maxTile();
    $('endEmoji').textContent = win ? '🏆' : '🧱';
    $('endTitle').textContent = win ? L('合出 2048 了！', 'You made 2048!') : L('沒有路可以走了', 'No more moves');
    $('endScore').textContent = S.score; $('endMax').textContent = mx;
    $('bKeep').style.display = win ? '' : 'none';
    K.open('ovEnd');
    K.beep(win ? 660 : 220, 0.35, 'triangle', 0.07, win ? 990 : 110);
    if (window.SC) SC.post('gameover', { game: GAME, win: win, score: S.score });
    if (!win) offerLb();
  }
  function offerLb() {
    if (window.SCLB && S.score > 0) SCLB.offer({ game: GAME, mode: MODE, score: S.score, text: S.score + L(' 分', ' pts') + '（' + L('最大 ', 'max ') + maxTile() + '）' });
  }

  function persist() { K.save(SAVE, { g: S.g.map(function (t) { return t ? t.v : 0; }), score: S.score, undo: S.undo, won: S.won, over: S.over, moves: S.moves }); }
  function resume() {
    var s = K.load(SAVE, null);
    if (!s || !s.g || s.g.length !== N * N || s.over) return false;
    S = { g: s.g.map(function (v) { return v ? { id: nextId++, v: v } : null; }), score: s.score | 0, undo: s.undo == null ? 3 : s.undo, hist: [], won: !!s.won, over: false, moves: s.moves | 0 };
    if (!empties().length && !canMove()) return false;
    render(true);
    // 憑證不在（或已用過）就重新拿一張，只有開局時間會變長，不影響分數
    if (window.SCLB && !SCLB.has(GAME, MODE)) SCLB.start(GAME, MODE);
    return true;
  }

  // ---------- 操作 ----------
  var KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (KEYS[e.key] != null) { e.preventDefault(); move(KEYS[e.key]); }
    else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  });
  var board = $('board'), sx = 0, sy = 0, st = false;
  board.addEventListener('pointerdown', function (e) { st = true; sx = e.clientX; sy = e.clientY; });
  board.addEventListener('pointerup', function (e) {
    if (!st) return; st = false;
    var dx = e.clientX - sx, dy = e.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return;
    move(ax > ay ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  });
  board.addEventListener('pointercancel', function () { st = false; });
  board.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  function undo() {
    if (!S.undo || !S.hist.length || busy) return;
    var h = S.hist.pop(); S.undo--;
    S.g = h.g.map(function (t) { return t ? { id: t.id, v: t.v } : null; }); S.score = h.score; S.over = false;
    render(true); persist(); K.toast(L('已悔棋，剩 ', 'Undone. ') + S.undo + L(' 次', ' left'));
  }
  $('bUndo').onclick = undo;
  $('bNew').onclick = function () {
    // App 內的 WebView 不一定支援 confirm，改成「再按一次」
    if (S.moves > 5 && !S.over && !(Date.now() - (S.askNew || 0) < 2500)) { S.askNew = Date.now(); K.toast(L('再按一次「新局」放棄這局', 'Tap New again to abandon this game')); return; }
    K.close('ovEnd'); fresh();
  };
  $('bAgain').onclick = function () { K.close('ovEnd'); fresh(); };
  $('bKeep').onclick = function () { S.keep = true; K.close('ovEnd'); };
  $('bSound').onclick = function () { K.setMute(!K.muted); sound(); };
  function sound() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; }
  sound();

  // 格子底色
  var cells = $('cells'); for (var i = 0; i < N * N; i++) cells.appendChild(document.createElement('div'));
  if (!resume()) fresh();
})();
