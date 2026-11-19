/* 飛飛鳥 — stockcorp.github.io/bird/
   邏輯 420×680；點一下往上拍翅，穿過竹子空隙得 1 分；每 10 分加速、空隙縮小一點。
   排行榜：classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'bird', $ = K.$, L = K.L, W = 420, H = 680, GROUND = H - 70, BX = 120;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;
  var hills = []; for (var i = 0; i < 8; i++) hills.push({ x: i * 90, h: 60 + Math.random() * 70 });

  function newGame() {
    S = { y: H * 0.42, vy: 0, rot: 0, pipes: [], score: 0, state: 'ready', t: 0, gx: 0, flapT: 0, dist: 0 };
    K.close('ovEnd'); $('msg').textContent = L('點一下開始飛', 'Tap to fly');
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function speed() { return 150 + Math.min(10, Math.floor(S.score / 10)) * 12; }
  function gapH() { return Math.max(140, 185 - Math.floor(S.score / 10) * 6); }
  function flap() {
    if (!S) return;
    if (S.state === 'dead') return;
    if (S.state === 'ready') {
      S.state = 'play'; $('msg').textContent = '';
      if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME });
    }
    S.vy = -360; S.flapT = 0.15; K.beep(720, 0.05, 'sine', 0.04, 960);
  }
  function addPipe(x) { var g = gapH(), top = 90 + Math.random() * (GROUND - 90 - g - 70); S.pipes.push({ x: x, top: top, g: g, passed: false }); }
  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    step(dt); draw(); raf = requestAnimationFrame(loop);
  }
  function step(dt) {
    S.t += dt; S.flapT = Math.max(0, S.flapT - dt);
    if (S.state !== 'dead') S.gx = (S.gx + speed() * dt) % 24;
    if (S.state === 'ready') { S.y = H * 0.42 + Math.sin(S.t * 4) * 8; return; }
    S.vy += 1250 * dt; S.vy = Math.min(S.vy, 620); S.y += S.vy * dt;
    S.rot = Math.max(-0.45, Math.min(1.3, S.vy / 500));
    if (S.state === 'dead') { if (S.y > GROUND - 14) { S.y = GROUND - 14; } return; }
    var sp = speed();
    S.pipes.forEach(function (p) { p.x -= sp * dt; });
    if (!S.pipes.length || S.pipes[S.pipes.length - 1].x < W - 230) addPipe(W + 40);
    S.pipes = S.pipes.filter(function (p) { return p.x > -80; });
    S.pipes.forEach(function (p) {
      if (!p.passed && p.x + 34 < BX) { p.passed = true; S.score++; K.beep(980, 0.06, 'triangle', 0.05, 1320); if (S.score % 10 === 0) K.toast(L('加速！', 'Faster!'), 700); }
      // 碰撞（鳥用圓形 r=14，竹子寬 68）
      var r = 13, cx = Math.max(p.x - 34, Math.min(BX, p.x + 34));
      [[0, p.top], [p.top + p.g, GROUND]].forEach(function (seg) { var cy = Math.max(seg[0], Math.min(S.y, seg[1])); if ((BX - cx) * (BX - cx) + (S.y - cy) * (S.y - cy) < r * r) die(); });
    });
    if (S.y > GROUND - 14) { S.y = GROUND - 14; die(); }
    if (S.y < -30) { S.y = -30; S.vy = 0; }
  }
  function medal(s) { return s >= 100 ? L('💠 白金', '💠 Platinum') : s >= 50 ? L('🥇 金牌', '🥇 Gold') : s >= 25 ? L('🥈 銀牌', '🥈 Silver') : s >= 10 ? L('🥉 銅牌', '🥉 Bronze') : '—'; }
  function die() {
    if (S.state === 'dead') return; S.state = 'dead'; S.vy = Math.min(S.vy, -120);
    K.beep(160, 0.4, 'sawtooth', 0.07, 60); navigator.vibrate && navigator.vibrate(80);
    var best = K.load('scbird_best', 0), nb = S.score > best; if (nb) K.save('scbird_best', S.score);
    $('endScore').textContent = S.score; $('endMedal').textContent = medal(S.score);
    $('endBest').textContent = nb && S.score ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + Math.max(best, S.score);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: medal(S.score) }); }, 800);
  }

  // ---------- 畫面 ----------
  function bamboo(x, y0, y1, capDown) {
    var w = 68, g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#15803d'); g.addColorStop(0.35, '#4ade80'); g.addColorStop(1, '#166534');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2 + 6, y0, w - 12, y1 - y0);
    ctx.fillStyle = 'rgba(20,83,45,.9)';
    for (var y = y0 + 40; y < y1 - 10; y += 70) ctx.fillRect(x - w / 2 + 6, y, w - 12, 5);
    // 竹節口
    var cy = capDown ? y1 - 22 : y0; ctx.fillStyle = g; ctx.fillRect(x - w / 2, cy, w, 22);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - w / 2, capDown ? cy + 18 : cy, w, 4);
  }
  function draw() {
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0ea5e9'); sky.addColorStop(1, '#bae6fd');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    [[60, 120, 34], [300, 80, 26], [220, 200, 20]].forEach(function (c) { var x = ((c[0] - S.t * 12) % (W + 120) + W + 120) % (W + 120) - 60; ctx.beginPath(); ctx.arc(x, c[1], c[2], 0, 7); ctx.arc(x + c[2], c[1] + 6, c[2] * 0.8, 0, 7); ctx.arc(x - c[2], c[1] + 8, c[2] * 0.7, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#86efac';
    hills.forEach(function (h) { var x = ((h.x - S.t * 20) % (W + 180) + W + 180) % (W + 180) - 90; ctx.beginPath(); ctx.ellipse(x, GROUND, 90, h.h, 0, Math.PI, 0); ctx.fill(); });
    S.pipes.forEach(function (p) { bamboo(p.x, -10, p.top, true); bamboo(p.x, p.top + p.g, GROUND, false); });
    // 地面
    ctx.fillStyle = '#a16207'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#65a30d'; ctx.fillRect(0, GROUND, W, 14);
    ctx.fillStyle = '#4d7c0f'; for (var x = -S.gx; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, GROUND + 14); ctx.lineTo(x + 12, GROUND + 14); ctx.lineTo(x + 6, GROUND + 22); ctx.fill(); }
    // 小鳥（原創：圓滾滾藍鳥）
    ctx.save(); ctx.translate(BX, S.y); ctx.rotate(S.rot);
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.ellipse(0, 0, 17, 15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.ellipse(3, 5, 10, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.ellipse(-6, S.flapT > 0 ? -6 : 3, 9, 5, S.flapT > 0 ? -0.6 : 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -5, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(9, -5, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(14, -1); ctx.lineTo(25, 2); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (S.state !== 'ready') {
      ctx.font = '900 54px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(15,23,42,.7)';
      ctx.strokeText(S.score, W / 2, 90); ctx.fillStyle = '#fff'; ctx.fillText(S.score, W / 2, 90);
    }
  }

  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); flap(); });
  document.addEventListener('keydown', function (e) {
    if (K.isOpen && K.isOpen()) { if ((e.key === ' ' || e.key === 'Enter') && S && S.state === 'dead') { e.preventDefault(); newGame(); } return; }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); flap(); }
  });
  $('bNew').onclick = function () { newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__bd = { S: function () { return S; }, flap: flap, auto: function () { var f = function () { if (S.state === 'dead') return; var p = S.pipes.find(function (q) { return q.x + 40 > BX; }), target = p ? p.top + p.g * 0.62 : H * 0.45; if (S.y > target && S.vy > -50) flap(); setTimeout(f, 30); }; f(); } };
  newGame();
})();
