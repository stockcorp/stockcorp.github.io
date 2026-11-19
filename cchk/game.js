/* 中國跳棋（雙人）— stockcorp.github.io/cchk/
   121 孔星形棋盤；紅方（side 1）從下方三角出發、藍方（side 2）從上方三角出發，先把 10 顆棋全部移進對面三角的人贏。
   一步可以走到相鄰空位，或連續跳過「一顆」相鄰棋子落到空位（可以連跳、跳自己或對方的棋都行）。
   防堵規則：對面三角全部填滿、而且其中至少一顆是自己的，也算抵達。
   電腦：依「到對面尖角的距離總和」評估；簡單 1 層加隨機、普通 1 層＋殿後懲罰、困難 2 層（含對手回應）。 */
(function () {
  'use strict';
  var $ = K.$, L = K.L;
  var CELLS = [], IDX = {}, NB = [];
  for (var r = -8; r <= 8; r++) for (var q = -8; q <= 8; q++) {
    var s = -q - r; if (Math.abs(s) > 8) continue;
    var up = q >= -4 && r >= -4 && s >= -4, dn = q <= 4 && r <= 4 && s <= 4;
    if (up || dn) { IDX[q + ',' + r] = CELLS.length; CELLS.push({ q: q, r: r, s: s }); }
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  CELLS.forEach(function (c, i) { NB[i] = DIRS.map(function (d) { var k = IDX[(c.q + d[0]) + ',' + (c.r + d[1])]; return k === undefined ? -1 : k; }); });
  var HOME = { 1: [], 2: [] };
  CELLS.forEach(function (c, i) { if (c.r >= 5) HOME[1].push(i); if (c.r <= -5) HOME[2].push(i); });
  var TARGET = { 1: HOME[2], 2: HOME[1] }, TIP = { 1: IDX['4,-8'], 2: IDX['-4,8'] };
  function hd(a, b) { var A = CELLS[a], B = CELLS[b]; return Math.max(Math.abs(A.q - B.q), Math.abs(A.r - B.r), Math.abs(A.s - B.s)); }
  var DIST = { 1: CELLS.map(function (_, i) { return hd(i, TIP[1]); }), 2: CELLS.map(function (_, i) { return hd(i, TIP[2]); }) };

  function init() { var b = new Array(CELLS.length).fill(0); HOME[1].forEach(function (i) { b[i] = 1; }); HOME[2].forEach(function (i) { b[i] = 2; }); return { b: b, side: 1, last: null, ply: 0 }; }
  function clone(st) { return { b: st.b.slice(), side: st.side, last: st.last, ply: st.ply }; }
  // 從 f 出發能到的格子（含跳躍路徑）
  function reach(b, f) {
    var out = {}, path = {};
    NB[f].forEach(function (n) { if (n >= 0 && !b[n]) { out[n] = [f, n]; } });
    var q = [f]; path[f] = [f];
    while (q.length) {
      var c = q.shift();
      for (var d = 0; d < 6; d++) {
        var m = NB[c][d]; if (m < 0 || !b[m] || m === f) continue;
        var t = NB[m][d]; if (t < 0 || b[t] || path[t] || t === f) continue;
        path[t] = path[c].concat([t]); out[t] = path[t]; q.push(t);
      }
    }
    return out;
  }
  function moves(st, side) {
    var out = [];
    for (var i = 0; i < st.b.length; i++) if (st.b[i] === side) { var R = reach(st.b, i); for (var t in R) out.push({ f: i, t: +t, path: R[t] }); }
    return out;
  }
  function arrived(b, side) {
    var full = true, mine = false;
    TARGET[side].forEach(function (i) { if (!b[i]) full = false; else if (b[i] === side) mine = true; });
    return full && mine;
  }
  function play(st, mv) {
    if (!mv || typeof mv.f !== 'number' || st.b[mv.f] !== st.side) return false;
    var R = reach(st.b, mv.f); if (!R[mv.t]) return false;
    // 不能把已經進入目標區的棋子再移出去（避免故意拖延）
    if (TARGET[st.side].indexOf(mv.f) >= 0 && TARGET[st.side].indexOf(mv.t) < 0) return false;
    st.b[mv.t] = st.side; st.b[mv.f] = 0; st.last = { f: mv.f, t: mv.t, path: R[mv.t] }; st.ply++; st.side = 3 - st.side;
    K.beep(R[mv.t].length > 2 ? 620 : 480, 0.05, 'triangle', 0.045);
    return true;
  }
  function result(st) {
    if (arrived(st.b, 1)) return { w: 1, note: L('紅方全部到達', 'Red reached home') };
    if (arrived(st.b, 2)) return { w: 2, note: L('藍方全部到達', 'Blue reached home') };
    if (st.ply >= 400) return { w: 0, note: L('超過 200 回合', 'Over 200 turns') };
    if (!moves(st, st.side).length) { st.side = 3 - st.side; }
    return null;
  }
  function legalFiltered(st, side) { return moves(st, side).filter(function (m) { return !(TARGET[side].indexOf(m.f) >= 0 && TARGET[side].indexOf(m.t) < 0); }); }

  // ---------- 電腦 ----------
  function score(b, side) {
    var s = 0, worst = 0, o = 3 - side, so = 0;
    for (var i = 0; i < b.length; i++) {
      if (b[i] === side) { s += DIST[side][i]; worst = Math.max(worst, DIST[side][i]); var c = CELLS[i]; s += Math.abs(c.q - c.s) * 0.08; }
      else if (b[i] === o) so += DIST[o][i];
    }
    if (arrived(b, side)) return 1e5;
    return -(s + worst * 0.6) + so * 0.85;
  }
  function aiMove(st0, side, lv, done) {
    var st = clone(st0), ms = legalFiltered(st, side);
    if (!ms.length) return done(null);
    var evalMove = function (m) { st.b[m.t] = side; st.b[m.f] = 0; var v = score(st.b, side); st.b[m.f] = side; st.b[m.t] = 0; return v; };
    var sc = ms.map(function (m) { return { m: m, v: evalMove(m) + (DIST[side][m.f] - DIST[side][m.t]) * 0.3 }; });
    if (lv === 'easy') { sc.forEach(function (x) { x.v += Math.random() * 6; }); sc.sort(function (a, b) { return b.v - a.v; }); var m0 = sc[0].m; return done({ f: m0.f, t: m0.t }); }
    sc.sort(function (a, b) { return b.v - a.v; });
    if (lv === 'normal') { var k = Math.random() < 0.8 ? 0 : Math.min(1, sc.length - 1); return done({ f: sc[k].m.f, t: sc[k].m.t }); }
    // 困難：前 12 個候選，各自考慮對手最好的回應＋自己下一步最好的推進
    var best = null, bv = -1e9, o = 3 - side;
    sc.slice(0, 22).forEach(function (x) {
      var m = x.m; st.b[m.t] = side; st.b[m.f] = 0;
      if (arrived(st.b, side)) { if (bv < 1e6) { bv = 1e6; best = m; } }
      else {
        var om = legalFiltered(st, o), worst = 1e9;
        // 對手只考慮對他最有利的前 6 手
        om.map(function (y) { st.b[y.t] = o; st.b[y.f] = 0; var v = score(st.b, o); st.b[y.f] = o; st.b[y.t] = 0; return { y: y, v: v }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8).forEach(function (z) {
          var y = z.y; st.b[y.t] = o; st.b[y.f] = 0;
          var my = legalFiltered(st, side), b2 = -1e9;
          for (var j = 0; j < my.length; j++) { var n = my[j]; st.b[n.t] = side; st.b[n.f] = 0; var v2 = score(st.b, side); st.b[n.f] = side; st.b[n.t] = 0; if (v2 > b2) b2 = v2; }
          if (b2 < worst) worst = b2;
          st.b[y.f] = o; st.b[y.t] = 0;
        });
        if (!om.length) worst = score(st.b, side);
        var val = worst * 0.6 + x.v * 0.4;
        if (val > bv) { bv = val; best = m; }
      }
      st.b[m.f] = side; st.b[m.t] = 0;
    });
    done({ f: best.f, t: best.t });
  }

  // ---------- 畫面 ----------
  var cv = $('cv'), ctx = cv.getContext('2d'), size = 500, sel = -1, tg = {};
  function flip() { return D.me === 2; }
  function pos(i) { var c = CELLS[i], q = c.q, r = c.r; if (flip()) { q = -q; r = -r; } var dx = size / 14.8, dy = dx * 0.866; return [size / 2 + (q + r / 2) * dx, size / 2 + r * dy * 1.0]; }
  function resize() { var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); size = r.width; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  var COL = { 1: ['#fca5a5', '#dc2626'], 2: ['#93c5fd', '#2563eb'] };
  function draw() {
    if (!D || !D.S) return;
    var st = D.S, dx = size / 14.8, rad = dx * 0.36;
    ctx.clearRect(0, 0, size, size);
    // 星形底
    ctx.fillStyle = '#e9d5b5'; ctx.beginPath();
    [[4, -8], [-4, 8]].forEach(function (t) { var a = IDX[t[0] + ',' + t[1]]; });
    CELLS.forEach(function (_, i) { var p = pos(i); ctx.moveTo(p[0] + dx * 0.62, p[1]); ctx.arc(p[0], p[1], dx * 0.62, 0, 7); }); ctx.fill();
    // 三角區塗色
    [[HOME[1], 'rgba(220,38,38,.18)'], [HOME[2], 'rgba(37,99,235,.18)']].forEach(function (z) { ctx.fillStyle = z[1]; z[0].forEach(function (i) { var p = pos(i); ctx.beginPath(); ctx.arc(p[0], p[1], dx * 0.55, 0, 7); ctx.fill(); }); });
    if (st.last) { ctx.strokeStyle = 'rgba(250,204,21,.85)'; ctx.lineWidth = 3; ctx.beginPath(); st.last.path.forEach(function (i, k) { var p = pos(i); if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); }
    CELLS.forEach(function (_, i) {
      var p = pos(i), v = st.b[i];
      if (!v) { ctx.fillStyle = 'rgba(80,50,20,.45)'; ctx.beginPath(); ctx.arc(p[0], p[1], rad * 0.55, 0, 7); ctx.fill(); }
      else { var g = ctx.createRadialGradient(p[0] - rad * 0.35, p[1] - rad * 0.4, rad * 0.1, p[0], p[1], rad); g.addColorStop(0, COL[v][0]); g.addColorStop(1, COL[v][1]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 7); ctx.fill(); }
      if (i === sel) { ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], rad + 3, 0, 7); ctx.stroke(); }
      if (tg[i]) { ctx.fillStyle = 'rgba(22,163,74,.75)'; ctx.beginPath(); ctx.arc(p[0], p[1], rad * 0.45, 0, 7); ctx.fill(); }
    });
  }
  cv.addEventListener('click', function (e) {
    if (!D.myTurn()) return;
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * size, y = (e.clientY - r.top) / r.height * size, best = -1, bd = 1e9;
    CELLS.forEach(function (_, i) { var p = pos(i), d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (d < bd) { bd = d; best = i; } });
    if (bd > Math.pow(size / 14.8 * 0.6, 2)) return;
    if (tg[best]) { var f = sel; sel = -1; tg = {}; if (!D.human({ f: f, t: best })) { K.toast(L('已進入終點的棋子不能再離開', 'A piece that reached home cannot leave it')); draw(); } return; }
    if (D.S.b[best] === D.me) { sel = best; tg = reach(D.S.b, best); if (!Object.keys(tg).length) K.beep(150, 0.05, 'square', 0.02); }
    else { sel = -1; tg = {}; }
    draw();
  });
  var D = Duel({
    game: 'cchk', title: ['中國跳棋', 'Chinese Checkers'], lvs: { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] },
    init: init, clone: clone, turn: function (st) { return st.side; }, play: play, result: result, ai: aiMove, draw: draw,
    onNew: function () { sel = -1; tg = {}; resize(); }, onUndo: function () { sel = -1; tg = {}; }
  });
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__cc = { D: D, moves: legalFiltered, aiMove: aiMove, init: init, play: play, result: result, clone: clone, n: CELLS.length };
  D.start();
})();
