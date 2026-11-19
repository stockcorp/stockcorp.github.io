/* 五子棋 — stockcorp.github.io/gomoku/
   15×15、自由規則（五連以上勝、無禁手）。對電腦：簡單/普通/困難；線上：SCNet 隨機配對或房號（每局交換先後手）。
   排行榜：擊敗電腦的時間（伺服器計時），mode = easy/normal/hard。 */
(function () {
  'use strict';
  var GAME = 'gomoku', N = 15, $ = K.$, L = K.L;
  var LV = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] };
  var cv = $('cv'), ctx = cv.getContext('2d'), size = 600, cell = 40, pad = 20;
  // S.b：0 空、1 黑、2 白；S.me：玩家的顏色；mode 'ai' 或 'net'
  var S = null, NET = null, thinking = false, pickLv = 'normal', pickCol = 1;

  // ---------- 判斷 ----------
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function at(b, x, y) { return x < 0 || y < 0 || x >= N || y >= N ? -1 : b[y * N + x]; }
  function winLine(b, i) {
    var c = b[i], x = i % N, y = Math.floor(i / N);
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1], line = [i];
      for (var k = 1; at(b, x + dx * k, y + dy * k) === c; k++) line.push((y + dy * k) * N + x + dx * k);
      for (var k2 = 1; at(b, x - dx * k2, y - dy * k2) === c; k2++) line.unshift((y - dy * k2) * N + x - dx * k2);
      if (line.length >= 5) return line;
    }
    return null;
  }

  // ---------- 電腦 ----------
  // 某點放 c 色後，每個方向的棋型分數
  function shapeScore(b, x, y, c) {
    var total = 0, fours = 0, threes = 0;
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1], cnt = 1, open = 0, gap = 0, k, v;
      // 正方向（允許中間一個空格）
      for (k = 1; k <= 5; k++) { v = at(b, x + dx * k, y + dy * k); if (v === c) cnt++; else if (v === 0 && !gap && at(b, x + dx * (k + 1), y + dy * (k + 1)) === c) gap = 1; else { if (v === 0) open++; break; } }
      for (k = 1; k <= 5; k++) { v = at(b, x - dx * k, y - dy * k); if (v === c) cnt++; else if (v === 0 && !gap && at(b, x - dx * (k + 1), y - dy * (k + 1)) === c) gap = 1; else { if (v === 0) open++; break; } }
      var s = 0;
      if (cnt >= 5 && !gap) s = 1e6;
      else if (cnt >= 5) s = 12000;           // 跳五 = 實質衝四
      else if (cnt === 4) { s = open === 2 && !gap ? 100000 : open >= 1 ? 12000 : 0; if (s) fours++; }
      else if (cnt === 3) { s = open === 2 ? (gap ? 3000 : 5000) : open === 1 ? 600 : 0; if (open === 2) threes++; }
      else if (cnt === 2) s = open === 2 ? 400 : open === 1 ? 60 : 0;
      else s = open === 2 ? 20 : open ? 4 : 0;
      total += s;
    }
    if (fours >= 2 || (fours && threes)) total += 90000;    // 雙四、四三
    else if (threes >= 2) total += 40000;                    // 雙三
    return total;
  }
  function candidates(b) {
    var out = [], seen = {}, any = false;
    for (var i = 0; i < N * N; i++) if (b[i]) {
      any = true; var x = i % N, y = Math.floor(i / N);
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var nx = x + dx, ny = y + dy, j = ny * N + nx; if (at(b, nx, ny) === 0 && !seen[j]) { seen[j] = 1; out.push(j); } }
    }
    if (!any) out.push(7 * N + 7);
    return out;
  }
  function rank(b, c, list) {
    var o = 3 - c;
    return list.map(function (i) { var x = i % N, y = Math.floor(i / N); return { i: i, a: shapeScore(b, x, y, c), d: shapeScore(b, x, y, o) }; })
      .map(function (r) { r.s = r.a * 1.1 + r.d; return r; }).sort(function (p, q) { return q.s - p.s; });
  }
  function aiMove(b, c, lv) {
    var r = rank(b, c, candidates(b));
    if (!r.length) return -1;
    // 自己能五連就下，對方能五連就擋
    var win = r.filter(function (x) { return x.a >= 1e6; })[0]; if (win) return win.i;
    var block = r.filter(function (x) { return x.d >= 1e6; })[0]; if (block) return block.i;
    if (lv === 'easy') {
      if (Math.random() < 0.3) { var rr = r.slice(0, Math.min(8, r.length)); return rr[(Math.random() * rr.length) | 0].i; }
      return r[Math.min(r.length - 1, (Math.random() * 3) | 0)].i;
    }
    if (lv === 'normal') return r[Math.random() < 0.85 ? 0 : Math.min(1, r.length - 1)].i;
    // 困難：前幾名再往下想一步（看對手最好的回應）
    var top = r.slice(0, 10), o = 3 - c, best = null;
    top.forEach(function (m) {
      b[m.i] = c;
      // 對手下一手最強的進攻（只看對手自己的棋型，不看擋我的價值）
      var cand = candidates(b), oppBest = 0, oppWin = false;
      for (var j = 0; j < cand.length; j++) { var a = shapeScore(b, cand[j] % N, Math.floor(cand[j] / N), o); if (a > oppBest) oppBest = a; if (a >= 1e6) oppWin = true; }
      b[m.i] = 0;
      var val = m.a * 1.5 + m.d - oppBest * 0.9 - (oppWin && m.a < 1e6 ? 1e7 : 0) + (m.a >= 100000 ? 5e5 : 0);
      if (!best || val > best.v) best = { i: m.i, v: val };
    });
    return best ? best.i : r[0].i;
  }

  // ---------- 對局 ----------
  function newGame(opt) {
    S = { b: new Array(N * N).fill(0), turn: 1, hist: [], over: false, win: null, mode: opt.mode, me: opt.me, lv: opt.lv || 'normal', undo: 3, t0: Date.now() };
    K.close('ovEnd');
    if (S.mode === 'ai') {
      $('bLb').href = '/leaderboard/?game=gomoku&mode=' + S.lv;
      if (window.SCLB) SCLB.start(GAME, S.lv);
      if (window.SC) SC.post('start', { game: GAME, level: S.lv });
    }
    draw(); ui();
    if (S.mode === 'ai' && S.turn !== S.me) botTurn();
  }
  function play(i, fromNet) {
    if (!S || S.over || S.b[i]) return false;
    S.b[i] = S.turn; S.hist.push(i);
    var wl = winLine(S.b, i);
    K.beep(S.turn === 1 ? 300 : 360, 0.05, 'triangle', 0.05);
    if (NET && S.mode === 'net' && !fromNet) NET.send({ t: 'mv', i: i, n: S.hist.length });
    if (wl) { S.over = true; S.win = { c: S.turn, line: wl }; draw(); ui(); end(); return true; }
    if (S.hist.length >= N * N) { S.over = true; S.win = { c: 0 }; draw(); ui(); end(); return true; }
    S.turn = 3 - S.turn; draw(); ui();
    if (S.mode === 'ai' && S.turn !== S.me) botTurn();
    return true;
  }
  function botTurn() {
    thinking = true; ui();
    setTimeout(function () {
      if (!S || S.over || S.mode !== 'ai') { thinking = false; return; }
      var i = aiMove(S.b, S.turn, S.lv); thinking = false;
      if (i >= 0) play(i);
    }, 350 + Math.random() * 300);
  }
  function end() {
    var w = S.win.c, mine = w === S.me, t = Math.floor((Date.now() - S.t0) / 1000);
    $('endEmoji').textContent = !w ? '🤝' : mine ? '🏆' : '😵';
    $('endTitle').textContent = !w ? L('和棋', 'Draw') : mine ? L('你贏了！', 'You win!') : (S.mode === 'net' ? L('對手獲勝', 'Your opponent wins') : L('電腦獲勝', 'The computer wins'));
    $('endNote').textContent = S.mode === 'ai' ? L(LV[S.lv][0], LV[S.lv][1]) + L('・用時 ', ' · ') + K.fmtTime(t) : '';
    $('bAgain').textContent = S.mode === 'net' ? L('再來一局（交換先後）', 'Rematch (swap colours)') : L('再來一局', 'Play again');
    K.beep(mine ? 660 : 220, 0.45, 'triangle', 0.07, mine ? 1320 : 110);
    if (window.SC) SC.post('gameover', { game: GAME, win: mine, online: S.mode === 'net' });
    setTimeout(function () {
      K.open('ovEnd');
      if (mine && S.mode === 'ai' && window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: L(LV[S.lv][0], LV[S.lv][1]) + ' ' + K.fmtTime(sec) }); }
    }, 900);
  }

  // ---------- 畫面 ----------
  function resize() {
    var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    size = r.width; cell = size / (N + 0.6); pad = cell * 0.8;
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function pos(i) { return [pad + (i % N) * ((size - 2 * pad) / (N - 1)), pad + Math.floor(i / N) * ((size - 2 * pad) / (N - 1))]; }
  var hover = -1;
  function draw() {
    var g = ctx.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#e9c58a'); g.addColorStop(1, '#d1a35e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    var st = (size - 2 * pad) / (N - 1);
    ctx.strokeStyle = 'rgba(70,40,10,.75)'; ctx.lineWidth = 1;
    for (var k = 0; k < N; k++) { ctx.beginPath(); ctx.moveTo(pad, pad + k * st); ctx.lineTo(size - pad, pad + k * st); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad + k * st, pad); ctx.lineTo(pad + k * st, size - pad); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeRect(pad, pad, size - 2 * pad, size - 2 * pad);
    ctx.fillStyle = 'rgba(70,40,10,.9)';
    [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]].forEach(function (p) { ctx.beginPath(); ctx.arc(pad + p[0] * st, pad + p[1] * st, Math.max(2.5, st * 0.1), 0, 7); ctx.fill(); });
    if (!S) return;
    var rad = st * 0.44;
    S.b.forEach(function (v, i) {
      if (!v) return; var p = pos(i);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(p[0] + 1.5, p[1] + 2, rad, 0, 7); ctx.fill();
      var gr = ctx.createRadialGradient(p[0] - rad * 0.35, p[1] - rad * 0.35, rad * 0.1, p[0], p[1], rad);
      if (v === 1) { gr.addColorStop(0, '#777'); gr.addColorStop(1, '#0a0a0a'); } else { gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#cfcfcf'); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 7); ctx.fill();
    });
    if (S.hist.length) { var lp = pos(S.hist[S.hist.length - 1]); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(lp[0], lp[1], rad * 0.25, 0, 7); ctx.fill(); }
    if (S.win && S.win.line) { var a = pos(S.win.line[0]), z = pos(S.win.line[S.win.line.length - 1]); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(3, st * 0.12); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke(); }
    if (hover >= 0 && myTurn() && !S.b[hover]) { var hp = pos(hover); ctx.globalAlpha = 0.4; ctx.fillStyle = S.turn === 1 ? '#111' : '#fff'; ctx.beginPath(); ctx.arc(hp[0], hp[1], rad, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function myTurn() { return S && !S.over && !thinking && S.turn === S.me; }
  function ui() {
    if (!S) return;
    var oppName = S.mode === 'net' ? (NET && NET.oppName || L('對手', 'Opponent')) : L('電腦', 'Computer') + '（' + L(LV[S.lv][0], LV[S.lv][1]) + '）';
    $('nmB').textContent = S.me === 1 ? L('你', 'You') : oppName; $('nmW').textContent = S.me === 2 ? L('你', 'You') : oppName;
    $('tmB').textContent = L('黑・先手', 'Black · first'); $('tmW').textContent = L('白・後手', 'White');
    $('plB').classList.toggle('turn', !S.over && S.turn === 1); $('plW').classList.toggle('turn', !S.over && S.turn === 2);
    $('status').textContent = S.over ? L('結束', 'Game over') : thinking ? L('電腦思考中…', 'Thinking…') : S.turn === S.me ? L('輪到你', 'Your move') : L('等對手…', 'Waiting…');
    $('undoN').textContent = S.undo; $('bUndo').style.display = S.mode === 'ai' ? '' : 'none';
    $('bUndo').disabled = !S.undo || S.over || thinking || S.hist.length < 2;
    $('bResign').disabled = S.over;
    $('sub').textContent = S.mode === 'net' ? L('🌐 線上對戰', '🌐 Online') : L('對戰電腦・', 'vs computer · ') + L(LV[S.lv][0], LV[S.lv][1]);
    $('bOnline').textContent = NET ? L('🌐 離開線上', '🌐 Leave online') : L('🌐 線上對戰', '🌐 Online');
  }

  // ---------- 輸入 ----------
  function hit(e) {
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, st = (size - 2 * pad) / (N - 1);
    var cx = Math.round((x - pad) / st), cy = Math.round((y - pad) / st);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return -1;
    return cy * N + cx;
  }
  var lastTap = { i: -1, t: 0 };
  cv.addEventListener('click', function (e) {
    if (!myTurn()) return;
    var i = hit(e); if (i < 0 || S.b[i]) return;
    // 觸控：第一下先預覽，再點同一點才下（避免手滑）
    if (e.pointerType === 'touch' || (window.matchMedia && matchMedia('(hover:none)').matches)) {
      if (lastTap.i !== i || Date.now() - lastTap.t > 4000) { lastTap = { i: i, t: Date.now() }; hover = i; draw(); return; }
    }
    hover = -1; lastTap = { i: -1, t: 0 }; play(i);
  });
  cv.addEventListener('mousemove', function (e) { var i = hit(e); if (i !== hover) { hover = i; draw(); } });
  cv.addEventListener('mouseleave', function () { hover = -1; draw(); });
  $('bUndo').onclick = function () {
    if (!S || S.mode !== 'ai' || !S.undo || S.over || thinking || S.hist.length < 2) return;
    for (var k = 0; k < 2; k++) { var i = S.hist.pop(); S.b[i] = 0; }
    S.turn = S.me; S.undo--; draw(); ui();
  };
  $('bResign').onclick = function () {
    if (!S || S.over) return;
    if (!(Date.now() - (S.askR || 0) < 2500)) { S.askR = Date.now(); K.toast(L('再按一次認輸', 'Tap again to resign')); return; }
    if (S.mode === 'net' && NET) NET.send({ t: 'resign' });
    S.over = true; S.win = { c: 3 - S.me }; draw(); ui(); end();
  };

  // ---------- 線上 ----------
  function myName() { var n = K.load('sc_lb_name', ''); return (typeof n === 'string' && n.trim()) ? n.trim().slice(0, 16) : ''; }
  function startNet(conn) {
    leaveNet(true);
    NET = conn; NET.game = 0;
    conn.send({ t: 'hi', name: myName() });
    conn.onData = function (m) {
      if (!m) return;
      if (m.t === 'hi') { NET.oppName = String(m.name || '').slice(0, 16) || L('對手', 'Opponent'); ui(); }
      else if (m.t === 'start') { NET.game = m.g; newGame({ mode: 'net', me: m.hostBlack ? 2 : 1 }); K.toast(S.me === 1 ? L('你執黑先下', 'You are Black — you move first') : L('你執白', 'You are White')); }
      else if (m.t === 'mv') { if (S && S.mode === 'net' && S.turn !== S.me && m.n === S.hist.length + 1) play(m.i, true); }
      else if (m.t === 'resign') { if (S && !S.over) { S.over = true; S.win = { c: S.me }; draw(); ui(); end(); K.toast(L('對手認輸了', 'Your opponent resigned')); } }
      else if (m.t === 'again') { if (conn.role === 'host') hostStart(); else K.toast(L('對手想再來一局', 'Your opponent wants a rematch')); }
    };
    conn.onClose = function () {
      if (NET !== conn) return;
      NET = null; K.toast(L('對手已離線', 'Your opponent left'), 3000);
      if (S && S.mode === 'net' && !S.over) { S.over = true; S.win = { c: S.me }; draw(); end(); }
      ui();
    };
    if (conn.role === 'host') hostStart();
    else { $('status').textContent = L('等待開局…', 'Waiting…'); }
  }
  function hostStart() {
    if (!NET) return;
    NET.game++;
    var hostBlack = NET.game % 2 === 1;
    NET.send({ t: 'start', g: NET.game, hostBlack: hostBlack });
    newGame({ mode: 'net', me: hostBlack ? 1 : 2 });
  }
  function leaveNet(silent) { if (!NET) return; var c = NET; NET = null; c.onClose = null; c.close(); if (!silent) K.toast(L('已離開線上對戰', 'Left the online game')); }
  function openOnline(code) {
    if (!window.SCNet) return;
    SCNet.openLobby({ game: GAME, title: L('五子棋', 'Gomoku'), code: code, autoJoin: !!code, onReady: startNet });
  }
  $('bOnline').onclick = function () {
    if (!NET) { openOnline(); return; }
    if (!(Date.now() - (window._gmask || 0) < 2500)) { window._gmask = Date.now(); K.toast(L('再按一次離開線上對戰', 'Tap again to leave the online game')); return; }
    leaveNet(); newGame({ mode: 'ai', me: pickCol, lv: pickLv });
  };
  $('bAgain').onclick = function () {
    K.close('ovEnd');
    if (S.mode === 'net') { if (!NET) return; if (NET.role === 'host') hostStart(); else NET.send({ t: 'again' }); return; }
    newGame({ mode: 'ai', me: S.me, lv: S.lv });
  };

  // ---------- 開新局 ----------
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = '';
    Object.keys(LV).forEach(function (k) { var b = document.createElement('button'); b.textContent = L(LV[k][0], LV[k][1]); b.className = k === pickLv ? 'on' : ''; b.onclick = function () { pickLv = k; [].forEach.call(ch.children, function (x) { x.classList.toggle('on', x === b); }); }; ch.appendChild(b); });
    K.open('ovNew');
  }
  $('colChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; pickCol = +b.dataset.c; [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); });
  $('bGo').onclick = function () { K.close('ovNew'); if (NET) leaveNet(); newGame({ mode: 'ai', me: pickCol, lv: pickLv }); };
  $('bNew').onclick = function () {
    if (S && S.mode === 'net' && NET && !S.over) { K.toast(L('線上對局中，請先認輸或離開線上', 'Resign or leave online first')); return; }
    openNew();
  };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (window.SC) SC.onLang(ui);
  if (location.hash.indexOf('#test') === 0) window.__gm = { aiMove: aiMove, play: function (i) { return play(i); }, S: function () { return S; } };

  newGame({ mode: 'ai', me: 1, lv: 'normal' });
  resize();
  var room = window.SCNet && SCNet.roomFromUrl();
  if (room) { SCNet.clearRoomFromUrl(); openOnline(room); }
})();
