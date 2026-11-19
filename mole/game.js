/* 打地鼠 — stockcorp.github.io/mole/
   3×3 洞、60 秒；🐹 10 分、👑 30 分、💣 -30；連擊每下 +2（上限 +10）。越後面越快。
   排行榜：mode = 60s，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'mole', $ = K.$, L = K.L, DUR = 60;
  var KEYMAP = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
  var field = $('field'), holes = [], S = null, timer = 0;
  for (var i = 0; i < 9; i++) {
    var h = document.createElement('div'); h.className = 'hole'; h.innerHTML = '<div class="clip"><div class="mole"></div></div><div class="pts"></div>';
    (function (idx) { h.addEventListener('pointerdown', function (e) { e.preventDefault(); whack(idx); }); })(i);
    field.appendChild(h); holes.push({ el: h, m: h.querySelector('.mole'), p: h.querySelector('.pts'), kind: null, until: 0, tm: 0 });
  }
  function reset() {
    holes.forEach(function (o) { clearTimeout(o.tm); o.kind = null; o.el.classList.remove('up', 'hit'); });
    clearTimeout(timer);
  }
  function start() {
    reset();
    S = { score: 0, hits: 0, combo: 0, best: 0, t0: Date.now(), on: true };
    $('score').textContent = 0; $('combo').textContent = ''; K.close('ovEnd');
    $('bNew').textContent = L('重新開始', 'Restart');
    if (window.SCLB) SCLB.start(GAME, '60s'); if (window.SC) SC.post('start', { game: GAME });
    K.beep(660, 0.12, 'triangle', 0.06, 990);
    spawn(); tick();
  }
  function left() { return Math.max(0, DUR - (Date.now() - S.t0) / 1000); }
  function tick() { if (!S || !S.on) return; var l = left(); $('clock').textContent = Math.ceil(l); if (l <= 0) return end(); requestAnimationFrame(tick); }
  function spawn() {
    if (!S || !S.on) return;
    var prog = 1 - left() / DUR, stay = 1100 - prog * 550, gap = 650 - prog * 380;
    var free = holes.filter(function (o) { return !o.kind; });
    var n = prog > 0.5 && Math.random() < 0.35 ? 2 : 1;
    K.shuffle(free).slice(0, n).forEach(function (o) {
      var r = Math.random(), kind = r < 0.1 ? 'gold' : r < 0.1 + 0.08 + prog * 0.08 ? 'bomb' : 'mole';
      o.kind = kind; o.m.textContent = kind === 'gold' ? '👑' : kind === 'bomb' ? '💣' : '🐹';
      o.el.classList.remove('hit'); o.el.classList.add('up');
      o.tm = setTimeout(function () { if (o.kind && !o.hitNow) { if (o.kind !== 'bomb') breakCombo(); o.kind = null; o.el.classList.remove('up'); } }, kind === 'gold' ? stay * 0.75 : stay);
    });
    timer = setTimeout(spawn, gap * (0.75 + Math.random() * 0.5));
  }
  function breakCombo() { if (S && S.combo) { S.combo = 0; $('combo').textContent = ''; } }
  function show(o, txt, neg) { o.p.textContent = txt; o.p.classList.remove('on', 'neg'); void o.p.offsetWidth; o.p.classList.add('on'); if (neg) o.p.classList.add('neg'); }
  function whack(idx) {
    if (!S || !S.on) return;
    var o = holes[idx];
    if (!o.kind) { breakCombo(); K.beep(140, 0.04, 'square', 0.02); return; }
    var kind = o.kind; o.kind = null; clearTimeout(o.tm);
    o.el.classList.add('hit');
    setTimeout(function () { o.el.classList.remove('up'); }, 160);
    if (kind === 'bomb') {
      S.score = Math.max(0, S.score - 30); breakCombo(); show(o, '-30', true);
      K.beep(90, 0.35, 'sawtooth', 0.07, 40); navigator.vibrate && navigator.vibrate([60, 30, 60]);
    } else {
      S.combo++; S.best = Math.max(S.best, S.combo); S.hits++;
      var pts = (kind === 'gold' ? 30 : 10) + Math.min(10, (S.combo - 1) * 2);
      S.score += pts; show(o, '+' + pts);
      K.beep(kind === 'gold' ? 1100 : 700 + Math.min(S.combo, 10) * 30, 0.06, 'triangle', 0.05); navigator.vibrate && navigator.vibrate(12);
      $('combo').textContent = S.combo >= 2 ? L('連擊 ×', 'Combo ×') + S.combo : '';
    }
    $('score').textContent = S.score;
  }
  function end() {
    S.on = false; reset(); $('clock').textContent = 0; $('bNew').textContent = L('開始', 'Start');
    var best = K.load('scmole_best', 0), nb = S.score > best; if (nb) K.save('scmole_best', S.score);
    $('endScore').textContent = S.score; $('endHits').textContent = S.hits; $('endCombo').textContent = '×' + S.best;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best;
    K.beep(523, 0.5, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: '60s', score: S.score, text: L('命中 ', 'Hits ') + S.hits + L('・最高連擊 ×', ' · best combo ×') + S.best }); }, 400);
  }
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; var k = KEYMAP[e.key]; if (k !== undefined) { e.preventDefault(); whack(k); } });
  $('bNew').onclick = function () {
    if (S && S.on && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次重新開始', 'Tap again to restart')); return; }
    start();
  };
  $('bAgain').onclick = start;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (location.hash.indexOf('#test') === 0) window.__ml = { S: function () { return S; }, start: start, holes: holes, whack: whack, end: function () { S.t0 = Date.now() - DUR * 1000; } };
  K.toast(L('按「開始」開始 60 秒挑戰', 'Press Start to begin the 60-second challenge'), 2500);
})();
