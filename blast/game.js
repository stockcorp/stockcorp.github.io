/* 方塊爆破 — stockcorp.github.io/blast/
   8×8、每次 3 個方塊、拖放、排滿一行或一列消除、連擊、清空盤面加分、自動存檔。
   排行榜：mode classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'blast', MODE = 'classic', N = 8, SAVE = 'scblast_save', $ = K.$, L = K.L;
  var COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];
  // 形狀：[[x,y],...]，w = 出現權重
  var P = [];
  function add(cells, w) { P.push({ c: cells, w: w }); }
  function rect(w, h) { var a = []; for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) a.push([x, y]); return a; }
  function rots(cells) {
    var out = [], cur = cells;
    for (var r = 0; r < 4; r++) {
      var mx = Math.max.apply(null, cur.map(function (c) { return c[1]; }));
      cur = cur.map(function (c) { return [mx - c[1], c[0]]; });
      var key = norm(cur).map(function (c) { return c.join(','); }).sort().join(';');
      if (!out.some(function (o) { return o.k === key; })) out.push({ k: key, c: norm(cur) });
    }
    return out.map(function (o) { return o.c; });
  }
  function norm(cs) { var mx = Math.min.apply(null, cs.map(function (c) { return c[0]; })), my = Math.min.apply(null, cs.map(function (c) { return c[1]; })); return cs.map(function (c) { return [c[0] - mx, c[1] - my]; }); }
  add([[0, 0]], 3);
  rots(rect(2, 1)).forEach(function (c) { add(c, 3); });
  rots(rect(3, 1)).forEach(function (c) { add(c, 3); });
  rots(rect(4, 1)).forEach(function (c) { add(c, 2); });
  rots(rect(5, 1)).forEach(function (c) { add(c, 1.2); });
  add(rect(2, 2), 3); add(rect(3, 3), 1.2);
  rots(rect(3, 2)).forEach(function (c) { add(c, 1.5); });
  rots([[0, 0], [0, 1], [1, 1]]).forEach(function (c) { add(c, 1.5); });
  rots([[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]).forEach(function (c) { add(c, 0.8); });
  rots([[0, 0], [0, 1], [0, 2], [1, 2]]).forEach(function (c) { add(c, 1); });
  rots([[1, 0], [0, 1], [1, 1], [2, 1]]).forEach(function (c) { add(c, 1); });
  rots([[1, 0], [2, 0], [0, 1], [1, 1]]).forEach(function (c) { add(c, 0.8); });

  var S = null, cv = $('cv'), ctx = cv.getContext('2d'), cs = 40, drag = null, fx = [];

  // ---------- 規則 ----------
  function fresh() { var g = []; for (var y = 0; y < N; y++) g.push(new Array(N).fill(0)); return g; }
  function canPlace(g, sh, x, y) { return sh.every(function (c) { var X = x + c[0], Y = y + c[1]; return X >= 0 && Y >= 0 && X < N && Y < N && !g[Y][X]; }); }
  function fitsAny(g, sh) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (canPlace(g, sh, x, y)) return true; return false; }
  function randPiece() {
    var tot = P.reduce(function (a, p) { return a + p.w; }, 0), r = Math.random() * tot;
    for (var i = 0; i < P.length; i++) { r -= P[i].w; if (r <= 0) break; }
    return { s: Math.min(i, P.length - 1), col: (Math.random() * COLORS.length) | 0 };
  }
  function deal() {
    // 至少要有一個放得下，盡量不要一發就死
    for (var t = 0; t < 30; t++) {
      var tr = [randPiece(), randPiece(), randPiece()];
      if (tr.some(function (p) { return fitsAny(S.g, P[p.s].c); })) { S.tray = tr; return; }
    }
    S.tray = [randPiece(), randPiece(), randPiece()];
  }
  function lines(g) {
    var rows = [], cols = [];
    for (var y = 0; y < N; y++) if (g[y].every(Boolean)) rows.push(y);
    for (var x = 0; x < N; x++) { var f = true; for (var y2 = 0; y2 < N; y2++) if (!g[y2][x]) { f = false; break; } if (f) cols.push(x); }
    return { rows: rows, cols: cols };
  }
  function place(slot, x, y) {
    var pc = S.tray[slot], sh = P[pc.s].c;
    if (!pc || !canPlace(S.g, sh, x, y)) return false;
    sh.forEach(function (c) { S.g[y + c[1]][x + c[0]] = pc.col + 1; });
    S.score += sh.length; S.tray[slot] = null; S.moves++;
    var ln = lines(S.g), n = ln.rows.length + ln.cols.length;
    if (n) {
      S.streak = S.sinceClear <= 2 ? S.streak + 1 : 1; S.sinceClear = 0;
      var pts = Math.round((n * 80 + (n - 1) * n * 40) * (1 + (S.streak - 1) * 0.5));
      ln.rows.forEach(function (r) { for (var x2 = 0; x2 < N; x2++) { fx.push({ x: x2, y: r, col: S.g[r][x2], t: 350 }); } });
      ln.cols.forEach(function (c) { for (var y2 = 0; y2 < N; y2++) fx.push({ x: c, y: y2, col: S.g[y2][c], t: 350 }); });
      ln.rows.forEach(function (r) { S.g[r].fill(0); }); ln.cols.forEach(function (c) { for (var y3 = 0; y3 < N; y3++) S.g[y3][c] = 0; });
      S.lines += n; S.score += pts;
      var empty = S.g.every(function (r) { return r.every(function (v) { return !v; }); });
      if (empty) S.score += 1000;
      pop((n > 1 ? n + L(' 行！', ' lines! ') : '') + (S.streak > 1 ? L('連擊 ×', 'Combo ×') + S.streak : '') + (empty ? L(' 全清 +1000', ' Clear +1000') : '') || '+' + pts);
      K.beep(500 + n * 120, 0.2, 'square', 0.05, 1000 + n * 150); navigator.vibrate && navigator.vibrate(25);
    } else { S.sinceClear++; if (S.sinceClear > 2) S.streak = 0; K.beep(300, 0.05, 'triangle', 0.04); }
    if (S.tray.every(function (p) { return !p; })) deal();
    persist(); render();
    if (!S.tray.some(function (p) { return p && fitsAny(S.g, P[p.s].c); })) setTimeout(over, 450);
    return true;
  }
  function pop(t) { var p = $('pop'); p.textContent = t; p.classList.remove('go'); void p.offsetWidth; p.classList.add('go'); }
  function over() {
    if (S.over) return; S.over = true; persist();
    var best = K.load('scblast_best', 0); if (S.score > best) K.save('scblast_best', S.score);
    $('endScore').textContent = S.score; $('endLines').textContent = S.lines;
    $('endBest').textContent = S.score > best ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    K.beep(220, 0.5, 'sawtooth', 0.06, 80);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    K.open('ovEnd');
    if (window.SCLB && S.score > 0) SCLB.offer({ game: GAME, mode: MODE, score: S.score, text: S.score + L(' 分', ' pts') });
    render();
  }
  function newGame() {
    S = { g: fresh(), tray: [], score: 0, lines: 0, streak: 0, sinceClear: 9, moves: 0, over: false };
    deal(); persist(); render();
    if (window.SCLB) SCLB.start(GAME, MODE);
    if (window.SC) SC.post('start', { game: GAME });
  }
  function persist() { K.save(SAVE, S); }

  // ---------- 繪圖 ----------
  function resize() {
    var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cs = r.width / N; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render();
  }
  function block(c, x, y, s, col, a) {
    c.globalAlpha = a == null ? 1 : a;
    var p = s * 0.05, g = c.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, lighten(col, 40)); g.addColorStop(1, lighten(col, -25));
    c.fillStyle = g; rr(c, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.16); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, x + s * 0.14, y + s * 0.12, s * 0.72, s * 0.2, s * 0.08); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = Math.max(1, s * 0.04); rr(c, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.16); c.stroke();
    c.globalAlpha = 1;
  }
  function lighten(hex, a) { var n = parseInt(hex.slice(1), 16), f = function (v) { return Math.max(0, Math.min(255, v + a)); }; return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var animOn = false;
  function render() {
    if (!S) return;
    var w = N * cs;
    ctx.clearRect(0, 0, w, w);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { ctx.fillStyle = (x + y) % 2 ? '#352010' : '#3d2513'; rr(ctx, x * cs + 2, y * cs + 2, cs - 4, cs - 4, cs * 0.12); ctx.fill(); }
    // 拖曳中的預覽：放得下就顯示陰影，並把會消掉的行亮起來
    var prev = null;
    if (drag && drag.cell) {
      var sh = P[S.tray[drag.slot].s].c;
      if (canPlace(S.g, sh, drag.cell[0], drag.cell[1])) {
        var g2 = S.g.map(function (r) { return r.slice(); });
        sh.forEach(function (c) { g2[drag.cell[1] + c[1]][drag.cell[0] + c[0]] = 99; });
        prev = { sh: sh, ln: lines(g2) };
      }
    }
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      var v = S.g[yy][xx]; if (!v) continue;
      var hl = prev && (prev.ln.rows.indexOf(yy) >= 0 || prev.ln.cols.indexOf(xx) >= 0);
      block(ctx, xx * cs, yy * cs, cs, hl ? COLORS[S.tray[drag.slot].col] : COLORS[v - 1]);
    }
    if (prev) prev.sh.forEach(function (c) { block(ctx, (drag.cell[0] + c[0]) * cs, (drag.cell[1] + c[1]) * cs, cs, COLORS[S.tray[drag.slot].col], 0.45); });
    fx.forEach(function (f) { var k = f.t / 350, s = cs * (0.5 + k * 0.5); block(ctx, f.x * cs + (cs - s) / 2, f.y * cs + (cs - s) / 2, s, COLORS[(f.col || 1) - 1] || '#fff', k); });
    $('score').textContent = S.score; $('streak').textContent = S.streak > 1 ? '×' + S.streak : '0';
    $('best').textContent = Math.max(K.load('scblast_best', 0), S.score);
    var slots = document.querySelectorAll('.slot');
    for (var i = 0; i < 3; i++) {
      var pc = S.tray[i], el = slots[i], c2 = el.querySelector('canvas');
      el.classList.toggle('used', !pc || (drag && drag.slot === i));
      el.classList.toggle('no', !!pc && !fitsAny(S.g, P[pc.s].c));
      if (pc) drawPiece(c2, pc, 5);
    }
    if (fx.length && !animOn) { animOn = true; var t0 = performance.now(); requestAnimationFrame(function step(t) { var dt = t - t0; t0 = t; fx = fx.filter(function (f) { f.t -= dt; return f.t > 0; }); render(); if (fx.length) requestAnimationFrame(step); else { animOn = false; render(); } }); }
  }
  function drawPiece(c2, pc, cells) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), r = c2.getBoundingClientRect(), W2 = Math.max(40, r.width) * dpr;
    c2.width = W2; c2.height = W2;
    var c = c2.getContext('2d'), sh = P[pc.s].c, w = Math.max.apply(null, sh.map(function (q) { return q[0]; })) + 1, h = Math.max.apply(null, sh.map(function (q) { return q[1]; })) + 1;
    var s = W2 / cells, ox = (W2 - w * s) / 2, oy = (W2 - h * s) / 2;
    sh.forEach(function (q) { block(c, ox + q[0] * s, oy + q[1] * s, s, COLORS[pc.col]); });
  }

  // ---------- 拖放 ----------
  var dragEl = $('drag'), dragCv = dragEl.querySelector('canvas');
  document.querySelector('.tray').addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.slot'); if (!el || !S || S.over) return;
    var i = +el.dataset.s, pc = S.tray[i]; if (!pc) return;
    e.preventDefault();
    var sh = P[pc.s].c, w = Math.max.apply(null, sh.map(function (q) { return q[0]; })) + 1, h = Math.max.apply(null, sh.map(function (q) { return q[1]; })) + 1;
    drag = { slot: i, w: w, h: h, cell: null, id: e.pointerId };
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    dragCv.width = w * cs * dpr; dragCv.height = h * cs * dpr; dragCv.style.width = w * cs + 'px'; dragCv.style.height = h * cs + 'px';
    var c = dragCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); sh.forEach(function (q) { block(c, q[0] * cs, q[1] * cs, cs, COLORS[pc.col]); });
    dragEl.style.display = 'block'; moveDrag(e); render();
    K.beep(600, 0.03, 'sine', 0.03);
  });
  function moveDrag(e) {
    if (!drag) return;
    // 方塊顯示在手指上方，避免被手指擋住
    var lift = e.pointerType === 'mouse' ? 0 : cs * 1.6;
    var px = e.clientX - drag.w * cs / 2, py = e.clientY - drag.h * cs / 2 - lift - (e.pointerType === 'mouse' ? 0 : drag.h * cs / 2);
    dragEl.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    var r = $('board').getBoundingClientRect();
    var cx = Math.round((px - r.left) / cs), cy = Math.round((py - r.top) / cs);
    var inside = px + drag.w * cs > r.left && px < r.right && py + drag.h * cs > r.top && py < r.bottom;
    var nc = inside ? [cx, cy] : null;
    if (String(nc) !== String(drag.cell)) { drag.cell = nc; render(); }
  }
  window.addEventListener('pointermove', function (e) { if (drag && e.pointerId === drag.id) { e.preventDefault(); moveDrag(e); } }, { passive: false });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; dragEl.style.display = 'none';
    if (!(d.cell && place(d.slot, d.cell[0], d.cell[1]))) { if (d.cell) K.beep(150, 0.08, 'square', 0.03); render(); }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  $('bNew').onclick = function () {
    if (S && S.moves > 3 && !S.over && !(Date.now() - (S.askNew || 0) < 2500)) { S.askNew = Date.now(); K.toast(L('再按一次「新局」放棄這局', 'Tap New again to abandon this game')); return; }
    K.close('ovEnd'); newGame();
  };
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (window.SC) SC.onLang(render);

  var sv = K.load(SAVE, null);
  if (sv && sv.g && sv.g.length === N && !sv.over && sv.tray) { S = sv; if (window.SCLB && !SCLB.has(GAME, MODE)) SCLB.start(GAME, MODE); }
  else newGame();
  resize();
})();
