/* 極速賽車 — stockcorp.github.io/racing/
   俯視高速公路無盡賽車：4 車道、越開越快、金幣、氮氣（無敵加速）、擦身加分。
   排行榜：mode endless，分數越高越好（伺服器限制每秒最多 600 分）。 */
(function () {
  'use strict';
  var GAME = 'racing', MODE = 'endless', $ = K.$, L = K.L;
  var cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage');
  var W = 360, H = 640, LANES = 4, ROAD = 300, RX = 30, LW = 75, scale = 1;
  var CAR_W = 42, CAR_H = 76;
  var S = null, running = false, paused = false, lastT = 0, roadY = 0, parts = [];
  var COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#e5e7eb', '#14b8a6', '#f97316', '#64748b'];

  function resize() {
    var r = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = r.width / W; H = Math.round(r.height / scale);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (!running) drawScene();
  }
  function laneX(l) { return RX + LW * l + LW / 2; }

  function reset() {
    S = { lane: 1, x: laneX(1), v: 260, dist: 0, coins: 0, near: 0, score: 0, cars: [], items: [], spawn: 0, nitro: 0, boost: 0, t: 0, over: false };
    parts = [];
  }
  function start() {
    reset(); running = true; paused = false; lastT = performance.now();
    K.close('ovStart'); K.close('ovEnd'); K.close('ovPause');
    if (window.SCLB) SCLB.start(GAME, MODE);
    if (window.SC) SC.post('start', { game: GAME });
    requestAnimationFrame(frame);
  }

  // ---------- 產生車流 ----------
  function spawnRow() {
    var lanes = [0, 1, 2, 3], busy = K.shuffle(lanes.slice()), n = Math.random() < Math.min(0.55, 0.15 + S.t / 200) ? 2 : 1;
    // 至少留一條空車道，而且確保上一排的空道還能過去
    for (var k = 0; k < n; k++) {
      var l = busy[k];
      S.cars.push({ lane: l, x: laneX(l), y: -CAR_H - Math.random() * 40, sp: 0.5, c: COLORS[(Math.random() * COLORS.length) | 0], truck: Math.random() < 0.18, passed: false });
    }
    var free = busy.slice(n), r = Math.random();
    if (r < 0.55) { var fl = free[(Math.random() * free.length) | 0]; for (var j = 0; j < 4; j++) S.items.push({ type: 'coin', x: laneX(fl), y: -40 - j * 46 }); }
    else if (r < 0.62) { var nl = free[(Math.random() * free.length) | 0]; S.items.push({ type: 'nitro', x: laneX(nl), y: -60 }); }
  }

  // ---------- 主迴圈 ----------
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (!paused) update(dt);
    drawScene();
    if (running) requestAnimationFrame(frame);
  }
  function update(dt) {
    S.t += dt;
    var base = Math.min(820, 260 + S.t * 7), boost = S.boost > 0;
    S.v += ((boost ? base * 1.55 : base) - S.v) * Math.min(1, dt * 3);
    if (boost) S.boost -= dt;
    var dy = S.v * dt; roadY = (roadY + dy) % 80; S.dist += dy;
    // 換車道（平滑移動）
    var tx = laneX(S.lane); S.x += (tx - S.x) * Math.min(1, dt * 14);
    // 生成
    S.spawn -= dy;
    if (S.spawn <= 0) { spawnRow(); S.spawn = Math.max(170, 330 - S.t * 1.6) + Math.random() * 120; }
    var py = H - CAR_H - 40, me = { x: S.x - CAR_W / 2 + 5, y: py + 6, w: CAR_W - 10, h: CAR_H - 12 };
    for (var i = S.cars.length - 1; i >= 0; i--) {
      var c = S.cars[i], ch = c.truck ? 110 : CAR_H;
      c.y += dy * (1 - c.sp);
      if (c.y > H + 20) { S.cars.splice(i, 1); continue; }
      if (c.hit) { c.x += c.vx * dt; c.rot += c.vr * dt; continue; }
      var box = { x: c.x - CAR_W / 2 + 4, y: c.y + 4, w: CAR_W - 8, h: ch - 8 };
      if (hit(me, box)) {
        if (boost) { c.hit = true; c.vx = (c.x < S.x ? -1 : 1) * 260; c.vr = (Math.random() - 0.5) * 12; c.rot = 0; S.score += 30; burst(c.x, c.y + ch / 2, '#facc15', 14); K.beep(140, 0.15, 'square', 0.06); }
        else return crash(c);
      }
      // 擦身而過：從旁邊車道超過
      if (!c.passed && c.y > py + CAR_H) {
        c.passed = true;
        if (Math.abs(c.x - S.x) < LW * 1.15 && Math.abs(c.x - S.x) > 20) { S.near++; S.score += 25; floatTxt(L('驚險 +25', 'Close +25'), S.x, py - 10); K.beep(990, 0.05, 'sine', 0.04); }
      }
    }
    for (var j = S.items.length - 1; j >= 0; j--) {
      var it = S.items[j]; it.y += dy;
      if (it.y > H + 20) { S.items.splice(j, 1); continue; }
      if (Math.abs(it.x - S.x) < 30 && it.y > py - 16 && it.y < py + CAR_H) {
        S.items.splice(j, 1);
        if (it.type === 'coin') { S.coins++; S.score += 50; S.nitro = Math.min(1, S.nitro + 0.1); K.beep(1320, 0.05, 'triangle', 0.04); burst(it.x, it.y, '#fde047', 6); }
        else { S.nitro = 1; K.beep(600, 0.2, 'sine', 0.06, 1200); burst(it.x, it.y, '#38bdf8', 10); K.toast(L('氮氣集滿！點 ⚡ 或按空白鍵', 'Nitro full! Tap ⚡ or press Space'), 1500); }
      }
    }
    S.score += dy / 10 * (1 + Math.min(S.t, 300) / 150);
    parts = parts.filter(function (p) { p.x += p.vx * dt; p.y += p.vy * dt + dy * 0.3; p.life -= dt; return p.life > 0; });
    if (boost && Math.random() < 0.8) parts.push({ x: S.x + (Math.random() - 0.5) * 20, y: py + CAR_H, vx: (Math.random() - 0.5) * 40, vy: 120 + Math.random() * 80, life: 0.35, c: Math.random() < 0.5 ? '#38bdf8' : '#a78bfa' });
    hud();
  }
  function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function burst(x, y, c, n) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, s = 60 + Math.random() * 140; parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, c: c }); } }
  var floats = [];
  function floatTxt(t, x, y) { floats.push({ t: t, x: x, y: y, life: 0.8 }); }

  function crash(c) {
    S.over = true; running = false;
    burst(S.x, H - CAR_H, '#f97316', 30); burst(S.x, H - CAR_H, '#ef4444', 20);
    drawScene();
    K.beep(90, 0.6, 'sawtooth', 0.09, 40); navigator.vibrate && navigator.vibrate([80, 40, 120]);
    var sc = Math.floor(S.score), best = K.load('scrace_best', 0);
    if (sc > best) K.save('scrace_best', sc);
    $('endScore').textContent = sc; $('endKm').textContent = (S.dist / 4000).toFixed(2); $('endCoins').textContent = S.coins;
    $('endBest').textContent = sc > best ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    if (window.SC) SC.post('gameover', { game: GAME, score: sc });
    setTimeout(function () {
      K.open('ovEnd');
      if (window.SCLB && sc > 0) SCLB.offer({ game: GAME, mode: MODE, score: sc, text: sc + L(' 分', ' pts') });
    }, 700);
  }

  // ---------- 繪圖 ----------
  function drawCar(x, y, col, truck, me, rot) {
    var w = CAR_W, h = truck ? 110 : CAR_H;
    ctx.save(); ctx.translate(x, y + h / 2); if (rot) ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(-w / 2 + 3, -h / 2 + 5, w, h, 9); ctx.fill();
    ctx.fillStyle = col; rr(-w / 2, -h / 2, w, h, truck ? 6 : 10); ctx.fill();
    if (truck) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(-w / 2 + 3, -h / 2 + 28, w - 6, h - 32, 4); ctx.fill();
      ctx.fillStyle = '#0f172a'; rr(-w / 2 + 5, -h / 2 + 6, w - 10, 14, 3); ctx.fill();
    } else {
      ctx.fillStyle = '#0f172a'; rr(-w / 2 + 5, me ? -h / 2 + 14 : h / 2 - 30, w - 10, 16, 4); ctx.fill();
      ctx.fillStyle = 'rgba(15,23,42,.75)'; rr(-w / 2 + 6, me ? h / 2 - 22 : -h / 2 + 12, w - 12, 10, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(-w / 2 + 6, -8, w - 12, 18, 4); ctx.fill();
    }
    // 燈
    ctx.fillStyle = me ? '#fef9c3' : '#fecaca';
    var ly = me ? -h / 2 + 1 : h / 2 - 5;
    ctx.fillRect(-w / 2 + 4, ly, 9, 4); ctx.fillRect(w / 2 - 13, ly, 9, 4);
    if (me) { ctx.fillStyle = '#fff'; ctx.fillRect(-2, -h / 2 + 32, 4, 30); }
    ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawScene() {
    if (!S) reset();
    ctx.fillStyle = '#1f3a1f'; ctx.fillRect(0, 0, W, H);
    // 路邊樹叢
    ctx.fillStyle = '#2d5a2d';
    for (var y = -80 + roadY; y < H; y += 80) { ctx.beginPath(); ctx.arc(12, y + 20, 12, 0, 7); ctx.arc(W - 12, y + 60, 12, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#3b3f48'; ctx.fillRect(RX, 0, ROAD, H);
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(RX - 4, 0, 4, H); ctx.fillRect(RX + ROAD, 0, 4, H);
    ctx.fillStyle = '#f8fafc';
    for (var l = 1; l < LANES; l++) for (var yy = -80 + roadY; yy < H; yy += 80) ctx.fillRect(RX + LW * l - 2, yy, 4, 40);
    if (S.boost > 0) { ctx.fillStyle = 'rgba(147,197,253,.12)'; for (var s = 0; s < 8; s++) ctx.fillRect(RX + Math.random() * ROAD, Math.random() * H, 2, 60); }
    S.items.forEach(function (it) {
      if (it.type === 'coin') { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(it.x, it.y, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#a16207'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', it.x, it.y + 1); }
      else { ctx.fillStyle = '#38bdf8'; rr(it.x - 10, it.y - 18, 20, 32, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', it.x, it.y - 2); }
    });
    S.cars.forEach(function (c) { drawCar(c.x, c.y, c.c, c.truck, false, c.rot); });
    var py = H - CAR_H - 40;
    if (S.boost > 0) { ctx.fillStyle = 'rgba(250,204,21,.25)'; ctx.beginPath(); ctx.ellipse(S.x, py + CAR_H / 2, 34, 52, 0, 0, 7); ctx.fill(); }
    if (!S.over) drawCar(S.x, py, '#2563eb', false, true, (laneX(S.lane) - S.x) * 0.004);
    parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); });
    ctx.globalAlpha = 1;
    floats = floats.filter(function (f) { f.life -= 0.016; f.y -= 1; ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = '#fde047'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.t, f.x, f.y); ctx.globalAlpha = 1; return f.life > 0; });
  }
  function hud() {
    $('score').textContent = Math.floor(S.score);
    $('kmh').textContent = Math.round(S.v / 3);
    $('coins').textContent = S.coins;
    $('nitroFill').style.width = (S.nitro * 100) + '%';
    $('nitroBtn').classList.toggle('ready', S.nitro >= 1 && S.boost <= 0);
  }

  // ---------- 操作 ----------
  function steer(d) { if (!running || paused) return; var n = Math.max(0, Math.min(LANES - 1, S.lane + d)); if (n !== S.lane) { S.lane = n; K.beep(420, 0.03, 'sine', 0.02); } }
  function nitro() { if (!running || paused || S.nitro < 1 || S.boost > 0) return; S.nitro = 0; S.boost = 3.5; K.beep(200, 0.6, 'sawtooth', 0.06, 900); }
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { steer(-1); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { steer(1); e.preventDefault(); }
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); if (!running && K.isOpen('ovStart')) start(); else nitro(); }
    else if (k === 'p' || k === 'P' || k === 'Escape') pause(!paused);
  });
  var sx = 0, sy = 0, down = false, swiped = false;
  stage.addEventListener('pointerdown', function (e) { if (e.target.closest('#nitroBtn')) return; down = true; swiped = false; sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointermove', function (e) {
    if (!down || swiped) return; var dx = e.clientX - sx;
    if (Math.abs(dx) > 28) { steer(dx > 0 ? 1 : -1); swiped = true; }
  });
  stage.addEventListener('pointerup', function (e) {
    if (!down) return; down = false; if (swiped) return;
    var r = stage.getBoundingClientRect(); steer(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });
  stage.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  $('nitroBtn').addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); nitro(); });

  function pause(p) {
    if (!running) return; paused = p;
    if (p) K.open('ovPause'); else { K.close('ovPause'); lastT = performance.now(); }
    $('bPause').textContent = p ? '▶' : '⏸';
  }
  $('bPause').onclick = function () { pause(!paused); };
  $('bResume').onclick = function () { pause(false); };
  $('bQuit').onclick = function () { running = false; K.close('ovPause'); $('bPause').textContent = '⏸'; showStart(); };
  $('bStart').onclick = start;
  $('bAgain').onclick = start;
  document.addEventListener('visibilitychange', function () { if (document.hidden && running && !paused) pause(true); });
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  function showStart() {
    reset(); drawScene(); hud();
    var best = K.load('scrace_best', 0);
    $('bestLine').textContent = best ? L('個人最佳：', 'Personal best: ') + best : '';
    K.open('ovStart');
  }
  window.addEventListener('resize', resize);
  resize(); showStart();
})();
