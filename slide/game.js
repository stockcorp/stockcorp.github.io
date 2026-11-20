/* 數字華容道 — stockcorp.github.io/slide/
   從完成狀態隨機走很多步打亂（一定有解）。排行榜：mode = 3x3/4x4/5x5，解題時間（伺服器計時）。 */
(function () {
  'use strict';
  var GAME = 'slide', $ = K.$, L = K.L, S = null, tick = null, els = [];
  function newGame(sz) {
    sz = sz || '4x4'; var n = parseInt(sz, 10), b = [];
    for (var i = 1; i < n * n; i++) b.push(i); b.push(0);
    var e = n * n - 1, last = -1;
    for (var k = 0; k < n * n * 40; k++) { var nb = nbs(n, e).filter(function (x) { return x !== last; }), t = nb[(Math.random() * nb.length) | 0]; b[e] = b[t]; b[t] = 0; last = e; e = t; }
    S = { sz: sz, n: n, b: b, moves: 0, started: false, over: false, t0: 0 };
    if (solved()) return newGame(sz);
    clearInterval(tick); $('clock').textContent = '0:00'; $('moves').textContent = 0; K.close('ovEnd'); K.save('scslide_sz', sz);
    $('bLb').href = '/leaderboard/?game=slide&mode=' + sz; $('sub').textContent = sz.replace('x', '×');
    build();
  }
  function nbs(n, i) { var x = i % n, y = (i / n) | 0, o = []; if (x > 0) o.push(i - 1); if (x < n - 1) o.push(i + 1); if (y > 0) o.push(i - n); if (y < n - 1) o.push(i + n); return o; }
  function solved() { for (var i = 0; i < S.n * S.n - 1; i++) if (S.b[i] !== i + 1) return false; return true; }
  function build() {
    var bd = $('board'); bd.innerHTML = ''; els = [];
    for (var v = 1; v < S.n * S.n; v++) { var t = document.createElement('div'); t.className = 'tile'; t.textContent = v; t.dataset.v = v; bd.appendChild(t); els[v] = t; }
    layout();
  }
  function layout() {
    var n = S.n, W = $('board').clientWidth, pad = W * 0.025, cs = (W - pad * 2) / n, g = cs * 0.06;
    S.b.forEach(function (v, i) { if (!v) return; var e = els[v]; e.style.left = pad + (i % n) * cs + g + 'px'; e.style.top = pad + ((i / n) | 0) * cs + g + 'px'; e.style.width = e.style.height = cs - g * 2 + 'px'; e.style.fontSize = cs * 0.42 + 'px'; e.classList.toggle('ok', v === i + 1); });
  }
  function slideFrom(i) {
    if (!S || S.over) return;
    var n = S.n, e = S.b.indexOf(0), ex = e % n, ey = (e / n) | 0, x = i % n, y = (i / n) | 0, step;
    if (x === ex && y !== ey) step = y < ey ? -n : n; else if (y === ey && x !== ex) step = x < ex ? -1 : 1; else return;
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, S.sz); if (window.SC) SC.post('start', { game: GAME, level: S.sz }); tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
    while (e !== i) { var nx = e + step; S.b[e] = S.b[nx]; S.b[nx] = 0; e = nx; S.moves++; }
    $('moves').textContent = S.moves; K.beep(500, 0.03, 'triangle', 0.035); K.buzz(6); layout();
    if (solved()) win();
  }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scslide_best', {}), nb = !best[S.sz] || t < best[S.sz];
    if (nb) { best[S.sz] = t; K.save('scslide_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endMoves').textContent = S.moves;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.sz]);
    K.tune([523, 659, 784, 1047, 1319], 95);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.sz, score: sec, text: S.sz.replace('x', '×') + '・' + S.moves + L(' 步', ' moves') }); } }, 500);
  }
  var bd = $('board'), sw = null;
  bd.addEventListener('pointerdown', function (e) { sw = { x: e.clientX, y: e.clientY, t: e.target.closest('.tile') }; });
  bd.addEventListener('pointerup', function (e) {
    if (!sw) return; var dx = e.clientX - sw.x, dy = e.clientY - sw.y, s = sw; sw = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) { move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); return; }
    if (s.t) slideFrom(S.b.indexOf(+s.t.dataset.v));
  });
  // 方向＝方塊移動方向：例如 'l' 把空格右邊的方塊往左推
  function move(d) { var n = S.n, e = S.b.indexOf(0), x = e % n, y = (e / n) | 0, t = d === 'l' ? (x < n - 1 ? e + 1 : -1) : d === 'r' ? (x > 0 ? e - 1 : -1) : d === 'u' ? (y < n - 1 ? e + n : -1) : (y > 0 ? e - n : -1); if (t >= 0) slideFrom(t); }
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; var m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' }[e.key]; if (m) { e.preventDefault(); move(m); } });
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.sz); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', function () { if (S) layout(); });
  if (location.hash.indexOf('#test') === 0) window.__sl = { S: function () { return S; }, slideFrom: slideFrom, cheat: function () { S.b = S.b.map(function (_, i) { return i === S.n * S.n - 1 ? 0 : i + 1; }); var a = S.n * S.n - 1; S.b[a] = S.b[a - 1]; S.b[a - 1] = 0; slideFrom(a); } };
  newGame(K.load('scslide_sz', '4x4'));
})();
