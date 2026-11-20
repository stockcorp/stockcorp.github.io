/* 21 點 — stockcorp.github.io/blackjack/
   6 副牌牌靴（剩不到 1/4 自動重洗）；莊家 17 點（含軟 17）停牌；Blackjack 賠 3:2；可加倍、分牌一次。
   1000 虛擬籌碼打 20 手；排行榜 mode = 20hands，剩下的籌碼越多越好。 */
(function () {
  'use strict';
  var GAME = 'blackjack', $ = K.$, L = K.L, HANDS = 20;
  var SU = ['♠', '♥', '♣', '♦'], RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var S = null, shoe = [], gen = 0;
  function rk(c) { return c % 13 + 1; } function su(c) { return ((c / 13) | 0) % 4; }
  function cv(c) { var r = rk(c); return r === 1 ? 11 : r > 10 ? 10 : r; }
  function total(cs) { var t = 0, a = 0; cs.forEach(function (c) { t += cv(c); if (rk(c) === 1) a++; }); while (t > 21 && a) { t -= 10; a--; } return { t: t, soft: a > 0 }; }
  function isBJ(cs) { return cs.length === 2 && total(cs).t === 21; }
  function draw() { if (shoe.length < 78) { shoe = K.shuffle(Array.from({ length: 312 }, function (_, i) { return i % 52; })); K.toast(L('重新洗牌', 'Shuffling the shoe'), 1000); } return shoe.pop(); }

  function newGame() {
    gen++;
    S = { chips: 1000, hand: 0, bet: 0, lastBet: 50, wins: 0, phase: 'bet', dealer: [], hands: [], act: 0, started: false, over: false };
    shoe = []; K.close('ovEnd');
    if (window.SCLB) SCLB.start(GAME, '20hands'); if (window.SC) SC.post('start', { game: GAME });
    msg(L('下注後按「發牌」', 'Place a bet and press Deal')); render();
  }
  function msg(t) { $('msg').textContent = t || ''; }
  function addBet(v) { if (S.phase !== 'bet') return; var n = Math.min(S.chips, S.bet + v); if (n === S.bet) { K.toast(L('籌碼不夠', 'Not enough chips'), 900); return; } S.bet = n; K.beep(900, 0.03, 'square', 0.02); render(); }
  function deal() {
    if (S.phase !== 'bet') return;
    if (!S.bet) S.bet = Math.min(S.lastBet, S.chips);
    if (!S.bet) return;
    S.lastBet = S.bet; S.chips -= S.bet; S.hand++; S.started = true;
    S.dealer = [draw(), draw()]; S.hands = [{ cs: [draw(), draw()], bet: S.bet, done: false, dbl: false, split: false }]; S.act = 0; S.phase = 'play';
    msg(''); render(); K.beep(600, 0.04, 'triangle', 0.04);
    var g = gen;
    if (isBJ(S.dealer) || isBJ(S.hands[0].cs)) { setTimeout(function () { if (g === gen) dealerPlay(); }, 600); }
  }
  function cur() { return S.hands[S.act]; }
  function hit() {
    if (S.phase !== 'play') return; var h = cur(); h.cs.push(draw()); K.beep(600, 0.04, 'triangle', 0.04);
    var t = total(h.cs).t;
    if (t > 21) { msg(L('爆牌！', 'Bust!')); h.done = true; nextHand(); }
    else if (t === 21) { h.done = true; nextHand(); }
    else render();
  }
  function stand() { if (S.phase !== 'play') return; cur().done = true; nextHand(); }
  function dbl() {
    var h = cur(); if (S.phase !== 'play' || h.cs.length !== 2 || S.chips < h.bet) return;
    S.chips -= h.bet; h.bet *= 2; h.dbl = true; h.cs.push(draw()); h.done = true; K.beep(700, 0.06, 'triangle', 0.05);
    if (total(h.cs).t > 21) msg(L('爆牌！', 'Bust!'));
    nextHand();
  }
  function split() {
    var h = cur(); if (S.phase !== 'play' || S.hands.length > 1 || h.cs.length !== 2 || cv(h.cs[0]) !== cv(h.cs[1]) || S.chips < h.bet) return;
    S.chips -= h.bet;
    var h2 = { cs: [h.cs.pop(), draw()], bet: h.bet, done: false, split: true }; h.cs.push(draw()); h.split = true;
    S.hands.push(h2);
    // 分開的 A 只各拿一張
    if (rk(h.cs[0]) === 1) { h.done = true; h2.done = true; return nextHand(); }
    render();
  }
  function nextHand() {
    render();
    var i = S.hands.findIndex(function (h) { return !h.done; });
    if (i >= 0) { S.act = i; render(); return; }
    var g = gen; S.phase = 'dealer'; render();
    setTimeout(function () { if (g === gen) dealerPlay(); }, 500);
  }
  function dealerPlay() {
    S.phase = 'dealer'; render();
    var g = gen, allBust = S.hands.every(function (h) { return total(h.cs).t > 21; });
    var stepD = function () {
      if (g !== gen) return;
      var t = total(S.dealer);
      if (!allBust && !isBJ(S.hands[0].cs) && t.t < 17) { S.dealer.push(draw()); K.beep(500, 0.04, 'triangle', 0.04); render(); setTimeout(stepD, 550); return; }
      settle();
    };
    setTimeout(stepD, 400);
  }
  function settle() {
    var d = total(S.dealer).t, dBJ = isBJ(S.dealer), net = 0, res = [];
    S.hands.forEach(function (h) {
      var t = total(h.cs).t, bj = isBJ(h.cs) && !h.split, pay = 0;
      if (t > 21) { pay = 0; res.push(L('爆牌', 'Bust')); }
      else if (bj && !dBJ) { pay = h.bet * 2.5; res.push('Blackjack!'); }
      else if (dBJ && !bj) { pay = 0; res.push(L('莊家 Blackjack', 'Dealer Blackjack')); }
      else if (d > 21 || t > d) { pay = h.bet * 2; res.push(L('贏', 'Win')); }
      else if (t === d) { pay = h.bet; res.push(L('平手', 'Push')); }
      else { pay = 0; res.push(L('輸', 'Lose')); }
      net += pay - h.bet; S.chips += pay; if (pay > h.bet) S.wins++;
    });
    S.chips = Math.round(S.chips);
    msg(res.join(' / ') + (net ? '（' + (net > 0 ? '+' : '') + Math.round(net) + '）' : ''));
    K.beep(net > 0 ? 880 : net < 0 ? 220 : 500, 0.2, 'triangle', 0.06, net > 0 ? 1320 : undefined);
    var fe = document.querySelector('.felt'); if (net > 0) { K.tune([660, 880, 1320], 70); K.float(fe, '+' + Math.round(net), '#fde047', 34); K.burst(fe, { n: net >= 150 ? 50 : 24, c: ['#fde047', '#fbbf24', '#fff'], size: 6, sp: 280, star: net >= 150 }); if (net >= 300) K.confetti(70); } else if (net < 0) { K.float(fe, String(Math.round(net)), '#f87171', 28); K.shake(fe, 6); }
    S.phase = 'bet'; S.bet = 0;
    if (S.hand >= HANDS || S.chips <= 0) { S.phase = 'over'; render(); return setTimeout(finish, 900); }
    render();
  }
  function finish() {
    S.over = true;
    var best = K.load('scbj_best', 0), nb = S.chips > best; if (nb) K.save('scbj_best', S.chips);
    $('endChips').textContent = S.chips.toLocaleString(); $('endWins').textContent = S.wins;
    $('endTitle').textContent = S.chips <= 0 ? L('籌碼輸光了', 'Out of chips') : L('20 手結束', '20 hands done');
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    if (window.SC) SC.post('gameover', { game: GAME, score: S.chips });
    K.open('ovEnd');
    if (S.chips > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: '20hands', score: S.chips, text: L('贏 ', 'Won ') + S.wins + L(' 手', ' hands') });
  }

  function cardEl(c, down) { var d = document.createElement('div'); d.className = 'c' + (down ? ' dn' : su(c) % 2 ? ' r' : ''); d.innerHTML = '<div class="tl">' + RK[rk(c)] + '<br>' + SU[su(c)] + '</div><div class="mid">' + SU[su(c)] + '</div>'; return d; }
  function render() {
    $('chips').textContent = S.chips.toLocaleString(); $('handNo').textContent = Math.min(HANDS, Math.max(1, S.hand + (S.phase === 'bet' ? 1 : 0)));
    $('betShow').textContent = S.phase === 'bet' ? L('下注 ', 'Bet ') + S.bet : '';
    var hide = S.phase === 'play', dr = $('dealer'); dr.innerHTML = '';
    S.dealer.forEach(function (c, i) { dr.appendChild(cardEl(c, hide && i === 1)); });
    $('dTot').textContent = S.dealer.length ? (hide ? cv(S.dealer[0]) + ' + ?' : total(S.dealer).t) : '';
    var mine = $('mine'); mine.innerHTML = '';
    S.hands.forEach(function (h, i) {
      var box = document.createElement('div'); box.className = 'hd' + (S.phase === 'play' && i === S.act && S.hands.length > 1 ? ' act' : '');
      var t = total(h.cs);
      box.innerHTML = '<div class="who">' + L('你', 'You') + (S.hands.length > 1 ? ' #' + (i + 1) : '') + ' <b>' + t.t + (t.soft && t.t < 21 ? L('（軟）', ' (soft)') : '') + '</b>・' + L('注 ', 'bet ') + h.bet + '</div>';
      var row = document.createElement('div'); row.className = 'row'; h.cs.forEach(function (c) { row.appendChild(cardEl(c)); }); box.appendChild(row); mine.appendChild(box);
    });
    var bet = S.phase === 'bet';
    $('betBar').style.display = bet ? '' : 'none'; $('playBar').style.display = S.phase === 'play' ? '' : 'none';
    [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.disabled = S.bet >= S.chips; });
    $('bDeal').textContent = S.bet ? L('發牌', 'Deal') : L('發牌（上次 ' + Math.min(S.lastBet, S.chips) + '）', 'Deal (' + Math.min(S.lastBet, S.chips) + ')');
    if (S.phase === 'play') { var h = cur(); $('bDouble').disabled = h.cs.length !== 2 || S.chips < h.bet; $('bSplit').disabled = S.hands.length > 1 || h.cs.length !== 2 || cv(h.cs[0]) !== cv(h.cs[1]) || S.chips < h.bet; }
  }
  [].forEach.call(document.querySelectorAll('.chip'), function (b) { b.onclick = function () { addBet(+b.dataset.v); }; });
  $('bClr').onclick = function () { if (S.phase === 'bet') { S.bet = 0; render(); } };
  $('bDeal').onclick = deal; $('bHit').onclick = hit; $('bStand').onclick = stand; $('bDouble').onclick = dbl; $('bSplit').onclick = split;
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; var k = e.key.toLowerCase(); if (k === 'h') hit(); else if (k === 's') stand(); else if (k === 'd') { if (S.phase === 'bet') deal(); else dbl(); } else if (k === 'p') split(); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次重新開始', 'Tap again to restart')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  if (window.SC) SC.onLang(function () { if (S) render(); });
  if (location.hash.indexOf('#fast') >= 0) { var st = window.setTimeout; window.setTimeout = function (f, t) { return st(f, Math.min(t || 0, 5)); }; }
  if (location.hash.indexOf('#test') === 0) window.__bj = { S: function () { return S; }, auto: function () { var f = function () { if (S.over) return; if (S.phase === 'bet') { S.bet = Math.min(50, S.chips); deal(); } else if (S.phase === 'play') { var h = cur(); if (cv(h.cs[0]) === cv(h.cs[1]) && h.cs.length === 2 && S.hands.length === 1 && S.chips >= h.bet) split(); else if (total(h.cs).t === 11 && h.cs.length === 2 && S.chips >= h.bet) dbl(); else if (total(h.cs).t < 17) hit(); else stand(); } setTimeout(f, 10); }; f(); } };
  newGame();
})();
