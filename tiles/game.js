/* 別踩白塊 — stockcorp.github.io/tiles/
   經典模式：50 塊黑塊，點對的那塊整盤往下移一排。排行榜：mode = 50，完成時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'tiles', $ = K.$, L = K.L, TOTAL = 50, VIS = 6;
  var NOTES = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784];
  var MEL = [7, 7, 9, 7, 11, 10, 7, 7, 9, 7, 12, 11, 7, 7, 14, 12, 11, 10, 9, 15, 15, 14, 11, 12, 11, 4, 4, 5, 4, 7, 6, 4, 4, 5, 4, 8, 7, 4, 4, 9, 7, 6, 5, 3, 11, 11, 10, 7, 8, 7];
  var st = $('stage'), S = null, raf = 0;
  function newGame() {
    cancelAnimationFrame(raf);
    S = { cols: [], idx: 0, started: false, over: false, t0: 0 };
    for (var i = 0; i < TOTAL; i++) S.cols.push((Math.random() * 4) | 0);
    $('clock').textContent = '0.000'; $('left').textContent = TOTAL; $('spd').textContent = '0.0'; st.style.setProperty('--p', '0%'); K.close('ovEnd'); render();
  }
  function render() {
    st.innerHTML = '';
    for (var k = 0; k < VIS; k++) {
      var r = S.idx - 1 + k, row = document.createElement('div'); row.className = 'row'; row.style.bottom = (k * 25 - 25) + '%';
      if (r >= TOTAL) { row.className = 'row fin'; for (var c = 0; c < 4; c++) row.appendChild(document.createElement('i')); st.appendChild(row); continue; }
      for (c = 0; c < 4; c++) {
        var e = document.createElement('i'); if (r >= 0 && S.cols[r] === c) { e.className = r < S.idx ? 'done' : 'k'; e.style.setProperty('--h', 200 + r * 3.2); if (r === 0 && !S.started) { e.className += ' start'; e.dataset.t = L('開始', 'Start'); } }
        e.dataset.r = r; e.dataset.c = c; row.appendChild(e);
      }
      st.appendChild(row);
    }
  }
  function hit(c) {
    if (!S || S.over) return;
    if (S.cols[S.idx] !== c) return fail(c);
    if (!S.started) { S.started = true; S.t0 = performance.now(); if (window.SCLB) SCLB.start(GAME, '50'); if (window.SC) SC.post('start', { game: GAME }); tickClock(); }
    var n = NOTES[MEL[S.idx % MEL.length] % NOTES.length]; K.beep(n, 0.2, 'triangle', 0.07); K.beep(n / 2, 0.22, 'sine', 0.04);
    var cur = st.children[1] && st.children[1].children[c], hue = 200 + S.idx * 3.2;
    if (cur) K.burst(cur, { n: 7, c: ['hsl(' + hue + ',90%,65%)', '#fff'], size: 4, sp: 130, life: 0.4 });
    S.idx++; $('left').textContent = TOTAL - S.idx; render();
    st.style.setProperty('--p', (S.idx / TOTAL * 100) + '%');
    [].forEach.call(st.children, function (r) { if (r.animate) r.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 85, easing: 'ease-out' }); });
    var el = (performance.now() - S.t0) / 1000; if (S.idx > 3 && el > 0) $('spd').textContent = (S.idx / el).toFixed(1);
    if (S.idx >= TOTAL) win();
  }
  function tickClock() { if (!S || S.over || !S.started) return; $('clock').textContent = ((performance.now() - S.t0) / 1000).toFixed(3); raf = requestAnimationFrame(tickClock); }
  function fail(c) {
    S.over = true; cancelAnimationFrame(raf);
    var row = st.children[1]; if (row && row.children[c]) row.children[c].classList.add('bad');
    K.beep(110, 0.5, 'sawtooth', 0.08, 55); navigator.vibrate && navigator.vibrate(120); K.shake(st, 10); if (row && row.children[c]) K.burst(row.children[c], { n: 22, c: ['#ef4444', '#fca5a5', '#fff'], sp: 240, size: 5 });
    setTimeout(function () {
      $('endEmoji').textContent = '💥'; $('endTitle').textContent = L('踩到白塊了！', 'You hit a white tile!');
      $('endTime').textContent = S.idx + '/' + TOTAL; $('endSpeed').textContent = '—'; $('endBest').textContent = '';
      K.open('ovEnd');
    }, 700);
  }
  function win() {
    S.over = true; cancelAnimationFrame(raf);
    var t = (performance.now() - S.t0) / 1000; $('clock').textContent = t.toFixed(3);
    var best = K.load('sctiles_best', 0), nb = !best || t < best; if (nb) K.save('sctiles_best', t);
    $('endEmoji').textContent = '🎹'; $('endTitle').textContent = L('完成 50 塊！', '50 tiles done!');
    $('endTime').textContent = t.toFixed(3) + L(' 秒', 's'); $('endSpeed').textContent = (TOTAL / t).toFixed(2);
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toFixed(3) + L(' 秒', 's');
    K.tune([523, 659, 784, 1047, 1319], 95);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: '50', score: sec, text: (TOTAL / t).toFixed(2) + L(' 塊/秒', ' tiles/s') }); } }, 400);
  }
  st.addEventListener('pointerdown', function (e) {
    e.preventDefault(); var t = e.target.closest('i'); if (!t || t.dataset.r === undefined) return;
    var r = +t.dataset.r, c = +t.dataset.c;
    if (r < S.idx) return;
    if (r !== S.idx) { if (S.cols[r] === c) return; return fail(c); }
    hit(c);
  });
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen() || e.repeat) return; var c = { d: 0, f: 1, j: 2, k: 3 }[e.key.toLowerCase()]; if (c !== undefined) hit(c); });
  $('bNew').onclick = newGame; $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (window.SC) SC.onLang(function () { if (S && !S.started) render(); });
  if (location.hash.indexOf('#test') === 0) window.__tl = { S: function () { return S; }, hit: hit };
  newGame();
})();
