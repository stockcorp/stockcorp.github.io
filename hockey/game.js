/* 空氣曲棍球 — stockcorp.github.io/hockey/
   邏輯 360×600；球門寬 130。冰球有摩擦、撞牆反彈、上限速度；推桿撞擊時把推桿速度傳給冰球。
   電腦：守門＋看準時機進攻，難度影響反應速度與移動上限。排行榜：mode = easy/normal/hard，擊敗電腦的時間。 */
(function () {
  'use strict';
  var GAME = 'hockey', $ = K.$, L = K.L, W = 360, H = 600, GOAL = 130, PR = 15, MR = 28, WIN = 7;
  var LV = { easy: [0.55, 330, 0.35], normal: [0.8, 470, 0.6], hard: [1, 620, 0.85] };
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, lv = 'normal';
  (function () { var r = Math.min(2, window.devicePixelRatio || 1); cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); })();
  function newGame(level) {
    lv = level || lv;
    S = { me: { x: W / 2, y: H - 80, vx: 0, vy: 0, tx: W / 2, ty: H - 80 }, ai: { x: W / 2, y: 80, vx: 0, vy: 0 }, sMe: 0, sAi: 0, over: false, started: false, t0: 0, pause: 0 };
    reset(1); K.close('ovEnd'); hud(); K.save('schockey_lv', lv);
    $('bLb').href = '/leaderboard/?game=hockey&mode=' + lv; $('sub').textContent = L('電腦：', 'CPU: ') + L({ easy: '簡單', normal: '普通', hard: '困難' }[lv], { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[lv]);
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function reset(toMe) { S.puck = { x: W / 2, y: toMe ? H / 2 + 60 : H / 2 - 60, vx: 0, vy: 0 }; S.pause = 0.8; }
  function hud() { $('sMe').textContent = S.sMe; $('sAi').textContent = S.sAi; }
  function loop(t) { var dt = Math.min(0.025, (t - last) / 1000); last = t; if (!S.over) { for (var i = 0; i < 3; i++) step(dt / 3); } draw(); raf = requestAnimationFrame(loop); }
  function paddle(p, tx, ty, maxv, dt, top) {
    var minY = top ? MR : H / 2 + MR, maxY = top ? H / 2 - MR : H - MR;
    tx = Math.max(MR, Math.min(W - MR, tx)); ty = Math.max(minY, Math.min(maxY, ty));
    var dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), mv = Math.min(d, maxv * dt);
    var nx = d ? p.x + dx / d * mv : p.x, ny = d ? p.y + dy / d * mv : p.y;
    p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt; p.x = nx; p.y = ny;
  }
  function step(dt) {
    var pk = S.puck, cfg = LV[lv];
    if (S.pause > 0) { S.pause -= dt; }
    paddle(S.me, S.me.tx, S.me.ty, 2600, dt, false);
    // 電腦：冰球在自己半場就去打，否則回守門前
    var ai = S.ai, tx, ty;
    if (pk.y < H / 2 && S.pause <= 0) { tx = pk.x + (pk.x - W / 2) * 0.1 * (1 - cfg[0]); ty = pk.y - (pk.vy > 0 ? 6 : 26); if (pk.y < ai.y) { ty = pk.y - 40; tx = pk.x + (pk.x < W / 2 ? 40 : -40); } }
    else { tx = W / 2 + (pk.x - W / 2) * cfg[2]; ty = 70; }
    tx += (Math.random() - 0.5) * 20 * (1 - cfg[0]);
    paddle(ai, tx, ty, cfg[1], dt, true);
    if (S.pause > 0) return;
    pk.x += pk.vx * dt; pk.y += pk.vy * dt;
    var fr = Math.pow(0.55, dt); pk.vx *= fr; pk.vy *= fr;
    if (pk.x < PR) { pk.x = PR; pk.vx = Math.abs(pk.vx) * 0.9; wall(); } if (pk.x > W - PR) { pk.x = W - PR; pk.vx = -Math.abs(pk.vx) * 0.9; wall(); }
    var inGoal = Math.abs(pk.x - W / 2) < GOAL / 2;
    if (pk.y < PR && !inGoal) { pk.y = PR; pk.vy = Math.abs(pk.vy) * 0.9; wall(); }
    if (pk.y > H - PR && !inGoal) { pk.y = H - PR; pk.vy = -Math.abs(pk.vy) * 0.9; wall(); }
    if (pk.y < -PR) return goal(true);
    if (pk.y > H + PR) return goal(false);
    [S.me, ai].forEach(function (p) {
      var dx = pk.x - p.x, dy = pk.y - p.y, d = Math.hypot(dx, dy);
      if (d < PR + MR && d > 0) {
        var nx = dx / d, ny = dy / d; pk.x = p.x + nx * (PR + MR); pk.y = p.y + ny * (PR + MR);
        var rv = (pk.vx - p.vx) * nx + (pk.vy - p.vy) * ny;
        if (rv < 0) { pk.vx -= 1.9 * rv * nx; pk.vy -= 1.9 * rv * ny; }
        var sp = Math.hypot(pk.vx, pk.vy), mx = 1500; if (sp > mx) { pk.vx *= mx / sp; pk.vy *= mx / sp; }
        if (Math.abs(rv) > 40) { K.beep(380 + Math.min(600, Math.abs(rv) / 3), 0.03, 'square', 0.03); spark(pk.x - nx * PR, pk.y - ny * PR, p === S.me ? ['#93c5fd', '#fff'] : ['#fda4af', '#fff'], Math.min(16, 4 + Math.abs(rv) / 60), 80 + Math.abs(rv) / 4); if (Math.abs(rv) > 500) { FX2.sh = Math.min(9, Math.abs(rv) / 140); K.buzz(8); } }
        if (!S.started && p === S.me) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, lv); if (window.SC) SC.post('start', { game: GAME, level: lv }); }
      }
    });
  }
  function wall() { K.beep(700, 0.015, 'square', 0.015); if (S && S.puck) spark(S.puck.x, S.puck.y, ['#e2e8f0', '#a78bfa'], 4, 90); }
  function goal(mine) {
    if (mine) S.sMe++; else S.sAi++; hud();
    FX2.flash = 1; FX2.col = mine ? '#38bdf8' : '#fb7185'; FX2.sh = 14; FX2.ring = { x: W / 2, y: mine ? 0 : H, t: 0, c: mine ? '#7dd3fc' : '#fda4af' }; spark(W / 2, mine ? 8 : H - 8, mine ? ['#7dd3fc', '#fff', '#fde047'] : ['#fda4af', '#fff'], 46, 380); TR.length = 0;
    if (mine) K.tune([660, 880, 1320], 70);
    $('msg').textContent = mine ? L('進球！', 'Goal!') : L('失分', 'Conceded'); setTimeout(function () { $('msg').textContent = ''; }, 800);
    K.beep(mine ? 880 : 220, 0.3, 'triangle', 0.06, mine ? 1320 : 110); navigator.vibrate && navigator.vibrate(mine ? 30 : 80);
    if (S.sMe >= WIN || S.sAi >= WIN) return finish();
    reset(!mine);
  }
  function finish() {
    S.over = true; var win = S.sMe > S.sAi, t = S.t0 ? Math.floor((Date.now() - S.t0) / 1000) : 0;
    $('endEmoji').textContent = win ? '🏆' : '😵'; $('endTitle').textContent = win ? L('你贏了！', 'You win!') : L('電腦獲勝', 'The computer wins');
    $('endScore').textContent = S.sMe + ' : ' + S.sAi; $('endTime').textContent = K.fmtTime(t);
    var best = K.load('schockey_best', {}), nb = win && (!best[lv] || t < best[lv]); if (nb) { best[lv] = t; K.save('schockey_best', best); }
    $('endBest').textContent = win ? (nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[lv])) : '';
    if (window.SC) SC.post('gameover', { game: GAME, win: win });
    setTimeout(function () { K.open('ovEnd'); if (win && window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: lv, score: sec, text: S.sMe + ':' + S.sAi + '・' + K.fmtTime(sec) }); } }, 700);
  }
  var PX = [], TR = [], FX2 = { flash: 0, col: '#fff', sh: 0, ring: null }, TT = 0;
  function spark(x, y, cols, n, sp) { for (var i = 0; i < n && PX.length < 240; i++) { var a = Math.random() * 6.283, v = sp * (0.3 + Math.random() * 0.7); PX.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, r: 1.5 + Math.random() * 2.5, c: cols[(Math.random() * cols.length) | 0] }); } }
  function glowLine(c, w) { ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.strokeStyle = c; ctx.lineWidth = w; }
  function mallet(p, c1, c2) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(p.x + 3, p.y + 6, MR, 0, 7); ctx.fill();
    ctx.shadowColor = c1; ctx.shadowBlur = 22; var g = ctx.createRadialGradient(p.x - 8, p.y - 10, 3, p.x, p.y, MR); g.addColorStop(0, c2); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, MR, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, MR - 2, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(p.x, p.y + 2, MR * 0.52, 0, 7); ctx.fill(); var g2 = ctx.createRadialGradient(p.x - 4, p.y - 5, 1, p.x, p.y, MR * 0.5); g2.addColorStop(0, '#fff'); g2.addColorStop(1, c2); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, p.y, MR * 0.46, 0, 7); ctx.fill();
  }
  function draw() {
    var dt = 0.016; TT += dt; FX2.sh = Math.max(0, FX2.sh - dt * 40); FX2.flash = Math.max(0, FX2.flash - dt * 2.2);
    ctx.save(); if (FX2.sh > 0) ctx.translate((Math.random() - 0.5) * FX2.sh, (Math.random() - 0.5) * FX2.sh);
    var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0b2e'); bg.addColorStop(0.5, '#0b1026'); bg.addColorStop(1, '#06162e'); ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.strokeStyle = 'rgba(148,163,184,.06)'; ctx.lineWidth = 1; ctx.beginPath(); for (var gx = 30; gx < W; gx += 30) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); } for (var gy = 30; gy < H; gy += 30) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); } ctx.stroke();
    glowLine('#a78bfa', 3); ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H / 2, 50, 0, 7); ctx.stroke();
    glowLine('#fb7185', 3); ctx.beginPath(); ctx.arc(W / 2, 0, GOAL / 2 + 20, 0, Math.PI); ctx.stroke();
    glowLine('#38bdf8', 3); ctx.beginPath(); ctx.arc(W / 2, H, GOAL / 2 + 20, Math.PI, 0); ctx.stroke();
    // 邊框與球門
    glowLine('#e2e8f0', 4); ctx.beginPath(); ctx.moveTo(W / 2 - GOAL / 2, 2); ctx.lineTo(2, 2); ctx.lineTo(2, H - 2); ctx.lineTo(W / 2 - GOAL / 2, H - 2); ctx.moveTo(W / 2 + GOAL / 2, 2); ctx.lineTo(W - 2, 2); ctx.lineTo(W - 2, H - 2); ctx.lineTo(W / 2 + GOAL / 2, H - 2); ctx.stroke();
    var pu = 0.6 + Math.sin(TT * 5) * 0.4; ctx.shadowBlur = 20; ctx.shadowColor = '#fb7185'; ctx.fillStyle = 'rgba(251,113,133,' + pu + ')'; ctx.fillRect(W / 2 - GOAL / 2, 0, GOAL, 5); ctx.shadowColor = '#38bdf8'; ctx.fillStyle = 'rgba(56,189,248,' + pu + ')'; ctx.fillRect(W / 2 - GOAL / 2, H - 5, GOAL, 5); ctx.shadowBlur = 0;
    // 冰球殘影
    var pk = S.puck, spd = Math.hypot(pk.vx, pk.vy); TR.push({ x: pk.x, y: pk.y }); if (TR.length > 14) TR.shift();
    if (spd > 220) TR.forEach(function (q, i) { ctx.fillStyle = 'rgba(253,224,71,' + (i / TR.length * 0.35) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, PR * (0.35 + i / TR.length * 0.6), 0, 7); ctx.fill(); });
    PX.forEach(function (q) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95; if (q.life <= 0) return; ctx.globalAlpha = Math.min(1, q.life * 3); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; PX = PX.filter(function (q) { return q.life > 0; });
    if (FX2.ring) { var r = FX2.ring; r.t += dt; var k = r.t / 0.7; if (k >= 1) FX2.ring = null; else { ctx.strokeStyle = r.c; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, 20 + k * 220, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(pk.x + 2, pk.y + 4, PR, 0, 7); ctx.fill();
    ctx.shadowColor = '#fde047'; ctx.shadowBlur = 10 + Math.min(20, spd / 40); var pg = ctx.createRadialGradient(pk.x - 4, pk.y - 5, 1, pk.x, pk.y, PR); pg.addColorStop(0, '#fff7c2'); pg.addColorStop(1, '#f59e0b'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pk.x, pk.y, PR, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,53,15,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pk.x, pk.y, PR - 5, 0, 7); ctx.stroke();
    mallet(S.ai, '#be123c', '#fda4af'); mallet(S.me, '#1d4ed8', '#93c5fd');
    ctx.restore();
    if (FX2.flash > 0) { ctx.fillStyle = FX2.col; ctx.globalAlpha = FX2.flash * 0.45; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // 大比分浮水印
    ctx.font = '900 64px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(251,113,133,.14)'; ctx.fillText(S.sAi, W / 2, H / 2 - 120); ctx.fillStyle = 'rgba(56,189,248,.14)'; ctx.fillText(S.sMe, W / 2, H / 2 + 120);
  }
  function toXY(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  var down = false;
  cv.addEventListener('pointerdown', function (e) { down = true; var p = toXY(e); S.me.tx = p[0]; S.me.ty = p[1] - (e.pointerType === 'touch' ? 30 : 0); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', function (e) { if (!down && e.pointerType !== 'mouse') return; var p = toXY(e); S.me.tx = p[0]; S.me.ty = p[1] - (e.pointerType === 'touch' ? 30 : 0); });
  cv.addEventListener('pointerup', function () { down = false; });
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { newGame(lv); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__hk = { S: function () { return S; }, auto: function () { var f = function () { if (S.over) return; var pk = S.puck; S.me.tx = pk.x + (pk.x - W / 2) * 0.2; S.me.ty = pk.y > H / 2 ? pk.y + 20 : H - 80; setTimeout(f, 16); }; f(); } };
  newGame(K.load('schockey_lv', 'normal'));
})();
