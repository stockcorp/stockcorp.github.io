/* 新接龍（Klondike）— stockcorp.github.io/klondike/
   翻一張／翻三張；點一下自動移牌、可拖曳、無限悔棋、自動完成。
   排行榜：mode = draw1/draw3，從第一步到完成的時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'klondike', $ = K.$, L = K.L;
  var SU = ['♠', '♥', '♣', '♦'], RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var tbl = $('table'), S = null, hist = [], els = [], cw = 80, ch = 112, gap = 8, tick = null;
  function suit(c) { return (c / 13) | 0; } function rank(c) { return c % 13 + 1; } function red(c) { return suit(c) % 2 === 1; }

  function newGame(mode) {
    var d = K.shuffle(Array.from({ length: 52 }, function (_, i) { return i; }));
    S = { mode: mode || 'draw1', stock: [], waste: [], found: [[], [], [], []], tab: [], moves: 0, started: false, over: false, t0: 0 };
    for (var c = 0; c < 7; c++) { S.tab.push([]); for (var r = 0; r <= c; r++) S.tab[c].push({ c: d.pop(), up: r === c }); }
    S.stock = d.reverse();
    hist = []; clearInterval(tick); $('clock').textContent = '0:00';
    $('bLb').href = '/leaderboard/?game=klondike&mode=' + S.mode;
    $('sub').textContent = S.mode === 'draw1' ? L('翻一張', 'Draw one') : L('翻三張', 'Draw three');
    build(); render();
  }
  function snap() { return JSON.stringify([S.stock, S.waste, S.found, S.tab, S.moves]); }
  function startClock() {
    if (S.started) return; S.started = true; S.t0 = Date.now();
    if (window.SCLB) SCLB.start(GAME, S.mode);
    if (window.SC) SC.post('start', { game: GAME, level: S.mode });
    tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500);
  }
  function commit() { S.moves++; startClock(); render(); check(); }

  // ---------- 規則 ----------
  function canFound(c, f) { var p = S.found[f]; return p.length ? (suit(p[p.length - 1]) === suit(c) && rank(p[p.length - 1]) + 1 === rank(c)) : (rank(c) === 1 && suit(c) === f); }
  function canTab(c, t) { var p = S.tab[t]; if (!p.length) return rank(c) === 13; var top = p[p.length - 1]; return top.up && red(top.c) !== red(c) && rank(top.c) === rank(c) + 1; }
  // src: {k:'w'} | {k:'f',i} | {k:'t',i,j}
  function cardsOf(src) { if (src.k === 'w') return [S.waste[S.waste.length - 1]]; if (src.k === 'f') return [S.found[src.i][S.found[src.i].length - 1]]; return S.tab[src.i].slice(src.j).map(function (x) { return x.c; }); }
  function remove(src) {
    if (src.k === 'w') S.waste.pop(); else if (src.k === 'f') S.found[src.i].pop();
    else { S.tab[src.i].splice(src.j); var p = S.tab[src.i]; if (p.length && !p[p.length - 1].up) p[p.length - 1].up = true; }
  }
  function tryMove(src, dst) {
    var cs = cardsOf(src);
    if (dst.k === 'f') { if (cs.length !== 1 || src.k === 'f' && src.i === dst.i || !canFound(cs[0], dst.i)) return false; }
    else if (dst.k === 't') { if (src.k === 't' && src.i === dst.i || !canTab(cs[0], dst.i)) return false; }
    hist.push(snap()); remove(src);
    if (dst.k === 'f') S.found[dst.i].push(cs[0]); else cs.forEach(function (c) { S.tab[dst.i].push({ c: c, up: true }); });
    K.beep(dst.k === 'f' ? 700 : 520, 0.04, 'triangle', 0.04); commit(); return true;
  }
  function autoMove(src) {
    var cs = cardsOf(src);
    if (cs.length === 1 && src.k !== 'f') for (var f = 0; f < 4; f++) if (canFound(cs[0], f)) return tryMove(src, { k: 'f', i: f });
    // 優先移到非空欄位，其次空欄（K 才有意義）
    var order = [0, 1, 2, 3, 4, 5, 6].sort(function (a, b) { return (S.tab[a].length ? 0 : 1) - (S.tab[b].length ? 0 : 1); });
    for (var k = 0; k < 7; k++) { var t = order[k]; if (src.k === 't' && src.i === t) continue; if (!S.tab[t].length && src.k === 't' && src.j === 0) continue; if (canTab(cs[0], t)) return tryMove(src, { k: 't', i: t }); }
    return false;
  }
  function draw() {
    if (S.over) return;
    hist.push(snap());
    if (!S.stock.length) { if (!S.waste.length) { hist.pop(); return; } S.stock = S.waste.reverse(); S.waste = []; K.beep(300, 0.05, 'sine', 0.03); }
    else { var n = S.mode === 'draw3' ? 3 : 1; for (var i = 0; i < n && S.stock.length; i++) S.waste.push(S.stock.pop()); K.beep(800, 0.02, 'sine', 0.025); }
    commit();
  }
  function canAuto() { return !S.over && !S.stock.length && !S.waste.length && S.tab.every(function (p) { return p.every(function (x) { return x.up; }); }); }
  function autoFinish() {
    if (!canAuto()) return;
    var step = function () {
      if (S.over) return;
      for (var t = 0; t < 7; t++) { var p = S.tab[t]; if (!p.length) continue; var c = p[p.length - 1].c; for (var f = 0; f < 4; f++) if (canFound(c, f)) { tryMove({ k: 't', i: t, j: p.length - 1 }, { k: 'f', i: f }); setTimeout(step, 70); return; } }
    };
    step();
  }
  function check() {
    $('bAuto').style.display = canAuto() ? '' : 'none';
    if (S.found.every(function (f) { return f.length === 13; })) win();
  }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scklon_best', {}), nb = !best[S.mode] || t < best[S.mode];
    if (nb) { best[S.mode] = t; K.save('scklon_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endMoves').textContent = S.moves;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.mode]);
    K.beep(523, 0.6, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.mode, score: sec, text: (S.mode === 'draw1' ? L('翻一張', 'Draw one') : L('翻三張', 'Draw three')) + ' ' + K.fmtTime(sec) }); } }, 600);
  }

  // ---------- 畫面 ----------
  function layout() {
    var w = tbl.clientWidth || 360; gap = Math.max(4, Math.round(w * 0.012));
    cw = Math.floor((w - gap * 6) / 7); ch = Math.round(cw * 1.4);
  }
  function x(col) { return col * (cw + gap); }
  function build() {
    tbl.innerHTML = ''; els = [];
    var mk = function (cls, txt) { var d = document.createElement('div'); d.className = 'slot ' + cls; d.textContent = txt || ''; tbl.appendChild(d); return d; };
    S.slots = { stock: mk('stock', '↻'), waste: mk('waste') , f: [0, 1, 2, 3].map(function (i) { return mk('f', SU[i]); }), t: [0, 1, 2, 3, 4, 5, 6].map(function () { return mk('t', 'K'); }) };
    S.slots.stock.onclick = draw;
    for (var c = 0; c < 52; c++) {
      var e = document.createElement('div'); e.dataset.c = c;
      e.innerHTML = '<div class="tl">' + RK[rank(c)] + '<i>' + SU[suit(c)] + '</i></div><div class="mid">' + SU[suit(c)] + '</div>';
      tbl.appendChild(e); els[c] = e;
    }
  }
  function place(e, l, t, z, up) {
    e.style.left = l + 'px'; e.style.top = t + 'px'; e.style.zIndex = z; e.style.width = cw + 'px'; e.style.height = ch + 'px';
    var c = +e.dataset.c; e.className = 'cd ' + (up ? (red(c) ? 'r' : 'b') : 'dn');
    e.style.fontSize = Math.round(cw * 0.24) + 'px'; e.querySelector('.mid').style.fontSize = Math.round(cw * 0.5) + 'px';
  }
  function render() {
    layout();
    var setSlot = function (s, col, top) { s.style.left = x(col) + 'px'; s.style.top = top + 'px'; s.style.width = cw + 'px'; s.style.height = ch + 'px'; };
    setSlot(S.slots.stock, 0, 0); setSlot(S.slots.waste, 1, 0);
    S.slots.f.forEach(function (s, i) { setSlot(s, 3 + i, 0); });
    var ty = ch + gap * 2;
    S.slots.t.forEach(function (s, i) { setSlot(s, i, ty); });
    S.stock.forEach(function (c, i) { place(els[c], x(0) + Math.min(i, 3) * 0, 0, 10 + i, false); });
    var wv = S.mode === 'draw3' ? 3 : 1, ws = Math.max(0, S.waste.length - wv);
    S.waste.forEach(function (c, i) { var off = i >= ws ? (i - ws) * cw * 0.28 : 0; place(els[c], x(1) + off, 0, 100 + i, true); });
    S.found.forEach(function (p, f) { p.forEach(function (c, i) { place(els[c], x(3 + f), 0, 200 + i, true); }); });
    var avail = Math.max(ch * 3, window.innerHeight - tbl.getBoundingClientRect().top - window.scrollY - 30 - ty), maxH = ty;
    S.tab.forEach(function (p, t) {
      var dn = ch * 0.12, up = ch * 0.27, need = p.reduce(function (a, s, i) { return i === p.length - 1 ? a : a + (s.up ? up : dn); }, 0) + ch;
      var k = need > avail ? Math.max(0.45, (avail - ch) / (need - ch)) : 1, y = ty;
      p.forEach(function (s, i) { place(els[s.c], x(t), y, 300 + i, s.up); y += (s.up ? up : dn) * k; });
      maxH = Math.max(maxH, y - (p.length ? (p[p.length - 1].up ? up : dn) * k : 0) + ch);
    });
    tbl.style.height = Math.max(maxH, ty + ch * 3) + 'px';
    $('moves').textContent = S.moves; $('bUndo').disabled = !hist.length || S.over;
  }
  function locate(c) {
    if (S.waste.length && S.waste[S.waste.length - 1] === c) return { k: 'w' };
    for (var f = 0; f < 4; f++) { var p = S.found[f]; if (p.length && p[p.length - 1] === c) return { k: 'f', i: f }; }
    for (var t = 0; t < 7; t++) for (var j = 0; j < S.tab[t].length; j++) if (S.tab[t][j].c === c) return S.tab[t][j].up ? { k: 't', i: t, j: j } : null;
    if (S.stock.indexOf(c) >= 0) return { k: 's' };
    return null;
  }

  // ---------- 輸入（點擊＝自動移牌；拖曳） ----------
  var drag = null;
  tbl.addEventListener('pointerdown', function (e) {
    if (!S || S.over) return;
    var el = e.target.closest('.cd'); if (!el) return;
    var c = +el.dataset.c, src = locate(c); if (!src) return;
    if (src.k === 's') { draw(); return; }
    var cs = cardsOf(src), r = tbl.getBoundingClientRect();
    drag = { src: src, cs: cs, x0: e.clientX, y0: e.clientY, moved: false, base: cs.map(function (k) { return [parseFloat(els[k].style.left), parseFloat(els[k].style.top)]; }), r: r };
    try { tbl.setPointerCapture(e.pointerId); } catch (_) {}
  });
  tbl.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
    drag.moved = true;
    drag.cs.forEach(function (k, i) { var el = els[k]; el.classList.add('drag'); el.style.left = drag.base[i][0] + dx + 'px'; el.style.top = drag.base[i][1] + dy + 'px'; el.style.zIndex = 900 + i; });
  });
  tbl.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    d.cs.forEach(function (k) { els[k].classList.remove('drag'); });
    if (!d.moved) { if (!autoMove(d.src)) { var el = els[d.cs[0]]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); K.beep(160, 0.06, 'square', 0.025); } return; }
    // 依拖曳後卡片中心找目標
    var cx = d.base[0][0] + (e.clientX - d.x0) + cw / 2, cy = d.base[0][1] + (e.clientY - d.y0) + ch / 2, ty = ch + gap * 2;
    var col = Math.max(0, Math.min(6, Math.floor(cx / (cw + gap)))), ok = false;
    if (cy < ty) { if (col >= 3) ok = tryMove(d.src, { k: 'f', i: col - 3 }); }
    else ok = tryMove(d.src, { k: 't', i: col });
    if (!ok) render();
  });
  tbl.addEventListener('pointercancel', function () { if (drag) { drag = null; render(); } });

  $('bUndo').onclick = function () { if (!hist.length || S.over) return; var h = JSON.parse(hist.pop()); S.stock = h[0]; S.waste = h[1]; S.found = h[2]; S.tab = h[3]; S.moves = h[4] + 1; render(); check(); };
  $('bAuto').onclick = autoFinish;
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); K.close('ovEnd'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.mode); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', function () { if (S) render(); });
  if (window.SC) SC.onLang(function () { if (S) $('sub').textContent = S.mode === 'draw1' ? L('翻一張', 'Draw one') : L('翻三張', 'Draw three'); });
  if (location.hash.indexOf('#test') === 0) window.__kl = { S: function () { return S; }, render: render, check: check, autoFinish: autoFinish, draw: draw };
  newGame(K.load('scklon_mode', 'draw1'));
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) K.save('scklon_mode', b.dataset.m); });
})();
