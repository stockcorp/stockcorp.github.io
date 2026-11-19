/* 黃金礦工 — stockcorp.github.io/miner/
   邏輯 480×560。每關 60 秒，目標：650、1195、1740…（+545/關，第 6 關起 +800）。
   物件：小/中/大金塊、鑽石、小/大石頭、神秘袋。拉回速度 = 基本速度 ÷ 重量（力量藥水 ×1.6）。
   排行榜：mode = classic，總金額越高越好。 */
(function () {
  'use strict';
  var GAME = 'miner', $ = K.$, L = K.L, W = 480, H = 560, OX = 240, OY = 74, DUR = 60;
  var T = { g1: { r: 12, v: 50, w: 1.2, c: '#facc15' }, g2: { r: 22, v: 150, w: 2.4, c: '#facc15' }, g3: { r: 38, v: 500, w: 5.2, c: '#facc15' }, dia: { r: 9, v: 600, w: 0.8, c: '#a5f3fc' }, r1: { r: 18, v: 20, w: 3.5, c: '#78716c' }, r2: { r: 30, v: 11, w: 6.5, c: '#57534e' }, bag: { r: 16, v: 0, w: 1.4, c: '#a16207' } };
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0;
  function target(lv) { return lv <= 5 ? 650 + (lv - 1) * 545 : 2830 + (lv - 5) * 800; }
  function newGame() { S = { money: 0, level: 0, tnt: 0, strong: 0, over: false, started: false }; K.close('ovEnd'); nextLevel(); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); }
  function nextLevel() {
    S.level++; S.t0 = performance.now(); S.left = DUR; S.items = []; S.ang = 0; S.dir = 1; S.state = 'swing'; S.len = 30; S.got = null; S.pop = [];
    var lv = S.level, plan = [['g1', 4], ['g2', 3], ['g3', lv >= 2 ? 2 : 1], ['dia', Math.min(4, lv - 1)], ['r1', 3 + Math.min(3, lv)], ['r2', 2 + Math.min(3, lv >> 1)], ['bag', 2]];
    plan.forEach(function (p) { for (var i = 0; i < p[1]; i++) place(p[0]); });
    $('level').textContent = lv; $('target').textContent = target(lv).toLocaleString(); hud();
    $('msg').textContent = L('第 ' + lv + ' 關　目標 $', 'Level ' + lv + ' · target $') + target(lv); setTimeout(function () { $('msg').textContent = ''; }, 1600);
  }
  function place(k) {
    var t = T[k];
    for (var tries = 0; tries < 60; tries++) {
      var x = 30 + Math.random() * (W - 60), y = 170 + Math.random() * (H - 200);
      if (k === 'dia' || k === 'g3') y = 300 + Math.random() * (H - 330);
      if (S.items.every(function (o) { return Math.hypot(o.x - x, o.y - y) > o.r + t.r + 8; })) { S.items.push({ k: k, x: x, y: y, r: t.r, v: t.v, w: t.w }); return; }
    }
  }
  function hud() { $('money').textContent = S.money.toLocaleString(); $('tnt').textContent = S.tnt; }
  function fire() { if (!S || S.over || S.state !== 'swing') return; S.state = 'out'; K.beep(300, 0.06, 'square', 0.03); if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); } }
  function tnt() { if (!S || S.state !== 'in' || !S.got || S.tnt <= 0) return; S.tnt--; var g = S.got; S.got = null; S.pop.push({ x: g.x, y: g.y, t: 0.5, txt: '💥' }); K.beep(80, 0.4, 'sawtooth', 0.08, 40); hud(); }
  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    if (!S.over) step(dt);
    draw(); raf = requestAnimationFrame(loop);
  }
  function hookPos() { return [OX + Math.sin(S.ang) * S.len, OY + Math.cos(S.ang) * S.len]; }
  function step(dt) {
    S.left = Math.max(0, DUR - (performance.now() - S.t0) / 1000); $('clock').textContent = Math.ceil(S.left);
    S.pop.forEach(function (p) { p.t -= dt; p.y -= 30 * dt; }); S.pop = S.pop.filter(function (p) { return p.t > 0; });
    if (S.state === 'swing') {
      S.ang += S.dir * dt * 1.45; if (S.ang > 1.25) { S.ang = 1.25; S.dir = -1; } if (S.ang < -1.25) { S.ang = -1.25; S.dir = 1; }
      if (S.left <= 0) return endLevel();
    } else if (S.state === 'out') {
      S.len += 430 * dt; var p = hookPos();
      if (p[0] < 0 || p[0] > W || p[1] > H) { S.state = 'in'; return; }
      for (var i = 0; i < S.items.length; i++) { var o = S.items[i]; if (Math.hypot(o.x - p[0], o.y - p[1]) < o.r + 6) { S.got = o; S.items.splice(i, 1); S.state = 'in'; K.beep(o.k === 'dia' ? 1200 : 200, 0.08, 'triangle', 0.05); break; } }
    } else if (S.state === 'in') {
      var sp = 380 / (S.got ? S.got.w : 0.6) * (S.strong ? 1.6 : 1);
      S.len -= sp * dt;
      if (S.got) { var q = hookPos(); S.got.x = q[0]; S.got.y = q[1] + S.got.r * 0.6; }
      if (S.len <= 30) { S.len = 30; collect(); S.state = 'swing'; if (S.left <= 0) endLevel(); }
    }
  }
  function collect() {
    var g = S.got; S.got = null; if (!g) return;
    var v = g.v, txt;
    if (g.k === 'bag') {
      var r = Math.random();
      if (r < 0.5) { v = 50 + ((Math.random() * 15) | 0) * 50; txt = '$' + v; }
      else if (r < 0.75) { v = 0; S.tnt++; txt = '🧨 +1'; }
      else { v = 0; S.strong = 1; txt = L('💪 力量藥水！', '💪 Strength!'); }
    } else txt = '$' + v;
    S.money += v; S.pop.push({ x: OX, y: OY - 10, t: 1, txt: txt }); hud();
    K.beep(v >= 300 ? 1200 : v ? 880 : 500, 0.1, 'triangle', 0.05, v >= 300 ? 1600 : undefined);
  }
  function endLevel() {
    if (S.money >= target(S.level)) { K.beep(660, 0.3, 'triangle', 0.06, 1320); K.toast(L('過關！', 'Level clear!'), 1000); S.strong = 0; nextLevel(); }
    else gameOver();
  }
  function gameOver() {
    S.over = true; $('msg').textContent = '';
    var best = K.load('scminer_best', 0), nb = S.money > best; if (nb) K.save('scminer_best', S.money);
    $('endMoney').textContent = '$' + S.money.toLocaleString(); $('endLevel').textContent = S.level;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + '$' + best.toLocaleString();
    K.beep(220, 0.5, 'sawtooth', 0.05, 110);
    if (window.SC) SC.post('gameover', { game: GAME, score: S.money });
    setTimeout(function () { K.open('ovEnd'); if (S.started && S.money > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.money, text: L('第 ', 'Level ') + S.level + L(' 關', '') }); }, 500);
  }
  function item(o) {
    var t = T[o.k];
    if (o.k === 'dia') { ctx.fillStyle = t.c; ctx.beginPath(); ctx.moveTo(o.x, o.y - o.r * 1.2); ctx.lineTo(o.x + o.r, o.y - o.r * 0.2); ctx.lineTo(o.x, o.y + o.r * 1.2); ctx.lineTo(o.x - o.r, o.y - o.r * 0.2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(o.x - 2, o.y - o.r * 0.6, 3, 3); return; }
    if (o.k === 'bag') { ctx.fillStyle = t.c; ctx.beginPath(); ctx.arc(o.x, o.y + 3, o.r, 0, 7); ctx.fill(); ctx.fillRect(o.x - 5, o.y - o.r - 4, 10, 8); ctx.fillStyle = '#fde68a'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', o.x, o.y + 4); return; }
    var gld = o.k[0] === 'g', gr = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 2, o.x, o.y, o.r);
    gr.addColorStop(0, gld ? '#fef9c3' : '#d6d3d1'); gr.addColorStop(1, gld ? '#ca8a04' : t.c);
    ctx.fillStyle = gr; ctx.beginPath();
    for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2, rr = o.r * (0.85 + ((i * 7 + o.r) % 5) * 0.05); ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function draw() {
    var sky = ctx.createLinearGradient(0, 0, 0, OY + 20); sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(1, '#fde68a'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, OY + 20);
    var dirt = ctx.createLinearGradient(0, OY + 20, 0, H); dirt.addColorStop(0, '#a16207'); dirt.addColorStop(1, '#451a03'); ctx.fillStyle = dirt; ctx.fillRect(0, OY + 20, W, H - OY - 20);
    // 礦工與絞盤
    ctx.fillStyle = '#78350f'; ctx.fillRect(OX - 26, OY - 6, 52, 22);
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(OX + 36, OY - 22, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(OX + 36, OY - 26, 11, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#2563eb'; ctx.fillRect(OX + 28, OY - 12, 16, 22);
    S.items.forEach(item);
    var p = hookPos();
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(p[0], p[1]); ctx.stroke();
    if (S.got) item(S.got);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-S.ang); ctx.strokeStyle = '#44403c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 4, 9, Math.PI * 0.1, Math.PI * 0.9, true); ctx.stroke(); ctx.restore();
    ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    S.pop.forEach(function (q) { ctx.globalAlpha = Math.min(1, q.t * 2); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); }); ctx.globalAlpha = 1;
    if (S.strong) { ctx.font = '16px system-ui'; ctx.fillText('💪', 20, 20); }
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); fire(); });
  $('bTnt').onclick = function (e) { e.stopPropagation(); tnt(); };
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); fire(); } else if (e.key === 'ArrowUp' || e.key === 't') tnt(); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__mn = { S: function () { return S; }, fire: fire, end: function () { S.t0 -= DUR * 1000; } };
  newGame();
})();
