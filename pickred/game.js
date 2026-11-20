/* 撿紅點 — stockcorp.github.io/pickred/
   你（座位 0）＋三位電腦，順序 0→1→2→3。每局 6 張手牌、桌上 4 張、牌堆 24 張；每回合出一張再翻一張。
   計分（台灣主流）：紅 A 20、紅 9/10/J/Q/K 10、紅 2–8 照點數、黑桃 A 30，總分 240。
   一場四局；排行榜：mode = easy/normal/hard，四局總分越高越好。 */
(function () {
  'use strict';
  var GAME = 'pickred', $ = K.$, L = K.L, ROUNDS = 4;
  var SU = ['♠', '♥', '♣', '♦'], RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var NAMES = [['你', 'You'], ['小林', 'Lin'], ['阿美', 'Mei'], ['老王', 'Wang']];
  function su(c) { return (c / 13) | 0; } function rk(c) { return c % 13 + 1; } function red(c) { return su(c) % 2 === 1; }
  function val(c) { var r = rk(c); if (red(c)) return r === 1 ? 20 : r >= 9 ? 10 : r; return c === 0 ? 30 : 0; }
  function pairs(a, b) { var x = rk(a), y = rk(b); return x >= 10 || y >= 10 ? x === y : x + y === 10; }
  var G = null, lv = 'normal', gen = 0, busy = false, picking = null;

  function newMatch(level) {
    lv = level || lv; gen++;
    G = { round: 0, tot: [0, 0, 0, 0], hist: [], over: false };
    if (window.SCLB) SCLB.start(GAME, lv); if (window.SC) SC.post('start', { game: GAME, level: lv });
    $('bLb').href = '/leaderboard/?game=pickred&mode=' + lv;
    $('sub').textContent = L('電腦：', 'Computers: ') + L({ easy: '簡單', normal: '普通', hard: '困難' }[lv], { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[lv]);
    K.close('ovEnd'); K.close('ovRound');
    deal();
  }
  function deal() {
    var d;
    do { d = K.shuffle(Array.from({ length: 52 }, function (_, i) { return i; })); } while (sameFour(d.slice(0, 4)));
    G.pool = d.slice(0, 4); G.hands = [0, 1, 2, 3].map(function (p) { return d.slice(4 + p * 6, 10 + p * 6).sort(function (a, b) { return rk(a) - rk(b); }); });
    G.stock = d.slice(28); G.cap = [[], [], [], []]; G.seen = {}; G.pool.forEach(function (c) { G.seen[c] = 1; });
    G.turn = G.round % 4; picking = null; busy = false;
    setMsg(L('第 ' + (G.round + 1) + ' 局', 'Deal ' + (G.round + 1)));
    render(); step();
  }
  function sameFour(a) { return a.every(function (c) { return rk(c) === rk(a[0]); }); }
  function score(p) { return G.cap[p].reduce(function (a, c) { return a + val(c); }, 0); }
  // 出牌 c 能吃哪些組（回傳陣列，每組是要撿走的桌上牌）
  function options(c) {
    var m = G.pool.filter(function (x) { return pairs(c, x); });
    if (!m.length) return [];
    var same = G.pool.filter(function (x) { return rk(x) === rk(c); });
    if ((rk(c) >= 10 || rk(c) === 5) && same.length === 3) return [same];
    return m.map(function (x) { return [x]; });
  }
  function capture(p, c, grp) {
    G.pool = G.pool.filter(function (x) { return grp.indexOf(x) < 0; });
    G.cap[p].push(c); grp.forEach(function (x) { G.cap[p].push(x); });
    var v = val(c) + grp.reduce(function (a, x) { return a + val(x); }, 0);
    K.beep(v ? 760 : 560, 0.06, 'triangle', 0.05);
    if (v && p === 0) { K.float(K.at, '+' + v, '#fde047', 18 + Math.min(14, v / 4)); K.burst(K.at, { n: 8 + Math.min(20, v), c: ['#f87171', '#fde047', '#fff'], size: 4, sp: 170 }); K.buzz(10); }
    return v;
  }
  function playHand(p, c, grp) {
    G.hands[p].splice(G.hands[p].indexOf(c), 1); G.seen[c] = 1;
    var t = L(NAMES[p][0], NAMES[p][1]) + L(' 出 ', ' plays ') + nm(c);
    if (grp) { var v = capture(p, c, grp); t += L(' 吃 ', ' takes ') + grp.map(nm).join(' ') + (v ? '（+' + v + '）' : ''); }
    else { G.pool.push(c); K.beep(400, 0.04, 'sine', 0.03); }
    setMsg(t); render();
    var g = gen; busy = true;
    setTimeout(function () { if (g === gen) flip(p); }, 700);
  }
  function flip(p) {
    var c = G.stock.pop(); G.seen[c] = 1;
    var opts = options(c), t = L('翻出 ', 'Turned ') + nm(c);
    if (opts.length) {
      // 翻牌有多種吃法時挑分數最高的
      opts.sort(function (a, b) { return b.reduce(function (s, x) { return s + val(x); }, 0) - a.reduce(function (s, x) { return s + val(x); }, 0); });
      var v = capture(p, c, opts[0]); t += L(' 吃 ', ' takes ') + opts[0].map(nm).join(' ') + (v ? '（+' + v + '）' : '');
    } else G.pool.push(c);
    setMsg(t); render(nm(c));
    var g = gen;
    setTimeout(function () { if (g !== gen) return; busy = false; G.turn = (p + 1) % 4; if (!G.stock.length && G.hands.every(function (h) { return !h.length; })) endRound(); else step(); }, 750);
  }
  function step() {
    render();
    if (G.turn === 0) { busy = false; if (!G.hands[0].length) { G.turn = 1; step(); } return; }
    if (!G.hands[G.turn].length) { G.turn = (G.turn + 1) % 4; return step(); }
    var g = gen, p = G.turn; busy = true;
    setTimeout(function () { if (g !== gen) return; var a = ai(p); playHand(p, a.c, a.grp); }, 600 + Math.random() * 300);
  }
  // 電腦：先找吃分最多的；吃不到時丟「最不會讓別人得分」的牌
  function ai(p) {
    var h = G.hands[p], best = null, bv = -1e9;
    h.forEach(function (c) {
      options(c).forEach(function (grp) {
        var v = val(c) + grp.reduce(function (a, x) { return a + val(x); }, 0) + 1;
        if (lv === 'easy') v += Math.random() * 15;
        if (v > bv) { bv = v; best = { c: c, grp: grp }; }
      });
    });
    if (best) return best;
    var risk = function (c) {
      // 丟出去後，剩下沒看過的牌裡有幾張能吃它
      var unseen = 0; for (var x = 0; x < 52; x++) if (!G.seen[x] && h.indexOf(x) < 0 && pairs(c, x)) unseen++;
      var r = val(c) * (lv === 'hard' ? (unseen ? 1 : 0.1) : 1) + (lv === 'hard' ? unseen * (val(c) + 2) * 0.4 : 0);
      return lv === 'easy' ? Math.random() * 10 + val(c) : r;
    };
    var pick = h.slice().sort(function (a, b) { return risk(a) - risk(b); })[0];
    return { c: pick, grp: null };
  }
  function endRound() {
    var s = [0, 1, 2, 3].map(score);
    for (var p = 0; p < 4; p++) G.tot[p] += s[p];
    G.hist.push(s); G.round++;
    render();
    if (G.round >= ROUNDS) return finish();
    $('rdTitle').textContent = L('第 ' + G.round + ' 局結束', 'Deal ' + G.round + ' done'); $('rdTable').innerHTML = table(); K.open('ovRound');
  }
  function table() {
    var h = '<table class="sc"><tr><th>#</th>' + NAMES.map(function (n) { return '<th>' + L(n[0], n[1]) + '</th>'; }).join('') + '</tr>';
    G.hist.forEach(function (r, i) { h += '<tr><td>' + (i + 1) + '</td>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; });
    return h + '<tr class="tot"><td>' + L('合計', 'Total') + '</td>' + G.tot.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr></table>';
  }
  function finish() {
    G.over = true;
    var me = G.tot[0], win = me >= Math.max(G.tot[1], G.tot[2], G.tot[3]);
    $('endEmoji').textContent = win ? '🏆' : '🀄';
    $('endTitle').textContent = win ? L('你撿最多分，獲勝！', 'Most points — you win!') : L('四局結束', 'Match over');
    $('endTable').innerHTML = table();
    var best = K.load('scpickred_best', {}), nb = !best[lv] || me > best[lv]; if (nb) { best[lv] = me; K.save('scpickred_best', best); }
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best[lv];
    K.beep(win ? 660 : 300, 0.5, 'triangle', 0.07, win ? 1320 : 150);
    if (window.SC) SC.post('gameover', { game: GAME, win: win, score: me });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) SCLB.offer({ game: GAME, mode: lv, score: me, text: L('四局 ', '4 deals · ') + me + L(' 分', ' pts') }); }, 600);
  }

  // ---------- 畫面 ----------
  function nm(c) { return SU[su(c)] + RK[rk(c)]; }
  function setMsg(t) { $('msg').textContent = t || ''; }
  function cardEl(c) { var d = document.createElement('div'); d.className = 'c' + (red(c) ? ' r' : ''); d.innerHTML = '<div class="tl">' + RK[rk(c)] + '<br>' + SU[su(c)] + '</div><div class="mid">' + SU[su(c)] + '</div>' + (val(c) ? '<span class="pv">' + val(c) + '</span>' : ''); d.dataset.c = c; return d; }
  function render(flash) {
    var op = $('opps'); op.innerHTML = '';
    for (var p = 1; p < 4; p++) { var d = document.createElement('div'); d.className = 'opp' + (G.turn === p && !G.over ? ' turn' : ''); d.innerHTML = '<b>' + L(NAMES[p][0], NAMES[p][1]) + '</b>' + L('手牌 ', 'Hand ') + G.hands[p].length + '・<span>' + score(p) + L(' 分', ' pts') + '</span><br><small>' + L('累計 ', 'Total ') + G.tot[p] + '</small>'; op.appendChild(d); }
    $('stock').textContent = G.stock.length;
    var pool = $('pool'); pool.innerHTML = '';
    G.pool.forEach(function (c) {
      var e = cardEl(c);
      if (picking && picking.opts.some(function (g) { return g.indexOf(c) >= 0; })) { e.classList.add('pick'); e.onclick = function () { var grp = picking.opts.filter(function (g) { return g.indexOf(c) >= 0; })[0], cc = picking.c; picking = null; playHand(0, cc, grp); }; }
      if (flash && nm(c) === flash) e.classList.add('flash');
      pool.appendChild(e);
    });
    var mi = $('myInfo'); mi.parentNode.classList.toggle('turn', G.turn === 0 && !busy && !G.over);
    mi.innerHTML = L('你：本局 ', 'You: this deal ') + '<b>' + score(0) + '</b>' + L(' 分・累計 ', ' pts · total ') + '<b>' + G.tot[0] + '</b>' + (G.turn === 0 && !busy && !G.over ? L('　輪到你出牌', '　your turn') : '');
    var hd = $('hand'); hd.innerHTML = '';
    G.hands[0].forEach(function (c) {
      var e = cardEl(c); if (G.turn === 0 && !busy && options(c).length) e.classList.add('can');
      if (picking && picking.c === c) e.classList.add('sel');
      e.onclick = function () { tap(c); }; hd.appendChild(e);
    });
  }
  function tap(c) {
    if (!G || G.over || G.turn !== 0 || busy) return;
    var o = options(c);
    if (o.length > 1) { picking = { c: c, opts: o }; setMsg(L('點桌上要吃的那一張', 'Tap the table card to take')); render(); return; }
    picking = null; playHand(0, c, o[0] || null);
  }
  $('bNext').onclick = function () { K.close('ovRound'); if (!G.over) deal(); };
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); K.save('scpickred_lv', b.dataset.m); newMatch(b.dataset.m); });
  $('bAgain').onclick = function () { newMatch(lv); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (window.SC) SC.onLang(function () { if (G) render(); });
  if (location.hash.indexOf('#fast') >= 0) { var st = window.setTimeout; window.setTimeout = function (f, t) { return st(f, Math.min(t || 0, 5)); }; }
  if (location.hash.indexOf('#test') === 0) window.__pr = { G: function () { return G; }, auto: function () { var f = function () { if (G.over) return; if (K.isOpen('ovRound')) $('bNext').click(); else if (G.turn === 0 && !busy && G.hands[0].length) { var a = ai(0); playHand(0, a.c, a.grp); } setTimeout(f, 20); }; f(); } };
  lv = K.load('scpickred_lv', 'normal'); newMatch(lv);
})();
