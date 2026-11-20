/* 登山越野車 — stockcorp.github.io/hill/
   側視物理越野。車 = 三個 Verlet 質點（後輪 A、前輪 B、駕駛頭 H）用三根桿子連成三角形；
   輪子和地形（固定公式的高度函式，所有人相同）做圓形碰撞，貼地時沿切線加減速；空中時油門/煞車讓車身旋轉。
   1 公尺 = 20px。油料每秒消耗，油桶加滿、金幣 +0.6、空翻 +15。主題：草原 → 沙漠 → 雪山 → 月球（低重力）。
   排行榜：mode = classic，距離（公尺）越遠越好。 */
(function () {
  'use strict';
  var GAME = 'hill', $ = K.$, L = K.L, W = 560, H = 430, M = 20, WR = 17, BASE = 62, HEAD = 40;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), S = null, eng = FX.Engine(), dust = FX.Parts(220), floats = FX.Floats(), shake = FX.Shake();
  var TH = [
    { at: 0, sky: [[86, 180, 255], [200, 236, 255]], far: [120, 190, 150], top: [96, 196, 72], dirt: [124, 84, 52], g: 1, n: ['草原', 'Meadow'] },
    { at: 9000, sky: [[255, 150, 80], [255, 224, 160]], far: [214, 150, 96], top: [232, 190, 110], dirt: [170, 112, 62], g: 1, n: ['沙漠', 'Desert'] },
    { at: 19000, sky: [[120, 170, 220], [236, 244, 252]], far: [176, 200, 226], top: [244, 248, 252], dirt: [120, 136, 160], g: 1, n: ['雪山', 'Snow'] },
    { at: 31000, sky: [[4, 6, 20], [30, 26, 60]], far: [60, 62, 80], top: [170, 172, 182], dirt: [84, 86, 98], g: 0.5, n: ['月球', 'Moon'] }
  ];
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, k) { k = k || 1; return 'rgb(' + (c[0] * k | 0) + ',' + (c[1] * k | 0) + ',' + (c[2] * k | 0) + ')'; }
  function theme(x) {
    var i = 0; while (i < TH.length - 1 && x >= TH[i + 1].at) i++;
    var a = TH[i], b = TH[Math.min(TH.length - 1, i + 1)], t = b === a ? 0 : FX.clamp((x - (b.at - 1600)) / 1600, 0, 1);
    return { sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t)], far: mix(a.far, b.far, t), top: mix(a.top, b.top, t), dirt: mix(a.dirt, b.dirt, t), g: a.g + (b.g - a.g) * t, n: t > 0.5 ? b.n : a.n, night: (i === 3 ? 1 : i === 2 && b.at === 31000 ? t : 0) };
  }
  // 地形高度（y 向下為正）
  function hgt(x) {
    if (x < 0) x = 0;
    var s = Math.min(1, x / 700), d = 0.35 + Math.min(2.1, x / 16000);
    return 300 - s * d * (70 * Math.sin(x / 290 + 1.3) + 34 * Math.sin(x / 113 + 0.4) + 110 * Math.sin(x / 930 + 4) + Math.min(1.6, x / 9000) * 13 * Math.sin(x / 43 + 2.1));
  }
  function slope(x) { return (hgt(x + 2) - hgt(x - 2)) / 4; }
  function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

  function reset() {
    var x0 = 160, y0 = hgt(x0) - WR;
    S = { A: P(x0, y0), B: P(x0 + BASE, hgt(x0 + BASE) - WR), Hd: P(x0 + BASE * 0.42, y0 - HEAD), fuel: 100, coins: 0, flips: 0, maxX: x0, run: false, started: false, over: false, cam: { x: 0, y: 0 }, spin: 0, air: 0, rot: 0, lastAng: 0, got: {}, cans: [], stall: 0, t: 0, why: '', lowBeep: 0 };
    var cx = 1500, n = 0; while (cx < 400000) { S.cans.push(cx); n++; cx += 1500 + n * 260; }
    dust.clear(); floats.clear(); S.cam.x = x0 - W * 0.3; S.cam.y = hgt(x0); hud();
  }
  function P(x, y) { return { x: x, y: y, px: x, py: y, ground: false }; }
  function hud() { $('dist').textContent = Math.max(0, Math.floor((S.maxX - 160) / M)) + ' m'; $('coin').textContent = S.coins; $('best').textContent = K.load('schill_best', 0) + ' m'; }
  function start() { reset(); $('cover').classList.add('off'); K.close('ovEnd'); S.run = true; S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); FX.sfx.go(); }

  function stick(a, b, len, k) { var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - len) / d * 0.5 * k; a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f; }
  function wheel(p, drive, dt, th) {
    var ty = hgt(p.x), sl = slope(p.x), inv = 1 / Math.sqrt(1 + sl * sl), dist = (ty - p.y) * inv; p.ground = false;
    if (dist < WR) {
      var nx = sl * inv, ny = -inv, push = WR - dist; p.x += nx * push; p.y += ny * push; p.ground = true;
      var vx = p.x - p.px, vy = p.y - p.py, tx = inv, tyv = sl * inv, vt = vx * tx + vy * tyv, vn = vx * nx + vy * ny;
      if (vn < 0) { if (vn < -5) { shake.kick(Math.min(9, -vn * 0.9)); dust.burst(p.x, p.y + WR, 6, { c: rgb(th.dirt, 1.2), sp: 120, life: 0.5, size: 5, ang: -Math.PI / 2, spread: 1.2 }); K.beep(90, 0.08, 'square', 0.04); } vn = -vn * 0.12; }
      var maxv = 520 * dt, acc = 1500 * dt * dt;
      if (drive > 0 && vt < maxv) vt += acc * drive; else if (drive < 0 && vt > -maxv * 0.5) vt += acc * drive * 0.9;
      else vt *= (1 - 0.6 * dt);
      p.px = p.x - (tx * vt + nx * vn); p.py = p.y - (tyv * vt + ny * vn);
      p.vt = vt / dt;
    }
  }
  function step(dt) {
    dust.step(dt); floats.step(dt); shake.step(dt);
    if (!S.run) { eng.set(55, S.over || !S.started ? 0 : 0.012); return; }
    var k = FX.keys, gas = (k.right || k.up || k.a) ? 1 : 0, brk = (k.left || k.down || k.b) ? 1 : 0, th = theme(S.A.x), n, sub = 4, h = dt / sub;
    if (S.fuel <= 0) gas = 0, brk = 0;
    var drive = gas - brk;
    for (n = 0; n < sub; n++) {
      [S.A, S.B, S.Hd].forEach(function (p) { var vx = (p.x - p.px) * 0.9995, vy = (p.y - p.py) * 0.9995; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 1050 * th.g * h * h; });
      for (var it = 0; it < 4; it++) { stick(S.A, S.B, BASE, 1); stick(S.A, S.Hd, 47.6, 0.9); stick(S.B, S.Hd, 53.9, 0.9); }
      wheel(S.A, drive, h, th); wheel(S.B, drive * 0.7, h, th);
      if (!S.A.ground && !S.B.ground && drive) { var cx = (S.A.x + S.B.x) / 2, cy = (S.A.y + S.B.y) / 2, tq = drive * 26 * h * h; [S.A, S.B].forEach(function (p) { var rx = p.x - cx, ry = p.y - cy; p.x += ry * tq * 0.5; p.y -= rx * tq * 0.5; }); }
      if (S.A.x < 20) { S.A.x = 20; S.A.px = 20; }
    }
    S.t += dt; var ang = Math.atan2(S.B.y - S.A.y, S.B.x - S.A.x), da = ang - S.lastAng; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; S.lastAng = ang;
    if (!S.A.ground && !S.B.ground) { S.air += dt; S.rot += da; }
    else { if (S.air > 0.35 && Math.abs(S.rot) > 5.2 && S.A.ground && S.B.ground) { var f = Math.round(Math.abs(S.rot) / 6.2832) || 1; S.flips += f; S.fuel = Math.min(100, S.fuel + 15 * f); floats.add(W * 0.4, H * 0.35, L('空翻 ×' + f + '！+' + 15 * f + ' 油', 'Flip ×' + f + '! +' + 15 * f + ' fuel'), '#fde047', 22); FX.sfx.great(); } if (S.A.ground && S.B.ground) { S.air = 0; S.rot = 0; } }
    var sp = S.A.vt || 0; S.spin += (S.A.ground ? sp : sp * 0.98) * dt / WR + (gas && !S.A.ground ? 14 * dt : 0);
    if (S.A.ground && Math.abs(drive) && Math.random() < 0.5) dust.burst(S.A.x - 10, S.A.y + WR - 2, 1, { c: rgb(th.dirt, 1.25), sp: 90, life: 0.5, size: 5, ang: Math.PI * 1.15, spread: 0.5, g: 200 });
    // 油料、道具
    S.fuel = Math.max(0, S.fuel - 6.5 * dt * (gas ? 1 : 0.5));
    if (S.fuel < 20 && S.fuel > 0) { S.lowBeep -= dt; if (S.lowBeep <= 0) { S.lowBeep = 0.8; K.beep(880, 0.08, 'square', 0.04); } }
    var mx = (S.A.x + S.B.x) / 2, my = (S.A.y + S.B.y) / 2;
    S.cans.forEach(function (c, i) { if (!S.got['f' + i] && Math.abs(c - mx) < 46 && Math.abs(hgt(c) - 30 - my) < 70) { S.got['f' + i] = 1; S.fuel = 100; floats.add(W * 0.4, H * 0.4, L('⛽ 加滿！', '⛽ Full tank!'), '#4ade80', 22); FX.sfx.great(); } });
    var c0 = Math.floor((mx - 80) / 60), c1 = Math.floor((mx + 80) / 60);
    for (var ci = c0; ci <= c1; ci++) { var cp = coinAt(ci); if (cp && !S.got[ci] && Math.hypot(cp[0] - mx, cp[1] - my) < 40) { S.got[ci] = 1; S.coins++; S.fuel = Math.min(100, S.fuel + 0.6); FX.sfx.coin(); dust.burst(cp[0], cp[1], 6, { c: '#fde047', sp: 90, life: 0.4, size: 4, g: 0 }); } }
    if (S.A.x > S.maxX) S.maxX = S.A.x;
    // 結束判定
    if (S.Hd.y + 9 > hgt(S.Hd.x)) return over(L('翻車了！', 'You flipped!'), true);
    var moving = Math.hypot(S.A.x - S.A.px, S.A.y - S.A.py) / dt * sub > 14;
    if (S.fuel <= 0 && !moving) { S.stall += dt; if (S.stall > 1.2) return over(L('沒油了！', 'Out of fuel!'), false); } else S.stall = 0;
    var tcx = mx - W * 0.3 + (S.A.x - S.A.px) / dt * sub * 0.28; S.cam.x += (tcx - S.cam.x) * Math.min(1, dt * 4); S.cam.y += (my - S.cam.y) * Math.min(1, dt * 3.5);
    eng.set(60 + Math.min(1, Math.abs(sp) / 520) * 150 + gas * 40, S.fuel > 0 ? 0.028 : 0.004);
    hud();
  }
  function coinAt(i) { if (i < 6 || hash(Math.floor(i / 5) * 3.7) > 0.3) return null; var x = i * 60 + 30; return [x, hgt(x) - 46 - (hash(Math.floor(i / 5)) > 0.7 ? Math.sin((i % 5) / 4 * Math.PI) * 60 : 0)]; }
  function over(why, crash) {
    S.run = false; S.over = true; S.why = why; eng.stop();
    if (crash) { FX.sfx.crash(); shake.kick(14); dust.burst(S.Hd.x, S.Hd.y, 20, { c: ['#fff', '#fbbf24', '#9ca3af'], sp: 240, life: 0.7, size: 6 }); } else FX.sfx.bad();
    var d = Math.max(0, Math.floor((S.maxX - 160) / M)), b = FX.best('schill_best', d);
    $('endTitle').textContent = why; $('endDist').textContent = d + ' m'; $('endCoin').textContent = S.coins; $('endFlip').textContent = S.flips;
    $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + b.best + ' m';
    if (window.SC) SC.post('gameover', { game: GAME, score: d });
    var s0 = S; setTimeout(function () { if (S !== s0) return; K.open('ovEnd'); $('cover').classList.remove('off'); if (d > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: d, text: L(theme(S.maxX).n[0], theme(S.maxX).n[1]) + '・' + S.flips + L(' 次空翻', ' flips') }); }, 900);
  }

  // ---------- 繪圖 ----------
  var STARS = []; for (var i = 0; i < 60; i++) STARS.push([Math.random() * W, Math.random() * H * 0.6, Math.random() * 1.5 + 0.5]);
  function draw(time) {
    var th = theme(S.A.x), cx = S.cam.x, cy = S.cam.y - H * 0.56, x, i;
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(th.sky[0])); g.addColorStop(1, rgb(th.sky[1])); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (th.night > 0.05) { ctx.fillStyle = '#fff'; STARS.forEach(function (s) { ctx.globalAlpha = th.night * (0.5 + 0.5 * Math.sin(time * 2 + s[0])); ctx.fillRect(s[0], s[1], s[2], s[2]); }); ctx.globalAlpha = th.night; ctx.fillStyle = '#4f8cff'; ctx.beginPath(); ctx.arc(W - 90, 80, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(W - 98, 74, 10, 0, 7); ctx.arc(W - 80, 90, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(W - 90, 70, 26, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - th.night)) + ')'; for (i = 0; i < 5; i++) { x = ((i * 190 - cx * 0.08) % (W + 200) + W + 200) % (W + 200) - 100; var yy = 50 + (i * 37) % 80; ctx.beginPath(); ctx.arc(x, yy, 16, 0, 7); ctx.arc(x + 18, yy - 6, 20, 0, 7); ctx.arc(x + 40, yy, 15, 0, 7); ctx.fill(); }
    // 遠山兩層
    [[0.15, 150, 0.75, 210], [0.35, 100, 0.9, 260]].forEach(function (l, li) { ctx.fillStyle = rgb(th.far, l[2]); ctx.beginPath(); ctx.moveTo(0, H); for (x = 0; x <= W; x += 14) { var wx = x + cx * l[0]; ctx.lineTo(x, l[3] - (Math.sin(wx / 190 + li * 2) * 0.5 + Math.sin(wx / 71 + li) * 0.25 + 0.5) * l[1] - (cy - 200) * l[0] * 0.3); } ctx.lineTo(W, H); ctx.fill(); });
    ctx.save(); shake.apply(ctx); ctx.translate(-cx, -cy);
    // 路牌、裝飾
    var m0 = Math.floor(cx / 2000), m1 = Math.floor((cx + W) / 2000) + 1;
    for (i = Math.max(1, m0); i <= m1; i++) { x = 160 + i * 2000; var sy = hgt(x); ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 3, sy - 64, 6, 64); ctx.fillStyle = '#fef3c7'; FX.rr(ctx, x - 30, sy - 86, 60, 26, 5); ctx.fill(); ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 2; ctx.stroke(); FX.text(ctx, i * 100 + 'm', x, sy - 72, 14, '#6b4a2f'); }
    for (i = Math.floor(cx / 170); i <= Math.floor((cx + W) / 170) + 1; i++) { if (hash(i * 9.1) < 0.5) continue; x = i * 170 + hash(i) * 90; var ty = hgt(x) + 4, tt = theme(x), k2 = hash(i * 3.3); if (tt.g < 0.9) { ctx.fillStyle = '#6f7180'; ctx.beginPath(); ctx.arc(x, ty, 10 + k2 * 14, Math.PI, 0); ctx.fill(); continue; } ctx.fillStyle = '#5b3d24'; ctx.fillRect(x - 4, ty - 40, 8, 40); ctx.fillStyle = rgb(tt.top, 0.75); ctx.beginPath(); ctx.arc(x, ty - 52, 22 + k2 * 10, 0, 7); ctx.fill(); ctx.fillStyle = rgb(tt.top, 0.92); ctx.beginPath(); ctx.arc(x - 6, ty - 58, 13 + k2 * 6, 0, 7); ctx.fill(); }
    // 地形
    ctx.beginPath(); ctx.moveTo(cx - 20, cy + H + 40); for (x = cx - 20; x <= cx + W + 20; x += 8) ctx.lineTo(x, hgt(x)); ctx.lineTo(cx + W + 20, cy + H + 40); ctx.closePath();
    var dg = ctx.createLinearGradient(0, cy + 100, 0, cy + H + 60); dg.addColorStop(0, rgb(th.dirt)); dg.addColorStop(1, rgb(th.dirt, 0.5)); ctx.fillStyle = dg; ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = rgb(th.dirt, 0.72); ctx.lineWidth = 34; ctx.beginPath(); for (x = cx - 20; x <= cx + W + 20; x += 8) ctx.lineTo(x, hgt(x) + 22); ctx.stroke();
    ctx.strokeStyle = rgb(th.top); ctx.lineWidth = 12; ctx.beginPath(); for (x = cx - 20; x <= cx + W + 20; x += 8) ctx.lineTo(x, hgt(x) + 4); ctx.stroke();
    ctx.strokeStyle = rgb(th.top, 1.18); ctx.lineWidth = 3; ctx.beginPath(); for (x = cx - 20; x <= cx + W + 20; x += 8) ctx.lineTo(x, hgt(x) - 1); ctx.stroke();
    // 金幣、油桶
    for (i = Math.floor(cx / 60); i <= Math.floor((cx + W) / 60) + 1; i++) { var cp = coinAt(i); if (!cp || S.got[i]) continue; var sq = Math.abs(Math.cos(time * 4 + i)); ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.ellipse(cp[0], cp[1], 9 * sq + 1.5, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(cp[0], cp[1], 7.5 * sq + 1, 8.5, 0, 0, 7); ctx.fill(); }
    S.cans.forEach(function (c, ix) { if (S.got['f' + ix] || c < cx - 40 || c > cx + W + 40) return; var y = hgt(c) - 30 + Math.sin(time * 3) * 4; ctx.fillStyle = '#dc2626'; FX.rr(ctx, c - 14, y - 16, 28, 34, 5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(c - 8, y - 4, 16, 9); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(c + 2, y - 23, 9, 8); FX.text(ctx, '⛽', c, y + 2, 13); });
    dust.draw(ctx);
    car(time);
    ctx.restore(); floats.draw(ctx);
    // 油表
    var fw = 150; ctx.fillStyle = 'rgba(0,0,0,.45)'; FX.rr(ctx, 12, 12, fw + 40, 26, 13); ctx.fill(); FX.text(ctx, '⛽', 28, 26, 15);
    var fg = ctx.createLinearGradient(44, 0, 44 + fw, 0); fg.addColorStop(0, '#ef4444'); fg.addColorStop(0.4, '#facc15'); fg.addColorStop(1, '#22c55e'); ctx.fillStyle = '#1f2937'; FX.rr(ctx, 44, 18, fw, 14, 7); ctx.fill();
    if (S.fuel > 0) { ctx.save(); FX.rr(ctx, 44, 18, fw * S.fuel / 100, 14, 7); ctx.clip(); ctx.fillStyle = fg; ctx.fillRect(44, 18, fw, 14); ctx.restore(); }
    if (S.fuel < 20 && S.run && Math.floor(time * 4) % 2) FX.text(ctx, L('快沒油了！', 'LOW FUEL!'), W / 2, 70, 20, '#f87171', 'center', 'rgba(0,0,0,.6)');
    FX.text(ctx, L(th.n[0], th.n[1]), W - 14, 26, 14, 'rgba(255,255,255,.9)', 'right', 'rgba(0,0,0,.4)');
  }
  function tire(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(S.spin);
    ctx.fillStyle = '#16181d'; ctx.beginPath(); ctx.arc(0, 0, WR, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b2f3a'; ctx.lineWidth = 4; for (var i = 0; i < 10; i++) { var a = i * 0.6283; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (WR - 5), Math.sin(a) * (WR - 5)); ctx.lineTo(Math.cos(a) * WR, Math.sin(a) * WR); ctx.stroke(); }
    ctx.fillStyle = '#d1d5db'; ctx.beginPath(); ctx.arc(0, 0, WR * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#6b7280'; for (i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.2566) * 5, Math.sin(i * 1.2566) * 5, 1.6, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function car() {
    var A = S.A, B = S.B, ang = Math.atan2(B.y - A.y, B.x - A.x), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-BASE / 2, 0); ctx.lineTo(-BASE / 2 + 6, -12); ctx.moveTo(BASE / 2, 0); ctx.lineTo(BASE / 2 - 6, -12); ctx.stroke();
    var g = ctx.createLinearGradient(0, -34, 0, -6); g.addColorStop(0, '#f87171'); g.addColorStop(1, '#b91c1c'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-46, -8); ctx.lineTo(-46, -24); ctx.lineTo(-12, -26); ctx.lineTo(18, -26); ctx.lineTo(30, -22); ctx.lineTo(48, -20); ctx.quadraticCurveTo(52, -14, 50, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-44, -22, 90, 3);
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-34, -25); ctx.lineTo(-30, -52); ctx.lineTo(6, -52); ctx.lineTo(20, -26); ctx.stroke();
    ctx.fillStyle = 'rgba(125,211,252,.45)'; ctx.beginPath(); ctx.moveTo(8, -50); ctx.lineTo(20, -27); ctx.lineTo(10, -27); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fef08a'; ctx.fillRect(46, -19, 5, 6); ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(-50, -18, 9, 0, 7); ctx.fill();
    // 駕駛
    ctx.fillStyle = '#1d4ed8'; FX.rr(ctx, -16, -40, 16, 18, 4); ctx.fill();
    ctx.restore();
    var hd = S.Hd; ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(hd.x, hd.y, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(hd.x, hd.y - 1, 9, Math.PI + ang, ang); ctx.fill();
    tire(A); tire(B);
  }
  FX.pad($('touch'), [{ k: 'left', t: L('◀ 煞車', '◀ BRAKE'), cls: 'wide' }, { k: 'right', t: L('油門 ▶', 'GAS ▶'), cls: 'wide go' }]);
  $('bStart').onclick = start; $('bAgain').onclick = start;
  $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(function () { if (K.muted) eng.stop(); });
  if (window.SC) SC.onLang(function () { FX.pad($('touch'), [{ k: 'left', t: L('◀ 煞車', '◀ BRAKE'), cls: 'wide' }, { k: 'right', t: L('油門 ▶', 'GAS ▶'), cls: 'wide go' }]); });
  reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__hl = { S: function () { return S; }, start: start, hgt: hgt };
})();
