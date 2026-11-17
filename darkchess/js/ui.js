/* 暗棋破壞神 - 畫面與操作 */
(function () {
  'use strict';
  const D = window.DC, $ = id => document.getElementById(id);
  const KEY = { save: 'dc_save_v1', stats: 'dc_stats_v1', pref: 'dc_pref_v1' };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } };
  const LV_IDS = ['easy', 'normal', 'hard', 'master'];
  const LV_DESC = { easy: '隨便翻、常失誤', normal: '會看兩步', hard: '會算翻棋風險', master: '每步深算一秒' };
  const pref = Object.assign({ level: 'normal', first: 'me', rookRun: false, mute: false }, load(KEY.pref, {}));
  const stats = load(KEY.stats, {});
  LV_IDS.forEach(l => { stats[l] = Object.assign({ w: 0, l: 0, d: 0 }, stats[l] || {}); });
  const HUMAN = 0, AI = 1, MAX_UNDO = 3, MAX_HINT = 3;

  let G = null, busy = false, sel = -1, hintCells = [], els = {}, orient = 'L', cell = 64;
  const board = $('board'), wrap = $('wrap');

  /* ---------- 音效（合成，不用音檔）---------- */
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
    bad: () => tone(160, 0.12, 'square', 0.05)
  };

  /* ---------- 特效畫布 ---------- */
  const fx = $('fx'), fc = fx.getContext('2d'); let parts = [], fxOn = false;
  function fxSize() { const r = wrap.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); fx.width = (r.width + 120) * dpr; fx.height = (r.height + 120) * dpr; fc.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function burst(i, colors, n, power) {
    const p = center(i);
    for (let k = 0; k < (n || 28); k++) { const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * (power || 260); parts.push({ x: p.x + 60, y: p.y + 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 2 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 0.6 + Math.random() * 0.5, t: 0, c: colors[k % colors.length], sq: Math.random() < 0.6 }); }
    if (!fxOn) { fxOn = true; last = 0; requestAnimationFrame(tick); }
  }
  function confetti() { const r = wrap.getBoundingClientRect(); for (let k = 0; k < 120; k++) parts.push({ x: 60 + Math.random() * r.width, y: 40 - Math.random() * 120, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 140, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 2.5 + Math.random(), t: 0, c: ['#f0b44c', '#c0392b', '#ffe6a8', '#35e08a', '#5ab4ff'][k % 5], sq: true, g: 60 }); if (!fxOn) { fxOn = true; last = 0; requestAnimationFrame(tick); } }
  let last = 0;
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

  /* ---------- 版面：依螢幕決定棋盤橫放或直放 ---------- */
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

  /* ---------- 棋盤元素 ---------- */
  const cells = [];
  for (let i = 0; i < 32; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.i = i; board.appendChild(c); cells.push(c); }
  board.addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) tap(+c.dataset.i); });
  function makePiece(id, i, v) {
    const e = document.createElement('div'); e.className = 'pc'; e.innerHTML = '<div class="in"><div class="f back"></div><div class="f front"><span></span></div></div>';
    e.dataset.id = id; board.appendChild(e); els[id] = e; place(e, i); if (v >= 0 && v < 14) reveal(e, v, true); return e;
  }
  function reveal(e, v, instant) {
    e.querySelector('.front span').textContent = D.name(v); e.classList.add(D.colorOf(v) === 0 ? 'red' : 'black');
    if (instant) { e.querySelector('.in').style.transition = 'none'; e.classList.add('up'); e.offsetWidth; e.querySelector('.in').style.transition = ''; } else e.classList.add('up');
  }
  function rebuild() { Object.keys(els).forEach(id => els[id].remove()); els = {}; G.s.board.forEach((v, i) => { if (v !== -1) makePiece(G.ids[i], i, v); }); paint(); }

  /* ---------- 介面更新 ---------- */
  const colorTxt = c => c < 0 ? '' : '<span class="dot" style="background:' + (c === 0 ? '#c0392b' : '#222') + ';border:1px solid #888"></span>' + D.COLOR_NAME[c] + '方';
  function paint() {
    const s = G.s, b = s.board;
    cells.forEach(c => { c.className = 'cell'; });
    Object.keys(els).forEach(id => els[id].classList.remove('sel'));
    if (s.last) { if (s.last.k === 'move') { cells[s.last.f].classList.add('last-f'); cells[s.last.t].classList.add('last-t'); } else cells[s.last.i].classList.add('last-t'); }
    hintCells.forEach(i => cells[i].classList.add('hint'));
    if (sel >= 0) {
      const e = els[G.ids[sel]]; if (e) e.classList.add('sel');
      D.legalActions(s).forEach(a => { if (a.k === 'move' && a.f === sel) cells[a.t].classList.add(b[a.t] === -1 ? 'tgt' : 'cap'); });
    }
    $('aiLvl').textContent = D.LEVELS[G.level].name + (G.rookRun ? '・車直衝' : '');
    $('aiCol').innerHTML = s.colorOf[AI] < 0 ? '尚未決定顏色' : colorTxt(s.colorOf[AI]);
    $('meCol').innerHTML = s.colorOf[HUMAN] < 0 ? '翻開第一枚棋子決定你的顏色' : colorTxt(s.colorOf[HUMAN]);
    const tray = (el, list) => { el.innerHTML = list.map(v => '<span class="mini" style="color:' + (D.colorOf(v) === 0 ? '#c0261a' : '#16181d') + '">' + D.name(v) + '</span>').join(''); };
    tray($('trayAI'), s.captured[AI]); tray($('trayMe'), s.captured[HUMAN]);
    $('pAI').classList.toggle('turn', !G.over && s.side === AI); $('pMe').classList.toggle('turn', !G.over && s.side === HUMAN);
    let msg = '';
    if (G.over) msg = G.overText;
    else if (s.side === AI) msg = '破壞神思考中…';
    else msg = s.colorOf[HUMAN] < 0 ? '輪到你：點任一枚蓋著的棋子翻開' : '輪到你（' + D.COLOR_NAME[s.colorOf[HUMAN]] + '方）：翻棋或走棋';
    const left = s.drawLimit - s.noProgress;
    $('status').innerHTML = msg + (!G.over && left <= 15 ? '<small>⚠ 再 ' + left + ' 步沒有翻棋或吃子就和局</small>' : '');
    $('undoN').textContent = '(' + G.undoLeft + ')'; $('hintN').textContent = '(' + G.hintLeft + ')';
    $('bUndo').disabled = busy || G.undoLeft <= 0 || !G.stack.length; $('bHint').disabled = busy || G.over || G.hintLeft <= 0 || s.side !== HUMAN; $('bResign').disabled = busy || G.over || s.colorOf[0] < 0;
  }
  let toastT = 0;
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1300); }
  const LINES = {
    start: ['準備好被破壞了嗎？', '今天的棋盤，由我來毀滅。', '翻吧，命運在等你。', '來吧，讓我看看你的本事。'],
    eat: ['哈哈，吃掉了！', '這枚棋子歸我了。', '破壞完成！', '太嫩了。', '再送幾枚過來吧。'],
    hurt: ['可惡……', '你竟敢！', '只是小傷。', '下一步我就討回來。', '有兩下子嘛。'],
    king: ['我的主帥……不！！', '這不可能！'],
    win: ['一切都被破壞了，哈哈哈！', '破壞神，無人能擋。'],
    lose: ['怎麼可能……我竟然輸了。', '你……才是真正的破壞神。'],
    draw: ['哼，算你走運。', '這局先放你一馬。']
  };
  let sayT = 0;
  function say(kind, mood) {
    const arr = LINES[kind], e = $('aiSay'); e.textContent = arr[(Math.random() * arr.length) | 0]; e.classList.add('on');
    const face = $('aiFace'); face.classList.remove('mad', 'happy'); if (mood) face.classList.add(mood);
    clearTimeout(sayT); sayT = setTimeout(() => { e.classList.remove('on'); face.classList.remove('mad', 'happy'); }, 2600);
  }

  /* ---------- 存檔 ---------- */
  function save() { if (!G) return; store(KEY.save, { s: G.s, ids: G.ids, level: G.level, rookRun: G.rookRun, undoLeft: G.undoLeft, hintLeft: G.hintLeft, over: G.over, overText: G.overText }); }

  /* ---------- 對局流程 ---------- */
  function newGame() {
    const first = pref.first === 'rand' ? (Math.random() < 0.5 ? HUMAN : AI) : pref.first === 'ai' ? AI : HUMAN;
    const s = D.newGame({ first, rookRun: pref.rookRun });
    G = { s, ids: s.board.map((v, i) => i), level: pref.level, rookRun: pref.rookRun, undoLeft: MAX_UNDO, hintLeft: MAX_HINT, stack: [], over: false, overText: '' };
    sel = -1; hintCells = []; busy = false; rebuild(); layout(); save();
    say('start'); toast(first === HUMAN ? '你先翻棋' : '破壞神先手');
    if (window.SC) SC.post('gamestart', { level: G.level });
    next();
  }
  function next() {
    paint();
    const st = D.status(G.s);
    if (st !== 'play') return finish(st);
    if (G.s.side === AI) aiTurn();
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
  function act(a) {
    const s0 = G.s, mover = s0.side;
    if (mover === HUMAN) { G.stack.push({ s: s0, ids: G.ids.slice() }); if (G.stack.length > 20) G.stack.shift(); }
    const { state, info } = D.apply(s0, a);
    hintCells = []; sel = -1;
    if (a.k === 'flip') {
      const e = els[G.ids[a.i]]; reveal(e, info.revealed); SFX.flip(); burst(a.i, ['#fff6d8', '#f0b44c'], 10, 120);
      if (D.typeOf(info.revealed) === D.K) { e.classList.add('boss'); toast(D.name(info.revealed) + ' 現身！'); }
      if (info.assigned) setTimeout(() => toast('你是' + D.COLOR_NAME[state.colorOf[HUMAN]] + '方'), D.typeOf(info.revealed) === D.K ? 1300 : 0);
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
          if (big) { SFX.big(); toast('吃掉 ' + D.name(v) + '！'); } else SFX.cap();
        }, 180);
        if (mover === AI) { if (big || Math.random() < 0.45) say('eat', 'happy'); }
        else if (D.typeOf(v) === D.K) say('king', 'mad'); else if (big || Math.random() < 0.35) say('hurt', 'mad');
      } else SFX.move();
    }
    G.s = state; save(); next();
  }
  function finish(st) {
    G.over = true; busy = false;
    let res;
    if (st === 'draw') { res = 'd'; G.overText = '和局：連續 ' + G.s.drawLimit + ' 步沒有翻棋或吃子'; say('draw'); }
    else if (st.winner === HUMAN) { res = 'w'; G.overText = '你贏了！' + (st.reason === 'stuck' ? '破壞神無棋可走' : '對手棋子全滅'); say('lose', 'mad'); SFX.win(); confetti(); }
    else { res = 'l'; G.overText = st.reason === 'resign' ? '你認輸了' : '你輸了…' + (st.reason === 'stuck' ? '你無棋可走' : '你的棋子全滅'); say('win', 'happy'); SFX.lose(); }
    stats[G.level][res]++; store(KEY.stats, stats); save(); paint();
    if (window.SC) SC.post('gameover', { result: res, level: G.level });
    setTimeout(() => showEnd(res), 900);
  }
  function showEnd(res) {
    $('endEmoji').textContent = res === 'w' ? '🏆' : res === 'l' ? '💥' : '🤝';
    $('endTitle').textContent = res === 'w' ? '你擊敗了破壞神！' : res === 'l' ? '被破壞神擊敗了' : '平分秋色';
    $('endText').textContent = G.overText + '（難度：' + D.LEVELS[G.level].name + '）';
    const st = stats[G.level]; $('endStats').innerHTML = '<div><b>' + st.w + '</b><span>勝</span></div><div><b>' + st.l + '</b><span>敗</span></div><div><b>' + st.d + '</b><span>和</span></div>';
    open('ovEnd');
  }

  /* ---------- 玩家操作 ---------- */
  function tap(i) {
    if (!G || busy || G.over || G.s.side !== HUMAN) { if (G && !G.over && G.s.side === AI) SFX.bad(); return; }
    const s = G.s, v = s.board[i], my = s.colorOf[HUMAN];
    if (v >= D.HID) { act({ k: 'flip', i }); return; }
    if (sel >= 0) {
      const a = D.legalActions(s).find(x => x.k === 'move' && x.f === sel && x.t === i);
      if (a) { act(a); return; }
    }
    if (v >= 0 && v < 14 && D.colorOf(v) === my) {
      sel = sel === i ? -1 : i; SFX.sel();
      if (sel >= 0 && !D.legalActions(s).some(x => x.k === 'move' && x.f === i)) { toast('這枚棋子現在不能走'); }
    } else { if (v >= 0 && v < 14 && sel < 0 && my >= 0) toast('那是對手的棋子'); sel = -1; }
    paint();
  }
  $('bUndo').onclick = () => {
    if (busy || !G.stack.length || G.undoLeft <= 0) return;
    const prev = G.stack.pop(); G.s = prev.s; G.ids = prev.ids; G.undoLeft--; G.over = false; G.overText = ''; sel = -1; hintCells = [];
    rebuild(); save(); toast('悔棋，剩 ' + G.undoLeft + ' 次'); next();
  };
  $('bHint').onclick = () => {
    if (busy || G.over || G.s.side !== HUMAN || G.hintLeft <= 0) return;
    busy = true; $('status').textContent = '思考提示中…';
    setTimeout(() => {
      const r = D.think(G.s, 'hard'); busy = false; G.hintLeft--;
      hintCells = r.act.k === 'flip' ? [r.act.i] : [r.act.f, r.act.t]; sel = r.act.k === 'move' ? r.act.f : -1;
      toast(r.act.k === 'flip' ? '建議：翻這一枚' : '建議：走這一步'); save(); paint();
    }, 40);
  };
  let resignArm = 0;
  $('bResign').onclick = () => {
    if (busy || G.over) return;
    if (!resignArm) { resignArm = setTimeout(() => { resignArm = 0; $('bResign').textContent = '🏳 認輸'; }, 3000); $('bResign').textContent = '再按一次確認認輸'; return; }
    clearTimeout(resignArm); resignArm = 0; $('bResign').textContent = '🏳 認輸';
    finish({ winner: AI, reason: 'resign' });
  };

  /* ---------- 視窗 ---------- */
  function open(id) { document.querySelectorAll('.ov.on').forEach(o => o.classList.remove('on')); $(id).classList.add('on'); }
  function close(id) { $(id).classList.remove('on'); }
  document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => b.closest('.ov').classList.remove('on'); });
  function setup() {
    const lc = $('lvChips');
    lc.innerHTML = LV_IDS.map(l => { const s = stats[l]; return '<button data-v="' + l + '">' + D.LEVELS[l].name + '<small>' + LV_DESC[l] + '</small><small>戰績 ' + s.w + '勝 ' + s.l + '敗 ' + s.d + '和</small></button>'; }).join('');
    const mark = () => { lc.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pref.level)); $('firstChips').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pref.first)); };
    lc.querySelectorAll('button').forEach(b => { b.onclick = () => { pref.level = b.dataset.v; mark(); }; });
    $('firstChips').querySelectorAll('button').forEach(b => { b.onclick = () => { pref.first = b.dataset.v; mark(); }; });
    $('optRook').checked = pref.rookRun; mark();
    $('bCancel').style.display = G && !G.over ? '' : 'none';
    open('ovSetup');
  }
  $('bStart').onclick = () => { pref.rookRun = $('optRook').checked; store(KEY.pref, pref); close('ovSetup'); newGame(); };
  $('bCancel').onclick = () => close('ovSetup');
  $('bNew').onclick = setup;
  $('bAgain').onclick = () => { close('ovEnd'); newGame(); };
  $('bChange').onclick = () => { close('ovEnd'); setup(); };
  $('bView').onclick = () => close('ovEnd');
  $('bRules').onclick = () => open('ovRules');
  const soundBtn = () => { $('bSound').textContent = pref.mute ? '🔇' : '🔊'; };
  $('bSound').onclick = () => { pref.mute = !pref.mute; store(KEY.pref, pref); soundBtn(); if (!pref.mute) SFX.sel(); };
  soundBtn();
  document.querySelectorAll('.ov').forEach(o => o.addEventListener('click', e => { if (e.target === o && o.id !== 'ovSetup') o.classList.remove('on'); }));

  // App 返回鍵：先關視窗，再取消選取
  if (window.SC) {
    SC.onBack(() => {
      const on = document.querySelector('.ov.on');
      if (on) { if (on.id === 'ovSetup' && (!G || G.over)) return false; on.classList.remove('on'); return true; }
      if (sel >= 0) { sel = -1; paint(); return true; }
      return false;
    });
    SC.onPause(save);
  }
  window.addEventListener('pagehide', save);
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 80); });

  /* ---------- 啟動：有未完成的對局就接著下 ---------- */
  const sv = load(KEY.save, null);
  if (sv && sv.s && !sv.over && sv.s.board && sv.s.board.length === 32) {
    G = { s: sv.s, ids: sv.ids, level: sv.level, rookRun: sv.rookRun, undoLeft: sv.undoLeft, hintLeft: sv.hintLeft, stack: [], over: false, overText: '' };
    rebuild(); layout(); toast('繼續上一局'); next();
  } else {
    G = { s: D.newGame({ first: HUMAN }), ids: [...Array(32).keys()], level: pref.level, rookRun: pref.rookRun, undoLeft: MAX_UNDO, hintLeft: MAX_HINT, stack: [], over: true, overText: '按「開始對局」挑戰破壞神' };
    rebuild(); layout(); setup();
  }
  window.DCUI = { get G() { return G; }, tap, layout, newGame };
})();
