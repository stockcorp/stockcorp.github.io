/* 泡泡射擊 — stockcorp.github.io/bubble/
   邏輯 480×680；六角格 10 欄（奇數排內縮半格、9 顆）。三顆同色消除＋懸空掉落；射空 N 次天花板下壓一排。
   排行榜：classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'bubble', $ = K.$, L = K.L, W = 480, H = 680, R = 24, RH = R * Math.sqrt(3), TOP = 6, COLS = 10, ROWS = 20;
  var SX = W / 2, SY = H - 50, DEAD = H - 110;
  var PAL = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;

  function off(r) { return (r + S.par) % 2 === 1; }
  function ncols(r) { return off(r) ? COLS - 1 : COLS; }
  function pos(r, c) { return { x: R + c * 2 * R + (off(r) ? R : 0), y: TOP + R + r * RH }; }
  function newGame() {
    S = { score: 0, board: 1, g: [], par: 0, shot: null, cur: 0, nxt: 0, ang: -Math.PI / 2, aim: false, misses: 0, every: 6, nCol: 4, over: false, started: false, fall: [], pops: [] };
    fill(); S.cur = pick(); S.nxt = pick(); hud(); K.close('ovEnd');
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function fill() {
    S.g = []; S.par = 0; S.nCol = Math.min(7, 3 + S.board); S.every = Math.max(3, 7 - S.board);
    var rows = Math.min(9, 4 + S.board);
    for (var r = 0; r < ROWS; r++) { S.g.push([]); for (var c = 0; c < COLS; c++) S.g[r].push(r < rows && c < ncols(r) ? ((Math.random() * S.nCol) | 0) : -1); }
    // 讓相鄰同色比較常見，盤面比較好玩
    for (r = 1; r < rows; r++) for (c = 0; c < ncols(r); c++) if (Math.random() < 0.35) { var n = nbs(r, c).filter(function (p) { return p[0] < r; }); if (n.length) S.g[r][c] = S.g[n[0][0]][n[0][1]]; }
    S.misses = 0;
  }
  function nbs(r, c) {
    var o = off(r), d = o ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]], out = [];
    d.forEach(function (v) { var rr = r + v[0], cc = c + v[1]; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < ncols(rr)) out.push([rr, cc]); });
    return out;
  }
  function present() { var s = {}; S.g.forEach(function (row) { row.forEach(function (v) { if (v >= 0) s[v] = 1; }); }); return Object.keys(s).map(Number); }
  function pick() { var p = present(); return p.length ? p[(Math.random() * p.length) | 0] : (Math.random() * S.nCol) | 0; }
  function hud() { $('score').textContent = S.score.toLocaleString(); $('board').textContent = S.board; $('drop').textContent = S.every - S.misses; }

  function shoot() {
    if (S.over || S.shot) return;
    var a = Math.max(-Math.PI + 0.12, Math.min(-0.12, S.ang));
    S.shot = { x: SX, y: SY, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, c: S.cur };
    S.cur = S.nxt; S.nxt = pick(); K.beep(500, 0.04, 'sine', 0.04, 700);
    if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
  }
  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (S.shot) for (var k = 0; k < 6; k++) { if (!S.shot) break; moveShot(dt / 6); }
    S.fall.forEach(function (f) { f.vy += 1400 * dt; f.y += f.vy * dt; f.x += f.vx * dt; });
    S.fall = S.fall.filter(function (f) { return f.y < H + 40; });
    S.pops.forEach(function (p) { p.t -= dt; }); S.pops = S.pops.filter(function (p) { return p.t > 0; });
    draw(); raf = requestAnimationFrame(loop);
  }
  function moveShot(dt) {
    var s = S.shot; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < R) { s.x = R; s.vx = -s.vx; } if (s.x > W - R) { s.x = W - R; s.vx = -s.vx; }
    var hitIt = s.y <= TOP + R;
    if (!hitIt) for (var r = 0; r < ROWS && !hitIt; r++) for (var c = 0; c < ncols(r); c++) { if (S.g[r][c] < 0) continue; var p = pos(r, c); if ((p.x - s.x) * (p.x - s.x) + (p.y - s.y) * (p.y - s.y) < (2 * R * 0.88) * (2 * R * 0.88)) { hitIt = true; break; } }
    if (hitIt) land(s);
  }
  function land(s) {
    // 找最近的空格
    var best = null, bd = 1e9;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < ncols(r); c++) {
      if (S.g[r][c] >= 0) continue; var p = pos(r, c), d = (p.x - s.x) * (p.x - s.x) + (p.y - s.y) * (p.y - s.y);
      if (d < bd && (r === 0 || nbs(r, c).some(function (q) { return S.g[q[0]][q[1]] >= 0; }))) { bd = d; best = [r, c]; }
    }
    S.shot = null; if (!best) return;
    S.g[best[0]][best[1]] = s.c;
    var grp = flood(best[0], best[1], function (v) { return v === s.c; });
    if (grp.length >= 3) {
      grp.forEach(function (q) { var p = pos(q[0], q[1]); S.pops.push({ x: p.x, y: p.y, c: S.g[q[0]][q[1]], t: 0.25 }); S.g[q[0]][q[1]] = -1; });
      var drop = floating(); drop.forEach(function (q) { var p = pos(q[0], q[1]); S.fall.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 200, c: S.g[q[0]][q[1]] }); S.g[q[0]][q[1]] = -1; });
      var pts = grp.length * 10 + drop.length * 20 * (drop.length >= 5 ? 2 : 1); S.score += pts * Math.min(3, S.board);
      K.beep(700, 0.08, 'triangle', 0.05, 1000 + drop.length * 40); navigator.vibrate && navigator.vibrate(12);
      if (drop.length >= 5) K.toast(L('掉落 ', 'Dropped ') + drop.length + '!', 900);
      if (!present().length) { S.score += 500 * S.board; S.board++; K.toast(L('清空盤面！第 ' + S.board + ' 盤', 'Board cleared! Board ' + S.board), 1600); K.beep(523, 0.5, 'triangle', 0.07, 1046); fill(); S.cur = pick(); S.nxt = pick(); }
    } else {
      K.beep(260, 0.04, 'square', 0.025);
      S.misses++; if (S.misses >= S.every) { S.misses = 0; pushDown(); }
    }
    if (present().indexOf(S.cur) < 0) S.cur = pick(); if (present().indexOf(S.nxt) < 0) S.nxt = pick();
    hud(); checkDead();
  }
  function flood(r, c, f) {
    var seen = {}, st = [[r, c]], out = [];
    while (st.length) { var q = st.pop(), k = q[0] * 20 + q[1]; if (seen[k]) continue; seen[k] = 1; if (S.g[q[0]][q[1]] < 0 || !f(S.g[q[0]][q[1]])) continue; out.push(q); nbs(q[0], q[1]).forEach(function (n) { st.push(n); }); }
    return out;
  }
  function floating() {
    var keep = {};
    for (var c = 0; c < ncols(0); c++) if (S.g[0][c] >= 0) flood(0, c, function () { return true; }).forEach(function (q) { keep[q[0] * 20 + q[1]] = 1; });
    var out = []; for (var r = 0; r < ROWS; r++) for (c = 0; c < ncols(r); c++) if (S.g[r][c] >= 0 && !keep[r * 20 + c]) out.push([r, c]);
    return out;
  }
  function pushDown() {
    S.g.pop(); S.par = 1 - S.par; var row = []; for (var c = 0; c < COLS; c++) row.push(c < (S.par ? COLS - 1 : COLS) ? ((Math.random() * S.nCol) | 0) : -1);
    S.g.unshift(row); K.beep(140, 0.25, 'sawtooth', 0.05, 90); navigator.vibrate && navigator.vibrate(40);
  }
  function checkDead() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < ncols(r); c++) if (S.g[r][c] >= 0 && pos(r, c).y + R > DEAD) return gameOver();
  }
  function gameOver() {
    if (S.over) return; S.over = true;
    var best = K.load('scbub_best', 0), nb = S.score > best; if (nb) K.save('scbub_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endBoard').textContent = S.board;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    K.beep(200, 0.6, 'sawtooth', 0.06, 70);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.started && S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: L('第 ', 'Board ') + S.board + L(' 盤', '') }); }, 700);
  }

  function ball(x, y, c, r) {
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, PAL[c]); g.addColorStop(1, shade(PAL[c]));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, 7); ctx.fill();
  }
  function shade(h) { var n = parseInt(h.slice(1), 16); return 'rgb(' + ((n >> 16) * 0.55 | 0) + ',' + (((n >> 8) & 255) * 0.55 | 0) + ',' + ((n & 255) * 0.55 | 0) + ')'; }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(248,113,113,.5)'; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(0, DEAD); ctx.lineTo(W, DEAD); ctx.stroke(); ctx.setLineDash([]);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < ncols(r); c++) if (S.g[r][c] >= 0) { var p = pos(r, c); ball(p.x, p.y, S.g[r][c], R); }
    S.pops.forEach(function (p) { ctx.globalAlpha = p.t * 4; ctx.strokeStyle = PAL[p.c]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R * (1.6 - p.t * 2.4), 0, 7); ctx.stroke(); }); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    S.fall.forEach(function (f) { ball(f.x, f.y, f.c, R); });
    if (!S.over) {
      // 瞄準線（含一次反彈）
      var a = Math.max(-Math.PI + 0.12, Math.min(-0.12, S.ang)), x = SX, y = SY, dx = Math.cos(a), dy = Math.sin(a);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (var i = 0, len = 0; i < 40 && y > TOP; i++) { x += dx * 16; y += dy * 16; if (x < R || x > W - R) { dx = -dx; x = Math.max(R, Math.min(W - R, x)); } if (i % 2 === 0) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); } }
    }
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.arc(SX, SY, R + 10, 0, 7); ctx.fill();
    if (S.shot) ball(S.shot.x, S.shot.y, S.shot.c, R); else ball(SX, SY, S.cur, R);
    ball(SX + 80, SY + 12, S.nxt, R * 0.72);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⇄', SX + 80, SY + 40);
  }

  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  function aimAt(p) { S.ang = Math.atan2(Math.min(p.y, SY - 10) - SY, p.x - SX); }
  function onSwap(p) { return Math.hypot(p.x - SX - 80, p.y - SY - 12) < 30; }
  var down = false;
  cv.addEventListener('pointerdown', function (e) { if (!S || S.over) return; var p = pt(e); if (onSwap(p)) { if (!S.shot) { var t = S.cur; S.cur = S.nxt; S.nxt = t; K.beep(600, 0.03, 'sine', 0.03); } return; } down = true; aimAt(p); });
  cv.addEventListener('pointermove', function (e) { if (!S || S.over) return; if (e.pointerType === 'mouse' || down) aimAt(pt(e)); });
  cv.addEventListener('pointerup', function (e) { if (!down) return; down = false; if (!S || S.over) return; aimAt(pt(e)); shoot(); });
  cv.addEventListener('pointercancel', function () { down = false; });
  document.addEventListener('keydown', function (e) {
    if (!S || S.over || (K.isOpen && K.isOpen())) return;
    if (e.key === 'ArrowLeft') S.ang = Math.max(-Math.PI + 0.12, S.ang - 0.05); else if (e.key === 'ArrowRight') S.ang = Math.min(-0.12, S.ang + 0.05);
    else if (e.key === ' ' || e.key === 'ArrowUp') shoot(); else return; e.preventDefault();
  });
  $('bNew').onclick = function () {
    if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; }
    newGame();
  };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (location.hash.indexOf('#test') === 0) window.__bb = { S: function () { return S; }, shoot: function (a) { S.ang = a; shoot(); }, over: gameOver };
  newGame();
})();
