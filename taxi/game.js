/* 計程車衝衝衝 — stockcorp.github.io/taxi/
   俯視開放城市：7×7 街區（每格 300、馬路寬 120），建築與停車場是實心、公園可穿越（草地降速）。
   乘客在人行道招手，靠近並慢下來就上車；送到目的地光圈內停下收車資 + 小費（依剩餘時間）。
   排行榜：mode = 3min，比 3 分鐘內的總收入。 */
(function () {
  'use strict';
  var GAME = 'taxi', $ = K.$, L = K.L, W = 480, H = 620, NB = 7, BS = 300, RW = 120, PT = BS + RW, WORLD = NB * PT + RW, TIME = 180, VMAX = 440;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), S = null, parts = FX.Parts(200), floats = FX.Floats(), shake = FX.Shake(), eng = FX.Engine('sawtooth'), blocks = [], cache = {};
  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
  (function () { for (var x = 0; x < NB; x++) { blocks[x] = []; for (var y = 0; y < NB; y++) { var h = hash(x + 3, y + 7); blocks[x][y] = h < 0.17 ? 'park' : h < 0.27 ? 'lot' : 'bld'; } } blocks[3][3] = 'park'; })();
  var ROOF = ['#b4654e', '#8d99ae', '#d9c5a0', '#6b7f99', '#a3b18a', '#c9ada7', '#7d8597', '#e0b98c', '#9a8c98', '#577590'], CARC = ['#ef4444', '#3b82f6', '#f8fafc', '#22c55e', '#a855f7', '#64748b', '#f97316', '#0ea5e9'];
  function blockCv(bx, by) {
    var key = bx + '_' + by; if (cache[key]) return cache[key];
    var c = document.createElement('canvas'); c.width = c.height = BS; var g = c.getContext('2d'), t = blocks[bx][by], sd = bx * 31 + by * 17, n = 0, r = function () { return hash(sd + (n++) * 1.37, by + n * 0.71); };
    g.fillStyle = '#a8adb8'; g.fillRect(0, 0, BS, BS); g.strokeStyle = '#8b909c'; g.lineWidth = 1; for (var i = 0; i <= BS; i += 20) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 16); g.moveTo(i, BS - 16); g.lineTo(i, BS); g.moveTo(0, i); g.lineTo(16, i); g.moveTo(BS - 16, i); g.lineTo(BS, i); g.stroke(); }
    g.strokeStyle = '#d6d9df'; g.lineWidth = 2; g.strokeRect(1, 1, BS - 2, BS - 2);
    if (t === 'park') {
      g.fillStyle = '#5aa856'; FX.rr(g, 14, 14, BS - 28, BS - 28, 14); g.fill(); g.fillStyle = '#69b864'; for (i = 0; i < 26; i++) { g.beginPath(); g.arc(24 + r() * 252, 24 + r() * 252, 6 + r() * 12, 0, 7); g.fill(); }
      g.strokeStyle = '#e4d3a6'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 150); g.quadraticCurveTo(150, 110 + r() * 80, 286, 150); g.moveTo(150, 14); g.quadraticCurveTo(120 + r() * 60, 150, 150, 286); g.stroke();
      var px = 70 + r() * 30, py = 200 + r() * 20; g.fillStyle = '#3b9bd9'; g.beginPath(); g.ellipse(px, py, 36, 24, 0.3, 0, 7); g.fill(); g.fillStyle = '#7cc4ef'; g.beginPath(); g.ellipse(px - 8, py - 6, 14, 7, 0.3, 0, 7); g.fill();
      for (i = 0; i < 13; i++) { var tx = 34 + r() * 232, ty = 34 + r() * 232; if (Math.abs(tx - 150) < 22 || Math.abs(ty - 150) < 26 || Math.hypot(tx - px, ty - py) < 46) continue; g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(tx + 4, ty + 5, 15, 0, 7); g.fill(); g.fillStyle = '#2f7d3b'; g.beginPath(); g.arc(tx, ty, 15, 0, 7); g.fill(); g.fillStyle = '#48a052'; g.beginPath(); g.arc(tx - 4, ty - 4, 8, 0, 7); g.fill(); }
    } else if (t === 'lot') {
      g.fillStyle = '#474c59'; g.fillRect(16, 16, BS - 32, BS - 32); g.strokeStyle = '#e5e7eb'; g.lineWidth = 2;
      for (var row = 0; row < 2; row++) for (i = 0; i < 8; i++) { var lx = 28 + i * 31, ly = row ? 190 : 34; g.strokeRect(lx, ly, 31, 76); if (r() < 0.6) { g.save(); g.translate(lx + 15.5, ly + 38); if (row) g.rotate(Math.PI); FX.car(g, 22, 46, CARC[Math.floor(r() * CARC.length)]); g.restore(); } }
      g.fillStyle = '#facc15'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('P', 150, 160);
    } else {
      var lots = r() < 0.3 ? [[16, 16, 268, 268]] : r() < 0.5 ? [[16, 16, 130, 268], [154, 16, 130, 268]] : r() < 0.5 ? [[16, 16, 268, 130], [16, 154, 268, 130]] : [[16, 16, 130, 130], [154, 16, 130, 130], [16, 154, 130, 130], [154, 154, 130, 130]];
      g.fillStyle = '#5b606b'; g.fillRect(16, 16, 268, 268);
      lots.forEach(function (q) {
        var col = ROOF[Math.floor(r() * ROOF.length)], x = q[0] + 3, y = q[1] + 3, w = q[2] - 6, h = q[3] - 6;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 5, y + 6, w, h); g.fillStyle = FX.shade(col, 0.25); g.fillRect(x, y, w, h); g.fillStyle = col; g.fillRect(x + 6, y + 6, w - 12, h - 12);
        g.fillStyle = FX.shade(col, -0.18); g.fillRect(x + 6, y + h - 14, w - 12, 8); g.fillRect(x + w - 14, y + 6, 8, h - 12);
        var k = 2 + Math.floor(r() * 4); for (var j = 0; j < k; j++) { var ax = x + 16 + r() * (w - 52), ay = y + 16 + r() * (h - 52), kind = r(); if (kind < 0.4) { g.fillStyle = '#cbd5e1'; g.fillRect(ax, ay, 18, 14); g.fillStyle = '#64748b'; g.fillRect(ax + 3, ay + 3, 12, 8); } else if (kind < 0.65) { g.fillStyle = '#60a5fa'; g.fillRect(ax, ay, 26, 16); g.strokeStyle = '#e2e8f0'; g.lineWidth = 2; g.strokeRect(ax, ay, 26, 16); } else if (kind < 0.85) { g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(ax + 10, ay + 10, 10, 0, 7); g.fill(); g.fillStyle = '#cbd5e1'; g.beginPath(); g.arc(ax + 8, ay + 8, 6, 0, 7); g.fill(); } else if (w > 200 && h > 200) { g.strokeStyle = '#fef08a'; g.lineWidth = 3; g.beginPath(); g.arc(x + w / 2, y + h / 2, 30, 0, 7); g.stroke(); g.fillStyle = '#fef08a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('H', x + w / 2, y + h / 2 + 11); } }
      });
    }
    cache[key] = c; return c;
  }
  function spot(avoid, dmin, dmax) { // 人行道上的隨機位置
    for (var tries = 0; tries < 200; tries++) {
      var bx = Math.floor(Math.random() * NB), by = Math.floor(Math.random() * NB), side = Math.floor(Math.random() * 4), o = 40 + Math.random() * 220, x0 = RW + bx * PT, y0 = RW + by * PT;
      var p = side === 0 ? { x: x0 + o, y: y0 + 8 } : side === 1 ? { x: x0 + BS - 8, y: y0 + o } : side === 2 ? { x: x0 + o, y: y0 + BS - 8 } : { x: x0 + 8, y: y0 + o };
      if (avoid) { var d = Math.abs(p.x - avoid.x) + Math.abs(p.y - avoid.y); if (d < dmin || d > dmax) continue; }
      var ok = true; if (S) S.ps.forEach(function (q) { if (Math.hypot(q.x - p.x, q.y - p.y) < 200) ok = false; }); if (ok) return p;
    }
    return { x: RW + 150, y: RW + 8 };
  }
  function newPass() { var p = spot(), d = spot(p, 600, 2600); p.dst = d; p.dist = Math.abs(p.x - d.x) + Math.abs(p.y - d.y); p.col = p.dist < 1100 ? '#4ade80' : p.dist < 1900 ? '#fde047' : '#f87171'; p.shirt = CARC[Math.floor(Math.random() * CARC.length)]; S.ps.push(p); }
  function reset() {
    S = { x: RW / 2 + 28, y: 3 * PT + RW + 150, a: 0, vx: 0, vy: 0, run: false, over: false, t: TIME, money: 0, fares: 0, tips: 0, crash: 0, ps: [], job: null, cars: [], steer: 0, hitT: 0, brake: false };
    for (var i = 0; i < 4; i++) newPass();
    for (i = 0; i < 16; i++) { var ax = i % 2 ? 'h' : 'v', road = Math.floor(Math.random() * (NB + 1)), dir = Math.random() < 0.5 ? 1 : -1; S.cars.push({ ax: ax, road: road, dir: dir, p: 200 + Math.random() * (WORLD - 400), v: 0, sp: 130 + Math.random() * 80, c: CARC[i % CARC.length], wait: 0, ign: 0 }); }
    parts.clear(); floats.clear(); hud();
  }
  function carXY(c) { var ctr = c.road * PT + RW / 2; return c.ax === 'v' ? { x: ctr + (c.dir < 0 ? 28 : -28), y: c.p, a: c.dir < 0 ? 0 : Math.PI } : { x: c.p, y: ctr + (c.dir > 0 ? 28 : -28), a: c.dir > 0 ? Math.PI / 2 : -Math.PI / 2 }; }
  function hud() { var t = Math.max(0, Math.ceil(S.t)); $('time').textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + t % 60; $('money').textContent = '$' + FX.fmt(S.money); $('fare').textContent = S.fares; }
  function start() { reset(); $('cover').classList.add('off'); K.close('ovEnd'); FX.countdown($('big'), function () { S.run = true; if (window.SCLB) SCLB.start(GAME, '3min'); if (window.SC) SC.post('start', { game: GAME }); }); }
  function step(dt) {
    parts.step(dt); floats.step(dt); shake.step(dt);
    if (!S.run) { eng.set(60, 0); return; }
    S.t -= dt; if (S.t <= 0) { S.t = 0; end(); return; }
    var k = FX.keys, fx = Math.sin(S.a), fy = -Math.cos(S.a), fwd = S.vx * fx + S.vy * fy, side = S.vx * -fy + S.vy * fx;
    var gas = k.up || k.a, br = k.down || k.b, st = (k.right ? 1 : 0) - (k.left ? 1 : 0), bx = Math.floor((S.x - RW) / PT), by = Math.floor((S.y - RW) / PT), inB = bx >= 0 && by >= 0 && bx < NB && by < NB && (S.x - RW) % PT < BS && (S.y - RW) % PT < BS, grass = inB && blocks[bx][by] === 'park', vmax = grass ? VMAX * 0.6 : VMAX;
    S.brake = !!br;
    if (gas) fwd += 520 * dt * (fwd < 0 ? 2 : 1); else if (br) { if (fwd > 20) fwd -= 900 * dt; else fwd -= 320 * dt; } else fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 150 * dt);
    if (fwd < -150) fwd = -150; if (fwd > vmax) fwd = Math.max(vmax, fwd - 700 * dt);
    S.steer += (st - S.steer) * Math.min(1, dt * 10);
    S.a += S.steer * 3.1 * FX.clamp(fwd / 170, -1, 1) * dt;
    side *= Math.max(0, 1 - (grass ? 3.5 : 7.5) * dt);
    if (Math.abs(side) > 70 && Math.random() < 0.5) parts.add({ x: S.x - fx * 16, y: S.y - fy * 16, vx: 0, vy: 0, life: 0.5, c: 'rgba(200,200,200,.5)', size: 5, g: 0, round: 1, grow: 12 });
    fx = Math.sin(S.a); fy = -Math.cos(S.a); S.vx = fx * fwd + (-fy) * side; S.vy = fy * fwd + fx * side;
    S.x += S.vx * dt; S.y += S.vy * dt;
    // 建築碰撞
    var R = 15;
    for (var ix = Math.max(0, bx - 1); ix <= Math.min(NB - 1, bx + 1); ix++) for (var iy = Math.max(0, by - 1); iy <= Math.min(NB - 1, by + 1); iy++) {
      if (blocks[ix][iy] === 'park') continue; var x0 = RW + ix * PT + 15, y0 = RW + iy * PT + 15, x1 = x0 + BS - 30, y1 = y0 + BS - 30, cx = FX.clamp(S.x, x0, x1), cy = FX.clamp(S.y, y0, y1), dx = S.x - cx, dy = S.y - cy, d = Math.hypot(dx, dy);
      if (d < R) { if (d < 0.01) { var l = S.x - x0, r = x1 - S.x, t = S.y - y0, b = y1 - S.y, m = Math.min(l, r, t, b); dx = m === l ? -1 : m === r ? 1 : 0; dy = m === t ? -1 : m === b ? 1 : 0; d = 1; S.x = dx ? (dx < 0 ? x0 - R : x1 + R) : S.x; S.y = dy ? (dy < 0 ? y0 - R : y1 + R) : S.y; } else { S.x = cx + dx / d * R; S.y = cy + dy / d * R; } bump(dx / d, dy / d); }
    }
    if (S.x < 12) { S.x = 12; bump(1, 0); } if (S.x > WORLD - 12) { S.x = WORLD - 12; bump(-1, 0); } if (S.y < 12) { S.y = 12; bump(0, 1); } if (S.y > WORLD - 12) { S.y = WORLD - 12; bump(0, -1); }
    if (S.hitT > 0) S.hitT -= dt;
    // 車流
    S.cars.forEach(function (c) {
      var q = carXY(c), ux = Math.sin(q.a), uy = -Math.cos(q.a), block = false;
      function see(ox, oy, isTaxi) { var rx = ox - q.x, ry = oy - q.y, f = rx * ux + ry * uy, s = Math.abs(rx * -uy + ry * ux); if (f > 6 && f < 78 && s < 26) block = isTaxi ? 2 : Math.max(block, 1); }
      see(S.x, S.y, true); if (c.ign <= 0) S.cars.forEach(function (o) { if (o !== c) { var oq = carXY(o); see(oq.x, oq.y, false); } });
      if (block) { c.v = Math.max(0, c.v - 600 * dt); c.wait += dt; if (c.wait > 2.2 && block === 1) { c.ign = 1.6; c.wait = 0; } } else { c.v = Math.min(c.sp, c.v + 200 * dt); c.wait = 0; }
      if (c.ign > 0) c.ign -= dt;
      c.p += c.v * c.dir * dt; if (c.p > WORLD - 40 && c.dir > 0) c.dir = -1; else if (c.p < 40 && c.dir < 0) c.dir = 1;
      q = carXY(c); var ddx = S.x - q.x, ddy = S.y - q.y, dd = Math.hypot(ddx, ddy);
      if (dd < 30 && dd > 0.1) { S.x = q.x + ddx / dd * 30; S.y = q.y + ddy / dd * 30; bump(ddx / dd, ddy / dd); c.v *= 0.3; }
    });
    // 乘客
    var sp = Math.hypot(S.vx, S.vy);
    if (!S.job) { for (var i = 0; i < S.ps.length; i++) { var p = S.ps[i]; if (Math.hypot(p.x - S.x, p.y - S.y) < 82 && sp < 75) { S.ps.splice(i, 1); S.job = p; p.par = p.dist / 235 + 7; p.left = p.par; FX.sfx.good(); floats.add(W / 2, 250, L('上車！', 'Picked up!'), '#fde047', 20); newPass(); break; } } }
    else {
      S.job.left -= dt; var d2 = Math.hypot(S.job.dst.x - S.x, S.job.dst.y - S.y);
      if (d2 < 74 && sp < 75) { var fare = Math.round(30 + S.job.dist * 0.055), tip = Math.max(0, Math.round(S.job.left * 4)); S.money += fare + tip; S.tips += tip; S.fares++; FX.sfx.cash(); floats.add(W / 2, 240, '+$' + fare, '#4ade80', 26); if (tip) floats.add(W / 2, 272, L('小費 +$', 'Tip +$') + tip, '#fde047', 17); parts.burst(W / 2, 300, 22, { c: ['#fde047', '#4ade80', '#fff'], sp: 240, life: 0.8, size: 5, g: 300, up: 1 }); S.job = null; }
    }
    eng.set(55 + Math.abs(fwd) / 3.2, K.muted ? 0 : 0.014 + (gas ? 0.012 : 0)); hud();
  }
  function bump(nx, ny) { var vn = S.vx * nx + S.vy * ny; if (vn >= 0) return; S.vx -= vn * nx * 1.35; S.vy -= vn * ny * 1.35; S.vx *= 0.75; S.vy *= 0.75; if (vn < -150 && S.hitT <= 0) { S.hitT = 0.5; S.crash++; FX.sfx.crash(); shake.kick(Math.min(16, -vn / 22)); parts.burst(W / 2, H / 2, 12, { c: ['#fde047', '#fff', '#f97316'], sp: 200, life: 0.4, size: 4, g: 0 }); if (S.job) { S.job.left -= 1.5; floats.add(W / 2, 270, L('乘客嚇到了！', 'Passenger scared!'), '#f87171', 15); } } }
  function end() {
    S.run = false; S.over = true; eng.stop(); FX.sfx.great(); var b = FX.best('sctaxi_best', S.money);
    $('endMoney').textContent = '$' + FX.fmt(S.money); $('endFare').textContent = S.fares; $('endTip').textContent = '$' + FX.fmt(S.tips);
    $('endBest').textContent = b.isNew && S.money > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：$', 'Personal best: $') + FX.fmt(b.best);
    K.open('ovEnd'); $('cover').classList.remove('off'); hud();
    if (window.SC) SC.post('gameover', { game: GAME, score: S.money });
    if (window.SCLB && S.money > 0) SCLB.offer({ game: GAME, mode: '3min', score: S.money, text: L('載客 ', 'Fares ') + S.fares });
  }
  // ---------- 繪圖 ----------
  function person(x, y, col, time) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 8, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 8, 5.5, 0, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 12, y - 6 + Math.sin(time * 10) * 4); ctx.stroke(); ctx.fillStyle = '#3b2a1a'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); }
  function draw(time) {
    var camx = FX.clamp(S.x + S.vx * 0.22 - W / 2, 0, WORLD - W), camy = FX.clamp(S.y + S.vy * 0.22 - H / 2, 0, WORLD - H), i, j, x, y;
    ctx.save(); shake.apply(ctx); ctx.translate(-Math.round(camx), -Math.round(camy));
    ctx.fillStyle = '#3d4250'; ctx.fillRect(camx - 20, camy - 20, W + 40, H + 40);
    // 馬路標線
    for (i = 0; i <= NB; i++) {
      var c0 = i * PT + RW / 2;
      if (c0 > camx - 80 && c0 < camx + W + 80) for (j = 0; j < NB; j++) { y = RW + j * PT; if (y > camy + H || y + BS < camy) continue; ctx.fillStyle = '#f5c518'; ctx.fillRect(c0 - 1.5, y + 22, 3, BS - 44); ctx.fillStyle = 'rgba(255,255,255,.75)'; for (var s = 0; s < 6; s++) { ctx.fillRect(c0 - 52 + s * 19, y + 4, 10, 14); ctx.fillRect(c0 - 52 + s * 19, y + BS - 18, 10, 14); } }
      if (c0 > camy - 80 && c0 < camy + H + 80) for (j = 0; j < NB; j++) { x = RW + j * PT; if (x > camx + W || x + BS < camx) continue; ctx.fillStyle = '#f5c518'; ctx.fillRect(x + 22, c0 - 1.5, BS - 44, 3); ctx.fillStyle = 'rgba(255,255,255,.75)'; for (s = 0; s < 6; s++) { ctx.fillRect(x + 4, c0 - 52 + s * 19, 14, 10); ctx.fillRect(x + BS - 18, c0 - 52 + s * 19, 14, 10); } }
    }
    for (i = 0; i < NB; i++) for (j = 0; j < NB; j++) { x = RW + i * PT; y = RW + j * PT; if (x > camx + W || x + BS < camx || y > camy + H || y + BS < camy) continue; ctx.drawImage(blockCv(i, j), x, y); }
    // 目的地、乘客
    if (S.job) { var d = S.job.dst, pr = 74 + Math.sin(time * 5) * 5; ctx.fillStyle = 'rgba(74,222,128,.25)'; ctx.beginPath(); ctx.arc(d.x, d.y, pr, 0, 7); ctx.fill(); ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -time * 40; ctx.stroke(); ctx.setLineDash([]); FX.text(ctx, '🏁', d.x, d.y - 4, 26); }
    S.ps.forEach(function (p) { if (S.job) ctx.globalAlpha = 0.45; var pr2 = 30 + (time * 40 + p.x) % 52; ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.globalAlpha *= 1 - (pr2 - 30) / 52; ctx.beginPath(); ctx.arc(p.x, p.y, pr2, 0, 7); ctx.stroke(); ctx.globalAlpha = S.job ? 0.45 : 1; person(p.x, p.y, p.shirt, time); ctx.fillStyle = p.col; FX.rr(ctx, p.x - 15, p.y - 34, 30, 18, 9); ctx.fill(); FX.text(ctx, '$' + Math.round(30 + p.dist * 0.055), p.x, p.y - 25, 11, '#111'); ctx.globalAlpha = 1; });
    S.cars.forEach(function (c) { var q = carXY(c); if (q.x < camx - 40 || q.x > camx + W + 40 || q.y < camy - 40 || q.y > camy + H + 40) return; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); FX.car(ctx, 24, 46, c.c, { brake: c.v < c.sp * 0.5 }); ctx.restore(); });
    parts.draw(ctx);
    ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(S.a); FX.car(ctx, 26, 50, '#facc15', { steer: S.steer * 0.4, brake: S.brake, sign: 1 }); ctx.fillStyle = '#111'; for (i = 0; i < 5; i++) ctx.fillRect(-13 + i * 5.4, 2, 2.7, 2.7); if (S.job) { ctx.fillStyle = S.job.shirt; ctx.beginPath(); ctx.arc(5, 12, 4, 0, 7); ctx.fill(); } ctx.restore();
    // 導引箭頭
    var tg = S.job ? S.job.dst : null, col = '#4ade80'; if (!tg) { var bd = 1e9; S.ps.forEach(function (p) { var dd = Math.hypot(p.x - S.x, p.y - S.y); if (dd < bd) { bd = dd; tg = p; } }); col = '#fff'; }
    if (tg) { var an = Math.atan2(tg.y - S.y, tg.x - S.x), dist = Math.hypot(tg.x - S.x, tg.y - S.y); if (dist > 110) { ctx.save(); ctx.translate(S.x + Math.cos(an) * 62, S.y + Math.sin(an) * 62); ctx.rotate(an); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); FX.text(ctx, Math.round(dist / 10) + 'm', S.x + Math.cos(an) * 92, S.y + Math.sin(an) * 92, 12, col, 'center', '#000'); } }
    ctx.restore();
    floats.draw(ctx);
    // 小地圖
    var ms = 96, mx = W - ms - 10, my = 10, sc = ms / WORLD; ctx.fillStyle = 'rgba(15,19,32,.8)'; FX.rr(ctx, mx - 4, my - 4, ms + 8, ms + 8, 8); ctx.fill(); ctx.fillStyle = '#586074'; ctx.fillRect(mx, my, ms, ms);
    for (i = 0; i < NB; i++) for (j = 0; j < NB; j++) { ctx.fillStyle = blocks[i][j] === 'park' ? '#3f8f4a' : '#1f2533'; ctx.fillRect(mx + (RW + i * PT) * sc, my + (RW + j * PT) * sc, BS * sc, BS * sc); }
    if (!S.job) S.ps.forEach(function (p) { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(mx + p.x * sc, my + p.y * sc, 3, 0, 7); ctx.fill(); }); else { ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(mx + S.job.dst.x * sc, my + S.job.dst.y * sc, 4 + Math.sin(time * 6), 0, 7); ctx.fill(); }
    ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx + S.x * sc, my + S.y * sc, 3.5, 0, 7); ctx.fill(); ctx.stroke();
    // 載客中的小費計時
    if (S.job) { var f = Math.max(0, S.job.left / S.job.par); ctx.fillStyle = 'rgba(15,19,32,.8)'; FX.rr(ctx, 10, 10, 200, 40, 10); ctx.fill(); FX.text(ctx, L('🧍 載客中　小費 $', '🧍 On trip · tip $') + Math.max(0, Math.round(S.job.left * 4)), 110, 23, 12, '#fff'); ctx.fillStyle = '#334155'; FX.rr(ctx, 20, 34, 180, 8, 4); ctx.fill(); if (f > 0.02) { ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.2 ? '#fde047' : '#f87171'; FX.rr(ctx, 20, 34, 180 * f, 8, 4); ctx.fill(); } }
    else { ctx.fillStyle = 'rgba(15,19,32,.8)'; FX.rr(ctx, 10, 10, 200, 26, 10); ctx.fill(); FX.text(ctx, L('🚕 空車 — 找招手的乘客', '🚕 Vacant — find a passenger'), 110, 23, 12, '#fde047'); }
    if (S.run && S.t <= 10) FX.text(ctx, String(Math.ceil(S.t)), W / 2, 110, 56, 'rgba(248,113,113,' + (0.5 + (S.t % 1) * 0.5) + ')', 'center', '#000');
  }
  FX.pad($('touch'), [{ k: 'left', t: '◀' }, { k: 'right', t: '▶' }, { gap: 1 }, { k: 'down', t: '🛑' }, { k: 'up', t: '⛽', cls: 'go' }]);
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; eng.stop(); start(); } };
  FX.sound(function () { if (K.muted) eng.stop(); });
  reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__tx = { S: function () { return S; }, go: function () { reset(); $('cover').classList.add('off'); S.run = true; }, C: { RW: RW, PT: PT, BS: BS, NB: NB } };
})();
