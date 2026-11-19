/* 象棋 - 畫面、操作、中英切換、線上對戰 */
(function () {
  'use strict';
  const X = window.XQ, $ = id => document.getElementById(id);
  const L = (zh, en) => (window.SC && SC.lang === 'en') ? en : zh;
  const KEY = { save: 'xq_save_v1', stats: 'xq_stats_v1', pref: 'xq_pref_v1' };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } };
  const LV_IDS = ['easy', 'normal', 'hard', 'master'];
  const LV_NAME = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'], master: ['大師', 'Master'] };
  const LV_DESC = { easy: ['適合初學', 'For beginners'], normal: ['看三步', 'Looks 3 moves ahead'], hard: ['每步想 1 秒', '1 s per move'], master: ['每步深算 2.5 秒', '2.5 s deep search'] };
  const lvName = l => L(LV_NAME[l][0], LV_NAME[l][1]);
  const colName = c => L(c === 0 ? '紅方' : '黑方', c === 0 ? 'Red' : 'Black');
  const pName = v => L(X.name(v), X.name(v) + ' (' + X.EN[X.typeOf(v)] + ')');
  const pref = Object.assign({ level: 'normal', side: 'red', mute: false }, load(KEY.pref, {}));
  const stats = load(KEY.stats, {});
  LV_IDS.concat(['online']).forEach(l => { stats[l] = Object.assign({ w: 0, l: 0, d: 0 }, stats[l] || {}); });
  const MAX_UNDO = 3, MAX_HINT = 3;

  let G = null, busy = false, sel = -1, hintPts = [], els = {}, s = 48, m = 34, NET = null;
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
    } catch (e) { /* 略過 */ }
  }
  function noise(d, vol) {
    if (pref.mute) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const n = AC.sampleRate * d, buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const so = AC.createBufferSource(), g = AC.createGain(); g.gain.value = vol || 0.2; so.buffer = buf; so.connect(g); g.connect(AC.destination); so.start();
    } catch (e) { /* 略過 */ }
  }
  const SFX = {
    move: () => { tone(260, 0.08, 'sine', 0.2, 0.6); noise(0.04, 0.15); },
    cap: () => { tone(120, 0.3, 'sawtooth', 0.12, 0.4); noise(0.2, 0.35); },
    check: () => { [740, 988].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 1, i * 0.1)); },
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
    const p = pt(i);
    for (let k = 0; k < (n || 28); k++) { const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * (power || 260); parts.push({ x: p.x + 60, y: p.y + 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 2 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 0.6 + Math.random() * 0.5, t: 0, c: colors[k % colors.length], sq: Math.random() < 0.6 }); }
    startFx();
  }
  function confetti() { const r = wrap.getBoundingClientRect(); for (let k = 0; k < 120; k++) parts.push({ x: 60 + Math.random() * r.width, y: 40 - Math.random() * 120, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 140, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 2.5 + Math.random(), t: 0, c: ['#e9c46a', '#c0392b', '#ffe6a8', '#35e08a', '#5ab4ff'][k % 5], sq: true, g: 60 }); startFx(); }
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

  /* ---------- 棋盤座標與繪製 ---------- */
  const flipped = () => G && G.myColor === X.BLACK;
  function pt(i) { let r = (i / 9) | 0, c = i % 9; if (flipped()) { r = 9 - r; c = 8 - c; } return { x: m + c * s, y: m + r * s }; }
  function svgBoard() {
    const w = m * 2 + 8 * s, h = m * 2 + 9 * s, x = c => m + c * s, y = r => m + r * s, ln = (a, b, c2, d) => '<line x1="' + a + '" y1="' + b + '" x2="' + c2 + '" y2="' + d + '"/>';
    let g = '';
    for (let r = 0; r < 10; r++) g += ln(x(0), y(r), x(8), y(r));
    for (let c = 0; c < 9; c++) { if (c === 0 || c === 8) g += ln(x(c), y(0), x(c), y(9)); else { g += ln(x(c), y(0), x(c), y(4)); g += ln(x(c), y(5), x(c), y(9)); } }
    g += ln(x(3), y(0), x(5), y(2)) + ln(x(5), y(0), x(3), y(2)) + ln(x(3), y(7), x(5), y(9)) + ln(x(5), y(7), x(3), y(9));
    // 兵炮位置的記號
    const mark = (c, r) => { const k = s * 0.1, q = s * 0.22; let o = ''; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(d => { const cx = x(c) + d[0] * k, cy = y(r) + d[1] * k; if ((c === 0 && d[0] < 0) || (c === 8 && d[0] > 0)) return; o += '<polyline fill="none" points="' + (cx + d[0] * q) + ',' + cy + ' ' + cx + ',' + cy + ' ' + cx + ',' + (cy + d[1] * q) + '"/>'; }); return o; };
    [[1, 2], [7, 2], [1, 7], [7, 7]].forEach(p => { g += mark(p[0], p[1]); });
    for (let c = 0; c <= 8; c += 2) { g += mark(c, 3) + mark(c, 6); }
    const fs = s * 0.5, ty = y(4.5) + fs * 0.35;
    const txt = (t, cx, rot) => '<text x="' + cx + '" y="' + ty + '" font-size="' + fs + '" text-anchor="middle" fill="#7a4a1c" opacity=".75" font-family="Kaiti TC,STKaiti,DFKai-SB,BiauKai,serif" font-weight="900"' + (rot ? ' transform="rotate(180 ' + cx + ' ' + (y(4.5)) + ')"' : '') + '>' + t + '</text>';
    const river = txt('楚　河', x(2), flipped()) + txt('漢　界', x(6), !flipped());
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect x="' + (m - s * 0.18) + '" y="' + (m - s * 0.18) + '" width="' + (8 * s + s * 0.36) + '" height="' + (9 * s + s * 0.36) + '" fill="none" stroke="#5a3210" stroke-width="' + Math.max(2, s * 0.06) + '"/><g stroke="#5a3210" stroke-width="' + Math.max(1, s * 0.03) + '" stroke-linecap="round">' + g + '</g>' + river + '</svg>';
  }
  const pts = [];
  for (let i = 0; i < 90; i++) { const d = document.createElement('div'); d.className = 'pt'; d.dataset.i = i; pts.push(d); }
  let svgHost = null;
  function layout() {
    const Wd = Math.min(document.querySelector('.game').clientWidth - 24, 820);
    const used = ['pAI', 'pMe', 'status'].reduce((a, id) => a + $(id).offsetHeight, 0) + document.querySelector('.tools').offsetHeight + document.querySelector('.top').offsetHeight + 70;
    const Hd = Math.max(320, window.innerHeight - used);
    s = Math.floor(Math.max(30, Math.min(78, Math.min(Wd / 9.3, Hd / 10.3)))); m = Math.round(s * 0.66);
    const st = document.documentElement.style; st.setProperty('--cell', s + 'px'); st.setProperty('--pc', Math.round(s * 0.9) + 'px');
    board.style.width = (m * 2 + 8 * s) + 'px'; board.style.height = (m * 2 + 9 * s) + 'px';
    if (!svgHost) { svgHost = document.createElement('div'); board.appendChild(svgHost); pts.forEach(d => board.appendChild(d)); }
    svgHost.innerHTML = svgBoard();
    for (let i = 0; i < 90; i++) { const p = pt(i); pts[i].style.left = (p.x - s / 2) + 'px'; pts[i].style.top = (p.y - s / 2) + 'px'; }
    Object.keys(els).forEach(id => place(els[id], els[id].sq));
    fxSize();
  }
  function place(e, i) { const p = pt(i), d = s * 0.9; e.style.left = (p.x - d / 2) + 'px'; e.style.top = (p.y - d / 2) + 'px'; e.sq = i; }
  board.addEventListener('click', e => { const c = e.target.closest('.pt'); if (c) tap(+c.dataset.i); });
  function makePiece(id, i, v) {
    const e = document.createElement('div'); e.className = 'pc up ' + (X.colorOf(v) === 0 ? 'red' : 'black');
    e.innerHTML = '<div class="in"><div class="f back"></div><div class="f front"><span>' + X.name(v) + '</span></div></div>';
    e.dataset.id = id; e.v = v; board.appendChild(e); els[id] = e; place(e, i); return e;
  }
  function rebuild() { Object.keys(els).forEach(id => els[id].remove()); els = {}; G.s.board.forEach((v, i) => { if (v) makePiece(G.ids[i], i, v); }); layout(); paint(); }

  /* ---------- 介面 ---------- */
  const online = () => G && G.mode === 'online';
  const oppName = () => online() ? L('對手', 'Opponent') : L('棋王', 'The Sage');
  const dot = c => '<span class="dot" style="background:' + (c === 0 ? '#c0392b' : '#222') + ';border:1px solid #888"></span>';
  function paint() {
    if (!G) return;
    const st = G.s, me = G.myColor, op = 1 - me;
    pts.forEach(p => { p.className = 'pt'; });
    Object.keys(els).forEach(id => els[id].classList.remove('sel', 'check'));
    if (st.last) { pts[st.last.f].classList.add('last-f'); pts[st.last.t].classList.add('last-t'); }
    hintPts.forEach(i => pts[i].classList.add('hint'));
    if (sel >= 0) { const e = els[G.ids[sel]]; if (e) e.classList.add('sel'); X.legalFrom(st, sel).forEach(t => pts[t].classList.add(st.board[t] ? 'cap' : 'tgt')); }
    if (!G.over && X.inCheck(st)) { const k = st.board.indexOf(st.side * 8 + X.K); if (k >= 0 && els[G.ids[k]]) els[G.ids[k]].classList.add('check'); }
    $('aiName').textContent = oppName();
    $('aiFace').classList.toggle('net', online()); $('aiFace').classList.toggle('sage', !online());
    $('aiLvl').textContent = online() ? (NET && NET.open ? L('● 已連線', '● Online') : L('○ 離線', '○ Offline')) : lvName(G.level);
    $('aiLvl').classList.toggle('on', online() && !!(NET && NET.open));
    $('aiCol').innerHTML = dot(op) + colName(op); $('meCol').innerHTML = dot(me) + colName(me); $('meName').textContent = L('你', 'You');
    const tray = (el, list) => { el.innerHTML = list.map(v => '<span class="mini" style="color:' + (X.colorOf(v) === 0 ? '#c0261a' : '#16181d') + '">' + X.name(v) + '</span>').join(''); };
    tray($('trayAI'), st.captured[op]); tray($('trayMe'), st.captured[me]);
    $('pAI').classList.toggle('turn', !G.over && st.side === op); $('pMe').classList.toggle('turn', !G.over && st.side === me);
    let msg;
    if (G.over) msg = G.overText;
    else if (st.side === op) msg = online() ? L('等待對手…', 'Waiting for opponent…') : L('棋王思考中…', 'The Sage is thinking…');
    else msg = L('輪到你（' + colName(me) + '）', 'Your turn (' + colName(me) + ')') + (X.inCheck(st) ? L('：被將軍了！', ': you are in check!') : '');
    $('status').innerHTML = msg + (!G.over && st.noCap >= 100 ? '<small>' + L('⚠ 再 ' + (120 - st.noCap) + ' 步沒有吃子就和局', '⚠ Draw in ' + (120 - st.noCap) + ' moves without a capture') + '</small>' : '');
    $('undoN').textContent = '(' + G.undoLeft + ')'; $('hintN').textContent = '(' + G.hintLeft + ')';
    $('bUndo').style.display = $('bHint').style.display = online() ? 'none' : '';
    $('emotes').style.display = online() && NET && NET.open ? '' : 'none';
    $('bUndo').disabled = busy || G.undoLeft <= 0 || !G.stack.length; $('bHint').disabled = busy || G.over || G.hintLeft <= 0 || st.side !== me;
    $('bResign').disabled = busy || G.over;
    if (!arm) $('bResign').textContent = L('🏳 認輸', '🏳 Resign');
    $('bOnline').textContent = online() && !G.over ? L('🌐 離開對戰', '🌐 Leave') : L('🌐 線上對戰', '🌐 Online');
  }
  let toastT = 0;
  function toast(t, big) { const e = $('toast'); e.textContent = t; e.style.fontSize = big ? '34px' : ''; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1400); }
  const LINES = {
    start: [['請多指教。', 'Let us begin.'], ['楚河漢界，一決高下。', 'Across the river, we settle this.'], ['棋盤如戰場，請小心。', 'The board is a battlefield. Careful.']],
    eat: [['承讓了。', 'Thank you for that.'], ['這子我收下了。', 'I will take that piece.'], ['一步錯，步步錯。', 'One slip leads to another.']],
    hurt: [['好棋。', 'Good move.'], ['嗯……有點意思。', 'Hmm… interesting.'], ['失算了。', 'I miscalculated.']],
    check: [['將軍！', 'Check!'], ['小心你的帥。', 'Mind your General.']],
    win: [['勝負已分，再接再厲。', 'It is decided. Try again.'], ['承讓承讓。', 'A pleasure.']],
    lose: [['佩服，佩服。', 'Impressive. I yield.'], ['你的棋力在我之上。', 'You are the stronger player.']],
    draw: [['旗鼓相當。', 'Evenly matched.']]
  };
  const sayT = { ai: 0, me: 0 };
  function bubble(who, text) { const e = $(who === 'me' ? 'meSay' : 'aiSay'); e.textContent = text; e.classList.add('on'); clearTimeout(sayT[who]); sayT[who] = setTimeout(() => e.classList.remove('on'), 2600); }
  function say(kind) { if (online()) return; const a = LINES[kind], x = a[(Math.random() * a.length) | 0]; bubble('ai', L(x[0], x[1])); }

  function save() { if (!G || online()) return; store(KEY.save, { s: G.s, ids: G.ids, level: G.level, myColor: G.myColor, undoLeft: G.undoLeft, hintLeft: G.hintLeft, over: G.over }); }
  function fresh(st, mode, myColor, extra) { return Object.assign({ s: st, ids: st.board.map((v, i) => v ? i : -1), mode, myColor, level: pref.level, undoLeft: MAX_UNDO, hintLeft: MAX_HINT, stack: [], over: false, overText: '' }, extra || {}); }

  /* ---------- 對戰電腦 ---------- */
  function newGame() {
    leaveOnline(true);
    const myColor = pref.side === 'rand' ? (Math.random() < 0.5 ? 0 : 1) : pref.side === 'black' ? 1 : 0;
    G = fresh(X.newGame(), 'ai', myColor); sel = -1; hintPts = []; busy = false; rebuild(); save();
    if (window.SCLB) SCLB.start('xiangqi', G.level);
    say('start'); toast(L('你執' + colName(myColor), 'You play ' + colName(myColor)));
    if (window.SC) SC.post('gamestart', { level: G.level });
    next();
  }
  function next() {
    paint();
    if (online()) { if (NET && NET.role === 'host') { const st = X.status(G.s); if (st !== 'play') finish(st); } return; }
    const st = X.status(G.s); if (st !== 'play') return finish(st);
    if (G.s.side !== G.myColor) aiTurn();
  }
  function aiTurn() {
    busy = true; $('aiFace').classList.add('think'); paint();
    const t0 = Date.now(), my = G;
    setTimeout(() => {
      if (G !== my) return;
      const r = X.think(G.s, G.level);
      setTimeout(() => { if (G !== my) return; $('aiFace').classList.remove('think'); busy = false; act(r.act); }, Math.max(0, 450 - (Date.now() - t0)));
    }, 60);
  }
  function act(a) {
    const s0 = G.s, mover = s0.side;
    if (!online() && mover === G.myColor) { G.stack.push({ s: s0, ids: G.ids.slice() }); if (G.stack.length > 30) G.stack.shift(); }
    const { state, info } = X.apply(s0, a);
    hintPts = []; sel = -1;
    const mid = G.ids[a.f], dead = G.ids[a.t];
    G.ids[a.t] = mid; G.ids[a.f] = -1;
    if (els[mid]) place(els[mid], a.t);
    if (info.captured) {
      const de = els[dead], v = info.captured, big = X.typeOf(v) === X.R || X.typeOf(v) === X.C || X.typeOf(v) === X.N_;
      setTimeout(() => {
        if (de) { de.classList.add('dead'); setTimeout(() => de.remove(), 320); delete els[dead]; }
        burst(a.t, X.colorOf(v) === 0 ? ['#c0261a', '#ff7b5a', '#fdf3dc', '#e9c46a'] : ['#16181d', '#555', '#fdf3dc', '#e9c46a'], big ? 40 : 24, big ? 340 : 240);
        board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake'); SFX.cap();
        if (big) toast(L('吃掉 ', 'Captured ') + pName(v));
      }, 180);
      if (mover !== G.myColor) { if (big || Math.random() < 0.4) say('eat'); } else if (big || Math.random() < 0.3) say('hurt');
    } else SFX.move();
    if (info.check) setTimeout(() => { SFX.check(); toast(L('將軍！', 'Check!'), true); if (mover !== G.myColor) say('check'); }, 220);
    if (online() && mover !== G.myColor) SFX.ding();
    G.s = state;
    if (online() && NET && NET.role === 'host') NET.send({ t: 'apply', a, st: X.status(state) });
    save(); next();
  }
  function finish(st, quiet) {
    if (G.over) return; G.over = true; busy = false;
    const me = G.myColor; let res;
    if (st === 'draw') { res = 'd'; G.overText = L('和局', 'Draw'); say('draw'); }
    else if (st.winner === me) {
      res = 'w';
      G.overText = st.reason === 'resign' ? L('對手認輸，你贏了！', 'Your opponent resigned. You win!') : st.reason === 'left' ? L('對手已離線，對局結束', 'Opponent disconnected. Game over') : st.reason === 'stalemate' ? L('對手無棋可走，你贏了！', 'Your opponent has no legal moves. You win!') : L('絕殺！你贏了！', 'Checkmate! You win!');
      if (st.reason !== 'left') { say('lose'); SFX.win(); confetti(); }
    } else {
      res = 'l';
      G.overText = st.reason === 'resign' ? L('你認輸了', 'You resigned') : st.reason === 'stalemate' ? L('你無棋可走，判負', 'You have no legal moves. You lose') : L('被將死了…', 'Checkmated…');
      say('win'); SFX.lose();
    }
    if (!quiet) { stats[online() ? 'online' : G.level][res]++; store(KEY.stats, stats); }
    save(); paint(); G.res = res;
    if (window.SC) SC.post('gameover', { result: res, mode: G.mode, level: G.level });
    if (!quiet) setTimeout(() => showEnd(res), 900);
    if (!quiet && res === 'w' && !online() && window.SCLB && SCLB.has('xiangqi', G.level)) { const sec = SCLB.elapsed('xiangqi'); setTimeout(() => SCLB.offer({ game: 'xiangqi', mode: G.level, score: sec, text: lvName(G.level) + L('・' + sec + ' 秒獲勝', ' · won in ' + sec + ' s') }), 2200); }
  }
  function showEnd(res) {
    if (!G.over) return;
    $('endEmoji').textContent = res === 'w' ? '🏆' : res === 'l' ? '😵' : '🤝';
    $('endTitle').textContent = res === 'w' ? L('你贏了！', 'You win!') : res === 'l' ? L('你輸了', 'You lost') : L('和局', 'Draw');
    $('endText').textContent = G.overText + (online() ? L('（線上對戰）', ' (online)') : L('（難度：' + lvName(G.level) + '）', ' (' + lvName(G.level) + ')'));
    const st = stats[online() ? 'online' : G.level];
    $('endStats').innerHTML = '<div><b>' + st.w + '</b><span>' + L('勝', 'Wins') + '</span></div><div><b>' + st.l + '</b><span>' + L('敗', 'Losses') + '</span></div><div><b>' + st.d + '</b><span>' + L('和', 'Draws') + '</span></div>';
    $('bAgain').textContent = online() ? (NET && NET.open ? L('再來一局', 'Rematch') : L('對戰電腦', 'Play the AI')) : L('再來一局', 'Play again');
    $('bChange').style.display = online() ? 'none' : '';
    open('ovEnd');
  }

  /* ---------- 線上對戰（房主驗證每一步）---------- */
  function leaveOnline(silent) { if (NET) { const n = NET; NET = null; n.onClose = null; n.close(); if (!silent) toast(L('已離開線上對戰', 'Left online game')); } }
  function startOnline(conn) {
    leaveOnline(true); NET = conn; busy = false;
    conn.onClose = () => { if (NET !== conn) return; NET = null; toast(L('對手已離線', 'Opponent disconnected')); if (G && online() && !G.over) finish({ winner: G.myColor, reason: 'left' }, true); paint(); };
    conn.onData = onNet;
    if (conn.role === 'host') hostNewGame(Math.random() < 0.5 ? 0 : 1);
    else { conn.send({ t: 'hello', v: 1 }); G = fresh(X.newGame(), 'online', 1, { over: true, overText: L('等待房主開局…', 'Waiting for host…') }); rebuild(); }
    if (window.SC) SC.post('online', { role: conn.role });
  }
  function hostNewGame(hostColor) {
    G = fresh(X.newGame(), 'online', hostColor); sel = -1; hintPts = []; busy = false; rebuild(); closeAll();
    NET.send({ t: 'start', guestColor: 1 - hostColor, s: G.s, ids: G.ids });
    toast(L('你執' + colName(hostColor), 'You play ' + colName(hostColor))); next();
  }
  function onNet(msg) {
    if (!msg || !msg.t) return;
    const host = NET && NET.role === 'host';
    if (msg.t === 'hello' && host) { if (G && online()) NET.send({ t: 'start', guestColor: 1 - G.myColor, s: G.s, ids: G.ids }); }
    else if (msg.t === 'start' && !host) { G = fresh(msg.s && msg.s.board && msg.s.board.length === 90 ? msg.s : X.newGame(), 'online', msg.guestColor === 0 ? 0 : 1, msg.ids ? { ids: msg.ids } : {}); sel = -1; hintPts = []; busy = false; rebuild(); closeAll(); toast(L('你執' + colName(G.myColor), 'You play ' + colName(G.myColor))); SFX.ding(); paint(); }
    else if (msg.t === 'act' && host) { if (!G || G.over || G.s.side === G.myColor || !msg.a || !X.isLegal(G.s, msg.a)) return; act({ f: msg.a.f, t: msg.a.t }); }
    else if (msg.t === 'apply' && !host) { if (!G || G.over || !X.isLegal(G.s, msg.a)) return; busy = false; act({ f: msg.a.f, t: msg.a.t }); if (msg.st && msg.st !== 'play') finish(msg.st); }
    else if (msg.t === 'resign') { if (host && G && !G.over) { const st = { winner: G.myColor, reason: 'resign' }; NET.send({ t: 'end', st }); finish(st); } }
    else if (msg.t === 'end' && !host) { if (G && !G.over) finish(msg.st); }
    else if (msg.t === 'rematch') { if (host) hostNewGame(G ? 1 - G.myColor : 0); else toast(L('對手想再來一局', 'Opponent wants a rematch')); }
    else if (msg.t === 'emo') { bubble('ai', String(msg.e).slice(0, 4)); SFX.sel(); }
  }
  $('emotes').innerHTML = (window.SCNet ? SCNet.EMOTES : []).map(e => '<button type="button">' + e + '</button>').join('');
  $('emotes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !NET) return; NET.send({ t: 'emo', e: b.textContent }); bubble('me', b.textContent); });
  function openLobby(code) { if (!window.SCNet) return; closeAll(); SCNet.openLobby({ game: 'xiangqi', title: L('象棋', 'Xiangqi'), code, autoJoin: !!code, onReady: startOnline }); }
  $('bOnline').onclick = () => {
    if (online() && G && !G.over) { if (confirmTwice('bOnline')) { if (NET) NET.send({ t: 'resign' }); leaveOnline(); finish({ winner: 1 - G.myColor, reason: 'resign' }); } return; }
    if (online() && NET) { leaveOnline(); paint(); setup(); return; }
    openLobby();
  };

  /* ---------- 玩家操作 ---------- */
  function tap(i) {
    if (!G || busy || G.over || G.s.side !== G.myColor) { if (G && !G.over && G.s.side !== G.myColor) SFX.bad(); return; }
    const st = G.s, v = st.board[i];
    if (sel >= 0 && X.legalFrom(st, sel).indexOf(i) >= 0) {
      const a = { f: sel, t: i };
      if (online() && NET && NET.role === 'guest') { NET.send({ t: 'act', a }); busy = true; sel = -1; paint(); } else act(a);
      return;
    }
    if (v && X.colorOf(v) === G.myColor) {
      sel = sel === i ? -1 : i; SFX.sel();
      if (sel >= 0 && !X.legalFrom(st, i).length) toast(X.inCheck(st) ? L('先解除將軍！', 'Get out of check first!') : L('這枚棋子現在不能走', 'This piece cannot move now'));
    } else { if (sel >= 0 && v === 0) SFX.bad(); sel = -1; }
    paint();
  }
  $('bUndo').onclick = () => {
    if (busy || online() || !G.stack.length || G.undoLeft <= 0) return;
    const p = G.stack.pop(); G.s = p.s; G.ids = p.ids; G.undoLeft--; G.over = false; G.overText = ''; sel = -1; hintPts = [];
    rebuild(); save(); toast(L('悔棋，剩 ' + G.undoLeft + ' 次', 'Undone. ' + G.undoLeft + ' left')); next();
  };
  $('bHint').onclick = () => {
    if (busy || online() || G.over || G.s.side !== G.myColor || G.hintLeft <= 0) return;
    busy = true; $('status').textContent = L('思考提示中…', 'Thinking of a hint…');
    setTimeout(() => { const r = X.think(G.s, 'hard'); busy = false; G.hintLeft--; hintPts = [r.act.f, r.act.t]; sel = r.act.f; toast(L('建議：走這一步', 'Hint: try this move')); save(); paint(); }, 40);
  };
  let arm = 0;
  function confirmTwice(id) {
    if (!arm) { arm = setTimeout(() => { arm = 0; paint(); }, 3000); $(id).textContent = L('再按一次確認', 'Tap again to confirm'); return false; }
    clearTimeout(arm); arm = 0; return true;
  }
  $('bResign').onclick = () => {
    if (busy || G.over || !confirmTwice('bResign')) return;
    const st = { winner: 1 - G.myColor, reason: 'resign' };
    if (online() && NET) { if (NET.role === 'host') NET.send({ t: 'end', st: { winner: 1 - G.myColor, reason: 'resign' } }); else NET.send({ t: 'resign' }); }
    finish(st);
  };

  /* ---------- 視窗 ---------- */
  function open(id) { closeAll(); $(id).classList.add('on'); }
  function close(id) { $(id).classList.remove('on'); }
  function closeAll() { document.querySelectorAll('.ov.on').forEach(o => o.classList.remove('on')); }
  document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => b.closest('.ov').classList.remove('on'); });
  function fillSetup() {
    const lc = $('lvChips');
    lc.innerHTML = LV_IDS.map(l => { const t = stats[l]; return '<button data-v="' + l + '">' + lvName(l) + '<small>' + L(LV_DESC[l][0], LV_DESC[l][1]) + '</small><small>' + L('戰績 ' + t.w + '勝 ' + t.l + '敗 ' + t.d + '和', t.w + 'W ' + t.l + 'L ' + t.d + 'D') + '</small></button>'; }).join('');
    const mark = () => { lc.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pref.level)); $('sideChips').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pref.side)); };
    lc.querySelectorAll('button').forEach(b => { b.onclick = () => { pref.level = b.dataset.v; mark(); }; });
    $('sideChips').querySelectorAll('button').forEach(b => { b.onclick = () => { pref.side = b.dataset.v; mark(); }; });
    mark();
  }
  function setup() { fillSetup(); $('bCancel').style.display = G && !G.over ? '' : 'none'; open('ovSetup'); }
  $('bStart').onclick = () => { store(KEY.pref, pref); close('ovSetup'); newGame(); };
  $('bCancel').onclick = () => close('ovSetup');
  $('bSetupOnline').onclick = () => openLobby();
  $('bNew').onclick = () => { if (online() && G && !G.over) { toast(L('請先離開線上對戰', 'Leave the online game first')); return; } setup(); };
  $('bAgain').onclick = () => {
    close('ovEnd');
    if (online()) { if (NET && NET.open) { if (NET.role === 'host') hostNewGame(1 - G.myColor); else { NET.send({ t: 'rematch' }); toast(L('已邀請對手再來一局', 'Rematch requested')); } } else setup(); return; }
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
    SC.onBack(() => { const on = document.querySelector('.ov.on'); if (on) { if (on.id === 'ovSetup' && (!G || G.over)) return false; on.classList.remove('on'); return true; } if (sel >= 0) { sel = -1; paint(); return true; } return false; });
    SC.onPause(save);
    SC.onLang(() => { paint(); if ($('ovSetup').classList.contains('on')) fillSetup(); if ($('ovEnd').classList.contains('on') && G.res) showEnd(G.res); });
  }
  window.addEventListener('pagehide', save);
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 80); });

  /* ---------- 啟動 ---------- */
  const sv = load(KEY.save, null), room = window.SCNet && SCNet.roomFromUrl();
  if (sv && sv.s && !sv.over && sv.s.board && sv.s.board.length === 90) {
    G = fresh(sv.s, 'ai', sv.myColor, { ids: sv.ids, level: sv.level, undoLeft: sv.undoLeft, hintLeft: sv.hintLeft });
    rebuild(); if (!room) toast(L('繼續上一局', 'Resuming your last game')); next();
  } else {
    G = fresh(X.newGame(), 'ai', 0, { over: true, overText: L('按「開始對局」挑戰棋王', 'Press "Start" to play the Sage') });
    rebuild(); if (!room) setup();
  }
  if (room) { SCNet.clearRoomFromUrl(); openLobby(room); }
  window.XQUI = { get G() { return G; }, tap, onNet, startOnline, layout };
})();
