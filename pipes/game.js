/* 接水管 — stockcorp.github.io/pipes/
   以中央為水源做隨機生成樹（每格的開口＝樹上的連線），再把每格隨機旋轉。全部接通且沒有開口就贏。
   開口用位元：1 上、2 右、4 下、8 左。排行榜：mode = easy/normal/hard（5/7/9），解題時間（伺服器計時）。 */
(function () {
  'use strict';
  var GAME = 'pipes', $ = K.$, L = K.L, SZ = { easy: 5, normal: 7, hard: 9 };
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, tick = null, size = 400;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  function rot(m, k) { for (var i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15; return m; }
  function gen(n) {
    var src = ((n / 2) | 0) * n + ((n / 2) | 0), m = new Array(n * n).fill(0), inT = {}; inT[src] = 1;
    var front = [src];
    while (front.length) {
      // 隨機挑一個邊界格往外長；偏好讓分支少一點、長一點
      var idx = Math.random() < 0.6 ? front.length - 1 : (Math.random() * front.length) | 0, c = front[idx], x = c % n, y = (c / n) | 0;
      var opts = [];
      for (var d = 0; d < 4; d++) { var X = x + DX[d], Y = y + DY[d], j = Y * n + X; if (X >= 0 && Y >= 0 && X < n && Y < n && !inT[j]) opts.push([d, j]); }
      var deg = 0; for (d = 0; d < 4; d++) if (m[c] & (1 << d)) deg++;
      if (!opts.length || deg >= 3) { front.splice(idx, 1); continue; }
      var o = opts[(Math.random() * opts.length) | 0];
      m[c] |= 1 << o[0]; m[o[1]] |= 1 << ((o[0] + 2) % 4); inT[o[1]] = 1; front.push(o[1]);
    }
    // 若有格子沒長到（被 deg 限制），強制接上
    for (var guard = 0; guard < 4 && Object.keys(inT).length < n * n; guard++) for (var c2 = 0; c2 < n * n; c2++) { if (inT[c2]) continue; var x2 = c2 % n, y2 = (c2 / n) | 0; for (var d2 = 0; d2 < 4; d2++) { var X2 = x2 + DX[d2], Y2 = y2 + DY[d2], k = Y2 * n + X2; if (X2 >= 0 && Y2 >= 0 && X2 < n && Y2 < n && inT[k]) { m[c2] |= 1 << d2; m[k] |= 1 << ((d2 + 2) % 4); inT[c2] = 1; break; } } }
    return { m: m, src: src };
  }
  function newGame(lv) {
    lv = lv || 'easy'; var n = SZ[lv], g = gen(n);
    var cur = g.m.map(function (v) { return rot(v, (Math.random() * 4) | 0); });
    S = { lv: lv, n: n, sol: g.m, m: cur, src: g.src, taps: 0, started: false, over: false, t0: 0 };
    if (flow().all) return newGame(lv);
    clearInterval(tick); $('clock').textContent = '0:00'; $('taps').textContent = 0; K.close('ovEnd'); K.save('scpipes_lv', lv);
    $('bLb').href = '/leaderboard/?game=pipes&mode=' + lv; $('sub').textContent = n + '×' + n;
    resize();
  }
  function flow() {
    var n = S.n, wet = {}, q = [S.src], leak = false; wet[S.src] = 1;
    while (q.length) {
      var c = q.pop(), x = c % n, y = (c / n) | 0;
      for (var d = 0; d < 4; d++) {
        if (!(S.m[c] & (1 << d))) continue;
        var X = x + DX[d], Y = y + DY[d];
        if (X < 0 || Y < 0 || X >= n || Y >= n) { leak = true; continue; }
        var j = Y * n + X;
        if (!(S.m[j] & (1 << ((d + 2) % 4)))) { leak = true; continue; }
        if (!wet[j]) { wet[j] = 1; q.push(j); }
      }
    }
    var cnt = Object.keys(wet).length;
    return { wet: wet, cnt: cnt, all: cnt === n * n && !leak };
  }
  function resize() { var w = Math.min(window.innerWidth - 20, 560, Math.max(280, window.innerHeight - 190)), dpr = Math.min(2, window.devicePixelRatio || 1); size = w; cv.width = w * dpr; cv.height = w * dpr; cv.style.width = w + 'px'; cv.style.height = w + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  function draw() {
    var n = S.n, cs = size / n, f = flow();
    ctx.fillStyle = '#0b2333'; ctx.fillRect(0, 0, size, size);
    for (var i = 0; i < n * n; i++) {
      var x = (i % n) * cs, y = ((i / n) | 0) * cs, cx = x + cs / 2, cy = y + cs / 2, w = f.wet[i];
      ctx.fillStyle = (i % n + ((i / n) | 0)) % 2 ? '#0e2b3f' : '#10324a'; ctx.fillRect(x, y, cs, cs);
      ctx.lineCap = 'round';
      [[cs * 0.3, w ? '#075985' : '#334155'], [cs * 0.18, w ? '#38bdf8' : '#94a3b8']].forEach(function (st) {
        ctx.strokeStyle = st[1]; ctx.lineWidth = st[0]; ctx.beginPath();
        for (var d = 0; d < 4; d++) if (S.m[i] & (1 << d)) { ctx.moveTo(cx, cy); ctx.lineTo(cx + DX[d] * cs / 2, cy + DY[d] * cs / 2); }
        ctx.stroke();
        var deg = 0; for (d = 0; d < 4; d++) if (S.m[i] & (1 << d)) deg++;
        if (deg === 1) { ctx.fillStyle = st[1]; ctx.beginPath(); ctx.arc(cx, cy, st[0] * 0.9, 0, 7); ctx.fill(); }
      });
      if (i === S.src) { ctx.font = Math.round(cs * 0.5) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💧', cx, cy + 1); }
    }
    $('conn').textContent = Math.round(f.cnt / (n * n) * 100);
    return f;
  }
  function tap(e, back) {
    if (!S || S.over) return;
    var r = cv.getBoundingClientRect(), n = S.n, x = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, S.lv); if (window.SC) SC.post('start', { game: GAME, level: S.lv }); tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
    var i = y * n + x; S.m[i] = rot(S.m[i], back ? 3 : 1); S.taps++; $('taps').textContent = S.taps;
    K.beep(560, 0.025, 'triangle', 0.03); if (K.at) K.burst(K.at, { n: 4, c: ['#7dd3fc', '#fff'], size: 3, sp: 80, life: 0.3, g: 0 });
    if (draw().all) win();
  }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scpipes_best', {}), nb = !best[S.lv] || t < best[S.lv];
    if (nb) { best[S.lv] = t; K.save('scpipes_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endTaps').textContent = S.taps;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.lv]);
    K.tune([523, 659, 784, 1047, 1319], 95); K.burst(cv, { n: 46, c: ['#38bdf8', '#7dd3fc', '#fff'], size: 6, sp: 320, g: 500 });
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: S.n + '×' + S.n + ' ' + K.fmtTime(sec) }); } }, 600);
  }
  cv.addEventListener('click', function (e) { tap(e, false); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); tap(e, true); });
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.lv); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__pp = { S: function () { return S; }, solve: function () { S.m = S.sol.slice(); if (!S.started) { S.started = true; S.t0 = Date.now(); } if (draw().all) win(); } };
  newGame(K.load('scpipes_lv', 'easy'));
})();
