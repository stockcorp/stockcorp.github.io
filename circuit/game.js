/* 甩尾賽車場 — stockcorp.github.io/circuit/
   俯視賽道賽車：賽道 = 閉合 Catmull-Rom 曲線（等距取樣），畫在離屏畫布上；鏡頭跟車。
   物理：速度分成前進/側向兩個分量，側向以抓地力衰減 → 高速大角度轉向會甩尾，留下胎痕與煙。
   3 圈、3 位電腦車手（依彎道曲率限速）。排行榜：mode = ring/serpent/gp，完賽時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'circuit', $ = K.$, L = K.L, W = 480, H = 620, WW = 2000, WH = 1500, RW = 62, LAPS = 3;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H);
  var TRACKS = {
    ring: { n: ['環形賽道', 'Ring'], p: [[330, 300], [1000, 230], [1670, 300], [1800, 750], [1670, 1200], [1230, 1250], [1000, 1010], [770, 1250], [330, 1200], [200, 750]] },
    serpent: { n: ['蛇形彎道', 'Serpent'], p: [[260, 320], [700, 230], [960, 520], [1260, 240], [1740, 320], [1790, 700], [1400, 800], [1760, 1130], [1320, 1290], [1010, 1010], [660, 1290], [260, 1150], [470, 760], [200, 590]] },
    gp: { n: ['大獎賽', 'Grand Prix'], p: [[320, 260], [880, 200], [1110, 460], [1500, 240], [1800, 420], [1740, 800], [1370, 700], [1240, 950], [1700, 1130], [1520, 1310], [720, 1310], [590, 1010], [960, 860], [800, 610], [360, 720], [200, 470]] }
  };
  var tc = document.createElement('canvas'); tc.width = WW; tc.height = WH; var tg = tc.getContext('2d');
  var T = null, S = null, trk = K.load('sccircuit_trk', 'ring'), eng = FX.Engine(), squeal = FX.Noise('bandpass'), smoke = FX.Parts(260), shake = FX.Shake(), floats = FX.Floats();
  var COLS = ['#e11d48', '#3b82f6', '#22c55e', '#f59e0b'], NAMES = [['你', 'YOU'], ['阿凱', 'KAI'], ['小安', 'ANN'], ['老陳', 'CHEN']];

  // ---------- 賽道 ----------
  function buildTrack(id) {
    var P = TRACKS[id].p, n = P.length, raw = [], i, t;
    for (i = 0; i < n; i++) { var p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n]; for (t = 0; t < 1; t += 0.02) { var t2 = t * t, t3 = t2 * t; raw.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
    // 等距重新取樣（每 12px 一點），從第一段中點開始
    var pts = [], acc = 0, step = 12, start = 25; raw = raw.slice(start).concat(raw.slice(0, start));
    for (i = 0; i < raw.length; i++) { var a = raw[i], b = raw[(i + 1) % raw.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); while (acc <= d) { pts.push({ x: a[0] + (b[0] - a[0]) * acc / d, y: a[1] + (b[1] - a[1]) * acc / d }); acc += step; } acc -= d; }
    var N = pts.length;
    for (i = 0; i < N; i++) { var q = pts[(i + 1) % N], pr = pts[(i - 1 + N) % N]; pts[i].a = Math.atan2(q.y - pr.y, q.x - pr.x); }
    for (i = 0; i < N; i++) { var da = pts[(i + 4) % N].a - pts[(i - 4 + N) % N].a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; pts[i].k = Math.abs(da) / (8 * step); pts[i].v = FX.clamp(Math.sqrt(330 / Math.max(pts[i].k, 0.0005)), 150, 470); }
    for (var pass = 0; pass < 2; pass++) for (i = N - 1; i >= 0; i--) pts[i].v = Math.min(pts[i].v, Math.sqrt(pts[(i + 1) % N].v * pts[(i + 1) % N].v + 2 * 430 * step));
    T = { id: id, pts: pts, N: N };
    paintTrack();
  }
  function path(g) { g.beginPath(); T.pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath(); }
  function paintTrack() {
    var g = tg, i;
    g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, WW, WH);
    for (i = 0; i < WW; i += 80) { g.fillStyle = (i / 80) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.04)'; g.fillRect(i, 0, 80, WH); }
    for (i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(20,70,20,.25)' : 'rgba(170,220,120,.2)'; g.fillRect(Math.random() * WW, Math.random() * WH, 3, 3); }
    g.lineJoin = 'round'; g.lineCap = 'round';
    path(g); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = RW * 2 + 34; g.stroke();
    path(g); g.strokeStyle = '#d8c79a'; g.lineWidth = RW * 2 + 26; g.stroke();
    path(g); g.strokeStyle = '#f8fafc'; g.lineWidth = RW * 2 + 14; g.stroke();
    path(g); g.setLineDash([22, 22]); g.strokeStyle = '#dc2626'; g.lineWidth = RW * 2 + 14; g.stroke(); g.setLineDash([]);
    path(g); g.strokeStyle = '#3a3f4a'; g.lineWidth = RW * 2; g.stroke();
    path(g); g.strokeStyle = '#444a56'; g.lineWidth = RW * 1.2; g.stroke();
    for (i = 0; i < 2600; i++) { var p = T.pts[(Math.random() * T.N) | 0], o = (Math.random() - 0.5) * RW * 1.9; g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)'; g.fillRect(p.x - Math.sin(p.a) * o, p.y + Math.cos(p.a) * o, 2.5, 2.5); }
    path(g); g.setLineDash([26, 34]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
    // 起跑線（棋盤格）與發車格
    var s0 = T.pts[0]; g.save(); g.translate(s0.x, s0.y); g.rotate(s0.a);
    for (var r = 0; r < 2; r++) for (var c = 0; c < 12; c++) { g.fillStyle = (r + c) % 2 ? '#111' : '#fff'; g.fillRect(-10 + r * 10, -RW + c * (RW / 6), 10, RW / 6); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (i = 0; i < 4; i++) { var gx = -46 - i * 44, gy = (i % 2 ? 1 : -1) * 26; g.strokeRect(gx - 22, gy - 16, 44, 32); }
    g.restore();
    // 樹與輪胎堆
    for (i = 0; i < 230; i++) {
      var x = Math.random() * WW, y = Math.random() * WH, dmin = 1e9; for (var j = 0; j < T.N; j += 3) { var dd = Math.hypot(T.pts[j].x - x, T.pts[j].y - y); if (dd < dmin) dmin = dd; }
      if (dmin < RW + 46) continue;
      var rr = 16 + Math.random() * 16; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 6, y + 8, rr, 0, 7); g.fill();
      var tg2 = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 2, x, y, rr); tg2.addColorStop(0, '#5fd068'); tg2.addColorStop(1, '#1e6a2e'); g.fillStyle = tg2; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.35, rr * 0.4, 0, 7); g.fill();
    }
    g.strokeStyle = '#7c2d12'; g.lineWidth = 18; g.strokeRect(9, 9, WW - 18, WH - 18); g.setLineDash([18, 18]); g.strokeStyle = '#fff'; g.strokeRect(9, 9, WW - 18, WH - 18); g.setLineDash([]);
  }
  function nearest(c) { // 在上次索引附近找最近的取樣點
    var best = c.idx, bd = 1e9, N = T.N;
    for (var k = -12; k <= 22; k++) { var i = (c.idx + k + N) % N, p = T.pts[i], d = (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y); if (d < bd) { bd = d; best = i; } }
    var dl = best - c.idx; if (dl > N / 2) dl -= N; if (dl < -N / 2) dl += N;
    c.prog += dl; c.idx = best; c.off = Math.sqrt(bd);
  }

  // ---------- 比賽 ----------
  function reset() {
    var s0 = T.pts[0]; S = { cars: [], run: false, started: false, over: false, t: 0, lapT: 0, bestLap: 0, fin: 0, cam: { x: s0.x, y: s0.y }, order: [] };
    for (var i = 0; i < 4; i++) {
      var slot = i === 0 ? 3 : i - 1, gx = -46 - slot * 44, gy = (slot % 2 ? 1 : -1) * 26;
      S.cars.push({ me: i === 0, x: s0.x + Math.cos(s0.a) * gx - Math.sin(s0.a) * gy, y: s0.y + Math.sin(s0.a) * gx + Math.cos(s0.a) * gy, a: s0.a, vx: 0, vy: 0, sp: 0, idx: (T.N - 4 - slot * 4) % T.N, prog: -(4 + slot * 4), lap: 0, col: COLS[i], skill: [0, 0.9, 0.86, 0.82][i] + Math.random() * 0.03, lane: [0, -16, 14, 4][i], steer: 0, done: 0, slide: 0, wl: null });
    }
    smoke.clear(); floats.clear(); paintTrack(); hud();
  }
  function hud() { var me = S.cars[0]; $('lap').textContent = Math.min(LAPS, me.lap + 1) + '/' + LAPS; $('pos').textContent = rank(me) + '/4'; $('time').textContent = fmt(S.t); }
  function fmt(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function rank(c) { var r = 1; S.cars.forEach(function (o) { if (o !== c && (o.done && (!c.done || o.done < c.done) || (!o.done && !c.done && o.prog > c.prog))) r++; }); return r; }
  function start() {
    buildIf(); reset(); $('cover').classList.add('off'); K.close('ovEnd');
    $('bLb').href = '/leaderboard/?game=circuit&mode=' + trk;
    FX.countdown($('big'), function () { S.run = true; S.started = true; if (window.SCLB) SCLB.start(GAME, trk); if (window.SC) SC.post('start', { game: GAME, level: trk }); });
  }
  function buildIf() { if (!T || T.id !== trk) buildTrack(trk); }
  function step(dt) {
    smoke.step(dt); shake.step(dt); floats.step(dt);
    var me = S.cars[0];
    if (S.run) { S.t += dt; S.lapT += dt; S.cars.forEach(function (c) { if (c.me) drive(c, dt); else ai(c, dt); }); collide(); S.cars.forEach(lapCheck); hud(); }
    var tx = me.x + me.vx * 0.32, ty = me.y + me.vy * 0.32; S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 5); S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 5);
    if (S.run) { eng.set(70 + me.sp * 0.42, 0.026); squeal.set(Math.min(0.05, me.slide * 0.0006), 1500); } else { eng.set(60, S.over || !S.started ? 0 : 0.012); squeal.set(0); }
  }
  function drive(c, dt) {
    var k = FX.keys, st = (k.right ? 1 : 0) - (k.left ? 1 : 0); if (c.done) st = 0;
    c.steer += (st - c.steer) * Math.min(1, dt * 10);
    var fx = Math.cos(c.a), fy = Math.sin(c.a), vf = c.vx * fx + c.vy * fy, vs = -c.vx * fy + c.vy * fx;
    var onGrass = c.off > RW + 6, vmax = onGrass ? 170 : 430, brake = k.down && !c.done;
    if (c.done) vf -= vf * dt * 1.2; else if (brake) vf -= 520 * dt * Math.sign(vf || 1) * (vf > -60 ? 1 : 0); else vf += (vf < vmax ? 250 * (1.15 - vf / 520) : -500) * dt;
    if (onGrass && vf > vmax) vf -= 700 * dt;
    var sp = Math.abs(vf);
    c.a += c.steer * 2.9 * dt * Math.min(1, sp / 110) * (vf < 0 ? -1 : 1);
    // 側向抓地：速度越快、方向打越大越容易滑；煞車時更滑
    var grip = onGrass ? 3 : (brake && sp > 160 ? 2.6 : 7.5) - Math.min(4.2, Math.abs(c.steer) * sp / 150);
    vs -= vs * Math.min(1, Math.max(1.4, grip) * dt);
    vf -= Math.abs(vs) * 0.35 * dt;
    fx = Math.cos(c.a); fy = Math.sin(c.a); c.vx = fx * vf - fy * vs; c.vy = fy * vf + fx * vs;
    c.x += c.vx * dt; c.y += c.vy * dt; c.sp = sp; c.slide = Math.abs(vs);
    if (c.x < 30 || c.x > WW - 30 || c.y < 30 || c.y > WH - 30) { c.x = FX.clamp(c.x, 30, WW - 30); c.y = FX.clamp(c.y, 30, WH - 30); c.vx *= -0.3; c.vy *= -0.3; shake.kick(6); }
    nearest(c); marks(c, onGrass);
    if (onGrass && sp > 80) shake.kick(1.2);
  }
  function marks(c, onGrass) {
    var fx = Math.cos(c.a), fy = Math.sin(c.a), wl = [c.x - fx * 14 - fy * 9, c.y - fy * 14 + fx * 9, c.x - fx * 14 + fy * 9, c.y - fy * 14 - fx * 9];
    if ((c.slide > 46 && c.sp > 90) || (onGrass && c.sp > 60)) {
      if (c.wl) { tg.strokeStyle = onGrass ? 'rgba(60,40,20,.28)' : 'rgba(10,10,12,.3)'; tg.lineWidth = 5; tg.lineCap = 'round'; tg.beginPath(); tg.moveTo(c.wl[0], c.wl[1]); tg.lineTo(wl[0], wl[1]); tg.moveTo(c.wl[2], c.wl[3]); tg.lineTo(wl[2], wl[3]); tg.stroke(); }
      c.wl = wl; if (Math.random() < 0.5) smoke.burst(wl[Math.random() < 0.5 ? 0 : 2], wl[1], 1, { c: onGrass ? 'rgba(120,90,50,.5)' : 'rgba(230,230,235,.5)', sp: 30, life: 0.7, g: 0, size: 7, round: 1, grow: 22 });
    } else c.wl = null;
  }
  function ai(c, dt) {
    nearest(c); var N = T.N, p = T.pts[c.idx], look = T.pts[(c.idx + 7 + Math.floor(c.sp / 60)) % N];
    var tx = look.x - Math.sin(look.a) * c.lane, ty = look.y + Math.cos(look.a) * c.lane, want = Math.atan2(ty - c.y, tx - c.x), da = want - c.a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
    c.a += FX.clamp(da, -3.2 * dt, 3.2 * dt); c.steer = FX.clamp(da * 3, -1, 1);
    var lim = Math.min(T.pts[(c.idx + 6) % N].v, p.v) * c.skill * (c.done ? 0.5 : 1); if (c.off > RW) lim = Math.min(lim, 170);
    c.sp += (c.sp < lim ? 235 : -480) * dt; c.sp = Math.max(40, c.sp);
    c.vx = Math.cos(c.a) * c.sp; c.vy = Math.sin(c.a) * c.sp; c.x += c.vx * dt; c.y += c.vy * dt; c.slide = 0;
  }
  function collide() {
    for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) {
      var a = S.cars[i], b = S.cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 26 && d > 0) { var nx = dx / d, ny = dy / d, ov = (26 - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; var rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { a.vx += nx * rv * 0.5; a.vy += ny * rv * 0.5; b.vx -= nx * rv * 0.5; b.vy -= ny * rv * 0.5; if (!b.me) b.sp *= 0.93; if (!a.me) a.sp *= 0.93; if ((a.me || b.me) && rv < -40) { shake.kick(5); K.beep(140, 0.08, 'square', 0.04); } } }
    }
  }
  function lapCheck(c) {
    var lap = Math.floor(c.prog / T.N); if (lap <= c.lap || c.done) return;
    c.lap = lap;
    if (c.me) { if (!S.bestLap || S.lapT < S.bestLap) S.bestLap = S.lapT; floats.add(W / 2, H * 0.3, L('第 ' + lap + ' 圈 ', 'Lap ' + lap + '  ') + fmt(S.lapT), '#fde047', 24); S.lapT = 0; FX.sfx.good(); }
    if (lap >= LAPS) { c.done = ++S.fin; if (c.me) finish(); }
  }
  function finish() {
    var me = S.cars[0], pos = me.done, t = S.t; S.over = true;
    FX.sfx.great(); floats.add(W / 2, H * 0.4, ['🏆 1st', '🥈 2nd', '🥉 3rd', '4th'][pos - 1], '#fff', 44);
    var b = FX.best('sccircuit_' + trk, Math.round(t * 10) / 10, true);
    $('endEmoji').textContent = ['🏆', '🥈', '🥉', '🏁'][pos - 1]; $('endTitle').textContent = pos === 1 ? L('冠軍！', 'You win!') : L('完賽！', 'Finished!');
    $('endPos').textContent = pos + '/4'; $('endTime').textContent = fmt(t); $('endLap').textContent = fmt(S.bestLap);
    $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + fmt(b.best);
    if (window.SC) SC.post('gameover', { game: GAME, win: pos === 1, sec: t });
    var sec = window.SCLB ? (SCLB.elapsed(GAME) || t) : t;
    setTimeout(function () { S.run = false; eng.stop(); squeal.stop(); K.open('ovEnd'); $('cover').classList.remove('off'); if (window.SCLB) SCLB.offer({ game: GAME, mode: trk, score: sec, text: L(TRACKS[trk].n[0], TRACKS[trk].n[1]) + '・' + L('第 ', 'P') + pos + L(' 名', '') }); }, 1800);
  }

  // ---------- 繪圖 ----------
  function draw() {
    var cx = FX.clamp(S.cam.x, W / 2, WW - W / 2), cy = FX.clamp(S.cam.y, H / 2, WH - H / 2);
    ctx.save(); shake.apply(ctx);
    ctx.drawImage(tc, cx - W / 2, cy - H / 2, W, H, 0, 0, W, H);
    ctx.translate(W / 2 - cx, H / 2 - cy);
    smoke.draw(ctx);
    S.cars.slice().reverse().forEach(function (c) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a + Math.PI / 2); FX.car(ctx, 24, 44, c.col, { steer: c.steer * 0.45, stripe: c.me ? '#fff' : null, brake: c.me && FX.keys.down });
      ctx.restore();
      if (!c.me) FX.text(ctx, L(NAMES[S.cars.indexOf(c)][0], NAMES[S.cars.indexOf(c)][1]), c.x, c.y - 34, 11, '#fff', 'center', 'rgba(0,0,0,.6)');
    });
    ctx.restore();
    floats.draw(ctx);
    // 小地圖
    var mw = 112, mh = 84, mx = W - mw - 10, my = 10, sx = mw / WW, sy = mh / WH;
    ctx.fillStyle = 'rgba(8,12,10,.55)'; FX.rr(ctx, mx - 4, my - 4, mw + 8, mh + 8, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); for (var i = 0; i < T.N; i += 4) { var p = T.pts[i]; if (i) ctx.lineTo(mx + p.x * sx, my + p.y * sy); else ctx.moveTo(mx + p.x * sx, my + p.y * sy); } ctx.closePath(); ctx.stroke();
    S.cars.slice().reverse().forEach(function (c) { ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, c.me ? 4.5 : 3.2, 0, 7); ctx.fill(); if (c.me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); } });
    // 時速表
    var me = S.cars[0]; ctx.fillStyle = 'rgba(8,12,10,.55)'; FX.rr(ctx, 10, 10, 104, 40, 12); ctx.fill();
    FX.text(ctx, Math.round(me.sp * 0.62) + '', 58, 31, 24, '#fff', 'right'); FX.text(ctx, 'km/h', 64, 34, 11, '#cbd5e1', 'left');
  }

  FX.pad($('touch'), [{ k: 'left', t: '◀' }, { k: 'right', t: '▶' }, { gap: 1 }, { k: 'down', t: '🛑', cls: 'wide' }]);
  $('trk').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; trk = b.dataset.m; K.save('sccircuit_trk', trk); [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); buildIf(); reset(); });
  [].forEach.call($('trk').children, function (x) { x.classList.toggle('on', x.dataset.m === trk); });
  $('bStart').onclick = start; $('bAgain').onclick = start;
  $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; start(); } };
  FX.sound(function () { if (K.muted) { eng.stop(); squeal.stop(); } });
  buildIf(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__ci = { S: function () { return S; }, T: function () { return T; }, go: function (t) { trk = t || trk; buildIf(); reset(); $('cover').classList.add('off'); S.run = true; S.started = true; }, auto: function () { S.cars[0].me = false; S.cars[0].skill = 0.9; S.cars[0].lane = 0; }, tc: tc };
})();
