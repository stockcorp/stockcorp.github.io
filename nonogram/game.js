/* 數織 — stockcorp.github.io/nonogram/
   隨機產生題目，再用「逐行推理」求解器確認只靠邏輯就能完全解開（因此答案唯一）。
   排行榜：mode = 5x5/10x10/15x15，解題時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'nonogram', $ = K.$, L = K.L;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, tick = null, mode = 1, hist = [];

  function clues(line) { var out = [], run = 0; line.forEach(function (v) { if (v) run++; else if (run) { out.push(run); run = 0; } }); if (run) out.push(run); return out.length ? out : [0]; }
  // 單行推理：cells 值 -1 未知 / 0 空 / 1 塗；回傳新陣列，矛盾時回傳 null
  function solveLine(cl, cells) {
    var n = cells.length, c = cl[0] === 0 ? [] : cl, k = c.length;
    var memo = {}, canF = new Array(n).fill(false), canE = new Array(n).fill(false);
    function ok(i, j) { // 從位置 i 開始放第 j 段起能否完成
      var key = i * 64 + j; if (key in memo) return memo[key];
      var r = false;
      if (j === k) { r = true; for (var x = i; x < n; x++) if (cells[x] === 1) { r = false; break; } }
      else {
        // 這格空白
        if (i < n && cells[i] !== 1 && ok(i + 1, j)) r = true;
        // 從這格放第 j 段
        var len = c[j];
        if (i + len <= n) { var fit = true; for (var y = i; y < i + len; y++) if (cells[y] === 0) { fit = false; break; } if (fit && (i + len === n || cells[i + len] !== 1) && ok(Math.min(n, i + len + 1), j + 1)) r = true; }
      }
      memo[key] = r; return r;
    }
    if (!ok(0, 0)) return null;
    // 再走一次標記每格可能值
    var seen = {};
    function mark(i, j) {
      var key = i * 64 + j; if (seen[key]) return; seen[key] = 1;
      if (j === k) { for (var x = i; x < n; x++) canE[x] = true; return; }
      if (i < n && cells[i] !== 1 && ok(i + 1, j)) { canE[i] = true; mark(i + 1, j); }
      var len = c[j];
      if (i + len <= n) { var fit = true; for (var y = i; y < i + len; y++) if (cells[y] === 0) { fit = false; break; } if (fit && (i + len === n || cells[i + len] !== 1) && ok(Math.min(n, i + len + 1), j + 1)) { for (y = i; y < i + len; y++) canF[y] = true; if (i + len < n) canE[i + len] = true; mark(Math.min(n, i + len + 1), j + 1); } }
    }
    mark(0, 0);
    return cells.map(function (v, x) { return canF[x] && !canE[x] ? 1 : canE[x] && !canF[x] ? 0 : v; });
  }
  function logicSolvable(W, H, rc, cc) {
    var g = new Array(W * H).fill(-1), changed = true, guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      for (var r = 0; r < H; r++) { var line = g.slice(r * W, r * W + W), nl = solveLine(rc[r], line); if (!nl) return false; for (var x = 0; x < W; x++) if (nl[x] !== line[x]) { g[r * W + x] = nl[x]; changed = true; } }
      for (var c = 0; c < W; c++) { var col = []; for (var y = 0; y < H; y++) col.push(g[y * W + c]); var nc = solveLine(cc[c], col); if (!nc) return false; for (y = 0; y < H; y++) if (nc[y] !== col[y]) { g[y * W + c] = nc[y]; changed = true; } }
    }
    return g.every(function (v) { return v >= 0; });
  }
  function generate(n) {
    for (var tries = 0; tries < 400; tries++) {
      var dens = 0.52 + Math.random() * 0.12, sol = [];
      for (var i = 0; i < n * n; i++) sol.push(Math.random() < dens ? 1 : 0);
      // 稍微平滑，讓圖案比較成塊
      if (n > 5) for (var p = 0; p < n * n; p++) { var r = (p / n) | 0, c = p % n, cnt = 0, tot = 0; for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { var R = r + dr, C = c + dc; if (R >= 0 && C >= 0 && R < n && C < n) { tot++; cnt += sol[R * n + C]; } } if (Math.random() < 0.35) sol[p] = cnt * 2 > tot ? 1 : 0; }
      var rc = [], cc = [];
      for (r = 0; r < n; r++) rc.push(clues(sol.slice(r * n, r * n + n)));
      for (c = 0; c < n; c++) { var col = []; for (r = 0; r < n; r++) col.push(sol[r * n + c]); cc.push(clues(col)); }
      if (logicSolvable(n, n, rc, cc)) return { sol: sol, rc: rc, cc: cc };
    }
    return null;
  }

  function newGame(sz) {
    sz = sz || '10x10'; var n = parseInt(sz, 10), p = generate(n);
    if (!p) return newGame(sz);
    S = { sz: sz, n: n, sol: p.sol, rc: p.rc, cc: p.cc, g: new Array(n * n).fill(0), started: false, over: false, t0: 0 };
    hist = []; clearInterval(tick); $('clock').textContent = '0:00'; K.close('ovEnd'); K.save('scnono_sz', sz);
    $('bLb').href = '/leaderboard/?game=nonogram&mode=' + sz; $('sub').textContent = sz.replace('x', '×');
    resize();
  }
  // g：0 空白、1 塗黑、2 打叉
  var geo = {};
  function resize() {
    if (!S) return;
    var n = S.n, mr = Math.max.apply(null, S.rc.map(function (x) { return x.length; })), mc = Math.max.apply(null, S.cc.map(function (x) { return x.length; }));
    var avW = Math.min(window.innerWidth - 20, 740), avH = Math.max(320, window.innerHeight - 190);
    var cs = Math.floor(Math.min(avW / (n + mr * 0.62), avH / (n + mc * 0.72), 44));
    var lw = Math.ceil(mr * cs * 0.62) + 6, th = Math.ceil(mc * cs * 0.72) + 6;
    geo = { cs: cs, lw: lw, th: th, W: lw + n * cs + 2, H: th + n * cs + 2 };
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = geo.W * dpr; cv.height = geo.H * dpr; cv.style.width = geo.W + 'px'; cv.style.height = geo.H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function lineDone(cl, cells) { return clues(cells.map(function (v) { return v === 1 ? 1 : 0; })).join(',') === cl.join(','); }
  function draw() {
    var n = S.n, cs = geo.cs, ox = geo.lw, oy = geo.th;
    ctx.fillStyle = '#f5f3ff'; ctx.fillRect(0, 0, geo.W, geo.H);
    ctx.fillStyle = '#ede9fe'; ctx.fillRect(0, 0, ox, geo.H); ctx.fillRect(0, 0, geo.W, oy);
    ctx.textBaseline = 'middle';
    for (var r = 0; r < n; r++) {
      var row = S.g.slice(r * n, r * n + n), done = lineDone(S.rc[r], row);
      ctx.fillStyle = done ? '#a78bfa' : '#1e1b4b'; ctx.font = 'bold ' + Math.round(cs * 0.48) + 'px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(S.rc[r].join('  '), ox - 6, oy + r * cs + cs / 2 + 1);
    }
    for (var c = 0; c < n; c++) {
      var col = []; for (r = 0; r < n; r++) col.push(S.g[r * n + c]);
      var dn = lineDone(S.cc[c], col); ctx.fillStyle = dn ? '#a78bfa' : '#1e1b4b'; ctx.textAlign = 'center';
      S.cc[c].forEach(function (v, i, a) { ctx.fillText(v, ox + c * cs + cs / 2, oy - 6 - (a.length - 1 - i) * cs * 0.72 - cs * 0.3); });
    }
    for (var i = 0; i < n * n; i++) {
      var x = ox + (i % n) * cs, y = oy + ((i / n) | 0) * cs, v = S.g[i];
      ctx.fillStyle = v === 1 ? '#312e81' : '#fff'; ctx.fillRect(x, y, cs, cs);
      if (v === 2) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + cs * 0.28, y + cs * 0.28); ctx.lineTo(x + cs * 0.72, y + cs * 0.72); ctx.moveTo(x + cs * 0.72, y + cs * 0.28); ctx.lineTo(x + cs * 0.28, y + cs * 0.72); ctx.stroke(); }
    }
    for (var k = 0; k <= n; k++) {
      ctx.strokeStyle = k % 5 === 0 ? '#4c1d95' : '#c4b5fd'; ctx.lineWidth = k % 5 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(ox + k * cs, oy); ctx.lineTo(ox + k * cs, oy + n * cs); ctx.moveTo(ox, oy + k * cs); ctx.lineTo(ox + n * cs, oy + k * cs); ctx.stroke();
    }
  }
  function cellAt(e) { var r = cv.getBoundingClientRect(), x = e.clientX - r.left - geo.lw, y = e.clientY - r.top - geo.th; if (x < 0 || y < 0) return -1; var c = Math.floor(x / geo.cs), rr = Math.floor(y / geo.cs); return c < S.n && rr < S.n ? rr * S.n + c : -1; }
  var paint = null;
  cv.addEventListener('pointerdown', function (e) {
    if (!S || S.over) return; var i = cellAt(e); if (i < 0) return;
    var m = e.button === 2 ? 2 : mode, to = S.g[i] === m ? 0 : m;
    hist.push(S.g.slice()); paint = { to: to }; set(i, to);
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', function (e) { if (!paint) return; var i = cellAt(e); if (i >= 0 && S.g[i] !== paint.to) set(i, paint.to); });
  cv.addEventListener('pointerup', function () { if (paint) { paint = null; check(true); } });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  function set(i, v) {
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, S.sz); if (window.SC) SC.post('start', { game: GAME, level: S.sz }); tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
    S.g[i] = v; K.beep(v === 1 ? 520 : v === 2 ? 380 : 300, 0.02, 'sine', 0.02); if (v === 1 && K.at) K.burst(K.at, { n: 2, c: ['#a78bfa', '#fff'], size: 2.5, sp: 60, life: 0.25, g: 0 }); draw();
  }
  function check(auto) {
    var n = S.n;
    for (var r = 0; r < n; r++) if (!lineDone(S.rc[r], S.g.slice(r * n, r * n + n))) { if (!auto) K.toast(L('還沒完成', 'Not solved yet'), 1000); return; }
    for (var c = 0; c < n; c++) { var col = []; for (r = 0; r < n; r++) col.push(S.g[r * n + c]); if (!lineDone(S.cc[c], col)) { if (!auto) K.toast(L('還沒完成', 'Not solved yet'), 1000); return; } }
    win();
  }
  function win() {
    S.over = true; clearInterval(tick);
    for (var i = 0; i < S.g.length; i++) if (S.g[i] === 2) S.g[i] = 0; draw();
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scnono_best', {}), nb = !best[S.sz] || t < best[S.sz];
    if (nb) { best[S.sz] = t; K.save('scnono_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endSize').textContent = S.sz.replace('x', '×');
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.sz]);
    K.tune([523, 659, 784, 1047, 1319], 95);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.sz, score: sec, text: S.sz.replace('x', '×') + ' ' + K.fmtTime(sec) }); } }, 600);
  }
  $('bMode').onclick = function () { mode = mode === 1 ? 2 : 1; this.classList.toggle('x', mode === 2); this.innerHTML = mode === 1 ? '⬛ <span>' + L('塗黑', 'Fill') + '</span>' : '✕ <span>' + L('打叉', 'Mark ✕') + '</span>'; };
  $('bUndo').onclick = function () { if (!S || S.over || !hist.length) return; S.g = hist.pop(); draw(); };
  $('bCheck').onclick = function () { if (S && !S.over) check(false); };
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.sz); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__nn = { line: solveLine, S: function () { return S; }, solve: function () { S.g = S.sol.slice(); check(true); }, gen: generate, newGame: newGame };
  newGame(K.load('scnono_sz', '10x10'));
})();
