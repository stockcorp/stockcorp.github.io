/* 吞噬球球 — stockcorp.github.io/blob/
   世界 3000×3000；半徑 = √體重 × 4；速度 = 220 / 體重^0.22。體重大於對方 1.2 倍且中心進入自己範圍內才能吃。
   排行榜：mode = classic，最大體重越高越好。 */
(function () {
  'use strict';
  var GAME = 'blob', $ = K.$, L = K.L, WW = 3000, NFOOD = 1300, NBOT = 14;
  var NAMES = ['小藍', '阿肥', '湯圓', '球球', '泡泡', '咪咪', '豆豆', '丸子', '糖糖', '嘟嘟', '胖虎', '圓圓', '小白', '阿Q', 'Mochi', 'Bubble', 'Dot', 'Pudding'];
  var COLS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e'];
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, aim = null, keys = {}, cw = 600, ch = 400;
  function rad(m) { return Math.sqrt(m) * 4; }
  function spd(m) { return 230 / Math.pow(m, 0.22); }
  function rp() { return Math.random() * WW; }
  function newGame() {
    S = { food: [], bots: [], me: { x: WW / 2, y: WW / 2, m: 10, c: '#0d9488', n: L('你', 'You') }, peak: 10, t0: performance.now(), over: false, started: false, px: [], fl: [] };
    for (var i = 0; i < NFOOD; i++) S.food.push(food());
    for (i = 0; i < NBOT; i++) S.bots.push(bot());
    K.close('ovEnd'); $('msg').textContent = L('拖曳或移動滑鼠控制方向', 'Drag or move the mouse to steer'); setTimeout(function () { $('msg').textContent = ''; }, 2500);
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function food() { return { x: rp(), y: rp(), c: COLS[(Math.random() * COLS.length) | 0] }; }
  function bot() { var m = 8 + Math.random() * Math.random() * 120; for (var t = 0; t < 20; t++) { var x = rp(), y = rp(); if (!S.me || Math.hypot(x - S.me.x, y - S.me.y) > 600) break; } return { x: x, y: y, m: m, c: COLS[(Math.random() * COLS.length) | 0], n: NAMES[(Math.random() * NAMES.length) | 0], tx: rp(), ty: rp(), think: 0 }; }
  function loop(t) { var dt = Math.min(0.033, (t - last) / 1000); last = t; DT = dt; resize(); if (!S.over) step(dt); draw(); raf = requestAnimationFrame(loop); }
  function moveTo(o, dx, dy, dt) { var d = Math.hypot(dx, dy); if (d < 1) return; var s = spd(o.m) * Math.min(1, d / 60); o.x += dx / d * s * dt; o.y += dy / d * s * dt; var r = rad(o.m); o.x = Math.max(r, Math.min(WW - r, o.x)); o.y = Math.max(r, Math.min(WW - r, o.y)); }
  function step(dt) {
    var me = S.me;
    // 玩家方向：滑鼠/手指相對畫面中央；方向鍵
    var kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (kx || ky) moveTo(me, kx * 200, ky * 200, dt);
    else if (aim) moveTo(me, aim[0] - cw / 2, aim[1] - ch / 2, dt);
    if ((kx || ky || aim) && !S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
    var all = S.bots.concat([me]);
    // 電腦：附近有大球就逃，有小球就追，否則找食物
    S.bots.forEach(function (b) {
      b.think -= dt;
      if (b.think <= 0) {
        b.think = 0.25 + Math.random() * 0.3; var r = rad(b.m), threat = null, prey = null, td = 1e9, pd = 1e9;
        all.forEach(function (o) { if (o === b) return; var d = Math.hypot(o.x - b.x, o.y - b.y) - rad(o.m) - r; if (o.m > b.m * 1.2 && d < 220 && d < td) { td = d; threat = o; } else if (b.m > o.m * 1.25 && d < 300 && d < pd) { pd = d; prey = o; } });
        if (threat) { b.tx = b.x - (threat.x - b.x) * 3; b.ty = b.y - (threat.y - b.y) * 3; }
        else if (prey) { b.tx = prey.x; b.ty = prey.y; }
        else if (Math.hypot(b.tx - b.x, b.ty - b.y) < 40 || Math.random() < 0.05) { var best = null, bd = 1e9; for (var i = 0; i < 30; i++) { var f = S.food[(Math.random() * S.food.length) | 0], d2 = Math.hypot(f.x - b.x, f.y - b.y); if (d2 < bd) { bd = d2; best = f; } } if (best) { b.tx = best.x; b.ty = best.y; } }
      }
      moveTo(b, b.tx - b.x, b.ty - b.y, dt);
    });
    // 吃食物
    all.forEach(function (o) {
      var r = rad(o.m) + 4;
      for (var i = 0; i < S.food.length; i++) { var f = S.food[i]; if (Math.abs(f.x - o.x) < r && Math.abs(f.y - o.y) < r && (f.x - o.x) * (f.x - o.x) + (f.y - o.y) * (f.y - o.y) < r * r) { o.m += 1; if (o === me) { K.beep(700 + Math.random() * 200, 0.02, 'sine', 0.012); puff(f.x, f.y, f.c, 3, 60); } S.food[i] = food(); } }
      if (o.m > 60) o.m -= o.m * 0.0035 * dt * 10 * 0.1;
    });
    // 吃球
    for (var i = 0; i < all.length; i++) for (var j = 0; j < all.length; j++) {
      var a = all[i], b = all[j]; if (a === b || a.dead || b.dead) continue;
      if (a.m > b.m * 1.2 && Math.hypot(a.x - b.x, a.y - b.y) < rad(a.m) - rad(b.m) * 0.4) {
        a.m += b.m * 0.9; b.dead = true; a.grow = 1; puff(b.x, b.y, b.c, 16, 220);
        if (a === me) { K.tune([330, 494, 660], 60); navigator.vibrate && navigator.vibrate(20); S.sh = 9; S.fl.push({ x: b.x, y: b.y, t: 1.1, txt: '+' + Math.floor(b.m * 0.9), c: '#86efac', s: 22 }, { x: b.x, y: b.y - 26, t: 1.1, txt: L('吃掉 ', 'Ate ') + b.n, c: '#fff', s: 14 }); }
        if (b === me) return die(a);
      }
    }
    S.bots = S.bots.filter(function (b) { return !b.dead; }); while (S.bots.length < NBOT) S.bots.push(bot());
    S.peak = Math.max(S.peak, me.m);
    $('mass').textContent = Math.floor(me.m); $('peak').textContent = Math.floor(S.peak);
    var rank = 1; S.bots.forEach(function (b) { if (b.m > me.m) rank++; }); $('rank').textContent = rank + '/' + (NBOT + 1);
  }
  function die(by) {
    S.over = true; K.beep(150, 0.6, 'sawtooth', 0.07, 50); navigator.vibrate && navigator.vibrate(120); puff(S.me.x, S.me.y, S.me.c, 40, 320); S.sh = 16;
    var peak = Math.floor(S.peak), best = K.load('scblob_best', 0), nb = peak > best; if (nb) K.save('scblob_best', peak);
    var sec = Math.floor((performance.now() - S.t0) / 1000);
    $('endPeak').textContent = peak; $('endTime').textContent = K.fmtTime(sec);
    $('endBest').textContent = (nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best) + '　' + L('被「', 'Eaten by “') + by.n + L('」吃掉', '”');
    if (window.SC) SC.post('gameover', { game: GAME, score: peak });
    setTimeout(function () { K.open('ovEnd'); if (S.started && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: peak, text: L('存活 ', 'Survived ') + K.fmtTime(sec) }); }, 600);
  }
  function resize() { var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (Math.round(r.width) !== cw || Math.round(r.height) !== ch || !cv.width) { cw = Math.round(r.width); ch = Math.round(r.height); cv.width = cw * dpr; cv.height = ch * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } }
  var DT = 0.016, TT = 0;
  function puff(x, y, c, n, sp) { for (var i = 0; i < n && S.px.length < 260; i++) { var a = Math.random() * 6.283, v = sp * (0.3 + Math.random() * 0.7); S.px.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, r: 3 + Math.random() * 5, c: c }); } }
  function blobDraw(o, me, z) {
    var r = rad(o.m), dx = o.x - (o.lx == null ? o.x : o.lx), dy = o.y - (o.ly == null ? o.y : o.ly), d = Math.hypot(dx, dy); o.lx = o.x; o.ly = o.y;
    if (d > 0.05) { o.ex = (o.ex || 0) * 0.85 + dx / d * 0.15; o.ey = (o.ey || 0) * 0.85 + dy / d * 0.15; }
    o.seed = o.seed || Math.random() * 100; o.grow = Math.max(0, (o.grow || 0) - DT * 3);
    var rr = r * (1 + o.grow * 0.12), n = 26, k;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(o.x + r * 0.08, o.y + r * 0.12, rr, 0, 7); ctx.fill();
    ctx.beginPath(); for (k = 0; k <= n; k++) { var a = k / n * 6.2832, w = rr * (1 + Math.sin(a * 5 + TT * 3 + o.seed) * 0.022 + Math.sin(a * 3 - TT * 2.2 + o.seed) * 0.018); if (k) ctx.lineTo(o.x + Math.cos(a) * w, o.y + Math.sin(a) * w); else ctx.moveTo(o.x + w, o.y); } ctx.closePath();
    var g = ctx.createRadialGradient(o.x - rr * 0.35, o.y - rr * 0.4, rr * 0.1, o.x, o.y, rr); g.addColorStop(0, shade(o.c, 0.45)); g.addColorStop(0.6, o.c); g.addColorStop(1, shade(o.c, -0.3)); ctx.fillStyle = g; ctx.fill();
    var edible = o !== me && me.m > o.m * 1.2, danger = o !== me && o.m > me.m * 1.2;
    ctx.lineWidth = Math.max(2 / z, r * 0.07); ctx.strokeStyle = o === me ? '#fff' : danger ? '#f87171' : edible ? '#86efac' : 'rgba(255,255,255,.35)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(o.x - rr * 0.32, o.y - rr * 0.42, rr * 0.28, rr * 0.15, -0.5, 0, 7); ctx.fill();
    if (r * z > 9) { // 眼睛看向前進方向
      var ex = (o.ex || 0) * r * 0.1, ey = (o.ey || 0) * r * 0.1, er = r * 0.17, gap = r * 0.3, yy = o.y - r * 0.08;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x - gap, yy, er, 0, 7); ctx.arc(o.x + gap, yy, er, 0, 7); ctx.fill();
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(o.x - gap + ex, yy + ey, er * 0.55, 0, 7); ctx.arc(o.x + gap + ex, yy + ey, er * 0.55, 0, 7); ctx.fill();
      if (danger && Math.hypot(o.x - me.x, o.y - me.y) < r + 260) { ctx.strokeStyle = '#0f172a'; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(o.x - gap - er, yy - er * 1.5); ctx.lineTo(o.x - gap + er, yy - er * 0.9); ctx.moveTo(o.x + gap + er, yy - er * 1.5); ctx.lineTo(o.x + gap - er, yy - er * 0.9); ctx.stroke(); }
    }
    if (r * z > 13) { var fs = Math.max(10 / z, r * 0.28); ctx.fillStyle = '#fff'; ctx.font = '900 ' + fs + 'px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs * 0.22; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(o.n, o.x, o.y + r * 0.42); ctx.fillText(o.n, o.x, o.y + r * 0.42); }
  }
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k))); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function draw() {
    TT += DT; var me = S.me, z = Math.max(0.45, Math.min(1.2, 1.15 / Math.pow(rad(me.m) / 12.6, 0.45))) * Math.min(1, Math.max(cw, ch) / 700);
    S.zz = S.zz ? S.zz + (z - S.zz) * Math.min(1, DT * 3) : z; z = S.zz; S.sh = Math.max(0, (S.sh || 0) - DT * 30);
    var bg = ctx.createRadialGradient(cw / 2, ch / 2, 40, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); bg.addColorStop(0, '#16213e'); bg.addColorStop(1, '#070b18'); ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.save(); ctx.translate(cw / 2 + (Math.random() - 0.5) * S.sh, ch / 2 + (Math.random() - 0.5) * S.sh); ctx.scale(z, z); ctx.translate(-me.x, -me.y);
    var x0 = me.x - cw / 2 / z, y0 = me.y - ch / 2 / z, x1 = me.x + cw / 2 / z, y1 = me.y + ch / 2 / z;
    ctx.strokeStyle = 'rgba(148,163,184,.1)'; ctx.lineWidth = 1 / z; ctx.beginPath();
    for (var gx = Math.floor(x0 / 50) * 50; gx < x1; gx += 50) { ctx.moveTo(gx, Math.max(0, y0)); ctx.lineTo(gx, Math.min(WW, y1)); }
    for (var gy = Math.floor(y0 / 50) * 50; gy < y1; gy += 50) { ctx.moveTo(Math.max(0, x0), gy); ctx.lineTo(Math.min(WW, x1), gy); }
    ctx.stroke();
    ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 18; ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 5 / z; ctx.strokeRect(0, 0, WW, WW); ctx.shadowBlur = 0;
    S.food.forEach(function (f, i) { if (f.x < x0 - 10 || f.x > x1 + 10 || f.y < y0 - 10 || f.y > y1 + 10) return; var pr = 5 + Math.sin(TT * 3 + i) * 1.1; ctx.globalAlpha = 0.25; ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, pr + 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(f.x, f.y, pr, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(f.x - 1.5, f.y - 1.5, 1.6, 0, 7); ctx.fill(); });
    S.px.forEach(function (q) { q.life -= DT; q.x += q.vx * DT; q.y += q.vy * DT; q.vx *= 0.94; q.vy *= 0.94; if (q.life <= 0) return; ctx.globalAlpha = Math.min(1, q.life * 2.5); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * Math.min(1, q.life * 2), 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; S.px = S.px.filter(function (q) { return q.life > 0; });
    var list = S.bots.concat(S.over ? [] : [me]).sort(function (a, b) { return a.m - b.m; });
    list.forEach(function (o) { var r = rad(o.m); if (o.x + r < x0 || o.x - r > x1 || o.y + r < y0 || o.y - r > y1) return; blobDraw(o, me, z); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    S.fl.forEach(function (q) { q.t -= DT; if (q.t <= 0) return; var fs = q.s / z; ctx.globalAlpha = Math.min(1, q.t * 2.5); ctx.font = '900 ' + fs + 'px ui-rounded,system-ui,sans-serif'; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(q.txt, q.x, q.y - (1.1 - q.t) * 50 / z); ctx.fillStyle = q.c; ctx.fillText(q.txt, q.x, q.y - (1.1 - q.t) * 50 / z); }); ctx.globalAlpha = 1; S.fl = S.fl.filter(function (q) { return q.t > 0; });
    ctx.restore();
    // 排行榜（前 5 名）與小地圖
    var top = S.bots.concat(S.over ? [] : [me]).sort(function (a, b) { return b.m - a.m; }).slice(0, 5);
    ctx.fillStyle = 'rgba(7,11,24,.6)'; ctx.beginPath(); ctx.rect(8, 8, 118, 16 + top.length * 17); ctx.fill(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 11.5px system-ui';
    top.forEach(function (o, i) { ctx.fillStyle = o === me ? '#fde047' : '#e2e8f0'; ctx.fillText((i + 1) + '. ' + o.n, 15, 24 + i * 17); ctx.textAlign = 'right'; ctx.fillText(Math.floor(o.m), 119, 24 + i * 17); ctx.textAlign = 'left'; });
    var ms = 74, mx = cw - ms - 8, my = 8, sc = ms / WW; ctx.fillStyle = 'rgba(7,11,24,.6)'; ctx.fillRect(mx, my, ms, ms); ctx.strokeStyle = 'rgba(251,113,133,.6)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, ms, ms);
    S.bots.forEach(function (b) { ctx.fillStyle = b.m > me.m * 1.2 ? '#f87171' : 'rgba(148,163,184,.8)'; ctx.beginPath(); ctx.arc(mx + b.x * sc, my + b.y * sc, Math.max(1.5, rad(b.m) * sc), 0, 7); ctx.fill(); });
    if (!S.over) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + me.x * sc, my + me.y * sc, Math.max(2.5, rad(me.m) * sc), 0, 7); ctx.fill(); }
  }
  function rel(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  var down = false;
  cv.addEventListener('pointerdown', function (e) { down = true; aim = rel(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', function (e) { if (down || e.pointerType === 'mouse') aim = rel(e); });
  cv.addEventListener('pointerup', function (e) { down = false; if (e.pointerType !== 'mouse') aim = null; });
  cv.addEventListener('pointerleave', function () { if (!down) aim = null; });
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; if (e.key.indexOf('Arrow') === 0) { keys[e.key] = true; e.preventDefault(); } });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); keys = {}; });
  if (location.hash.indexOf('#test') === 0) window.__bl = { S: function () { return S; }, aim: function (a) { aim = a; } };
  newGame();
})();
