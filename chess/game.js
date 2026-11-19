/* 西洋棋 — stockcorp.github.io/chess/
   完整規則：入堡、吃過路兵、升變（可選后車象馬）、將死、逼和、50 步和、子力不足和、三次重複和。
   電腦：alpha-beta＋靜態搜尋＋棋子位置表；簡單 1 層加隨機、普通 3 層、困難迭代加深約 1.5 秒。
   棋盤 64 格 index = r*8+c，r=0 是黑方底線（第 8 橫排）。白 = side 1（先手），黑 = side 2。 */
(function () {
  'use strict';
  var $ = K.$, L = K.L;
  var P = 1, N = 2, B = 3, R = 4, Q = 5, KG = 6;
  var GLY = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  // 位置表（白方視角，index 0 = a8）
  var PST = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  // piece 編碼：side*8 + type（side 1 白、2 黑），0 空
  function sd(p) { return p >> 3; } function ty(p) { return p & 7; }
  function rc(i) { return [i >> 3, i & 7]; }
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], KD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DI = [[-1, -1], [-1, 1], [1, -1], [1, 1]], OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function init() {
    var b = new Array(64).fill(0), back = [R, N, B, Q, KG, B, N, R];
    for (var c = 0; c < 8; c++) { b[c] = 16 + back[c]; b[8 + c] = 16 + P; b[48 + c] = 8 + P; b[56 + c] = 8 + back[c]; }
    return { b: b, side: 1, cs: 15, ep: -1, half: 0, last: null, keys: [], over: null };
  }
  function clone(s) { return { b: s.b.slice(), side: s.side, cs: s.cs, ep: s.ep, half: s.half, last: s.last, keys: s.keys.slice(), over: s.over }; }
  function attacked(b, sq, by) {
    var r = sq >> 3, c = sq & 7, i, R2, C2, p;
    var pr = by === 1 ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) for (i = -1; i <= 1; i += 2) { C2 = c + i; if (C2 >= 0 && C2 < 8 && b[pr * 8 + C2] === by * 8 + P) return true; }
    for (i = 0; i < 8; i++) { R2 = r + KN[i][0]; C2 = c + KN[i][1]; if (R2 >= 0 && R2 < 8 && C2 >= 0 && C2 < 8 && b[R2 * 8 + C2] === by * 8 + N) return true; }
    for (i = 0; i < 8; i++) { R2 = r + KD[i][0]; C2 = c + KD[i][1]; if (R2 >= 0 && R2 < 8 && C2 >= 0 && C2 < 8 && b[R2 * 8 + C2] === by * 8 + KG) return true; }
    for (i = 0; i < 4; i++) { R2 = r + DI[i][0]; C2 = c + DI[i][1]; while (R2 >= 0 && R2 < 8 && C2 >= 0 && C2 < 8) { p = b[R2 * 8 + C2]; if (p) { if (sd(p) === by && (ty(p) === B || ty(p) === Q)) return true; break; } R2 += DI[i][0]; C2 += DI[i][1]; } }
    for (i = 0; i < 4; i++) { R2 = r + OR[i][0]; C2 = c + OR[i][1]; while (R2 >= 0 && R2 < 8 && C2 >= 0 && C2 < 8) { p = b[R2 * 8 + C2]; if (p) { if (sd(p) === by && (ty(p) === R || ty(p) === Q)) return true; break; } R2 += OR[i][0]; C2 += OR[i][1]; } }
    return false;
  }
  function kingSq(b, s) { for (var i = 0; i < 64; i++) if (b[i] === s * 8 + KG) return i; return -1; }
  function inCheck(st, s) { return attacked(st.b, kingSq(st.b, s), 3 - s); }
  // 偽合法步（不檢查自己被將）
  function pseudo(st, capsOnly) {
    var b = st.b, s = st.side, o = 3 - s, out = [], i, j, R2, C2, t;
    function add(f, to, pr) { out.push({ f: f, t: to, p: pr || 0 }); }
    for (i = 0; i < 64; i++) {
      var p = b[i]; if (!p || sd(p) !== s) continue;
      var r = i >> 3, c = i & 7, tp = ty(p);
      if (tp === P) {
        var dir = s === 1 ? -1 : 1, start = s === 1 ? 6 : 1, last = s === 1 ? 0 : 7;
        R2 = r + dir;
        if (R2 >= 0 && R2 < 8) {
          if (!capsOnly && !b[R2 * 8 + c]) { if (R2 === last) [Q, R, B, N].forEach(function (x) { add(i, R2 * 8 + c, x); }); else { add(i, R2 * 8 + c); if (r === start && !b[(r + 2 * dir) * 8 + c]) add(i, (r + 2 * dir) * 8 + c); } }
          else if (capsOnly && R2 === last && !b[R2 * 8 + c]) add(i, R2 * 8 + c, Q);
          for (j = -1; j <= 1; j += 2) {
            C2 = c + j; if (C2 < 0 || C2 > 7) continue; t = R2 * 8 + C2;
            if ((b[t] && sd(b[t]) === o) || t === st.ep) { if (R2 === last) { if (capsOnly) add(i, t, Q); else [Q, R, B, N].forEach(function (x) { add(i, t, x); }); } else add(i, t); }
          }
        }
      } else if (tp === N || tp === KG) {
        var D = tp === N ? KN : KD;
        for (j = 0; j < 8; j++) { R2 = r + D[j][0]; C2 = c + D[j][1]; if (R2 < 0 || R2 > 7 || C2 < 0 || C2 > 7) continue; t = R2 * 8 + C2; if (!b[t] ? !capsOnly : sd(b[t]) === o) add(i, t); }
        if (tp === KG && !capsOnly) {
          var home = s === 1 ? 60 : 4, kb = s === 1 ? 1 : 4, qb = s === 1 ? 2 : 8;
          if (i === home && !attacked(b, i, o)) {
            if ((st.cs & kb) && !b[i + 1] && !b[i + 2] && b[i + 3] === s * 8 + R && !attacked(b, i + 1, o) && !attacked(b, i + 2, o)) add(i, i + 2);
            if ((st.cs & qb) && !b[i - 1] && !b[i - 2] && !b[i - 3] && b[i - 4] === s * 8 + R && !attacked(b, i - 1, o) && !attacked(b, i - 2, o)) add(i, i - 2);
          }
        }
      } else {
        var dirs = tp === B ? DI : tp === R ? OR : DI.concat(OR);
        for (j = 0; j < dirs.length; j++) {
          R2 = r + dirs[j][0]; C2 = c + dirs[j][1];
          while (R2 >= 0 && R2 < 8 && C2 >= 0 && C2 < 8) { t = R2 * 8 + C2; if (b[t]) { if (sd(b[t]) === o) add(i, t); break; } if (!capsOnly) add(i, t); R2 += dirs[j][0]; C2 += dirs[j][1]; }
        }
      }
    }
    return out;
  }
  // 走一步（不檢查合法）；回傳還原資料
  function make(st, m) {
    var b = st.b, p = b[m.f], s = sd(p), cap = b[m.t], u = { m: m, p: p, cap: cap, cs: st.cs, ep: st.ep, half: st.half, epCap: -1, last: st.last };
    b[m.t] = m.p ? s * 8 + m.p : p; b[m.f] = 0;
    if (ty(p) === P && m.t === st.ep) { var cq = m.t + (s === 1 ? 8 : -8); u.epCap = cq; u.cap = b[cq]; b[cq] = 0; }
    if (ty(p) === KG && Math.abs(m.t - m.f) === 2) { if (m.t > m.f) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = 0; } else { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = 0; } }
    st.ep = ty(p) === P && Math.abs(m.t - m.f) === 16 ? (m.f + m.t) >> 1 : -1;
    if (ty(p) === KG) st.cs &= s === 1 ? ~3 : ~12;
    [[56, 2], [63, 1], [0, 8], [7, 4]].forEach(function (x) { if (m.f === x[0] || m.t === x[0]) st.cs &= ~x[1]; });
    st.half = ty(p) === P || u.cap ? 0 : st.half + 1;
    st.side = 3 - s; st.last = m;
    return u;
  }
  function unmake(st, u) {
    var b = st.b, m = u.m, s = sd(u.p);
    b[m.f] = u.p; b[m.t] = u.epCap >= 0 ? 0 : u.cap;
    if (u.epCap >= 0) b[u.epCap] = u.cap;
    if (ty(u.p) === KG && Math.abs(m.t - m.f) === 2) { if (m.t > m.f) { b[m.f + 3] = b[m.f + 1]; b[m.f + 1] = 0; } else { b[m.f - 4] = b[m.f - 1]; b[m.f - 1] = 0; } }
    st.cs = u.cs; st.ep = u.ep; st.half = u.half; st.side = s; st.last = u.last;
  }
  function legal(st, capsOnly) {
    var s = st.side, out = [];
    pseudo(st, capsOnly).forEach(function (m) { var u = make(st, m); if (!attacked(st.b, kingSq(st.b, s), 3 - s)) out.push(m); unmake(st, u); });
    return out;
  }
  function key(st) { return st.b.join(',') + '|' + st.side + st.cs + st.ep; }
  function insufficient(b) {
    var minor = 0, other = 0;
    for (var i = 0; i < 64; i++) { var t = ty(b[i]); if (!b[i] || t === KG) continue; if (t === N || t === B) minor++; else other++; }
    return !other && minor <= 1;
  }
  function result(st) {
    var ms = legal(st);
    if (!ms.length) return inCheck(st, st.side) ? { w: 3 - st.side, note: L('將死', 'Checkmate') } : { w: 0, note: L('逼和（無子可動）', 'Stalemate') };
    if (st.half >= 100) return { w: 0, note: L('50 步規則和局', 'Fifty-move rule') };
    if (insufficient(st.b)) return { w: 0, note: L('子力不足和局', 'Insufficient material') };
    var k = key(st), n = 0; st.keys.forEach(function (x) { if (x === k) n++; });
    if (n >= 3) return { w: 0, note: L('三次重複和局', 'Threefold repetition') };
    return null;
  }
  function play(st, m) {
    if (!m || typeof m.f !== 'number') return false;
    var ok = legal(st).filter(function (x) { return x.f === m.f && x.t === m.t && (x.p || 0) === (m.p || 0); });
    if (!ok.length) return false;
    var cap = st.b[m.t] || (ty(st.b[m.f]) === P && m.t === st.ep);
    make(st, ok[0]); st.keys.push(key(st));
    K.beep(cap ? 300 : 420, 0.06, 'triangle', 0.05);
    if (inCheck(st, st.side)) setTimeout(function () { K.beep(880, 0.08, 'square', 0.03); }, 80);
    return true;
  }

  // ---------- 電腦 ----------
  function evalSt(st) {
    var b = st.b, s = 0, mat = 0;
    for (var i = 0; i < 64; i++) if (b[i] && ty(b[i]) !== KG && ty(b[i]) !== P) mat += VAL[ty(b[i])];
    var end = mat < 2600;
    for (i = 0; i < 64; i++) {
      var p = b[i]; if (!p) continue;
      var t = ty(p), w = sd(p) === 1, idx = w ? i : (7 - (i >> 3)) * 8 + (i & 7);
      var v = VAL[t] + PST[t === KG && end ? 7 : t][idx];
      s += w ? v : -v;
    }
    return st.side === 1 ? s : -s;
  }
  var nodes = 0, deadline = 0, stop = false;
  function order(st, ms) {
    return ms.map(function (m) { var c = st.b[m.t]; m.o = (c ? 10 * VAL[ty(c)] - VAL[ty(st.b[m.f])] + 10000 : 0) + (m.p === Q ? 9000 : 0); return m; }).sort(function (a, b) { return b.o - a.o; });
  }
  function quies(st, a, b, d) {
    var stand = evalSt(st); if (stand >= b) return b; if (stand > a) a = stand;
    if (d > 6) return a;
    var ms = order(st, legal(st, true));
    for (var i = 0; i < ms.length; i++) { var u = make(st, ms[i]); var v = -quies(st, -b, -a, d + 1); unmake(st, u); if (v >= b) return b; if (v > a) a = v; }
    return a;
  }
  function search(st, depth, a, b, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    var ms = legal(st);
    if (!ms.length) return inCheck(st, st.side) ? -100000 + ply : 0;
    if (st.half >= 100) return 0;
    if (depth <= 0) return quies(st, a, b, 0);
    ms = order(st, ms);
    for (var i = 0; i < ms.length; i++) {
      var u = make(st, ms[i]), v = -search(st, depth - 1, -b, -a, ply + 1); unmake(st, u);
      if (stop) return 0;
      if (v >= b) return b; if (v > a) a = v;
    }
    return a;
  }
  function rootSearch(st, depth, first) {
    var ms = order(st, legal(st)), best = null, bv = -1e9;
    if (first) { var k = ms.findIndex(function (m) { return m.f === first.f && m.t === first.t && m.p === first.p; }); if (k > 0) ms.unshift(ms.splice(k, 1)[0]); }
    for (var i = 0; i < ms.length; i++) {
      var u = make(st, ms[i]), v = -search(st, depth - 1, -1e9, -bv, 1); unmake(st, u);
      if (stop) break;
      if (v > bv) { bv = v; best = ms[i]; }
    }
    return { m: best, v: bv };
  }
  function aiMove(st0, side, lv, done) {
    var st = clone(st0); nodes = 0; stop = false;
    var ms = legal(st); if (!ms.length) return done(null);
    var pick;
    if (lv === 'easy') {
      deadline = Date.now() + 400;
      var sc = order(st, ms).map(function (m) { var u = make(st, m), v = -search(st, 1, -1e9, 1e9, 1); unmake(st, u); return { m: m, v: v + Math.random() * 160 }; });
      sc.sort(function (a, b) { return b.v - a.v; }); pick = sc[0].m;
    } else {
      deadline = Date.now() + (lv === 'hard' ? 1600 : 700);
      var maxD = lv === 'hard' ? 8 : 3, best = null;
      for (var d = 1; d <= maxD; d++) { var r = rootSearch(st, d, best); if (stop && d > 1) break; if (r.m) best = r.m; if (Date.now() > deadline) break; }
      pick = best || ms[0];
    }
    done({ f: pick.f, t: pick.t, p: pick.p || 0 });
  }

  // ---------- 畫面與操作 ----------
  var cv = $('cv'), ctx = cv.getContext('2d'), size = 480, sel = -1, targets = [], promo = null;
  function flip() { return D.me === 2; }
  function resize() { var r = $('board').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); size = r.width; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
  function xy(i) { var r = i >> 3, c = i & 7; if (flip()) { r = 7 - r; c = 7 - c; } var cs = size / 8; return [c * cs, r * cs]; }
  function draw() {
    if (!D || !D.S) return;
    var st = D.S, cs = size / 8;
    for (var i = 0; i < 64; i++) {
      var p = xy(i), lt = ((i >> 3) + (i & 7)) % 2 === 0;
      ctx.fillStyle = lt ? '#eed8b0' : '#b0784a'; ctx.fillRect(p[0], p[1], cs, cs);
      if (st.last && (i === st.last.f || i === st.last.t)) { ctx.fillStyle = 'rgba(250,204,21,.38)'; ctx.fillRect(p[0], p[1], cs, cs); }
      if (i === sel) { ctx.fillStyle = 'rgba(34,197,94,.45)'; ctx.fillRect(p[0], p[1], cs, cs); }
    }
    var ks = kingSq(st.b, st.side);
    if (!D.over && ks >= 0 && inCheck(st, st.side)) { var kp = xy(ks), g = ctx.createRadialGradient(kp[0] + cs / 2, kp[1] + cs / 2, 2, kp[0] + cs / 2, kp[1] + cs / 2, cs * 0.6); g.addColorStop(0, 'rgba(239,68,68,.9)'); g.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = g; ctx.fillRect(kp[0], kp[1], cs, cs); }
    ctx.font = Math.round(cs * 0.11) + 'px system-ui'; ctx.textBaseline = 'top';
    for (var k = 0; k < 8; k++) {
      var file = flip() ? 7 - k : k, rank = flip() ? k + 1 : 8 - k;
      ctx.fillStyle = k % 2 ? '#eed8b0' : '#b0784a'; ctx.textAlign = 'left'; ctx.fillText(rank, 2, k * cs + 2);
      ctx.fillStyle = k % 2 ? '#b0784a' : '#eed8b0'; ctx.textAlign = 'right'; ctx.fillText('abcdefgh'[file], (k + 1) * cs - 2, size - cs * 0.15);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < 64; i++) {
      var pc = st.b[i]; if (!pc) continue; p = xy(i);
      ctx.font = Math.round(cs * 0.78) + 'px "Segoe UI Symbol","Noto Sans Symbols2","Apple Symbols",serif';
      var gl = GLY[ty(pc)] + '︎';
      ctx.lineWidth = Math.max(1.5, cs * 0.045); ctx.strokeStyle = sd(pc) === 1 ? '#1f2937' : '#f8fafc'; ctx.fillStyle = sd(pc) === 1 ? '#fffdf5' : '#111827';
      ctx.strokeText(gl, p[0] + cs / 2, p[1] + cs * 0.54); ctx.fillText(gl, p[0] + cs / 2, p[1] + cs * 0.54);
    }
    targets.forEach(function (m) { var q = xy(m.t); ctx.fillStyle = 'rgba(21,128,61,.55)'; ctx.beginPath(); if (st.b[m.t]) { ctx.lineWidth = cs * 0.08; ctx.strokeStyle = 'rgba(21,128,61,.7)'; ctx.arc(q[0] + cs / 2, q[1] + cs / 2, cs * 0.44, 0, 7); ctx.stroke(); } else { ctx.arc(q[0] + cs / 2, q[1] + cs / 2, cs * 0.15, 0, 7); ctx.fill(); } });
  }
  cv.addEventListener('click', function (e) {
    if (!D.myTurn() || promo) return;
    var r = cv.getBoundingClientRect(), cs = r.width / 8, c = Math.floor((e.clientX - r.left) / cs), rr = Math.floor((e.clientY - r.top) / cs);
    if (flip()) { c = 7 - c; rr = 7 - rr; } var i = rr * 8 + c; if (i < 0 || i > 63) return;
    var hit = targets.filter(function (m) { return m.t === i; });
    if (hit.length) {
      if (hit.length > 1) { askPromo(hit[0]); return; }
      sel = -1; targets = []; D.human({ f: hit[0].f, t: hit[0].t, p: 0 }); return;
    }
    var pc = D.S.b[i];
    if (pc && sd(pc) === D.me) { sel = i; targets = legal(D.S).filter(function (m) { return m.f === i; }); if (!targets.length) K.beep(150, 0.05, 'square', 0.02); }
    else { sel = -1; targets = []; }
    draw();
  });
  function askPromo(m) {
    promo = m; var box = $('promo'); box.innerHTML = '';
    [Q, R, B, N].forEach(function (t) { var b = document.createElement('button'); b.textContent = GLY[t] + '︎'; b.className = D.me === 1 ? 'w' : 'b'; b.onclick = function () { box.style.display = 'none'; var mm = promo; promo = null; sel = -1; targets = []; D.human({ f: mm.f, t: mm.t, p: t }); }; box.appendChild(b); });
    box.style.display = 'flex';
  }
  var D = Duel({
    game: 'chess', title: ['西洋棋', 'Chess'], lvs: { easy: ['簡單', 'Easy'], normal: ['普通', 'Normal'], hard: ['困難', 'Hard'] },
    init: init, clone: clone, turn: function (st) { return st.side; }, play: play,
    result: function (st) { return result(st); }, ai: aiMove, draw: draw,
    onNew: function () { sel = -1; targets = []; promo = null; $('promo').style.display = 'none'; resize(); },
    onUndo: function () { sel = -1; targets = []; },
    statusMine: function () { return inCheck(D.S, D.S.side) ? L('被將軍！', 'Check!') : L('輪到你', 'Your move'); }
  });
  window.addEventListener('resize', resize);
  if (location.hash.indexOf('#test') === 0) window.__ch = { D: D, legal: legal, aiMove: aiMove, play: play, clone: clone, init: init, result: result };
  D.start();
})();
