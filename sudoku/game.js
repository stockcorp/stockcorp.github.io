/* 數獨 — stockcorp.github.io/sudoku/
   隨機產生唯一解題目（簡單/中等/困難），筆記、復原、提示、錯 3 次結束、自動存檔。
   排行榜：mode = easy/medium/hard，時間由伺服器依開局憑證計算（越短越好），用提示的局不列入。 */
(function () {
  'use strict';
  var GAME = 'sudoku', SAVE = 'scsdk_save', $ = K.$, L = K.L;
  var LV = {
    easy: { zh: '簡單', en: 'Easy', holes: 40 },
    medium: { zh: '中等', en: 'Medium', holes: 49 },
    hard: { zh: '困難', en: 'Hard', holes: 55 }
  };
  var S, sel = -1, noteMode = false, tick = null;

  // ---------- 題目產生 ----------
  function rc(i) { return [Math.floor(i / 9), i % 9]; }
  var PEERS = [];
  (function () {
    for (var i = 0; i < 81; i++) {
      var p = {}, r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
      for (var k = 0; k < 9; k++) { p[r * 9 + k] = 1; p[k * 9 + c] = 1; p[(br + Math.floor(k / 3)) * 9 + bc + k % 3] = 1; }
      delete p[i]; PEERS.push(Object.keys(p).map(Number));
    }
  })();
  function ok(g, i, v) { var p = PEERS[i]; for (var k = 0; k < p.length; k++) if (g[p[k]] === v) return false; return true; }
  function fill(g) {
    var i = g.indexOf(0); if (i < 0) return true;
    var vs = K.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var k = 0; k < 9; k++) if (ok(g, i, vs[k])) { g[i] = vs[k]; if (fill(g)) return true; g[i] = 0; }
    return false;
  }
  // 數解的數量（最多數到 2）；挑候選最少的格子先試
  function count(g, lim) {
    var best = -1, bestC = null;
    for (var i = 0; i < 81; i++) if (!g[i]) {
      var cs = []; for (var v = 1; v <= 9; v++) if (ok(g, i, v)) cs.push(v);
      if (!cs.length) return 0;
      if (!bestC || cs.length < bestC.length) { best = i; bestC = cs; if (cs.length === 1) break; }
    }
    if (best < 0) return 1;
    var n = 0;
    for (var k = 0; k < bestC.length && n < lim; k++) { g[best] = bestC[k]; n += count(g, lim - n); }
    g[best] = 0; return n;
  }
  function generate(lv) {
    var sol = new Array(81).fill(0); fill(sol);
    var puz = sol.slice(), order = K.shuffle(Array.from({ length: 81 }, function (_, i) { return i; })), holes = 0, want = LV[lv].holes;
    for (var k = 0; k < 81 && holes < want; k++) {
      var i = order[k], keep = puz[i]; puz[i] = 0;
      if (count(puz.slice(), 2) !== 1) puz[i] = keep; else holes++;
    }
    return { sol: sol, puz: puz };
  }

  // ---------- 遊戲 ----------
  function start(lv) {
    var q = generate(lv);
    S = { lv: lv, sol: q.sol, giv: q.puz.map(function (v) { return v > 0; }), val: q.puz.slice(), notes: q.puz.map(function () { return 0; }),
      mist: 0, hint: false, done: false, t0: Date.now(), acc: 0, hist: [] };
    sel = -1; build(); draw(); persist(); run();
    if (window.SCLB) SCLB.start(GAME, lv);
    if (window.SC) SC.post('start', { game: GAME, level: lv });
    lbLink();
  }
  function elapsed() { return Math.floor((S.acc + (S.done ? 0 : Date.now() - S.t0)) / 1000); }
  function run() { clearInterval(tick); tick = setInterval(function () { if (S && !S.done) $('clock').textContent = K.fmtTime(elapsed()); }, 500); }

  function put(v) {
    if (!S || S.done || sel < 0 || S.giv[sel]) return;
    if (noteMode && v) {
      if (S.val[sel]) return;
      S.hist.push([sel, S.val[sel], S.notes[sel]]);
      S.notes[sel] ^= 1 << v; K.beep(700, 0.03, 'sine', 0.03); draw(); persist(); return;
    }
    if (S.val[sel] === v) return;
    S.hist.push([sel, S.val[sel], S.notes[sel]]);
    S.val[sel] = v; S.notes[sel] = 0;
    if (v && v !== S.sol[sel]) {
      S.mist++; K.beep(160, 0.18, 'sawtooth', 0.05); navigator.vibrate && navigator.vibrate(60);
      if (S.mist >= 3) { draw(); return finish(false); }
    } else if (v) {
      // 填對了：把同行列宮的筆記清掉
      PEERS[sel].forEach(function (p) { S.notes[p] &= ~(1 << v); });
      K.beep(520 + v * 30, 0.06, 'triangle', 0.04);
      var cell = $('grid').children[sel]; cell.classList.remove('pop'); void cell.offsetWidth; cell.classList.add('pop');
    }
    draw(); persist();
    if (S.val.every(function (x, i) { return x === S.sol[i]; })) finish(true);
  }
  function undo() {
    if (!S || S.done || !S.hist.length) return;
    var h = S.hist.pop(); S.val[h[0]] = h[1]; S.notes[h[0]] = h[2]; sel = h[0]; draw(); persist();
  }
  function hint() {
    if (!S || S.done) return;
    var i = sel >= 0 && !S.giv[sel] && S.val[sel] !== S.sol[sel] ? sel : -1;
    if (i < 0) { for (var k = 0; k < 81; k++) if (S.val[k] !== S.sol[k]) { i = k; break; } }
    if (i < 0) return;
    if (!S.hint) K.toast(L('用了提示，這局不列入排行榜', 'Hint used — this game won’t count for the leaderboard'), 2600);
    S.hint = true; sel = i; noteMode = false; put(S.sol[i]);
  }
  function finish(win) {
    S.acc += Date.now() - S.t0; S.done = true; persist();
    var t = elapsed();
    $('endEmoji').textContent = win ? '🎉' : '💥';
    $('endTitle').textContent = win ? L('完成！', 'Solved!') : L('錯太多次了', 'Too many mistakes');
    $('endTime').textContent = K.fmtTime(t); $('endMist').textContent = S.mist;
    $('endNote').textContent = win && S.hint ? L('這局用了提示，不列入排行榜。', 'You used a hint, so this game is not on the leaderboard.') : '';
    $('bAgain').textContent = win ? L('下一題', 'Next puzzle') : L('再試一題', 'Try another');
    if (win) {
      var best = K.load('scsdk_best', {}); if (!best[S.lv] || t < best[S.lv]) { best[S.lv] = t; K.save('scsdk_best', best); }
    }
    setTimeout(function () {
      K.open('ovEnd');
      if (win && !S.hint && window.SCLB) {
        var sec = SCLB.elapsed(GAME) || t;
        SCLB.offer({ game: GAME, mode: S.lv, score: sec, text: LV[S.lv][window.SC && SC.lang === 'en' ? 'en' : 'zh'] + ' ' + K.fmtTime(sec) });
      }
    }, win ? 500 : 200);
    K.beep(win ? 523 : 200, 0.4, 'triangle', 0.07, win ? 1046 : 90);
    if (window.SC) SC.post('gameover', { game: GAME, win: win, level: S.lv, sec: t });
  }

  // ---------- 畫面 ----------
  function build() {
    var g = $('grid'); g.innerHTML = '';
    for (var i = 0; i < 81; i++) {
      var d = document.createElement('div'), r = Math.floor(i / 9), c = i % 9;
      d.className = 'c' + (c === 2 || c === 5 ? ' br' : '') + (r === 2 || r === 5 ? ' bb' : '');
      d.dataset.i = i; g.appendChild(d);
    }
  }
  function draw() {
    var cells = $('grid').children, sv = sel >= 0 ? S.val[sel] : 0, sr = sel >= 0 ? rc(sel) : null, cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 81; i++) {
      var e = cells[i], v = S.val[i], r = Math.floor(i / 9), c = i % 9, cl = e.className.replace(/ (g|peer|same|sel|bad)\b/g, '');
      if (S.giv[i]) cl += ' g';
      if (sr && (r === sr[0] || c === sr[1] || (Math.floor(r / 3) === Math.floor(sr[0] / 3) && Math.floor(c / 3) === Math.floor(sr[1] / 3)))) cl += ' peer';
      if (sv && v === sv) cl += ' same';
      if (i === sel) cl += ' sel';
      if (v && v !== S.sol[i]) cl += ' bad';
      e.className = cl;
      if (v) { e.textContent = v; if (v === S.sol[i]) cnt[v]++; }
      else if (S.notes[i]) { var h = '<div class="nt">'; for (var n = 1; n <= 9; n++) h += '<span>' + (S.notes[i] & (1 << n) ? n : '') + '</span>'; e.innerHTML = h + '</div>'; }
      else e.textContent = '';
    }
    var pb = $('pad').children;
    for (var k = 0; k < 9; k++) { pb[k].classList.toggle('done', cnt[k + 1] >= 9); pb[k].querySelector('small').textContent = 9 - cnt[k + 1]; }
    $('mist').textContent = S.mist;
    $('lvName').textContent = L(LV[S.lv].zh, LV[S.lv].en);
    $('clock').textContent = K.fmtTime(elapsed());
    $('tNote').classList.toggle('on', noteMode); $('noteOn').textContent = noteMode ? 'ON' : 'OFF';
    $('tUndo').disabled = !S.hist.length;
  }
  function lbLink() { $('bLb').href = '/leaderboard/?game=sudoku&mode=' + S.lv; }

  function persist() { if (S) K.save(SAVE, { lv: S.lv, sol: S.sol, giv: S.giv, val: S.val, notes: S.notes, mist: S.mist, hint: S.hint, done: S.done, acc: S.acc + (S.done ? 0 : Date.now() - S.t0) }); }
  function resume() {
    var s = K.load(SAVE, null); if (!s || s.done || !s.sol || !LV[s.lv]) return false;
    S = { lv: s.lv, sol: s.sol, giv: s.giv, val: s.val, notes: s.notes, mist: s.mist, hint: s.hint, done: false, t0: Date.now(), acc: s.acc || 0, hist: [] };
    build(); draw(); run(); lbLink();
    if (window.SCLB && !SCLB.has(GAME, S.lv)) { S.hint = true; } // 沒有開局憑證（例如過期）就不列入
    return true;
  }

  // ---------- 操作 ----------
  (function () {
    var p = $('pad');
    for (var n = 1; n <= 9; n++) { var b = document.createElement('button'); b.innerHTML = n + '<small></small>'; b.dataset.n = n; p.appendChild(b); }
    p.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) put(+b.dataset.n); });
    var chips = $('lvChips');
    Object.keys(LV).forEach(function (k) {
      var b = document.createElement('button'); b.dataset.lv = k; chips.appendChild(b);
    });
    function chipText() {
      var best = K.load('scsdk_best', {});
      [].forEach.call(chips.children, function (b) { var k = b.dataset.lv; b.innerHTML = L(LV[k].zh, LV[k].en) + '<small>' + (best[k] ? L('最佳 ', 'Best ') + K.fmtTime(best[k]) : '&nbsp;') + '</small>'; });
    }
    chips.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { K.close('ovNew'); K.close('ovEnd'); start(b.dataset.lv); } });
    $('bNew').onclick = function () { chipText(); K.open('ovNew'); };
    $('bAgain').onclick = function () { K.close('ovEnd'); chipText(); K.open('ovNew'); };
    $('tUndo').onclick = undo;
    $('tErase').onclick = function () { if (sel >= 0 && S.val[sel] && S.val[sel] !== S.sol[sel]) put(0); else if (sel >= 0 && S.notes[sel]) { S.hist.push([sel, 0, S.notes[sel]]); S.notes[sel] = 0; draw(); persist(); } };
    $('tNote').onclick = function () { noteMode = !noteMode; draw(); };
    $('tHint').onclick = hint;
    $('grid').addEventListener('click', function (e) { var c = e.target.closest('.c'); if (c) { sel = +c.dataset.i; draw(); } });
    $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
    function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
    document.addEventListener('keydown', function (e) {
      if (!S || K.isOpen('ovNew') || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      var k = e.key;
      if (/^[1-9]$/.test(k)) { put(+k); e.preventDefault(); }
      else if (k === 'Backspace' || k === 'Delete' || k === '0') { $('tErase').onclick(); e.preventDefault(); }
      else if (k === 'n' || k === 'N') { noteMode = !noteMode; draw(); }
      else if ((k === 'z' || k === 'Z') && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); }
      else if (/^Arrow/.test(k)) {
        if (sel < 0) sel = 40; else { var r = Math.floor(sel / 9), c = sel % 9;
          if (k === 'ArrowUp') r = (r + 8) % 9; if (k === 'ArrowDown') r = (r + 1) % 9; if (k === 'ArrowLeft') c = (c + 8) % 9; if (k === 'ArrowRight') c = (c + 1) % 9; sel = r * 9 + c; }
        draw(); e.preventDefault();
      }
    });
    document.addEventListener('visibilitychange', function () { if (S && !S.done) { if (document.hidden) { S.acc += Date.now() - S.t0; S.t0 = Date.now(); persist(); } else S.t0 = Date.now(); } });
    if (window.SC) SC.onLang(function () { if (S) draw(); });
    if (!resume()) { start('easy'); }
  })();
})();
