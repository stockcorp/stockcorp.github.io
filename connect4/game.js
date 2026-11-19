/* 四子棋 — stockcorp.github.io/connect4/
   7 欄 × 6 列；對電腦（簡單：會贏就贏、會輸就擋，其餘隨機；普通：搜尋 4 層；困難：alpha-beta 9 層＋窗格評估）；
   線上 SCNet 1 對 1（每局交換先後手）。排行榜：擊敗電腦的時間（伺服器計時），mode = easy/normal/hard。 */
(function () {
  'use strict';
  var GAME = 'connect4', C = 7, R = 6, $ = K.$, L = K.L;
  var LV = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] };
  var ORDER = [3, 2, 4, 1, 5, 0, 6];
  var cv = $('cv'), ctx = cv.getContext('2d'), bw = 500, bh = 470, S = null, NET = null, thinking = false, pickLv = 'normal', pickCol = 1, hover = -1;

  // b[r*C+c]，r=0 是最上面
  function drop(b, c) { for (var r = R - 1; r >= 0; r--) if (!b[r * C + c]) return r; return -1; }
  function line(b, r, c, p) {
    var D = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var d = 0; d < 4; d++) {
      var cells = [[r, c]];
      for (var s = -1; s <= 1; s += 2) { var rr = r + D[d][0] * s, cc = c + D[d][1] * s; while (rr >= 0 && rr < R && cc >= 0 && cc < C && b[rr * C + cc] === p) { cells.push([rr, cc]); rr += D[d][0] * s; cc += D[d][1] * s; } }
      if (cells.length >= 4) return cells;
    }
    return null;
  }
  function full(b) { for (var c = 0; c < C; c++) if (!b[c]) return false; return true; }

  // ---------- 電腦 ----------
  function score(b, p) {
    var s = 0, o = 3 - p;
    for (var r = 0; r < R; r++) if (b[r * C + 3] === p) s += 3;
    var W = function (a, bb, cc, d) { var mp = (a === p) + (bb === p) + (cc === p) + (d === p), mo = (a === o) + (bb === o) + (cc === o) + (d === o); if (mp && mo) return 0; if (mp === 3) return 5; if (mp === 2) return 2; if (mo === 3) return -4; if (mo === 2) return -1; return 0; };
    for (r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var i = r * C + c;
      if (c + 3 < C) s += W(b[i], b[i + 1], b[i + 2], b[i + 3]);
      if (r + 3 < R) s += W(b[i], b[i + C], b[i + 2 * C], b[i + 3 * C]);
      if (r + 3 < R && c + 3 < C) s += W(b[i], b[i + C + 1], b[i + 2 * C + 2], b[i + 3 * C + 3]);
      if (r + 3 < R && c - 3 >= 0) s += W(b[i], b[i + C - 1], b[i + 2 * C - 2], b[i + 3 * C - 3]);
    }
    return s;
  }
  function nega(b, p, depth, a, bt, ply) {
    if (full(b)) return 0;
    if (depth === 0) return score(b, p);
    for (var k = 0; k < C; k++) { var c = ORDER[k], r = drop(b, c); if (r >= 0) { b[r * C + c] = p; var w = line(b, r, c, p); b[r * C + c] = 0; if (w) return 10000 - ply; } }
    var best = -1e9;
    for (k = 0; k < C; k++) {
      c = ORDER[k]; r = drop(b, c); if (r < 0) continue;
      b[r * C + c] = p; var v = -nega(b, 3 - p, depth - 1, -bt, -a, ply + 1); b[r * C + c] = 0;
      if (v > best) best = v; if (v > a) a = v; if (a >= bt) break;
    }
    return best;
  }
  function aiMove(b, p, lv) {
    var cols = ORDER.filter(function (c) { return drop(b, c) >= 0; }); if (!cols.length) return -1;
    var bb = b.slice();
    for (var k = 0; k < cols.length; k++) { var c = cols[k], r = drop(bb, c); bb[r * C + c] = p; var w = line(bb, r, c, p); bb[r * C + c] = 0; if (w) return c; }
    for (k = 0; k < cols.length; k++) { c = cols[k]; r = drop(bb, c); bb[r * C + c] = 3 - p; w = line(bb, r, c, 3 - p); bb[r * C + c] = 0; if (w) return c; }
    if (lv === 'easy') return Math.random() < 0.6 ? cols[(Math.random() * cols.length) | 0] : cols[0];
    var empt = b.filter(function (v) { return !v; }).length, depth = lv === 'hard' ? (empt > 30 ? 10 : 12) : 4, best = cols[0], bv = -1e9;
    cols.forEach(function (c) { var r = drop(bb, c); bb[r * C + c] = p; var v = -nega(bb, 3 - p, depth - 1, -1e9, 1e9, 1) + (lv === 'normal' ? Math.random() * 3 : 0); bb[r * C + c] = 0; if (v > bv) { bv = v; best = c; } });
    return best;
  }

  // ---------- 對局 ----------
  function newGame(o) {
    S = { b: new Array(R * C).fill(0), turn: 1, mode: o.mode, me: o.me || 1, lv: o.lv || 'normal', hist: [], last: -1, over: false, undo: 3, t0: Date.now(), win: null, fall: null };
    K.close('ovEnd');
    if (S.mode === 'ai') { $('bLb').href = '/leaderboard/?game=connect4&mode=' + S.lv; if (window.SCLB) SCLB.start(GAME, S.lv); if (window.SC) SC.post('start', { game: GAME, level: S.lv }); }
    draw(); ui();
    if (S.mode === 'ai' && S.turn !== S.me) botTurn();
  }
  function play(c, fromNet) {
    if (!S || S.over || S.fall) return false;
    var r = drop(S.b, c); if (r < 0) return false;
    S.hist.push({ b: S.b.slice(), turn: S.turn, last: S.last });
    var p = S.turn; S.b[r * C + c] = p; S.last = r * C + c;
    if (NET && S.mode === 'net' && !fromNet) NET.send({ t: 'mv', c: c, n: S.hist.length });
    S.fall = { r: r, c: c, p: p, t0: performance.now() };
    K.beep(p === 1 ? 330 : 400, 0.05, 'triangle', 0.05);
    animate(function () {
      S.fall = null; K.beep(180, 0.05, 'square', 0.03);
      var w = line(S.b, r, c, p);
      if (w) { S.win = w; return finish(p, '', true); }
      if (full(S.b)) return finish(0, '', true);
      S.turn = 3 - p; ui(); draw();
      if (S.mode === 'ai' && S.turn !== S.me) botTurn();
    });
    ui(); return true;
  }
  function botTurn() {
    thinking = true; ui(); var id = S;
    setTimeout(function () { if (S !== id || S.over) { thinking = false; return; } var c = aiMove(S.b, S.turn, S.lv); thinking = false; if (c >= 0) play(c); }, 300 + Math.random() * 250);
  }
  function finish(w, note, natural) {
    S.over = true;
    var mine = w === S.me, t = Math.floor((Date.now() - S.t0) / 1000);
    $('endEmoji').textContent = !w ? '🤝' : mine ? '🏆' : '😵';
    $('endTitle').textContent = !w ? L('平手', 'Draw') : mine ? L('你贏了！', 'You win!') : S.mode === 'net' ? L('對手獲勝', 'Your opponent wins') : L('電腦獲勝', 'The computer wins');
    $('endNote').textContent = (note ? note + '　' : '') + (S.mode === 'ai' ? L(LV[S.lv][0], LV[S.lv][1]) + L('・用時 ', ' · ') + K.fmtTime(t) : '');
    $('bAgain').textContent = S.mode === 'net' ? L('再來一局（交換先後）', 'Rematch (swap colours)') : L('再來一局', 'Play again');
    K.beep(mine ? 660 : 260, 0.45, 'triangle', 0.07, mine ? 1320 : 130);
    if (window.SC) SC.post('gameover', { game: GAME, win: mine, online: S.mode === 'net' });
    ui(); draw();
    setTimeout(function () {
      K.open('ovEnd');
      if (mine && natural && S.mode === 'ai' && window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: L(LV[S.lv][0], LV[S.lv][1]) + ' ' + K.fmtTime(sec) }); }
    }, 1000);
  }

  // ---------- 畫面 ----------
  function resize() { var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); bw = r.width; bh = r.height; cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  function animate(done) { var F = S.fall, f = function () { draw(); if (S.fall === F) requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(done, 70 + F.r * 55); }
  function geo() { var cs = Math.min(bw / C, (bh - bw / C * 0.6) / R), ox = (bw - cs * C) / 2, oy = cs * 0.6; return { cs: cs, ox: ox, oy: oy }; }
  function disc(x, y, rad, p, alpha) {
    ctx.globalAlpha = alpha || 1;
    var g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
    if (p === 1) { g.addColorStop(0, '#fca5a5'); g.addColorStop(1, '#dc2626'); } else { g.addColorStop(0, '#fef08a'); g.addColorStop(1, '#eab308'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = rad * 0.12; ctx.beginPath(); ctx.arc(x, y, rad * 0.68, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function draw() {
    if (!S) return;
    var G = geo(), cs = G.cs, rad = cs * 0.4;
    ctx.clearRect(0, 0, bw, bh);
    // 預覽
    if (hover >= 0 && myTurn() && drop(S.b, hover) >= 0) disc(G.ox + hover * cs + cs / 2, G.oy - cs * 0.32, rad * 0.8, S.turn, 0.55);
    // 棋子（含掉落動畫），畫在板子後面
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var p = S.b[r * C + c]; if (!p) continue;
      var y = G.oy + r * cs + cs / 2;
      if (S.fall && S.fall.r === r && S.fall.c === c) { var k = Math.min(1, (performance.now() - S.fall.t0) / (60 + r * 55)); y = G.oy - cs / 2 + (y - G.oy + cs / 2) * k * k; }
      disc(G.ox + c * cs + cs / 2, y, rad, p);
    }
    // 藍色板子（挖洞）
    ctx.save(); ctx.beginPath(); ctx.rect(G.ox - 6, G.oy, cs * C + 12, cs * R + 8);
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) { ctx.moveTo(G.ox + c * cs + cs / 2 + rad, G.oy + r * cs + cs / 2); ctx.arc(G.ox + c * cs + cs / 2, G.oy + r * cs + cs / 2, rad, 0, Math.PI * 2, true); }
    var bg = ctx.createLinearGradient(0, G.oy, 0, G.oy + cs * R); bg.addColorStop(0, '#2563eb'); bg.addColorStop(1, '#1e40af');
    ctx.fillStyle = bg; ctx.fill('evenodd'); ctx.restore();
    if (S.win) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; S.win.forEach(function (q) { ctx.beginPath(); ctx.arc(G.ox + q[1] * cs + cs / 2, G.oy + q[0] * cs + cs / 2, rad * 0.86, 0, 7); ctx.stroke(); }); }
    else if (S.last >= 0 && !S.fall) { var lr = (S.last / C) | 0, lc = S.last % C; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(G.ox + lc * cs + cs / 2, G.oy + lr * cs + cs / 2, rad * 0.16, 0, 7); ctx.fill(); }
  }
  function myTurn() { return S && !S.over && !thinking && !S.fall && S.turn === S.me; }
  function ui() {
    if (!S) return;
    var opp = S.mode === 'net' ? (NET && NET.oppName || L('對手', 'Opponent')) : L('電腦', 'Computer') + '（' + L(LV[S.lv][0], LV[S.lv][1]) + '）';
    $('nmB').textContent = S.me === 1 ? L('你', 'You') : opp; $('nmW').textContent = S.me === 2 ? L('你', 'You') : opp;
    $('plB').classList.toggle('turn', !S.over && S.turn === 1); $('plW').classList.toggle('turn', !S.over && S.turn === 2);
    $('status').textContent = S.over ? L('結束', 'Game over') : thinking ? L('電腦思考中…', 'Thinking…') : S.turn === S.me ? L('輪到你', 'Your move') : L('等對手…', 'Waiting…');
    $('undoN').textContent = S.undo; $('bUndo').style.display = S.mode === 'ai' ? '' : 'none';
    $('bUndo').disabled = S.over || thinking || !!S.fall || !S.undo || S.hist.length < 1;
    $('bResign').disabled = S.over;
    $('sub').textContent = S.mode === 'net' ? L('🌐 線上對戰', '🌐 Online') : L('對戰電腦・', 'vs computer · ') + L(LV[S.lv][0], LV[S.lv][1]);
    $('bOnline').textContent = NET ? L('🌐 離開線上', '🌐 Leave online') : L('🌐 線上對戰', '🌐 Online');
  }

  // ---------- 輸入 ----------
  function colAt(e) { var r = cv.getBoundingClientRect(), G = geo(), c = Math.floor((e.clientX - r.left - G.ox) / G.cs); return c >= 0 && c < C ? c : -1; }
  cv.addEventListener('pointermove', function (e) { var c = colAt(e); if (c !== hover) { hover = c; draw(); } });
  cv.addEventListener('pointerleave', function () { hover = -1; draw(); });
  cv.addEventListener('click', function (e) { if (!myTurn()) return; var c = colAt(e); if (c < 0 || !play(c)) K.beep(150, 0.08, 'square', 0.03); });
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; var n = +e.key; if (n >= 1 && n <= 7 && myTurn()) play(n - 1); });
  $('bUndo').onclick = function () {
    if (!S || S.mode !== 'ai' || S.over || thinking || S.fall || !S.undo || !S.hist.length) return;
    var h; do { h = S.hist.pop(); } while (S.hist.length && h.turn !== S.me);
    if (h.turn !== S.me) { S.hist.push(h); return; }
    S.b = h.b; S.turn = h.turn; S.last = h.last; S.undo--; draw(); ui();
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
      else if (m.t === 'start') { newGame({ mode: 'net', me: m.hostRed ? 2 : 1 }); K.toast(S.me === 1 ? L('你執紅子先下', 'You are Red — you move first') : L('你執黃子', 'You are Yellow')); }
      else if (m.t === 'mv') { if (S && S.mode === 'net' && S.turn !== S.me && m.n === S.hist.length + 1) { var go = function () { if (S.fall) return setTimeout(go, 50); play(m.c, true); }; go(); } }
      else if (m.t === 'resign') { if (S && !S.over) { K.toast(L('對手認輸了', 'Your opponent resigned')); finish(S.me, L('對手認輸', 'Opponent resigned'), false); } }
      else if (m.t === 'again') { if (conn.role === 'host') hostStart(); else K.toast(L('對手想再來一局', 'Your opponent wants a rematch')); }
    };
    conn.onClose = function () { if (NET !== conn) return; NET = null; K.toast(L('對手已離線', 'Your opponent left'), 3000); if (S && S.mode === 'net' && !S.over) finish(S.me, L('對手離線', 'Opponent left'), false); ui(); };
    if (conn.role === 'host') hostStart(); else $('status').textContent = L('等待開局…', 'Waiting…');
  }
  function hostStart() { if (!NET) return; NET.game++; var hr = NET.game % 2 === 1; NET.send({ t: 'start', g: NET.game, hostRed: hr }); newGame({ mode: 'net', me: hr ? 1 : 2 }); }
  function leaveNet(silent) { if (!NET) return; var c = NET; NET = null; c.onClose = null; c.close(); if (!silent) K.toast(L('已離開線上對戰', 'Left the online game')); }
  function openOnline(code) { if (window.SCNet) SCNet.openLobby({ game: GAME, title: L('四子棋', 'Connect Four'), code: code, autoJoin: !!code, onReady: startNet }); }
  $('bOnline').onclick = function () {
    if (!NET) { openOnline(); return; }
    if (!(Date.now() - (window._c4ask || 0) < 2500)) { window._c4ask = Date.now(); K.toast(L('再按一次離開線上對戰', 'Tap again to leave the online game')); return; }
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
  if (location.hash.indexOf('#test') === 0) window.__c4 = { S: function () { return S; }, play: function (c) { return play(c); }, aiMove: aiMove, drop: drop, line: line };
  newGame({ mode: 'ai', me: 1, lv: 'normal' }); resize();
  var room = window.SCNet && SCNet.roomFromUrl();
  if (room) { SCNet.clearRoomFromUrl(); openOnline(room); }
})();
