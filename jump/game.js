/* 跳一跳 — stockcorp.github.io/jump/
   世界座標用「地面平面 (x,z)」，以斜角投影畫成 2.5D。平台輪流往右前或左前出現。
   蓄力時間 → 跳躍距離（每秒 300 單位，上限 1.4 秒）。排行榜：mode = classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'jump', $ = K.$, L = K.L, W = 420, H = 620;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;
  (function () { var r = Math.min(2, window.devicePixelRatio || 1); cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); })();
  var COLS = [['#f472b6', '#be185d'], ['#60a5fa', '#1d4ed8'], ['#fbbf24', '#b45309'], ['#34d399', '#047857'], ['#a78bfa', '#6d28d9'], ['#f87171', '#b91c1c'], ['#e2e8f0', '#64748b']];
  // 投影：x 往右下、z 往左下（等角）
  function proj(x, z, y) { return [(x - z) * 0.866, -(x + z) * 0.5 - (y || 0)]; }
  function newGame() {
    S = { plats: [], score: 0, jumps: 0, combo: 0, state: 'idle', charge: 0, p: null, cam: [0, 0], over: false, started: false, fx: [], px: [], rings: [], pop: 0, cs: 0 };
    addPlat(0, 0, 70, 0); nextPlat();
    S.p = { x: 0, z: 0, y: 0, sq: 0 }; S.cur = 0; S.cam = target(); $('msg').textContent = L('按住蓄力，放開就跳', 'Hold to charge, release to jump');
    K.close('ovEnd'); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function addPlat(x, z, size, dir) { S.plats.push({ x: x, z: z, s: size || 64, dir: dir, c: COLS[(Math.random() * COLS.length) | 0], round: Math.random() < 0.4, h: 28, deco: (Math.random() * 3) | 0, born: S.plats.length < 2 ? -9999 : performance.now() }); }
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
      if (center) { S.combo++; var add = S.combo * 2; S.score += add; S.fx.push({ x: n.x, z: n.z, t: 0.8, txt: '+' + add, big: 1 }); K.tune([880, 1100 + S.combo * 40, 1320 + S.combo * 60], 60); K.buzz(12); S.rings.push({ x: n.x, z: n.z, t: 0.6, max: 0.6, s: n.s * 0.7 }, { x: n.x, z: n.z, t: 0.85, max: 0.85, s: n.s * 1.1 }); dust(n, 14, ['#fff', '#fde047', '#f9a8d4']); }
      else { S.combo = 0; S.score += 1; S.fx.push({ x: n.x, z: n.z, t: 0.8, txt: '+1' }); K.beep(620, 0.08, 'triangle', 0.05); dust({ x: x, z: z }, 7, ['#fff']); }
      S.pop = 1;
      S.state = 'idle'; nextPlat(); if (S.plats.length > 8) S.plats.shift();
      return;
    }
    if (onPlat(c, x, z)) { S.combo = 0; S.state = 'idle'; return; }
    S.state = 'fall'; S.fallT = 0; K.beep(160, 0.5, 'sawtooth', 0.06, 60); K.buzz(60); K.shake(cv, 8);
    setTimeout(gameOver, 700);
  }
  function dust(o, n, cols) { var c = proj(o.x, o.z); for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = 40 + Math.random() * 90; S.px.push({ x: c[0], y: c[1], vx: Math.cos(a) * v * 1.22, vy: Math.sin(a) * v * 0.7 - 30, life: 0.5 + Math.random() * 0.3, r: 2 + Math.random() * 3, c: cols[(Math.random() * cols.length) | 0] }); } }
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
    if (S.state === 'charge') { S.charge += dt; if (S.charge > 1.4) S.charge = 1.4; S.cs -= dt; if (S.cs <= 0 && S.charge < 1.4) { S.cs = 0.07; K.beep(200 + S.charge * 420, 0.06, 'sine', 0.025); } }
    if (S.pop > 0) S.pop -= dt * 4; S.px.forEach(function (q) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * dt; }); S.px = S.px.filter(function (q) { return q.life > 0; }); S.rings.forEach(function (r) { r.t -= dt; }); S.rings = S.rings.filter(function (r) { return r.t > 0; });
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
  function sp(x, z, y) { var p = proj(x, z, y); return [p[0] - S.cam[0], p[1] - S.cam[1]]; }
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k))); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function plat(pl, now) {
    var s = pl.s / 2, age = (now - pl.born) / 1000, drop = age < 0.45 ? (1 - age / 0.45) : 0, bounce = drop > 0 ? drop * drop * 260 : (age < 0.7 ? Math.sin((age - 0.45) / 0.25 * Math.PI) * -6 : 0);
    var press = (S.state === 'charge' && pl === S.plats[S.plats.length - 2]) ? Math.min(1, S.charge / 1.4) * 9 : 0, h = pl.h - press, lift = bounce - press, c = sp(pl.x, pl.z), cx = c[0], cy = c[1] - lift, al = drop > 0 ? 1 - drop * 0.6 : 1;
    // 地上的影子
    ctx.fillStyle = 'rgba(40,30,90,' + 0.16 * al + ')'; ctx.beginPath(); ctx.ellipse(c[0] + 10, c[1] + pl.h + 14, s * 1.3, s * 0.72, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = al;
    if (pl.round) {
      var rx = s * 1.22, ry = s * 0.7, g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0); g.addColorStop(0, shade(pl.c[1], 0.12)); g.addColorStop(0.5, pl.c[1]); g.addColorStop(1, shade(pl.c[1], -0.3));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + h, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
      var tg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry); tg.addColorStop(0, shade(pl.c[0], 0.3)); tg.addColorStop(1, pl.c[0]); ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
      if (pl.deco === 1) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.72, ry * 0.72, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.42, ry * 0.42, 0, 0, 7); ctx.stroke(); }
      else if (pl.deco === 2) { ctx.strokeStyle = shade(pl.c[1], -0.1); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.5, rx, ry, 0, 0.15, Math.PI - 0.15); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.13, ry * 0.13, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; return;
    }
    var P = [[pl.x - s, pl.z - s], [pl.x + s, pl.z - s], [pl.x + s, pl.z + s], [pl.x - s, pl.z + s]].map(function (q) { var p = sp(q[0], q[1]); return [p[0], p[1] - lift]; });
    // 左前面（亮）、右前面（暗）
    ctx.fillStyle = shade(pl.c[1], 0.1); ctx.beginPath(); ctx.moveTo(P[3][0], P[3][1]); ctx.lineTo(P[0][0], P[0][1]); ctx.lineTo(P[0][0], P[0][1] + h); ctx.lineTo(P[3][0], P[3][1] + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(pl.c[1], -0.28); ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo(P[1][0], P[1][1] + h); ctx.lineTo(P[0][0], P[0][1] + h); ctx.closePath(); ctx.fill();
    if (pl.deco === 2) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(P[3][0], P[3][1] + h * 0.4); ctx.lineTo(P[0][0], P[0][1] + h * 0.4); ctx.lineTo(P[1][0], P[1][1] + h * 0.4); ctx.lineTo(P[1][0], P[1][1] + h * 0.62); ctx.lineTo(P[0][0], P[0][1] + h * 0.62); ctx.lineTo(P[3][0], P[3][1] + h * 0.62); ctx.closePath(); ctx.fill(); }
    var tg2 = ctx.createLinearGradient(P[3][0], P[2][1], P[1][0], P[0][1]); tg2.addColorStop(0, shade(pl.c[0], 0.32)); tg2.addColorStop(1, pl.c[0]); ctx.fillStyle = tg2;
    ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (pl.deco === 1) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.62, s * 0.36, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.17, s * 0.1, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function hero(now) {
    var sq = S.state === 'charge' ? S.charge / 1.4 : 0, press = sq * 9, p = sp(S.p.x, S.p.z, S.p.y), x = p[0], y = p[1] + press, g = sp(S.p.x, S.p.z), air = Math.min(1, S.p.y / 80);
    if (S.state !== 'fall') { ctx.fillStyle = 'rgba(20,10,60,' + (0.3 - air * 0.15) + ')'; ctx.beginPath(); ctx.ellipse(g[0], g[1] + press, 13 - air * 4, 6.5 - air * 2, 0, 0, 7); ctx.fill(); }
    if (sq > 0.05) for (var i = 0; i < 6; i++) { var a = now / 140 + i * 1.05, rr = 30 - ((now / 6 + i * 13) % 30); ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + sq * 0.6) + ')'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y - 12 + Math.sin(a) * rr * 0.5, 2 + sq * 1.5, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(x, y); if (S.p.rot) ctx.rotate(S.p.rot * (S.jump && S.jump.ez > S.jump.sz ? -1 : 1)); ctx.scale(1 + sq * 0.3, 1 - sq * 0.42);
    var bg = ctx.createLinearGradient(-12, 0, 12, 0); bg.addColorStop(0, '#4f46e5'); bg.addColorStop(0.5, '#6366f1'); bg.addColorStop(1, '#312e81'); ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-13, -4, -7, -30); ctx.lineTo(7, -30); ctx.quadraticCurveTo(13, -4, 12, 0); ctx.quadraticCurveTo(0, 5, -12, 0); ctx.fill();
    ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.ellipse(0, -29, 8.5, 3.4, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, -29); ctx.lineTo(-17 - (S.state === 'air' ? 6 : 0), -24 + Math.sin(now / 90) * 2); ctx.lineTo(-7, -25); ctx.fill();
    var hg = ctx.createRadialGradient(-3, -44, 2, 0, -40, 11); hg.addColorStop(0, '#818cf8'); hg.addColorStop(1, '#3730a3'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -40, 10.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-3.5, -40, 2.6, 3.2, 0, 0, 7); ctx.ellipse(4, -40, 2.6, 3.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(-3, -39.5, 1.3, 0, 7); ctx.arc(4.5, -39.5, 1.3, 0, 7); ctx.fill();
    ctx.restore();
  }
  var blobs = []; for (var bi = 0; bi < 9; bi++) blobs.push({ x: Math.random() * W, y: Math.random() * H, r: 40 + Math.random() * 80, k: 0.15 + Math.random() * 0.35 });
  function draw() {
    var now = performance.now(), hue = (232 + S.score * 2.2) % 360, bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'hsl(' + hue + ',85%,88%)'); bg.addColorStop(1, 'hsl(' + ((hue + 28) % 360) + ',80%,78%)'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    blobs.forEach(function (b) { var x = ((b.x - S.cam[0] * b.k) % (W + 240) + W + 240) % (W + 240) - 120, y = ((b.y - S.cam[1] * b.k) % (H + 240) + H + 240) % (H + 240) - 120; ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill(); });
    // 由後往前畫（x+z 小的先畫）
    var list = S.plats.slice().sort(function (a, b) { return (b.x + b.z) - (a.x + a.z); });
    var heroDepth = S.p.x + S.p.z, drawn = false;
    list.forEach(function (pl) { if (!drawn && S.state === 'fall' && pl.x + pl.z < heroDepth) { hero(now); drawn = true; } plat(pl, now); });
    S.rings.forEach(function (r) { var c = sp(r.x, r.z), k = 1 - r.t / r.max; ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(c[0], c[1], (12 + k * r.s) * 1.22, (12 + k * r.s) * 0.7, 0, 0, 7); ctx.stroke(); });
    if (!drawn) hero(now);
    S.px.forEach(function (q) { ctx.globalAlpha = Math.min(1, q.life * 3); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x - S.cam[0], q.y - S.cam[1], q.r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    S.fx.forEach(function (f) { var p = sp(f.x, f.z, 70 + (0.8 - f.t) * 70), big = f.big; ctx.globalAlpha = Math.min(1, f.t * 3); ctx.font = '900 ' + (big ? 26 : 19) + 'px ui-rounded,system-ui,sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(f.txt, p[0], p[1]); ctx.fillStyle = big ? '#e11d48' : '#4338ca'; ctx.fillText(f.txt, p[0], p[1]); }); ctx.globalAlpha = 1;
    var pop = 1 + Math.max(0, S.pop) * 0.5; ctx.save(); ctx.translate(24, 62); ctx.scale(pop, pop); ctx.font = '900 48px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.strokeText(S.score, 0, 0); ctx.fillStyle = '#312e81'; ctx.fillText(S.score, 0, 0); ctx.restore();
    if (S.combo > 1) { ctx.font = '900 16px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#e11d48'; ctx.fillText(L('連續正中 ×', 'Perfect ×') + S.combo, 24, 88); }
    if (S.state === 'charge') { var cw = 150, k2 = S.charge / 1.4; ctx.fillStyle = 'rgba(49,46,129,.2)'; ctx.fillRect(W / 2 - cw / 2, H - 46, cw, 10); var cg = ctx.createLinearGradient(W / 2 - cw / 2, 0, W / 2 + cw / 2, 0); cg.addColorStop(0, '#34d399'); cg.addColorStop(0.6, '#fbbf24'); cg.addColorStop(1, '#ef4444'); ctx.fillStyle = cg; ctx.fillRect(W / 2 - cw / 2, H - 46, cw * k2, 10); }
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
