/* stockcorp.github.io 共用：1 對 1 棋類框架（對電腦三種難度＋線上真人＋悔棋＋認輸＋排行榜）
   頁面需要的元素：#plB #plW #nmB #nmW #status #bUndo #undoN #bResign #bOnline #bNew #sub
                   #ovNew(#lvChips #colChips[data-c] #bGo)  #ovEnd(#endEmoji #endTitle #endNote #bAgain)
   用法：var D = Duel({
     game:'chess', title:['西洋棋','Chess'], lvs:{easy:[..],normal:[..],hard:[..]},
     init: function () { return state },            // 新局狀態，side 1 先手
     clone: function (st) { return copy },
     turn: function (st) { return 1|2 },
     play: function (st, mv) { return true/false },  // 合法就改 st 並回傳 true
     result: function (st) { return null | {w:0|1|2, note:'…'} },
     ai: function (st, side, lv, done) { done(mv) },  // 可以非同步
     draw: function () {}, onNew: function () {}, sideName: function (side) { return '…' }
   });
   D.S 目前狀態；D.me 自己是 1 或 2；D.myTurn()；D.human(mv) 送出玩家的一步。 */
(function () {
  'use strict';
  window.Duel = function (cfg) {
    var $ = K.$, L = K.L, GAME = cfg.game, LV = cfg.lvs;
    var D = { S: null, me: 1, mode: 'ai', lv: 'normal', over: false, thinking: false, hist: [], undo: 3, t0: 0, net: null };
    var pickLv = 'normal', pickCol = 1, gen = 0;

    function newGame(o) {
      gen++;
      D.S = cfg.init(); D.mode = o.mode; D.me = o.me || 1; D.lv = o.lv || 'normal';
      D.over = false; D.thinking = false; D.hist = []; D.undo = 3; D.t0 = Date.now(); D.n = 0;
      K.close('ovEnd');
      if (D.mode === 'ai') { $('bLb').href = '/leaderboard/?game=' + GAME + '&mode=' + D.lv; if (window.SCLB) SCLB.start(GAME, D.lv); if (window.SC) SC.post('start', { game: GAME, level: D.lv }); }
      if (cfg.onNew) cfg.onNew();
      cfg.draw(); ui();
      if (D.mode === 'ai' && cfg.turn(D.S) !== D.me) bot();
    }
    function apply(mv, fromNet) {
      if (!D.S || D.over) return false;
      var snap = cfg.clone(D.S), side = cfg.turn(D.S);
      if (!cfg.play(D.S, mv)) return false;
      D.hist.push({ st: snap, side: side }); D.n++;
      if (D.net && D.mode === 'net' && !fromNet) D.net.send({ t: 'mv', mv: mv, n: D.n });
      var r = cfg.result(D.S);
      cfg.draw(); ui();
      if (r) { finish(r.w, r.note || '', true); return true; }
      if (D.mode === 'ai' && cfg.turn(D.S) !== D.me) bot();
      return true;
    }
    function bot() {
      D.thinking = true; ui(); var g = gen;
      setTimeout(function () {
        if (g !== gen || D.over) { D.thinking = false; return; }
        cfg.ai(D.S, cfg.turn(D.S), D.lv, function (mv) { if (g !== gen) return; D.thinking = false; if (mv != null) apply(mv); else ui(); });
      }, 250 + Math.random() * 200);
    }
    function finish(w, note, natural) {
      D.over = true; D.thinking = false;
      var mine = w === D.me, t = Math.floor((Date.now() - D.t0) / 1000);
      $('endEmoji').textContent = !w ? '🤝' : mine ? '🏆' : '😵';
      $('endTitle').textContent = !w ? L('平手', 'Draw') : mine ? L('你贏了！', 'You win!') : D.mode === 'net' ? L('對手獲勝', 'Your opponent wins') : L('電腦獲勝', 'The computer wins');
      $('endNote').textContent = (note ? note + '　' : '') + (D.mode === 'ai' ? L(LV[D.lv][0], LV[D.lv][1]) + L('・用時 ', ' · ') + K.fmtTime(t) : '');
      $('bAgain').textContent = D.mode === 'net' ? L('再來一局（交換先後）', 'Rematch (swap sides)') : L('再來一局', 'Play again');
      K.beep(mine ? 660 : 260, 0.45, 'triangle', 0.07, mine ? 1320 : 130);
      if (window.SC) SC.post('gameover', { game: GAME, win: mine, online: D.mode === 'net' });
      cfg.draw(); ui();
      setTimeout(function () {
        K.open('ovEnd');
        if (mine && natural && D.mode === 'ai' && window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: D.lv, score: sec, text: L(LV[D.lv][0], LV[D.lv][1]) + ' ' + K.fmtTime(sec) }); }
      }, 900);
    }
    D.myTurn = function () { return D.S && !D.over && !D.thinking && cfg.turn(D.S) === D.me; };
    D.human = function (mv) { if (!D.myTurn()) return false; return apply(mv); };
    D.finish = finish;

    function ui() {
      if (!D.S) return;
      var opp = D.mode === 'net' ? (D.net && D.net.oppName || L('對手', 'Opponent')) : L('電腦', 'Computer') + '（' + L(LV[D.lv][0], LV[D.lv][1]) + '）';
      $('nmB').textContent = D.me === 1 ? L('你', 'You') : opp; $('nmW').textContent = D.me === 2 ? L('你', 'You') : opp;
      var tn = cfg.turn(D.S);
      $('plB').classList.toggle('turn', !D.over && tn === 1); $('plW').classList.toggle('turn', !D.over && tn === 2);
      $('status').textContent = D.over ? L('結束', 'Game over') : D.thinking ? L('電腦思考中…', 'Thinking…') : tn === D.me ? (cfg.statusMine ? cfg.statusMine() : L('輪到你', 'Your move')) : L('等對手…', 'Waiting…');
      $('undoN').textContent = D.undo; $('bUndo').style.display = D.mode === 'ai' ? '' : 'none';
      $('bUndo').disabled = D.over || D.thinking || !D.undo || !D.hist.length;
      $('bResign').disabled = D.over;
      $('sub').textContent = D.mode === 'net' ? L('🌐 線上對戰', '🌐 Online') : L('對戰電腦・', 'vs computer · ') + L(LV[D.lv][0], LV[D.lv][1]);
      $('bOnline').textContent = D.net ? L('🌐 離開線上', '🌐 Leave online') : L('🌐 線上對戰', '🌐 Online');
      if (cfg.ui) cfg.ui();
    }
    D.ui = ui;

    $('bUndo').onclick = function () {
      if (D.mode !== 'ai' || D.over || D.thinking || !D.undo || !D.hist.length) return;
      var h; do { h = D.hist.pop(); } while (D.hist.length && h.side !== D.me);
      if (h.side !== D.me) { D.hist.push(h); return; }
      D.S = h.st; D.undo--; gen++; if (cfg.onUndo) cfg.onUndo(); cfg.draw(); ui();
    };
    $('bResign').onclick = function () {
      if (!D.S || D.over) return;
      if (!(Date.now() - (D.askR || 0) < 2500)) { D.askR = Date.now(); K.toast(L('再按一次認輸', 'Tap again to resign')); return; }
      if (D.mode === 'net' && D.net) D.net.send({ t: 'resign' });
      finish(3 - D.me, L('認輸', 'Resigned'), false);
    };

    // ---------- 線上 ----------
    function myName() { var n = K.load('sc_lb_name', ''); return (typeof n === 'string' && n.trim()) ? n.trim().slice(0, 16) : ''; }
    function startNet(conn) {
      leaveNet(true); D.net = conn; conn.game = 0;
      conn.send({ t: 'hi', name: myName() });
      conn.onData = function (m) {
        if (!m) return;
        if (m.t === 'hi') { conn.oppName = String(m.name || '').slice(0, 16) || L('對手', 'Opponent'); ui(); }
        else if (m.t === 'start') { newGame({ mode: 'net', me: m.hostFirst ? 2 : 1 }); K.toast(D.me === 1 ? L('你先手', 'You move first') : L('對手先手', 'Your opponent moves first')); }
        else if (m.t === 'mv') { if (D.S && D.mode === 'net' && cfg.turn(D.S) !== D.me && m.n === D.n + 1) apply(m.mv, true); }
        else if (m.t === 'resign') { if (D.S && !D.over) { K.toast(L('對手認輸了', 'Your opponent resigned')); finish(D.me, L('對手認輸', 'Opponent resigned'), false); } }
        else if (m.t === 'again') { if (conn.role === 'host') hostStart(); else K.toast(L('對手想再來一局', 'Your opponent wants a rematch')); }
      };
      conn.onClose = function () { if (D.net !== conn) return; D.net = null; K.toast(L('對手已離線', 'Your opponent left'), 3000); if (D.S && D.mode === 'net' && !D.over) finish(D.me, L('對手離線', 'Opponent left'), false); ui(); };
      if (conn.role === 'host') hostStart(); else $('status').textContent = L('等待開局…', 'Waiting…');
    }
    function hostStart() { if (!D.net) return; D.net.game++; var hf = D.net.game % 2 === 1; D.net.send({ t: 'start', g: D.net.game, hostFirst: hf }); newGame({ mode: 'net', me: hf ? 1 : 2 }); }
    function leaveNet(silent) { if (!D.net) return; var c = D.net; D.net = null; c.onClose = null; c.close(); if (!silent) K.toast(L('已離開線上對戰', 'Left the online game')); }
    function openOnline(code) { if (window.SCNet) SCNet.openLobby({ game: GAME, title: L(cfg.title[0], cfg.title[1]), code: code, autoJoin: !!code, onReady: startNet }); }
    $('bOnline').onclick = function () {
      if (!D.net) { openOnline(); return; }
      if (!(Date.now() - (D.askL || 0) < 2500)) { D.askL = Date.now(); K.toast(L('再按一次離開線上對戰', 'Tap again to leave the online game')); return; }
      leaveNet(); newGame({ mode: 'ai', me: pickCol, lv: pickLv });
    };
    $('bAgain').onclick = function () {
      K.close('ovEnd');
      if (D.mode === 'net') { if (!D.net) return; if (D.net.role === 'host') hostStart(); else D.net.send({ t: 'again' }); return; }
      newGame({ mode: 'ai', me: D.me, lv: D.lv });
    };
    function openNew() {
      var ch = $('lvChips'); ch.innerHTML = '';
      Object.keys(LV).forEach(function (k) { var b = document.createElement('button'); b.textContent = L(LV[k][0], LV[k][1]); b.className = k === pickLv ? 'on' : ''; b.onclick = function () { pickLv = k; [].forEach.call(ch.children, function (x) { x.classList.toggle('on', x === b); }); }; ch.appendChild(b); });
      K.open('ovNew');
    }
    $('colChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; pickCol = +b.dataset.c; [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); });
    $('bGo').onclick = function () { K.close('ovNew'); if (D.net) leaveNet(); newGame({ mode: 'ai', me: pickCol, lv: pickLv }); };
    $('bNew').onclick = function () { if (D.mode === 'net' && D.net && !D.over) { K.toast(L('線上對局中，請先認輸或離開線上', 'Resign or leave online first')); return; } openNew(); };
    $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
    function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
    if (window.SC) SC.onLang(function () { ui(); cfg.draw(); });
    D.start = function () {
      newGame({ mode: 'ai', me: 1, lv: 'normal' });
      var room = window.SCNet && SCNet.roomFromUrl();
      if (room) { SCNet.clearRoomFromUrl(); openOnline(room); }
    };
    D.newGame = newGame;
    return D;
  };
})();
