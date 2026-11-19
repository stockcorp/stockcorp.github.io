/* 消滅星星 — stockcorp.github.io/popstar/
   10×10、5 色。消 n 個得 n²×5；關卡結束剩 k 個（k<10）獎勵 2000−k²×20。目標分數：1000, 3000, 5000…（第 n 關 = 1000 + (n−1)×2000，第 6 關後每關 +3000）。
   排行榜：mode = classic，總分越高越好。 */
(function () {
  'use strict';
  var GAME = 'popstar', $ = K.$, L = K.L, N = 10;
  var COL = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, size = 400, anim = [];
  function target(lv) { return lv <= 5 ? 1000 + (lv - 1) * 2000 : 9000 + (lv - 5) * 3000; }
  function newGame() { S = { score: 0, level: 0, over: false, started: false, busy: false }; K.close('ovEnd'); nextLevel(); }
  function nextLevel() {
    S.level++; S.g = []; for (var c = 0; c < N; c++) { S.g.push([]); for (var r = 0; r < N; r++) S.g[c].push((Math.random() * 5) | 0); } // g[col][row]，row 0 在最下面
    $('level').textContent = S.level; $('target').textContent = target(S.level).toLocaleString();
    msg(L('第 ' + S.level + ' 關　目標 ', 'Level ' + S.level + ' · target ') + target(S.level).toLocaleString());
    resize();
  }
  function msg(t) { $('msg').textContent = t || ''; }
  function group(c, r) {
    var k = S.g[c][r], seen = {}, st = [[c, r]], out = [];
    while (st.length) { var p = st.pop(), key = p[0] * 16 + p[1]; if (seen[key]) continue; seen[key] = 1; if (!S.g[p[0]] || S.g[p[0]][p[1]] !== k) continue; out.push(p); st.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]); }
    return out;
  }
  function anyMove() { for (var c = 0; c < S.g.length; c++) for (var r = 0; r < S.g[c].length; r++) { var k = S.g[c][r]; if ((S.g[c][r + 1] === k) || (S.g[c + 1] && S.g[c + 1][r] === k)) return true; } return false; }
  function left() { return S.g.reduce(function (a, col) { return a + col.length; }, 0); }
  function tap(c, r) {
    if (!S || S.over || S.busy || !S.g[c] || S.g[c][r] === undefined) return;
    var g = group(c, r); if (g.length < 2) { K.beep(150, 0.04, 'square', 0.02); return; }
    if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
    var pts = g.length * g.length * 5, size2 = cellSize();
    g.forEach(function (p) { var xy = pos(p[0], p[1]); for (var k = 0; k < 3; k++) anim.push({ x: xy[0] + size2 / 2, y: xy[1] + size2 / 2, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 300, c: COL[S.g[p[0]][p[1]]], t: 0.6 }); });
    var rm = {}; g.forEach(function (p) { (rm[p[0]] = rm[p[0]] || []).push(p[1]); });
    Object.keys(rm).forEach(function (c2) { rm[c2].sort(function (a, b) { return b - a; }).forEach(function (r2) { S.g[c2].splice(r2, 1); }); });
    S.g = S.g.filter(function (col) { return col.length; });
    S.score += pts; $('score').textContent = S.score.toLocaleString();
    msg(g.length + L(' 連消 +', ' popped +') + pts);
    K.beep(500 + Math.min(g.length, 20) * 30, 0.1, 'triangle', 0.05); navigator.vibrate && navigator.vibrate(10);
    draw();
    if (!anyMove()) { S.busy = true; setTimeout(endLevel, 700); }
  }
  function endLevel() {
    var k = left(), bonus = k < 10 ? 2000 - k * k * 20 : 0;
    S.score += bonus; $('score').textContent = S.score.toLocaleString();
    msg(L('剩 ', 'Left ') + k + L(' 個，獎勵 ', ', bonus ') + bonus);
    setTimeout(function () {
      S.busy = false;
      if (S.score >= target(S.level)) { K.beep(660, 0.3, 'triangle', 0.06, 1320); K.toast(L('過關！', 'Level clear!'), 1000); nextLevel(); }
      else gameOver();
    }, 1400);
  }
  function gameOver() {
    S.over = true;
    var best = K.load('scpop_best', 0), nb = S.score > best; if (nb) K.save('scpop_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endLevel').textContent = S.level;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    K.beep(220, 0.5, 'sawtooth', 0.05, 110);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.started && S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: L('第 ', 'Level ') + S.level + L(' 關', '') }); }, 400);
  }
  function cellSize() { return size / N; }
  function pos(c, r) { var cs = cellSize(); return [c * cs, size - (r + 1) * cs]; }
  function resize() { var w = Math.min(window.innerWidth - 20, 520, Math.max(280, window.innerHeight - 200)), dpr = Math.min(2, window.devicePixelRatio || 1); size = w; cv.width = w * dpr; cv.height = w * dpr; cv.style.width = w + 'px'; cv.style.height = w + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  var raf = 0, last = 0;
  function draw() {
    var cs = cellSize(), pd = cs * 0.06;
    ctx.clearRect(0, 0, size, size);
    S.g.forEach(function (col, c) { col.forEach(function (k, r) {
      var p = pos(c, r), x = p[0] + pd, y = p[1] + pd, w = cs - pd * 2;
      var g = ctx.createLinearGradient(x, y, x, y + w); g.addColorStop(0, '#fff'); g.addColorStop(0.15, COL[k]); g.addColorStop(1, COL[k]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, w, w * 0.2) : ctx.rect(x, y, w, w); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; star(x + w / 2, y + w / 2, w * 0.24);
    }); });
    anim.forEach(function (a) { ctx.globalAlpha = Math.max(0, a.t / 0.6); ctx.fillStyle = a.c; ctx.fillRect(a.x - 3, a.y - 3, 6, 6); }); ctx.globalAlpha = 1;
    if (anim.length && !raf) { last = performance.now(); raf = requestAnimationFrame(tickA); }
  }
  function tickA(t) { var dt = Math.min(0.05, (t - last) / 1000); last = t; anim.forEach(function (a) { a.x += a.vx * dt; a.y += a.vy * dt; a.vy += 900 * dt; a.t -= dt; }); anim = anim.filter(function (a) { return a.t > 0; }); raf = 0; draw(); }
  function star(x, y, r) { ctx.beginPath(); for (var i = 0; i < 10; i++) { var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
  cv.addEventListener('click', function (e) { var r = cv.getBoundingClientRect(), cs = r.width / N, c = Math.floor((e.clientX - r.left) / cs), row = Math.floor((r.bottom - e.clientY) / cs); tap(c, row); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__ps = { S: function () { return S; }, tap: tap, auto: function () { var f = function () { if (S.over) return; if (!S.busy) { var best = null, bl = 0; S.g.forEach(function (col, c) { col.forEach(function (_, r) { var g = group(c, r); if (g.length > bl) { bl = g.length; best = [c, r]; } }); }); if (best && bl > 1) tap(best[0], best[1]); } setTimeout(f, 15); }; f(); } };
  newGame();
})();
