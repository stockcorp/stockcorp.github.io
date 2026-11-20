/* 軌道賽車 — stockcorp.github.io/slot/
   一鍵軌道車：車子固定在軌道上，只控制油門。離心力 = v² × 曲率，超過抓地上限一小段時間就飛出軌道。
   兩條車道（你在外側紅車、電腦在內側藍車），5 圈。排行榜：mode = easy/normal/hard（三條賽道），完賽時間（伺服器計時）。 */
(function () {
  'use strict';
  var GAME = 'slot', $ = K.$, L = K.L, W = 480, H = 620, LAPS = 5, STEP = 5, LANE = 11, AMAX = 1500, VMAX = 700;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H);
  var TR = {
    easy: { n: ['橢圓道', 'Oval'], sk: 0.9, p: [[100, 120], [240, 84], [380, 120], [410, 250], [330, 320], [410, 400], [380, 510], [240, 546], [100, 510], [70, 315]] },
    normal: { n: ['扭扭道', 'Twister'], sk: 0.93, p: [[90, 110], [240, 76], [392, 112], [398, 226], [276, 292], [398, 362], [394, 516], [240, 552], [86, 516], [150, 388], [72, 300], [152, 206]] },
    hard: { n: ['魔王道', 'Monster'], sk: 0.955, p: [[76, 104], [196, 78], [252, 176], [326, 84], [414, 116], [404, 246], [302, 298], [408, 376], [398, 526], [276, 552], [232, 440], [156, 536], [76, 498], [124, 364], [64, 266], [142, 204]] }
  };
  var tc = document.createElement('canvas'); tc.width = W * 2; tc.height = H * 2; var tg = tc.getContext('2d');
  var T = null, S = null, trk = K.load('scslot_trk', 'easy'), eng = FX.Engine('square'), sparks = FX.Parts(200), floats = FX.Floats(), shake = FX.Shake();

  function build(id) {
    var P = TR[id].p, n = P.length, raw = [], i, t;
    for (i = 0; i < n; i++) { var p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n]; for (t = 0; t < 1; t += 0.02) { var t2 = t * t, t3 = t2 * t; raw.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
    raw = raw.slice(25).concat(raw.slice(0, 25));
    var pts = [], acc = 0;
    for (i = 0; i < raw.length; i++) { var a = raw[i], b = raw[(i + 1) % raw.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); while (acc <= d) { pts.push({ x: a[0] + (b[0] - a[0]) * acc / d, y: a[1] + (b[1] - a[1]) * acc / d }); acc += STEP; } acc -= d; }
    var N = pts.length;
    for (i = 0; i < N; i++) { var q = pts[(i + 1) % N], pr = pts[(i - 1 + N) % N]; pts[i].a = Math.atan2(q.y - pr.y, q.x - pr.x); }
    for (i = 0; i < N; i++) { var da = pts[(i + 3) % N].a - pts[(i - 3 + N) % N].a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; pts[i].k = da / (6 * STEP); pts[i].v = Math.min(VMAX, Math.sqrt(AMAX * 0.94 / Math.max(Math.abs(pts[i].k), 0.0004))); }
    for (var pass = 0; pass < 2; pass++) for (i = N - 1; i >= 0; i--) pts[i].v = Math.min(pts[i].v, Math.sqrt(pts[(i + 1) % N].v * pts[(i + 1) % N].v + 2 * 380 * STEP));
    T = { id: id, pts: pts, N: N, len: N * STEP }; paint();
  }
  function lanePos(d, lane) { var f = ((d / STEP) % T.N + T.N) % T.N, i = Math.floor(f), t = f - i, a = T.pts[i], b = T.pts[(i + 1) % T.N], ang = a.a + angd(b.a, a.a) * t, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; var kk = a.k + (b.k - a.k) * t; return { x: x - Math.sin(ang) * lane, y: y + Math.cos(ang) * lane, a: ang, k: kk, v: a.v * Math.sqrt(Math.max(0.3, 1 - kk * lane)) }; }
  function angd(a, b) { var d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; }
  function lanePath(g, lane) { g.beginPath(); for (var i = 0; i <= T.N; i++) { var p = T.pts[i % T.N], x = p.x - Math.sin(p.a) * lane, y = p.y + Math.cos(p.a) * lane; if (i) g.lineTo(x, y); else g.moveTo(x, y); } }
  function paint() {
    var g = tg, i; g.setTransform(2, 0, 0, 2, 0, 0);
    // 木地板
    var wd = g.createLinearGradient(0, 0, W, H); wd.addColorStop(0, '#8a5a34'); wd.addColorStop(1, '#6d4526'); g.fillStyle = wd; g.fillRect(0, 0, W, H);
    for (i = 0; i < H; i += 44) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, i, W, 2); for (var j = 0; j < 4; j++) { g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(((i * 7 + j * 137) % W), i, 2, 44); } }
    for (i = 0; i < 500; i++) { g.fillStyle = 'rgba(255,220,170,.05)'; g.fillRect(Math.random() * W, Math.random() * H, 30 + Math.random() * 60, 1); }
    g.lineJoin = 'round'; g.lineCap = 'round';
    lanePath(g, 0); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 62; g.save(); g.translate(3, 5); g.stroke(); g.restore();
    lanePath(g, 0); g.strokeStyle = '#f1f5f9'; g.lineWidth = 58; g.stroke();
    lanePath(g, 0); g.setLineDash([12, 12]); g.strokeStyle = '#ef4444'; g.lineWidth = 58; g.stroke(); g.setLineDash([]);
    lanePath(g, 0); g.strokeStyle = '#23262f'; g.lineWidth = 50; g.stroke();
    lanePath(g, 0); g.strokeStyle = '#2c303b'; g.lineWidth = 2; g.stroke();
    [-LANE, LANE].forEach(function (ln) { lanePath(g, ln); g.strokeStyle = '#0c0d11'; g.lineWidth = 5; g.stroke(); lanePath(g, ln - 2.4); g.strokeStyle = '#aeb4c0'; g.lineWidth = 1.2; g.stroke(); lanePath(g, ln + 2.4); g.stroke(); });
    var s0 = T.pts[0]; g.save(); g.translate(s0.x, s0.y); g.rotate(s0.a); for (var r = 0; r < 2; r++) for (var c = 0; c < 10; c++) { g.fillStyle = (r + c) % 2 ? '#111' : '#fff'; g.fillRect(-5 + r * 5, -25 + c * 5, 5, 5); } g.restore();
    FX.text(g, 'STOCKCORP RACEWAY', W / 2, H - 16, 12, 'rgba(255,255,255,.35)');
  }

  function reset() {
    S = { cars: [mk(LANE, '#e11d48', true), mk(-LANE, '#3b82f6', false)], run: false, started: false, over: false, t: 0, offs: 0, hold: false, bestLap: 0, lapT: 0 };
    sparks.clear(); floats.clear(); hud();
  }
  function mk(lane, col, me) { return { lane: lane, col: col, me: me, d: -14 - (me ? 0 : 0), v: 0, lap: 0, slip: 0, meter: 0, off: 0, ox: 0, oy: 0, ovx: 0, ovy: 0, orot: 0, fin: 0, tail: 0, skill: TR[trk].sk }; }
  function hud() { var me = S.cars[0], ai = S.cars[1]; $('lap').textContent = Math.min(LAPS, me.lap) + '/' + LAPS; $('pos').textContent = me.fin ? (me.fin < (ai.fin || 1e9) ? L('第 1 名', '1st') : L('第 2 名', '2nd')) : (me.d >= ai.d ? L('領先', 'Leading') : L('落後', 'Behind')); $('time').textContent = fmt(S.t); }
  function fmt(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function start() {
    if (!T || T.id !== trk) build(trk); reset(); $('cover').classList.add('off'); K.close('ovEnd'); $('bLb').href = '/leaderboard/?game=slot&mode=' + trk;
    FX.countdown($('big'), function () { S.run = true; S.started = true; if (window.SCLB) SCLB.start(GAME, trk); if (window.SC) SC.post('start', { game: GAME, level: trk }); });
  }
  function step(dt) {
    sparks.step(dt); floats.step(dt); shake.step(dt);
    if (!S.run) { eng.set(80, 0); return; }
    S.t += dt; S.lapT += dt;
    var hold = S.hold || FX.keys.a || FX.keys.up;
    S.cars.forEach(function (c) {
      if (c.off > 0) { c.off -= dt; c.ox += c.ovx * dt; c.oy += c.ovy * dt; c.ovx *= 1 - 2.5 * dt; c.ovy *= 1 - 2.5 * dt; c.orot += 14 * dt * Math.max(0, c.off); if (c.off <= 0) { c.v = 0; c.meter = 0; } return; }
      var p = lanePos(c.d, c.lane), gas;
      if (c.me) gas = hold && !c.fin; else { var ahead = lanePos(c.d + 22 + c.v * 0.05, c.lane); gas = !c.fin && c.v < Math.min(p.v, ahead.v) * c.skill; }
      if (c.fin) c.v = Math.max(0, c.v - 420 * dt); else if (gas) c.v += 820 * (1.12 - c.v / VMAX) * dt; else c.v = Math.max(0, c.v - (260 + c.v * 1.1) * dt);
      c.d += c.v * dt;
      // 離心力與飛出
      var kk = p.k / (1 - p.k * c.lane), lat = c.v * c.v * Math.abs(kk); c.slip = lat / AMAX;
      c.tail += ((c.slip > 0.55 ? Math.sign(kk) * Math.min(0.75, (c.slip - 0.55) * 1.3) : 0) - c.tail) * Math.min(1, dt * 12);
      if (c.slip > 1) { c.meter += (c.slip - 1) * 9 * dt + dt * 1.2; if (Math.random() < 0.7) sparks.burst(p.x, p.y, 2, { c: ['#fde047', '#fb923c', '#fff'], sp: 160, life: 0.25, size: 3, g: 0 }); } else c.meter = Math.max(0, c.meter - dt * 2.5);
      if (c.meter >= 0.42) { // 飛出去
        c.off = 1.7; c.ox = p.x; c.oy = p.y; var out = Math.sign(kk) || 1; c.ovx = Math.cos(p.a) * c.v * 0.7 + Math.sin(p.a) * out * 120; c.ovy = Math.sin(p.a) * c.v * 0.7 - Math.cos(p.a) * out * 120; c.orot = p.a; c.tail = 0;
        if (c.me) { S.offs++; shake.kick(10); FX.sfx.crash(); floats.add(p.x, p.y - 20, L('飛出去了！', 'Off track!'), '#f87171', 18); } else K.beep(160, 0.2, 'sawtooth', 0.03, 80);
      }
      var lap = Math.floor(c.d / T.len);
      if (lap > c.lap && c.d > 0) { c.lap = lap; if (c.me) { if (!S.bestLap || S.lapT < S.bestLap) S.bestLap = S.lapT; if (lap < LAPS) { floats.add(W / 2, 40, L('第 ' + (lap + 1) + ' 圈', 'Lap ' + (lap + 1)) + '  ' + S.lapT.toFixed(2) + 's', '#fde047', 18); FX.sfx.tick(); } S.lapT = 0; } if (lap >= LAPS && !c.fin) { c.fin = S.t; if (c.me) finish(); } }
    });
    var me = S.cars[0]; eng.set(90 + me.v * 0.75, me.off > 0 ? 0 : 0.018 + (hold ? 0.012 : 0)); hud();
  }
  function finish() {
    var me = S.cars[0], ai = S.cars[1], win = !ai.fin || me.fin <= ai.fin, t = me.fin; S.over = true; FX.sfx.great();
    var b = FX.best('scslot_' + trk, Math.round(t * 100) / 100, true);
    $('endEmoji').textContent = win ? '🏆' : '🥈'; $('endTitle').textContent = win ? L('你贏了！', 'You win!') : L('完賽！', 'Finished!');
    $('endPos').textContent = win ? L('第 1 名', '1st') : L('第 2 名', '2nd'); $('endTime').textContent = fmt(t); $('endOff').textContent = S.offs;
    $('endBest').textContent = (b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + fmt(b.best)) + '　' + L('最快單圈 ', 'Best lap ') + S.bestLap.toFixed(2) + 's';
    if (window.SC) SC.post('gameover', { game: GAME, win: win, sec: t });
    var sec = window.SCLB ? (SCLB.elapsed(GAME) || t) : t;
    var s0 = S; setTimeout(function () { if (S !== s0) return; S.run = false; eng.stop(); K.open('ovEnd'); $('cover').classList.remove('off'); if (window.SCLB) SCLB.offer({ game: GAME, mode: trk, score: sec, text: L(TR[trk].n[0], TR[trk].n[1]) + '・' + S.offs + L(' 次飛出', ' crashes') }); }, 1500);
  }
  function draw(time) {
    ctx.save(); shake.apply(ctx);
    ctx.drawImage(tc, 0, 0, W, H);
    S.cars.slice().reverse().forEach(function (c) {
      var x, y, a;
      if (c.off > 0) { x = c.ox; y = c.oy; a = c.orot; } else { var p = lanePos(c.d, c.lane); x = p.x; y = p.y; a = p.a + c.tail; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); if (c.tail && !c.off) ctx.translate(0, -5);
      FX.car(ctx, 15, 30, c.col, { stripe: c.me ? '#fff' : '#fde047' }); ctx.restore();
    });
    sparks.draw(ctx); floats.draw(ctx);
    ctx.restore();
    // 抓地表
    var me = S.cars[0], s = FX.clamp(me.off > 0 ? 1.3 : me.slip, 0, 1.3), bw = 200, bx = W / 2 - bw / 2, by = H - 46;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; FX.rr(ctx, bx - 8, by - 20, bw + 16, 42, 12); ctx.fill();
    FX.text(ctx, L('抓地力', 'GRIP'), bx, by - 8, 11, '#cbd5e1', 'left'); FX.text(ctx, Math.round(me.v * 0.5) + ' km/h', bx + bw, by - 8, 11, '#fff', 'right');
    ctx.fillStyle = '#1f2937'; FX.rr(ctx, bx, by, bw, 12, 6); ctx.fill();
    var g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#22c55e'); g.addColorStop(0.6, '#facc15'); g.addColorStop(0.77, '#ef4444'); g.addColorStop(1, '#ef4444');
    ctx.save(); FX.rr(ctx, bx, by, bw * s / 1.3, 12, 6); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(bx, by, bw, 12); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw / 1.3 - 1, by - 3, 2, 18);
    if (s > 1 && Math.floor(time * 12) % 2) FX.text(ctx, L('太快了！', 'TOO FAST!'), W / 2, by - 34, 18, '#f87171', 'center', 'rgba(0,0,0,.7)');
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); S.hold = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { cv.addEventListener(n, function () { if (S) S.hold = false; }); });
  function pad() { FX.pad($('touch'), [{ k: 'a', t: L('按住加速', 'HOLD TO ACCELERATE'), cls: 'wide go' }]); }
  $('trk').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; trk = b.dataset.m; K.save('scslot_trk', trk); [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); build(trk); reset(); });
  [].forEach.call($('trk').children, function (x) { x.classList.toggle('on', x.dataset.m === trk); });
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; start(); } };
  FX.sound(function () { if (K.muted) eng.stop(); }); if (window.SC) SC.onLang(pad);
  pad(); build(trk); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__sl2 = { S: function () { return S; }, T: function () { return T; }, go: function (t) { trk = t; build(t); reset(); $('cover').classList.add('off'); S.run = true; S.started = true; }, lanePos: lanePos };
})();
