/* 滑雪競速 — stockcorp.github.io/ski/
   俯視高山曲道。賽道固定（同一組亂數種子）：15000px = 1500m，旗門 48 道、樹、石頭、跳台。
   物理：方向角 θ（0 = 正下方），加速度 = G·cosθ − 阻力·v²；蹲低阻力小但轉向慢。漏門減速、撞到障礙摔倒。
   排行榜：mode = classic，完賽時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'ski', $ = K.$, L = K.L, W = 480, H = 620, LEN = 15000, SY = 190, G = 335, GS = 292;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), S = null, C = null, wind = FX.Noise('highpass'), snow = FX.Parts(260), floats = FX.Floats(), shake = FX.Shake();
  var flakes = []; for (var i = 0; i < 46; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2.2, v: 30 + Math.random() * 50 });

  function buildCourse() {
    var seed = 20261121, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var gates = [], obs = [], n = 48, i;
    for (i = 0; i < n; i++) { var gy = 520 + i * GS, k = i / n, gx = 240 + Math.sin(i * 0.92 + 0.6) * (90 + 50 * k) + (rnd() - 0.5) * 60; gates.push({ x: FX.clamp(gx, 90, 390), y: gy, w: 100 - 22 * k, red: i % 2 === 0, st: 0 }); }
    function pathX(y) { var f = (y - 520) / GS, a = Math.floor(f); if (a < 0) return 240 + (gates[0].x - 240) * Math.max(0, y / 520); if (a >= n - 1) return gates[n - 1].x; var t = f - a; t = t * t * (3 - 2 * t); return gates[a].x + (gates[a + 1].x - gates[a].x) * t; }
    for (var y = 260; y < LEN - 120; y += 40) {
      var px = pathX(y);
      for (var k2 = 0; k2 < 2; k2++) { var x = rnd() * W, r = rnd(); if (Math.abs(x - px) < 92) continue; obs.push(r < 0.72 ? { t: 'tree', x: x, y: y + rnd() * 30, r: 13, s: 0.8 + rnd() * 0.5 } : { t: 'rock', x: x, y: y + rnd() * 30, r: 12, s: 0.8 + rnd() * 0.4 }); }
      if (rnd() < 0.8) obs.push({ t: 'tree', x: rnd() < 0.5 ? rnd() * 34 : W - rnd() * 34, y: y, r: 13, s: 1 + rnd() * 0.4 });
    }
    for (i = 5; i < n - 2; i += 7) { var ry = gates[i].y + GS / 2; obs.push({ t: 'ramp', x: pathX(ry), y: ry, r: 0 }); }
    obs.sort(function (a, b) { return a.y - b.y; });
    C = { gates: gates, obs: obs, pathX: pathX };
  }
  function reset() {
    C.gates.forEach(function (g) { g.st = 0; });
    S = { x: 240, y: 60, th: 0, v: 0, run: false, started: false, over: false, t: 0, pass: 0, miss: 0, falls: 0, top: 0, air: 0, airT: 0, down: 0, trail: [], gi: 0, tuck: false, fin: false, lean: 0 };
    snow.clear(); floats.clear(); hud();
  }
  function hud() { $('time').textContent = fmt(S.t); $('gate').textContent = S.pass + '/' + C.gates.length; $('spd').textContent = Math.round(S.v * 0.22) + ' km/h'; }
  function fmt(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function start() { reset(); $('cover').classList.add('off'); K.close('ovEnd'); FX.countdown($('big'), function () { S.run = true; S.started = true; S.v = 80; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }); }
  function step(dt) {
    snow.step(dt); floats.step(dt); shake.step(dt);
    flakes.forEach(function (f) { f.y += (f.v + (S.run ? S.v * 0.25 : 0)) * dt; f.x += Math.sin(f.y / 40) * 12 * dt; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } });
    if (!S.run) { wind.set(0); return; }
    S.t += dt; var k = FX.keys;
    if (S.down > 0) { S.down -= dt; S.v = Math.max(0, S.v - 500 * dt); S.y += S.v * dt; if (S.down <= 0) { S.v = 70; S.th = 0; } hud(); return; }
    var steer = (k.right ? 1 : 0) - (k.left ? 1 : 0); S.tuck = !!(k.down || k.a) && !S.fin;
    if (S.air > 0) { S.air -= dt; if (S.air <= 0) { S.v *= 1.06; shake.kick(4); K.beep(120, 0.1, 'square', 0.04); snow.burst(S.x, SY + 12, 14, { c: '#fff', sp: 160, life: 0.5, size: 5, round: 1, g: 0 }); } }
    else {
      var rate = S.tuck ? 1.5 : 2.9;
      if (steer) S.th += steer * rate * dt; else S.th -= Math.sign(S.th) * Math.min(Math.abs(S.th), 0.9 * dt);
      S.th = FX.clamp(S.th, -1.25, 1.25); S.lean += (steer - S.lean) * Math.min(1, dt * 8);
    }
    var drag = S.tuck ? 0.0013 : 0.0021, carve = S.air > 0 ? 0 : Math.abs(steer) * 70 * (S.v / 400);
    if (S.fin) S.v = Math.max(0, S.v - 380 * dt); else S.v = Math.max(40, S.v + (G * Math.cos(S.th) - drag * S.v * S.v - 24 - carve) * dt);
    S.x += Math.sin(S.th) * S.v * dt; S.y += Math.cos(S.th) * S.v * dt; S.top = Math.max(S.top, S.v);
    if (S.x < 14 || S.x > W - 14) { S.x = FX.clamp(S.x, 14, W - 14); S.th *= -0.3; }
    // 雪花與軌跡
    if (S.air <= 0) { var lt = S.trail[S.trail.length - 1]; if (!lt || S.y - lt[1] > 6) { S.trail.push([S.x, S.y, S.th]); if (S.trail.length > 110) S.trail.shift(); } if (Math.abs(steer) && S.v > 120 && Math.random() < 0.8) snow.burst(S.x - steer * 8, SY + 6, 2, { c: 'rgba(255,255,255,.9)', sp: 110 + S.v * 0.2, life: 0.45, size: 4, round: 1, g: 60, ang: Math.PI / 2 - steer * 1.2 + Math.PI, spread: 0.5 }); } else if (S.trail.length && S.trail[S.trail.length - 1]) S.trail.push(null);
    // 旗門
    var g = C.gates[S.gi];
    if (g && S.y >= g.y) { S.gi++; if (Math.abs(S.x - g.x) <= g.w / 2 + 4) { g.st = 1; S.pass++; K.beep(g.red ? 880 : 1040, 0.08, 'triangle', 0.05); floats.add(S.x, SY - 30, '✓', '#4ade80', 20); } else { g.st = 2; S.miss++; if (S.air <= 0) S.v *= 0.35; FX.sfx.bad(); floats.add(S.x, SY - 30, L('漏門！', 'Missed!'), '#f87171', 20); shake.kick(5); } }
    // 障礙
    if (S.air <= 0) for (var i = 0; i < C.obs.length; i++) {
      var o = C.obs[i]; if (o.y < S.y - 30) continue; if (o.y > S.y + 30) break;
      if (o.t === 'ramp') { if (Math.abs(o.x - S.x) < 34 && Math.abs(o.y - S.y) < 12 && S.v > 150) { S.air = 0.55 + S.v / 900; S.airT = S.air; floats.add(S.x, SY - 40, L('飛躍！', 'AIR!'), '#fde047', 22); K.beep(400, 0.3, 'sine', 0.05, 900); } }
      else if (Math.hypot(o.x - S.x, o.y - S.y) < o.r * o.s + 6) { S.down = 1.25; S.falls++; S.v *= 0.5; FX.sfx.crash(); shake.kick(12); snow.burst(S.x, SY, 26, { c: '#fff', sp: 240, life: 0.7, size: 6, round: 1, g: 100 }); floats.add(S.x, SY - 36, L('摔倒！', 'Wipeout!'), '#f87171', 22); break; }
    }
    if (!S.fin && S.y >= LEN) { S.fin = true; finish(); }
    wind.set(Math.min(0.05, S.v / 9000), 2500); hud();
  }
  function finish() {
    var t = S.t, b = FX.best('scski_best', Math.round(t * 100) / 100, true); S.over = true; FX.sfx.great();
    $('endTime').textContent = fmt(t); $('endGate').textContent = S.pass + '/' + C.gates.length; $('endTop').textContent = Math.round(S.top * 0.22) + ' km/h';
    $('endBest').textContent = (b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + fmt(b.best)) + (S.miss + S.falls ? '　' + L('漏門 ', 'Missed ') + S.miss + L('・摔倒 ', ' · falls ') + S.falls : L('　完美滑行！', '　Clean run!'));
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    var sec = window.SCLB ? (SCLB.elapsed(GAME) || t) : t, s0 = S;
    setTimeout(function () { if (S !== s0) return; S.run = false; wind.stop(); K.open('ovEnd'); $('cover').classList.remove('off'); if (window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: sec, text: L('旗門 ', 'Gates ') + S.pass + '/' + C.gates.length }); }, 1600);
  }
  // ---------- 繪圖 ----------
  function hash(n) { var x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); }
  function tree(x, y, s) {
    ctx.fillStyle = 'rgba(60,90,140,.22)'; ctx.beginPath(); ctx.ellipse(x + 12 * s, y + 6 * s, 20 * s, 9 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b3d24'; ctx.fillRect(x - 3 * s, y - 4 * s, 6 * s, 10 * s);
    for (var i = 0; i < 3; i++) { var w = (20 - i * 5) * s, ty = y - (8 + i * 13) * s; ctx.fillStyle = i % 2 ? '#1c7a48' : '#166a3e'; ctx.beginPath(); ctx.moveTo(x, ty - 20 * s); ctx.lineTo(x + w, ty); ctx.lineTo(x - w, ty); ctx.fill(); ctx.fillStyle = '#f1f7fc'; ctx.beginPath(); ctx.moveTo(x, ty - 20 * s); ctx.lineTo(x + w * 0.5, ty - 9 * s); ctx.lineTo(x, ty - 12 * s); ctx.lineTo(x - w * 0.5, ty - 9 * s); ctx.fill(); }
  }
  function rock(x, y, s) { ctx.fillStyle = 'rgba(60,90,140,.22)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 7, 16 * s, 7 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(x - 14 * s, y + 8 * s); ctx.lineTo(x - 8 * s, y - 8 * s); ctx.lineTo(x + 4 * s, y - 12 * s); ctx.lineTo(x + 14 * s, y + 8 * s); ctx.fill(); ctx.fillStyle = '#f1f7fc'; ctx.beginPath(); ctx.moveTo(x - 8 * s, y - 8 * s); ctx.lineTo(x + 4 * s, y - 12 * s); ctx.lineTo(x + 7 * s, y - 5 * s); ctx.lineTo(x - 4 * s, y - 3 * s); ctx.fill(); }
  function flag(x, y, red, st) { ctx.fillStyle = 'rgba(60,90,140,.25)'; ctx.fillRect(x, y, 16, 3); ctx.fillStyle = '#334155'; ctx.fillRect(x - 1.5, y - 30, 3, 32); ctx.fillStyle = st === 1 ? '#4ade80' : st === 2 ? '#94a3b8' : red ? '#ef4444' : '#2563eb'; ctx.beginPath(); ctx.moveTo(x + 1.5, y - 30); ctx.lineTo(x + 20, y - 24); ctx.lineTo(x + 1.5, y - 17); ctx.fill(); }
  function skier() {
    var down = S.down > 0, air = S.air > 0 ? Math.sin((1 - S.air / S.airT) * Math.PI) : 0, sc = 1 + air * 0.45;
    ctx.fillStyle = 'rgba(40,70,120,.28)'; ctx.beginPath(); ctx.ellipse(S.x + 6 + air * 16, SY + 8 + air * 26, 13, 6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(S.x, SY - air * 12); ctx.rotate(down ? S.t * 14 : -S.th * 0.9); ctx.scale(sc, sc);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(-5, 18); ctx.moveTo(5, -14); ctx.lineTo(5, 18); ctx.stroke();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-15 - S.lean * 3, 12); ctx.moveTo(9, -2); ctx.lineTo(15 - S.lean * 3, 12); ctx.stroke();
    var tk = S.tuck ? 0.8 : 1; ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.ellipse(S.lean * 2, 0, 9, 11 * tk, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.fillRect(-9 + S.lean * 2, -2, 18, 3);
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(S.lean * 3, 3 * tk, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#7dd3fc'; ctx.fillRect(-4 + S.lean * 3, 5 * tk, 8, 2.5);
    ctx.restore();
  }
  function draw(time) {
    var cy = S.y - SY, i;
    ctx.save(); shake.apply(ctx);
    var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#f8fbff'); g.addColorStop(1, '#dbe9f6'); ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    for (i = Math.floor(cy / 90) - 1; i <= Math.floor((cy + H) / 90) + 1; i++) { ctx.fillStyle = 'rgba(120,165,215,' + (0.08 + hash(i) * 0.08) + ')'; ctx.beginPath(); ctx.ellipse(hash(i * 3.1) * W, i * 90 - cy + hash(i * 7.7) * 60, 70 + hash(i * 1.3) * 90, 12 + hash(i * 2.9) * 12, 0, 0, 7); ctx.fill(); }
    ctx.translate(0, -cy);
    // 終點
    ctx.fillStyle = '#ef4444'; ctx.fillRect(40, LEN - 4, W - 80, 8); for (i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(40 + i * 20, LEN - 4, 20, 8); }
    ctx.fillStyle = '#334155'; ctx.fillRect(36, LEN - 70, 6, 70); ctx.fillRect(W - 42, LEN - 70, 6, 70); ctx.fillStyle = '#e11d48'; FX.rr(ctx, 36, LEN - 92, W - 72, 28, 6); ctx.fill(); FX.text(ctx, 'FINISH', W / 2, LEN - 77, 18, '#fff');
    // 滑痕
    ctx.strokeStyle = 'rgba(120,160,205,.5)'; ctx.lineWidth = 2;
    [-5, 5].forEach(function (off) { ctx.beginPath(); var pen = false; S.trail.forEach(function (p) { if (!p) { pen = false; return; } var x = p[0] + Math.cos(p[2]) * off, y = p[1]; if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; } }); ctx.stroke(); });
    // 旗門連線
    C.gates.forEach(function (gt) { if (gt.y < cy - 40 || gt.y > cy + H + 40) return; if (!gt.st) { ctx.strokeStyle = gt.red ? 'rgba(239,68,68,.22)' : 'rgba(37,99,235,.22)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(gt.x - gt.w / 2, gt.y); ctx.lineTo(gt.x + gt.w / 2, gt.y); ctx.stroke(); ctx.setLineDash([]); } });
    var drawn = false, all = C.obs;
    function things(from, to) {
      for (var j = 0; j < all.length; j++) { var o = all[j]; if (o.y < from) continue; if (o.y >= to) break; if (o.t === 'tree') tree(o.x, o.y, o.s); else if (o.t === 'rock') rock(o.x, o.y, o.s); else { ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.moveTo(o.x - 34, o.y + 10); ctx.lineTo(o.x + 34, o.y + 10); ctx.lineTo(o.x + 28, o.y - 8); ctx.lineTo(o.x - 28, o.y - 8); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.fillRect(o.x - 28, o.y - 8, 56, 6); FX.text(ctx, '▼▼▼', o.x, o.y + 3, 9, '#fff'); } }
      C.gates.forEach(function (gt) { if (gt.y >= from && gt.y < to) { flag(gt.x - gt.w / 2, gt.y, gt.red, gt.st); flag(gt.x + gt.w / 2, gt.y, gt.red, gt.st); } });
    }
    things(cy - 60, S.y + 4);
    ctx.translate(0, cy); snow.draw(ctx); skier(); ctx.translate(0, -cy);
    things(S.y + 4, cy + H + 80);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; flakes.forEach(function (f) { ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, 7); ctx.fill(); });
    floats.draw(ctx);
    // 進度條
    var ph = 260, py = 120; ctx.fillStyle = 'rgba(15,23,42,.35)'; FX.rr(ctx, W - 20, py, 8, ph, 4); ctx.fill(); ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(W - 16, py + ph * Math.min(1, S.y / LEN), 7, 0, 7); ctx.fill(); FX.text(ctx, '🏁', W - 16, py + ph + 14, 13);
    if (S.tuck && S.run) FX.text(ctx, L('蹲低加速', 'TUCK'), W / 2, H - 30, 14, '#0369a1');
  }
  FX.pad($('touch'), [{ k: 'left', t: '◀' }, { k: 'right', t: '▶' }, { gap: 1 }, { k: 'down', t: '⬇', cls: 'wide go' }]);
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; start(); } };
  FX.sound(function () { if (K.muted) wind.stop(); });
  buildCourse(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__sk2 = { S: function () { return S; }, C: C, go: function () { reset(); $('cover').classList.add('off'); S.run = true; S.started = true; S.v = 80; } };
})();
