/* 水果合成 — stockcorp.github.io/merge/
   邏輯 400×600；圓形 Verlet 物理（重力、碰撞、牆壁）；同級水果碰到就合成下一級。
   分數：合成到第 k 級得 (k+1)(k+2)/2；兩顆西瓜再合成得 100。排行榜 mode = classic。 */
(function () {
  'use strict';
  var GAME = 'merge', $ = K.$, L = K.L, W = 400, H = 600, TOP = 90, G = 1500;
  var F = [['🍒', 15, '#dc2626'], ['🍓', 20, '#f43f5e'], ['🍇', 27, '#7c3aed'], ['🍊', 33, '#f97316'], ['🍎', 41, '#ef4444'], ['🍐', 50, '#a3e635'], ['🍑', 58, '#fb923c'], ['🍍', 67, '#facc15'], ['🥥', 77, '#a16207'], ['🍈', 88, '#86efac'], ['🍉', 100, '#16a34a']];
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;
  (function () { var r = Math.min(2, window.devicePixelRatio || 1); cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); })();
  function newGame() {
    S = { b: [], score: 0, cur: rnd(), nxt: rnd(), x: W / 2, cool: 0, over: false, started: false, danger: 0, big: 0, fx: [], px: [], fl: [], chain: 0, chainT: 0 };
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
    if (a.t < F.length - 1) { var x = (a.x + c.x) / 2, y = (a.y + c.y) / 2, r = F[nt][1]; S.b.push({ x: x, y: y, px: x, py: y + 1, r: r, t: nt, born: 0, mg: 1 }); if (nt > S.big) { S.big = nt; if (nt >= 7) K.toast(L('合成了 ', 'You made ') + F[nt][0] + '！', 1200); } }
    S.fx.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, r: F[nt][1], c: F[nt][2], t: 0.35 });
    var now2 = performance.now(), mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2; S.chain = now2 - S.chainT < 900 ? S.chain + 1 : 1; S.chainT = now2;
    for (var pi = 0; pi < 10 + nt * 2; pi++) { var an = Math.random() * 6.283, v = 80 + Math.random() * (140 + nt * 14); S.px.push({ x: mx, y: my, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 80, life: 0.45 + Math.random() * 0.35, r: 2.5 + Math.random() * 4, c: Math.random() < 0.3 ? '#fff' : F[nt][2] }); }
    S.fl.push({ x: mx, y: my - F[nt][1] * 0.5, t: 1, txt: '+' + pts, c: '#b45309', s: 17 + Math.min(12, nt * 1.4) }); if (S.chain >= 2) S.fl.push({ x: W / 2, y: TOP + 46, t: 1.1, txt: L('連鎖 ×', 'Chain ×') + S.chain, c: '#e11d48', s: 24 });
    K.beep(400 + nt * 70, 0.1, 'triangle', 0.05); K.beep(600 + nt * 70 + S.chain * 60, 0.12, 'sine', 0.04); navigator.vibrate && navigator.vibrate(8); if (nt >= 6) K.shake(cv, 3 + nt - 5);
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
  var SPR = [], DPR = Math.min(2, window.devicePixelRatio || 1);
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k))); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function sprite(t) { // 每種水果先畫成一張圖：漸層果球＋表情符號
    if (SPR[t]) return SPR[t]; var f = F[t], r = f[1], c = document.createElement('canvas'), q = 2, sz = (r * 2 + 8) * q; c.width = c.height = sz; var g = c.getContext('2d'); g.scale(q, q); var m = r + 4;
    var gr = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r); gr.addColorStop(0, shade(f[2], 0.55)); gr.addColorStop(0.55, f[2]); gr.addColorStop(1, shade(f[2], -0.35)); g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, 7); g.fill();
    g.strokeStyle = shade(f[2], -0.5); g.lineWidth = Math.max(1.5, r * 0.06); g.stroke();
    g.font = Math.round(r * 1.15) + 'px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f[0], m, m + r * 0.08);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(m - r * 0.38, m - r * 0.48, r * 0.3, r * 0.16, -0.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(m - r * 0.58, m - r * 0.2, r * 0.06, 0, 7); g.fill();
    SPR[t] = c; return c;
  }
  function fruit(x, y, t, alpha, rot, sc) {
    var r = F[t][1], sp = sprite(t), d = (r * 2 + 8) * (sc || 1);
    ctx.globalAlpha = alpha || 1; ctx.fillStyle = 'rgba(120,53,15,.16)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.92, r * 0.8, r * 0.22, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(sp, -d / 2, -d / 2, d, d); ctx.restore(); ctx.globalAlpha = 1;
  }
  function draw() {
    var now = performance.now(), dt = 0.016, i;
    var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#fff7e0'); bg.addColorStop(1, '#fcd98a'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc((i * 137) % W, 120 + (i * 211) % 420, 26 + (i * 13) % 30, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(180,83,9,.12)'; ctx.fillRect(0, H - 10, W, 10); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(6, TOP, 5, H - TOP - 16); ctx.fillStyle = 'rgba(180,83,9,.08)'; ctx.fillRect(W - 9, TOP, 5, H - TOP - 16);
    var hot = S.danger > 0.3; ctx.strokeStyle = hot ? 'rgba(220,38,38,' + (0.5 + 0.5 * Math.sin(now / 80)) + ')' : 'rgba(220,38,38,.6)';
    ctx.setLineDash([12, 8]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, TOP); ctx.lineTo(W, TOP); ctx.stroke(); ctx.setLineDash([]);
    if (hot) { ctx.fillStyle = 'rgba(220,38,38,' + (0.08 + 0.06 * Math.sin(now / 80)) + ')'; ctx.fillRect(0, 0, W, TOP); }
    if (!S.over) {
      var r = F[S.cur][1], x = Math.max(r, Math.min(W - r, S.x));
      ctx.strokeStyle = 'rgba(120,53,15,.28)'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.moveTo(x, TOP - 8); ctx.lineTo(x, H); ctx.stroke(); ctx.setLineDash([]);
      fruit(x, TOP - r - 4 + Math.sin(now / 250) * 2, S.cur, S.cool > 0 ? 0.4 : 1, 0, S.cool > 0 ? 0.8 : 1);
    }
    S.b.forEach(function (b) { b.rot = (b.rot || 0) + (b.x - b.px) / b.r; b.age = (b.age || 0) + dt; var pop = b.mg && b.age < 0.22 ? 1 + Math.sin(b.age / 0.22 * Math.PI) * 0.22 : 1; fruit(b.x, b.y, b.t, 1, b.rot, pop); });
    S.fx.forEach(function (f) { ctx.strokeStyle = f.c; ctx.globalAlpha = Math.min(1, f.t * 3); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.7 - f.t * 2), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
    S.px.forEach(function (q) { q.life -= dt; q.vy += 520 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) return; ctx.globalAlpha = Math.min(1, q.life * 3); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; S.px = S.px.filter(function (q) { return q.life > 0; });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    S.fl.forEach(function (q) { q.t -= dt; if (q.t <= 0) return; ctx.globalAlpha = Math.min(1, q.t * 2.5); ctx.font = '900 ' + q.s + 'px ui-rounded,system-ui,sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(q.txt, q.x, q.y - (1 - q.t) * 44); ctx.fillStyle = q.c; ctx.fillText(q.txt, q.x, q.y - (1 - q.t) * 44); }); ctx.globalAlpha = 1; S.fl = S.fl.filter(function (q) { return q.t > 0; });
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
