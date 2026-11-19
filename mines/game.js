/* 踩地雷 — stockcorp.github.io/mines/
   初級 9×9/10、中級 16×16/40、高級 16×30/99（直式手機自動轉成直的）。第一下保證周圍 3×3 沒有雷。
   排行榜：mode = easy/normal/hard，時間由伺服器計算（越短越好）。 */
(function () {
  'use strict';
  var GAME = 'mines', $ = K.$, L = K.L;
  var LV = { easy: { zh: '初級', en: 'Beginner', w: 9, h: 9, m: 10 }, normal: { zh: '中級', en: 'Intermediate', w: 16, h: 16, m: 40 }, hard: { zh: '高級', en: 'Expert', w: 30, h: 16, m: 99 } };
  var NUMC = ['', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0891b2', '#111827', '#6b7280'];
  var cv = $('cv'), ctx = cv.getContext('2d'), cs = 30, S = null, tick = null, flagMode = false;

  function newGame(lv) {
    var c = LV[lv], portrait = window.innerWidth < window.innerHeight && c.w > c.h;
    var W = portrait ? c.h : c.w, H = portrait ? c.w : c.h;
    S = { lv: lv, W: W, H: H, M: c.m, mine: new Uint8Array(W * H), open: new Uint8Array(W * H), flag: new Uint8Array(W * H), num: new Uint8Array(W * H), started: false, over: false, win: false, t0: 0, boom: -1, opened: 0 };
    clearInterval(tick); $('clock').textContent = '0:00';
    $('bLb').href = '/leaderboard/?game=mines&mode=' + lv;
    resize(); hud();
  }
  function nb(i) { var x = i % S.W, y = (i / S.W) | 0, o = []; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; var X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S.W && Y < S.H) o.push(Y * S.W + X); } return o; }
  function plant(safe) {
    var ban = {}; ban[safe] = 1; nb(safe).forEach(function (j) { ban[j] = 1; });
    var cells = []; for (var i = 0; i < S.W * S.H; i++) if (!ban[i]) cells.push(i);
    K.shuffle(cells).slice(0, S.M).forEach(function (i) { S.mine[i] = 1; });
    for (var k = 0; k < S.W * S.H; k++) S.num[k] = nb(k).reduce(function (a, j) { return a + S.mine[j]; }, 0);
    S.started = true; S.t0 = Date.now();
    tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500);
    if (window.SCLB) SCLB.start(GAME, S.lv);
    if (window.SC) SC.post('start', { game: GAME, level: S.lv });
  }
  function open(i) {
    if (S.over || S.flag[i] || S.open[i]) return;
    if (!S.started) plant(i);
    if (S.mine[i]) { S.boom = i; return lose(); }
    // 空白格往外擴散
    var q = [i];
    while (q.length) {
      var c = q.pop(); if (S.open[c] || S.flag[c]) continue;
      S.open[c] = 1; S.opened++;
      if (!S.num[c]) nb(c).forEach(function (j) { if (!S.open[j] && !S.mine[j]) q.push(j); });
    }
    K.beep(600, 0.03, 'triangle', 0.03);
    if (S.opened === S.W * S.H - S.M) win();
  }
  function chord(i) {
    if (!S.open[i] || !S.num[i]) return;
    var ns = nb(i), f = ns.filter(function (j) { return S.flag[j]; }).length;
    if (f === S.num[i]) ns.forEach(function (j) { if (!S.flag[j] && !S.open[j]) open(j); });
  }
  function toggleFlag(i) {
    if (S.over || S.open[i]) return;
    S.flag[i] ^= 1; K.beep(S.flag[i] ? 880 : 440, 0.04, 'sine', 0.03); navigator.vibrate && navigator.vibrate(15); hud();
  }
  function lose() {
    S.over = true; clearInterval(tick);
    for (var i = 0; i < S.W * S.H; i++) if (S.mine[i]) S.open[i] = 1;
    K.beep(110, 0.6, 'sawtooth', 0.08, 40); navigator.vibrate && navigator.vibrate([80, 40, 120]);
    draw(); K.toast(L('踩到地雷了！', 'Boom! You hit a mine.'), 2500);
    if (window.SC) SC.post('gameover', { game: GAME, win: false });
  }
  function win() {
    S.over = true; S.win = true; clearInterval(tick);
    for (var i = 0; i < S.W * S.H; i++) if (S.mine[i]) S.flag[i] = 1;
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scmines_best', {}), nb2 = !best[S.lv] || t < best[S.lv];
    if (nb2) { best[S.lv] = t; K.save('scmines_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endLv').textContent = L(LV[S.lv].zh, LV[S.lv].en);
    $('endBest').textContent = nb2 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.lv]);
    K.beep(523, 0.5, 'triangle', 0.07, 1046); draw(); hud();
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: L(LV[S.lv].zh, LV[S.lv].en) + ' ' + K.fmtTime(sec) }); } }, 500);
  }

  // ---------- 畫面 ----------
  function resize() {
    var avW = Math.min(window.innerWidth - 24, 960), avH = Math.max(320, window.innerHeight - 200);
    cs = Math.floor(Math.max(20, Math.min(40, avW / S.W, avH / S.H)));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = S.W * cs * dpr; cv.height = S.H * cs * dpr; cv.style.width = S.W * cs + 'px'; cv.style.height = S.H * cs + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function draw() {
    ctx.font = 'bold ' + Math.floor(cs * 0.6) + 'px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < S.W * S.H; i++) {
      var x = (i % S.W) * cs, y = ((i / S.W) | 0) * cs;
      if (S.open[i]) {
        ctx.fillStyle = i === S.boom ? '#ef4444' : '#dbe3ec'; ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = '#b8c4d2'; ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        if (S.mine[i]) { ctx.font = Math.floor(cs * 0.62) + 'px serif'; ctx.fillText('💣', x + cs / 2, y + cs / 2 + 1); ctx.font = 'bold ' + Math.floor(cs * 0.6) + 'px ui-rounded,system-ui,sans-serif'; }
        else if (S.num[i]) { ctx.fillStyle = NUMC[S.num[i]]; ctx.fillText(S.num[i], x + cs / 2, y + cs / 2 + 1); }
      } else {
        var g = ctx.createLinearGradient(x, y, x, y + cs); g.addColorStop(0, '#7c93b0'); g.addColorStop(1, '#5a7193');
        ctx.fillStyle = g; ctx.fillRect(x, y, cs, cs);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, cs, 2); ctx.fillRect(x, y, 2, cs);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + cs - 2, cs, 2); ctx.fillRect(x + cs - 2, y, 2, cs);
        if (S.flag[i]) { ctx.font = Math.floor(cs * 0.6) + 'px serif'; ctx.fillText('🚩', x + cs / 2, y + cs / 2 + 1); ctx.font = 'bold ' + Math.floor(cs * 0.6) + 'px ui-rounded,system-ui,sans-serif'; }
      }
      if (S.over && !S.win && S.flag[i] && !S.mine[i]) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + cs - 4, y + cs - 4); ctx.stroke(); ctx.lineWidth = 1; }
    }
  }
  function hud() {
    var f = 0; for (var i = 0; i < S.W * S.H; i++) f += S.flag[i];
    $('left').textContent = S.M - f; draw();
  }

  // ---------- 輸入 ----------
  function cellAt(e) { var r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / cs), y = Math.floor((e.clientY - r.top) / cs); return x < 0 || y < 0 || x >= S.W || y >= S.H ? -1 : y * S.W + x; }
  var press = null;
  cv.addEventListener('pointerdown', function (e) {
    if (e.button === 2) return;
    var i = cellAt(e); if (i < 0) return;
    press = { i: i, t: Date.now(), long: false };
    press.timer = setTimeout(function () { if (press && press.i === i) { press.long = true; toggleFlag(i); } }, 420);
  });
  cv.addEventListener('pointerup', function (e) {
    if (!press) return; clearTimeout(press.timer);
    var p = press; press = null; if (p.long) return;
    var i = cellAt(e); if (i !== p.i || S.over) return;
    if (S.open[i]) chord(i); else if (flagMode) toggleFlag(i); else open(i);
    if (!S.over) hud(); else draw();
  });
  cv.addEventListener('pointerleave', function () { if (press) { clearTimeout(press.timer); press = null; } });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); var i = cellAt(e); if (i >= 0) toggleFlag(i); });
  $('bFlag').onclick = function () { flagMode = !flagMode; this.classList.toggle('on', flagMode); $('flagOn').textContent = flagMode ? 'ON' : 'OFF'; };
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = ''; var best = K.load('scmines_best', {});
    Object.keys(LV).forEach(function (k) { var c = LV[k], b = document.createElement('button'); b.innerHTML = L(c.zh, c.en) + '<small>' + c.w + '×' + c.h + '・' + c.m + L(' 雷', ' mines') + (best[k] ? '・' + K.fmtTime(best[k]) : '') + '</small>'; b.onclick = function () { K.close('ovNew'); K.close('ovEnd'); newGame(k); }; ch.appendChild(b); });
    K.open('ovNew');
  }
  $('bNew').onclick = openNew;
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.lv); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', function () { if (S) resize(); });
  if (location.hash.indexOf('#test') === 0) window.__mines = { S: function () { return S; }, open: open, flag: toggleFlag };
  newGame('easy');
})();
