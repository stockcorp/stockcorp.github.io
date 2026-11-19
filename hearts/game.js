/* 紅心大戰 — stockcorp.github.io/hearts/
   你（座位 0，下方）＋三位電腦（1 左、2 上、3 右，出牌順時針 0→1→2→3）。傳牌：左→右→對家→不傳 循環。
   排行榜：mode = easy/normal/hard，分數 = 三位電腦平均分 − 你的分數（越高越好）。 */
(function () {
  'use strict';
  var GAME = 'hearts', $ = K.$, L = K.L;
  var SU = ['♣', '♦', '♠', '♥'], RK = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var NAMES = [['你', 'You'], ['小林', 'Lin'], ['阿美', 'Mei'], ['老王', 'Wang']];
  var QS = 2 * 13 + 10; // 黑桃 Q：suit 2、rank 12 → id = suit*13 + (rank-2)
  function su(c) { return (c / 13) | 0; } function rk(c) { return c % 13 + 2; }
  function pts(c) { return c === QS ? 13 : su(c) === 3 ? 1 : 0; }
  var G = null, busy = false, gen = 0, lv = 'normal';

  function newMatch(level) {
    lv = level || lv; gen++;
    G = { tot: [0, 0, 0, 0], hist: [], hand: 0, over: false, started: false };
    if (window.SCLB) SCLB.start(GAME, lv); if (window.SC) SC.post('start', { game: GAME, level: lv });
    $('bLb').href = '/leaderboard/?game=hearts&mode=' + lv;
    $('sub').textContent = L('電腦：', 'Computers: ') + L({ easy: '簡單', normal: '普通', hard: '困難' }[lv], { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[lv]);
    K.close('ovEnd'); K.close('ovScore');
    deal();
  }
  function deal() {
    var d = K.shuffle(Array.from({ length: 52 }, function (_, i) { return i; }));
    G.hands = [0, 1, 2, 3].map(function (p) { return d.slice(p * 13, p * 13 + 13).sort(cmp); });
    G.taken = [0, 0, 0, 0]; G.won = [[], [], [], []]; G.trick = []; G.lead = -1; G.broken = false; G.first = true;
    G.passDir = [1, 3, 2, 0][G.hand % 4]; // 1 左、3 右、2 對家、0 不傳
    G.sel = []; G.played = {}; G.voids = [{}, {}, {}, {}];
    render();
    if (G.passDir) { setMsg(L('選 3 張牌傳給', 'Choose 3 cards to pass to ') + L(NAMES[G.passDir][0], NAMES[G.passDir][1])); $('bPass').style.display = ''; updPass(); }
    else { $('bPass').style.display = 'none'; startPlay(); }
  }
  function cmp(a, b) { var o = [0, 1, 3, 2]; return o[su(a)] !== o[su(b)] ? o[su(a)] - o[su(b)] : rk(a) - rk(b); }
  function updPass() { $('bPass').textContent = L('傳出 ' + G.sel.length + '/3', 'Pass ' + G.sel.length + '/3'); $('bPass').disabled = G.sel.length !== 3; }
  function aiPass(p) {
    var h = G.hands[p].slice(), score = function (c) { var r = rk(c), s = su(c), cnt = h.filter(function (x) { return su(x) === s; }).length; var v = r; if (c === QS || (s === 2 && r > 12)) v += 30; if (s === 3) v += 6; if (cnt <= 3 && s !== 2) v += 8 - cnt * 2; if (s === 2 && r < 12) v -= 12; return v; };
    if (lv === 'easy') return K.shuffle(h).slice(0, 3);
    return h.sort(function (a, b) { return score(b) - score(a); }).slice(0, 3);
  }
  function doPass() {
    if (G.sel.length !== 3) return;
    var out = [G.sel.slice(), aiPass(1), aiPass(2), aiPass(3)];
    for (var p = 0; p < 4; p++) out[p].forEach(function (c) { G.hands[p].splice(G.hands[p].indexOf(c), 1); });
    G.recv = [];
    for (p = 0; p < 4; p++) { var to = (p + G.passDir) % 4; out[p].forEach(function (c) { G.hands[to].push(c); }); if (to === 0) G.recv = out[p].slice(); }
    G.hands.forEach(function (h) { h.sort(cmp); });
    G.sel = []; $('bPass').style.display = 'none';
    K.beep(600, 0.08, 'sine', 0.04);
    render(); startPlay();
  }
  function startPlay() {
    for (var p = 0; p < 4; p++) if (G.hands[p].indexOf(0) >= 0) G.lead = p;
    G.turn = G.lead; G.started = true;
    setMsg(G.recv && G.recv.length ? L('收到：', 'Received: ') + G.recv.map(name).join(' ') : '');
    setTimeout(function () { if (!G.over) setMsg(''); }, 2500);
    next();
  }
  function name(c) { return SU[su(c)] + RK[rk(c)]; }
  function legal(p) {
    var h = G.hands[p];
    if (!G.trick.length) {
      if (G.first) return h.indexOf(0) >= 0 ? [0] : h;
      if (!G.broken) { var nh = h.filter(function (c) { return su(c) !== 3; }); if (nh.length) return nh; }
      return h;
    }
    var s = su(G.trick[0].c), f = h.filter(function (c) { return su(c) === s; });
    if (f.length) return f;
    if (G.first) { var np = h.filter(function (c) { return !pts(c); }); if (np.length) return np; }
    return h;
  }
  function winnerOf(tr) { var s = su(tr[0].c), w = tr[0]; tr.forEach(function (x) { if (su(x.c) === s && rk(x.c) > rk(w.c)) w = x; }); return w.p; }
  function aiPlay(p) {
    var ok = legal(p);
    if (lv === 'easy' && Math.random() < 0.55) return ok[(Math.random() * ok.length) | 0];
    var tr = G.trick, h = G.hands[p];
    var hi = function (a) { return a.slice().sort(function (x, y) { return rk(y) - rk(x); })[0]; }, lo = function (a) { return a.slice().sort(function (x, y) { return rk(x) - rk(y); })[0]; };
    var qsOut = G.played[QS] || h.indexOf(QS) >= 0;
    if (!tr.length) {
      // 領牌：挑最安全的花色出最小牌；手上有黑桃 Q 就別領黑桃
      var bySuit = {}; ok.forEach(function (c) { (bySuit[su(c)] = bySuit[su(c)] || []).push(c); });
      var best = null, bv = 1e9;
      Object.keys(bySuit).forEach(function (s) { var c = lo(bySuit[s]), v = rk(c) * 2 - bySuit[s].length; if (+s === 2 && h.indexOf(QS) >= 0) v += 30; if (+s === 2 && !qsOut && rk(c) < 12) v -= 8; if (+s === 3) v += 6; if (lv === 'hard') { for (var o = 1; o < 4; o++) { var q = (p + o) % 4; if (G.voids[q][s]) v += 10; } } if (v < bv) { bv = v; best = c; } });
      return best;
    }
    var s0 = su(tr[0].c), follow = ok.filter(function (c) { return su(c) === s0; });
    var wcard = tr.filter(function (x) { return su(x.c) === s0; }).sort(function (a, b) { return rk(b.c) - rk(a.c); })[0].c;
    var pointsIn = tr.reduce(function (a, x) { return a + pts(x.c); }, 0), last = tr.length === 3;
    if (follow.length) {
      var under = follow.filter(function (c) { return rk(c) < rk(wcard); });
      if (s0 === 2 && h.indexOf(QS) >= 0 && rk(wcard) > 12) return QS; // 有人出 K/A 黑桃，丟 Q 給他
      if (last && !pointsIn) { var noQ = follow.filter(function (c) { return c !== QS; }); return hi(noQ.length ? noQ : follow); }
      if (under.length) return hi(under);
      if (s0 === 2) { var nq = follow.filter(function (c) { return c !== QS; }); if (nq.length) return lo(nq); }
      return last ? hi(follow) : lo(follow);
    }
    // 墊牌：先丟黑桃 Q，再丟大紅心，再丟大牌
    if (ok.indexOf(QS) >= 0) return QS;
    var hs = ok.filter(function (c) { return su(c) === 3; }); if (hs.length) return hi(hs);
    var sp = ok.filter(function (c) { return su(c) === 2 && rk(c) > 12; }); if (sp.length && !G.played[QS]) return hi(sp);
    // 丟掉張數最少花色的大牌，製造缺門
    var cnt = {}; ok.forEach(function (c) { cnt[su(c)] = (cnt[su(c)] || 0) + 1; });
    return ok.slice().sort(function (a, b) { return (cnt[su(a)] - cnt[su(b)]) * 4 - (rk(a) - rk(b)); })[0];
  }
  function playCard(p, c) {
    G.hands[p].splice(G.hands[p].indexOf(c), 1); G.trick.push({ p: p, c: c }); G.played[c] = 1;
    if (G.trick.length > 1 && su(c) !== su(G.trick[0].c)) G.voids[p][su(G.trick[0].c)] = 1;
    if (su(c) === 3) G.broken = true;
    K.beep(c === QS ? 200 : su(c) === 3 ? 520 : 440, 0.05, 'triangle', 0.04);
    render();
    if (G.trick.length === 4) {
      var g = gen; busy = true;
      setTimeout(function () {
        if (g !== gen) return;
        var w = winnerOf(G.trick), pt = G.trick.reduce(function (a, x) { return a + pts(x.c); }, 0);
        G.taken[w] += pt; G.trick.forEach(function (x) { G.won[w].push(x.c); });
        if (pt) setMsg(L(NAMES[w][0], NAMES[w][1]) + L(' 吃下 ', ' takes ') + pt + L(' 分', ' pts'));
        G.trick = []; G.first = false; G.turn = w; busy = false; render();
        if (!G.hands[0].length) endHand(); else next();
      }, 1000);
    } else { G.turn = (p + 1) % 4; next(); }
  }
  function next() {
    render();
    if (G.turn === 0) { busy = false; return; }
    var g = gen, p = G.turn; busy = true;
    setTimeout(function () { if (g !== gen) return; busy = false; playCard(p, aiPlay(p)); }, 480 + Math.random() * 260);
  }
  function endHand() {
    var add = G.taken.slice(), moon = add.indexOf(26);
    if (moon >= 0) { add = [26, 26, 26, 26]; add[moon] = 0; setMsg(L(NAMES[moon][0], NAMES[moon][1]) + L(' 射月成功！', ' shot the moon!')); K.beep(880, 0.4, 'triangle', 0.07, 1320); }
    for (var p = 0; p < 4; p++) G.tot[p] += add[p];
    G.hist.push(add); G.hand++;
    var done = G.tot.some(function (x) { return x >= 100; });
    render();
    if (done) return finish();
    showScores(L('第 ' + G.hand + ' 局結束', 'Hand ' + G.hand + ' done'));
  }
  function table() {
    var h = '<table class="sc"><tr><th>#</th>' + NAMES.map(function (n) { return '<th>' + L(n[0], n[1]) + '</th>'; }).join('') + '</tr>';
    G.hist.forEach(function (r, i) { h += '<tr><td>' + (i + 1) + '</td>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; });
    return h + '<tr class="tot"><td>' + L('合計', 'Total') + '</td>' + G.tot.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr></table>';
  }
  function showScores(t) { $('scTitle').textContent = t || L('分數表', 'Scores'); $('scTable').innerHTML = table(); $('bNext').style.display = !G.over && !G.hands[0].length ? '' : 'none'; K.open('ovScore'); }
  function finish() {
    G.over = true;
    var me = G.tot[0], ai = (G.tot[1] + G.tot[2] + G.tot[3]) / 3, score = Math.round(ai - me), win = me <= Math.min(G.tot[1], G.tot[2], G.tot[3]);
    $('endEmoji').textContent = win ? '🏆' : '🃏';
    $('endTitle').textContent = win ? L('你分數最少，獲勝！', 'Lowest score — you win!') : L('遊戲結束', 'Game over');
    $('endTable').innerHTML = table() + '<p>' + L('成績（電腦平均 − 你）：', 'Score (computers&#39; average − you): ') + '<b>' + score + '</b></p>';
    var best = K.load('schearts_best', {}), nb = best[lv] === undefined || score > best[lv]; if (nb) { best[lv] = score; K.save('schearts_best', best); }
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best[lv];
    K.beep(win ? 660 : 300, 0.5, 'triangle', 0.07, win ? 1320 : 150);
    if (window.SC) SC.post('gameover', { game: GAME, win: win, score: score });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) SCLB.offer({ game: GAME, mode: lv, score: score, text: L('你 ', 'You ') + me + L(' 分・', ' pts · ') + G.hand + L(' 局', ' hands') }); }, 800);
  }

  // ---------- 畫面 ----------
  function cardEl(c) { var d = document.createElement('div'); d.className = 'c' + (su(c) % 2 ? ' r' : ''); d.innerHTML = '<div class="tl">' + RK[rk(c)] + '<br>' + SU[su(c)] + '</div><div class="mid">' + SU[su(c)] + '</div>'; d.dataset.c = c; return d; }
  function setMsg(t) { $('msg').textContent = t || ''; }
  function render() {
    for (var p = 0; p < 4; p++) {
      var s = $('seat' + p); s.querySelector('.nm').textContent = L(NAMES[p][0], NAMES[p][1]);
      s.querySelector('.pt').textContent = G.tot[p] + L(' 分', ' pts') + (G.taken[p] ? ' (+' + G.taken[p] + ')' : '');
      s.classList.toggle('turn', G.started && !G.over && G.turn === p && G.trick.length < 4);
      var bk = s.querySelector('.back'); if (bk) bk.dataset.n = G.hands[p].length;
    }
    var tr = $('trick'); tr.innerHTML = '';
    var OFF = [[0, 46], [-62, 0], [0, -46], [62, 0]];
    G.trick.forEach(function (x) { var e = cardEl(x.c); e.style.left = OFF[x.p][0] + 'px'; e.style.top = OFF[x.p][1] + 'px'; tr.appendChild(e); });
    var hd = $('hand'); hd.innerHTML = '';
    var ok = !G.passDir || G.started ? (G.turn === 0 && !busy && G.trick.length < 4 ? legal(0) : []) : null;
    G.hands[0].forEach(function (c) {
      var e = cardEl(c);
      if (G.sel.indexOf(c) >= 0) e.classList.add('sel');
      if (ok) e.classList.add(ok.indexOf(c) >= 0 ? 'ok' : 'no');
      e.onclick = function () { tap(c); }; hd.appendChild(e);
    });
  }
  function tap(c) {
    if (!G || G.over) return;
    if (!G.started && G.passDir) { var i = G.sel.indexOf(c); if (i >= 0) G.sel.splice(i, 1); else if (G.sel.length < 3) G.sel.push(c); updPass(); render(); return; }
    if (G.turn !== 0 || busy || G.trick.length === 4) return;
    if (legal(0).indexOf(c) < 0) { K.beep(150, 0.06, 'square', 0.025); K.toast(G.trick.length ? L('有同花色要跟', 'You must follow suit') : G.first ? L('第一墩要出梅花 2', 'Lead the two of clubs first') : L('紅心還沒破，不能領紅心', 'Hearts are not broken yet'), 1300); return; }
    playCard(0, c);
  }
  $('bPass').onclick = doPass;
  $('bScores').onclick = function () { if (G) showScores(); };
  $('bNext').onclick = function () { K.close('ovScore'); if (!G.over) { G.started = false; deal(); } };
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); K.save('schearts_lv', b.dataset.m); newMatch(b.dataset.m); });
  $('bAgain').onclick = function () { newMatch(lv); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (window.SC) SC.onLang(function () { if (G) render(); });
  if (location.hash.indexOf('#test') === 0) window.__hr = { G: function () { return G; }, legal: legal, aiPlay: aiPlay, tap: tap, doPass: doPass, auto: function () { var f = function () { if (G.over) return; if (!G.started && G.passDir && G.sel.length < 3) { G.sel = G.hands[0].slice(0, 3); doPass(); } else if (G.turn === 0 && !busy && G.trick.length < 4 && G.hands[0].length) playCard(0, aiPlay(0)); else if (!G.hands[0].length && !G.over && document.getElementById('ovScore').classList.contains('on')) document.getElementById('bNext').click(); setTimeout(f, 20); }; f(); } };
  if (location.hash.indexOf('#fast') >= 0) { var st = window.setTimeout; window.setTimeout = function (f, t) { return st(f, Math.min(t || 0, 5)); }; }
  lv = K.load('schearts_lv', 'normal'); newMatch(lv);
})();
