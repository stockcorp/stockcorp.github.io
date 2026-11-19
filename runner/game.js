/* 恐龍跑酷 — stockcorp.github.io/runner/
   邏輯 720×300。速度從 330 起，每 100 分 +20（上限 900）。障礙：小/大/成排仙人掌、高/低飛鳥（250 分後出現）。
   排行榜：mode = classic，分數（距離）越高越好。 */
(function () {
  'use strict';
  var GAME = 'runner', $ = K.$, L = K.L, W = 720, H = 300, GY = 248, X0 = 80;
  // 手機直式畫面比較窄：邏輯寬度改成 460，角色看起來比較大
  function fit() { W = window.innerWidth < 640 ? 460 : 720; X0 = W < 600 ? 50 : 80; var c = $('cv'); if (c.width !== W) c.width = W; }
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, keys = { jump: false, duck: false };
  function newGame() {
    fit();
    S = { y: 0, vy: 0, duck: false, obs: [], dist: 0, speed: 330, top: 330, next: 1.2, over: false, started: false, t: 0, clouds: [[100, 60], [400, 40], [650, 80]], night: 0 };
    K.close('ovEnd'); $('msg').textContent = L('點一下開始', 'Tap to start'); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function score() { return Math.floor(S.dist / 12); }
  function jump() {
    if (!S || S.over) return;
    if (!S.started) { S.started = true; $('msg').textContent = ''; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
    if (S.y === 0) { S.vy = 720; K.beep(520, 0.05, 'square', 0.03, 780); }
  }
  function spawn() {
    var sc = score(), r = Math.random(), o;
    if (sc > 250 && r < 0.28) o = { k: 'bird', w: 46, h: 30, y: [8, 40, 74][(Math.random() * 3) | 0], f: 0 };
    else { var n = r < 0.55 ? 1 : r < 0.8 ? 2 : 3, big = Math.random() < 0.45; o = { k: 'cac', n: n, big: big, w: (big ? 24 : 17) * n + (n - 1) * 4, h: big ? 48 : 34, y: 0 }; }
    o.x = W + 20; S.obs.push(o);
    var gap = 0.75 + Math.random() * 0.9 - Math.min(0.35, (S.speed - 330) / 1600);
    S.next = gap * (330 / S.speed) * 1.6 + 0.35;
  }
  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (S.started && !S.over) step(dt);
    draw(); raf = requestAnimationFrame(loop);
  }
  function step(dt) {
    S.t += dt; S.dist += S.speed * dt;
    S.speed = Math.min(900, 330 + Math.floor(score() / 100) * 20); S.top = Math.max(S.top, S.speed);
    // 跳躍：按住較高（重力較小）；空中蹲下快速下降
    var g = keys.jump && S.vy > 0 ? 1800 : 3000; if (keys.duck && S.y > 0) g = 6000;
    S.vy -= g * dt; S.y += S.vy * dt; if (S.y <= 0) { S.y = 0; S.vy = 0; }
    S.duck = keys.duck && S.y === 0;
    S.next -= dt; if (S.next <= 0) spawn();
    S.obs.forEach(function (o) { o.x -= S.speed * dt * (o.k === 'bird' ? 1.08 : 1); o.f += dt; });
    S.obs = S.obs.filter(function (o) { return o.x + o.w > -20; });
    S.clouds.forEach(function (c) { c[0] -= 30 * dt; if (c[0] < -80) { c[0] = W + 40; c[1] = 30 + Math.random() * 70; } });
    if (score() > 0 && score() % 100 === 0 && !S.beeped) { S.beeped = true; K.beep(880, 0.1, 'square', 0.03, 1320); } else if (score() % 100) S.beeped = false;
    // 碰撞（縮小一點的方框，比較公平）
    var bw = S.duck ? 52 : 40, bh = S.duck ? 26 : 44, bx = X0 + 4, by = GY - S.y - bh;
    for (var i = 0; i < S.obs.length; i++) {
      var o = S.obs[i], ox = o.x + 4, oy = GY - o.y - o.h + 4, ow = o.w - 8, oh = o.h - 6;
      if (bx < ox + ow && bx + bw - 6 > ox && by + 4 < oy + oh && by + bh > oy) return die();
    }
  }
  function die() {
    S.over = true; K.beep(140, 0.4, 'sawtooth', 0.07, 60); navigator.vibrate && navigator.vibrate(100);
    var sc = score(), best = K.load('scrun_best', 0), nb = sc > best; if (nb) K.save('scrun_best', sc);
    $('endScore').textContent = sc; $('endSpeed').textContent = Math.round(S.top / 33) + ' km/h';
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    if (window.SC) SC.post('gameover', { game: GAME, score: sc });
    setTimeout(function () { K.open('ovEnd'); if (sc > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: sc, text: Math.round(S.top / 33) + ' km/h' }); }, 500);
  }
  function dino(x, y, duck, t) {
    ctx.save(); ctx.translate(x, y);
    var body = '#f97316', belly = '#fed7aa', leg = Math.floor(t * 12) % 2;
    if (duck) {
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(28, -13, 30, 13, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(56, -15, 13, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(60, -18, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(61, -18, 1.8, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(2, -20); ctx.quadraticCurveTo(-14, -16, -18, -28); ctx.quadraticCurveTo(-6, -24, 6, -30); ctx.fill();
      ctx.beginPath(); ctx.ellipse(18, -24, 17, 16, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(32, -46, 13, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(22, -20, 9, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(36, -49, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(37, -49, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#c2410c'; for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(6 + i * 8, -38 + i * 2); ctx.lineTo(10 + i * 8, -46 + i * 2); ctx.lineTo(14 + i * 8, -37 + i * 2); ctx.fill(); }
    }
    ctx.fillStyle = '#c2410c';
    if (y < GY - 1 || !S.started) { ctx.fillRect(10, -8, 6, 8); ctx.fillRect(24, -8, 6, 8); }
    else { ctx.fillRect(10, leg ? -8 : -4, 6, leg ? 8 : 4); ctx.fillRect(24, leg ? -4 : -8, 6, leg ? 4 : 8); }
    ctx.restore();
  }
  function cactus(o) {
    for (var i = 0; i < o.n; i++) {
      var w = o.big ? 24 : 17, x = o.x + i * (w + 4), h = o.h - (i % 2) * 6, y = GY;
      ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + w * 0.3, y - h, w * 0.4, h, w * 0.2) : ctx.rect(x + w * 0.3, y - h, w * 0.4, h); ctx.fill();
      ctx.fillRect(x, y - h * 0.62, w * 0.2, h * 0.3); ctx.fillRect(x, y - h * 0.4, w * 0.4, w * 0.18);
      ctx.fillRect(x + w * 0.8, y - h * 0.75, w * 0.2, h * 0.3); ctx.fillRect(x + w * 0.6, y - h * 0.5, w * 0.4, w * 0.18);
    }
  }
  function bird(o) {
    var x = o.x, y = GY - o.y - o.h / 2, up = Math.floor(o.f * 8) % 2;
    ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.ellipse(x + 22, y, 16, 8, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 6, y - 2); ctx.lineTo(x - 4, y + 2); ctx.lineTo(x + 8, y + 3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 16, y); ctx.lineTo(x + 26, up ? y - 18 : y + 16); ctx.lineTo(x + 32, y); ctx.fill();
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(x + 38, y - 2); ctx.lineTo(x + 46, y); ctx.lineTo(x + 38, y + 2); ctx.fill();
  }
  function draw() {
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#fff7ed'); sky.addColorStop(1, '#fed7aa'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; S.clouds.forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], 14, 0, 7); ctx.arc(c[0] + 16, c[1] - 6, 18, 0, 7); ctx.arc(c[0] + 34, c[1], 13, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#d6a36b'; ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = '#a16207'; var off = S.dist % 40; for (var x = -off; x < W; x += 40) { ctx.fillRect(x, GY + 10, 8, 2); ctx.fillRect(x + 20, GY + 24, 4, 2); }
    ctx.fillStyle = '#78350f'; ctx.fillRect(0, GY, W, 2);
    S.obs.forEach(function (o) { if (o.k === 'cac') cactus(o); else bird(o); });
    dino(X0, GY - S.y, S.duck, S.t);
    ctx.fillStyle = '#7c2d12'; ctx.font = 'bold 22px ui-monospace,monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(score()).padStart(5, '0'), W - 16, 32);
    var best = K.load('scrun_best', 0); if (best) { ctx.fillStyle = '#c2410c'; ctx.font = '15px ui-monospace,monospace'; ctx.fillText('HI ' + String(best).padStart(5, '0'), W - 110, 32); }
  }
  function press(k, v) { keys[k] = v; if (k === 'jump' && v) jump(); if (k === 'duck' && v && !S.started) jump(); }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); if (S.over) return; press('jump', true); });
  cv.addEventListener('pointerup', function () { keys.jump = false; });
  [['bJump', 'jump'], ['bDuck', 'duck']].forEach(function (b) { var el = $(b[0]); el.addEventListener('pointerdown', function (e) { e.preventDefault(); if (!S.over) press(b[1], true); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { el.addEventListener(n, function () { keys[b[1]] = false; }); }); });
  document.addEventListener('keydown', function (e) {
    if (K.isOpen && K.isOpen()) { if ((e.key === ' ' || e.key === 'Enter') && S.over) { e.preventDefault(); newGame(); } return; }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); if (!e.repeat) press('jump', true); } else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); keys.duck = true; }
  });
  document.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') keys.jump = false; else if (e.key === 'ArrowDown' || e.key === 's') keys.duck = false; });
  $('bNew').onclick = newGame; $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__rn = { S: function () { return S; }, auto: function () { var f = function () { if (S.over) return; var o = S.obs.filter(function (q) { return q.x > X0 - 10; })[0]; if (o) { var d = o.x - X0; if (o.k === 'bird' && o.y >= 40) { keys.duck = false; } else if (o.k === 'bird' && o.y < 40) keys.duck = d < 160; else if (d < 90 + S.speed * 0.08 && S.y === 0) { keys.jump = true; jump(); setTimeout(function () { keys.jump = false; }, 120); } } setTimeout(f, 16); }; jump(); f(); } };
  newGame();
})();
