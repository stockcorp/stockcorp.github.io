/* 推箱子 — stockcorp.github.io/sokoban/
   30 關由離線產生器以「倒推」做出來、再用 BFS 求解器驗證有解並依最少推數排難度（levels.js）。
   排行榜：mode = levels，過關數越多越好。 */
(function () {
  'use strict';
  var GAME = 'sokoban', $ = K.$, L = K.L, LV = window.SOKO;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, cs = 40, hist = [];
  var DIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  function load(n) {
    var g = LV[n].g, H = g.length, W = Math.max.apply(null, g.map(function (r) { return r.length; }));
    S = { n: n, W: W, H: H, wall: {}, tgt: {}, box: {}, p: 0, moves: 0, pushes: 0, done: false, face: 'd' };
    g.forEach(function (row, y) { for (var x = 0; x < W; x++) { var ch = row[x] || '#', i = y * W + x; if (ch === '#') S.wall[i] = 1; if (ch === '.' || ch === '*' || ch === '+') S.tgt[i] = 1; if (ch === '$' || ch === '*') S.box[i] = 1; if (ch === '@' || ch === '+') S.p = i; } });
    hist = []; K.save('scsoko_cur', n); K.close('ovEnd');
    $('lvNo').textContent = n + 1; resize(); hud();
  }
  function hud() { $('moves').textContent = S.moves; $('pushes').textContent = S.pushes; }
  function snap() { return { box: Object.assign({}, S.box), p: S.p, moves: S.moves, pushes: S.pushes }; }
  function move(d) {
    if (!S || S.done) return false;
    var v = DIR[d], x = S.p % S.W, y = (S.p / S.W) | 0, n = (y + v[1]) * S.W + x + v[0];
    S.face = d;
    if (S.wall[n]) return false;
    if (S.box[n]) {
      var n2 = (y + 2 * v[1]) * S.W + x + 2 * v[0];
      if (S.wall[n2] || S.box[n2]) { K.beep(140, 0.04, 'square', 0.02); return false; }
      hist.push(snap()); delete S.box[n]; S.box[n2] = 1; S.pushes++;
      K.beep(S.tgt[n2] ? 880 : 330, 0.05, 'triangle', 0.04);
    } else hist.push(snap());
    S.p = n; S.moves++; hud(); draw(); check(); return true;
  }
  function check() {
    for (var b in S.box) if (!S.tgt[b]) return;
    S.done = true;
    var best = K.load('scsoko_max', 0), cleared = S.n + 1;
    if (cleared > best) { K.save('scsoko_max', cleared); }
    var bm = K.load('scsoko_bm', {}); if (!bm[S.n] || S.moves < bm[S.n]) { bm[S.n] = S.moves; K.save('scsoko_bm', bm); }
    $('endMoves').textContent = S.moves; $('endPushes').textContent = S.pushes;
    $('endTitle').textContent = S.n === LV.length - 1 ? L('全部 30 關破完！', 'All 30 levels cleared!') : L('第 ' + cleared + ' 關過關！', 'Level ' + cleared + ' clear!');
    $('endBest').textContent = L('最少推數參考：', 'Fewest pushes possible: ') + LV[S.n].p;
    $('bAgain').style.display = S.n < LV.length - 1 ? '' : 'none';
    K.beep(523, 0.5, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, level: cleared });
    setTimeout(function () {
      K.open('ovEnd');
      var mx = K.load('scsoko_max', 0);
      if (cleared >= mx && window.SCLB) { SCLB.start(GAME, 'levels'); setTimeout(function () { SCLB.offer({ game: GAME, mode: 'levels', score: mx, text: L('通過 ', 'Cleared ') + mx + L(' 關', ' levels') }); }, 2200); }
    }, 500);
  }
  // 點空地自動走過去（BFS，不推箱子）
  function walkTo(t) {
    if (S.wall[t] || S.box[t]) return;
    var prev = {}, q = [S.p]; prev[S.p] = -1;
    while (q.length) { var c = q.shift(); if (c === t) break; ['u', 'd', 'l', 'r'].forEach(function (d) { var v = DIR[d], n = c + v[1] * S.W + v[0]; if (!(n in prev) && !S.wall[n] && !S.box[n]) { prev[n] = c; q.push(n); } }); }
    if (!(t in prev)) return;
    var path = []; for (var c2 = t; prev[c2] !== -1; c2 = prev[c2]) path.unshift(c2);
    var i = 0, run = function () { if (i >= path.length || S.done) return; var c3 = S.p, n = path[i++], d = n - c3 === 1 ? 'r' : n - c3 === -1 ? 'l' : n > c3 ? 'd' : 'u'; move(d); setTimeout(run, 55); }; run();
  }
  function resize() {
    if (!S) return;
    var avW = Math.min(window.innerWidth - 20, 620), avH = Math.max(260, window.innerHeight - 260);
    cs = Math.floor(Math.min(avW / S.W, avH / S.H, 56));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = S.W * cs * dpr; cv.height = S.H * cs * dpr; cv.style.width = S.W * cs + 'px'; cv.style.height = S.H * cs + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function draw() {
    ctx.fillStyle = '#1c140b'; ctx.fillRect(0, 0, S.W * cs, S.H * cs);
    for (var i = 0; i < S.W * S.H; i++) {
      var x = (i % S.W) * cs, y = ((i / S.W) | 0) * cs;
      if (S.wall[i]) { ctx.fillStyle = '#5b4126'; ctx.fillRect(x, y, cs, cs); ctx.fillStyle = '#6f5130'; ctx.fillRect(x + 1, y + 1, cs / 2 - 2, cs / 2 - 2); ctx.fillRect(x + cs / 2 + 1, y + cs / 2 + 1, cs / 2 - 2, cs / 2 - 2); continue; }
      ctx.fillStyle = (i % S.W + ((i / S.W) | 0)) % 2 ? '#e7d5b4' : '#ddc8a3'; ctx.fillRect(x, y, cs, cs);
      if (S.tgt[i]) { ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.17, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(22,163,74,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.3, 0, 7); ctx.stroke(); }
      if (S.box[i]) {
        var on = S.tgt[i], pd = cs * 0.1;
        ctx.fillStyle = on ? '#15803d' : '#b45309'; ctx.fillRect(x + pd, y + pd, cs - pd * 2, cs - pd * 2);
        ctx.strokeStyle = on ? '#bbf7d0' : '#fcd34d'; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.strokeRect(x + pd * 1.6, y + pd * 1.6, cs - pd * 3.2, cs - pd * 3.2);
        ctx.beginPath(); ctx.moveTo(x + pd * 1.6, y + pd * 1.6); ctx.lineTo(x + cs - pd * 1.6, y + cs - pd * 1.6); ctx.moveTo(x + cs - pd * 1.6, y + pd * 1.6); ctx.lineTo(x + pd * 1.6, y + cs - pd * 1.6); ctx.stroke();
      }
    }
    var px = (S.p % S.W) * cs + cs / 2, py = ((S.p / S.W) | 0) * cs + cs / 2, r = cs * 0.34;
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(px, py + r * 0.25, r * 0.85, 0, 7); ctx.fill();
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(px, py - r * 0.35, r * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(px, py - r * 0.55, r * 0.6, Math.PI, 0); ctx.fill();
    var e = DIR[S.face]; ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px + e[0] * r * 0.25 - r * 0.18, py - r * 0.3 + e[1] * r * 0.1, 2, 0, 7); ctx.arc(px + e[0] * r * 0.25 + r * 0.18, py - r * 0.3 + e[1] * r * 0.1, 2, 0, 7); ctx.fill();
  }
  // 輸入
  var KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' };
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; var d = KEYS[e.key]; if (d) { e.preventDefault(); move(d); } else if (e.key === 'z' || (e.key === 'Backspace')) undo(); });
  [].forEach.call(document.querySelectorAll('.dpad button'), function (b) { var t = null; b.addEventListener('pointerdown', function (e) { e.preventDefault(); move(b.dataset.d); t = setInterval(function () { move(b.dataset.d); }, 170); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { clearInterval(t); }); }); });
  var sw = null;
  cv.addEventListener('pointerdown', function (e) { sw = { x: e.clientX, y: e.clientY, used: false }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', function (e) { if (!sw) return; var dx = e.clientX - sw.x, dy = e.clientY - sw.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > cs * 0.6) { move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); sw.x = e.clientX; sw.y = e.clientY; sw.used = true; } });
  cv.addEventListener('pointerup', function (e) { if (sw && !sw.used) { var r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / cs), y = Math.floor((e.clientY - r.top) / cs); walkTo(y * S.W + x); } sw = null; });
  function undo() { if (!hist.length || S.done) return; var h = hist.pop(); S.box = h.box; S.p = h.p; S.moves = h.moves; S.pushes = h.pushes; hud(); draw(); }
  $('bUndo').onclick = undo;
  $('bReset').onclick = function () { load(S.n); };
  $('bAgain').onclick = function () { if (S.n < LV.length - 1) load(S.n + 1); };
  $('bLevels').onclick = function () {
    var g = $('lvGrid'), mx = K.load('scsoko_max', 0); g.innerHTML = '';
    LV.forEach(function (_, i) { var b = document.createElement('button'); b.textContent = i + 1; if (i < mx) b.className = 'done'; b.disabled = i > mx; b.onclick = function () { K.close('ovLv'); load(i); }; g.appendChild(b); });
    K.open('ovLv');
  };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__sk = { S: function () { return S; }, move: move, load: load };
  load(Math.min(K.load('scsoko_cur', 0), K.load('scsoko_max', 0), LV.length - 1));
})();
