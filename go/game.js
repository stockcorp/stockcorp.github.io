/* 圍棋 — stockcorp.github.io/go/
   9／13／19 路；對電腦（9、13 路，三種強度，電腦在 Web Worker 裡想）、雙人同機、線上（SCNet，每局交換黑白）。
   中國規則數子、貼 7.5 目。終局自動判斷死子，可點一塊棋切換。
   排行榜：擊敗電腦的時間（伺服器計時），mode = 路數-強度（如 9-normal）。 */
(function () {
  'use strict';
  var GAME = 'go', KOMI = 7.5, $ = K.$, L = K.L, E = window.GoEngine;
  var LV = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] };
  var ITERS = { 9: { easy: 500, normal: 3000, hard: 10000 }, 13: { easy: 500, normal: 2500, hard: 6000 } };
  var COLS = 'ABCDEFGHJKLMNOPQRST';
  var cv = $('cv'), ctx = cv.getContext('2d'), size = 600;
  var S = null, NET = null, thinking = false, pick = { mode: 'ai', n: 9, lv: 'normal', col: 1 }, worker = null, reqId = 0, pending = {};

  // ---------- 電腦（Web Worker，失敗就在主執行緒算） ----------
  try { worker = new Worker('engine.js?v=1.0'); worker.onmessage = function (e) { var cb = pending[e.data.id]; delete pending[e.data.id]; if (cb) cb(e.data.res); }; }
  catch (e) { worker = null; }
  function ask(cmd, state, opts, cb) {
    var id = ++reqId;
    if (worker) { pending[id] = cb; worker.postMessage({ id: id, cmd: cmd, state: state, opts: opts, runs: opts && opts.runs }); }
    else setTimeout(function () { cb(cmd === 'genmove' ? E.genmove(state, opts) : E.estimate(state, opts.runs || 200)); }, 30);
  }

  // ---------- 對局 ----------
  function state() { return { n: S.n, b: Array.prototype.slice.call(S.bd.b), ko: S.bd.ko, turn: S.bd.turn, moves: S.bd.moves, komi: KOMI, lastPass: S.passes > 0 }; }
  function newGame(o, quiet) {
    S = { n: o.n, bd: new E.Board(o.n), mode: o.mode, me: o.me || 1, lv: o.lv || 'normal', hist: [], last: -1, passes: 0, over: false, phase: 'play', dead: [], auto: null, undo: o.mode === 'ai' ? 3 : 99, t0: Date.now(), id: Math.random() };
    S.bd.turn = 1;
    K.close('ovEnd'); $('scorebar').hidden = true;
    if (S.mode === 'ai') {
      var mode = S.n + '-' + S.lv;
      $('bLb').href = '/leaderboard/?game=go&mode=' + mode;
      if (window.SCLB && !(quiet && SCLB.has(GAME, mode))) SCLB.start(GAME, mode);
    }
    if (window.SC) SC.post('start', { game: GAME, size: S.n, mode: S.mode });
    resize(); ui();
    if (quiet) return;
    persist();
    if (S.mode === 'ai' && S.bd.turn !== S.me) botTurn();
  }
  function snapshot() { return { b: S.bd.b.slice(), ko: S.bd.ko, turn: S.bd.turn, cap: S.bd.cap.slice(), last: S.last, passes: S.passes, moves: S.bd.moves }; }
  function restore(h) { S.bd.b.set(h.b); S.bd.ko = h.ko; S.bd.turn = h.turn; S.bd.cap = h.cap.slice(); S.last = h.last; S.passes = h.passes; S.bd.moves = h.moves; }
  // 下一手（i = -1 虛手）；fromNet 表示對手傳來的
  function move(i, fromNet) {
    if (!S || S.over || S.phase !== 'play') return false;
    var c = S.bd.turn, snap = snapshot();
    var r = S.bd.play(i, c);
    if (r === false) { if (!fromNet) { K.toast(i === S.bd.ko ? L('打劫：這裡不能馬上提回', 'Ko: you cannot retake here yet') : L('這裡不能下（沒有氣）', 'Illegal: no liberties')); K.beep(150, 0.1, 'square', 0.04); } return false; }
    S.hist.push(snap); if (S.hist.length > 400) S.hist.shift();
    if (i < 0) { S.passes++; S.last = -1; K.toast((c === 1 ? L('黑', 'Black') : L('白', 'White')) + L('虛手', ' passes')); }
    else { S.passes = 0; S.last = i; K.beep(r.length ? 520 : 330, r.length ? 0.12 : 0.05, 'triangle', 0.05); }
    if (NET && S.mode === 'net' && !fromNet) NET.send({ t: 'mv', i: i, n: S.bd.moves });
    persist(); draw(); ui();
    if (S.passes >= 2) { startScoring(); return true; }
    if (S.mode === 'ai' && S.bd.turn !== S.me) botTurn();
    return true;
  }
  function botTurn() {
    thinking = true; ui();
    var id = S.id, st = state(), its = (ITERS[S.n] || ITERS[13])[S.lv];
    ask('genmove', st, { iters: its, noise: S.lv === 'easy' ? 5 : 0 }, function (res) {
      thinking = false;
      if (!S || S.id !== id || S.over || S.phase !== 'play') { ui(); return; }
      if (res.error || res.move === undefined) { move(-1); return; }
      if (res.move === -3) { K.toast(L('電腦認輸了', 'The computer resigns')); finish(S.me, L('電腦認輸', 'Computer resigned'), true); return; }
      if (!move(res.move)) move(-1);
    });
  }

  // ---------- 終局數子 ----------
  function startScoring() {
    S.phase = 'score'; thinking = true; ui();
    var id = S.id;
    if (S.mode === 'net' && NET && NET.role !== 'host') { $('scoreText').textContent = L('等房主判斷死活…', 'Waiting for the host to score…'); $('scorebar').hidden = false; return; }
    ask('estimate', state(), { runs: S.n === 9 ? 300 : 200 }, function (res) {
      thinking = false;
      if (!S || S.id !== id || S.phase !== 'score') return;
      S.dead = res.dead.slice(); S.auto = res.dead.slice();
      if (S.mode === 'net' && NET) NET.send({ t: 'score', dead: S.dead });
      showScore();
    });
  }
  function tally(dead) { var a = S.bd.area(dead); return { b: a.black, w: a.white, own: a.own, diff: a.black - a.white - KOMI }; }
  function showScore() {
    var t = tally(S.dead), canEdit = S.mode !== 'net' || (NET && NET.role === 'host');
    $('scoreText').textContent = L('黑 ', 'Black ') + t.b + L(' 子，白 ', ' · White ') + t.w + L(' 子＋貼 ', ' + komi ') + KOMI + '　→　' + (t.diff > 0 ? L('黑勝 ', 'Black wins by ') + t.diff : L('白勝 ', 'White wins by ') + (-t.diff));
    $('scoreHint').style.display = canEdit ? '' : 'none';
    $('bConfirm').style.display = canEdit ? '' : 'none';
    $('bResume').style.display = S.mode === 'net' ? 'none' : '';
    $('scorebar').hidden = false; draw(); ui();
  }
  function toggleDead(i) {
    if (!S.bd.b[i]) return;
    var g = S.bd.group(i)[0], isDead = S.dead.indexOf(i) >= 0;
    if (isDead) S.dead = S.dead.filter(function (x) { return g.indexOf(x) < 0; }); else S.dead = S.dead.concat(g);
    if (S.mode === 'net' && NET) NET.send({ t: 'score', dead: S.dead });
    showScore();
  }
  function confirmScore() {
    var t = tally(S.dead), w = t.diff > 0 ? 1 : 2;
    var note = (w === 1 ? L('黑勝 ', 'Black wins by ') : L('白勝 ', 'White wins by ')) + Math.abs(t.diff) + L(' 子', ' pts');
    // 排行榜以自動判斷的死活為準
    var auto = S.auto ? tally(S.auto) : t, autoWin = (auto.diff > 0 ? 1 : 2) === S.me;
    if (S.mode === 'net' && NET) NET.send({ t: 'final', w: w, note: note });
    finish(w, note, autoWin);
  }
  function finish(w, note, lbOk) {
    S.over = true; S.phase = 'over'; $('scorebar').hidden = true; persist(true);
    var mine = S.mode === 'local' ? null : w === S.me, t = Math.floor((Date.now() - S.t0) / 1000);
    $('endEmoji').textContent = mine === null ? '🏁' : mine ? '🏆' : '😵';
    $('endTitle').textContent = S.mode === 'local' ? (w === 1 ? L('黑棋獲勝', 'Black wins') : L('白棋獲勝', 'White wins')) : mine ? L('你贏了！', 'You win!') : (S.mode === 'net' ? L('對手獲勝', 'Your opponent wins') : L('電腦獲勝', 'The computer wins'));
    $('endNote').textContent = note + (S.mode === 'ai' ? '　' + S.n + L(' 路・', '×' + S.n + ' · ') + L(LV[S.lv][0], LV[S.lv][1]) + L('・用時 ', ' · ') + K.fmtTime(t) : '');
    $('bAgain').textContent = S.mode === 'net' ? L('再來一局（交換黑白）', 'Rematch (swap colours)') : L('再來一局', 'Play again');
    K.beep(mine ? 660 : 330, 0.45, 'triangle', 0.07, mine ? 1320 : 165);
    if (window.SC) SC.post('gameover', { game: GAME, win: mine, mode: S.mode });
    draw(); ui();
    setTimeout(function () {
      K.open('ovEnd');
      if (mine && lbOk && S.mode === 'ai' && window.SCLB) { var sec = SCLB.elapsed(GAME) || t, mode = S.n + '-' + S.lv; SCLB.offer({ game: GAME, mode: mode, score: sec, text: S.n + L(' 路 ', '×' + S.n + ' ') + L(LV[S.lv][0], LV[S.lv][1]) + ' ' + K.fmtTime(sec) }); }
    }, 700);
  }

  // ---------- 畫面 ----------
  function geo() { var n = S.n, m = size / (n + 1.2); return { n: n, st: m, pad: m * 1.1 }; }
  function resize() {
    var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    size = r.width; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function xy(i) { var g = geo(); return [g.pad + (i % g.n) * g.st, g.pad + Math.floor(i / g.n) * g.st]; }
  var hover = -1;
  function draw() {
    if (!S) return;
    var g = geo(), n = g.n, st = g.st, pad = g.pad, end = pad + (n - 1) * st;
    var bg = ctx.createLinearGradient(0, 0, size, size); bg.addColorStop(0, '#e7c27d'); bg.addColorStop(1, '#cf9f55');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(60,35,10,.8)'; ctx.lineWidth = 1;
    for (var k = 0; k < n; k++) { ctx.beginPath(); ctx.moveTo(pad, pad + k * st); ctx.lineTo(end, pad + k * st); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad + k * st, pad); ctx.lineTo(pad + k * st, end); ctx.stroke(); }
    ctx.lineWidth = 1.6; ctx.strokeRect(pad, pad, end - pad, end - pad);
    var stars = n === 19 ? [3, 9, 15] : n === 13 ? [3, 6, 9] : [2, 4, 6];
    ctx.fillStyle = 'rgba(60,35,10,.9)';
    stars.forEach(function (a) { stars.forEach(function (b) { if (n === 9 && ((a === 4) !== (b === 4))) return; ctx.beginPath(); ctx.arc(pad + a * st, pad + b * st, Math.max(2, st * 0.09), 0, 7); ctx.fill(); }); });
    // 座標
    ctx.fillStyle = 'rgba(60,35,10,.7)'; ctx.font = Math.max(8, st * 0.32) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (k = 0; k < n; k++) { ctx.fillText(COLS[k], pad + k * st, pad - st * 0.72); ctx.fillText(String(n - k), pad - st * 0.72, pad + k * st); }
    var rad = st * 0.47, b = S.bd.b, dead = S.phase !== 'play' ? S.dead : [], own = S.phase === 'score' ? tally(S.dead).own : null;
    for (var i = 0; i < b.length; i++) {
      var p = xy(i), v = b[i], isDead = dead.indexOf(i) >= 0;
      if (v) {
        ctx.globalAlpha = isDead ? 0.45 : 1;
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(p[0] + 1.2, p[1] + 1.8, rad, 0, 7); ctx.fill();
        var gr = ctx.createRadialGradient(p[0] - rad * 0.35, p[1] - rad * 0.35, rad * 0.1, p[0], p[1], rad);
        if (v === 1) { gr.addColorStop(0, '#6b6b6b'); gr.addColorStop(1, '#0b0b0b'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfcfcf'); }
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (own && own[i] && (!v || isDead)) { ctx.fillStyle = own[i] === 1 ? '#111' : '#fff'; var q = st * 0.28; ctx.fillRect(p[0] - q / 2, p[1] - q / 2, q, q); }
    }
    if (S.last >= 0 && S.phase === 'play') { var lp = xy(S.last); ctx.strokeStyle = b[S.last] === 1 ? '#fff' : '#111'; ctx.lineWidth = Math.max(1.5, st * 0.07); ctx.beginPath(); ctx.arc(lp[0], lp[1], rad * 0.45, 0, 7); ctx.stroke(); }
    if (hover >= 0 && myTurn() && !b[hover]) { var hp = xy(hover); ctx.globalAlpha = 0.45; ctx.fillStyle = S.bd.turn === 1 ? '#111' : '#fff'; ctx.beginPath(); ctx.arc(hp[0], hp[1], rad, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function myTurn() {
    if (!S || S.over || thinking || S.phase !== 'play') return false;
    if (S.mode === 'local') return true;
    return S.bd.turn === S.me;
  }
  function ui() {
    if (!S) return;
    var oppName = S.mode === 'net' ? (NET && NET.oppName || L('對手', 'Opponent')) : S.mode === 'ai' ? L('電腦', 'Computer') + '（' + L(LV[S.lv][0], LV[S.lv][1]) + '）' : '';
    var nb = S.mode === 'local' ? L('黑棋', 'Black') : S.me === 1 ? L('你', 'You') : oppName, nw = S.mode === 'local' ? L('白棋', 'White') : S.me === 2 ? L('你', 'You') : oppName;
    $('nmB').textContent = nb; $('nmW').textContent = nw;
    $('capB').textContent = L('黑・提 ', 'Black · captured ') + S.bd.cap[1]; $('capW').textContent = L('白・提 ', 'White · captured ') + S.bd.cap[2] + L('・貼 7.5', ' · komi 7.5');
    var playing = !S.over && S.phase === 'play';
    $('plB').classList.toggle('turn', playing && S.bd.turn === 1); $('plW').classList.toggle('turn', playing && S.bd.turn === 2);
    $('status').textContent = S.over ? L('終局', 'Game over') : S.phase === 'score' ? L('數子中', 'Scoring') : thinking ? L('電腦思考中…', 'Thinking…') : myTurn() ? (S.mode === 'local' ? (S.bd.turn === 1 ? L('輪到黑', 'Black to play') : L('輪到白', 'White to play')) : L('輪到你', 'Your move')) : L('等對手…', 'Waiting…');
    $('think').hidden = !thinking;
    $('bPass').disabled = !myTurn(); $('bResign').disabled = !playing || S.mode === 'local' && false;
    $('bUndo').style.display = S.mode === 'net' ? 'none' : '';
    $('undoN').textContent = S.mode === 'ai' ? '(' + S.undo + ')' : '';
    $('bUndo').disabled = !playing || thinking || !S.undo || !S.hist.length;
    $('sub').textContent = (S.mode === 'net' ? L('🌐 線上對戰', '🌐 Online') : S.mode === 'local' ? L('雙人同機', 'Two players') : L('對戰電腦・', 'vs computer · ') + L(LV[S.lv][0], LV[S.lv][1])) + '・' + S.n + L(' 路', '×' + S.n);
    $('bOnline').textContent = NET ? L('🌐 離開線上', '🌐 Leave online') : L('🌐 線上對戰', '🌐 Online');
  }
  function persist(clear) {
    if (!S || S.mode === 'net') return;
    if (clear) { K.save('scgo_save', null); return; }
    K.save('scgo_save', { n: S.n, b: Array.prototype.slice.call(S.bd.b), ko: S.bd.ko, turn: S.bd.turn, cap: S.bd.cap, moves: S.bd.moves, mode: S.mode, me: S.me, lv: S.lv, last: S.last, passes: S.passes, undo: S.undo, t0: S.t0 });
  }
  function resume() {
    var s = K.load('scgo_save', null);
    if (!s || !s.b || !s.n) return false;
    newGame({ mode: s.mode, n: s.n, me: s.me, lv: s.lv }, true);
    for (var i = 0; i < s.b.length; i++) S.bd.b[i] = s.b[i];
    S.bd.ko = s.ko; S.bd.turn = s.turn; S.bd.cap = s.cap; S.bd.moves = s.moves; S.last = s.last; S.passes = s.passes || 0; S.undo = s.undo; S.t0 = s.t0 || Date.now();
    draw(); ui();
    if (S.mode === 'ai' && S.bd.turn !== S.me) botTurn();
    return true;
  }

  // ---------- 輸入 ----------
  function hit(e) {
    var r = cv.getBoundingClientRect(), g = geo(), x = e.clientX - r.left, y = e.clientY - r.top;
    var cx = Math.round((x - g.pad) / g.st), cy = Math.round((y - g.pad) / g.st);
    return cx < 0 || cy < 0 || cx >= g.n || cy >= g.n ? -1 : cy * g.n + cx;
  }
  var lastTap = { i: -1, t: 0 };
  cv.addEventListener('click', function (e) {
    if (!S) return;
    var i = hit(e); if (i < 0) return;
    if (S.phase === 'score') { if (S.mode !== 'net' || (NET && NET.role === 'host')) toggleDead(i); return; }
    if (!myTurn() || S.bd.b[i]) return;
    if (window.matchMedia && matchMedia('(hover:none)').matches) {
      if (lastTap.i !== i || Date.now() - lastTap.t > 4000) { lastTap = { i: i, t: Date.now() }; hover = i; draw(); return; }
    }
    hover = -1; lastTap = { i: -1, t: 0 }; move(i);
  });
  cv.addEventListener('mousemove', function (e) { var i = hit(e); if (i !== hover) { hover = i; draw(); } });
  cv.addEventListener('mouseleave', function () { hover = -1; draw(); });
  $('bPass').onclick = function () { if (!myTurn()) return; if (!(Date.now() - (S.askP || 0) < 2500)) { S.askP = Date.now(); K.toast(L('再按一次確定虛手', 'Tap again to pass')); return; } move(-1); };
  $('bUndo').onclick = function () {
    if (!S || S.over || thinking || !S.hist.length || !S.undo || S.mode === 'net') return;
    var back = S.mode === 'ai' ? (S.bd.turn === S.me ? 2 : 1) : 1;
    for (var k = 0; k < back && S.hist.length; k++) restore(S.hist.pop());
    if (S.mode === 'ai') S.undo--;
    S.phase = 'play'; persist(); draw(); ui();
  };
  $('bResign').onclick = function () {
    if (!S || S.over) return;
    if (!(Date.now() - (S.askR || 0) < 2500)) { S.askR = Date.now(); K.toast(L('再按一次認輸', 'Tap again to resign')); return; }
    var loser = S.mode === 'local' ? S.bd.turn : S.me;
    if (S.mode === 'net' && NET) NET.send({ t: 'resign' });
    finish(3 - loser, (loser === 1 ? L('黑', 'Black') : L('白', 'White')) + L('認輸', ' resigned'), false);
  };
  $('bConfirm').onclick = confirmScore;
  $('bResume').onclick = function () { S.phase = 'play'; S.passes = 0; $('scorebar').hidden = true; draw(); ui(); if (S.mode === 'ai' && S.bd.turn !== S.me) botTurn(); };

  // ---------- 線上 ----------
  function myName() { var n = K.load('sc_lb_name', ''); return (typeof n === 'string' && n.trim()) ? n.trim().slice(0, 16) : ''; }
  function startNet(conn) {
    leaveNet(true); NET = conn; NET.game = 0;
    conn.send({ t: 'hi', name: myName() });
    conn.onData = function (m) {
      if (!m) return;
      if (m.t === 'hi') { NET.oppName = String(m.name || '').slice(0, 16) || L('對手', 'Opponent'); ui(); }
      else if (m.t === 'start') { newGame({ mode: 'net', n: [9, 13, 19].indexOf(m.n) >= 0 ? m.n : 9, me: m.hostBlack ? 2 : 1 }); K.toast(S.me === 1 ? L('你執黑先下', 'You are Black — you move first') : L('你執白', 'You are White')); }
      else if (m.t === 'mv') { if (S && S.mode === 'net' && S.bd.turn !== S.me && m.n === S.bd.moves + 1) move(m.i, true); }
      else if (m.t === 'score') { if (S && S.mode === 'net') { S.phase = 'score'; thinking = false; S.dead = (m.dead || []).filter(function (x) { return typeof x === 'number'; }); showScore(); } }
      else if (m.t === 'final') { if (S && !S.over) finish(m.w === 2 ? 2 : 1, String(m.note || ''), false); }
      else if (m.t === 'resign') { if (S && !S.over) { K.toast(L('對手認輸了', 'Your opponent resigned')); finish(S.me, L('對手認輸', 'Opponent resigned'), false); } }
      else if (m.t === 'again') { if (conn.role === 'host') hostStart(); else K.toast(L('對手想再來一局', 'Your opponent wants a rematch')); }
    };
    conn.onClose = function () {
      if (NET !== conn) return;
      NET = null; K.toast(L('對手已離線', 'Your opponent left'), 3000);
      if (S && S.mode === 'net' && !S.over) finish(S.me, L('對手離線', 'Opponent left'), false);
      ui();
    };
    if (conn.role === 'host') hostStart(); else $('status').textContent = L('等待開局…', 'Waiting…');
  }
  function hostStart() {
    if (!NET) return;
    NET.game++; var hostBlack = NET.game % 2 === 1, n = pick.n;
    NET.send({ t: 'start', g: NET.game, n: n, hostBlack: hostBlack });
    newGame({ mode: 'net', n: n, me: hostBlack ? 1 : 2 });
  }
  function leaveNet(silent) { if (!NET) return; var c = NET; NET = null; c.onClose = null; c.close(); if (!silent) K.toast(L('已離開線上對戰', 'Left the online game')); }
  function openOnline(code) { if (window.SCNet) SCNet.openLobby({ game: GAME, title: L('圍棋', 'Go') + '（' + pick.n + L(' 路）', '×' + pick.n + ')'), code: code, autoJoin: !!code, onReady: startNet }); }
  $('bOnline').onclick = function () {
    if (!NET) { openOnline(); return; }
    if (!(Date.now() - (window._goask || 0) < 2500)) { window._goask = Date.now(); K.toast(L('再按一次離開線上對戰', 'Tap again to leave the online game')); return; }
    leaveNet(); newGame({ mode: 'ai', n: 9, me: 1, lv: 'normal' });
  };
  $('bAgain').onclick = function () {
    K.close('ovEnd');
    if (S.mode === 'net') { if (!NET) return; if (NET.role === 'host') hostStart(); else NET.send({ t: 'again' }); return; }
    newGame({ mode: S.mode, n: S.n, me: S.me, lv: S.lv });
  };

  // ---------- 開新局 ----------
  function chips(id, key, attr) {
    var box = $(id);
    box.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; pick[key] = attr === 'm' ? b.dataset.m : +b.dataset[attr]; [].forEach.call(box.children, function (x) { x.classList.toggle('on', x === b); }); syncNew(); });
  }
  chips('modeChips', 'mode', 'm'); chips('sizeChips', 'n', 's'); chips('colChips', 'col', 'c');
  function syncNew() {
    var ai = pick.mode === 'ai';
    if (ai && pick.n === 19) { pick.n = 13; [].forEach.call($('sizeChips').children, function (x) { x.classList.toggle('on', +x.dataset.s === 13); }); }
    $('aiOpts').style.display = ai ? '' : 'none';
    $('sizeChips').querySelector('[data-s="19"]').disabled = ai;
    $('sizeNote').textContent = ai ? L('對戰電腦提供 9 路與 13 路；19 路可以雙人同機或線上對戰。', 'The computer plays 9×9 and 13×13; 19×19 is for two players or online.') : L('線上對戰會用這裡選的棋盤大小。', 'Online games use the board size chosen here.');
  }
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = '';
    Object.keys(LV).forEach(function (k) { var b = document.createElement('button'); b.textContent = L(LV[k][0], LV[k][1]); b.className = k === pick.lv ? 'on' : ''; b.onclick = function () { pick.lv = k; [].forEach.call(ch.children, function (x) { x.classList.toggle('on', x === b); }); }; ch.appendChild(b); });
    syncNew(); K.open('ovNew');
  }
  $('bGo').onclick = function () { K.close('ovNew'); if (NET) leaveNet(); newGame({ mode: pick.mode, n: pick.n, me: pick.col, lv: pick.lv }); };
  $('bNew').onclick = function () {
    if (S && S.mode === 'net' && NET && !S.over) { K.toast(L('線上對局中，請先認輸或離開線上', 'Resign or leave online first')); return; }
    openNew();
  };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', resize);
  if (window.SC) SC.onLang(function () { ui(); if (S && S.phase === 'score') showScore(); });
  if (location.hash.indexOf('#test') === 0) window.__go = { S: function () { return S; }, move: function (i) { return move(i); }, E: E, confirm: confirmScore };

  if (!resume()) newGame({ mode: 'ai', n: 9, me: 1, lv: 'normal' });
  var room = window.SCNet && SCNet.roomFromUrl();
  if (room) { SCNet.clearRoomFromUrl(); openOnline(room); }
})();
