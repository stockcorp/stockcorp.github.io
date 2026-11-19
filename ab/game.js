/* 猜數字 1A2B — stockcorp.github.io/ab/
   四個不重複數字（可 0 開頭）。排行榜：mode = classic，從第一次猜到猜中的時間（伺服器計時）。 */
(function () {
  'use strict';
  var GAME = 'ab', $ = K.$, L = K.L, S = null, tick = null, notes = {};
  function newGame() {
    var d = K.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
    S = { ans: d.join(''), cur: '', hist: [], started: false, over: false, t0: 0 };
    notes = {}; clearInterval(tick); $('clock').textContent = '0:00'; $('hist').innerHTML = ''; $('cnt').textContent = 0; K.close('ovEnd'); render();
  }
  function score(g) { var a = 0, b = 0; for (var i = 0; i < 4; i++) { if (g[i] === S.ans[i]) a++; else if (S.ans.indexOf(g[i]) >= 0) b++; } return [a, b]; }
  function press(k) {
    if (S.over) return;
    if (k === 'del') S.cur = S.cur.slice(0, -1);
    else if (k === 'go') return submit();
    else if (S.cur.length < 4 && S.cur.indexOf(k) < 0) { S.cur += k; K.beep(600 + (+k) * 30, 0.03, 'sine', 0.03); }
    render();
  }
  function submit() {
    if (S.cur.length !== 4) { var s = $('slots'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); return; }
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
    var r = score(S.cur); S.hist.push([S.cur, r]);
    var row = document.createElement('div'); row.innerHTML = S.cur + '<span><b class="a">' + r[0] + 'A</b> <b class="b">' + r[1] + 'B</b></span>'; $('hist').appendChild(row);
    $('cnt').textContent = S.hist.length;
    S.cur = '';
    if (r[0] === 4) return win();
    K.beep(r[0] ? 500 + r[0] * 120 : 300, 0.08, 'triangle', 0.04);
    if (r[0] + r[1] === 0) { S.hist[S.hist.length - 1][0].split('').forEach(function (d) { notes[d] = 1; }); }
    render();
  }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scab_best', 0), nb = !best || t < best; if (nb) K.save('scab_best', t);
    $('endTime').textContent = K.fmtTime(t); $('endCnt').textContent = S.hist.length;
    $('endBest').textContent = (nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best)) + '　' + L('答案 ', 'Answer ') + S.ans;
    K.beep(523, 0.5, 'triangle', 0.07, 1046); render();
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: 'classic', score: sec, text: S.hist.length + L(' 次猜中・', ' guesses · ') + K.fmtTime(sec) }); } }, 500);
  }
  function render() {
    [].forEach.call($('slots').children, function (e, i) { e.textContent = S.cur[i] || ''; e.classList.toggle('on', i === S.cur.length); });
    [].forEach.call($('pad').querySelectorAll('[data-k]'), function (b) { var k = b.dataset.k; if (k.length === 1) { b.disabled = S.cur.indexOf(k) >= 0 || S.over; b.classList.toggle('x', !!notes[k]); } });
  }
  var pad = $('pad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach(function (k) { var b = document.createElement('button'); b.textContent = k; b.dataset.k = k; pad.appendChild(b); });
  [['del', '⌫ 刪除', '⌫ Delete', 'wide'], ['go', '確定', 'Enter', 'wide go']].forEach(function (x) { var b = document.createElement('button'); b.dataset.k = x[0]; b.className = x[3]; b.textContent = L(x[1], x[2]); b.dataset.en = x[2]; pad.appendChild(b); });
  var lp = null;
  pad.addEventListener('pointerdown', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var k = b.dataset.k; lp = { k: k, long: false, t: setTimeout(function () { if (k.length === 1) { lp.long = true; notes[k] = !notes[k]; navigator.vibrate && navigator.vibrate(15); render(); } }, 450) }; });
  pad.addEventListener('pointerup', function (e) { if (!lp) return; clearTimeout(lp.t); var p = lp; lp = null; if (!p.long) press(p.k); });
  pad.addEventListener('pointerleave', function () { if (lp) { clearTimeout(lp.t); lp = null; } });
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); var b = e.target.closest('[data-k]'); if (b && b.dataset.k.length === 1) { notes[b.dataset.k] = !notes[b.dataset.k]; render(); } });
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('go'); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這題', 'Tap again to give up')); return; } if (S && S.started && !S.over) K.toast(L('答案是 ', 'The answer was ') + S.ans, 2000); newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (location.hash.indexOf('#test') === 0) window.__ab = { S: function () { return S; }, press: press };
  newGame();
})();
