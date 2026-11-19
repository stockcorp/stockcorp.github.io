/* 跳一跳 — stockcorp.github.io/jump/
   世界座標用「地面平面 (x,z)」，以斜角投影畫成 2.5D。平台輪流往右前或左前出現。
   蓄力時間 → 跳躍距離（每秒 300 單位，上限 1.4 秒）。排行榜：mode = classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'jump', $ = K.$, L = K.L, W = 420, H = 620;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;
  var COLS = [['#f472b6', '#be185d'], ['#60a5fa', '#1d4ed8'], ['#fbbf24', '#b45309'], ['#34d399', '#047857'], ['#a78bfa', '#6d28d9'], ['#f87171', '#b91c1c'], ['#e2e8f0', '#64748b']];
  // 投影：x 往右下、z 往左下（等角）
  function proj(x, z, y) { return [(x - z) * 0.866, -(x + z) * 0.5 - (y || 0)]; }
  function newGame() {
    S = { plats: [], score: 0, jumps: 0, combo: 0, state: 'idle', charge: 0, p: null, cam: [0, 0], over: false, started: false, fx: [] };
    addPlat(0, 0, 70, 0); nextPlat();
    S.p = { x: 0, z: 0, y: 0, sq: 0 }; S.cur = 0; S.cam = target(); $('msg').textContent = L('按住蓄力，放開就跳', 'Hold to charge, release to jump');
    K.close('ovEnd'); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function addPlat(x, z, size, dir) { S.plats.push({ x: x, z: z, s: size || 64, dir: dir, c: COLS[(Math.random() * COLS.length) | 0], round: Math.random() < 0.4, h: 28 }); }
  function nextPlat() {
    var c = S.plats[S.plats.length - 1], dir = Math.random() < 0.5 ? 0 : 1, lvl = Math.min(1, S.score / 60);
    var dist = 110 + Math.random() * (110 + lvl * 60), size = Math.max(34, 70 - lvl * 26 - Math.random() * 14);
    addPlat(c.x + (dir ? 0 : dist), c.z + (dir ? dist : 0), size, dir);
  }
  function target() { var a = S.plats[S.plats.length - 2], b = S.plats[S.plats.length - 1], m = proj((a.x + b.x) / 2, (a.z + b.z) / 2); return [m[0] - W / 2, m[1] - H * 0.55]; }
  function press() { if (!S || S.over || S.state !== 'idle') return; S.state = 'charge'; S.charge = 0; $('msg').textContent = ''; if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); } }
  function release() {
    if (!S || S.state !== 'charge') return;
    var c = S.plats[S.plats.length - 2], n = S.plats[S.plats.length - 1], dx = n.x - S.p.x, dz = n.z - S.p.z, len = Math.hypot(dx, dz) || 1;
    var dist = Math.min(1.4, S.charge) * 300;
    S.jump = { sx: S.p.x, sz: S.p.z, ex: S.p.x + dx / len * dist, ez: S.p.z + dz / len * dist, t: 0, dur: 0.45 };
    S.state = 'air'; S.jumps++; K.beep(420 + dist, 0.08, 'triangle', 0.05);
  }
  function onPlat(pl, x, z) { var dx = Math.abs(x - pl.x), dz = Math.abs(z - pl.z), r = pl.s / 2; return pl.round ? Math.hypot(dx, dz) <= r : dx <= r && dz <= r; }
  function land() {
    var c = S.plats[S.plats.length - 2], n = S.plats[S.plats.length - 1], x = S.p.x, z = S.p.z;
    if (onPlat(n, x, z)) {
      var center = Math.hypot(x - n.x, z - n.z) < n.s * 0.14;
      if (center) { S.combo++; var add = S.combo * 2; S.score += add; S.fx.push({ x: n.x, z: n.z, t: 0.6, txt: '+' + add }); K.beep(880, 0.15, 'triangle', 0.06, 1320); }
      else { S.combo = 0; S.score += 1; S.fx.push({ x: n.x, z: n.z, t: 0.6, txt: '+1' }); K.beep(620, 0.08, 'triangle', 0.05); }
      S.state = 'idle'; nextPlat(); if (S.plats.length > 8) S.plats.shift();
      return;
    }
    if (onPlat(c, x, z)) { S.combo = 0; S.state = 'idle'; return; }
    S.state = 'fall'; S.fallT = 0; K.beep(160, 0.5, 'sawtooth', 0.06, 60);
    setTimeout(gameOver, 700);
  }
  function gameOver() {
    if (S.over) return; S.over = true;
    var best = K.load('scjump_best', 0), nb = S.score > best; if (nb) K.save('scjump_best', S.score);
    $('endScore').textContent = S.score; $('endJumps').textContent = S.jumps;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    K.open('ovEnd');
    if (S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: S.jumps + L(' 跳', ' jumps') });
  }
  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (S.state === 'charge') { S.charge += dt; if (S.charge > 1.4) S.charge = 1.4; }
    if (S.state === 'air') {
      var j = S.jump; j.t += dt; var k = Math.min(1, j.t / j.dur);
      S.p.x = j.sx + (j.ex - j.sx) * k; S.p.z = j.sz + (j.ez - j.sz) * k; S.p.y = Math.sin(k * Math.PI) * (60 + Math.hypot(j.ex - j.sx, j.ez - j.sz) * 0.25); S.p.rot = k * Math.PI * 2;
      if (k >= 1) { S.p.y = 0; S.p.rot = 0; land(); }
    }
    if (S.state === 'fall') { S.fallT += dt; S.p.y -= 260 * dt; }
    var tg = target(); S.cam[0] += (tg[0] - S.cam[0]) * Math.min(1, dt * 4); S.cam[1] += (tg[1] - S.cam[1]) * Math.min(1, dt * 4);
    S.fx.forEach(function (f) { f.t -= dt; }); S.fx = S.fx.filter(function (f) { return f.t > 0; });
    draw(); raf = requestAnimationFrame(loop);
  }
  function plat(pl) {
    var s = pl.s / 2, h = pl.h;
    if (pl.round) {
      var c = proj(pl.x, pl.z), cx = c[0] - S.cam[0], cy = c[1] - S.cam[1], rx = s * 1.22, ry = s * 0.7;
      ctx.fillStyle = pl.c[1]; ctx.beginPath(); ctx.ellipse(cx, cy + h, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pl.c[0]; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.14, ry * 0.14, 0, 0, 7); ctx.fill();
      return;
    }
    var P = [[pl.x - s, pl.z - s], [pl.x + s, pl.z - s], [pl.x + s, pl.z + s], [pl.x - s, pl.z + s]].map(function (q) { var p = proj(q[0], q[1]); return [p[0] - S.cam[0], p[1] - S.cam[1]]; });
    ctx.fillStyle = pl.c[1];
    ctx.beginPath(); ctx.moveTo(P[3][0], P[3][1]); ctx.lineTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo(P[1][0], P[1][1] + h); ctx.lineTo(P[0][0], P[0][1] + h); ctx.lineTo(P[3][0], P[3][1] + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo(P[1][0], P[1][1] + h); ctx.lineTo(P[0][0], P[0][1] + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pl.c[0]; ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill();
    var c2 = proj(pl.x, pl.z); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(c2[0] - S.cam[0], c2[1] - S.cam[1], s * 0.17, s * 0.1, 0, 0, 7); ctx.fill();
  }
  function hero() {
    var p = proj(S.p.x, S.p.z, S.p.y), x = p[0] - S.cam[0], y = p[1] - S.cam[1], sq = S.state === 'charge' ? S.charge / 1.4 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; var g = proj(S.p.x, S.p.z); ctx.beginPath(); ctx.ellipse(g[0] - S.cam[0], g[1] - S.cam[1], 12, 6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); if (S.p.rot) ctx.rotate(S.p.rot * (S.jump && S.jump.ez > S.jump.sz ? -1 : 1)); ctx.scale(1 + sq * 0.25, 1 - sq * 0.4);
    ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(6, -30); ctx.lineTo(-6, -30); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -40, 10, 0, 7); ctx.fill();
    ctx.restore();
  }
  function draw() {
    var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#e0e7ff'); bg.addColorStop(1, '#c7d2fe'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 由後往前畫（x+z 小的先畫）
    var list = S.plats.slice().sort(function (a, b) { return (b.x + b.z) - (a.x + a.z); });
    var heroDepth = S.p.x + S.p.z, drawn = false;
    list.forEach(function (pl) { if (!drawn && S.state === 'fall' && pl.x + pl.z < heroDepth) { hero(); drawn = true; } plat(pl); });
    if (!drawn) hero();
    ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
    S.fx.forEach(function (f) { var p = proj(f.x, f.z, 70 + (0.6 - f.t) * 60); ctx.globalAlpha = Math.min(1, f.t * 3); ctx.fillStyle = '#4338ca'; ctx.fillText(f.txt, p[0] - S.cam[0], p[1] - S.cam[1]); }); ctx.globalAlpha = 1;
    ctx.fillStyle = '#312e81'; ctx.font = '900 46px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(S.score, 20, 60);
    if (S.state === 'charge') { ctx.fillStyle = 'rgba(67,56,202,.25)'; ctx.fillRect(20, 76, 120, 8); ctx.fillStyle = '#4338ca'; ctx.fillRect(20, 76, 120 * S.charge / 1.4, 8); }
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); press(); });
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release); cv.addEventListener('pointerleave', release);
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; if (e.key === ' ' && !e.repeat) { e.preventDefault(); press(); } });
  document.addEventListener('keyup', function (e) { if (e.key === ' ') release(); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__jp = { S: function () { return S; }, perfect: function () { var n = S.plats[S.plats.length - 1]; var d = Math.hypot(n.x - S.p.x, n.z - S.p.z); press(); S.charge = d / 300; release(); }, miss: function () { press(); S.charge = 1.4; release(); } };
  newGame();
})();
