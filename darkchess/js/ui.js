/* 暗棋破壞神 - 畫面、操作、中英切換、線上對戰 */
(function () {
  'use strict';
  const D = window.DC, $ = id => document.getElementById(id);
  const L = (zh, en) => (window.SC && SC.lang === 'en') ? en : zh;
  const KEY = { save: 'dc_save_v1', stats: 'dc_stats_v1', pref: 'dc_pref_v1' };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } };
  const LV_IDS = ['easy', 'normal', 'hard', 'master'];
  const LV_NAME = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'], master: ['大師', 'Master'] };
  const LV_DESC = { easy: ['隨便翻、常失誤', 'Flips at random'], normal: ['會看兩步', 'Looks 2 moves ahead'], hard: ['會算翻棋風險', 'Weighs flip risks'], master: ['每步深算一秒', 'Deep search, 1 s/move'] };
  const TYPE_EN = ['General', 'Advisor', 'Elephant', 'Chariot', 'Horse', 'Cannon', 'Soldier'];
  const lvName = l => L(LV_NAME[l][0], LV_NAME[l][1]);
  const colName = c => L(D.COLOR_NAME[c] + '方', c === 0 ? 'Red' : 'Black');
  const pName = v => L(D.name(v), D.name(v) + ' (' + TYPE_EN[D.typeOf(v)] + ')');
  const pref = Object.assign({ level: 'normal', first: 'me', rookRun: false, mute: false }, load(KEY.pref, {}));
  const stats = load(KEY.stats, {});
  LV_IDS.concat(['online']).forEach(l => { stats[l] = Object.assign({ w: 0, l: 0, d: 0 }, stats[l] || {}); });
  const MAX_UNDO = 3, MAX_HINT = 3;

  // G.me / G.opp：本機玩家與對手在引擎裡的編號（對戰電腦時我=0；線上房主=0、加入者=1）
  let G = null, busy = false, sel = -1, hintCells = [], els = {}, orient = 'L', cell = 64, NET = null;
  const board = $('board'), wrap = $('wrap');

  /* ---------- 音效 ---------- */
  let AC = null;
  function tone(f, d, type, vol, slide, delay) {
    if (pref.mute) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) { /* 沒聲音也能玩 */ }
  }
  function noise(d, vol) {
    if (pref.mute) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const n = AC.sampleRate * d, buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = vol || 0.2; s.buffer = buf; s.connect(g); g.connect(AC.destination); s.start();
    } catch (e) { /* 略過 */ }
  }
  const SFX = {
    flip: () => { noise(0.06, 0.25); tone(900, 0.06, 'triangle', 0.06); },
    move: () => { tone(220, 0.09, 'sine', 0.18, 0.7); noise(0.03, 0.12); },
    cap: () => { tone(110, 0.35, 'sawtooth', 0.12, 0.4); noise(0.25, 0.35); },
    big: () => { [196, 147, 98].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.1, 0.6, i * 0.12)); noise(0.5, 0.3); },
    sel: () => tone(660, 0.05, 'triangle', 0.05),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 1, i * 0.12)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sine', 0.1, 1, i * 0.18)),
    bad: () => tone(160, 0.12, 'square', 0.05),
    ding: () => { tone(880, 0.12, 'triangle', 0.08); tone(1320, 0.18, 'triangle', 0.08, 1, 0.1); }
  };

  /* ---------- 特效 ---------- */
  const fx = $('fx'), fc = fx.getContext('2d'); let parts = [], fxOn = false, last = 0;
  function fxSize() { const r = wrap.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); fx.width = (r.width + 120) * dpr; fx.height = (r.height + 120) * dpr; fc.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function startFx() { if (!fxOn) { fxOn = true; last = 0; requestAnimationFrame(tick); } }
  function burst(i, colors, n, power) {
    const p = center(i);
    for (let k = 0; k < (n || 28); k++) { const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * (power || 260); parts.push({ x: p.x + 60, y: p.y + 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 2 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 0.6 + Math.random() * 0.5, t: 0, c: colors[k % colors.length], sq: Math.random() < 0.6 }); }
    startFx();
  }
  function confetti() { const r = wrap.getBoundingClientRect(); for (let k = 0; k < 120; k++) parts.push({ x: 60 + Math.random() * r.width, y: 40 - Math.random() * 120, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 140, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 2.5 + Math.random(), t: 0, c: ['#f0b44c', '#c0392b', '#ffe6a8', '#35e08a', '#5ab4ff'][k % 5], sq: true, g: 60 }); startFx(); }
  function tick(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
    fc.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter(p => (p.t += dt) < p.life);
    for (const p of parts) {
      p.vy += (p.g || 600) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      fc.globalAlpha = Math.max(0, 1 - p.t / p.life); fc.fillStyle = p.c; fc.save(); fc.translate(p.x, p.y); fc.rotate(p.rot);
      if (p.sq) fc.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { fc.beginPath(); fc.arc(0, 0, p.r, 0, 7); fc.fill(); }
      fc.restore();
    }
    fc.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(tick); else { fxOn = false; fc.clearRect(0, 0, fx.width, fx.height); }
  }

  /* ---------- 版面 ---------- */
  function pos(i) { const r = (i / 8) | 0, c = i % 8; return orient === 'L' ? { x: c, y: r } : { x: r, y: c }; }
  function center(i) { const p = pos(i), pad = cell * 0.12; return { x: pad + (p.x + 0.5) * cell, y: pad + (p.y + 0.5) * cell }; }
  function layout() {
    const W = Math.min(document.querySelector('.game').clientWidth - 24, 940);
    const used = ['pAI', 'pMe', 'status'].reduce((a, id) => a + $(id).offsetHeight, 0) + document.querySelector('.tools').offsetHeight + document.querySelector('.top').offsetHeight + 80;
    const H = Math.max(240, window.innerHeight - used);
    const cl = Math.min(W / 8.3, H / 4.3), cp = Math.min(W / 4.3, H / 8.3);
    const o = cp > cl * 1.2 ? 'P' : 'L';
    cell = Math.floor(Math.max(34, Math.min(104, o === 'L' ? cl : cp))); orient = o;
    const pad = Math.round(cell * 0.12), cols = o === 'L' ? 8 : 4, rows = o === 'L' ? 4 : 8;
    const st = document.documentElement.style;
    st.setProperty('--cell', cell + 'px'); st.setProperty('--pc', Math.round(cell * 0.86) + 'px'); st.setProperty('--pad', pad + 'px');
    board.style.width = (cols * cell + pad * 2) + 'px'; board.style.height = (rows * cell + pad * 2) + 'px';
    for (let i = 0; i < 32; i++) { const p = pos(i), c = cells[i]; c.style.left = (pad + p.x * cell) + 'px'; c.style.top = (pad + p.y * cell) + 'px'; }
    Object.keys(els).forEach(id => place(els[id], els[id].sq));
    fxSize();
  }
  function place(e, i) { const p = pos(i), pad = cell * 0.12, off = (cell - cell * 0.86) / 2; e.style.left = (pad + p.x * cell + off) + 'px'; e.style.top = (pad + p.y * cell + off) + 'px'; e.sq = i; }

  /* ---------- 棋子元素 ---------- */
  const cells = [];
  for (let i = 0; i < 32; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.i = i; board.appendChild(c); cells.push(c); }
  board.addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) tap(+c.dataset.i); });
  const isUp = v => v >= 0 && v < 14;
  function makePiece(id, i, v) {
    const e = document.createElement('div'); e.className = 'pc'; e.innerHTML = '<div class="in"><div class="f back"></div><div class="f front"><span></span></div></div>';
    e.dataset.id = id; board.appendChild(e); els[id] = e; place(e, i); if (isUp(v)) reveal(e, v, true); return e;
  }
  function reveal(e, v, instant) {
    e.querySelector('.front span').textContent = D.name(v); e.classList.add(D.colorOf(v) === 0 ? 'red' : 'black');
    if (instant) { e.querySelector('.in').style.transition = 'none'; e.classList.add('up'); void e.offsetWidth; e.querySelector('.in').style.transition = ''; } else e.classList.add('up');
  }
  function rebuild() { Object.keys(els).forEach(id => els[id].remove()); els = {}; G.s.board.forEach((v, i) => { if (v !== -1) makePiece(G.ids[i], i, v); }); paint(); }

  /* ---------- 介面 ---------- */
  const online = () => G && G.mode === 'online';
  const oppName = () => online() ? L('對手', 'Opponent') : L('破壞神', 'Destroyer');
  const colorTxt = c => c < 0 ? '' : '<span class="dot" style="background:' + (c === 0 ? '#c0392b' : '#222') + ';border:1px solid #888"></span>' + colName(c);
  function paint() {
    if (!G) return;
    const s = G.s, b = s.board, me = G.me, op = G.opp;
    cells.forEach(c => { c.className = 'cell'; });
    Object.keys(els).forEach(id => els[id].classList.remove('sel'));
    if (s.last) { if (s.last.k === 'move') { cells[s.last.f].classList.add('last-f'); cells[s.last.t].classList.add('last-t'); } else cells[s.last.i].classList.add('last-t'); }
    hintCells.forEach(i => cells[i].classList.add('hint'));
    if (sel >= 0) {
      const e = els[G.ids[sel]]; if (e) e.classList.add('sel');
      D.legalActions(s).forEach(a => { if (a.k === 'move' && a.f === sel) cells[a.t].classList.add(b[a.t] === -1 ? 'tgt' : 'cap'); });
    }
    $('aiName').textContent = oppName();
    $('aiFace').classList.toggle('net', online());
    $('aiLvl').textContent = online() ? (NET && NET.open ? L('● 已連線', '● Online') : L('○ 離線', '○ Offline')) : lvName(G.level) + (G.rookRun ? L('・車直衝', ' · Rook rush') : '');
    $('aiLvl').classList.toggle('on', online() && !!(NET && NET.open));
    $('aiCol').innerHTML = s.colorOf[op] < 0 ? L('尚未決定顏色', 'Color not decided') : colorTxt(s.colorOf[op]);
    $('meCol').innerHTML = s.colorOf[me] < 0 ? L('翻開第一枚棋子決定你的顏色', 'Your first flip decides your color') : colorTxt(s.colorOf[me]);
    $('meName').textContent = L('你', 'You');
    const tray = (el, list) => { el.innerHTML = list.map(v => '<span class="mini" style="color:' + (D.colorOf(v) === 0 ? '#c0261a' : '#16181d') + '">' + D.name(v) + '</span>').join(''); };
    tray($('trayAI'), s.captured[op]); tray($('trayMe'), s.captured[me]);
    $('pAI').classList.toggle('turn', !G.over && s.side === op); $('pMe').classList.toggle('turn', !G.over && s.side === me);
    let msg;
    if (G.over) msg = G.overText;
    else if (s.side === op) msg = online() ? L('等待對手…', 'Waiting for opponent…') : L('破壞神思考中…', 'The Destroyer is thinking…');
    else msg = s.colorOf[me] < 0 ? L('輪到你：點任一枚蓋著的棋子翻開', 'Your turn: tap any face-down piece to flip it') : L('輪到你（' + colName(s.colorOf[me]) + '）：翻棋或走棋', 'Your turn (' + colName(s.colorOf[me]) + '): flip or move');
    const left = s.drawLimit - s.noProgress;
    $('status').innerHTML = msg + (!G.over && left <= 15 ? '<small>' + L('⚠ 再 ' + left + ' 步沒有翻棋或吃子就和局', '⚠ Draw in ' + left + ' moves without a flip or capture') + '</small>' : '');
    $('undoN').textContent = '(' + G.undoLeft + ')'; $('hintN').textContent = '(' + G.hintLeft + ')';
    $('bUndo').style.display = $('bHint').style.display = online() ? 'none' : '';
    $('emotes').style.display = online() && NET && NET.open ? '' : 'none';
    $('bUndo').disabled = busy || G.undoLeft <= 0 || !G.stack.length; $('bHint').disabled = busy || G.over || G.hintLeft <= 0 || s.side !== me;
    $('bResign').disabled = busy || G.over || s.colorOf[0] < 0;
    if (!resignArm) $('bResign').textContent = L('🏳 認輸', '🏳 Resign');
    $('bOnline').textContent = online() && !G.over ? L('🌐 離開對戰', '🌐 Leave') : L('🌐 線上對戰', '🌐 Online');
  }
  let toastT = 0;
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1400); }
  const LINES = {
    start: [['準備好被破壞了嗎？', 'Ready to be destroyed?'], ['今天的棋盤，由我來毀滅。', 'This board is mine to wreck today.'], ['翻吧，命運在等你。', 'Flip. Fate is waiting.'], ['來吧，讓我看看你的本事。', 'Come on, show me what you got.']],
    eat: [['哈哈，吃掉了！', 'Ha! Gotcha!'], ['這枚棋子歸我了。', 'That piece is mine now.'], ['破壞完成！', 'Destroyed!'], ['太嫩了。', 'Too easy.'], ['再送幾枚過來吧。', 'Send me more, please.']],
    hurt: [['可惡……', 'Grr…'], ['你竟敢！', 'How dare you!'], ['只是小傷。', 'Just a scratch.'], ['下一步我就討回來。', 'I will get that back.'], ['有兩下子嘛。', 'Not bad.']],
    king: [['我的主帥……不！！', 'My General… NO!!'], ['這不可能！', 'Impossible!']],
    win: [['一切都被破壞了，哈哈哈！', 'Everything destroyed! Hahaha!'], ['破壞神，無人能擋。', 'No one stops the Destroyer.']],
    lose: [['怎麼可能……我竟然輸了。', 'How… how did I lose?'], ['你……才是真正的破壞神。', 'You… are the real Destroyer.']],
    draw: [['哼，算你走運。', 'Hmph. Lucky you.'], ['這局先放你一馬。', 'I will let you off this time.']]
  };
  const sayT = { ai: 0, me: 0 };
  function bubble(who, text, mood) {
    const e = $(who === 'me' ? 'meSay' : 'aiSay'); e.textContent = text; e.classList.add('on');
    const face = $('aiFace'); if (who !== 'me') { face.classList.remove('mad', 'happy'); if (mood) face.classList.add(mood); }
    clearTimeout(sayT[who]); sayT[who] = setTimeout(() => { e.classList.remove('on'); if (who !== 'me') face.classList.remove('mad', 'happy'); }, 2600);
  }
  function say(kind, mood) { if (online()) return; const arr = LINES[kind], x = arr[(Math.random() * arr.length) | 0]; bubble('ai', L(x[0], x[1]), mood); }

  /* ---------- 存檔（只存對戰電腦）---------- */
  function save() { if (!G || online()) return; store(KEY.save, { s: G.s, ids: G.ids, level: G.level, rookRun: G.rookRun, undoLeft: G.undoLeft, hintLeft: G.hintLeft, over: G.over, overText: G.overText }); }

  /* ---------- 對戰電腦 ---------- */
  function fresh(s, mode, me, extra) { return Object.assign({ s, ids: s.board.map((v, i) => i), mode, me, opp: 1 - me, level: pref.level, rookRun: s.rookRun, undoLeft: MAX_UNDO, hintLeft: MAX_HINT, stack: [], over: false, overText: '' }, extra || {}); }
  function newGame() {
    leaveOnline(true);
    const first = pref.first === 'rand' ? (Math.random() < 0.5 ? 0 : 1) : pref.first === 'ai' ? 1 : 0;
    G = fresh(D.newGame({ first, rookRun: pref.rookRun }), 'ai', 0);
    if (window.SCLB) SCLB.start('darkchess', G.level);
    sel = -1; hintCells = []; busy = false; rebuild(); layout(); save();
    say('start'); toast(first === 0 ? L('你先翻棋', 'You flip first') : L('破壞神先手', 'The Destroyer goes first'));
    if (window.SC) SC.post('gamestart', { level: G.level });
    next();
  }
  function next() {
    paint();
    if (online()) { if (NET && NET.role === 'host') { const st = D.status(G.s); if (st !== 'play') finish(st); } return; }
    const st = D.status(G.s);
    if (st !== 'play') return finish(st);
    if (G.s.side === G.opp) aiTurn();
  }
  function aiTurn() {
    busy = true; $('aiFace').classList.add('think'); paint();
    const t0 = Date.now(), myGame = G;
    setTimeout(() => {
      if (G !== myGame) return;
      const r = D.think(G.s, G.level);
      const wait = Math.max(0, 550 - (Date.now() - t0));
      setTimeout(() => { if (G !== myGame) return; $('aiFace').classList.remove('think'); busy = false; act(r.act); }, wait);
    }, 60);
  }

  /* ---------- 執行一步（本機或網路來的）---------- */
  function act(a, revealed) {
    const s0 = G.s, mover = s0.side;
    if (!online() && mover === G.me) { G.stack.push({ s: s0, ids: G.ids.slice() }); if (G.stack.length > 20) G.stack.shift(); }
    let src = s0;
    if (a.k === 'flip' && revealed != null) { src = D.clone(s0); src.board[a.i] = D.HID + revealed; } // 加入者：由房主告知翻出什麼
    const { state, info } = D.apply(src, a);
    hintCells = []; sel = -1;
    if (a.k === 'flip') {
      const e = els[G.ids[a.i]]; reveal(e, info.revealed); SFX.flip(); burst(a.i, ['#fff6d8', '#f0b44c'], 10, 120);
      if (D.typeOf(info.revealed) === D.K) { e.classList.add('boss'); toast(L(D.name(info.revealed) + ' 現身！', D.name(info.revealed) + ' appears!')); }
      if (info.assigned) setTimeout(() => toast(L('你是' + colName(state.colorOf[G.me]), 'You are ' + colName(state.colorOf[G.me]))), D.typeOf(info.revealed) === D.K ? 1300 : 0);
    } else {
      const mid = G.ids[a.f], dead = G.ids[a.t];
      G.ids[a.t] = mid; G.ids[a.f] = -1;
      place(els[mid], a.t);
      if (info.captured != null) {
        const de = els[dead], v = info.captured, big = D.typeOf(v) <= D.A;
        setTimeout(() => {
          if (de) { de.classList.add('dead'); setTimeout(() => de.remove(), 320); delete els[dead]; }
          burst(a.t, D.colorOf(v) === 0 ? ['#c0261a', '#ff7b5a', '#fdf3dc', '#f0b44c'] : ['#16181d', '#555', '#fdf3dc', '#f0b44c'], big ? 46 : 28, big ? 380 : 260);
          board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake');
          if (big) { SFX.big(); toast(L('吃掉 ', 'Captured ') + pName(v) + '!'); } else SFX.cap();
        }, 180);
        if (mover === G.opp) { if (big || Math.random() < 0.45) say('eat', 'happy'); }
        else if (D.typeOf(v) === D.K) say('king', 'mad'); else if (big || Math.random() < 0.35) say('hurt', 'mad');
      } else SFX.move();
    }
    G.s = state;
    if (online() && NET && NET.role === 'host') { const st = D.status(state); NET.send({ t: 'apply', a, rev: a.k === 'flip' ? info.revealed : null, st }); }
    if (online() && mover === G.opp) SFX.ding();
    save(); next();
  }
  function finish(st, quiet) {
    if (G.over) return;
    G.over = true; busy = false;
    const me = G.me; let res;
    if (st === 'draw') { res = 'd'; G.overText = L('和局：連續 ' + G.s.drawLimit + ' 步沒有翻棋或吃子', 'Draw: ' + G.s.drawLimit + ' moves without a flip or capture'); say('draw'); }
    else if (st.winner === me) {
      res = 'w';
      if (st.reason === 'resign') G.overText = L('對手認輸，你贏了！', 'Your opponent resigned. You win!');
      else if (st.reason === 'left') G.overText = L('對手已離線，對局結束', 'Opponent disconnected. Game over');
      else G.overText = L('你贏了！', 'You win! ') + (st.reason === 'stuck' ? L(oppName() + '無棋可走', oppName() + ' has no moves') : L('對手棋子全滅', 'All enemy pieces captured'));
      if (st.reason !== 'left') { say('lose', 'mad'); SFX.win(); confetti(); }
    } else {
      res = 'l';
      G.overText = st.reason === 'resign' ? L('你認輸了', 'You resigned') : L('你輸了…', 'You lost… ') + (st.reason === 'stuck' ? L('你無棋可走', 'You have no moves') : L('你的棋子全滅', 'All your pieces captured'));
      say('win', 'happy'); SFX.lose();
    }
    const bucket = online() ? 'online' : G.level;
    if (!quiet) { stats[bucket][res]++; store(KEY.stats, stats); }
    save(); paint();
    if (window.SC) SC.post('gameover', { result: res, mode: G.mode, level: G.level });
    G.res = res;
    if (!quiet) setTimeout(() => showEnd(res), 900);
    if (!quiet && res === 'w' && !online() && window.SCLB && SCLB.has('darkchess', G.level)) { const sec = SCLB.elapsed('darkchess'); setTimeout(() => SCLB.offer({ game: 'darkchess', mode: G.level, score: sec, text: lvName(G.level) + L('・' + sec + ' 秒獲勝', ' · won in ' + sec + ' s') }), 2200); }
  }
  function showEnd(res) {
    if (!G.over) return;
    $('endEmoji').textContent = res === 'w' ? '🏆' : res === 'l' ? '💥' : '🤝';
    $('endTitle').textContent = online() ? (res === 'w' ? L('你贏了！', 'You win!') : res === 'l' ? L('你輸了', 'You lost') : L('和局', 'Draw'))
      : (res === 'w' ? L('你擊敗了破壞神！', 'You beat the Destroyer!') : res === 'l' ? L('被破壞神擊敗了', 'The Destroyer wins') : L('平分秋色', 'It\'s a draw'));
    $('endText').textContent = G.overText + (online() ? L('（線上對戰）', ' (online)') : L('（難度：' + lvName(G.level) + '）', ' (' + lvName(G.level) + ')'));
    const st = stats[online() ? 'online' : G.level];
    $('endStats').innerHTML = '<div><b>' + st.w + '</b><span>' + L('勝', 'Wins') + '</span></div><div><b>' + st.l + '</b><span>' + L('敗', 'Losses') + '</span></div><div><b>' + st.d + '</b><span>' + L('和', 'Draws') + '</span></div>';
    $('bAgain').textContent = online() ? (NET && NET.open ? L('再來一局', 'Rematch') : L('對戰電腦', 'Play the AI')) : L('再來一局', 'Play again');
    $('bChange').style.display = online() ? 'none' : '';
    open('ovEnd');
  }

  /* ---------- 線上對戰 ---------- */
  function leaveOnline(silent) { if (NET) { const n = NET; NET = null; n.onClose = null; n.close(); if (!silent) toast(L('已離開線上對戰', 'Left online game')); } }
  function startOnline(conn) {
    leaveOnline(true); NET = conn; busy = false;
    conn.onClose = () => {
      if (NET !== conn) return; NET = null;
      toast(L('對手已離線', 'Opponent disconnected'));
      if (G && online() && !G.over) finish({ winner: G.me, reason: 'left' }, true);
      paint();
    };
    conn.onData = onNet;
    if (conn.role === 'host') hostNewGame(Math.random() < 0.5 ? 0 : 1);
    else { conn.send({ t: 'hello', v: 1 }); const s = D.newGame({}); s.board = s.board.map(() => D.UNKNOWN); G = fresh(s, 'online', 1, { over: true, overText: L('等待房主開局…', 'Waiting for host…') }); rebuild(); layout(); }
    if (window.SC) SC.post('online', { role: conn.role });
  }
  const mask = s => { const m = D.clone(s); m.board = m.board.map(v => v >= D.HID ? D.UNKNOWN : v); m.history = []; return m; };
  function hostNewGame(first) {
    const s = D.newGame({ first, rookRun: false });
    G = fresh(s, 'online', 0, { first }); sel = -1; hintCells = []; busy = false; rebuild(); layout(); closeAll();
    NET.send({ t: 'start', s: mask(s), first, ids: G.ids });
    toast(first === 0 ? L('你先翻棋', 'You flip first') : L('對手先手', 'Opponent goes first'));
    next();
  }
  function onNet(m) {
    if (!m || !m.t) return;
    const host = NET && NET.role === 'host';
    if (m.t === 'start' && !host) {
      G = fresh(m.s, 'online', 1, { first: m.first }); if (m.ids) G.ids = m.ids; sel = -1; hintCells = []; busy = false; rebuild(); layout(); closeAll();
      toast(m.first === 1 ? L('你先翻棋', 'You flip first') : L('對手先手', 'Opponent goes first')); SFX.ding(); paint();
    } else if (m.t === 'hello' && host) {
      if (G && online()) NET.send({ t: 'start', s: mask(G.s), first: G.first, ids: G.ids });
    } else if (m.t === 'act' && host) {
      if (!G || G.over || G.s.side !== G.opp || !D.isLegal(G.s, m.a)) return;
      act(m.a);
    } else if (m.t === 'apply' && !host) {
      if (!G || G.over) return;
      busy = false; act(m.a, m.rev);
      if (m.st && m.st !== 'play') finish(m.st);
    } else if (m.t === 'resign') {
      if (host && G && !G.over) { const st = { winner: G.me, reason: 'resign' }; NET.send({ t: 'end', st }); finish(st); }
    } else if (m.t === 'end' && !host) {
      if (G && !G.over) finish(m.st);
    } else if (m.t === 'rematch') {
      if (host) hostNewGame(G && G.first === 0 ? 1 : 0); else toast(L('對手想再來一局', 'Opponent wants a rematch'));
    } else if (m.t === 'emo') { bubble('ai', String(m.e).slice(0, 4)); SFX.sel(); }
  }
  $('emotes').innerHTML = (window.SCNet ? SCNet.EMOTES : []).map(e => '<button type="button">' + e + '</button>').join('');
  $('emotes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !NET) return; NET.send({ t: 'emo', e: b.textContent }); bubble('me', b.textContent); });
  function openLobby(code) {
    if (!window.SCNet) return;
    closeAll();
    SCNet.openLobby({ game: 'darkchess', title: L('暗棋破壞神', 'Dark Chess'), code, autoJoin: !!code, onReady: startOnline });
  }
  $('bOnline').onclick = () => {
    if (online() && G && !G.over) {
      if (confirmTwice('bOnline')) { if (NET) NET.send({ t: 'resign' }); leaveOnline(); finish({ winner: G.opp, reason: 'resign' }); }
      return;
    }
    if (online() && NET) { leaveOnline(); paint(); setup(); return; }
    openLobby();
  };

  /* ---------- 玩家操作 ---------- */
  function tap(i) {
    if (!G || busy || G.over || G.s.side !== G.me) { if (G && !G.over && G.s.side === G.opp) SFX.bad(); return; }
    const s = G.s, v = s.board[i], my = s.colorOf[G.me];
    const send = a => { if (online() && NET && NET.role === 'guest') { NET.send({ t: 'act', a }); busy = true; sel = -1; paint(); } else act(a); };
    if (v >= D.HID) { send({ k: 'flip', i }); return; }
    if (sel >= 0) {
      const a = D.legalActions(s).find(x => x.k === 'move' && x.f === sel && x.t === i);
      if (a) { send({ k: 'move', f: a.f, t: a.t, cap: a.cap }); return; }
    }
    if (isUp(v) && D.colorOf(v) === my) {
      sel = sel === i ? -1 : i; SFX.sel();
      if (sel >= 0 && !D.legalActions(s).some(x => x.k === 'move' && x.f === i)) toast(L('這枚棋子現在不能走', 'This piece cannot move now'));
    } else { if (isUp(v) && sel < 0 && my >= 0) toast(L('那是對手的棋子', 'That is your opponent\'s piece')); sel = -1; }
    paint();
  }
  $('bUndo').onclick = () => {
    if (busy || online() || !G.stack.length || G.undoLeft <= 0) return;
    const prev = G.stack.pop(); G.s = prev.s; G.ids = prev.ids; G.undoLeft--; G.over = false; G.overText = ''; sel = -1; hintCells = [];
    rebuild(); save(); toast(L('悔棋，剩 ' + G.undoLeft + ' 次', 'Undone. ' + G.undoLeft + ' left')); next();
  };
  $('bHint').onclick = () => {
    if (busy || online() || G.over || G.s.side !== G.me || G.hintLeft <= 0) return;
    busy = true; $('status').textContent = L('思考提示中…', 'Thinking of a hint…');
    setTimeout(() => {
      const r = D.think(G.s, 'hard'); busy = false; G.hintLeft--;
      hintCells = r.act.k === 'flip' ? [r.act.i] : [r.act.f, r.act.t]; sel = r.act.k === 'move' ? r.act.f : -1;
      toast(r.act.k === 'flip' ? L('建議：翻這一枚', 'Hint: flip this one') : L('建議：走這一步', 'Hint: play this move')); save(); paint();
    }, 40);
  };
  let resignArm = 0;
  function confirmTwice(id) {
    if (!resignArm) { resignArm = setTimeout(() => { resignArm = 0; paint(); }, 3000); $(id).textContent = L('再按一次確認', 'Tap again to confirm'); return false; }
    clearTimeout(resignArm); resignArm = 0; return true;
  }
  $('bResign').onclick = () => {
    if (busy || G.over) return;
    if (!confirmTwice('bResign')) return;
    if (online() && NET) { if (NET.role === 'host') { const st = { winner: G.opp, reason: 'resign' }; NET.send({ t: 'end', st }); finish(st); } else { NET.send({ t: 'resign' }); finish({ winner: G.opp, reason: 'resign' }); } return; }
    finish({ winner: G.opp, reason: 'resign' });
  };

  /* ---------- 視窗 ---------- */
  function open(id) { closeAll(); $(id).classList.add('on'); }
  function close(id) { $(id).classList.remove('on'); }
  function closeAll() { document.querySelectorAll('.ov.on').forEach(o => o.classList.remove('on')); }
  document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => b.closest('.ov').classList.remove('on'); });
  function fillSetup() {
    const lc = $('lvChips');
    lc.innerHTML = LV_IDS.map(l => { const s = stats[l]; return '<button data-v="' + l + '">' + lvName(l) + '<small>' + L(LV_DESC[l][0], LV_DESC[l][1]) + '</small><small>' + L('戰績 ' + s.w + '勝 ' + s.l + '敗 ' + s.d + '和', s.w + 'W ' + s.l + 'L ' + s.d + 'D') + '</small></button>'; }).join('');
    const mark = () => { lc.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pref.level)); $('firstChips').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pref.first)); };
    lc.querySelectorAll('button').forEach(b => { b.onclick = () => { pref.level = b.dataset.v; mark(); }; });
    $('firstChips').querySelectorAll('button').forEach(b => { b.onclick = () => { pref.first = b.dataset.v; mark(); }; });
    $('optRook').checked = pref.rookRun; mark();
  }
  function setup() { fillSetup(); $('bCancel').style.display = G && !G.over ? '' : 'none'; open('ovSetup'); }
  $('bStart').onclick = () => { pref.rookRun = $('optRook').checked; store(KEY.pref, pref); close('ovSetup'); newGame(); };
  $('bCancel').onclick = () => close('ovSetup');
  $('bSetupOnline').onclick = () => openLobby();
  $('bNew').onclick = () => { if (online() && G && !G.over) { toast(L('請先離開線上對戰', 'Leave the online game first')); return; } setup(); };
  $('bAgain').onclick = () => {
    close('ovEnd');
    if (online()) { if (NET && NET.open) { if (NET.role === 'host') hostNewGame(G.first === 0 ? 1 : 0); else { NET.send({ t: 'rematch' }); toast(L('已邀請對手再來一局', 'Rematch requested')); } } else setup(); return; }
    newGame();
  };
  $('bChange').onclick = () => { close('ovEnd'); setup(); };
  $('bView').onclick = () => close('ovEnd');
  $('bRules').onclick = () => open('ovRules');
  const soundBtn = () => { $('bSound').textContent = pref.mute ? '🔇' : '🔊'; };
  $('bSound').onclick = () => { pref.mute = !pref.mute; store(KEY.pref, pref); soundBtn(); if (!pref.mute) SFX.sel(); };
  soundBtn();
  document.querySelectorAll('.ov').forEach(o => o.addEventListener('click', e => { if (e.target === o && o.id !== 'ovSetup') o.classList.remove('on'); }));

  if (window.SC) {
    SC.onBack(() => {
      const on = document.querySelector('.ov.on');
      if (on) { if (on.id === 'ovSetup' && (!G || G.over)) return false; on.classList.remove('on'); return true; }
      if (sel >= 0) { sel = -1; paint(); return true; }
      return false;
    });
    SC.onPause(save);
    SC.onLang(() => { paint(); if ($('ovSetup').classList.contains('on')) fillSetup(); if ($('ovEnd').classList.contains('on') && G.res) showEnd(G.res); layout(); });
  }
  window.addEventListener('pagehide', save);
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 80); });

  /* ---------- 啟動 ---------- */
  const sv = load(KEY.save, null), room = window.SCNet && SCNet.roomFromUrl();
  if (sv && sv.s && !sv.over && sv.s.board && sv.s.board.length === 32) {
    G = fresh(sv.s, 'ai', 0, { ids: sv.ids, level: sv.level, rookRun: sv.rookRun, undoLeft: sv.undoLeft, hintLeft: sv.hintLeft });
    rebuild(); layout(); if (!room) toast(L('繼續上一局', 'Resuming your last game')); next();
  } else {
    G = fresh(D.newGame({ first: 0 }), 'ai', 0, { over: true, overText: L('按「開始對局」挑戰破壞神', 'Press "Start" to challenge the Destroyer') });
    rebuild(); layout(); if (!room) setup();
  }
  if (room) { SCNet.clearRoomFromUrl(); openLobby(room); }
  window.DCUI = { get G() { return G; }, tap, layout, newGame, onNet, startOnline, get NET() { return NET; } };
})();
