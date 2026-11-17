/* 象棋 - 規則引擎與電腦 AI
   棋盤 9 行 × 10 列，索引 i = r*9 + c；r=0 在最上方（黑方），r=9 在最下方（紅方）。
   棋子：0 空；紅 1..7、黑 9..15（顏色 = v >> 3）；兵種 = v & 7：1 帥將 2 仕士 3 相象 4 傌馬 5 俥車 6 炮包 7 兵卒 */
(function (root) {
  'use strict';
  const W = 9, Hh = 10, N = 90, RED = 0, BLACK = 1;
  const K = 1, A = 2, B = 3, Nn = 4, R = 5, C = 6, P = 7;
  const NAMES = [[, '帥', '仕', '相', '傌', '俥', '炮', '兵'], [, '將', '士', '象', '馬', '車', '包', '卒']];
  const EN = [, 'General', 'Advisor', 'Elephant', 'Horse', 'Chariot', 'Cannon', 'Soldier'];
  const colorOf = v => v >> 3, typeOf = v => v & 7;
  const rc = i => [(i / 9) | 0, i % 9], at = (r, c) => r * 9 + c, inside = (r, c) => r >= 0 && r < Hh && c >= 0 && c < W;
  const inPalace = (col, r, c) => c >= 3 && c <= 5 && (col === RED ? r >= 7 : r <= 2);
  const ownHalf = (col, r) => col === RED ? r >= 5 : r <= 4;

  function initial() {
    const b = new Array(N).fill(0), back = [R, Nn, B, A, K, A, B, Nn, R];
    for (let c = 0; c < 9; c++) { b[at(0, c)] = 8 + back[c]; b[at(9, c)] = back[c]; }
    b[at(2, 1)] = b[at(2, 7)] = 8 + C; b[at(7, 1)] = b[at(7, 7)] = C;
    for (let c = 0; c < 9; c += 2) { b[at(3, c)] = 8 + P; b[at(6, c)] = P; }
    return b;
  }
  function newGame() { return { board: initial(), side: RED, ply: 0, noCap: 0, history: [], captured: [[], []], last: null }; }
  function clone(s) { return { board: s.board.slice(), side: s.side, ply: s.ply, noCap: s.noCap, history: s.history.slice(), captured: [s.captured[0].slice(), s.captured[1].slice()], last: s.last }; }

  /* ---------- 走法產生（不檢查將軍）---------- */
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const HORSE = [[-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0], [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]];
  function pseudo(b, col, out, capsOnly) {
    for (let i = 0; i < N; i++) {
      const v = b[i]; if (!v || colorOf(v) !== col) continue;
      const t = typeOf(v), r = (i / 9) | 0, c = i % 9;
      const push = (j) => { const w = b[j]; if (w && colorOf(w) === col) return; if (capsOnly && !w) return; out.push(i * 128 + j); };
      if (t === K) { for (const d of ORTH) { const rr = r + d[0], cc = c + d[1]; if (inside(rr, cc) && inPalace(col, rr, cc)) push(at(rr, cc)); } }
      else if (t === A) { for (const d of DIAG) { const rr = r + d[0], cc = c + d[1]; if (inside(rr, cc) && inPalace(col, rr, cc)) push(at(rr, cc)); } }
      else if (t === B) { for (const d of DIAG) { const rr = r + 2 * d[0], cc = c + 2 * d[1]; if (inside(rr, cc) && ownHalf(col, rr) && !b[at(r + d[0], c + d[1])]) push(at(rr, cc)); } }
      else if (t === Nn) { for (const d of HORSE) { const rr = r + d[0], cc = c + d[1]; if (inside(rr, cc) && !b[at(r + d[2], c + d[3])]) push(at(rr, cc)); } }
      else if (t === R || t === C) {
        for (const d of ORTH) {
          let rr = r + d[0], cc = c + d[1], jumped = false;
          while (inside(rr, cc)) {
            const j = at(rr, cc), w = b[j];
            if (!jumped) { if (!w) { if (!capsOnly) out.push(i * 128 + j); } else { if (t === R) { if (colorOf(w) !== col) out.push(i * 128 + j); break; } jumped = true; } }
            else if (w) { if (colorOf(w) !== col) out.push(i * 128 + j); break; }
            rr += d[0]; cc += d[1];
          }
        }
      } else if (t === P) {
        const f = col === RED ? -1 : 1;
        if (inside(r + f, c)) push(at(r + f, c));
        if (!ownHalf(col, r)) { if (c > 0) push(at(r, c - 1)); if (c < 8) push(at(r, c + 1)); }
      }
    }
    return out;
  }
  function kingSq(b, col) { const k = col * 8 + K; for (let i = 0; i < N; i++) if (b[i] === k) return i; return -1; }
  // col 方的帥（將）是否被攻擊（含王見王）
  function attacked(b, sq, col) {
    const r = (sq / 9) | 0, c = sq % 9, en = 1 - col;
    for (const d of ORTH) {
      let rr = r + d[0], cc = c + d[1], cnt = 0;
      while (inside(rr, cc)) {
        const w = b[at(rr, cc)];
        if (w) {
          if (cnt === 0) { if (colorOf(w) === en) { const t = typeOf(w); if (t === R || (t === K && d[1] === 0)) return true; } cnt = 1; }
          else { if (colorOf(w) === en && typeOf(w) === C) return true; break; }
        }
        rr += d[0]; cc += d[1];
      }
    }
    // 兵卒：從正後方往前吃，或過河後從左右吃
    const ef = en === RED ? -1 : 1, ep = en * 8 + P;
    if (inside(r - ef, c) && b[at(r - ef, c)] === ep) return true;
    for (const dc of [-1, 1]) if (inside(r, c + dc) && b[at(r, c + dc)] === ep && !ownHalf(en, r)) return true;
    for (const d of HORSE) {
      // 從被攻擊格反推馬的位置：馬在 (r-d0, c-d1)，馬腳在馬旁邊
      const hr = r - d[0], hc = c - d[1]; if (!inside(hr, hc)) continue;
      const w = b[at(hr, hc)]; if (!w || colorOf(w) !== en || typeOf(w) !== Nn) continue;
      if (!b[at(hr + d[2], hc + d[3])]) return true;
    }
    return false;
  }
  function inCheck(b, col) { const k = kingSq(b, col); return k < 0 || attacked(b, k, col); }
  function legalMoves(b, col) {
    const ps = pseudo(b, col, []), out = [];
    for (const m of ps) { const f = m >> 7, t = m & 127, cap = b[t]; b[t] = b[f]; b[f] = 0; if (!inCheck(b, col)) out.push(m); b[f] = b[t]; b[t] = cap; }
    return out;
  }
  function key(s) { return s.board.join(',') + '|' + s.side; }
  function isLegal(s, m) { return legalMoves(s.board.slice(), s.side).some(x => (x >> 7) === m.f && (x & 127) === m.t); }
  function apply(s, m) {
    const n = clone(s), b = n.board, cap = b[m.t];
    n.history.push(key(s));
    b[m.t] = b[m.f]; b[m.f] = 0;
    if (cap) { n.captured[s.side].push(cap); n.noCap = 0; } else n.noCap++;
    n.side = 1 - s.side; n.ply++; n.last = { f: m.f, t: m.t };
    return { state: n, info: { captured: cap || null, moved: b[m.t], check: inCheck(b, n.side) } };
  }
  // 'play' | {winner, reason} | 'draw'
  function status(s) {
    if (legalMoves(s.board.slice(), s.side).length === 0) return { winner: 1 - s.side, reason: inCheck(s.board, s.side) ? 'mate' : 'stalemate' };
    if (kingSq(s.board, s.side) < 0) return { winner: 1 - s.side, reason: 'mate' };
    const k = key(s); let rep = 0; for (const h of s.history) if (h === k) rep++;
    if (rep >= 2) return 'draw';
    if (s.noCap >= 120) return 'draw';
    let mat = 0; for (const v of s.board) if (v) { const t = typeOf(v); if (t === R || t === C || t === Nn || t === P) mat++; }
    if (mat === 0) return 'draw';
    return 'play';
  }

  /* ---------- 評估：子力 + 位置表（紅方視角，黑方鏡像）---------- */
  const VAL = [0, 6000, 120, 120, 270, 600, 285, 30];
  const PST = {};
  PST[P] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    90, 100, 120, 140, 150, 140, 120, 100, 90,
    90, 100, 120, 140, 150, 140, 120, 100, 90,
    70, 90, 110, 120, 130, 120, 110, 90, 70,
    50, 70, 80, 95, 100, 95, 80, 70, 50,
    10, 0, 20, 0, 30, 0, 20, 0, 10,
    0, 0, 0, 0, 10, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0].map(x => x * 0.6);
  PST[Nn] = [
    4, 8, 16, 12, 4, 12, 16, 8, 4,
    4, 10, 28, 16, 8, 16, 28, 10, 4,
    12, 14, 16, 20, 18, 20, 16, 14, 12,
    8, 24, 18, 24, 20, 24, 18, 24, 8,
    6, 16, 14, 18, 16, 18, 14, 16, 6,
    4, 12, 16, 14, 12, 14, 16, 12, 4,
    2, 6, 8, 6, 10, 6, 8, 6, 2,
    4, 2, 8, 8, 4, 8, 8, 2, 4,
    0, 2, 4, 4, -2, 4, 4, 2, 0,
    0, -4, 0, 0, 0, 0, 0, -4, 0];
  PST[R] = [
    14, 14, 12, 18, 16, 18, 12, 14, 14,
    16, 20, 18, 24, 26, 24, 18, 20, 16,
    12, 12, 12, 18, 18, 18, 12, 12, 12,
    12, 18, 16, 22, 22, 22, 16, 18, 12,
    12, 14, 12, 18, 18, 18, 12, 14, 12,
    12, 16, 14, 20, 20, 20, 14, 16, 12,
    6, 10, 8, 14, 14, 14, 8, 10, 6,
    4, 8, 6, 14, 12, 14, 6, 8, 4,
    8, 4, 8, 16, 8, 16, 8, 4, 8,
    -2, 10, 6, 14, 12, 14, 6, 10, -2];
  PST[C] = [
    6, 4, 0, -10, -12, -10, 0, 4, 6,
    2, 2, 0, -4, -14, -4, 0, 2, 2,
    2, 2, 0, -10, -8, -10, 0, 2, 2,
    0, 0, -2, 4, 10, 4, -2, 0, 0,
    0, 0, 0, 2, 8, 2, 0, 0, 0,
    -2, 0, 4, 2, 6, 2, 4, 0, -2,
    0, 0, 0, 2, 4, 2, 0, 0, 0,
    4, 0, 8, 6, 10, 6, 8, 0, 4,
    0, 2, 4, 6, 6, 6, 4, 2, 0,
    0, 0, 2, 6, 6, 6, 2, 0, 0];
  PST[K] = new Array(90).fill(0); PST[K][at(9, 4)] = 4; PST[K][at(8, 4)] = 2; PST[K][at(7, 4)] = -4;
  PST[A] = new Array(90).fill(0); PST[A][at(8, 4)] = 6;
  PST[B] = new Array(90).fill(0); PST[B][at(7, 4)] = 6; PST[B][at(9, 2)] = PST[B][at(9, 6)] = 2;
  const mirror = i => at(9 - ((i / 9) | 0), i % 9);
  function evaluate(b, col) {
    let sc = 0;
    for (let i = 0; i < N; i++) {
      const v = b[i]; if (!v) continue; const t = typeOf(v), cl = colorOf(v);
      const ps = cl === RED ? PST[t][i] : PST[t][mirror(i)];
      const x = VAL[t] + ps;
      sc += cl === col ? x : -x;
    }
    return sc;
  }

  /* ---------- 搜尋 ---------- */
  const MATE = 30000;
  function Searcher(deadline) { this.deadline = deadline; this.nodes = 0; this.abort = false; this.killers = []; this.hist = new Int32Array(90 * 128); this.tt = new Map(); }
  Searcher.prototype.order = function (b, ms, ply, ttMove) {
    const k = this.killers[ply] || [];
    return ms.map(m => { const t = m & 127, f = m >> 7, cap = b[t]; let s = 0; if (m === ttMove) s = 1e7; else if (cap) s = 1e6 + VAL[typeOf(cap)] * 10 - VAL[typeOf(b[f])] / 10; else if (m === k[0] || m === k[1]) s = 9e5; else s = this.hist[m]; return [m, s]; }).sort((x, y) => y[1] - x[1]).map(x => x[0]);
  };
  Searcher.prototype.qs = function (b, col, alpha, beta, ply) {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.abort = true;
    if (this.abort) return 0;
    const stand = evaluate(b, col);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 24) return stand;
    const ms = this.order(b, pseudo(b, col, [], true), ply, 0);
    for (const m of ms) {
      const f = m >> 7, t = m & 127, cap = b[t];
      if (typeOf(cap) === K) return MATE - ply;
      b[t] = b[f]; b[f] = 0;
      if (inCheck(b, col)) { b[f] = b[t]; b[t] = cap; continue; }
      const sc = -this.qs(b, 1 - col, -beta, -alpha, ply + 1);
      b[f] = b[t]; b[t] = cap;
      if (this.abort) return 0;
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };
  Searcher.prototype.search = function (b, col, depth, alpha, beta, ply, hk) {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.abort = true;
    if (this.abort) return 0;
    const chk = inCheck(b, col);
    if (chk) depth++;
    if (depth <= 0) return this.qs(b, col, alpha, beta, ply);
    const tk = b.join('') + col, te = this.tt.get(tk);
    if (te && te.d >= depth && ply > 0) { if (te.f === 0) return te.v; if (te.f === 1 && te.v >= beta) return te.v; if (te.f === 2 && te.v <= alpha) return te.v; }
    const ms = this.order(b, pseudo(b, col, []), ply, te ? te.m : 0);
    let best = -MATE, bestM = 0, legal = 0; const a0 = alpha;
    for (const m of ms) {
      const f = m >> 7, t = m & 127, cap = b[t];
      b[t] = b[f]; b[f] = 0;
      if (inCheck(b, col)) { b[f] = b[t]; b[t] = cap; continue; }
      legal++;
      let sc;
      if (legal > 1) { sc = -this.search(b, 1 - col, depth - 1, -alpha - 1, -alpha, ply + 1); if (sc > alpha && sc < beta) sc = -this.search(b, 1 - col, depth - 1, -beta, -alpha, ply + 1); }
      else sc = -this.search(b, 1 - col, depth - 1, -beta, -alpha, ply + 1);
      b[f] = b[t]; b[t] = cap;
      if (this.abort) return 0;
      if (sc > best) { best = sc; bestM = m; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) { if (!cap) { const k = this.killers[ply] || (this.killers[ply] = [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } this.hist[m] += depth * depth; } break; }
    }
    if (!legal) return -MATE + ply; // 被將死或困斃都算輸
    if (this.tt.size > 400000) this.tt.clear();
    this.tt.set(tk, { d: depth, v: best, m: bestM, f: best <= a0 ? 2 : best >= beta ? 1 : 0 });
    return best;
  };

  const LEVELS = {
    easy: { name: '簡單', time: 200, maxDepth: 1, noise: 90, blunder: 0.3 },
    normal: { name: '普通', time: 500, maxDepth: 3, noise: 20, blunder: 0.05 },
    hard: { name: '困難', time: 1200, maxDepth: 6, noise: 4, blunder: 0 },
    master: { name: '大師', time: 2500, maxDepth: 12, noise: 0, blunder: 0 }
  };
  function think(s, levelId, rand) {
    rand = rand || Math.random;
    const L = LEVELS[levelId] || LEVELS.normal, t0 = Date.now(), b = s.board.slice(), col = s.side;
    let ms = legalMoves(b, col); if (!ms.length) return null;
    const toAct = m => ({ f: m >> 7, t: m & 127 });
    if (rand() < L.blunder) return { act: toAct(ms[(rand() * ms.length) | 0]), score: 0, depth: 0, ms: 0 };
    // 避免重複局面（三次重複算和）：領先時不走回頭路
    const seen = {}; s.history.forEach(k => { seen[k] = (seen[k] || 0) + 1; });
    const S = new Searcher(t0 + L.time);
    let bestM = ms[0], scores = new Map(), reached = 0;
    for (let d = 1; d <= L.maxDepth; d++) {
      const ordered = scores.size ? ms.slice().sort((x, y) => (scores.get(y) || -1e9) - (scores.get(x) || -1e9)) : S.order(b, ms, 0, 0);
      const cur = new Map(); let alpha = -MATE - 1;
      for (const m of ordered) {
        const f = m >> 7, t = m & 127, cap = b[t];
        b[t] = b[f]; b[f] = 0;
        let sc = -S.search(b, 1 - col, d - 1, -MATE - 1, L.noise ? MATE + 1 : -alpha, 1);
        const k = b.join(',') + '|' + (1 - col);
        b[f] = b[t]; b[t] = cap;
        if (S.abort) break;
        if (seen[k]) sc -= sc > 0 ? 60 * seen[k] : 0;
        cur.set(m, sc); if (sc > alpha) alpha = sc;
      }
      if (S.abort && d > 1) break;
      if (cur.size === ms.length || !scores.size) { scores = cur; reached = d; }
      if (S.abort) break;
      if (Date.now() - t0 > L.time * 0.55) break;
      let top = -Infinity; for (const v of scores.values()) top = Math.max(top, v); if (top > MATE - 100) break;
    }
    let best = null;
    for (const [m, sc] of scores) { const v = sc + (L.noise ? (rand() - 0.5) * 2 * L.noise : 0); if (!best || v > best[1]) best = [m, v]; }
    if (best) bestM = best[0];
    return { act: toAct(bestM), score: scores.get(bestM) || 0, depth: reached, nodes: S.nodes, ms: Date.now() - t0 };
  }
  function legalFrom(s, f) { return legalMoves(s.board.slice(), s.side).filter(m => (m >> 7) === f).map(m => m & 127); }
  function allLegal(s) { return legalMoves(s.board.slice(), s.side).map(m => ({ f: m >> 7, t: m & 127 })); }

  const API = { W, H: Hh, N, RED, BLACK, K, A, B, N_: Nn, R, C, P, NAMES, EN, colorOf, typeOf, newGame, clone, apply, status, think, isLegal, legalFrom, allLegal, inCheck: (s) => inCheck(s.board, s.side), key, at, rc, name: v => NAMES[colorOf(v)][typeOf(v)] };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.XQ = API;
})(typeof window !== 'undefined' ? window : globalThis);
