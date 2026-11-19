/* 方塊疊疊樂 — stockcorp.github.io/stack/
   12×22 的井、3／4／5 格混合的 10 種果凍方塊、保留、預覽 2 個、落點提示、連擊。
   排行榜：mode marathon，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'stack', MODE = 'marathon', W = 12, H = 22, $ = K.$, L = K.L;
  var SHAPES = [
    { m: [[0, 0, 0], [1, 1, 1], [0, 0, 0]], c: '#f472b6', w: 1 },          // 三格直條
    { m: [[1, 0], [1, 1]], c: '#34d399', w: 1 },                          // 三格轉角
    { m: [[1, 1], [1, 1]], c: '#facc15', w: 1.2 },                        // 田
    { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: '#a78bfa', w: 1.2 },       // 凸
    { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: '#fb923c', w: 1 },         // 階梯
    { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: '#60a5fa', w: 1.2 },       // 拐杖
    { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: '#22d3ee', w: 1.2 }, // 四格直條
    { m: [[1, 1, 0], [1, 1, 0], [1, 0, 0]], c: '#fb7185', w: 0.6 },       // 五格 P
    { m: [[1, 0, 1], [1, 1, 1], [0, 0, 0]], c: '#a3e635', w: 0.5 },       // 五格 U
    { m: [[0, 1, 0], [1, 1, 1], [0, 1, 0]], c: '#e879f9', w: 0.3 }        // 五格十字
  ];
  var LINE_PTS = [0, 100, 300, 500, 800, 1200];
  var cv = $('cv'), ctx = cv.getContext('2d'), cs = 30, S = null, raf = 0, paused = false, running = false, last = 0;

  function rot(m) { var n = m.length, r = []; for (var y = 0; y < n; y++) { r.push([]); for (var x = 0; x < n; x++) r[y].push(m[n - 1 - x][y]); } return r; }
  function cells(p) { var out = [], m = p.m; for (var y = 0; y < m.length; y++) for (var x = 0; x < m.length; x++) if (m[y][x]) out.push([p.x + x, p.y + y]); return out; }
  function pick() {
    var tot = SHAPES.reduce(function (a, s) { return a + s.w; }, 0), r = Math.random() * tot, i = 0;
    for (; i < SHAPES.length; i++) { r -= SHAPES[i].w; if (r <= 0) break; }
    i = Math.min(i, SHAPES.length - 1);
    // 避免同一種連續出現三次
    if (S && S.hist.length >= 2 && S.hist[0] === i && S.hist[1] === i) return pick();
    if (S) { S.hist.unshift(i); S.hist.length = Math.min(S.hist.length, 2); }
    return i;
  }
  function make(i) { var s = SHAPES[i], n = s.m.length; return { i: i, m: s.m, x: Math.floor((W - n) / 2), y: s.m[0].some(Boolean) ? 0 : -1 }; }
  function fits(p, dx, dy, m) {
    var t = { m: m || p.m, x: p.x + (dx || 0), y: p.y + (dy || 0) };
    return cells(t).every(function (c) { return c[0] >= 0 && c[0] < W && c[1] < H && (c[1] < 0 || !S.g[c[1]][c[0]]); });
  }

  // ---------- 流程 ----------
  function reset() {
    S = { g: [], hist: [], next: [], hold: null, canHold: true, score: 0, lines: 0, level: 1, combo: -1, lockT: 0, lockN: 0, over: false, flash: [], fallT: 0 };
    for (var y = 0; y < H; y++) S.g.push(new Array(W).fill(0));
    S.next = [pick(), pick()];
    S.cur = make(pick());
  }
  function start() {
    reset(); running = true; paused = false; last = performance.now();
    K.close('ovStart'); K.close('ovEnd'); K.close('ovPause');
    if (window.SCLB) SCLB.start(GAME, MODE);
    if (window.SC) SC.post('start', { game: GAME });
    hud(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function speed() { return Math.max(55, 850 * Math.pow(0.84, S.level - 1)); }
  function loop(t) {
    if (!running) return;
    var dt = Math.min(100, t - last); last = t;
    if (!paused && !S.over) {
      S.fallT += dt;
      if (fits(S.cur, 0, 1)) { S.lockT = 0; while (S.fallT >= speed()) { S.fallT -= speed(); if (fits(S.cur, 0, 1)) S.cur.y++; else break; } }
      else { S.fallT = 0; S.lockT += dt; if (S.lockT > 480) lock(); }
      S.flash = S.flash.filter(function (f) { f.t -= dt; return f.t > 0; });
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  function spawn() {
    S.cur = make(S.next.shift()); S.next.push(pick()); S.canHold = true; S.lockT = 0; S.lockN = 0; S.fallT = 0;
    if (!fits(S.cur, 0, 0)) { S.cur.y--; if (!fits(S.cur, 0, 0)) gameOver(); }
  }
  function lock() {
    var color = S.cur.i + 1, top = false;
    cells(S.cur).forEach(function (c) { if (c[1] < 0) top = true; else S.g[c[1]][c[0]] = color; });
    if (top) return gameOver();
    var full = [];
    for (var y = 0; y < H; y++) if (S.g[y].every(Boolean)) full.push(y);
    if (full.length) {
      var lv = Math.min(10, S.level);
      S.combo++;
      var pts = LINE_PTS[Math.min(5, full.length)] * lv + (S.combo > 0 ? 50 * S.combo * lv : 0);
      S.score += pts; S.lines += full.length;
      full.forEach(function (y) { S.flash.push({ y: y, t: 220, row: S.g[y].slice() }); S.g.splice(y, 1); S.g.unshift(new Array(W).fill(0)); });
      var nl = Math.floor(S.lines / 10) + 1;
      if (nl > S.level) { S.level = nl; K.toast(L('升級！等級 ', 'Level up! ') + nl); K.beep(523, 0.3, 'triangle', 0.06, 1046); }
      K.beep(440 + full.length * 110, 0.18, 'square', 0.05, 880 + full.length * 110);
      var tx = full.length >= 4 ? L('超級消除！', 'MEGA CLEAR!') : '';
      if (S.combo > 0) tx = (tx ? tx + ' ' : '') + S.combo + L(' 連擊', ' COMBO');
      if (tx) { var c = $('combo'); c.textContent = tx; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); }
      navigator.vibrate && navigator.vibrate(30);
    } else { S.combo = -1; K.beep(160, 0.04, 'sine', 0.03); }
    hud(); spawn();
  }
  function gameOver() {
    S.over = true; running = false; draw();
    var sc = S.score, best = K.load('scstack_best', 0);
    if (sc > best) K.save('scstack_best', sc);
    $('endScore').textContent = sc; $('endLines').textContent = S.lines; $('endLevel').textContent = S.level;
    $('endBest').textContent = sc > best ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    K.beep(200, 0.6, 'sawtooth', 0.07, 60);
    if (window.SC) SC.post('gameover', { game: GAME, score: sc });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB && sc > 0) SCLB.offer({ game: GAME, mode: MODE, score: sc, text: sc + L(' 分', ' pts') }); }, 500);
    hud();
  }

  // ---------- 操作 ----------
  function can() { return running && !paused && !S.over; }
  function moved() { if (!fits(S.cur, 0, 1) && S.lockN < 14) { S.lockT = 0; S.lockN++; } }
  function move(d) { if (!can()) return; if (fits(S.cur, d, 0)) { S.cur.x += d; moved(); K.beep(300, 0.02, 'sine', 0.015); } }
  function rotate(dir) {
    if (!can()) return;
    var m = S.cur.m; m = rot(m); if (dir < 0) { m = rot(rot(m)); }
    var kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];
    for (var i = 0; i < kicks.length; i++) if (fits(S.cur, kicks[i][0], kicks[i][1], m)) { S.cur.m = m; S.cur.x += kicks[i][0]; S.cur.y += kicks[i][1]; moved(); K.beep(520, 0.03, 'triangle', 0.025); return; }
  }
  function soft() { if (!can()) return; if (fits(S.cur, 0, 1)) { S.cur.y++; S.score += 1; S.fallT = 0; hud(); } }
  function drop() { if (!can()) return; var n = 0; while (fits(S.cur, 0, 1)) { S.cur.y++; n++; } S.score += n * 2; lock(); }
  function hold() {
    if (!can() || !S.canHold) return;
    var h = S.hold; S.hold = S.cur.i;
    if (h == null) spawn(); else { S.cur = make(h); }
    S.canHold = false; K.beep(660, 0.05, 'sine', 0.03);
  }
  function ghostY() { var g = { m: S.cur.m, x: S.cur.x, y: S.cur.y }; while (fits(g, 0, 1)) g.y++; return g.y; }

  // ---------- 繪圖 ----------
  function resize() {
    var r = $('well').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cs = r.width / W; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function jelly(c, x, y, s, col, alpha) {
    c.globalAlpha = alpha == null ? 1 : alpha;
    var r = s * 0.22, p = s * 0.06;
    var gr = c.createLinearGradient(x, y, x, y + s); gr.addColorStop(0, shade(col, 30)); gr.addColorStop(1, shade(col, -18));
    c.fillStyle = gr; rr(c, x + p, y + p, s - 2 * p, s - 2 * p, r); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; rr(c, x + s * 0.2, y + s * 0.16, s * 0.34, s * 0.16, s * 0.08); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x + s * 0.72, y + s * 0.28, s * 0.06, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  function shade(hex, a) { var n = parseInt(hex.slice(1), 16), r = Math.max(0, Math.min(255, (n >> 16) + a)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + a)), b = Math.max(0, Math.min(255, (n & 255) + a)); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function draw() {
    if (!S) return;
    var w = W * cs, h = H * cs;
    ctx.fillStyle = '#140a18'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if ((x + y) % 2) ctx.fillRect(x * cs, y * cs, cs, cs);
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) { var v = S.g[yy][xx]; if (v) jelly(ctx, xx * cs, yy * cs, cs, SHAPES[v - 1].c); }
    S.flash.forEach(function (f) { ctx.fillStyle = 'rgba(255,255,255,' + (f.t / 220 * 0.8) + ')'; ctx.fillRect(0, f.y * cs, w, cs); });
    if (!S.over && S.cur) {
      var gy = ghostY(), col = SHAPES[S.cur.i].c;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      cells({ m: S.cur.m, x: S.cur.x, y: gy }).forEach(function (c) { if (c[1] >= 0) { rr(ctx, c[0] * cs + 4, c[1] * cs + 4, cs - 8, cs - 8, cs * 0.18); ctx.stroke(); } });
      ctx.setLineDash([]);
      cells(S.cur).forEach(function (c) { if (c[1] >= 0) jelly(ctx, c[0] * cs, c[1] * cs, cs, col); });
    }
    if (S.over) { ctx.fillStyle = 'rgba(20,10,24,.55)'; ctx.fillRect(0, 0, w, h); }
    mini($('cvNext'), S.next, 2); mini($('cvHold'), S.hold == null ? [] : [S.hold], 1, !S.canHold);
  }
  function mini(el, list, slots, dim) {
    var c = el.getContext('2d'), W2 = el.width, H2 = el.height, sh = H2 / slots;
    c.clearRect(0, 0, W2, H2);
    list.slice(0, slots).forEach(function (i, k) {
      var m = SHAPES[i].m, xs = [], ys = [];
      for (var y = 0; y < m.length; y++) for (var x = 0; x < m.length; x++) if (m[y][x]) { xs.push(x); ys.push(y); }
      var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs), miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
      var s = Math.min(18, (W2 - 8) / (maxx - minx + 1), (sh - 8) / (maxy - miny + 1));
      var ox = (W2 - (maxx - minx + 1) * s) / 2, oy = k * sh + (sh - (maxy - miny + 1) * s) / 2;
      for (var j = 0; j < xs.length; j++) jelly(c, ox + (xs[j] - minx) * s, oy + (ys[j] - miny) * s, s, SHAPES[i].c, dim ? 0.35 : 1);
    });
  }
  function hud() { $('score').textContent = S.score; $('level').textContent = S.level; $('lines').textContent = S.lines; $('best').textContent = Math.max(K.load('scstack_best', 0), S.score); }

  // ---------- 輸入 ----------
  var rep = {};
  function press(k) {
    if (k === 'left') move(-1); else if (k === 'right') move(1); else if (k === 'soft') soft();
    else if (k === 'rot') rotate(1); else if (k === 'rotb') rotate(-1); else if (k === 'drop') drop(); else if (k === 'hold') hold();
  }
  function startRep(k) {
    press(k); if (k !== 'left' && k !== 'right' && k !== 'soft') return;
    stopRep(k); rep[k] = setTimeout(function tick() { press(k); rep[k] = setTimeout(tick, k === 'soft' ? 35 : 50); }, k === 'soft' ? 90 : 160);
  }
  function stopRep(k) { clearTimeout(rep[k]); delete rep[k]; }
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'soft', ArrowUp: 'rot', x: 'rot', X: 'rot', z: 'rotb', Z: 'rotb', ' ': 'drop', c: 'hold', C: 'hold', a: 'left', A: 'left', d: 'right', D: 'right', s: 'soft', S: 'soft', w: 'rot', W: 'rot', Shift: 'hold' };
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { pause(!paused); return; }
    if (!running && e.key === 'Enter' && K.isOpen('ovStart')) { start(); return; }
    var k = KEYMAP[e.key]; if (!k) return; e.preventDefault();
    if (e.repeat) return; startRep(k);
  });
  document.addEventListener('keyup', function (e) { var k = KEYMAP[e.key]; if (k) stopRep(k); });
  $('pad').addEventListener('pointerdown', function (e) { var b = e.target.closest('button'); if (!b) return; e.preventDefault(); startRep(b.dataset.k); b.setPointerCapture && b.setPointerCapture(e.pointerId); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { $('pad').addEventListener(ev, function (e) { var b = e.target.closest('button'); if (b) stopRep(b.dataset.k); }); });
  // 在井裡拖曳／點／快滑
  var well = $('well'), t0 = null;
  well.addEventListener('pointerdown', function (e) { t0 = { x: e.clientX, y: e.clientY, t: performance.now(), mx: 0, my: 0, moved: false }; well.setPointerCapture(e.pointerId); });
  well.addEventListener('pointermove', function (e) {
    if (!t0) return;
    var dx = e.clientX - t0.x - t0.mx * cs, dy = e.clientY - t0.y - t0.my * cs;
    while (dx > cs * 0.9) { move(1); t0.mx++; dx -= cs; t0.moved = true; }
    while (dx < -cs * 0.9) { move(-1); t0.mx--; dx += cs; t0.moved = true; }
    if (Math.abs(e.clientY - t0.y) > Math.abs(e.clientX - t0.x) * 1.4) while (dy > cs) { soft(); t0.my++; dy -= cs; t0.moved = true; }
  });
  well.addEventListener('pointerup', function (e) {
    if (!t0) return;
    var dt = performance.now() - t0.t, dy = e.clientY - t0.y, dx = e.clientX - t0.x;
    if (dy > 70 && dt < 260 && Math.abs(dy) > Math.abs(dx) * 1.5) drop();
    else if (!t0.moved && dt < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) rotate(1);
    t0 = null;
  });
  well.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  function pause(p) {
    if (!running || S.over) return; paused = p;
    if (p) K.open('ovPause'); else { K.close('ovPause'); last = performance.now(); }
    $('bPause').textContent = p ? '▶' : '⏸';
  }
  $('bPause').onclick = function () { pause(!paused); };
  $('bResume').onclick = function () { pause(false); };
  $('bQuit').onclick = function () { running = false; K.close('ovPause'); $('bPause').textContent = '⏸'; showStart(); };
  $('bStart').onclick = start; $('bAgain').onclick = start;
  document.addEventListener('visibilitychange', function () { if (document.hidden && running && !paused) pause(true); });
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  function showStart() {
    reset(); hud(); draw();
    var best = K.load('scstack_best', 0);
    $('bestLine').textContent = best ? L('個人最佳：', 'Personal best: ') + best : '';
    K.open('ovStart');
  }
  window.addEventListener('resize', resize);
  showStart(); resize();
})();
