/* 打磚塊 — stockcorp.github.io/breakout/
   邏輯座標 480×640；關卡無限；道具：加長、多球、慢速、加命。排行榜：classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'breakout', $ = K.$, L = K.L, W = 480, H = 640;
  var cv = $('cv'), ctx = cv.getContext('2d');
  var COLS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  var S = null, raf = 0, last = 0, keys = {};
  var PW = { wide: '↔', multi: '●●', slow: '🐢', life: '❤️' };

  function newGame() {
    S = { score: 0, level: 1, lives: 3, px: W / 2, pw: 80, wideT: 0, slowT: 0, balls: [], bricks: [], drops: [], parts: [], over: false, started: false, stuck: true };
    buildLevel(); resetBall(); hud(); K.close('ovEnd');
    $('msg').textContent = L('點一下或按空白鍵發球', 'Tap or press Space to launch');
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function buildLevel() {
    var lv = S.level, rows = Math.min(5 + lv, 10), cols = 10, bw = 44, bh = 18, ox = (W - cols * bw) / 2, oy = 70;
    S.bricks = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var pat = (lv % 4 === 2) ? ((r + c) % 2 === 0) : (lv % 4 === 3) ? (Math.abs(c - 4.5) < r * 0.6 + 1) : (lv % 4 === 0) ? (c !== 2 && c !== 7 || r % 2 === 0) : true;
      if (!pat) continue;
      var hp = 1 + (lv >= 3 && r < Math.floor(lv / 3) ? 1 : 0) + (lv >= 6 && r === 0 ? 1 : 0);
      S.bricks.push({ x: ox + c * bw + 2, y: oy + r * (bh + 4), w: bw - 4, h: bh, hp: hp, max: hp, col: COLS[r % COLS.length] });
    }
  }
  function speed() { return Math.min(560, 330 + S.level * 22) * (S.slowT > 0 ? 0.65 : 1); }
  function resetBall() { S.balls = [{ x: S.px, y: H - 52, vx: 0, vy: 0, r: 7 }]; S.stuck = true; }
  function launch() {
    if (S.over || !S.stuck) return;
    S.stuck = false; $('msg').textContent = '';
    var a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6, sp = speed();
    S.balls[0].vx = Math.cos(a) * sp; S.balls[0].vy = Math.sin(a) * sp;
    if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
  }
  function hud() { $('score').textContent = S.score.toLocaleString(); $('level').textContent = S.level; $('lives').textContent = S.lives > 5 ? '❤️×' + S.lives : '❤️'.repeat(Math.max(0, S.lives)); }

  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (!S.over) { for (var k = 0; k < 3; k++) step(dt / 3); }
    draw(); raf = requestAnimationFrame(loop);
  }
  function step(dt) {
    if (keys.L) S.px -= 520 * dt; if (keys.R) S.px += 520 * dt;
    S.wideT = Math.max(0, S.wideT - dt); S.slowT = Math.max(0, S.slowT - dt);
    S.pw = S.wideT > 0 ? 130 : 80; S.px = Math.max(S.pw / 2, Math.min(W - S.pw / 2, S.px));
    if (S.stuck) { S.balls[0].x = S.px; S.balls[0].y = H - 52; }
    var py = H - 40;
    for (var bi = S.balls.length - 1; bi >= 0; bi--) {
      var b = S.balls[bi]; if (S.stuck) break;
      // 保持速度
      var sp = Math.hypot(b.vx, b.vy), want = speed(); b.vx *= want / sp; b.vy *= want / sp;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && b.y + b.r >= py && b.y + b.r <= py + 14 && Math.abs(b.x - S.px) <= S.pw / 2 + b.r) {
        var off = (b.x - S.px) / (S.pw / 2), a = -Math.PI / 2 + off * 1.05;
        b.vx = Math.cos(a) * want; b.vy = Math.sin(a) * want; b.y = py - b.r; K.beep(440, 0.03, 'square', 0.025);
      }
      if (b.y > H + 20) { S.balls.splice(bi, 1); continue; }
      for (var i = 0; i < S.bricks.length; i++) {
        var br = S.bricks[i];
        var cx = Math.max(br.x, Math.min(b.x, br.x + br.w)), cy = Math.max(br.y, Math.min(b.y, br.y + br.h)), dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > b.r * b.r) continue;
        if (Math.abs(dx) > Math.abs(dy)) b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx); else b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
        hit(i); break;
      }
    }
    if (!S.stuck && !S.balls.length) loseLife();
    for (var d = S.drops.length - 1; d >= 0; d--) {
      var p = S.drops[d]; p.y += 150 * dt;
      if (p.y > py - 8 && p.y < py + 16 && Math.abs(p.x - S.px) < S.pw / 2 + 12) { power(p.k); S.drops.splice(d, 1); }
      else if (p.y > H) S.drops.splice(d, 1);
    }
    for (var q = S.parts.length - 1; q >= 0; q--) { var pt = S.parts[q]; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; pt.t -= dt; if (pt.t <= 0) S.parts.splice(q, 1); }
  }
  function hit(i) {
    var br = S.bricks[i]; br.hp--;
    if (br.hp > 0) { S.score += 5; K.beep(300, 0.03, 'square', 0.02); hud(); return; }
    S.bricks.splice(i, 1); S.score += 10 * S.level; K.beep(660 + Math.random() * 200, 0.04, 'triangle', 0.035);
    for (var k = 0; k < 6; k++) S.parts.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, t: 0.5, c: br.col });
    if (Math.random() < 0.12) { var ks = ['wide', 'wide', 'multi', 'multi', 'slow', 'life'], kk = ks[(Math.random() * ks.length) | 0]; if (kk !== 'life' || Math.random() < 0.5) S.drops.push({ x: br.x + br.w / 2, y: br.y, k: kk }); }
    if (!S.bricks.length) nextLevel();
    hud();
  }
  function power(k) {
    K.beep(880, 0.12, 'sine', 0.05, 1320);
    if (k === 'wide') S.wideT = 12;
    else if (k === 'slow') S.slowT = 10;
    else if (k === 'life') { S.lives++; hud(); }
    else if (k === 'multi' && !S.stuck) { var src = S.balls.slice(0, 3); src.forEach(function (b) { [-0.35, 0.35].forEach(function (da) { var a = Math.atan2(b.vy, b.vx) + da; if (S.balls.length < 8) S.balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 7 }); }); }); }
    K.toast({ wide: L('板子變長！', 'Wide paddle!'), multi: L('多球！', 'Multi-ball!'), slow: L('球變慢', 'Slow ball'), life: L('多一條命！', 'Extra life!') }[k], 1000);
  }
  function nextLevel() {
    S.score += 100 * S.level; S.level++; S.drops = []; buildLevel(); resetBall();
    $('msg').textContent = L('第 ' + S.level + ' 關！點一下發球', 'Level ' + S.level + '! Tap to launch');
    K.beep(523, 0.4, 'triangle', 0.06, 1046);
  }
  function loseLife() {
    S.lives--; hud(); navigator.vibrate && navigator.vibrate(60); K.beep(160, 0.35, 'sawtooth', 0.05, 80);
    if (S.lives <= 0) return gameOver();
    S.drops = []; S.wideT = 0; resetBall(); $('msg').textContent = L('點一下發球', 'Tap to launch');
  }
  function gameOver() {
    S.over = true; $('msg').textContent = '';
    var best = K.load('scbrk_best', 0), nb = S.score > best; if (nb) K.save('scbrk_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endLevel').textContent = S.level;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.started && S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: L('第 ', 'Level ') + S.level + L(' 關', '') }); }, 600);
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function draw() {
    ctx.fillStyle = '#0b0705'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; for (var g = 0; g < W; g += 32) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); }
    S.bricks.forEach(function (b) {
      ctx.globalAlpha = b.hp < b.max ? 0.6 + 0.4 * b.hp / b.max : 1;
      ctx.fillStyle = b.max > 1 && b.hp === b.max ? '#94a3b8' : b.col; rr(b.x, b.y, b.w, b.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 4); ctx.globalAlpha = 1;
    });
    S.parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.t * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 4); }); ctx.globalAlpha = 1;
    ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    S.drops.forEach(function (p) { ctx.fillStyle = '#1e293b'; rr(p.x - 16, p.y - 11, 32, 22, 11); ctx.fill(); ctx.strokeStyle = '#facc15'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(PW[p.k], p.x, p.y + 1); });
    var py = H - 40, gr = ctx.createLinearGradient(0, py, 0, py + 12); gr.addColorStop(0, '#fdba74'); gr.addColorStop(1, '#ea580c');
    ctx.fillStyle = gr; rr(S.px - S.pw / 2, py, S.pw, 12, 6); ctx.fill();
    S.balls.forEach(function (b) { ctx.fillStyle = '#fff'; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.shadowBlur = 0; });
  }

  function toX(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
  cv.addEventListener('pointermove', function (e) { if (S && !S.over) S.px = toX(e); });
  cv.addEventListener('pointerdown', function (e) { if (!S || S.over) return; S.px = toX(e); launch(); });
  document.addEventListener('keydown', function (e) {
    if (K.isOpen && K.isOpen()) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.L = 1; else if (e.key === 'ArrowRight' || e.key === 'd') keys.R = 1;
    else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); launch(); } else return;
    e.preventDefault();
  });
  document.addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft' || e.key === 'a') keys.L = 0; if (e.key === 'ArrowRight' || e.key === 'd') keys.R = 0; });
  $('bNew').onclick = function () {
    if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; }
    newGame();
  };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__bk = { S: function () { return S; }, launch: launch, over: gameOver, clear: function () { S.bricks = S.bricks.slice(0, 1); } };
  newGame();
})();
