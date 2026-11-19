/* 蜘蛛紙牌 — stockcorp.github.io/spider/
   104 張、10 疊（前 4 疊 6 張、後 6 疊 5 張），發牌堆 50 張分 5 次發。單色／雙色／四色。
   排行榜：mode = 1suit/2suit/4suit，從第一步到完成的時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'spider', $ = K.$, L = K.L;
  var SU = ['♠', '♥', '♣', '♦'], RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var NAME = { '1suit': ['單色', '1 suit'], '2suit': ['雙色', '2 suits'], '4suit': ['四色', '4 suits'] };
  var tbl = $('table'), S = null, hist = [], els = [], cw = 60, ch = 84, gap = 6, tick = null;
  // 牌 id 0..103：suit = card.s，rank = card.r
  var CARDS = [];
  function newGame(mode) {
    mode = mode || '1suit';
    var ns = mode === '1suit' ? 1 : mode === '2suit' ? 2 : 4;
    CARDS = []; for (var i = 0; i < 104; i++) CARDS.push({ s: [0, 1, 2, 3][((i / 13) | 0) % ns], r: i % 13 + 1 });
    var d = K.shuffle(Array.from({ length: 104 }, function (_, k) { return k; }));
    S = { mode: mode, tab: [], stock: [], done: [], moves: 0, started: false, over: false, t0: 0 };
    for (var c = 0; c < 10; c++) { S.tab.push([]); var n = c < 4 ? 6 : 5; for (var k = 0; k < n; k++) S.tab[c].push({ c: d.pop(), up: k === n - 1 }); }
    S.stock = d; hist = []; clearInterval(tick); $('clock').textContent = '0:00';
    $('bLb').href = '/leaderboard/?game=spider&mode=' + mode;
    $('sub').textContent = L(NAME[mode][0], NAME[mode][1]);
    K.save('scspider_mode', mode);
    build(); render();
  }
  function sut(c) { return CARDS[c].s; } function rnk(c) { return CARDS[c].r; } function red(c) { return sut(c) % 2 === 1; }
  function snap() { return JSON.stringify([S.tab, S.stock, S.done, S.moves]); }
  function startClock() {
    if (S.started) return; S.started = true; S.t0 = Date.now();
    if (window.SCLB) SCLB.start(GAME, S.mode); if (window.SC) SC.post('start', { game: GAME, level: S.mode });
    tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500);
  }
  // 從第 j 張開始能不能整串搬（同花色連續）
  function movable(t, j) {
    var p = S.tab[t]; if (j < 0 || j >= p.length || !p[j].up) return false;
    for (var k = j; k < p.length - 1; k++) { var a = p[k].c, b = p[k + 1].c; if (sut(a) !== sut(b) || rnk(a) !== rnk(b) + 1) return false; }
    return true;
  }
  function canDrop(c, t) { var p = S.tab[t]; return !p.length || rnk(p[p.length - 1].c) === rnk(c) + 1; }
  function doMove(from, j, to) {
    hist.push(snap());
    var run = S.tab[from].splice(j);
    run.forEach(function (x) { S.tab[to].push(x); });
    var p = S.tab[from]; if (p.length && !p[p.length - 1].up) p[p.length - 1].up = true;
    S.moves++; startClock(); K.beep(520, 0.04, 'triangle', 0.04);
    collect(to); render(); check();
  }
  function collect(t) {
    var p = S.tab[t]; if (p.length < 13) return;
    var j = p.length - 13; if (rnk(p[j].c) !== 13 || !movable(t, j) || rnk(p[p.length - 1].c) !== 1) return;
    var run = p.splice(j); S.done.push(run.map(function (x) { return x.c; }));
    if (p.length && !p[p.length - 1].up) p[p.length - 1].up = true;
    K.beep(660, 0.25, 'triangle', 0.06, 1320); navigator.vibrate && navigator.vibrate(20);
  }
  function bestTarget(from, j) {
    var c = S.tab[from][j].c, best = -1, bs = -1;
    for (var t = 0; t < 10; t++) {
      if (t === from || !canDrop(c, t)) continue;
      var p = S.tab[t], sc = !p.length ? (j === 0 ? -1 : 1) : sut(p[p.length - 1].c) === sut(c) ? 4 : 2;
      if (sc > bs) { bs = sc; best = t; }
    }
    return bs > 0 ? best : -1;
  }
  function deal() {
    if (S.over || !S.stock.length) return;
    if (S.tab.some(function (p) { return !p.length; })) { K.toast(L('每一疊都要有牌才能發牌', 'Every column needs a card before dealing'), 1500); return; }
    hist.push(snap());
    for (var t = 0; t < 10; t++) S.tab[t].push({ c: S.stock.pop(), up: true });
    S.moves++; startClock(); K.beep(800, 0.03, 'sine', 0.03);
    for (t = 0; t < 10; t++) collect(t);
    render(); check();
  }
  function check() { if (S.done.length === 8) win(); }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scspider_best', {}), nb = !best[S.mode] || t < best[S.mode];
    if (nb) { best[S.mode] = t; K.save('scspider_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endMoves').textContent = S.moves;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.mode]);
    K.beep(523, 0.6, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.mode, score: sec, text: L(NAME[S.mode][0], NAME[S.mode][1]) + ' ' + K.fmtTime(sec) }); } }, 600);
  }
  function hint() {
    // 找一個有意義的移動：優先同花色、會翻開牌的
    var opts = [];
    for (var f = 0; f < 10; f++) { var p = S.tab[f]; for (var j = 0; j < p.length; j++) { if (!movable(f, j)) continue; for (var t = 0; t < 10; t++) { if (t === f || !S.tab[t].length || !canDrop(p[j].c, t)) continue; var q = S.tab[t], sc = (sut(q[q.length - 1].c) === sut(p[j].c) ? 3 : 1) + (j > 0 && !p[j - 1].up ? 2 : 0) + (j === 0 ? 1 : 0); if (j > 0 && p[j - 1].up && rnk(p[j - 1].c) === rnk(p[j].c) + 1 && sut(p[j - 1].c) === sut(p[j].c)) continue; opts.push({ f: f, j: j, t: t, sc: sc }); } } }
    opts.sort(function (a, b) { return b.sc - a.sc; });
    [].forEach.call(tbl.querySelectorAll('.hint'), function (e) { e.classList.remove('hint'); });
    if (!opts.length) { K.toast(S.stock.length ? L('沒有好的移動了，試試發牌', 'No useful moves — try dealing') : L('沒有可以移動的牌了', 'No moves left'), 1500); return; }
    var o = opts[0]; els[S.tab[o.f][o.j].c].classList.add('hint'); var q2 = S.tab[o.t]; els[q2[q2.length - 1].c].classList.add('hint');
    setTimeout(function () { [].forEach.call(tbl.querySelectorAll('.hint'), function (e) { e.classList.remove('hint'); }); }, 1500);
  }

  // ---------- 畫面 ----------
  function layout() { var w = tbl.clientWidth || 360; gap = Math.max(3, Math.round(w * 0.008)); cw = Math.floor((w - gap * 9) / 10); ch = Math.round(cw * 1.4); }
  function x(col) { return col * (cw + gap); }
  function build() {
    tbl.innerHTML = ''; els = [];
    S.slots = []; for (var t = 0; t < 10; t++) { var d = document.createElement('div'); d.className = 'slot'; tbl.appendChild(d); S.slots.push(d); }
    S.stockEl = document.createElement('div'); S.stockEl.className = 'stock'; S.stockEl.onclick = deal; tbl.appendChild(S.stockEl);
    S.doneEl = document.createElement('div'); S.doneEl.style.position = 'absolute'; tbl.appendChild(S.doneEl);
    for (var c = 0; c < 104; c++) {
      var e = document.createElement('div'); e.dataset.c = c;
      e.innerHTML = '<div class="tl">' + RK[rnk(c)] + SU[sut(c)] + '</div><div class="mid">' + SU[sut(c)] + '</div>';
      tbl.appendChild(e); els[c] = e;
    }
  }
  function place(e, l, t, z, up) {
    e.style.left = l + 'px'; e.style.top = t + 'px'; e.style.zIndex = z; e.style.width = cw + 'px'; e.style.height = ch + 'px'; e.style.display = '';
    var c = +e.dataset.c; e.className = 'cd ' + (up ? (red(c) ? 'r' : 'b') : 'dn');
    e.style.fontSize = Math.max(9, Math.round(cw * 0.27)) + 'px'; e.querySelector('.mid').style.fontSize = Math.round(cw * 0.55) + 'px';
  }
  function render() {
    layout();
    var top = ch + gap * 2;
    // 上排：左邊放完成的組，右邊放發牌堆
    S.done.forEach(function (run, k) { run.forEach(function (c, i) { var e = els[c]; if (i < 12) { e.style.display = 'none'; return; } place(e, x(0) + k * cw * 0.3, 0, 10 + k, true); }); });
    var left = Math.ceil(S.stock.length / 10);
    S.stockEl.style.left = x(9) - (left - 1) * cw * 0.18 + 'px'; S.stockEl.style.top = 0; S.stockEl.style.width = cw + (left - 1) * cw * 0.18 + 'px'; S.stockEl.style.height = ch + 'px';
    S.stock.forEach(function (c, i) { var g = Math.floor(i / 10), e = els[c]; if (i % 10) { e.style.display = 'none'; return; } place(e, x(9) - (left - 1 - g) * cw * 0.18, 0, 20 + g, false); e.style.pointerEvents = 'none'; });
    S.slots.forEach(function (s, t) { s.style.left = x(t) + 'px'; s.style.top = top + 'px'; s.style.width = cw + 'px'; s.style.height = ch + 'px'; });
    var avail = Math.max(ch * 4, window.innerHeight - tbl.getBoundingClientRect().top - window.scrollY - 20 - top), maxH = top + ch;
    S.tab.forEach(function (p, t) {
      var dn = ch * 0.1, up = ch * 0.24, need = p.reduce(function (a, s, i) { return i === p.length - 1 ? a : a + (s.up ? up : dn); }, 0) + ch;
      var k = need > avail ? Math.max(0.3, (avail - ch) / (need - ch)) : 1, y = top;
      p.forEach(function (s, i) { var e = els[s.c]; e.style.pointerEvents = ''; place(e, x(t), y, 100 + i, s.up); y += (s.up ? up : dn) * k; });
      if (p.length) maxH = Math.max(maxH, y - (p[p.length - 1].up ? up : dn) * k + ch);
    });
    tbl.style.height = maxH + 'px';
    $('moves').textContent = S.moves; $('done').textContent = S.done.length; $('bUndo').disabled = !hist.length || S.over;
  }
  function locate(c) { for (var t = 0; t < 10; t++) for (var j = 0; j < S.tab[t].length; j++) if (S.tab[t][j].c === c) return { t: t, j: j }; return null; }

  // ---------- 操作 ----------
  var drag = null;
  tbl.addEventListener('pointerdown', function (e) {
    if (!S || S.over) return;
    var el = e.target.closest('.cd'); if (!el) return;
    var loc = locate(+el.dataset.c); if (!loc) return;
    if (!movable(loc.t, loc.j)) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return; }
    var cs = S.tab[loc.t].slice(loc.j).map(function (x) { return x.c; });
    drag = { loc: loc, cs: cs, x0: e.clientX, y0: e.clientY, moved: false, base: cs.map(function (k) { return [parseFloat(els[k].style.left), parseFloat(els[k].style.top)]; }) };
    try { tbl.setPointerCapture(e.pointerId); } catch (_) {}
  });
  tbl.addEventListener('pointermove', function (e) {
    if (!drag) return; var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 8) return; drag.moved = true;
    drag.cs.forEach(function (k, i) { var el = els[k]; el.classList.add('drag'); el.style.left = drag.base[i][0] + dx + 'px'; el.style.top = drag.base[i][1] + dy + 'px'; el.style.zIndex = 900 + i; });
  });
  tbl.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null;
    d.cs.forEach(function (k) { els[k].classList.remove('drag'); });
    if (!d.moved) { var t = bestTarget(d.loc.t, d.loc.j); if (t >= 0) doMove(d.loc.t, d.loc.j, t); else { var el = els[d.cs[0]]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); K.beep(160, 0.06, 'square', 0.025); } return; }
    var cx = d.base[0][0] + (e.clientX - d.x0) + cw / 2, col = Math.max(0, Math.min(9, Math.floor(cx / (cw + gap))));
    if (col !== d.loc.t && canDrop(d.cs[0], col)) doMove(d.loc.t, d.loc.j, col); else render();
  });
  tbl.addEventListener('pointercancel', function () { if (drag) { drag = null; render(); } });
  $('bUndo').onclick = function () { if (!hist.length || S.over) return; var h = JSON.parse(hist.pop()); S.tab = h[0]; S.stock = h[1]; S.done = h[2]; S.moves = h[3] + 1; render(); };
  $('bHint').onclick = hint;
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); K.close('ovEnd'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.mode); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  window.addEventListener('resize', function () { if (S) render(); });
  if (window.SC) SC.onLang(function () { if (S) $('sub').textContent = L(NAME[S.mode][0], NAME[S.mode][1]); });
  if (location.hash.indexOf('#test') === 0) window.__sp = { S: function () { return S; }, render: render, collect: collect, deal: deal, doMove: doMove, check: check, newGame: newGame };
  newGame(K.load('scspider_mode', '1suit'));
})();
