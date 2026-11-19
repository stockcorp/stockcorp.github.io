/* 貪吃蛇 — stockcorp.github.io/snake/
   20×20、撞牆或撞自己結束、越吃越快、限時金色水果、方向鍵／滑動／螢幕方向鍵。
   排行榜：mode classic，分數越高越好（伺服器限制每秒最多 150 分）。 */
(function () {
  'use strict';
  var GAME = 'snake', MODE = 'classic', N = 20, $ = K.$, L = K.L;
  var D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var FRUITS = ['🍎', '🍊', '🍇', '🍓', '🍒', '🍑', '🍉'];
  var cv = $('cv'), ctx = cv.getContext('2d'), cs = 20, S = null, running = false, paused = false, raf = 0, last = 0;

  function reset() {
    S = { body: [[9, 10], [8, 10], [7, 10]], dir: 1, q: [], food: null, gold: null, score: 0, eaten: 0, acc: 0, over: false, t: 0 };
    S.food = spot(); S.fruit = FRUITS[(Math.random() * FRUITS.length) | 0];
  }
  function stepMs() { return Math.max(65, 170 - S.eaten * 3.2); }
  function pts() { return Math.round(10 * (170 / stepMs())); }
  function spot() {
    for (;;) {
      var p = [(Math.random() * N) | 0, (Math.random() * N) | 0];
      if (!S.body.some(function (b) { return b[0] === p[0] && b[1] === p[1]; }) && !(S.food && S.food[0] === p[0] && S.food[1] === p[1])) return p;
    }
  }
  function start() {
    reset(); running = true; paused = false; last = performance.now();
    K.close('ovStart'); K.close('ovEnd'); K.close('ovPause');
    if (window.SCLB) SCLB.start(GAME, MODE);
    if (window.SC) SC.post('start', { game: GAME });
    hud(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function loop(t) {
    if (!running) return;
    var dt = Math.min(200, t - last); last = t;
    if (!paused) {
      S.acc += dt; S.t += dt;
      while (S.acc >= stepMs() && !S.over) { S.acc -= stepMs(); step(); }
      if (S.gold && (S.gold.until -= dt) <= 0) S.gold = null;
    }
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }
  function step() {
    // 方向佇列：一步只轉一次，避免連按兩下自己回頭撞死
    while (S.q.length) { var nd = S.q.shift(); if (nd !== S.dir && (nd + 2) % 4 !== S.dir) { S.dir = nd; break; } }
    var h = S.body[0], nh = [h[0] + D[S.dir][0], h[1] + D[S.dir][1]];
    var eat = nh[0] === S.food[0] && nh[1] === S.food[1], gold = S.gold && nh[0] === S.gold.p[0] && nh[1] === S.gold.p[1];
    var body = eat ? S.body : S.body.slice(0, -1);
    if (nh[0] < 0 || nh[1] < 0 || nh[0] >= N || nh[1] >= N || body.some(function (b) { return b[0] === nh[0] && b[1] === nh[1]; })) return die();
    S.body.unshift(nh); if (!eat) S.body.pop();
    if (eat) {
      S.score += pts(); S.eaten++; S.food = spot(); S.fruit = FRUITS[(Math.random() * FRUITS.length) | 0];
      K.beep(660 + Math.min(600, S.eaten * 10), 0.06, 'triangle', 0.05);
      if (!S.gold && S.eaten % 5 === 0) S.gold = { p: spot(), until: 6000 };
      hud();
    }
    if (gold) { S.score += pts() * 5; S.gold = null; K.beep(990, 0.25, 'triangle', 0.06, 1760); navigator.vibrate && navigator.vibrate(30); hud(); }
  }
  function die() {
    S.over = true; running = false; draw();
    K.beep(150, 0.5, 'sawtooth', 0.07, 50); navigator.vibrate && navigator.vibrate([60, 40, 80]);
    var best = K.load('scsnake_best', 0); if (S.score > best) K.save('scsnake_best', S.score);
    $('endScore').textContent = S.score; $('endLen').textContent = S.body.length;
    $('endBest').textContent = S.score > best ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB && S.score > 0) SCLB.offer({ game: GAME, mode: MODE, score: S.score, text: S.score + L(' 分', ' pts') }); }, 500);
    hud();
  }

  // ---------- 繪圖 ----------
  function resize() {
    var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cs = r.width / N; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function draw() {
    if (!S) return;
    var w = N * cs;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { ctx.fillStyle = (x + y) % 2 ? '#1d3312' : '#203a14'; ctx.fillRect(x * cs, y * cs, cs, cs); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = (cs * 0.85) + 'px serif';
    ctx.fillText(S.fruit, S.food[0] * cs + cs / 2, S.food[1] * cs + cs / 2 + 1);
    if (S.gold) { var k = S.gold.until / 6000; ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(S.t / 150)); ctx.fillText('⭐', S.gold.p[0] * cs + cs / 2, S.gold.p[1] * cs + cs / 2 + 1); ctx.globalAlpha = 1; ctx.fillStyle = '#facc15'; ctx.fillRect(S.gold.p[0] * cs, S.gold.p[1] * cs + cs - 3, cs * k, 3); }
    var n = S.body.length;
    S.body.forEach(function (b, i) {
      var t = i / Math.max(1, n - 1), r = Math.round(163 - 70 * t), g = Math.round(230 - 80 * t), bl = Math.round(53 - 20 * t), p = cs * 0.08;
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')'; rr(b[0] * cs + p, b[1] * cs + p, cs - 2 * p, cs - 2 * p, cs * 0.3); ctx.fill();
    });
    // 頭的眼睛
    var h = S.body[0], dx = D[S.dir][0], dy = D[S.dir][1], cx = h[0] * cs + cs / 2, cy = h[1] * cs + cs / 2;
    [[-1, 1], [1, 1]].forEach(function (s) {
      var ex = cx + (dy ? s[0] * cs * 0.2 : dx * cs * 0.15), ey = cy + (dx ? s[0] * cs * 0.2 : dy * cs * 0.15);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, cs * 0.13, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex + dx * cs * 0.04, ey + dy * cs * 0.04, cs * 0.07, 0, 7); ctx.fill();
    });
    if (S.over) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, w, w); }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function hud() { $('score').textContent = S.score; $('len').textContent = S.body.length; $('best').textContent = Math.max(K.load('scsnake_best', 0), S.score); }

  // ---------- 輸入 ----------
  function turn(d) { if (!running || paused) return; if (S.q.length < 3) S.q.push(d); }
  var KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (KEYS[e.key] != null) { e.preventDefault(); if (!running && K.isOpen('ovStart')) start(); turn(KEYS[e.key]); }
    else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pause(!paused);
    else if ((e.key === ' ' || e.key === 'Enter') && !running && (K.isOpen('ovStart') || K.isOpen('ovEnd'))) { e.preventDefault(); start(); }
  });
  $('dpad').addEventListener('pointerdown', function (e) { var b = e.target.closest('button'); if (b) { e.preventDefault(); turn(+b.dataset.d); } });
  var bd = $('board'), sx = 0, sy = 0, sw = false;
  bd.addEventListener('pointerdown', function (e) { sw = true; sx = e.clientX; sy = e.clientY; });
  bd.addEventListener('pointermove', function (e) {
    if (!sw) return; var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) { turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); sx = e.clientX; sy = e.clientY; }
  });
  bd.addEventListener('pointerup', function () { sw = false; });
  bd.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  function pause(p) {
    if (!running || S.over) return; paused = p;
    if (p) K.open('ovPause'); else { K.close('ovPause'); last = performance.now(); }
    $('bPause').textContent = p ? '▶' : '⏸';
  }
  $('bPause').onclick = function () { pause(!paused); };
  $('bResume').onclick = function () { pause(false); };
  $('bStart').onclick = start; $('bAgain').onclick = start;
  document.addEventListener('visibilitychange', function () { if (document.hidden && running && !paused) pause(true); });
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  reset(); hud();
  var best = K.load('scsnake_best', 0); $('bestLine').textContent = best ? L('個人最佳：', 'Personal best: ') + best : '';
  K.open('ovStart'); resize();
})();
