/* 空氣曲棍球 — stockcorp.github.io/hockey/
   邏輯 360×600；球門寬 130。冰球有摩擦、撞牆反彈、上限速度；推桿撞擊時把推桿速度傳給冰球。
   電腦：守門＋看準時機進攻，難度影響反應速度與移動上限。排行榜：mode = easy/normal/hard，擊敗電腦的時間。 */
(function () {
  'use strict';
  var GAME = 'hockey', $ = K.$, L = K.L, W = 360, H = 600, GOAL = 130, PR = 15, MR = 28, WIN = 7;
  var LV = { easy: [0.55, 330, 0.35], normal: [0.8, 470, 0.6], hard: [1, 620, 0.85] };
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, lv = 'normal';
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
        if (Math.abs(rv) > 40) K.beep(380 + Math.min(600, Math.abs(rv) / 3), 0.03, 'square', 0.03);
        if (!S.started && p === S.me) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, lv); if (window.SC) SC.post('start', { game: GAME, level: lv }); }
      }
    });
  }
  function wall() { K.beep(700, 0.015, 'square', 0.015); }
  function goal(mine) {
    if (mine) S.sMe++; else S.sAi++; hud();
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
  function draw() {
    ctx.fillStyle = '#e0f2fe'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 50, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(W / 2, 0, GOAL / 2 + 20, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H, GOAL / 2 + 20, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#1e293b'; ctx.fillRect(W / 2 - GOAL / 2, 0, GOAL, 6); ctx.fillRect(W / 2 - GOAL / 2, H - 6, GOAL, 6);
    var pk = S.puck; ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(pk.x + 3, pk.y + 4, PR, 0, 7); ctx.fill();
    ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(pk.x, pk.y, PR, 0, 7); ctx.fill(); ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pk.x, pk.y, PR - 5, 0, 7); ctx.stroke();
    [[S.ai, '#dc2626', '#fca5a5'], [S.me, '#2563eb', '#93c5fd']].forEach(function (q) {
      var p = q[0]; ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(p.x + 3, p.y + 5, MR, 0, 7); ctx.fill();
      ctx.fillStyle = q[1]; ctx.beginPath(); ctx.arc(p.x, p.y, MR, 0, 7); ctx.fill(); ctx.fillStyle = q[2]; ctx.beginPath(); ctx.arc(p.x, p.y, MR * 0.55, 0, 7); ctx.fill(); ctx.fillStyle = q[1]; ctx.beginPath(); ctx.arc(p.x, p.y, MR * 0.3, 0, 7); ctx.fill();
    });
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
