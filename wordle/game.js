/* 猜單字 — stockcorp.github.io/wordle/
   六次猜出五個字母的英文單字。排行榜：mode = classic，從第一次猜到猜中的時間（伺服器計時）。 */
(function () {
  'use strict';
  var GAME = 'wordle', $ = K.$, L = K.L;
  var ANS = window.WORDS.A.split(' '), VALID = {}; window.WORDS.V.split(' ').forEach(function (w) { VALID[w] = 1; });
  var S = null, tick = null, ROWS = ['qwertyuiop', 'asdfghjkl', 'ENTERzxcvbnmDEL'];
  function newGame() {
    var recent = K.load('scwordle_recent', []), ans;
    do { ans = ANS[(Math.random() * ANS.length) | 0]; } while (recent.indexOf(ans) >= 0);
    recent.push(ans); if (recent.length > 200) recent.shift(); K.save('scwordle_recent', recent);
    S = { ans: ans, rows: [], cur: '', keys: {}, started: false, over: false, t0: 0 };
    clearInterval(tick); $('clock').textContent = '0:00'; K.close('ovEnd'); build(); render();
    var st = K.load('scwordle_streak', 0); $('streak').textContent = st ? L('連勝 ', 'Streak ') + st : '';
  }
  function build() {
    var g = $('grid'); g.innerHTML = '';
    for (var r = 0; r < 6; r++) { var row = document.createElement('div'); row.className = 'row'; for (var c = 0; c < 5; c++) row.appendChild(document.createElement('i')); g.appendChild(row); }
    var kb = $('kb'); kb.innerHTML = '';
    ROWS.forEach(function (s) {
      var d = document.createElement('div'), keys = s.match(/ENTER|DEL|[a-z]/g);
      keys.forEach(function (k) { var b = document.createElement('button'); b.dataset.k = k; b.textContent = k === 'DEL' ? '⌫' : k === 'ENTER' ? 'Enter' : k; if (k.length > 1) b.className = 'wide'; d.appendChild(b); });
      kb.appendChild(d);
    });
  }
  function judge(g) {
    var a = S.ans.split(''), res = ['n', 'n', 'n', 'n', 'n'];
    for (var i = 0; i < 5; i++) if (g[i] === a[i]) { res[i] = 'g'; a[i] = null; }
    for (i = 0; i < 5; i++) if (res[i] !== 'g') { var j = a.indexOf(g[i]); if (j >= 0) { res[i] = 'y'; a[j] = null; } }
    return res;
  }
  function key(k) {
    if (!S || S.over) return;
    if (k === 'DEL') S.cur = S.cur.slice(0, -1);
    else if (k === 'ENTER') return submit();
    else if (S.cur.length < 5) { S.cur += k; K.beep(700, 0.02, 'sine', 0.02); }
    render();
  }
  function shake(t) { var row = $('grid').children[S.rows.length]; row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); K.toast(t, 1100); }
  function submit() {
    if (S.cur.length < 5) return shake(L('要五個字母', 'Not enough letters'));
    if (!VALID[S.cur]) return shake(L('字庫裡沒有這個單字', 'Not in word list'));
    if (!S.started) { S.started = true; S.t0 = Date.now(); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); tick = setInterval(function () { if (!S.over) $('clock').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); }, 500); }
    var res = judge(S.cur); S.rows.push([S.cur, res]);
    var rank = { n: 1, y: 2, g: 3 };
    S.cur.split('').forEach(function (ch, i) { if (!S.keys[ch] || rank[res[i]] > rank[S.keys[ch]]) S.keys[ch] = res[i]; });
    var word = S.cur; S.cur = '';
    render();
    K.beep(res.every(function (x) { return x === 'g'; }) ? 880 : 500, 0.08, 'triangle', 0.04);
    if (word === S.ans) return win();
    if (S.rows.length === 6) lose();
  }
  function win() {
    S.over = true; clearInterval(tick);
    var t = Math.floor((Date.now() - S.t0) / 1000), best = K.load('scwordle_best', 0), nb = !best || t < best; if (nb) K.save('scwordle_best', t);
    K.save('scwordle_streak', K.load('scwordle_streak', 0) + 1);
    $('endEmoji').textContent = '🟩'; $('endTitle').textContent = L('猜中了！', 'Solved!');
    $('endTime').textContent = K.fmtTime(t); $('endTries').textContent = S.rows.length + '/6';
    $('endBest').textContent = (nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + K.fmtTime(best)) + '　' + S.ans.toUpperCase();
    K.beep(523, 0.5, 'triangle', 0.07, 1046);
    if (window.SC) SC.post('gameover', { game: GAME, win: true, sec: t });
    setTimeout(function () { K.open('ovEnd'); if (window.SCLB) { var sec = SCLB.elapsed(GAME) || t; SCLB.offer({ game: GAME, mode: 'classic', score: sec, text: S.rows.length + L(' 次猜中', ' tries') }); } }, 1500);
  }
  function lose() {
    S.over = true; clearInterval(tick); K.save('scwordle_streak', 0);
    $('endEmoji').textContent = '📖'; $('endTitle').textContent = L('答案是 ', 'The word was ') + S.ans.toUpperCase();
    $('endTime').textContent = K.fmtTime(Math.floor((Date.now() - S.t0) / 1000)); $('endTries').textContent = '6/6'; $('endBest').textContent = '';
    K.beep(220, 0.4, 'sawtooth', 0.05, 110);
    setTimeout(function () { K.open('ovEnd'); }, 1400);
  }
  function render() {
    var g = $('grid').children;
    for (var r = 0; r < 6; r++) {
      var cells = g[r].children, word = r < S.rows.length ? S.rows[r][0] : r === S.rows.length ? S.cur : '', res = r < S.rows.length ? S.rows[r][1] : null;
      for (var c = 0; c < 5; c++) { var e = cells[c]; e.textContent = word[c] || ''; e.className = res ? res[c] : word[c] ? 'f' : ''; if (res) e.style.animationDelay = c * 0.12 + 's'; }
    }
    [].forEach.call($('kb').querySelectorAll('button'), function (b) { var k = b.dataset.k; b.className = (k.length > 1 ? 'wide ' : '') + (S.keys[k] || ''); });
  }
  $('kb').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) key(b.dataset.k); });
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen() || e.ctrlKey || e.metaKey) return; if (/^[a-zA-Z]$/.test(e.key)) key(e.key.toLowerCase()); else if (e.key === 'Enter') key('ENTER'); else if (e.key === 'Backspace') key('DEL'); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這題', 'Tap again to give up')); return; } if (S && S.started && !S.over) { K.save('scwordle_streak', 0); K.toast(L('答案是 ', 'The word was ') + S.ans.toUpperCase(), 2000); } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (location.hash.indexOf('#test') === 0) window.__wd = { S: function () { return S; }, key: key };
  newGame();
})();
