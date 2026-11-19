/* 寶石消消樂 — stockcorp.github.io/jewel/
   8×8、6 色（每色不同形狀）；四顆＝炸彈（3×3）、五顆＝彩虹（清同色）；連鎖倍數。限時 120 秒，從第一步起算。
   排行榜：mode = 2min，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'jewel', $ = K.$, L = K.L, N = 8, CS = 80, LIMIT = 120;
  var COL = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#f1f5f9'];
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, uid = 0, settleCb = [];

  function gem(k, sp, r) { return { k: k, sp: sp || 0, x: 0, y: r, id: ++uid, pop: 0 }; }
  function newGame() {
    S = { g: [], score: 0, chain: 0, best: 0, busy: false, sel: null, started: false, over: false, t0: 0, idle: performance.now(), hint: null, fx: [] };
    for (var r = 0; r < N; r++) { S.g.push([]); for (var c = 0; c < N; c++) { var k; do { k = (Math.random() * 6) | 0; } while ((c >= 2 && S.g[r][c - 1].k === k && S.g[r][c - 2].k === k) || (r >= 2 && S.g[r - 1][c].k === k && S.g[r - 2][c].k === k)); var g = gem(k, 0, r - N); g.x = c; S.g[r].push(g); } }
    if (!findMove()) return newGame();
    hud(); $('clock').textContent = '2:00'; $('tfill').style.width = '100%'; K.close('ovEnd');
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function hud() { $('score').textContent = S.score.toLocaleString(); }

  // ---------- 規則 ----------
  function runs() {
    var out = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N;) { var k = S.g[r][c] && S.g[r][c].sp !== 2 ? S.g[r][c].k : -1, e = c + 1; while (k >= 0 && e < N && S.g[r][e] && S.g[r][e].sp !== 2 && S.g[r][e].k === k) e++; if (k >= 0 && e - c >= 3) { var a = []; for (var i = c; i < e; i++) a.push([r, i]); out.push(a); } c = e; }
    for (c = 0; c < N; c++) for (r = 0; r < N;) { k = S.g[r][c] && S.g[r][c].sp !== 2 ? S.g[r][c].k : -1; e = r + 1; while (k >= 0 && e < N && S.g[e][c] && S.g[e][c].sp !== 2 && S.g[e][c].k === k) e++; if (k >= 0 && e - r >= 3) { a = []; for (i = r; i < e; i++) a.push([i, c]); out.push(a); } r = e; }
    return out;
  }
  function sw(a, b) { var t = S.g[a[0]][a[1]]; S.g[a[0]][a[1]] = S.g[b[0]][b[1]]; S.g[b[0]][b[1]] = t; }
  function findMove() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (S.g[r][c].sp === 2) return [[r, c], [r, c < N - 1 ? c + 1 : c - 1]];
      var ds = [[0, 1], [1, 0]];
      for (var d = 0; d < 2; d++) { var r2 = r + ds[d][0], c2 = c + ds[d][1]; if (r2 >= N || c2 >= N) continue; sw([r, c], [r2, c2]); var ok = runs().length > 0; sw([r, c], [r2, c2]); if (ok) return [[r, c], [r2, c2]]; }
    }
    return null;
  }
  function settle() { return new Promise(function (res) { settleCb.push(res); }); }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  async function trySwap(a, b) {
    if (S.busy || S.over) return;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, '2min'); if (window.SC) SC.post('start', { game: GAME }); }
    S.busy = true; S.sel = null; S.hint = null;
    sw(a, b); K.beep(520, 0.03, 'sine', 0.03); await settle();
    var ga = S.g[a[0]][a[1]], gb = S.g[b[0]][b[1]], clear = null;
    if (ga.sp === 2 || gb.sp === 2) {
      clear = {}; var rb = ga.sp === 2 ? a : b, other = ga.sp === 2 ? gb : ga;
      clear[rb[0] * N + rb[1]] = 1;
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (other.sp === 2 || S.g[r][c].k === other.k) clear[r * N + c] = 1;
      K.beep(900, 0.3, 'triangle', 0.06, 1800);
      await resolve(clear, []);
    } else if (!runs().length) {
      sw(a, b); K.beep(180, 0.08, 'square', 0.03); await settle();
    } else await resolve(null, [a, b]);
    S.chain = 0; $('combo').textContent = '';
    if (!S.over && !findMove()) { K.toast(L('沒有可以走的步了，重新洗牌', 'No moves left — shuffling'), 1500); await shuffle(); }
    S.busy = false; S.idle = performance.now();
    if (S.timeUp) gameOver();
  }
  async function resolve(pre, swapped) {
    var first = true;
    while (true) {
      var clear = pre || {}, make = [];
      if (!pre) {
        var rs = runs(); if (!rs.length) break;
        var cnt = {};
        rs.forEach(function (run) {
          run.forEach(function (p) { clear[p[0] * N + p[1]] = 1; cnt[p[0] * N + p[1]] = (cnt[p[0] * N + p[1]] || 0) + 1; });
          if (run.length >= 4) {
            var at = run[(run.length / 2) | 0]; if (first) swapped.forEach(function (s) { run.forEach(function (p) { if (p[0] === s[0] && p[1] === s[1]) at = p; }); });
            make.push({ p: at, sp: run.length >= 5 ? 2 : 1, k: S.g[run[0][0]][run[0][1]].k });
          }
        });
        Object.keys(cnt).forEach(function (key) { if (cnt[key] > 1 && !make.some(function (m) { return m.p[0] * N + m.p[1] === +key; })) make.push({ p: [(key / N) | 0, key % N], sp: 1, k: S.g[(key / N) | 0][key % N].k }); });
      }
      pre = null; first = false; S.chain++; S.best = Math.max(S.best, S.chain);
      // 炸彈連帶
      var changed = true;
      while (changed) { changed = false; Object.keys(clear).forEach(function (key) { var r = (key / N) | 0, c = key % N, g = S.g[r][c]; if (g && g.sp === 1 && !g.boom) { g.boom = 1; changed = true; S.fx.push({ x: c, y: r, t: 0.35 }); for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { var R = r + dr, C = c + dc; if (R >= 0 && C >= 0 && R < N && C < N) clear[R * N + C] = 1; } } }); }
      make.forEach(function (m) { delete clear[m.p[0] * N + m.p[1]]; });
      var n = Object.keys(clear).length;
      S.score += (n * 10 + make.length * 30) * S.chain; hud();
      if (S.chain >= 2) { $('combo').textContent = L('連鎖 ×', 'Chain ×') + S.chain; }
      K.beep(500 + S.chain * 90, 0.07, 'triangle', 0.045); navigator.vibrate && navigator.vibrate(10);
      Object.keys(clear).forEach(function (key) { S.g[(key / N) | 0][key % N].pop = 0.0001; });
      await wait(170);
      Object.keys(clear).forEach(function (key) { S.g[(key / N) | 0][key % N] = null; });
      make.forEach(function (m) { var g = S.g[m.p[0]][m.p[1]]; g.sp = m.sp; g.k = m.k; g.pop = 0; });
      gravity(); await settle();
    }
  }
  function gravity() {
    for (var c = 0; c < N; c++) {
      var w = N - 1;
      for (var r = N - 1; r >= 0; r--) if (S.g[r][c]) { var g = S.g[r][c]; S.g[r][c] = null; S.g[w][c] = g; w--; }
      for (var k = w, n = 1; k >= 0; k--, n++) { var ng = gem((Math.random() * 6) | 0, 0, -n); ng.x = c; S.g[k][c] = ng; }
    }
  }
  async function shuffle() {
    var all = []; S.g.forEach(function (row) { row.forEach(function (g) { all.push(g); }); });
    do { K.shuffle(all); for (var i = 0; i < 64; i++) S.g[(i / N) | 0][i % N] = all[i]; } while (runs().length || !findMove());
    await settle();
  }
  function gameOver() {
    if (S.over) return; S.over = true; S.sel = null;
    var best = K.load('scjewel_best', 0), nb = S.score > best; if (nb) K.save('scjewel_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endChain').textContent = '×' + S.best;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    K.beep(523, 0.6, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: '2min', score: S.score, text: L('最大連鎖 ×', 'Best chain ×') + S.best }); }, 500);
  }

  // ---------- 畫面 ----------
  function loop(t) {
    var dt = Math.min(0.05, (t - last) / 1000); last = t, moving = false;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var g = S.g[r][c]; if (!g) continue;
      var sp = 14 * dt;
      if (g.x !== c) { moving = true; g.x += Math.sign(c - g.x) * Math.min(Math.abs(c - g.x), sp * 0.7); }
      if (g.y !== r) { moving = true; g.y += Math.sign(r - g.y) * Math.min(Math.abs(r - g.y), sp); }
      if (g.pop) g.pop = Math.min(1, g.pop + dt * 6);
    }
    if (!moving && settleCb.length) { var cb = settleCb; settleCb = []; cb.forEach(function (f) { f(); }); }
    S.fx.forEach(function (f) { f.t -= dt; }); S.fx = S.fx.filter(function (f) { return f.t > 0; });
    if (S.started && !S.over) {
      var left = Math.max(0, LIMIT - (Date.now() - S.t0) / 1000);
      $('clock').textContent = K.fmtTime(Math.ceil(left)); $('tfill').style.width = (left / LIMIT * 100) + '%';
      if (left <= 0 && !S.timeUp) { S.timeUp = true; if (!S.busy) gameOver(); }
    }
    if (!S.busy && !S.over && !S.hint && t - S.idle > 6000) S.hint = findMove();
    draw(t); raf = requestAnimationFrame(loop);
  }
  var moving = false;
  function shape(k, x, y, s) {
    ctx.beginPath();
    if (k === 0) { ctx.arc(x, y, s, 0, 7); }
    else if (k === 1) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); }
    else if (k === 2) { var q = s * 0.82; ctx.moveTo(x - q, y - q + 6); ctx.arcTo(x - q, y - q, x + q, y - q, 8); ctx.arcTo(x + q, y - q, x + q, y + q, 8); ctx.arcTo(x + q, y + q, x - q, y + q, 8); ctx.arcTo(x - q, y + q, x - q, y - q, 8); }
    else if (k === 3) { ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.95, y + s * 0.75); ctx.lineTo(x - s * 0.95, y + s * 0.75); }
    else if (k === 4) { for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } }
    else { for (i = 0; i < 10; i++) { a = Math.PI / 5 * i - Math.PI / 2; var rr = i % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } }
    ctx.closePath();
  }
  function draw(t) {
    ctx.clearRect(0, 0, 640, 640);
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.07)'; ctx.fillRect(c * CS, r * CS, CS, CS); }
    if (S.sel) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4; ctx.strokeRect(S.sel[1] * CS + 3, S.sel[0] * CS + 3, CS - 6, CS - 6); }
    if (S.hint) { var a = 0.4 + 0.4 * Math.sin(t / 180); ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 3; S.hint.forEach(function (p) { ctx.strokeRect(p[1] * CS + 6, p[0] * CS + 6, CS - 12, CS - 12); }); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 640, 640); ctx.clip();
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
      var g = S.g[r][c]; if (!g) continue;
      var x = g.x * CS + CS / 2, y = g.y * CS + CS / 2, s = CS * 0.36 * (1 - (g.pop || 0));
      if (s <= 0.5) continue;
      if (g.sp === 2) {
        var gr = ctx.createConicGradient ? ctx.createConicGradient(t / 600, x, y) : null;
        if (gr) { ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'].forEach(function (cc, i) { gr.addColorStop(i / 5, cc); }); ctx.fillStyle = gr; } else ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, 7); ctx.fill(); continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; shape(g.k, x + 2, y + 4, s); ctx.fill();
      var lg = ctx.createLinearGradient(x - s, y - s, x + s, y + s); lg.addColorStop(0, '#fff'); lg.addColorStop(0.3, COL[g.k]); lg.addColorStop(1, COL[g.k]);
      ctx.fillStyle = lg; shape(g.k, x, y, s); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke();
      if (g.sp === 1) { ctx.font = Math.round(s * 1.0) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💣', x, y + 2); }
    }
    ctx.restore();
    S.fx.forEach(function (f) { ctx.fillStyle = 'rgba(253,224,71,' + f.t * 2 + ')'; ctx.beginPath(); ctx.arc(f.x * CS + CS / 2, f.y * CS + CS / 2, CS * (1.8 - f.t * 3), 0, 7); ctx.fill(); });
  }

  // ---------- 輸入 ----------
  function cell(e) { var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * N, y = (e.clientY - r.top) / r.height * N; return { r: Math.floor(y), c: Math.floor(x), fx: x, fy: y }; }
  var down = null;
  cv.addEventListener('pointerdown', function (e) {
    if (!S || S.busy || S.over) return; var p = cell(e); if (p.r < 0 || p.c < 0 || p.r >= N || p.c >= N) return;
    down = p; S.idle = performance.now(); S.hint = null;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', function (e) {
    if (!down) return; var p = cell(e), dx = p.fx - down.fx, dy = p.fy - down.fy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.4) return;
    var d = down; down = null;
    var to = Math.abs(dx) > Math.abs(dy) ? [d.r, d.c + (dx > 0 ? 1 : -1)] : [d.r + (dy > 0 ? 1 : -1), d.c];
    if (to[0] >= 0 && to[1] >= 0 && to[0] < N && to[1] < N) trySwap([d.r, d.c], to);
  });
  cv.addEventListener('pointerup', function () {
    if (!down) return; var d = down; down = null;
    if (S.sel && Math.abs(S.sel[0] - d.r) + Math.abs(S.sel[1] - d.c) === 1) trySwap(S.sel, [d.r, d.c]);
    else { S.sel = S.sel && S.sel[0] === d.r && S.sel[1] === d.c ? null : [d.r, d.c]; K.beep(700, 0.02, 'sine', 0.02); }
  });
  $('bNew').onclick = function () {
    if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; }
    if (S && S.busy && !S.over) return; newGame();
  };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (location.hash.indexOf('#test') === 0) window.__jw = { S: function () { return S; }, move: function () { var m = findMove(); if (m) trySwap(m[0], m[1]); return !!m; }, end: function () { S.t0 = Date.now() - LIMIT * 1000; } };
  newGame();
})();
