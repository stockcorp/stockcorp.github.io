/* 記憶翻牌 — stockcorp.github.io/memory/
   排行榜：mode = 4x4/6x6，完成時間（伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'memory', $ = K.$, L = K.L;
  var POOL = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐔', '🐧', '🦉', '🦄', '🐙', '🐢', '🐳', '🦋', '🍎', '🍌', '🍇', '🍓', '🍉', '🍒', '⚽', '🎈', '🚗', '🚀', '⭐', '🌈'];
  var S = null, tick = null;
  function newGame(sz) {
    sz = sz || '4x4'; var n = parseInt(sz, 10), pairs = n * n / 2, pics = K.shuffle(POOL.slice()).slice(0, pairs);
    S = { sz: sz, n: n, cards: K.shuffle(pics.concat(pics)), up: [], ok: {}, flips: 0, found: 0, streak: 0, total: pairs, lock: false, started: false, over: false, t0: 0 };
    clearInterval(tick); $('clock').textContent = '0:00'; $('flips').textContent = 0; $('pairs').textContent = 0; $('total').textContent = pairs;
    K.close('ovEnd'); K.save('scmem_sz', sz); $('bLb').href = '/leaderboard/?game=memory&mode=' + sz; $('sub').textContent = sz.replace('x', '×');
    var g = $('grid'); g.innerHTML = ''; g.style.gridTemplateColumns = 'repeat(' + n + ',1fr)'; g.className = 'grid' + (n > 4 ? ' g6' : '');
    S.cards.forEach(function (p, i) { var d = document.createElement('div'); d.className = 'cd'; d.style.setProperty('--i', i); d.innerHTML = '<i class="bk"></i><i class="fr">' + p + '</i>'; d.onclick = function () { flip(i); }; g.appendChild(d); });
  }
  function el(i) { return $('grid').children[i]; }
  function flip(i) {
    if (!S || S.over || S.lock || S.ok[i] || S.up.indexOf(i) >= 0) return;
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, S.sz); if (window.SC) SC.post('start', { game: GAME, level: S.sz }); tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
    S.up.push(i); el(i).classList.add('up'); S.flips++; $('flips').textContent = S.flips; K.beep(600, 0.03, 'sine', 0.03);
    if (S.up.length < 2) return;
    var a = S.up[0], b = S.up[1];
    if (S.cards[a] === S.cards[b]) {
      S.ok[a] = S.ok[b] = 1; S.up = []; S.found++; $('pairs').textContent = S.found;
      [a, b].forEach(function (k) { el(k).classList.remove('up'); el(k).classList.add('ok'); });
      S.streak++; K.tune([660 + S.streak * 60, 880 + S.streak * 80], 80); K.buzz(10);
      setTimeout(function () { [a, b].forEach(function (k) { K.burst(el(k), { n: 12, star: 1, c: ['#fde047', '#86efac', '#fff'], size: 6, sp: 150 }); }); if (S.streak >= 2) K.float(el(b), L('連續 ×', 'Streak ×') + S.streak, '#fde047', 20); }, 260);
      if (S.found === S.total) win();
    } else {
      S.lock = true; S.streak = 0;
      setTimeout(function () { [a, b].forEach(function (k) { el(k).classList.add('no'); }); K.beep(180, 0.12, 'sawtooth', 0.03); }, 330);
      setTimeout(function () { [a, b].forEach(function (k) { el(k).classList.remove('up'); el(k).classList.remove('no'); }); S.up = []; S.lock = false; }, 800);
    }
  }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scmem_best', {}), nb = !best[S.sz] || t < best[S.sz];
    if (nb) { best[S.sz] = t; K.save('scmem_best', best); }
    $('endTime').textContent = K.fmtTime(t); $('endFlips').textContent = S.flips;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best[S.sz]);
    K.tune([523, 659, 784, 1047, 1319], 95);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: S.sz, score: sec, text: S.flips + L(' 次翻牌', ' flips') }); } }, 700);
  }
  $('bNew').onclick = function () { K.open('ovNew'); };
  $('lvChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; K.close('ovNew'); newGame(b.dataset.m); });
  $('bAgain').onclick = function () { K.close('ovEnd'); newGame(S.sz); };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (location.hash.indexOf('#test') === 0) window.__mm = { S: function () { return S; }, flip: flip };
  newGame(K.load('scmem_sz', '4x4'));
})();
