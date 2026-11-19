/* 麻將大亨 — stockcorp.github.io/mahjong/
   台灣十六張：吃（上家）、碰、明槓、暗槓、加槓、搶槓、胡、自摸、花牌補牌、留 16 張流局。
   一將 = 東風圈（至少 4 把，莊家胡或流局連莊，最多 8 把）。每把 = 底 10 + 每台 5。
   排行榜：mode = easy/normal/hard，分數 = 一將總分（越高越好）。 */
(function () {
  'use strict';
  var GAME = 'mahjong', SAVE = 'scmj_save', MAXH = 8, LEAVE = 16, BASE = 10, PER = 5;
  var FAST = location.hash === '#fast', $ = K.$, L = K.L;
  var LV = { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] };
  var BOTS = [{ zh: '阿財', en: 'Choi', fc: '🧑‍💼' }, { zh: '麗麗', en: 'Lily', fc: '👩‍🦰' }, { zh: '大炮', en: 'Cannon', fc: '🧔' }];
  var NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var HON = ['東', '南', '西', '北', '中', '發', '白'];
  var FLW = ['春', '夏', '秋', '冬', '梅', '蘭', '菊', '竹'];
  var WIND = [['東', 'E'], ['南', 'S'], ['西', 'W'], ['北', 'N']];
  var M = null, G = null, P = null, autoPass = false, waiter = null, sel = -1, tipK = -1, cache = {};
  var STALE = { stale: true };
  // 每次等待後確認這一把還有效（中途按「新的一將」時舊流程會被丟掉）
  function guard(g) { return function (v) { if (g !== G || g.dead) throw STALE; return v; }; }
  var sleep = function (ms) { var g = G; return new Promise(function (r) { setTimeout(r, FAST ? 1 : ms); }).then(guard(g)); };

  // ---------- 牌的判斷 ----------
  function suit(k) { return k < 27 ? Math.floor(k / 9) : 3; }
  function isHonor(k) { return k >= 27 && k < 34; }
  function counts(arr) { var c = new Array(34).fill(0); arr.forEach(function (k) { c[k]++; }); return c; }
  function seatWind(p) { return (p - G.dealer + 4) % 4; }

  // 能不能胡：closed counts 要剛好 need 組 + 1 對
  function canWinC(c, need) {
    var n = c.reduce(function (a, b) { return a + b; }, 0); if (n !== need * 3 + 2) return false;
    for (var i = 0; i < 34; i++) if (c[i] >= 2) { c[i] -= 2; var ok = sets(c, need); c[i] += 2; if (ok) return true; }
    return false;
  }
  function sets(c, need) {
    var i = 0; while (i < 34 && !c[i]) i++;
    if (i >= 34) return need === 0;
    if (c[i] >= 3) { c[i] -= 3; var a = sets(c, need - 1); c[i] += 3; if (a) return true; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; var b = sets(c, need - 1); c[i]++; c[i + 1]++; c[i + 2]++; if (b) return true; }
    return false;
  }
  function canWin(p, extra) { var h = P[p].hand.slice(); if (extra != null) h.push(extra); return canWinC(counts(h), 5 - P[p].melds.length); }

  // 所有拆法（算台用）
  function decomps(c, need) {
    var out = [];
    for (var i = 0; i < 34; i++) if (c[i] >= 2) { c[i] -= 2; rec(c, need, [], i); c[i] += 2; }
    function rec(c2, nd, acc, pair) {
      var j = 0; while (j < 34 && !c2[j]) j++;
      if (j >= 34) { if (nd === 0) out.push({ pair: pair, sets: acc.slice() }); return; }
      if (c2[j] >= 3) { c2[j] -= 3; acc.push({ t: 'pon', k: j }); rec(c2, nd - 1, acc, pair); acc.pop(); c2[j] += 3; }
      if (j < 27 && j % 9 <= 6 && c2[j + 1] && c2[j + 2]) { c2[j]--; c2[j + 1]--; c2[j + 2]--; acc.push({ t: 'chi', k: j }); rec(c2, nd - 1, acc, pair); acc.pop(); c2[j]++; c2[j + 1]++; c2[j + 2]++; }
    }
    return out;
  }

  // 向聽數：2*need - 2*面子 - 搭子 - 對子(雀頭)，-1 = 胡
  function shanten(c, need) {
    var key = need + ':' + c.join(''); if (cache[key] != null) return cache[key];
    var best = 2 * need;
    (function dfs(i, m, t, p) {
      while (i < 34 && !c[i]) i++;
      if (i >= 34) { var tt = Math.min(t, need - m); var v = 2 * need - 2 * m - tt - p; if (v < best) best = v; return; }
      if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (c[i] >= 2 && !p) { c[i] -= 2; dfs(i, m, t, 1); c[i] += 2; }
      if (m + t < need) {
        if (c[i] >= 2) { c[i] -= 2; dfs(i, m, t + 1, p); c[i] += 2; }
        if (i < 27 && i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++; }
        if (i < 27 && i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      }
      c[i]--; dfs(i, m, t, p); c[i]++;
    })(0, 0, 0, 0);
    cache[key] = best; return best;
  }
  function shOf(p, hand) { return shanten(counts(hand || P[p].hand), 5 - P[p].melds.length); }

  // ---------- 看得到的牌（算剩幾張、安全牌） ----------
  function visible(p) {
    var v = new Array(34).fill(0);
    P.forEach(function (q, i) { q.river.forEach(function (k) { v[k]++; }); q.melds.forEach(function (m) { m.tiles.forEach(function (k) { v[k]++; }); }); });
    P[p].hand.forEach(function (k) { v[k]++; });
    return v;
  }
  function ukeire(p, hand) {
    var c = counts(hand), need = 5 - P[p].melds.length, s = shanten(c, need), vis = visible(p), n = 0;
    for (var k = 0; k < 34; k++) {
      if (vis[k] >= 4) continue;
      if (k < 27) { var near = false; for (var d = -2; d <= 2; d++) { var j = k + d; if (j >= 0 && j < 27 && suit(j) === suit(k) && c[j]) near = true; } if (!near) continue; }
      else if (!c[k]) continue;
      c[k]++; if (shanten(c, need) < s) n += 4 - vis[k]; c[k]--;
    }
    return n;
  }

  // ---------- 電腦決策 ----------
  function botDiscard(p) {
    var h = P[p].hand, kinds = Array.from(new Set(h)), lv = M.lv;
    var res = kinds.map(function (k) { var x = h.slice(); x.splice(x.indexOf(k), 1); return { k: k, s: shOf(p, x), x: x }; });
    var minS = Math.min.apply(null, res.map(function (r) { return r.s; }));
    if (lv === 'easy' && Math.random() < 0.35) return kinds[(Math.random() * kinds.length) | 0];
    var cand = res.filter(function (r) { return r.s === minS; });
    if (lv === 'hard') {
      var threat = threatOf(p);
      if (threat >= 0 && minS >= 2) {
        var safe = res.map(function (r) { return { k: r.k, d: danger(p, r.k, threat), s: r.s }; }).sort(function (a, b) { return a.d - b.d || a.s - b.s; });
        return safe[0].k;
      }
      cand.forEach(function (r) { r.u = ukeire(p, r.x); });
      cand.sort(function (a, b) { return b.u - a.u || iso(h, b.k) - iso(h, a.k); });
      return cand[0].k;
    }
    cand.sort(function (a, b) { return iso(h, b.k) - iso(h, a.k); });
    return cand[0].k;
  }
  // 越孤立分數越高（越先丟）
  function iso(h, k) {
    var c = counts(h), sc = 0;
    if (isHonor(k)) { sc = c[k] === 1 ? 10 : 0; if (isValue(k, null)) sc -= 2; return sc; }
    var n = k % 9; sc = (n === 0 || n === 8) ? 3 : (n === 1 || n === 7) ? 1 : 0;
    for (var d = -2; d <= 2; d++) if (d && k + d >= 0 && suit(k + d) === suit(k) && c[k + d]) sc -= (Math.abs(d) === 1 ? 3 : 2);
    if (c[k] >= 2) sc -= 4;
    return sc;
  }
  function isValue(k, p) { return k >= 31 || k === 27 || (p != null && k === 27 + seatWind(p)); }
  function threatOf(p) {
    var best = -1, bm = 2;
    for (var q = 0; q < 4; q++) if (q !== p && P[q].melds.length > bm) { bm = P[q].melds.length; best = q; }
    if (best < 0 && wallLeft() < 22) best = (p + 3) % 4;
    return best;
  }
  function danger(p, k, q) {
    if (P[q].river.indexOf(k) >= 0) return 0;
    var vis = visible(p);
    if (isHonor(k)) return vis[k] >= 3 ? 0.05 : vis[k] === 2 ? 0.3 : 0.6;
    var n = k % 9; return (n === 0 || n === 8) ? 0.5 : (n === 1 || n === 7) ? 0.75 : 1;
  }
  function botWantsPon(p, k) {
    if (M.lv === 'easy') return Math.random() < 0.5;
    var before = shOf(p), h = P[p].hand.slice(); h.splice(h.indexOf(k), 1); h.splice(h.indexOf(k), 1);
    var need = 5 - P[p].melds.length - 1, after = 9;
    Array.from(new Set(h)).forEach(function (d) { var x = h.slice(); x.splice(x.indexOf(d), 1); after = Math.min(after, shanten(counts(x), need)); });
    return after < before || (after === before && isValue(k, p));
  }
  function botWantsChi(p, opt) {
    if (M.lv === 'easy') return Math.random() < 0.3;
    var before = shOf(p), h = P[p].hand.slice(); opt.use.forEach(function (u) { h.splice(h.indexOf(u), 1); });
    var need = 5 - P[p].melds.length - 1, after = 9;
    Array.from(new Set(h)).forEach(function (d) { var x = h.slice(); x.splice(x.indexOf(d), 1); after = Math.min(after, shanten(counts(x), need)); });
    return after < before && (M.lv !== 'hard' || P[p].melds.length < 4 || after <= 0);
  }
  function botWantsKong(p, k, concealed) {
    var h = P[p].hand.slice(), before = shOf(p, h); h = h.filter(function (x) { return x !== k; });
    var after = shanten(counts(concealed ? h : h), 5 - P[p].melds.length - 1);
    return after <= before + (concealed ? 0 : 0) && Math.random() < (M.lv === 'easy' ? 0.6 : 0.95);
  }

  // ---------- 牌牆 ----------
  function wallLeft() { return G.back - G.front + 1 - LEAVE; }
  function drawTile(p, fromBack) {
    for (;;) {
      if (wallLeft() <= 0) return null;
      var k = fromBack ? G.wall[G.back--] : G.wall[G.front++];
      if (k >= 34) { P[p].flowers.push(k); fromBack = true; if (p === 0) K.beep(900, 0.05, 'sine', 0.03); continue; }
      return k;
    }
  }
  function chiOpts(p, k) {
    if (k >= 27) return [];
    var c = counts(P[p].hand), out = [], n = k % 9;
    [[-2, -1], [-1, 1], [1, 2]].forEach(function (d) {
      var a = k + d[0], b = k + d[1];
      if (n + d[0] < 0 || n + d[1] > 8) return;
      if (c[a] && c[b]) out.push({ use: [a, b], seq: [Math.min(a, k), 0, 0].map(function (_, i, arr) { return arr[0] + i; }) });
    });
    return out;
  }

  // ---------- 一把的流程 ----------
  async function playHand() {
    cache = {};
    var w = []; for (var k = 0; k < 34; k++) for (var x = 0; x < 4; x++) w.push(k);
    for (var f = 34; f < 42; f++) w.push(f);
    if (G) G.dead = true;
    G = { wall: K.shuffle(w), front: 0, back: w.length - 1, dealer: M.dealer, turn: M.dealer, last: null, ended: false, first: true };
    P = [0, 1, 2, 3].map(function () { return { hand: [], melds: [], flowers: [], river: [], drawn: null }; });
    for (var r = 0; r < 16; r++) for (var q = 0; q < 4; q++) { var p = (G.dealer + q) % 4, t = G.wall[G.front++]; if (t >= 34) { P[p].flowers.push(t); t = null; } if (t != null) P[p].hand.push(t); }
    // 補花
    for (var q2 = 0; q2 < 4; q2++) { var pp = (G.dealer + q2) % 4; while (P[pp].hand.length < 16) { var nt = drawTile(pp, true); if (nt == null) break; P[pp].hand.push(nt); } }
    P.forEach(function (pl) { pl.hand.sort(function (a, b) { return a - b; }); });
    msg(''); render();
    var p0 = G.dealer, draw = true, kongDraw = false;
    for (;;) {
      var res;
      try { res = await turn(p0, draw, kongDraw); } catch (e) { if (e === STALE) return; throw e; }
      if (G.ended) return;
      if (res.type === 'exhaust') return endHand(null);
      p0 = res.next; draw = res.draw; kongDraw = !!res.kong;
    }
  }

  // 一個人的回合：摸牌 → 自摸/槓 → 打牌 → 別人吃碰槓胡
  async function turn(p, draw, kongDraw) {
    G.turn = p;
    if (draw) {
      var k = drawTile(p, kongDraw);
      if (k == null) return { type: 'exhaust' };
      P[p].hand.push(k); P[p].drawn = k;
    } else P[p].drawn = null;
    render();
    // 自摸、暗槓、加槓
    for (;;) {
      if (G.ended) return {};
      var canTsumo = draw && canWin(p);
      var anK = [], jiaK = [], c = counts(P[p].hand);
      if (wallLeft() > 0) {
        for (var i = 0; i < 34; i++) if (c[i] === 4) anK.push(i);
        P[p].melds.forEach(function (m) { if (m.type === 'pon' && c[m.tiles[0]]) jiaK.push(m.tiles[0]); });
      }
      var choice;
      if (p === 0) {
        if (canTsumo || anK.length || jiaK.length) {
          var ops = [];
          if (canTsumo) ops.push({ id: 'tsumo' });
          anK.forEach(function (x) { ops.push({ id: 'ankong', k: x }); });
          jiaK.forEach(function (x) { ops.push({ id: 'jiakong', k: x }); });
          choice = await askSelf(ops);
        }
      } else {
        await sleep(450 + Math.random() * 350);
        if (canTsumo) choice = { id: 'tsumo' };
        else if (anK.length && botWantsKong(p, anK[0], true)) choice = { id: 'ankong', k: anK[0] };
        else if (jiaK.length && M.lv !== 'easy') choice = { id: 'jiakong', k: jiaK[0] };
      }
      if (!choice || choice.id === 'discard') break;
      if (choice.id === 'tsumo') { win(p, P[p].drawn != null ? P[p].drawn : P[p].hand[P[p].hand.length - 1], true, { kong: kongDraw, last: wallLeft() <= 0 }); return {}; }
      if (choice.id === 'ankong') {
        P[p].hand = P[p].hand.filter(function (x) { return x !== choice.k; });
        P[p].melds.push({ type: 'ankong', tiles: [choice.k, choice.k, choice.k, choice.k] });
        say(p, L('暗槓', 'Kong')); K.beep(300, 0.2, 'square', 0.05);
        return { next: p, draw: true, kong: true };
      }
      if (choice.id === 'jiakong') {
        var mk = choice.k; P[p].hand.splice(P[p].hand.indexOf(mk), 1);
        var meld = P[p].melds.filter(function (m) { return m.type === 'pon' && m.tiles[0] === mk; })[0];
        meld.type = 'kong'; meld.tiles.push(mk); say(p, L('加槓', 'Kong')); render();
        // 搶槓
        for (var d = 1; d <= 3; d++) {
          var q = (p + d) % 4;
          if (canWin(q, mk)) {
            var ok = q === 0 ? (await askClaim([{ id: 'hu', k: mk }], mk)).id === 'hu' : true;
            if (ok) { meld.type = 'pon'; meld.tiles.pop(); P[q].hand.push(mk); win(q, mk, false, { from: p, rob: true }); return {}; }
          }
        }
        return { next: p, draw: true, kong: true };
      }
    }
    // 打牌
    var dk;
    if (p === 0) dk = await askDiscard();
    else dk = botDiscard(p);
    if (G.ended) return {};
    discard(p, dk);
    return await claims(p, dk);
  }
  function discard(p, k) {
    var h = P[p].hand; h.splice(h.indexOf(k), 1); h.sort(function (a, b) { return a - b; });
    P[p].drawn = null; P[p].river.push(k); G.last = { k: k, by: p }; G.first = false; sel = -1; tipK = -1;
    K.beep(p === 0 ? 520 : 420, 0.05, 'triangle', 0.04);
    render();
  }
  async function claims(p, k) {
    var lastTile = wallLeft() <= 0, humanAsked = false;
    // 1) 胡（近的先）
    for (var d = 1; d <= 3; d++) {
      var q = (p + d) % 4;
      if (!canWin(q, k)) continue;
      if (q !== 0) { await sleep(300); takeFromRiver(p); P[q].hand.push(k); win(q, k, false, { from: p, last: lastTile }); return {}; }
      var hOps = [{ id: 'hu', k: k }], c0 = counts(P[0].hand);
      if (c0[k] >= 2 && !lastTile) hOps.push({ id: 'pon', k: k });
      if (c0[k] === 3 && !lastTile) hOps.push({ id: 'kong', k: k });
      if (p === 3 && !lastTile) chiOpts(0, k).forEach(function (o) { hOps.push({ id: 'chi', k: k, o: o }); });
      var ch = await askClaim(hOps, k); humanAsked = true;
      if (ch.id === 'hu') { takeFromRiver(p); P[0].hand.push(k); win(0, k, false, { from: p, last: lastTile }); return {}; }
      if (ch.id !== 'pass') return doClaim(0, p, ch);
    }
    if (lastTile) return { type: 'exhaust' };
    // 2) 碰／槓
    for (var e = 1; e <= 3; e++) {
      var r = (p + e) % 4, c = counts(P[r].hand);
      if (c[k] < 2) continue;
      if (r === 0) {
        if (autoPass || humanAsked) break;
        var ops = [{ id: 'pon', k: k }]; if (c[k] === 3) ops.push({ id: 'kong', k: k });
        if (p === 3) chiOpts(0, k).forEach(function (o) { ops.push({ id: 'chi', k: k, o: o }); });
        var ch2 = await askClaim(ops, k); humanAsked = true;
        if (ch2.id !== 'pass') return doClaim(0, p, ch2);
        if (p === 3) return { next: 0, draw: true }; // 已經問過吃
        break;
      }
      if (c[k] === 3 && botWantsKong(r, k, false)) return doClaim(r, p, { id: 'kong', k: k });
      if (botWantsPon(r, k)) return doClaim(r, p, { id: 'pon', k: k });
      break;
    }
    // 3) 吃（只有下家）
    var nx = (p + 1) % 4, opts = chiOpts(nx, k);
    if (opts.length) {
      if (nx === 0 && !autoPass && !humanAsked) {
        var ch3 = await askClaim(opts.map(function (o) { return { id: 'chi', k: k, o: o }; }), k);
        if (ch3.id !== 'pass') return doClaim(0, p, ch3);
      } else if (nx !== 0) {
        for (var i = 0; i < opts.length; i++) if (botWantsChi(nx, opts[i])) return doClaim(nx, p, { id: 'chi', k: k, o: opts[i] });
      }
    }
    return { next: nx, draw: true };
  }
  function takeFromRiver(p) { P[p].river.pop(); }
  async function doClaim(q, from, ch) {
    var k = ch.k; takeFromRiver(from);
    if (q !== 0) await sleep(250);
    if (ch.id === 'pon' || ch.id === 'kong') {
      var n = ch.id === 'pon' ? 2 : 3;
      for (var i = 0; i < n; i++) P[q].hand.splice(P[q].hand.indexOf(k), 1);
      P[q].melds.push({ type: ch.id, tiles: new Array(n + 1).fill(k), from: from });
      say(q, ch.id === 'pon' ? L('碰！', 'Pung!') : L('槓！', 'Kong!')); K.beep(ch.id === 'pon' ? 360 : 300, 0.18, 'square', 0.05);
      render();
      return ch.id === 'kong' ? { next: q, draw: true, kong: true } : { next: q, draw: false };
    }
    ch.o.use.forEach(function (u) { P[q].hand.splice(P[q].hand.indexOf(u), 1); });
    var s = ch.o.use.concat([k]).sort(function (a, b) { return a - b; });
    P[q].melds.push({ type: 'chi', tiles: s, from: from, got: k });
    say(q, L('吃！', 'Chow!')); K.beep(400, 0.12, 'square', 0.04); render();
    return { next: q, draw: false };
  }

  // ---------- 算台 ----------
  function tai(p, winK, self, ex) {
    var pl = P[p], need = 5 - pl.melds.length, c = counts(pl.hand), ds = decomps(c, need), sw = seatWind(p);
    var allK = pl.hand.slice(); pl.melds.forEach(function (m) { allK = allK.concat(m.tiles); });
    var closed = pl.melds.every(function (m) { return m.type === 'ankong'; });
    var best = null;
    ds.forEach(function (d) {
      var list = [], add = function (zh, en, n) { list.push([zh, en, n]); };
      var sets = d.sets.map(function (s) { return { t: s.t, k: s.k, open: false }; });
      // 胡別人的牌，用到那張的刻子算明刻
      if (!self) { var hit = sets.filter(function (s) { return s.t === 'pon' && s.k === winK; })[0]; var inChi = sets.some(function (s) { return s.t === 'chi' && winK >= s.k && winK <= s.k + 2; }); if (hit && !inChi) hit.open = true; }
      pl.melds.forEach(function (m) { sets.push({ t: m.type === 'chi' ? 'chi' : 'pon', k: m.tiles[0], open: m.type !== 'ankong' }); });
      var pons = sets.filter(function (s) { return s.t === 'pon'; }), chis = sets.filter(function (s) { return s.t === 'chi'; });
      if (self) add('自摸', 'Self-drawn', 1);
      if (closed) add('門清', 'Concealed hand', 1);
      if (closed && self) add('門清自摸加台', 'Concealed self-draw bonus', 1);
      var drag = pons.filter(function (s) { return s.k >= 31; }).length, dragPair = d.pair >= 31;
      pons.forEach(function (s) { if (s.k >= 31) add(HON[s.k - 27] + '刻', HON[s.k - 27] + ' pung', 1); });
      if (pons.some(function (s) { return s.k === 27; })) add('圈風（東）', 'Round wind (E)', 1);
      if (pons.some(function (s) { return s.k === 27 + sw; })) add('門風（' + WIND[sw][0] + '）', 'Seat wind (' + WIND[sw][1] + ')', 1);
      pl.flowers.forEach(function (f) { if ((f - 34) % 4 === sw) add('正花 ' + FLW[f - 34], 'Own flower ' + FLW[f - 34], 1); });
      if (pl.flowers.length === 0 && pons.length === 0 && !isHonor(d.pair) && !self) add('平胡', 'All chows', 2);
      if (chis.length === 0) add('碰碰胡', 'All pungs', 4);
      var con = pons.filter(function (s) { return !s.open; }).length;
      if (con >= 5) add('五暗刻', 'Five concealed pungs', 8); else if (con === 4) add('四暗刻', 'Four concealed pungs', 5); else if (con === 3) add('三暗刻', 'Three concealed pungs', 2);
      var suits = {}, hasH = false; allK.forEach(function (k) { if (isHonor(k)) hasH = true; else suits[suit(k)] = 1; });
      var ns = Object.keys(suits).length;
      if (ns === 0) add('字一色', 'All honors', 16); else if (ns === 1 && !hasH) add('清一色', 'Full flush', 8); else if (ns === 1) add('混一色', 'Half flush', 4);
      if (drag === 3) add('大三元', 'Big three dragons', 8); else if (drag === 2 && dragPair) add('小三元', 'Little three dragons', 4);
      var winds = pons.filter(function (s) { return s.k >= 27 && s.k <= 30; }).length, windPair = d.pair >= 27 && d.pair <= 30;
      if (winds === 4) add('大四喜', 'Big four winds', 16); else if (winds === 3 && windPair) add('小四喜', 'Little four winds', 8);
      if (ex.last) add(self ? '海底撈月' : '河底撈魚', 'Last tile', 1);
      if (ex.kong && self) add('槓上開花', 'Win on kong replacement', 1);
      if (ex.rob) add('搶槓', 'Robbing a kong', 1);
      if (!self && pl.melds.length === 5 && pl.melds.every(function (m) { return m.type !== 'ankong'; })) add('全求人', 'All melded', 2);
      var tot = list.reduce(function (a, b) { return a + b[2]; }, 0);
      if (!best || tot > best.tot) best = { list: list, tot: tot, d: d };
    });
    return best || { list: [], tot: 0, d: null };
  }

  function win(p, k, self, ex) {
    G.ended = true;
    var t = tai(p, k, self, ex), d = [0, 0, 0, 0], dealer = G.dealer;
    var pay = function (q) { var tt = t.tot + (q === dealer || p === dealer ? 1 : 0); return BASE + PER * tt; };
    if (self) { for (var q = 0; q < 4; q++) if (q !== p) { var v = pay(q); d[q] -= v; d[p] += v; } }
    else { var v2 = pay(ex.from); d[ex.from] -= v2; d[p] += v2; }
    var dl = (p === dealer || (!self && ex.from === dealer) || self) ? true : false;
    say(p, self ? L('自摸！', 'Tsumo!') : L('胡！', 'Ron!'));
    K.beep(p === 0 ? 660 : 330, 0.5, 'triangle', 0.08, p === 0 ? 1320 : 165);
    finishHand({ winner: p, self: self, from: ex.from, t: t, d: d, k: k, dealerTai: dl });
  }
  function endHand() { G.ended = true; msg(L('流局', 'Draw — wall exhausted')); finishHand({ winner: null, d: [0, 0, 0, 0] }); }

  async function finishHand(r) {
    if (G.dead) return;
    render(true);
    for (var q = 0; q < 4; q++) M.tot[q] += r.d[q];
    M.hands++;
    // 莊家：胡牌或流局連莊，否則下莊
    var stay = r.winner == null || r.winner === G.dealer;
    if (!stay) { M.dealer = (M.dealer + 1) % 4; M.rot++; }
    var done = M.rot >= 4 || M.hands >= MAXH;
    K.save(SAVE, done ? null : M);
    if (window.SC) SC.post('hand', { game: GAME, win: r.winner === 0, delta: r.d[0] });
    try { await sleep(900); } catch (e) { return; }
    showResult(r, done);
  }
  function showResult(r, done) {
    var title;
    if (r.winner == null) title = L('流局', 'Draw');
    else if (r.winner === 0) title = r.self ? L('🎉 你自摸了！', '🎉 You won by self-draw!') : L('🎉 你胡了！', '🎉 You won!');
    else title = name(r.winner) + (r.self ? L(' 自摸', ' won by self-draw') : L(' 胡牌', ' won') + (r.from === 0 ? L('（你放槍）', ' (off your discard)') : L('，' + name(r.from) + ' 放槍', ', off ' + name(r.from))));
    $('hTitle').textContent = title;
    var wh = '', tl = '';
    if (r.winner != null) {
      var pl = P[r.winner], closed = pl.hand.slice(), wk = r.k;
      closed.splice(closed.lastIndexOf(wk), 1);
      pl.melds.forEach(function (m) { wh += '<div class="grp">' + m.tiles.map(function (k) { return tile(k, 'sm'); }).join('') + '</div>'; });
      wh += '<div class="grp">' + closed.sort(function (a, b) { return a - b; }).map(function (k) { return tile(k, 'sm'); }).join('') + '</div><div class="grp">' + tile(wk, 'sm last') + '</div>';
      if (pl.flowers.length) wh += '<div class="grp">' + pl.flowers.map(function (k) { return tile(k, 'xs'); }).join('') + '</div>';
      var en = window.SC && SC.lang === 'en';
      r.t.list.forEach(function (x) { tl += '<span>' + K.esc(en ? x[1] : x[0]) + ' ' + x[2] + L(' 台', '') + '</span>'; });
      if (r.winner === G.dealer) tl += '<span>' + L('莊家 1 台', 'Dealer 1') + '</span>';
      else if (r.self || r.from === G.dealer) tl += '<span>' + L('莊家多付 1 台', 'Dealer pays +1') + '</span>';
      tl += '<span class="tot">' + L('共 ', 'Total ') + (r.t.tot + (r.winner === G.dealer ? 1 : 0)) + L(' 台', ' tai') + '</span>';
    }
    $('winHand').innerHTML = wh; $('taiList').innerHTML = tl;
    var order = [0, 1, 2, 3]; if (done) order.sort(function (a, b) { return M.tot[b] - M.tot[a]; });
    var rows = '<tr><th></th><th>' + L('本把', 'Deal') + '</th><th>' + L('總分', 'Total') + '</th></tr>';
    order.forEach(function (p) { rows += '<tr class="' + (p === 0 ? 'mine' : '') + '"><td>' + face(p) + ' ' + K.esc(name(p)) + '</td><td class="' + (r.d[p] >= 0 ? 'pos' : 'neg') + '">' + (r.d[p] > 0 ? '+' : '') + r.d[p] + '</td><td><b>' + M.tot[p] + '</b></td></tr>'; });
    $('hTable').innerHTML = rows;
    $('bNext').textContent = done ? L('再打一將', 'New match') : L('下一把', 'Next deal');
    if (done) {
      var rank = order.indexOf(0) + 1;
      $('hTitle').textContent = title + ' — ' + L('一將結束，你第 ' + rank + ' 名', 'Match over: you placed #' + rank);
      if (window.SC) SC.post('gameover', { game: GAME, score: M.tot[0], rank: rank });
      setTimeout(function () { if (window.SCLB) SCLB.offer({ game: GAME, mode: M.lv, score: M.tot[0], text: L(LV[M.lv][0], LV[M.lv][1]) + ' ' + (M.tot[0] > 0 ? '+' : '') + M.tot[0] + L(' 分', ' pts') }); }, 600);
    }
    M.done = done;
    K.open('ovHand');
  }

  // ---------- 玩家輸入 ----------
  function askDiscard() { var g = G; return new Promise(function (res) { waiter = { type: 'discard', res: res }; render(); }).then(guard(g)); }
  function askSelf(ops) { var g = G; return new Promise(function (res) { waiter = { type: 'self', ops: ops, res: res }; render(); }).then(guard(g)); }
  function askClaim(ops, k) { var g = G; return new Promise(function (res) { waiter = { type: 'claim', ops: ops, k: k, res: res }; render(); K.beep(700, 0.08, 'sine', 0.05); }).then(guard(g)); }
  function resolve(v) { var w = waiter; waiter = null; claimBar(); if (w) w.res(v); }

  // ---------- 畫面 ----------
  function tile(k, cls) {
    cls = cls || '';
    if (k >= 34) return '<div class="mj f ' + cls + '"><span class="a">' + FLW[k - 34] + '</span><span class="b">' + ((k - 34) % 4 + 1) + '</span></div>';
    if (k < 27) { var s = ['m', 'p', 's'][suit(k)], b = ['萬', '筒', '條'][suit(k)]; return '<div class="mj ' + s + ' ' + cls + '" data-k="' + k + '"><span class="a">' + NUM[k % 9] + '</span><span class="b">' + b + '</span></div>'; }
    var hc = k === 31 ? ' red' : k === 32 ? ' grn' : k === 33 ? ' wht' : '';
    return '<div class="mj h' + hc + ' ' + cls + '" data-k="' + k + '"><span class="a">' + (k === 33 ? '' : HON[k - 27]) + '</span></div>';
  }
  function name(p) { return p === 0 ? L('你', 'You') : L(BOTS[p - 1].zh, BOTS[p - 1].en); }
  function face(p) { return p === 0 ? '🙂' : BOTS[p - 1].fc; }
  function msg(t) { $('msg').textContent = t; }
  function say(p, t) { msg(name(p) + '：' + t); }
  function meldHtml(pl, size) {
    return pl.melds.map(function (m) { return '<div class="meld">' + m.tiles.map(function (k, i) { return m.type === 'ankong' && (i === 0 || i === 3) ? '<div class="mj back ' + size + '"></div>' : tile(k, size); }).join('') + '</div>'; }).join('') +
      (pl.flowers.length ? '<div class="flw">' + pl.flowers.map(function (k) { return tile(k, 'xs'); }).join('') + '</div>' : '');
  }
  function render(reveal) {
    if (!G) return;
    for (var p = 1; p <= 3; p++) {
      var pl = P[p], sw = seatWind(p);
      var hid = reveal && G.ended ? '<div class="melds">' + pl.hand.slice().sort(function (a, b) { return a - b; }).map(function (k) { return tile(k, 'xs'); }).join('') + '</div>' : '<span class="cnt">' + pl.hand.length + L(' 張', ' tiles') + '</span>';
      $('seat' + p).innerHTML = '<div class="av' + (G.turn === p && !G.ended ? ' turn' : '') + '"><span class="fc">' + BOTS[p - 1].fc + '<span class="wd' + (p === G.dealer ? ' dl' : '') + '">' + L(WIND[sw][0], WIND[sw][1]) + '</span></span><div><b>' + K.esc(name(p)) + (p === G.dealer ? L(' 莊', ' (D)') : '') + '</b><small>' + M.tot[p] + '</small></div></div>' + hid + '<div class="melds">' + meldHtml(pl, 'sm') + '</div>';
    }
    for (var q = 0; q < 4; q++) {
      var rv = $('rv' + q), river = P[q].river;
      rv.innerHTML = river.map(function (k, i) { return tile(k, 'xs' + (G.last && G.last.by === q && i === river.length - 1 && !G.ended ? ' last' : '')); }).join('');
      rv.setAttribute('data-n', name(q));
    }
    $('info').innerHTML = L('東風圈 第 ', 'East round · deal ') + '<b>' + (M.hands + (G.ended ? 0 : 1)) + '</b>' + L(' 把・莊：', ' · dealer: ') + K.esc(name(G.dealer)) + L('・剩 ', ' · wall ') + '<b>' + Math.max(0, wallLeft()) + '</b>' + L(' 張', '');
    var mw = seatWind(0);
    $('meInfo').innerHTML = (G.turn === 0 && !G.ended ? '👉 <b>' + L('輪到你', 'Your turn') + '</b>　' : '') + L('門風 ', 'Seat ') + L(WIND[mw][0], WIND[mw][1]) + (G.dealer === 0 ? L('（莊）', ' (dealer)') : '') + '　' + L('總分 ', 'Total ') + '<b>' + M.tot[0] + '</b>';
    $('meMelds').innerHTML = meldHtml(P[0], 'sm');
    var h = P[0].hand.slice(), dr = P[0].drawn, hh = h.slice();
    if (dr != null) { hh.splice(hh.lastIndexOf(dr), 1); }
    hh.sort(function (a, b) { return a - b; });
    var html = hh.map(function (k, i) { return tile(k, (sel === i ? 'sel' : '') + (tipK === k ? ' tip' : '')).replace('class="mj', 'data-i="' + i + '" class="mj'); }).join('');
    if (dr != null) html += tile(dr, 'new' + (sel === 99 ? ' sel' : '') + (tipK === dr ? ' tip' : '')).replace('class="mj', 'data-i="99" class="mj');
    $('hand').innerHTML = html;
    var myTurn = waiter && (waiter.type === 'discard' || waiter.type === 'self');
    $('bDiscard').disabled = !myTurn || sel < 0; $('bTip').disabled = !myTurn;
    $('sub').textContent = L(LV[M.lv][0], LV[M.lv][1]) + L('・第 ', ' · deal ') + (M.hands + (G.ended ? 0 : 1)) + L(' 把', '');
    claimBar();
  }
  function claimBar() {
    var box = $('claim'); box.innerHTML = '';
    if (!waiter || (waiter.type !== 'claim' && waiter.type !== 'self')) return;
    var lab = { hu: L('胡', 'Win'), tsumo: L('自摸', 'Tsumo'), pon: L('碰', 'Pung'), kong: L('槓', 'Kong'), ankong: L('暗槓', 'Kong'), jiakong: L('加槓', 'Kong'), chi: L('吃', 'Chow') };
    waiter.ops.forEach(function (o) {
      var b = document.createElement('button'); b.className = 'btn' + (o.id === 'hu' || o.id === 'tsumo' ? ' hu' : '');
      var extra = o.id === 'chi' ? '<span class="opt">' + o.o.use.concat([o.k]).sort(function (a, c) { return a - c; }).map(function (k) { return tile(k, 'xs'); }).join('') + '</span>' : (o.k != null && o.id !== 'hu' ? '<span class="opt">' + tile(o.k, 'xs') + '</span>' : '');
      b.innerHTML = lab[o.id] + extra; b.onclick = function () { resolve(o); }; box.appendChild(b);
    });
    var ps = document.createElement('button'); ps.className = 'btn ghost';
    ps.textContent = waiter.type === 'self' ? L('不要，打牌', 'Skip, discard') : L('過', 'Pass');
    ps.onclick = function () { resolve(waiter.type === 'self' ? { id: 'discard' } : { id: 'pass' }); render(); };
    box.appendChild(ps);
  }
  function suggest() {
    if (!waiter || (waiter.type !== 'discard' && waiter.type !== 'self')) return;
    var save = M.lv; M.lv = 'hard'; var k = botDiscard(0); M.lv = save;
    tipK = k; render();
  }
  function autoLabel() { $('bAuto').textContent = autoPass ? L('自動過：開', 'Auto pass: on') : L('自動過：關', 'Auto pass: off'); }

  // ---------- 綁定 ----------
  $('hand').addEventListener('click', function (e) {
    var t = e.target.closest('.mj'); if (!t || !waiter || (waiter.type !== 'discard' && waiter.type !== 'self')) return;
    var i = +t.getAttribute('data-i');
    if (sel === i) { discardSel(); return; }
    sel = i; K.beep(800, 0.02, 'sine', 0.02); render();
  });
  function discardSel() {
    if (sel < 0) return;
    var el = $('hand').querySelector('[data-i="' + sel + '"]'); if (!el) return;
    var k = +el.getAttribute('data-k');
    if (waiter.type === 'self') { var w = waiter; waiter = { type: 'discard', res: null }; w.res({ id: 'discard' }); setTimeout(function () { finishSelfDiscard(k); }, 0); return; }
    var ww = waiter; waiter = null; ww.res(k);
  }
  function finishSelfDiscard(k) { if (waiter && waiter.type === 'discard') { var w = waiter; waiter = null; if (w.res) w.res(k); } }
  $('bDiscard').onclick = discardSel;
  $('bTip').onclick = suggest;
  $('bAuto').onclick = function () { autoPass = !autoPass; autoLabel(); };
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); discardSel(); }
  });
  $('bNext').onclick = function () { K.close('ovHand'); if (M.done) openNew(); else playHand(); };
  function openNew() {
    var ch = $('lvChips'); ch.innerHTML = '';
    Object.keys(LV).forEach(function (k) { var b = document.createElement('button'); b.textContent = L(LV[k][0], LV[k][1]); if (M && M.lv === k) b.className = 'on'; b.onclick = function () { K.close('ovNew'); newMatch(k); }; ch.appendChild(b); });
    K.open('ovNew');
  }
  $('bNew').onclick = openNew;
  $('bRules').onclick = function () { $('rulesBody').innerHTML = [].map.call(document.querySelectorAll('.k-help article'), function (a) { return a.innerHTML; }).join(''); K.open('ovRules'); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (window.SC) SC.onLang(function () { autoLabel(); render(G && G.ended); });
  autoLabel();

  var epoch = 0;
  function newMatch(lv) {
    epoch++;
    if (G) { G.dead = true; G.ended = true; if (waiter) { var w = waiter; waiter = null; w.res({ id: 'pass' }); } }
    M = { lv: lv, dealer: 0, rot: 0, hands: 0, tot: [0, 0, 0, 0] };
    K.save(SAVE, M);
    if (window.SCLB) SCLB.start(GAME, lv);
    if (window.SC) SC.post('start', { game: GAME, level: lv });
    $('bLb').href = '/leaderboard/?game=mahjong&mode=' + lv;
    setTimeout(playHand, 30);
  }
  var sv = K.load(SAVE, null);
  if (sv && LV[sv.lv] && sv.rot < 4 && sv.hands < MAXH) { M = sv; $('bLb').href = '/leaderboard/?game=mahjong&mode=' + M.lv; if (window.SCLB && !SCLB.has(GAME, M.lv)) SCLB.start(GAME, M.lv); playHand(); }
  else newMatch('normal');
})();
