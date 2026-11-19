/* 黑白棋 — stockcorp.github.io/reversi/
   8×8；對電腦（簡單：隨機偏好角；普通：位置權重；困難：alpha-beta 搜尋＋行動力評估）；線上 SCNet 1 對 1（每局交換先後手）。
   排行榜：擊敗電腦的時間（伺服器計時），mode = easy/normal/hard。 */
(function () {
  'use strict';
  var GAME = 'reversi', N = 8, $ = K.$, L = K.L;
  var LV = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] };
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  var W = [120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5, 20, 5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5, 20, -5, 15, 3, 3, 15, -5, 20, -20, -40, -5, -5, -5, -5, -40, -20, 120, -20, 20, 5, 5, 20, -20, 120];
  var cv = $('cv'), ctx = cv.getContext('2d'), size = 500, S = null, NET = null, thinking = false, pickLv = 'normal', pickCol = 1, showHint = true;

  // ---------- 規則 ----------
  function flips(b, i, c) {
    if (b[i]) return [];
    var x = i % N, y = (i / N) | 0, o = 3 - c, out = [];
    for (var d = 0; d < 8; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1], X = x + dx, Y = y + dy, line = [];
      while (X >= 0 && Y >= 0 && X < N && Y < N && b[Y * N + X] === o) { line.push(Y * N + X); X += dx; Y += dy; }
      if (line.length && X >= 0 && Y >= 0 && X < N && Y < N && b[Y * N + X] === c) out = out.concat(line);
    }
    return out;
  }
  function moves(b, c) { var m = []; for (var i = 0; i < 64; i++) if (!b[i] && flips(b, i, c).length) m.push(i); return m; }
  function apply(b, i, c) { var f = flips(b, i, c), nb = b.slice(); nb[i] = c; f.forEach(function (j) { nb[j] = c; }); return nb; }
  function count(b, c) { var n = 0; for (var i = 0; i < 64; i++) if (b[i] === c) n++; return n; }

  // ---------- 電腦 ----------
  function evalB(b, c) {
    var o = 3 - c, s = 0, empt = 0;
    for (var i = 0; i < 64; i++) { if (b[i] === c) s += W[i]; else if (b[i] === o) s -= W[i]; else empt++; }
    var mc = moves(b, c).length, mo = moves(b, o).length;
    s += 8 * (mc - mo);
    if (empt < 12) s += 6 * (count(b, c) - count(b, o));
    return s;
  }
  function search(b, c, depth, a, bt, me) {
    var ms = moves(b, c);
    if (depth === 0) return evalB(b, me);
    if (!ms.length) {
      if (!moves(b, 3 - c).length) { var d = count(b, me) - count(b, 3 - me); return d * 1000; }
      return search(b, 3 - c, depth - 1, a, bt, me);
    }
    ms.sort(function (p, q) { return W[q] - W[p]; });
    if (c === me) { var v = -1e9; for (var k = 0; k < ms.length; k++) { v = Math.max(v, search(apply(b, ms[k], c), 3 - c, depth - 1, a, bt, me)); a = Math.max(a, v); if (a >= bt) break; } return v; }
    var w = 1e9; for (var j = 0; j < ms.length; j++) { w = Math.min(w, search(apply(b, ms[j], c), 3 - c, depth - 1, a, bt, me)); bt = Math.min(bt, w); if (a >= bt) break; } return w;
  }
  function aiMove(b, c, lv) {
    var ms = moves(b, c); if (!ms.length) return -1;
    if (lv === 'easy') { var corner = ms.filter(function (i) { return W[i] === 120; }); if (corner.length && Math.random() < 0.5) return corner[0]; return ms[(Math.random() * ms.length) | 0]; }
    if (lv === 'normal') { ms.sort(function (p, q) { return (W[q] + flips(b, q, c).length) - (W[p] + flips(b, p, c).length); }); return Math.random() < 0.85 ? ms[0] : ms[Math.min(1, ms.length - 1)]; }
    var empt = 64 - count(b, 1) - count(b, 2), depth = empt <= 12 ? 12 : 5, best = ms[0], bv = -1e9;
    ms.forEach(function (m) { var v = search(apply(b, m, c), 3 - c, depth - 1, -1e9, 1e9, c); if (v > bv) { bv = v; best = m; } });
    return best;
  }

  // ---------- 對局 ----------
  function newGame(o) {
    var b = new Array(64).fill(0); b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2;
    S = { b: b, turn: 1, mode: o.mode, me: o.me || 1, lv: o.lv || 'normal', hist: [], last: -1, over: false, undo: 3, t0: Date.now(), anim: {} };
    K.close('ovEnd');
    if (S.mode === 'ai') { $('bLb').href = '/leaderboard/?game=reversi&mode=' + S.lv; if (window.SCLB) SCLB.start(GAME, S.lv); if (window.SC) SC.post('start', { game: GAME, level: S.lv }); }
    draw(); ui();
    if (S.mode === 'ai' && S.turn !== S.me) botTurn();
  }
  function play(i, fromNet) {
    if (!S || S.over) return false;
    var f = flips(S.b, i, S.turn); if (!f.length) return false;
    S.hist.push({ b: S.b.slice(), turn: S.turn, last: S.last });
    S.b = apply(S.b, i, S.turn); S.last = i;
    var t = performance.now(); S.anim = {}; f.forEach(function (j) { S.anim[j] = t; });
    K.beep(S.turn === 1 ? 330 : 400, 0.06, 'triangle', 0.05);
    if (NET && S.mode === 'net' && !fromNet) NET.send({ t: 'mv', i: i, n: S.hist.length });
    advance();
    return true;
  }
  function advance() {
    var nx = 3 - S.turn;
    if (moves(S.b, nx).length) S.turn = nx;
    else if (!moves(S.b, S.turn).length) { S.over = true; animate(); ui(); return end(); }
    else K.toast((nx === 1 ? L('黑', 'Black') : L('白', 'White')) + L('沒有地方可下，跳過', ' has no move and passes'));
    animate(); ui();
    if (S.mode === 'ai' && S.turn !== S.me && !S.over) botTurn();
  }
  function botTurn() {
    thinking = true; ui();
    var id = S;
    setTimeout(function () {
      if (S !== id || S.over) { thinking = false; return; }
      var i = aiMove(S.b, S.turn, S.lv); thinking = false;
      if (i >= 0) play(i); else advance();
    }, 350 + Math.random() * 250);
  }
  function end() {
    var bc = count(S.b, 1), wc = count(S.b, 2), w = bc > wc ? 1 : wc > bc ? 2 : 0;
    finish(w, (L('黑 ', 'Black ') + bc + ' : ' + wc + L(' 白', ' White')), true);
  }
  function finish(w, note, natural) {
    S.over = true;
    var mine = w === S.me, t = Math.floor((Date.now() - S.t0) / 1000);
    $('endEmoji').textContent = !w ? '🤝' : mine ? '🏆' : '😵';
    $('endTitle').textContent = !w ? L('平手', 'Draw') : mine ? L('你贏了！', 'You win!') : S.mode === 'net' ? L('對手獲勝', 'Your opponent wins') : L('電腦獲勝', 'The computer wins');
    $('endNote').textContent = note + (S.mode === 'ai' ? '　' + L(LV[S.lv][0], LV[S.lv][1]) + L('・用時 ', ' · ') + K.fmtTime(t) : '');
    $('bAgain').textContent = S.mode === 'net' ? L('再來一局（交換先後）', 'Rematch (swap colours)') : L('再來一局', 'Play again');
    K.beep(mine ? 660 : 260, 0.45, 'triangle', 0.07, mine ? 1320 : 130);
    if (window.SC) SC.post('gameover', { game: GAME, win: mine, online: S.mode === 'net' });
    ui();
    setTimeout(function () {
      K.open('ovEnd');
      if (mine && natural && S.mode === 'ai' && window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: L(LV[S.lv][0], LV[S.lv][1]) + ' ' + K.fmtTime(sec) }); }
    }, 900);
  }

  // ---------- 畫面 ----------
  function resize() { var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); size = r.width; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  var raf = 0;
  function animate() { cancelAnimationFrame(raf); var t0 = performance.now(); (function f(t) { draw(); if (t - t0 < 320) raf = requestAnimationFrame(f); })(t0); }
  function draw() {
    if (!S) return;
    var cs = size / N; ctx.fillStyle = '#15803d'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2;
    for (var k = 0; k <= N; k++) { ctx.beginPath(); ctx.moveTo(k * cs, 0); ctx.lineTo(k * cs, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k * cs); ctx.lineTo(size, k * cs); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.6)'; [[2, 2], [6, 2], [2, 6], [6, 6]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * cs, p[1] * cs, cs * 0.07, 0, 7); ctx.fill(); });
    var now = performance.now(), my = myTurn();
    for (var i = 0; i < 64; i++) {
      var x = (i % N) * cs + cs / 2, y = ((i / N) | 0) * cs + cs / 2, v = S.b[i], r = cs * 0.42;
      if (v) {
        var a = S.anim[i] ? Math.min(1, (now - S.anim[i]) / 300) : 1, sx = Math.abs(Math.cos(a * Math.PI)) * (a < 0.5 ? 1 : 1);
        var col = a < 0.5 ? 3 - v : v;
        ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.08, sx), 1);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(1.5, 2.5, r, 0, 7); ctx.fill();
        var g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
        if (col === 1) { g.addColorStop(0, '#666'); g.addColorStop(1, '#0a0a0a'); } else { g.addColorStop(0, '#fff'); g.addColorStop(1, '#cfcfcf'); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
      } else if (my && showHint && flips(S.b, i, S.turn).length) {
        ctx.fillStyle = S.turn === 1 ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, 7); ctx.fill();
      }
    }
    if (S.last >= 0) { var lx = (S.last % N) * cs + cs / 2, ly = ((S.last / N) | 0) * cs + cs / 2; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(lx, ly, cs * 0.08, 0, 7); ctx.fill(); }
  }
  function myTurn() { return S && !S.over && !thinking && (S.mode === 'net' ? S.turn === S.me : S.turn === S.me); }
  function ui() {
    if (!S) return;
    var opp = S.mode === 'net' ? (NET && NET.oppName || L('對手', 'Opponent')) : L('電腦', 'Computer') + '（' + L(LV[S.lv][0], LV[S.lv][1]) + '）';
    $('nmB').textContent = S.me === 1 ? L('你', 'You') : opp; $('nmW').textContent = S.me === 2 ? L('你', 'You') : opp;
    $('cntB').textContent = count(S.b, 1); $('cntW').textContent = count(S.b, 2);
    $('plB').classList.toggle('turn', !S.over && S.turn === 1); $('plW').classList.toggle('turn', !S.over && S.turn === 2);
    $('status').textContent = S.over ? L('結束', 'Game over') : thinking ? L('電腦思考中…', 'Thinking…') : S.turn === S.me ? L('輪到你', 'Your move') : L('等對手…', 'Waiting…');
    $('undoN').textContent = S.undo; $('bUndo').style.display = S.mode === 'ai' ? '' : 'none';
    $('bUndo').disabled = S.over || thinking || !S.undo || S.hist.length < 1;
    $('bResign').disabled = S.over;
    $('sub').textContent = S.mode === 'net' ? L('🌐 線上對戰', '🌐 Online') : L('對戰電腦・', 'vs computer · ') + L(LV[S.lv][0], LV[S.lv][1]);
    $('bOnline').textContent = NET ? L('🌐 離開線上', '🌐 Leave online') : L('🌐 線上對戰', '🌐 Online');
  }

  // ---------- 輸入 ----------
  cv.addEventListener('click', function (e) {
    if (!myTurn()) return;
    var r = cv.getBoundingClientRect(), cs = r.width / N, i = Math.floor((e.clientY - r.top) / cs) * N + Math.floor((e.clientX - r.left) / cs);
    if (!play(i)) K.beep(150, 0.08, 'square', 0.03);
  });
  $('bHint').onclick = function () { showHint = !showHint; draw(); K.toast(showHint ? L('顯示可下位置', 'Showing legal moves') : L('隱藏可下位置', 'Hiding legal moves')); };
  $('bUndo').onclick = function () {
    if (!S || S.mode !== 'ai' || S.over || thinking || !S.undo || !S.hist.length) return;
    // 退回到上一次輪到自己
    var h; do { h = S.hist.pop(); } while (S.hist.length && h.turn !== S.me);
    if (h.turn !== S.me) { S.hist.push(h); return; }
    S.b = h.b; S.turn = h.turn; S.last = h.last; S.undo--; S.anim = {}; draw(); ui();
  };
  $('bResign').onclick = function () {
    if (!S || S.over) return;
    if (!(Date.now() - (S.askR || 0) < 2500)) { S.askR = Date.now(); K.toast(L('再按一次認輸', 'Tap again to resign')); return; }
    if (S.mode === 'net' && NET) NET.send({ t: 'resign' });
    finish(3 - S.me, L('認輸', 'Resigned'), false);
  };

  // ---------- 線上 ----------
  function myName() { var n = K.load('sc_lb_name', ''); return (typeof n === 'string' && n.trim()) ? n.trim().slice(0, 16) : ''; }
  function startNet(conn) {
    leaveNet(true); NET = conn; NET.game = 0;
    conn.send({ t: 'hi', name: myName() });
    conn.onData = function (m) {
      if (!m) return;
      if (m.t === 'hi') { NET.oppName = String(m.name || '').slice(0, 16) || L('對手', 'Opponent'); ui(); }
      else if (m.t === 'start') { newGame({ mode: 'net', me: m.hostBlack ? 2 : 1 }); K.toast(S.me === 1 ? L('你執黑先下', 'You are Black — you move first') : L('你執白', 'You are White')); }
      else if (m.t === 'mv') { if (S && S.mode === 'net' && S.turn !== S.me && m.n === S.hist.length + 1) play(m.i, true); }
      else if (m.t === 'resign') { if (S && !S.over) { K.toast(L('對手認輸了', 'Your opponent resigned')); finish(S.me, L('對手認輸', 'Opponent resigned'), false); } }
      else if (m.t === 'again') { if (conn.role === 'host') hostStart(); else K.toast(L('對手想再來一局', 'Your opponent wants a rematch')); }
    };
    conn.onClose = function () { if (NET !== conn) return; NET = null; K.toast(L('對手已離線', 'Your opponent left'), 3000); if (S && S.mode === 'net' && !S.over) finish(S.me, L('對手離線', 'Opponent left'), false); ui(); };
    if (conn.role === 'host') hostStart(); else $('status').textContent = L('等待開局…', 'Waiting…');
  }
  function hostStart() { if (!NET) return; NET.game++; var hb = NET.game % 2 === 1; NET.send({ t: 'start', g: NET.game, hostBlack: hb }); newGame({ mode: 'net', me: hb ? 1 : 2 }); }
  function leaveNet(silent) { if (!NET) return; var c = NET; NET = null; c.onClose = null; c.close(); if (!silent) K.toast(L('已離開線上對戰', 'Left the online game')); }
  function openOnline(code) { if (window.SCNet) SCNet.openLobby({ game: GAME, title: L('黑白棋', 'Reversi'), code: code, autoJoin: !!code, onReady: startNet }); }
  $('bOnline').onclick = function () {
    if (!NET) { openOnline(); return; }
    if (!(Date.now() - (window._rvask || 0) < 2500)) { window._rvask = Date.now(); K.toast(L('再按一次離開線上對戰', 'Tap again to leave the online game')); return; }
    leaveNet(); newGame({ mode: 'ai', me: pickCol, lv: pickLv });
  };
  $('bAgain').onclick = function () {
    K.close('ovEnd');
    if (S.mode === 'net') { if (!NET) return; if (NET.role === 'host') hostStart(); else NET.send({ t: 'again' }); return; }
    newGame({ mode: 'ai', me: S.me, lv: S.lv });
  };
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = '';
    Object.keys(LV).forEach(function (k) { var b = document.createElement('button'); b.textContent = L(LV[k][0], LV[k][1]); b.className = k === pickLv ? 'on' : ''; b.onclick = function () { pickLv = k; [].forEach.call(ch.children, function (x) { x.classList.toggle('on', x === b); }); }; ch.appendChild(b); });
    K.open('ovNew');
  }
  $('colChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; pickCol = +b.dataset.c; [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); });
  $('bGo').onclick = function () { K.close('ovNew'); if (NET) leaveNet(); newGame({ mode: 'ai', me: pickCol, lv: pickLv }); };
  $('bNew').onclick = function () { if (S && S.mode === 'net' && NET && !S.over) { K.toast(L('線上對局中，請先認輸或離開線上', 'Resign or leave online first')); return; } openNew(); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (window.SC) SC.onLang(ui);
  if (location.hash.indexOf('#test') === 0) window.__rv = { S: function () { return S; }, play: function (i) { return play(i); }, aiMove: aiMove, moves: moves };
  newGame({ mode: 'ai', me: 1, lv: 'normal' }); resize();
  var room = window.SCNet && SCNet.roomFromUrl();
  if (room) { SCNet.clearRoomFromUrl(); openOnline(room); }
})();
