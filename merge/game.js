/* 水果合成 — stockcorp.github.io/merge/
   邏輯 400×600；圓形 Verlet 物理（重力、碰撞、牆壁）；同級水果碰到就合成下一級。
   分數：合成到第 k 級得 (k+1)(k+2)/2；兩顆西瓜再合成得 100。排行榜 mode = classic。 */
(function () {
  'use strict';
  var GAME = 'merge', $ = K.$, L = K.L, W = 400, H = 600, TOP = 90, G = 1500;
  var F = [['🍒', 15, '#dc2626'], ['🍓', 20, '#f43f5e'], ['🍇', 27, '#7c3aed'], ['🍊', 33, '#f97316'], ['🍎', 41, '#ef4444'], ['🍐', 50, '#a3e635'], ['🍑', 58, '#fb923c'], ['🍍', 67, '#facc15'], ['🥥', 77, '#a16207'], ['🍈', 88, '#86efac'], ['🍉', 100, '#16a34a']];
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;
  function newGame() {
    S = { b: [], score: 0, cur: rnd(), nxt: rnd(), x: W / 2, cool: 0, over: false, started: false, danger: 0, big: 0, fx: [] };
    K.close('ovEnd'); hud(); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function rnd() { return (Math.random() * 5) | 0; }
  function hud() { $('score').textContent = S.score.toLocaleString(); $('next').textContent = F[S.nxt][0]; $('big').textContent = F[S.big][0]; }
  function drop() {
    if (S.over || S.cool > 0) return;
    if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
    var r = F[S.cur][1], x = Math.max(r, Math.min(W - r, S.x));
    S.b.push({ x: x, y: TOP - r - 4, px: x, py: TOP - r - 4, r: r, t: S.cur, born: performance.now() });
    S.cur = S.nxt; S.nxt = rnd(); S.cool = 0.45; hud(); K.beep(500, 0.04, 'sine', 0.03);
  }
  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (!S.over) { var sub = 4; for (var i = 0; i < sub; i++) step(dt / sub); S.cool -= dt; checkDanger(dt); }
    S.fx.forEach(function (f) { f.t -= dt; }); S.fx = S.fx.filter(function (f) { return f.t > 0; });
    draw(); raf = requestAnimationFrame(loop);
  }
  function step(dt) {
    var bs = S.b, i, j;
    for (i = 0; i < bs.length; i++) { var b = bs[i], vx = (b.x - b.px) * 0.998, vy = (b.y - b.py) * 0.998; b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + G * dt * dt; }
    for (var it = 0; it < 6; it++) {
      for (i = 0; i < bs.length; i++) for (j = i + 1; j < bs.length; j++) {
        var a = bs[i], c = bs[j], dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy, rr = a.r + c.r;
        if (d2 >= rr * rr || d2 === 0) continue;
        var d = Math.sqrt(d2);
        if (a.t === c.t && !a.dead && !c.dead) { merge(a, c); continue; }
        var ov = (rr - d) / d, ma = c.r * c.r, mb = a.r * a.r, s = ma + mb;
        a.x -= dx * ov * ma / s; a.y -= dy * ov * ma / s; c.x += dx * ov * mb / s; c.y += dy * ov * mb / s;
      }
      for (i = 0; i < bs.length; i++) { var e = bs[i]; if (e.x < e.r) e.x = e.r; if (e.x > W - e.r) e.x = W - e.r; if (e.y > H - e.r) { e.y = H - e.r; e.px = e.x - (e.x - e.px) * 0.6; } }
      S.b = bs = bs.filter(function (x) { return !x.dead; });
    }
  }
  function merge(a, c) {
    a.dead = c.dead = true;
    var nt = Math.min(a.t + 1, F.length - 1), pts = a.t === F.length - 1 ? 100 : (nt + 1) * (nt + 2) / 2;
    S.score += pts;
    if (a.t < F.length - 1) { var x = (a.x + c.x) / 2, y = (a.y + c.y) / 2, r = F[nt][1]; S.b.push({ x: x, y: y, px: x, py: y + 1, r: r, t: nt, born: 0 }); if (nt > S.big) { S.big = nt; if (nt >= 7) K.toast(L('合成了 ', 'You made ') + F[nt][0] + '！', 1200); } }
    S.fx.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, r: F[nt][1], c: F[nt][2], t: 0.35 });
    K.beep(400 + nt * 70, 0.08, 'triangle', 0.05); navigator.vibrate && navigator.vibrate(8);
    hud();
  }
  function checkDanger(dt) {
    var now = performance.now(), over = S.b.some(function (b) { return b.born < now - 1200 && b.y - b.r < TOP && Math.abs(b.y - b.py) < 2; });
    S.danger = over ? S.danger + dt : Math.max(0, S.danger - dt * 2);
    if (S.danger > 2) gameOver();
  }
  function gameOver() {
    S.over = true;
    var best = K.load('scmerge_best', 0), nb = S.score > best; if (nb) K.save('scmerge_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endBig').textContent = F[S.big][0];
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    K.beep(220, 0.5, 'sawtooth', 0.05, 110);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.started && S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: L('最大 ', 'Biggest ') + F[S.big][0] }); }, 600);
  }
  function fruit(x, y, t, alpha) {
    var f = F[t], r = f[1];
    ctx.globalAlpha = alpha || 1;
    ctx.fillStyle = f[2]; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, 7); ctx.fill();
    ctx.font = Math.round(r * 1.25) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f[0], x, y + r * 0.08);
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = S.danger > 0.3 ? 'rgba(220,38,38,' + (0.5 + 0.5 * Math.sin(performance.now() / 80)) + ')' : 'rgba(220,38,38,.75)';
    ctx.setLineDash([12, 8]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, TOP); ctx.lineTo(W, TOP); ctx.stroke(); ctx.setLineDash([]);
    if (!S.over) {
      var r = F[S.cur][1], x = Math.max(r, Math.min(W - r, S.x));
      ctx.strokeStyle = 'rgba(120,53,15,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, TOP - 8); ctx.lineTo(x, H); ctx.stroke();
      fruit(x, TOP - r - 4, S.cur, S.cool > 0 ? 0.4 : 1);
    }
    S.b.forEach(function (b) { fruit(b.x, b.y, b.t); });
    S.fx.forEach(function (f) { ctx.strokeStyle = f.c; ctx.globalAlpha = f.t * 3; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.6 - f.t * 2), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
  }
  function toX(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
  var down = false;
  cv.addEventListener('pointerdown', function (e) { if (!S || S.over) return; down = true; S.x = toX(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', function (e) { if (S && !S.over && (down || e.pointerType === 'mouse')) S.x = toX(e); });
  cv.addEventListener('pointerup', function (e) { if (!down) return; down = false; S.x = toX(e); drop(); });
  document.addEventListener('keydown', function (e) { if (!S || S.over || (K.isOpen && K.isOpen())) return; if (e.key === 'ArrowLeft') S.x -= 15; else if (e.key === 'ArrowRight') S.x += 15; else if (e.key === ' ' || e.key === 'ArrowDown') drop(); else return; S.x = Math.max(0, Math.min(W, S.x)); e.preventDefault(); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__mg = { S: function () { return S; }, drop: function (x) { S.x = x; S.cool = 0; drop(); } };
  newGame();
})();
