/* 暗棋破壞神 - 規則引擎與電腦 AI
   棋盤 4 列 × 8 行，索引 i = r*8 + c。
   格子內容：-1 空格；0..13 已翻開的棋子（顏色*7 + 兵種）；16..29 蓋著的棋子（16 + 棋子）。
   兵種：0 帥將 1 仕士 2 相象 3 俥車 4 傌馬 5 炮包 6 兵卒；顏色 0 紅、1 黑。
   電腦只看得到「這格蓋著」，看不到蓋著的是什麼，與玩家公平。 */
(function (root) {
  'use strict';
  const ROWS = 4, COLS = 8, N = 32, EMPTY = -1, HID = 16, UNKNOWN = 99;
  const K = 0, A = 1, E = 2, R = 3, H = 4, C = 5, P = 6;
  const RANK = [7, 6, 5, 4, 3, 2, 1];
  const COUNT = [1, 2, 2, 2, 2, 2, 5];
  const NAMES = [['帥', '仕', '相', '俥', '傌', '炮', '兵'], ['將', '士', '象', '車', '馬', '包', '卒']];
  const COLOR_NAME = ['紅', '黑'];
  const WIN = 100000;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  // 鄰格表
  const NB = [];
  for (let i = 0; i < N; i++) { const r = (i / COLS) | 0, c = i % COLS, a = []; DIRS.forEach(d => { const rr = r + d[0], cc = c + d[1]; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) a.push(rr * COLS + cc); }); NB.push(a); }
  // 各方向的射線（炮、直衝的車使用）
  const RAYS = [];
  for (let i = 0; i < N; i++) { const r = (i / COLS) | 0, c = i % COLS; RAYS.push(DIRS.map(d => { const a = []; let rr = r + d[0], cc = c + d[1]; while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) { a.push(rr * COLS + cc); rr += d[0]; cc += d[1]; } return a; })); }

  const colorOf = v => (v / 7) | 0, typeOf = v => v % 7;
  const isUp = v => v >= 0 && v < 14, isHidden = v => v >= HID && v !== UNKNOWN ? true : v === UNKNOWN;
  function canCap(a, d) { if (a === C) return false; if (a === K && d === P) return false; if (a === P && d === K) return true; return RANK[a] >= RANK[d]; }

  /* ---------- 隨機數 ---------- */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---------- 對局狀態 ---------- */
  function newGame(opt) {
    opt = opt || {};
    const r = rng(opt.seed || (Date.now() ^ (Math.random() * 1e9)));
    const bag = [];
    for (let col = 0; col < 2; col++) for (let t = 0; t < 7; t++) for (let k = 0; k < COUNT[t]; k++) bag.push(col * 7 + t);
    for (let i = bag.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; const x = bag[i]; bag[i] = bag[j]; bag[j] = x; }
    return {
      board: bag.map(v => v + HID), side: opt.first || 0, colorOf: [-1, -1], noProgress: 0, ply: 0,
      rookRun: !!opt.rookRun, drawLimit: opt.drawLimit || 50, history: [], captured: [[], []], last: null
    };
  }
  function clone(s) { return { board: s.board.slice(), side: s.side, colorOf: s.colorOf.slice(), noProgress: s.noProgress, ply: s.ply, rookRun: s.rookRun, drawLimit: s.drawLimit, history: s.history.slice(), captured: [s.captured[0].slice(), s.captured[1].slice()], last: s.last }; }
  // 公開資訊：蓋著的棋子各剩幾枚
  function poolOf(board) { const p = new Array(14).fill(0); for (const v of board) if (v >= HID && v < HID + 14) p[v - HID]++; return p; }
  function key(s) { return s.board.map(v => v >= HID ? 'h' : v < 0 ? '.' : String.fromCharCode(65 + v)).join('') + s.side; }

  /* ---------- 走法產生 ---------- */
  // 走法編碼：from*64 + to（翻棋用 from === to）
  function genMoves(b, col, rookRun, out) {
    out = out || [];
    for (let i = 0; i < N; i++) {
      const v = b[i]; if (v < 0 || v >= 14 || colorOf(v) !== col) continue;
      const t = typeOf(v);
      if (t === C) {
        for (const j of NB[i]) if (b[j] === EMPTY) out.push(i * 64 + j);
        for (const ray of RAYS[i]) { let k = 0; while (k < ray.length && b[ray[k]] === EMPTY) k++; k++; while (k < ray.length && b[ray[k]] === EMPTY) k++; if (k < ray.length) { const w = b[ray[k]]; if (w >= 0 && w < 14 && colorOf(w) !== col) out.push(i * 64 + ray[k]); } }
        continue;
      }
      if (t === R && rookRun) {
        for (const ray of RAYS[i]) { for (let k = 0; k < ray.length; k++) { const j = ray[k], w = b[j]; if (w === EMPTY) { out.push(i * 64 + j); continue; } if (w < 14 && colorOf(w) !== col && canCap(t, typeOf(w))) out.push(i * 64 + j); break; } }
        continue;
      }
      for (const j of NB[i]) { const w = b[j]; if (w === EMPTY) out.push(i * 64 + j); else if (w < 14 && colorOf(w) !== col && canCap(t, typeOf(w))) out.push(i * 64 + j); }
    }
    return out;
  }
  function legalActions(s) {
    const acts = [], b = s.board;
    for (let i = 0; i < N; i++) if (b[i] >= HID) acts.push({ k: 'flip', i });
    const col = s.colorOf[s.side];
    if (col >= 0) for (const m of genMoves(b, col, s.rookRun)) { const f = (m / 64) | 0, t = m % 64; acts.push({ k: 'move', f, t, cap: b[t] !== EMPTY }); }
    return acts;
  }
  function sameAct(a, b) { return a && b && a.k === b.k && (a.k === 'flip' ? a.i === b.i : a.f === b.f && a.t === b.t); }
  function isLegal(s, a) { return legalActions(s).some(x => sameAct(x, a)); }

  function apply(s, a) {
    const n = clone(s), b = n.board; let info = { act: a, side: s.side };
    n.history.push(key(s));
    if (a.k === 'flip') {
      const v = b[a.i] - HID; b[a.i] = v; info.revealed = v;
      if (n.colorOf[0] < 0) { n.colorOf[s.side] = colorOf(v); n.colorOf[1 - s.side] = 1 - colorOf(v); info.assigned = true; }
      n.noProgress = 0;
    } else {
      const w = b[a.t]; info.moved = b[a.f];
      if (w !== EMPTY) { info.captured = w; n.captured[s.side].push(w); n.noProgress = 0; } else n.noProgress++;
      b[a.t] = b[a.f]; b[a.f] = EMPTY;
    }
    n.last = a; n.side = 1 - s.side; n.ply++;
    return { state: n, info };
  }
  // 'play'、{winner: 玩家}、'draw'
  function status(s) {
    if (s.colorOf[0] < 0) return 'play';
    const alive = [0, 0];
    for (const v of s.board) { if (v < 0) continue; const x = v >= HID ? v - HID : v; alive[colorOf(x)]++; }
    for (let p = 0; p < 2; p++) if (alive[s.colorOf[p]] === 0) return { winner: 1 - p, reason: 'wipe' };
    if (legalActions(s).length === 0) return { winner: 1 - s.side, reason: 'stuck' };
    if (s.noProgress >= s.drawLimit) return 'draw';
    return 'play';
  }

  /* ---------- 評估函式 ---------- */
  function counts(b, pool) {
    const cnt = [new Array(7).fill(0), new Array(7).fill(0)];
    for (const v of b) if (v >= 0 && v < 14) cnt[colorOf(v)][typeOf(v)]++;
    for (let k = 0; k < 14; k++) cnt[(k / 7) | 0][k % 7] += pool[k];
    return cnt;
  }
  function values(cnt) {
    // 價值會隨對手陣容改變：對手兵卒多，帥將就沒那麼安全；對手帥將還在，兵卒就很珍貴
    const v = [[], []];
    for (let col = 0; col < 2; col++) {
      const en = cnt[1 - col];
      v[col] = [Math.max(220, 620 - 75 * en[P]), 270, 140, 75, 45, 135, 22 + (en[K] ? 48 : 0)];
    }
    return v;
  }
  function evaluate(b, col, pool, cnt) {
    cnt = cnt || counts(b, pool);
    const tot = [0, 0]; for (let c2 = 0; c2 < 2; c2++) for (let t = 0; t < 7; t++) tot[c2] += cnt[c2][t];
    if (tot[col] === 0) return -WIN; if (tot[1 - col] === 0) return WIN;
    const val = values(cnt); let sc = 0;
    for (let c2 = 0; c2 < 2; c2++) { let m = 0; for (let t = 0; t < 7; t++) m += cnt[c2][t] * val[c2][t]; sc += c2 === col ? m : -m; }
    // 殘局：領先的一方靠近能吃的棋子；落後的一方遠離
    let hidden = 0; for (const x of pool) hidden += x;
    if (hidden === 0 && tot[0] + tot[1] <= 10) {
      for (let i = 0; i < N; i++) {
        const v = b[i]; if (v < 0 || v >= 14) continue; const c2 = colorOf(v), t = typeOf(v); let best = 99;
        for (let j = 0; j < N; j++) { const w = b[j]; if (w < 0 || w >= 14 || colorOf(w) === c2) continue; if (t === C || canCap(t, typeOf(w))) { const d = Math.abs((i >> 3) - (j >> 3)) + Math.abs((i & 7) - (j & 7)); if (d < best) best = d; } }
        if (best < 99) sc += (c2 === col ? -1 : 1) * best * 4;
      }
    }
    return sc;
  }

  /* ---------- 搜尋 ---------- */
  function Search(rookRun, deadline) { this.rookRun = rookRun; this.deadline = deadline || Infinity; this.nodes = 0; this.abort = false; }
  Search.prototype.negamax = function (b, col, depth, alpha, beta, pool, hidden, ply) {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.abort = true;
    if (this.abort) return 0;
    const cnt = counts(b, pool);
    const stand = evaluate(b, col, pool, cnt);
    if (stand <= -WIN || stand >= WIN) return stand > 0 ? WIN - ply : -WIN + ply;
    if (depth <= 0) return stand;
    let best = -Infinity;
    if (hidden > 0) { best = stand; if (best >= beta) return best; if (best > alpha) alpha = best; } // 還能翻棋＝可以「不走」
    const mv = genMoves(b, col, this.rookRun, []);
    if (mv.length === 0) return hidden > 0 ? stand : -WIN + ply;
    // 吃子優先、吃大子優先
    mv.sort((x, y) => { const vx = b[x % 64], vy = b[y % 64]; return (vy >= 0 ? 10 - typeOf(vy) : 0) - (vx >= 0 ? 10 - typeOf(vx) : 0); });
    for (const m of mv) {
      const f = (m / 64) | 0, t = m % 64, cap = b[t];
      b[t] = b[f]; b[f] = EMPTY;
      const sc = -this.negamax(b, 1 - col, depth - 1, -beta, -alpha, pool, hidden, ply + 1);
      b[f] = b[t]; b[t] = cap;
      if (this.abort) return 0;
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  };

  const LEVELS = {
    easy: { name: '簡單', depth: 1, flipDepth: 0, noise: 120, blunder: 0.45, time: 300 },
    normal: { name: '普通', depth: 2, flipDepth: 1, noise: 25, blunder: 0.08, time: 500 },
    hard: { name: '困難', depth: 4, flipDepth: 2, noise: 4, blunder: 0, time: 900 },
    master: { name: '大師', depth: 8, flipDepth: 2, noise: 0, blunder: 0, time: 1000, iterative: true }
  };

  // 電腦選擇動作。只使用公開資訊：蓋著的格子一律視為 UNKNOWN。
  function think(s, levelId, rand) {
    rand = rand || Math.random;
    const L = LEVELS[levelId] || LEVELS.normal, t0 = Date.now();
    const acts = legalActions(s); if (!acts.length) return null;
    const col = s.colorOf[s.side];
    const flips = acts.filter(a => a.k === 'flip'), moves = acts.filter(a => a.k === 'move');
    // 開局：先翻邊角，避免一開始就把子翻到對手旁邊
    if (col < 0) { const edge = flips.filter(a => { const r = (a.i / 8) | 0, c = a.i % 8; return r === 0 || r === 3 || c === 0 || c === 7; }); const pool = edge.length ? edge : flips; return { act: pool[(rand() * pool.length) | 0], score: 0, depth: 0, ms: 0 }; }
    const view = s.board.map(v => v >= HID ? UNKNOWN : v), pool = poolOf(s.board);
    let hidden = flips.length;
    // 簡單／普通偶爾會失誤
    if (rand() < L.blunder) {
      const caps = moves.filter(a => a.cap);
      if (caps.length && rand() < 0.6) return { act: caps[(rand() * caps.length) | 0], score: 0, depth: 0, ms: Date.now() - t0 };
      return { act: acts[(rand() * acts.length) | 0], score: 0, depth: 0, ms: Date.now() - t0 };
    }
    const S = new Search(s.rookRun, t0 + L.time * 3);
    const seen = {}; s.history.forEach(k2 => { seen[k2] = (seen[k2] || 0) + 1; });
    const scored = [];
    // ---- 走子：迭代加深 ----
    let moveScores = null, reached = 0;
    if (moves.length) {
      const maxD = L.depth, startD = L.iterative ? 1 : maxD;
      for (let d = startD; d <= maxD; d++) {
        const S2 = new Search(s.rookRun, L.iterative ? t0 + L.time : Infinity), res = [];
        const ordered = moveScores ? moves.slice().sort((a, b) => moveScores.get(b) - moveScores.get(a)) : moves;
        for (const a of ordered) {
          const b = view.slice(), cap = b[a.t]; b[a.t] = b[a.f]; b[a.f] = EMPTY;
          let sc = -S2.negamax(b, 1 - col, d - 1, -Infinity, Infinity, pool, hidden, 1);
          if (cap >= 0) sc += 1; // 同分時優先吃子
          res.push([a, sc]); if (S2.abort) break;
        }
        S.nodes += S2.nodes;
        if (S2.abort && moveScores) break;
        moveScores = new Map(res); reached = d;
        if (S2.abort) break;
        if (L.iterative && Date.now() - t0 > L.time * 0.45) break;
      }
      for (const [a, sc] of moveScores) scored.push([a, sc]);
    }
    // ---- 翻棋：依剩餘蓋牌的機率算期望值 ----
    if (flips.length) {
      let tot = 0; for (const x of pool) tot += x;
      const fd = L.flipDepth;
      // 遠離戰場的蓋牌結果都差不多，抽樣計算以節省時間
      let cand = flips;
      const near = i => NB[i].some(j => view[j] >= 0 && view[j] < 14) || RAYS[i].some(ray => ray.some(j => view[j] >= 0 && view[j] < 14 && typeOf(view[j]) === C));
      const nearF = flips.filter(a => near(a.i)), farF = flips.filter(a => !near(a.i));
      cand = nearF.concat(farF.slice().sort(() => rand() - 0.5).slice(0, 3));
      const base = evaluate(view, col, pool);
      for (const a of cand) {
        let ev = 0;
        if (fd <= 0) { ev = base; for (let k = 0; k < 14; k++) { if (!pool[k]) continue; const pr = pool[k] / tot; let risk = 0; if (colorOf(k) === col) { for (const j of NB[a.i]) { const w = view[j]; if (w >= 0 && w < 14 && colorOf(w) !== col && canCap(typeOf(w), typeOf(k))) { risk = values(counts(view, pool))[col][typeOf(k)]; break; } } } ev -= pr * risk; } }
        else for (let k = 0; k < 14; k++) {
          if (!pool[k]) continue;
          const pr = pool[k] / tot, b = view.slice(); b[a.i] = k; pool[k]--;
          const sc = -S.negamax(b, 1 - col, fd, -Infinity, Infinity, pool, hidden - 1, 1);
          pool[k]++; ev += pr * sc;
        }
        scored.push([a, ev]);
      }
    }
    // 重複局面：領先時避免繞圈
    for (const it of scored) {
      if (it[0].k !== 'move') continue;
      const n = apply(s, it[0]).state; const k2 = key(n);
      if (seen[k2] && it[1] > -50) it[1] -= 40 * seen[k2];
    }
    let best = null;
    for (const it of scored) { const sc = it[1] + (L.noise ? (rand() - 0.5) * 2 * L.noise : 0); if (!best || sc > best[1]) best = [it[0], sc]; }
    return { act: best[0], score: Math.round(best[1]), depth: reached, nodes: S.nodes, ms: Date.now() - t0 };
  }

  const API = { ROWS, COLS, N, EMPTY, HID, UNKNOWN, NAMES, COLOR_NAME, RANK, COUNT, LEVELS, K, A, E, R, H, C, P, colorOf, typeOf, canCap, newGame, clone, legalActions, isLegal, sameAct, apply, status, think, key, poolOf, rng, name: v => NAMES[colorOf(v)][typeOf(v)] };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.DC = API;
})(typeof window !== 'undefined' ? window : globalThis);
