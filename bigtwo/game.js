/* 王者大老二 — stockcorp.github.io/bigtwo/
   台灣規則：3 最小 2 最大；花色 ♠>♥>♦>♣；梅花 3 先出；牌型：單張、對子、順子、葫蘆、鐵支、同花順（鐵支/同花順為炸彈）。
   一場 8 局，計分：剩 n 張扣 n（8–9 張 ×2、10–12 張 ×3、13 張 ×4），贏家全收。
   排行榜：mode = easy/normal/hard，分數 = 8 局總分（越高越好）。 */
(function () {
  'use strict';
  var GAME = 'bigtwo', HANDS = 8, SAVE = 'scb2_save', $ = K.$, L = K.L;
  var RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  var SUITS = ['♣', '♦', '♥', '♠'];
  var LV = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] };
  var BOTS = [{ zh: '阿明', en: 'Ming', fc: '🧔' }, { zh: '小美', en: 'Mei', fc: '👩' }, { zh: '老王', en: 'Wang', fc: '👴' }];
  var rk = function (c) { return c >> 2; }, st = function (c) { return c & 3; };
  var FAST = location.hash.indexOf('#fast') === 0, M = null, G = null, busy = false, sortBySuit = false, hintIdx = -1, hintList = [];

  // ---------- 牌型 ----------
  // 順子樣式：一般 3-7(0)…10-A(7)；A2345 = 8；23456 = 9（最大）
  function straightInfo(rs) {
    var u = rs.slice().sort(function (a, b) { return a - b; });
    for (var i = 1; i < 5; i++) if (u[i] === u[i - 1]) return null;
    if (u[4] <= 11 && u[4] - u[0] === 4) return { str: u[0], top: u[4] };
    var key = u.join(',');
    if (key === '0,1,2,11,12') return { str: 8, top: 12 };
    if (key === '0,1,2,3,12') return { str: 9, top: 12 };
    return null;
  }
  // 回傳 {t: 1單 2對 5五張, k: 比較值, f: 五張牌型 1順 2葫 3鐵 4同花順, bomb}
  function classify(cs) {
    var n = cs.length; if (!n) return null;
    var s = cs.slice().sort(function (a, b) { return a - b; });
    if (n === 1) return { t: 1, k: s[0] };
    if (n === 2) return rk(s[0]) === rk(s[1]) ? { t: 2, k: s[1] } : null;
    if (n !== 5) return null;
    var rs = s.map(rk), cnt = {};
    rs.forEach(function (r) { cnt[r] = (cnt[r] || 0) + 1; });
    var groups = Object.keys(cnt).map(Number).sort(function (a, b) { return cnt[b] - cnt[a] || b - a; });
    if (cnt[groups[0]] === 4) return { t: 5, f: 3, k: groups[0], bomb: true };
    if (cnt[groups[0]] === 3 && cnt[groups[1]] === 2) return { t: 5, f: 2, k: groups[0] };
    var si = straightInfo(rs);
    if (si) {
      var topCard = s.filter(function (c) { return rk(c) === si.top; })[0];
      var flush = s.every(function (c) { return st(c) === st(s[0]); });
      return { t: 5, f: flush ? 4 : 1, k: si.str * 4 + st(topCard), bomb: flush };
    }
    return null;
  }
  function beats(a, b) {
    if (!a) return false; if (!b) return true;
    if (a.bomb && !b.bomb) return true;
    if (b.bomb && !a.bomb) return false;
    if (a.bomb && b.bomb) return a.f !== b.f ? a.f > b.f : a.k > b.k;
    if (a.t !== b.t) return false;
    if (a.t === 5 && a.f !== b.f) return a.f > b.f;
    return a.k > b.k;
  }

  // ---------- 列出手牌所有可能的出法 ----------
  function byRank(h) { var m = {}; h.forEach(function (c) { (m[rk(c)] = m[rk(c)] || []).push(c); }); for (var r in m) m[r].sort(function (a, b) { return a - b; }); return m; }
  function combos(h) {
    var out = [], m = byRank(h), r, i, j;
    h.forEach(function (c) { out.push([c]); });
    for (r in m) { var g = m[r]; for (i = 0; i < g.length; i++) for (j = i + 1; j < g.length; j++) out.push([g[i], g[j]]); }
    var pats = []; for (var p = 0; p <= 7; p++) pats.push([p, p + 1, p + 2, p + 3, p + 4]);
    pats.push([11, 12, 0, 1, 2], [12, 0, 1, 2, 3]);
    pats.forEach(function (pt) {
      if (!pt.every(function (x) { return m[x]; })) return;
      var topR = pt[0] === 11 || pt[0] === 12 ? 12 : pt[4];
      // 一般順子：其他用最小花色，最大那張每種花色各試一次
      m[topR].forEach(function (tc) { out.push(pt.map(function (x) { return x === topR ? tc : m[x][0]; })); });
      // 同花順
      for (var su = 0; su < 4; su++) { var cs = pt.map(function (x) { return m[x].filter(function (c) { return st(c) === su; })[0]; }); if (cs.every(function (c) { return c != null; })) out.push(cs); }
    });
    var ranks = Object.keys(m).map(Number).sort(function (a, b) { return a - b; });
    ranks.forEach(function (tr) {
      if (m[tr].length >= 3) {
        var pr = ranks.filter(function (x) { return x !== tr && m[x].length >= 2; })[0];
        if (pr != null) out.push(m[tr].slice(0, 3).concat(m[pr].slice(0, 2)));
      }
      if (m[tr].length === 4) {
        var kick = h.filter(function (c) { return rk(c) !== tr; }).sort(function (a, b) { return a - b; })[0];
        if (kick != null) out.push(m[tr].concat([kick]));
      }
    });
    var seen = {};
    return out.map(function (cs) { var c = classify(cs); return c ? { cs: cs.slice().sort(function (a, b) { return a - b; }), c: c } : null; })
      .filter(function (x) { if (!x) return false; var k = x.cs.join(','); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function orderVal(x) { return (x.c.bomb ? 1e6 : 0) + (x.c.t === 5 ? x.c.f * 1e4 : 0) + x.c.k; }

  // 把手牌拆成組（五張 → 對子 → 單張），試兩種順序挑組數最少的
  function partition(h) {
    function run(prefer) {
      var rest = h.slice(), groups = [];
      for (var guard = 0; guard < 5; guard++) {
        var fives = combos(rest).filter(function (x) { return x.c.t === 5 && (prefer === 0 ? true : x.c.f >= 2); });
        if (!fives.length) break;
        // 優先用掉孤張多的組合
        var single = byRank(rest);
        fives.sort(function (a, b) { return score5(b, single) - score5(a, single); });
        var f = fives[0]; groups.push(f); rest = rest.filter(function (c) { return f.cs.indexOf(c) < 0; });
      }
      var m = byRank(rest);
      Object.keys(m).forEach(function (r) {
        var g = m[r];
        while (g.length >= 2) { var pc = g.splice(0, 2); groups.push({ cs: pc, c: classify(pc) }); }
        if (g.length) groups.push({ cs: g.slice(), c: classify(g.slice()) });
      });
      return groups;
    }
    function score5(x, m) { var s = 0; x.cs.forEach(function (c) { if (m[rk(c)].length === 1) s += 2; else if (m[rk(c)].length === 2) s -= 1; }); return s - x.c.k / 100; }
    var a = run(0), b = run(1);
    return (b.length < a.length ? b : a).sort(function (x, y) { return orderVal(x) - orderVal(y); });
  }

  // ---------- 電腦出牌 ----------
  function aiMove(p) {
    var h = G.hands[p], lv = M.lv, prev = G.lead ? null : G.top, first = G.first;
    var all = combos(h).filter(function (x) { return (!first || x.cs.indexOf(0) >= 0) && beats(x.c, prev ? prev.c : null); });
    if (!all.length) return null;
    all.sort(function (a, b) { return orderVal(a) - orderVal(b); });
    var nxt = (p + 1) % 4, danger = Math.min.apply(null, [0, 1, 2, 3].filter(function (q) { return q !== p; }).map(function (q) { return G.hands[q].length; }));
    if (lv === 'easy') {
      if (!prev) { var lows = all.filter(function (x) { return x.c.t === 1; }); return Math.random() < 0.7 && lows.length ? lows[0] : all[0]; }
      if (Math.random() < 0.25) return null;
      return all[Math.floor(Math.random() * Math.min(3, all.length))];
    }
    var parts = partition(h), inPart = function (x) { var k = x.cs.join(','); return parts.some(function (g) { return g.cs.slice().sort(function (a, b) { return a - b; }).join(',') === k; }); };
    if (!prev) {
      var cand = all.filter(inPart);
      if (!cand.length) cand = all;
      if (first) return cand[0];
      // 先出五張，再對子，最後單張；下家只剩 1 張時不出小單張
      var lead = cand.filter(function (x) { return x.c.t === 5 && !x.c.bomb; })[0] || cand.filter(function (x) { return x.c.t === 2 && rk(x.cs[0]) < 12; })[0];
      if (lv === 'hard' && G.hands[nxt].length === 1) {
        var nonSingle = cand.filter(function (x) { return x.c.t > 1; })[0];
        if (nonSingle) return nonSingle;
        return cand.filter(function (x) { return x.c.t === 1; }).pop();
      }
      if (h.length <= 6 && parts.length <= 2) return parts[0].c && all.filter(inPart)[0] || cand[0];
      return lead || cand[0];
    }
    var intact = all.filter(inPart), breakers = all.filter(function (x) { return !inPart(x); });
    var urgent = danger <= 3 || h.length <= 4;
    // 不要隨便把 2 或炸彈丟出去
    var cheap = function (x) { return !x.c.bomb && !(x.c.t <= 2 && rk(x.cs[x.cs.length - 1]) === 12); };
    if (lv === 'hard') {
      var pick = intact.filter(cheap)[0] || (urgent ? (intact[0] || breakers.filter(cheap)[0] || breakers[0]) : null);
      if (!pick && prev.c.t === 1 && h.length <= 8) pick = all.filter(function (x) { return x.c.t === 1; }).filter(function (x) { return rk(x.cs[0]) === 12; })[0];
      // 對手快出完了：下家只剩 1 張時單張要出最大的
      if (pick && pick.c.t === 1 && G.hands[nxt].length === 1) pick = all.filter(function (x) { return x.c.t === 1; }).pop();
      // 上一手是隊友般的小牌？沒有隊友，所以只要壓得過且便宜就壓
      return pick || null;
    }
    // normal
    var pk = intact.filter(cheap)[0] || (urgent ? all[0] : (Math.random() < 0.4 ? breakers.filter(cheap)[0] : null));
    if (!pk && Math.random() < 0.3) pk = intact[0];
    return pk || null;
  }

  // ---------- 座位、名字與線上狀態 ----------
  // NM[p]：座位 p 的名字（畫面座位，0 = 自己）。NET：null = 單機；{role:'host', rem:{座位:連線}}；{role:'guest', conn}
  var NM = null, NET = null, GEN = 0, turnTimer = null;
  function myName() { var n = K.load('sc_lb_name', ''); return (typeof n === 'string' && n.trim()) ? n.trim().slice(0, 16) : L('房主', 'Host'); }
  function setOffline() { NET = null; NM = [{ zh: '你', en: 'You', fc: '🙂' }].concat(BOTS); }
  function name(p) { return p === 0 ? L('你', 'You') : L(NM[p].zh, NM[p].en); }
  function face(p) { return p === 0 ? '🙂' : NM[p].fc; }
  function isRemote(p) { return !!(NET && NET.role === 'host' && NET.rem[p]); }
  function isGuest() { return !!(NET && NET.role === 'guest'); }
  function msgText(m) {
    if (!m || !m.k) return '';
    if (m.k === 'deal') return L('第 ', 'Deal ') + (M.hand + 1) + ' / ' + HANDS + L(' 局　', ' · ') + name(m.p) + L(' 有梅花 3，先出', ' has ♣3 and leads');
    if (m.k === 'lead') return name(m.p) + L(' 得到出牌權', ' leads a new round');
    if (m.k === 'left') return name(m.p) + L('：真人玩家離線，改由電腦代打', ': player left — AI takes over');
    return '';
  }

  // ---------- 對局流程（單機與房主共用；客人只顯示房主送來的畫面） ----------
  function newMatch(lv) {
    if (isGuest()) return;
    M = { lv: lv, hand: 0, tot: [0, 0, 0, 0], log: [], online: !!NET };
    if (!NET) {
      K.save(SAVE, M);
      if (window.SCLB) SCLB.start(GAME, lv);
      $('bLb').href = '/leaderboard/?game=bigtwo&mode=' + lv;
    }
    if (window.SC) SC.post('start', { game: GAME, level: lv, online: !!NET });
    deal();
  }
  function deal() {
    GEN++; K.close('ovHand');
    var deck = K.shuffle(Array.from({ length: 52 }, function (_, i) { return i; }));
    G = { hands: [0, 1, 2, 3].map(function (p) { return deck.slice(p * 13, p * 13 + 13).sort(function (a, b) { return a - b; }); }),
      last: [null, null, null, null], top: null, topBy: -1, lead: true, first: true, passes: 0, turn: 0, played: [0, 0, 0, 0], over: false, msg: null };
    G.turn = G.hands.findIndex(function (h) { return h.indexOf(0) >= 0; });
    G.msg = { k: 'deal', p: G.turn };
    sel = {}; hintList = []; hintIdx = -1;
    render(); next();
  }
  function next() {
    if (G.over) return;
    clearTimeout(turnTimer);
    render();
    var p = G.turn, gen = GEN;
    if (p === 0) { busy = false; autoSel(); return; }
    if (isRemote(p)) {
      busy = false;
      // 真人超過 45 秒沒動作就由電腦代出，避免卡住整桌
      turnTimer = setTimeout(function () { if (gen === GEN && G.turn === p && !G.over && isRemote(p)) { K.toast(name(p) + L(' 超時，自動出牌', ' timed out — auto play')); botTurn(); } }, 45000);
      return;
    }
    busy = true;
    setTimeout(function () { if (gen !== GEN) return; busy = false; botTurn(); }, FAST ? 5 : 650 + Math.random() * 500);
  }
  function botTurn() {
    if (G.over || G.turn === 0) return;
    var mv = aiMove(G.turn);
    if (G.first && !mv) mv = { cs: [0], c: classify([0]) };
    act(G.turn, mv);
  }
  function act(p, mv) {
    clearTimeout(turnTimer);
    if (mv) {
      G.hands[p] = G.hands[p].filter(function (c) { return mv.cs.indexOf(c) < 0; });
      G.top = mv; G.topBy = p; G.lead = false; G.first = false; G.passes = 0; G.last[p] = mv.cs; G.played[p] += mv.cs.length;
      sound(mv);
      if (!G.hands[p].length) return endHand(p);
      if (G.hands[p].length === 1 && p !== 0) K.toast(name(p) + L(' 只剩 1 張！', ' has 1 card left!'));
    } else {
      G.last[p] = 'pass'; G.passes++; K.beep(220, 0.06, 'sine', 0.03);
    }
    G.turn = (p + 1) % 4;
    if (G.passes >= 3) {
      // 其他三家都 Pass，出牌的人重新自由出
      G.lead = true; G.top = null; G.passes = 0; G.turn = G.topBy; G.last = [null, null, null, null];
      G.msg = { k: 'lead', p: G.turn };
    } else G.msg = null;
    next();
  }
  function sound(mv) {
    if (mv.c.bomb) { K.beep(110, 0.5, 'sawtooth', 0.08, 50); return; }
    K.beep(mv.c.t === 5 ? 520 : 440, 0.07, 'triangle', 0.05);
  }
  function penalty(n, played) { if (!played) return n * 4; return n >= 10 ? n * 3 : n >= 8 ? n * 2 : n; }
  function endHand(w) {
    G.over = true; GEN++;
    var d = [0, 0, 0, 0], pot = 0;
    for (var p = 0; p < 4; p++) if (p !== w) { var pen = penalty(G.hands[p].length, G.played[p]); d[p] = -pen; pot += pen; }
    d[w] = pot;
    for (var q = 0; q < 4; q++) M.tot[q] += d[q];
    M.hand++; M.log.push(d);
    if (!NET) K.save(SAVE, M);
    render(true);
    K.beep(w === 0 ? 660 : 300, 0.4, 'triangle', 0.07, w === 0 ? 1320 : 150);
    if (window.SC) SC.post('hand', { game: GAME, win: w === 0, delta: d[0] });
    if (NET && NET.role === 'host') Object.keys(NET.rem).forEach(function (k) { NET.rem[k].send({ t: 'res', w: w, d: d }); });
    setTimeout(function () { showResult(w, d); }, 900);
  }
  function showResult(w, d) {
    var done = M.hand >= HANDS;
    $('hTitle').textContent = done ? L('整場結束', 'Match over') : (w === 0 ? L('🎉 你贏了這局！', '🎉 You won this deal!') : name(w) + L(' 贏了這局', ' won this deal'));
    var rows = '<tr><th></th><th>' + L('剩牌', 'Left') + '</th><th>' + L('本局', 'Deal') + '</th><th>' + L('總分', 'Total') + '</th></tr>';
    var order = [0, 1, 2, 3];
    if (done) order.sort(function (a, b) { return M.tot[b] - M.tot[a]; });
    order.forEach(function (p) {
      rows += '<tr class="' + (p === 0 ? 'mine' : '') + '"><td>' + face(p) + ' ' + K.esc(name(p)) + '</td><td>' + G.hands[p].length + '</td><td class="' + (d[p] >= 0 ? 'pos' : 'neg') + '">' + (d[p] > 0 ? '+' : '') + d[p] + '</td><td><b>' + M.tot[p] + '</b></td></tr>';
    });
    $('hTable').innerHTML = rows;
    if (isGuest()) $('bNext').textContent = done ? L('關閉', 'Close') : L('關閉（等房主開下一局）', 'Close (host deals next)');
    else $('bNext').textContent = done ? L('再來一場', 'New match') : L('下一局', 'Next deal') + '（' + (M.hand + 1) + '/' + HANDS + '）';
    K.open('ovHand');
    if (done) {
      var rank = order.indexOf(0) + 1;
      $('hTitle').textContent = (rank === 1 ? '🏆 ' : '') + L('整場結束：你第 ' + rank + ' 名', 'Match over: you placed #' + rank);
      if (window.SC) SC.post('gameover', { game: GAME, score: M.tot[0], rank: rank, online: !!NET });
      if (!NET) {
        K.save(SAVE, null);
        setTimeout(function () { if (window.SCLB) SCLB.offer({ game: GAME, mode: M.lv, score: M.tot[0], text: L(LV[M.lv][0], LV[M.lv][1]) + ' ' + (M.tot[0] > 0 ? '+' : '') + M.tot[0] + L(' 分', ' pts') }); }, 500);
      }
    }
  }

  // ---------- 線上：房主 ----------
  function snap(q) {
    return { t: 'st', seat: q, nm: NM.map(function (n, i) { return i === 0 ? { zh: myName(), en: myName(), fc: '🙂' } : n; }), hand: G.hands[q],
      cnt: G.hands.map(function (h) { return h.length; }), last: G.last, top: G.top ? G.top.cs : null, topBy: G.topBy, lead: G.lead, first: G.first,
      turn: G.turn, over: G.over, played: G.played, tot: M.tot, hno: M.hand, msg: G.msg, reveal: G.over ? G.hands : null };
  }
  function broadcast() { if (NET && NET.role === 'host' && G) Object.keys(NET.rem).forEach(function (k) { NET.rem[k].send(snap(+k)); }); }
  function legalFor(p, cs) {
    if (!Array.isArray(cs) || !cs.length || cs.length > 5) return null;
    var h = G.hands[p], seen = {};
    for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (typeof c !== 'number' || h.indexOf(c) < 0 || seen[c]) return null; seen[c] = 1; }
    var cl = classify(cs); if (!cl) return null;
    if (G.first && cs.indexOf(0) < 0) return null;
    if (!beats(cl, G.lead ? null : G.top.c)) return null;
    return { cs: cs.slice().sort(function (a, b) { return a - b; }), c: cl };
  }
  function startHost(conns) {
    leaveOnline(true);
    setOffline();
    NET = { role: 'host', rem: {} };
    var seats = [2, 1, 3];
    conns.forEach(function (c, i) {
      var p = seats[i]; NET.rem[p] = c;
      NM[p] = { zh: c.name || L('玩家', 'Player') + (i + 1), en: c.name || 'Player ' + (i + 1), fc: ['🧑', '👧', '🧓'][i] };
      c.onData = function (m) {
        if (!m) return;
        if (m.t === 'hello') { var n = String(m.name || '').slice(0, 16); if (n) { NM[p].zh = NM[p].en = n; render(G && G.over); } return; }
        if (!G || G.over || G.turn !== p) return;
        if (m.t === 'play') { var mv = legalFor(p, m.cs); if (mv) act(p, mv); else c.send(snap(p)); }
        else if (m.t === 'pass' && !G.lead) act(p, null);
      };
      c.onClose = function () {
        if (!NET || NET.rem[p] !== c) return;
        delete NET.rem[p]; NM[p] = BOTS[p - 1];
        K.toast(L('有玩家離線，改由電腦代打', 'A player left — AI takes over'));
        if (G) { G.msg = { k: 'left', p: p }; render(G.over); if (!G.over && G.turn === p) next(); }
        if (!Object.keys(NET.rem).length) NET.alone = true;
      };
    });
    K.toast(L('線上對局開始！', 'Online match started!'));
    newMatch('normal');
  }

  // ---------- 線上：客人 ----------
  function startGuest(conn) {
    leaveOnline(true);
    setOffline(); GEN++;
    NET = { role: 'guest', conn: conn };
    if (G) { G.over = true; G.msg = null; }
    conn.send({ t: 'hello', name: myName() });
    $('msg').textContent = L('已加入房間，等待房主開始…', 'Joined. Waiting for the host to start…');
    renderHand();
    var lastTop = '', mySeat = 0;
    conn.onData = function (m) {
      if (!m) return;
      if (m.t === 'st') {
        var q = mySeat = m.seat, rot = function (a) { return [0, 1, 2, 3].map(function (v) { return a[(v + q) % 4]; }); }, vw = function (r) { return r < 0 ? -1 : (r - q + 4) % 4; };
        NM = rot(m.nm); NM[0] = { zh: '你', en: 'You', fc: '🙂' };
        var wasOver = G && G.over;
        M = { lv: 'normal', hand: m.hno, tot: rot(m.tot), log: [], online: true };
        G = { hands: [0, 1, 2, 3].map(function (v) { var r = (v + q) % 4; return v === 0 ? m.hand.slice() : m.reveal ? m.reveal[r].slice() : new Array(m.cnt[r]).fill(-1); }),
          last: rot(m.last), top: m.top ? { cs: m.top, c: classify(m.top) } : null, topBy: vw(m.topBy), lead: m.lead, first: m.first, passes: 0,
          turn: vw(m.turn), played: rot(m.played), over: m.over, msg: m.msg ? { k: m.msg.k, p: vw(m.msg.p) } : null };
        if (!m.over && wasOver) { K.close('ovHand'); sel = {}; }
        var tk = m.top ? m.top.join(',') : '';
        if (tk && tk !== lastTop && G.top) sound(G.top); lastTop = tk;
        Object.keys(sel).forEach(function (c) { if (G.hands[0].indexOf(+c) < 0) delete sel[c]; });
        busy = false; render(G.over);
        if (G.turn === 0 && !G.over) { autoSel(); K.beep(700, 0.06, 'sine', 0.04); }
      } else if (m.t === 'res') {
        var dv = [0, 1, 2, 3].map(function (v) { return m.d[(v + mySeat) % 4]; });
        setTimeout(function () { showResult((m.w - mySeat + 4) % 4, dv); }, 900);
      }
    };
    conn.onClose = function () {
      if (!NET || NET.conn !== conn) return;
      NET = null; setOffline();
      K.toast(L('房主已離開，回到單機模式', 'The host left. Back to single player'), 3000);
      K.close('ovHand'); newMatch('normal');
    };
  }
  function leaveOnline(silent) {
    if (!NET) return;
    var n = NET; NET = null; clearTimeout(turnTimer);
    if (n.role === 'guest') { n.conn.onClose = null; n.conn.close(); }
    else Object.keys(n.rem).forEach(function (k) { n.rem[k].onClose = null; n.rem[k].close(); });
    if (!silent) K.toast(L('已離開線上對戰', 'Left the online game'));
  }
  function openOnline(code) {
    if (!window.SCNet) return;
    SCNet.openLobby({ game: GAME, title: L('王者大老二', 'Big Two King'), max: 4, code: code, autoJoin: !!code,
      onReady: function (conn) { if (conn.role === 'host') startHost([conn]); else startGuest(conn); },
      onRoom: startHost });
  }

  // ---------- 玩家操作 ----------
  var sel = {};
  function selected() { return G.hands[0].filter(function (c) { return sel[c]; }); }
  function legal(cs) {
    var c = classify(cs); if (!c) return null;
    if (G.first && cs.indexOf(0) < 0) return null;
    if (!beats(c, G.lead ? null : G.top.c)) return null;
    return { cs: cs.slice().sort(function (a, b) { return a - b; }), c: c };
  }
  function play() {
    if (busy || !G || G.over || G.turn !== 0) return;
    var mv = legal(selected());
    if (!mv) { K.toast(selected().length ? L('這樣出不行', 'That play isn’t allowed') : L('先選牌', 'Select cards first')); K.beep(150, 0.1, 'square', 0.04); return; }
    sel = {}; hintIdx = -1;
    if (isGuest()) { busy = true; NET.conn.send({ t: 'play', cs: mv.cs }); renderHand(); return; }
    act(0, mv);
  }
  function pass() {
    if (busy || !G || G.over || G.turn !== 0) return;
    if (G.lead) { K.toast(L('你有出牌權，不能 Pass', 'You lead — you can’t pass')); return; }
    sel = {}; hintIdx = -1;
    if (isGuest()) { busy = true; NET.conn.send({ t: 'pass' }); renderHand(); return; }
    act(0, null);
  }
  function hint() {
    if (busy || !G || G.over || G.turn !== 0) return;
    if (hintIdx < 0) {
      hintList = combos(G.hands[0]).filter(function (x) { return (!G.first || x.cs.indexOf(0) >= 0) && beats(x.c, G.lead ? null : G.top.c); }).sort(function (a, b) { return orderVal(a) - orderVal(b); });
    }
    if (!hintList.length) { K.toast(L('沒有牌壓得過，只能 Pass', 'Nothing beats it — pass')); return; }
    hintIdx = (hintIdx + 1) % hintList.length; sel = {}; hintList[hintIdx].cs.forEach(function (c) { sel[c] = 1; }); renderHand();
  }
  function autoSel() { if (G.first && G.hands[0].indexOf(0) >= 0 && !selected().length) { sel = {}; sel[0] = 1; renderHand(); } }

  // ---------- 畫面 ----------
  function cardHtml(c) {
    var red = st(c) === 1 || st(c) === 2;
    return '<div class="card' + (red ? ' red' : '') + '" data-c="' + c + '"><span class="r">' + RANKS[rk(c)] + '</span><span class="s">' + SUITS[st(c)] + '</span><span class="big">' + SUITS[st(c)] + '</span></div>';
  }
  function lastHtml(x) { if (x === 'pass') return '<span class="pass">PASS</span>'; if (!x) return ''; return x.map(cardHtml).join(''); }
  function renderHand() {
    var h = G.hands[0].slice();
    if (sortBySuit) h.sort(function (a, b) { return st(a) - st(b) || a - b; });
    $('hand').innerHTML = h.map(function (c) { return cardHtml(c).replace('class="card', 'class="card' + (sel[c] ? ' sel' : '')); }).join('');
    var my = G.turn === 0 && !G.over && !busy;
    $('bPlay').disabled = !my; $('bPass').disabled = !my || G.lead; $('bHint').disabled = !my;
  }
  function render(reveal) {
    for (var p = 1; p <= 3; p++) {
      var n = G.hands[p].length, backs = '';
      for (var i = 0; i < Math.min(n, 13); i++) backs += '<i></i>';
      var lastBox = reveal && G.over && n ? G.hands[p].map(cardHtml).join('') : (G.topBy === p && G.top && G.last[p] !== 'pass' ? '' : lastHtml(G.last[p]));
      $('seat' + p).innerHTML = '<div class="av' + (G.turn === p && !G.over ? ' turn' : '') + '"><span class="fc">' + face(p) + '</span><div><b>' + K.esc(name(p)) + '</b><small>' + L('總分 ', 'Total ') + M.tot[p] + '</small></div></div>' +
        '<div class="backs">' + backs + '</div><span class="cnt' + (n <= 2 && n ? ' warn' : '') + '">' + n + L(' 張', ' cards') + '</span><div class="last">' + lastBox + '</div>';
    }
    $('trick').innerHTML = G.top ? G.top.cs.map(cardHtml).join('') : '';
    var lb = $('trick'); if (G.top) lb.title = name(G.topBy);
    $('meInfo').innerHTML = (G.turn === 0 && !G.over ? '👉 <b>' + L('輪到你', 'Your turn') + '</b>　' : '') + L('總分 ', 'Total ') + '<b>' + M.tot[0] + '</b>　' + (G.last[0] === 'pass' ? 'PASS' : '');
    $('sub').textContent = (M.online ? L('🌐 線上對戰', '🌐 Online') : L(LV[M.lv][0], LV[M.lv][1])) + L('・第 ', ' · Deal ') + Math.max(1, Math.min(M.hand + (G.over ? 0 : 1), HANDS)) + '/' + HANDS;
    $('msg').textContent = msgText(G.msg);
    $('bOnline').textContent = NET ? L('🌐 離開線上', '🌐 Leave online') : L('🌐 線上對戰', '🌐 Online');
    renderHand();
    broadcast();
  }

  // ---------- 綁定 ----------
  $('hand').addEventListener('click', function (e) {
    var c = e.target.closest('.card'); if (!c || !G || G.over) return;
    var id = +c.dataset.c; sel[id] = !sel[id]; hintIdx = -1; K.beep(800, 0.02, 'sine', 0.02); renderHand();
  });
  $('bPlay').onclick = play; $('bPass').onclick = pass; $('bHint').onclick = hint;
  $('bSort').onclick = function () { sortBySuit = !sortBySuit; renderHand(); };
  $('bNext').onclick = function () {
    K.close('ovHand');
    if (isGuest()) return;
    if (M.hand >= HANDS) { if (NET) newMatch('normal'); else openNew(); } else deal();
  };
  $('bOnline').onclick = function () {
    if (!NET) { openOnline(); return; }
    if (!(Date.now() - (window._b2ask || 0) < 2500)) { window._b2ask = Date.now(); K.toast(L('再按一次離開線上對戰', 'Tap again to leave the online game')); return; }
    leaveOnline(); setOffline(); newMatch('normal');
  };
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = '';
    Object.keys(LV).forEach(function (k) { var b = document.createElement('button'); b.textContent = L(LV[k][0], LV[k][1]); b.onclick = function () { K.close('ovNew'); newMatch(k); }; if (M && M.lv === k) b.className = 'on'; ch.appendChild(b); });
    K.open('ovNew');
  }
  $('bNew').onclick = function () { if (NET) { $('bOnline').onclick(); return; } openNew(); };
  $('bRules').onclick = function () { $('rulesBody').innerHTML = [].map.call(document.querySelectorAll('.k-help article'), function (a) { return a.innerHTML; }).join(''); K.open('ovRules'); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Enter') { e.preventDefault(); play(); } else if (e.key === 'p' || e.key === 'P') pass(); else if (e.key === 'h' || e.key === 'H') hint();
  });
  if (window.SC) SC.onLang(function () { if (G) render(G.over); });

  // 接續上一場（從下一局開始）；網址有 ?room= 就直接開線上視窗
  setOffline();
  var room = window.SCNet && SCNet.roomFromUrl();
  var sv = K.load(SAVE, null);
  if (sv && LV[sv.lv] && sv.hand < HANDS) { M = sv; $('bLb').href = '/leaderboard/?game=bigtwo&mode=' + M.lv; if (window.SCLB && !SCLB.has(GAME, M.lv)) SCLB.start(GAME, M.lv); deal(); }
  else { M = { lv: 'normal', hand: 0, tot: [0, 0, 0, 0], log: [] }; newMatch('normal'); }
  if (room) { SCNet.clearRoomFromUrl(); openOnline(room); }
})();
