/* 圍棋引擎 — stockcorp.github.io/go/engine.js
   主畫面與 Web Worker 共用。規則：中國規則（數子），貼 7.5 目，禁自殺，簡單打劫。
   電腦：UCT + RAVE 蒙地卡羅樹搜尋；終局用隨機對局估計死活。 */
(function (root) {
  'use strict';
  var EMPTY = 0, BLACK = 1, WHITE = 2;

  function Board(n) {
    this.n = n; this.size = n * n;
    this.b = new Int8Array(this.size); this.ko = -1; this.cap = [0, 0, 0]; this.passes = 0; this.turn = BLACK; this.moves = 0;
    this.nb = Board.nbrs(n);
  }
  var NB = {};
  Board.nbrs = function (n) {
    if (NB[n]) return NB[n];
    var out = [];
    for (var i = 0; i < n * n; i++) { var x = i % n, y = (i / n) | 0, a = []; if (x > 0) a.push(i - 1); if (x < n - 1) a.push(i + 1); if (y > 0) a.push(i - n); if (y < n - 1) a.push(i + n); out.push(a); }
    return (NB[n] = out);
  };
  Board.prototype.clone = function () {
    var c = new Board(this.n); c.b.set(this.b); c.ko = this.ko; c.cap = this.cap.slice(); c.passes = this.passes; c.turn = this.turn; c.moves = this.moves; return c;
  };
  // 一塊棋：回傳 [石頭陣列, 氣數]（氣數最多算到 lim）
  var mark = null, markId = 0, libMark = null;
  Board.prototype.group = function (i, lim) {
    var b = this.b, c = b[i], nb = this.nb;
    if (!mark || mark.length < this.size) { mark = new Int32Array(this.size); libMark = new Int32Array(this.size); }
    markId++;
    var stones = [i], libs = 0; mark[i] = markId;
    for (var k = 0; k < stones.length; k++) {
      var s = stones[k], ns = nb[s];
      for (var j = 0; j < ns.length; j++) {
        var t = ns[j], v = b[t];
        if (v === EMPTY) { if (libMark[t] !== markId) { libMark[t] = markId; libs++; if (lim && libs >= lim) return [stones, libs]; } }
        else if (v === c && mark[t] !== markId) { mark[t] = markId; stones.push(t); }
      }
    }
    return [stones, libs];
  };
  // 下一手；不合法回傳 false。-1 = 虛手
  Board.prototype.play = function (i, c) {
    c = c || this.turn;
    if (i < 0) { this.passes++; this.ko = -1; this.turn = 3 - c; this.moves++; return true; }
    var b = this.b, nb = this.nb[i], o = 3 - c;
    if (b[i] !== EMPTY || i === this.ko) return false;
    b[i] = c;
    var captured = [], k, g;
    for (k = 0; k < nb.length; k++) {
      var t = nb[k];
      if (b[t] === o) { g = this.group(t, 1); if (g[1] === 0) for (var s = 0; s < g[0].length; s++) { b[g[0][s]] = EMPTY; captured.push(g[0][s]); } }
    }
    if (!captured.length) { g = this.group(i, 1); if (g[1] === 0) { b[i] = EMPTY; return false; } }
    this.cap[c] += captured.length;
    // 打劫：只提一子，而且下的這子變成只有一口氣的單子
    this.ko = -1;
    if (captured.length === 1) { g = this.group(i, 2); if (g[0].length === 1 && g[1] === 1) this.ko = captured[0]; }
    this.passes = 0; this.turn = o; this.moves++;
    return captured;
  };
  Board.prototype.legal = function (i, c) {
    if (this.b[i] !== EMPTY || i === this.ko) return false;
    var b = this.b, nb = this.nb[i], o = 3 - c;
    for (var k = 0; k < nb.length; k++) if (b[nb[k]] === EMPTY) return true;
    b[i] = c;
    var ok = false;
    for (k = 0; k < nb.length && !ok; k++) { var t = nb[k]; if (b[t] === o && this.group(t, 1)[1] === 0) ok = true; else if (b[t] === c && this.group(t, 1)[1] > 0) ok = true; }
    b[i] = EMPTY;
    return ok;
  };
  // 自己的眼（四周都是自己的子，斜角大多也是）— 隨機對局不去填
  Board.prototype.isEye = function (i, c) {
    var b = this.b, n = this.n, nb = this.nb[i];
    for (var k = 0; k < nb.length; k++) if (b[nb[k]] !== c) return false;
    var x = i % n, y = (i / n) | 0, bad = 0, edge = (x === 0 || y === 0 || x === n - 1 || y === n - 1);
    var d = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (k = 0; k < 4; k++) { var xx = x + d[k][0], yy = y + d[k][1]; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; if (b[yy * n + xx] === 3 - c) bad++; }
    return edge ? bad === 0 : bad < 2;
  };
  // 數子：活子＋只被一方圍住的空點
  Board.prototype.area = function (dead) {
    var b = this.b.slice(), n = this.n, nb = this.nb, s = [0, 0, 0], own = new Int8Array(this.size);
    if (dead) for (var d = 0; d < dead.length; d++) b[dead[d]] = EMPTY;
    var seen = new Int8Array(this.size);
    for (var i = 0; i < this.size; i++) {
      if (b[i]) { s[b[i]]++; own[i] = b[i]; continue; }
      if (seen[i]) continue;
      var q = [i], touch = 0; seen[i] = 1;
      for (var k = 0; k < q.length; k++) for (var j = 0; j < nb[q[k]].length; j++) { var t = nb[q[k]][j]; if (b[t]) touch |= b[t]; else if (!seen[t]) { seen[t] = 1; q.push(t); } }
      if (touch === 1 || touch === 2) { s[touch] += q.length; for (k = 0; k < q.length; k++) own[q[k]] = touch; }
    }
    return { black: s[1], white: s[2], own: own };
  };

  // ---------- 隨機對局 ----------
  function rnd(n) { return (Math.random() * n) | 0; }
  function playout(bd, amaf) {
    var size = bd.size, maxMoves = size * 3, empties = [], i;
    for (i = 0; i < size; i++) if (!bd.b[i]) empties.push(i);
    var passes = 0;
    while (passes < 2 && bd.moves < maxMoves + 200) {
      var c = bd.turn, played = -1, tries = empties.length;
      // 先看能不能提對方叫吃的子（簡單的戰術）
      if (bd.lastMove >= 0 && Math.random() < 0.6) {
        var nb = bd.nb[bd.lastMove];
        for (var k = 0; k < nb.length && played < 0; k++) {
          var t = nb[k];
          if (bd.b[t] === 3 - c) { var g = bd.group(t, 2); if (g[1] === 1) { var lib = findLib(bd, g[0]); if (lib >= 0 && bd.legal(lib, c)) played = lib; } }
        }
      }
      if (played < 0) {
        var start = rnd(empties.length || 1);
        for (var m = 0; m < tries; m++) {
          var idx = (start + m) % empties.length, p = empties[idx];
          if (bd.b[p] || bd.isEye(p, c) || !bd.legal(p, c)) continue;
          played = p; break;
        }
      }
      if (played < 0) { bd.play(-1, c); passes++; bd.lastMove = -1; continue; }
      var cap = bd.play(played, c); passes = 0; bd.lastMove = played;
      if (amaf && amaf[played] === 0) amaf[played] = c;
      // 更新空點列表
      empties = [];
      for (i = 0; i < size; i++) if (!bd.b[i]) empties.push(i);
      void cap;
    }
    return bd;
  }
  function findLib(bd, stones) {
    var nb = bd.nb, b = bd.b;
    for (var k = 0; k < stones.length; k++) for (var j = 0; j < nb[stones[k]].length; j++) if (!b[nb[stones[k]][j]]) return nb[stones[k]][j];
    return -1;
  }
  function winner(bd, komi) { var a = bd.area(); return a.black - a.white - komi > 0 ? BLACK : WHITE; }

  // ---------- UCT + RAVE ----------
  function Node(move, parent, toPlay) { this.move = move; this.parent = parent; this.toPlay = toPlay; this.kids = null; this.n = 0; this.w = 0; this.rn = 0; this.rw = 0; }
  function candidates(bd, c) {
    var out = [];
    for (var i = 0; i < bd.size; i++) if (!bd.b[i] && !bd.isEye(i, c) && bd.legal(i, c)) out.push(i);
    return out;
  }
  function search(bd, komi, iters) {
    var rootN = new Node(-2, null, bd.turn), K = 600;
    for (var it = 0; it < iters; it++) {
      var b = bd.clone(); b.lastMove = -1;
      var node = rootN, path = [node], amaf = new Int8Array(b.size);
      // 選擇
      while (node.kids && node.kids.length) {
        var best = null, bv = -1, lnN = Math.log(node.n + 1);
        for (var k = 0; k < node.kids.length; k++) {
          var ch = node.kids[k];
          var q = ch.n ? ch.w / ch.n : 0.5, rq = ch.rn ? ch.rw / ch.rn : 0.5;
          var beta = Math.sqrt(K / (3 * node.n + K));
          var v = (1 - beta) * q + beta * rq + 0.35 * Math.sqrt(lnN / (ch.n + 1));
          if (v > bv) { bv = v; best = ch; }
        }
        node = best; b.play(node.move, node.parent.toPlay); b.lastMove = node.move; path.push(node);
        if (node.move >= 0 && !amaf[node.move]) amaf[node.move] = node.parent.toPlay;
      }
      // 展開
      if (node.n >= 1 || node === rootN) {
        var cs = candidates(b, b.turn);
        node.kids = cs.map(function (m) { return new Node(m, node, 3 - b.turn); });
        if (node.kids.length) { var pick = node.kids[rnd(node.kids.length)]; b.play(pick.move, node.toPlay); b.lastMove = pick.move; if (!amaf[pick.move]) amaf[pick.move] = node.toPlay; node = pick; path.push(node); }
      }
      // 模擬
      playout(b, amaf);
      var win = winner(b, komi);
      // 回傳
      for (var p = path.length - 1; p >= 0; p--) {
        var nd = path[p], mover = nd.parent ? nd.parent.toPlay : 3 - nd.toPlay;
        nd.n++; if (win === mover) nd.w++;
        if (nd.kids) for (var j = 0; j < nd.kids.length; j++) { var kid = nd.kids[j]; if (amaf[kid.move] === nd.toPlay) { kid.rn++; if (win === nd.toPlay) kid.rw++; } }
      }
    }
    return rootN;
  }
  // 選一手：回傳 {move, winrate}；move -1 = 虛手，-3 = 認輸
  function genmove(state, opts) {
    var bd = fromState(state), komi = state.komi, c = bd.turn;
    var cs = candidates(bd, c);
    if (!cs.length) return { move: -1, winrate: 0.5 };
    var iters = opts.iters || 2000;
    var rootN = search(bd, komi, iters);
    var kids = (rootN.kids || []).slice().sort(function (a, b) { return b.n - a.n; });
    if (!kids.length) return { move: -1, winrate: 0.5 };
    var top = kids[0], wr = top.n ? top.w / top.n : 0.5;
    // 對手剛虛手、而且現在數子我已經贏：跟著虛手結束
    if (state.lastPass) {
      var est = estimate(state, 120);
      var lead = (est.black - est.white - komi) * (c === BLACK ? 1 : -1);
      if (lead > 0) return { move: -1, winrate: wr };
    }
    if (wr < 0.06 && bd.moves > bd.size / 3) return { move: -3, winrate: wr };
    if (wr > 0.97 && top.n > 50 && state.lastPass) return { move: -1, winrate: wr };
    var pick = top;
    if (opts.noise) {
      // 簡單難度：在前幾名裡隨機挑
      var pool = kids.slice(0, Math.min(opts.noise, kids.length)).filter(function (k) { return k.n > 0; });
      if (pool.length) pick = pool[rnd(pool.length)];
    }
    return { move: pick.move, winrate: wr };
  }
  // 估計歸屬（死活）：從目前局面跑隨機對局，看每點最後屬於誰
  function estimate(state, runs) {
    var bd = fromState(state), size = bd.size, own = new Float32Array(size);
    for (var r = 0; r < runs; r++) {
      var b = bd.clone(); b.lastMove = -1; playout(b, null);
      var a = b.area();
      for (var i = 0; i < size; i++) own[i] += a.own[i] === BLACK ? 1 : a.own[i] === WHITE ? -1 : 0;
    }
    var dead = [];
    for (var j = 0; j < size; j++) { own[j] /= runs; if (bd.b[j] === BLACK && own[j] < -0.3) dead.push(j); if (bd.b[j] === WHITE && own[j] > 0.3) dead.push(j); }
    var ar = bd.area(dead);
    return { dead: dead, own: Array.prototype.slice.call(own), black: ar.black, white: ar.white };
  }
  function fromState(s) {
    var bd = new Board(s.n); for (var i = 0; i < s.b.length; i++) bd.b[i] = s.b[i];
    bd.ko = s.ko; bd.turn = s.turn; bd.moves = s.moves || 0; bd.lastMove = -1; return bd;
  }

  var API = { Board: Board, genmove: genmove, estimate: estimate, BLACK: BLACK, WHITE: WHITE };
  root.GoEngine = API;

  // Web Worker：收 {id, cmd, state, opts}，回 {id, res}
  if (typeof importScripts === 'function' && typeof document === 'undefined') {
    root.onmessage = function (e) {
      var d = e.data, res;
      try { res = d.cmd === 'genmove' ? genmove(d.state, d.opts || {}) : estimate(d.state, d.runs || 200); }
      catch (err) { res = { error: String(err) }; }
      root.postMessage({ id: d.id, res: res });
    };
  }
})(typeof self !== 'undefined' ? self : this);
