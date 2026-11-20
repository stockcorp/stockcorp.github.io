/* 一筆畫 — stockcorp.github.io/oneline/
   每題先隨機產生一條走遍格子的路徑（Warnsdorff＋回溯），沒走到的格子變成障礙，所以保證有解。
   3 分鐘挑戰；排行榜 mode = 3min，解開題數越多越好。 */
(function () {
  'use strict';
  var GAME = 'oneline', $ = K.$, L = K.L, LIMIT = 180;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, P = null, tick = null, size = 400;
  function nb(n, i) { var x = i % n, y = (i / n) | 0, o = []; if (x > 0) o.push(i - 1); if (x < n - 1) o.push(i + 1); if (y > 0) o.push(i - n); if (y < n - 1) o.push(i + n); return o; }
  // 產生方式：隨機起點做 Warnsdorff 走法（優先走「出路最少」的格子），走到卡住為止；沒走到的格子變障礙。
  function gen(n) {
    var best = null;
    for (var t = 0; t < 120; t++) {
      var start = (Math.random() * n * n) | 0, used = {}, path = [start]; used[start] = 1;
      var deg = function (x) { return nb(n, x).filter(function (y) { return !used[y]; }).length; };
      while (true) {
        var c = path[path.length - 1], opts = nb(n, c).filter(function (x) { return !used[x]; });
        if (!opts.length) break;
        opts.sort(function (a, b) { return deg(a) - deg(b) + (Math.random() - 0.5) * 1.2; });
        used[opts[0]] = 1; path.push(opts[0]);
      }
      var cov = path.length / (n * n);
      if (cov >= 0.8 && cov <= 0.94) { best = path; break; }
      if (!best || Math.abs(cov - 0.88) < Math.abs(best.length / (n * n) - 0.88)) best = path;
    }
    var blocked = {}, inP = {}; best.forEach(function (c) { inP[c] = 1; });
    for (var i = 0; i < n * n; i++) if (!inP[i]) blocked[i] = 1;
    return { n: n, blocked: blocked, start: best[0], total: best.length, sol: best.slice() };
  }
  var steps = 0;
  function level(k) { return gen(Math.min(9, 4 + Math.floor(k / 2))); }
  function start() {
    S = { solved: 0, big: 0, t0: Date.now(), over: false, pen: 0 };
    if (window.SCLB) SCLB.start(GAME, '3min'); if (window.SC) SC.post('start', { game: GAME });
    $('bNew').textContent = L('重新開始', 'Restart'); K.close('ovEnd');
    nextPuzzle();
    clearInterval(tick); tick = setInterval(timer, 200); timer();
  }
  function left() { return S ? Math.max(0, LIMIT - (Date.now() - S.t0) / 1000 - S.pen) : LIMIT; }
  function timer() { if (!S || S.over) return; var l = left(); $('clock').textContent = K.fmtTime(Math.ceil(l)); if (l <= 0) end(); }
  function nextPuzzle() { P = level(S.solved); P.path = [P.start]; resize(); }
  function end() {
    S.over = true; clearInterval(tick); $('clock').textContent = '0:00'; $('bNew').textContent = L('開始', 'Start');
    var best = K.load('scone_best', 0), nb2 = S.solved > best; if (nb2) K.save('scone_best', S.solved);
    $('endSolved').textContent = S.solved; $('endBig').textContent = S.big ? S.big + '×' + S.big : '—';
    $('endBest').textContent = nb2 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    K.tune([523, 659, 784, 1047, 1319], 95);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.solved });
    setTimeout(function () { K.open('ovEnd'); if (S.solved > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: '3min', score: S.solved, text: L('最大 ', 'Largest ') + S.big + '×' + S.big }); }, 400);
  }
  function resize() { var w = Math.min(window.innerWidth - 20, 520, Math.max(280, window.innerHeight - 220)), dpr = Math.min(2, window.devicePixelRatio || 1); size = w; cv.width = w * dpr; cv.height = w * dpr; cv.style.width = w + 'px'; cv.style.height = w + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  function draw() {
    ctx.clearRect(0, 0, size, size);
    if (!P) { ctx.fillStyle = '#94a3b8'; ctx.font = '18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(L('按「開始」挑戰 3 分鐘', 'Press Start for a 3-minute run'), size / 2, size / 2); return; }
    var n = P.n, cs = size / n, gp = cs * 0.08, inP = {};
    P.path.forEach(function (c, i) { inP[c] = i + 1; });
    for (var i = 0; i < n * n; i++) {
      var x = (i % n) * cs, y = ((i / n) | 0) * cs;
      if (P.blocked[i]) { ctx.fillStyle = '#04121a'; ctx.fillRect(x + gp, y + gp, cs - gp * 2, cs - gp * 2); continue; }
      var cg = ctx.createLinearGradient(x, y, x, y + cs); if (inP[i]) { cg.addColorStop(0, '#155e75'); cg.addColorStop(1, '#0e4a5c'); } else { cg.addColorStop(0, '#2a6478'); cg.addColorStop(1, '#1a4352'); } ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + gp, y + gp, cs - gp * 2, cs - gp * 2, cs * 0.18) : ctx.rect(x + gp, y + gp, cs - gp * 2, cs - gp * 2); ctx.fill();
    }
    var lg = ctx.createLinearGradient(0, 0, size, size); lg.addColorStop(0, '#67e8f9'); lg.addColorStop(0.5, '#a78bfa'); lg.addColorStop(1, '#f472b6'); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
    ctx.strokeStyle = lg; ctx.lineWidth = cs * 0.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    P.path.forEach(function (c, k) { var x = (c % n) * cs + cs / 2, y = ((c / n) | 0) * cs + cs / 2; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.shadowBlur = 0;
    if (P.path.length) { var hc = P.path[P.path.length - 1], hx = (hc % n) * cs + cs / 2, hy = ((hc / n) | 0) * cs + cs / 2; ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(hx, hy, cs * 0.13, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    var s = P.start, sx = (s % n) * cs + cs / 2, sy = ((s / n) | 0) * cs + cs / 2; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(sx, sy, cs * 0.22, 0, 7); ctx.fill();
    var e = P.path[P.path.length - 1], ex = (e % n) * cs + cs / 2, ey = ((e / n) | 0) * cs + cs / 2; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, cs * 0.17, 0, 7); ctx.fill();
  }
  function cellAt(e) { var r = cv.getBoundingClientRect(), n = P.n, x = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n); return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x; }
  function visit(c) {
    if (c < 0 || !P || P.done || !S || S.over) return;
    var path = P.path, last = path[path.length - 1];
    if (c === last) return;
    if (path.length > 1 && c === path[path.length - 2]) { path.pop(); K.beep(300, 0.02, 'sine', 0.02); draw(); return; }
    var k = path.indexOf(c); if (k >= 0) { path.length = k + 1; draw(); return; }
    if (P.blocked[c] || nb(P.n, last).indexOf(c) < 0) return;
    path.push(c); K.beep(400 + path.length * 8, 0.02, 'triangle', 0.025); draw();
    if (path.length === P.total) solved();
  }
  function solved() {
    P.done = true;
    S.solved++; S.big = Math.max(S.big, P.n); $('solved').textContent = S.solved;
    K.tune([660, 880, 1175], 55); navigator.vibrate && navigator.vibrate(15); K.burst(K.at || cv, { n: 18, star: 1, c: ['#22d3ee', '#fde047', '#fff'], size: 6, sp: 190 }); K.float(K.at || cv, '+1', '#22d3ee', 26);
    $('msg').textContent = '✓'; setTimeout(function () { $('msg').textContent = ''; }, 400);
    setTimeout(function () { if (!S.over) nextPuzzle(); }, 250);
  }
  var down = false;
  cv.addEventListener('pointerdown', function (e) { if (!S || S.over) { if (!S || S.over) start(); return; } down = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} visit(cellAt(e)); });
  cv.addEventListener('pointermove', function (e) { if (down) visit(cellAt(e)); });
  cv.addEventListener('pointerup', function () { down = false; });
  $('bClear').onclick = function () { if (P) { P.path = [P.start]; draw(); } };
  $('bSkip').onclick = function () { if (!S || S.over) return; S.pen += 10; K.toast(L('跳過，扣 10 秒', 'Skipped — 10 seconds off'), 900); nextPuzzle(); };
  $('bNew').onclick = function () { if (S && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次重新開始', 'Tap again to restart')); return; } start(); };
  $('bAgain').onclick = start;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__ol = { P: function () { return P; }, S: function () { return S; }, start: start, gen: gen, visit: visit, end: function () { S.t0 -= LIMIT * 1000; } };
  resize();
})();
