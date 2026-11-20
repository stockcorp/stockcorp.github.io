/* 超級井字棋 — stockcorp.github.io/uttt/
   9 個小井字棋組成大井字棋。你下在小棋盤的哪一格，對手下一步就要下在「對應位置的小棋盤」；
   那個小棋盤已經分出勝負或下滿時，對手可以任選。小棋盤連成一線算贏下那格，大棋盤連成一線獲勝。
   電腦：蒙地卡羅樹搜尋（MCTS）；簡單＝會贏就贏、會輸就擋其餘隨機，普通 0.35 秒，困難 1.5 秒。 */
(function () {
  'use strict';
  var $ = K.$, L = K.L;
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function init() { return { c: new Array(81).fill(0), sm: new Array(9).fill(0), next: -1, side: 1, last: -1, win: 0 }; }
  function clone(s) { return { c: s.c.slice(), sm: s.sm.slice(), next: s.next, side: s.side, last: s.last, win: s.win }; }
  function lineWin(a, off, p) { for (var i = 0; i < 8; i++) { var l = LINES[i]; if (a[off + l[0]] === p && a[off + l[1]] === p && a[off + l[2]] === p) return true; } return false; }
  function moves(s) {
    var out = [];
    if (s.win) return out;
    for (var b = 0; b < 9; b++) { if (s.sm[b] || (s.next >= 0 && s.next !== b)) continue; for (var k = 0; k < 9; k++) if (!s.c[b * 9 + k]) out.push(b * 9 + k); }
    return out;
  }
  function apply(s, m) {
    var p = s.side, b = (m / 9) | 0, k = m % 9;
    s.c[m] = p; s.last = m;
    if (lineWin(s.c, b * 9, p)) s.sm[b] = p;
    else { var full = true; for (var i = 0; i < 9; i++) if (!s.c[b * 9 + i]) { full = false; break; } if (full) s.sm[b] = 3; }
    if (s.sm[b] === p && lineWin(s.sm, 0, p)) s.win = p;
    else { var any = false; for (var j = 0; j < 9; j++) if (!s.sm[j]) { any = true; break; } if (!any) s.win = 3; }
    s.next = s.sm[k] ? -1 : k; s.side = 3 - p;
  }
  function play(s, m) {
    if (typeof m !== 'number' || moves(s).indexOf(m) < 0) return false;
    apply(s, m); K.beep(s.side === 2 ? 520 : 440, 0.05, 'triangle', 0.045);
    if (s.sm[(m / 9) | 0] && s.sm[(m / 9) | 0] !== 3) setTimeout(function () { K.tune([660, 880, 1175], 60); try { var rc = cv.getBoundingClientRect(), b = (m / 9) | 0, pad = size * 0.02, B = (size - pad * 2) / 3, at = { x: rc.left + pad + (b % 3 + 0.5) * B, y: rc.top + pad + (((b / 3) | 0) + 0.5) * B }, w = s.sm[b]; K.burst(at, { n: 26, star: 1, c: w === 1 ? ['#f87171', '#fff', '#fde047'] : ['#60a5fa', '#fff', '#fde047'], size: 7, sp: 220 }); K.shake($('board'), 5); K.buzz(15); } catch (e) { /* 略過 */ } }, 60);
    return true;
  }
  function result(s) {
    if (s.win === 1 || s.win === 2) return { w: s.win, note: L('大棋盤連成一線', 'Three in a row on the big board') };
    if (s.win === 3) {
      // 沒人連線時，贏得較多小棋盤的人勝
      var a = 0, b = 0; s.sm.forEach(function (v) { if (v === 1) a++; else if (v === 2) b++; });
      return a === b ? { w: 0, note: L('平手', 'Draw') } : { w: a > b ? 1 : 2, note: L('沒有連線，比較贏下的小棋盤數 ', 'No line — most small boards won ') + a + ' : ' + b };
    }
    return null;
  }
  // ---------- MCTS ----------
  function rollout(s, me) {
    var t = clone(s), n = 0;
    while (!t.win && n++ < 90) {
      var ms = moves(t); if (!ms.length) break;
      // 小小的啟發：能直接贏小棋盤就下
      var pick = -1;
      for (var i = 0; i < ms.length && i < 12; i++) { var m = ms[(Math.random() * ms.length) | 0], b = (m / 9) | 0; t.c[m] = t.side; var w = lineWin(t.c, b * 9, t.side); t.c[m] = 0; if (w) { pick = m; break; } }
      apply(t, pick >= 0 ? pick : ms[(Math.random() * ms.length) | 0]);
    }
    var r = result(t);
    return !r || !r.w ? 0.5 : r.w === me ? 1 : 0;
  }
  function mcts(s0, ms) {
    var root = { n: 0, w: 0, kids: null, mv: -1 }, me = s0.side;
    var end = Date.now() + ms, iter = 0;
    while (Date.now() < end || iter < 60) {
      iter++;
      var s = clone(s0), node = root, path = [root];
      while (node.kids && node.kids.length) {
        var best = null, bv = -1, ln = Math.log(node.n + 1);
        for (var i = 0; i < node.kids.length; i++) { var k = node.kids[i]; var v = k.n ? k.w / k.n + 1.25 * Math.sqrt(ln / k.n) : 1e9 + Math.random(); if (v > bv) { bv = v; best = k; } }
        apply(s, best.mv); node = best; path.push(node);
        if (!node.kids && node.n > 0) break;
      }
      if (!node.kids && !s.win) { node.kids = moves(s).map(function (m) { return { n: 0, w: 0, kids: null, mv: m, side: s.side }; }); }
      var val = rollout(s, me);
      for (var j = 0; j < path.length; j++) { var nd = path[j]; nd.n++; var mover = j === 0 ? 3 - me : path[j].side; nd.w += mover === me ? val : 1 - val; }
    }
    var bestK = null; root.kids.forEach(function (k) { if (!bestK || k.n > bestK.n) bestK = k; });
    return bestK.mv;
  }
  function aiMove(s, side, lv, done) {
    var ms = moves(s); if (!ms.length) return done(null);
    if (lv === 'easy') {
      for (var i = 0; i < ms.length; i++) { var t = clone(s); apply(t, ms[i]); if (t.win === side) return done(ms[i]); }
      var safe = ms.filter(function (m) { var t = clone(s); apply(t, m); return !moves(t).some(function (o) { var u = clone(t); apply(u, o); return u.win === 3 - side; }); });
      var pool = safe.length ? safe : ms; return done(pool[(Math.random() * pool.length) | 0]);
    }
    done(mcts(s, lv === 'hard' ? 1500 : 350));
  }

  // ---------- 畫面 ----------
  var cv = $('cv'), ctx = cv.getContext('2d'), size = 480;
  function resize() { var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); size = r.width; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  var C1 = '#ef4444', C2 = '#3b82f6';
  function mark(p, x, y, r, lw) {
    ctx.lineWidth = lw; ctx.lineCap = 'round';
    if (p === 1) { ctx.strokeStyle = C1; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); }
    else { ctx.strokeStyle = C2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
  }
  function draw() {
    if (!D || !D.S) return;
    var s = D.S, pad = size * 0.02, B = (size - pad * 2) / 3, cs = B / 3;
    var bgG = ctx.createLinearGradient(0, 0, size, size); bgG.addColorStop(0, '#1e1b4b'); bgG.addColorStop(1, '#0f172a'); ctx.fillStyle = bgG; ctx.fillRect(0, 0, size, size);
    var avail = moves(s), my = D.myTurn();
    for (var b = 0; b < 9; b++) {
      var bx = pad + (b % 3) * B, by = pad + ((b / 3) | 0) * B;
      var playable = !s.win && !s.sm[b] && (s.next < 0 || s.next === b);
      ctx.fillStyle = playable && !D.over ? (s.side === 1 ? 'rgba(239,68,68,.16)' : 'rgba(59,130,246,.18)') : 'rgba(255,255,255,.03)';
      ctx.fillRect(bx + 4, by + 4, B - 8, B - 8);
      if (playable && !D.over) { ctx.shadowColor = s.side === 1 ? '#f87171' : '#60a5fa'; ctx.shadowBlur = 14; ctx.strokeStyle = s.side === 1 ? 'rgba(248,113,113,.9)' : 'rgba(96,165,250,.9)'; ctx.lineWidth = 2.5; ctx.strokeRect(bx + 4, by + 4, B - 8, B - 8); ctx.shadowBlur = 0; }
      ctx.strokeStyle = 'rgba(148,163,184,.55)'; ctx.lineWidth = 1.5;
      for (var k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(bx + k * cs, by + 10); ctx.lineTo(bx + k * cs, by + B - 10); ctx.moveTo(bx + 10, by + k * cs); ctx.lineTo(bx + B - 10, by + k * cs); ctx.stroke(); }
      for (k = 0; k < 9; k++) {
        var m = b * 9 + k, cx = bx + (k % 3) * cs + cs / 2, cy = by + ((k / 3) | 0) * cs + cs / 2;
        if (s.c[m]) { ctx.globalAlpha = s.sm[b] && s.sm[b] !== 3 ? 0.35 : 1; mark(s.c[m], cx, cy, cs * 0.28, Math.max(2, cs * 0.1)); ctx.globalAlpha = 1; }
        if (m === s.last) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(cx - cs / 2 + 3, cy - cs / 2 + 3, cs - 6, cs - 6); }
      }
      if (s.sm[b] === 1 || s.sm[b] === 2) mark(s.sm[b], bx + B / 2, by + B / 2, B * 0.32, Math.max(4, B * 0.08));
      if (s.sm[b] === 3) { ctx.fillStyle = 'rgba(148,163,184,.25)'; ctx.fillRect(bx + 4, by + 4, B - 8, B - 8); }
    }
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 4;
    for (var j = 1; j < 3; j++) { ctx.beginPath(); ctx.moveTo(pad + j * B, pad); ctx.lineTo(pad + j * B, size - pad); ctx.moveTo(pad, pad + j * B); ctx.lineTo(size - pad, pad + j * B); ctx.stroke(); }
  }
  cv.addEventListener('click', function (e) {
    if (!D.myTurn()) return;
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * size, y = (e.clientY - r.top) / r.height * size, pad = size * 0.02, B = (size - pad * 2) / 3, cs = B / 3;
    var bc = Math.floor((x - pad) / B), br = Math.floor((y - pad) / B); if (bc < 0 || bc > 2 || br < 0 || br > 2) return;
    var kc = Math.floor((x - pad - bc * B) / cs), kr = Math.floor((y - pad - br * B) / cs);
    var m = (br * 3 + bc) * 9 + kr * 3 + kc;
    if (!D.human(m)) { K.beep(150, 0.06, 'square', 0.025); if (D.S.next >= 0 && ((m / 9) | 0) !== D.S.next) K.toast(L('這一步要下在發亮的小棋盤', 'You must play in the highlighted board'), 1400); }
  });
  var D = Duel({
    game: 'uttt', title: ['超級井字棋', 'Ultimate Tic-Tac-Toe'], lvs: { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] },
    init: init, clone: clone, turn: function (s) { return s.side; }, play: play, result: result, ai: aiMove, draw: draw,
    onNew: function () { resize(); }
  });
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__ut = { D: D, moves: moves, aiMove: aiMove, init: init, play: play, result: result, clone: clone };
  D.start();
})();
