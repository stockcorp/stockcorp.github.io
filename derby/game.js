/* 賽馬 — stockcorp.github.io/derby/
   側視 1000m 草地賽，6 匹馬 6 條跑道。體力：衝刺每秒 -9、巡航每秒 +2.2；跟在別的馬後面（同跑道 7m 內）省力。
   正前方有馬會被擋住要換跑道。跑道上有紅蘿蔔（+22 體力）和泥巴（減速）。
   排行榜：mode = classic，第 1 名的完賽時間（伺服器計時）。 */
(function () {
  'use strict';
  var GAME = 'derby', $ = K.$, L = K.L, W = 480, H = 620, LEN = 1000, PPM = 12, LY = 304, LH = 41, PX = 140, VC = 15, VS = 18.6, HL = 5.4;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), S = null, parts = FX.Parts(200), floats = FX.Floats(), crowd = FX.Noise('bandpass');
  var HORSES = [['#7c4a25', '#ef4444', '閃電', 'Bolt'], ['#2b2118', '#3b82f6', '黑旋風', 'Cyclone'], ['#b88a5a', '#eab308', '金鬃', 'Goldmane'], ['#e5e7eb', '#a855f7', '白雪', 'Snow'], ['#5c3317', '#f97316', '赤兔', 'Red Hare'], ['#3f3f46', '#14b8a6', '夜影', 'Shadow']];
  var stand = document.createElement('canvas'); stand.width = 240; stand.height = 120;
  (function () { var c = stand.getContext('2d'); c.fillStyle = '#334155'; c.fillRect(0, 22, 240, 98); c.fillStyle = '#e2e8f0'; c.beginPath(); c.moveTo(0, 22); c.lineTo(240, 22); c.lineTo(240, 8); c.lineTo(0, 14); c.fill(); c.fillStyle = '#94a3b8'; c.fillRect(0, 22, 240, 4); for (var r = 0; r < 6; r++) for (var x = 4 + (r % 2) * 5; x < 240; x += 10) { c.fillStyle = ['#f87171', '#fbbf24', '#60a5fa', '#f1f5f9', '#4ade80', '#f472b6', '#fdba74'][Math.floor(Math.random() * 7)]; c.beginPath(); c.arc(x, 38 + r * 14, 4, 0, 7); c.fill(); c.fillStyle = '#fcd9b6'; c.beginPath(); c.arc(x, 32 + r * 14, 2.6, 0, 7); c.fill(); } c.fillStyle = '#1e293b'; c.fillRect(0, 26, 5, 94); c.fillRect(118, 26, 5, 94); })();

  function reset() {
    var order = K.shuffle([0, 1, 2, 3, 4, 5]), pl = 2 + Math.floor(Math.random() * 2), skills = K.shuffle([1.03, 1.02, 1.005, 0.99, 0.975]), si = 0;
    S = { hs: [], items: [], t: 0, run: false, over: false, fin: 0, top: 0, stride: 0, msg: '' };
    for (var i = 0; i < 6; i++) { var me = i === pl; S.hs.push({ i: i, lane: i, ly: i, x: 0, v: 0, st: 100, me: me, sk: me ? 1 : skills[si++], thr: 55 + Math.random() * 35, rest: false, exh: 0, mud: 0, ph: Math.random() * 6, done: 0, c: HORSES[order[i]], seek: Math.random() * 0.6, lc: 0, sprint: false }); }
    S.P = S.hs[pl];
    for (var m = 70; m < LEN - 60; m += 48) { var used = {}; for (var k = 0; k < 2; k++) { var ln = Math.floor(Math.random() * 6); if (used[ln]) continue; used[ln] = 1; S.items.push({ x: m + Math.random() * 20, lane: ln, t: Math.random() < 0.52 ? 'c' : 'm', got: false }); } }
    parts.clear(); floats.clear(); hud();
  }
  function fmt(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function rank() { var p = S.P, r = 1; S.hs.forEach(function (h) { if (h !== p && ((h.done && (!p.done || h.done < p.done)) || (!h.done && !p.done && h.x > p.x))) r++; }); return r; }
  function hud() { $('time').textContent = fmt(S.P.done || S.t); $('pos').textContent = rank() + '/6'; $('left').textContent = Math.max(0, Math.round(LEN - S.P.x)) + ' m'; }
  function start() { reset(); $('cover').classList.add('off'); K.close('ovEnd'); FX.countdown($('big'), function () { S.run = true; FX.sfx.go(); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }); }
  function free(h, lane) { if (lane < 0 || lane > 5) return false; for (var i = 0; i < 6; i++) { var o = S.hs[i]; if (o !== h && (o.lane === lane || Math.round(o.ly) === lane) && Math.abs(o.x - h.x) < HL + 0.6) return false; } return true; }
  function ahead(h) { var best = null; S.hs.forEach(function (o) { if (o !== h && o.lane === h.lane && o.x > h.x && (!best || o.x < best.x)) best = o; }); return best; }
  function move(h, d) { if (h.lc > 0 || h.done) return false; var l = h.lane + d; if (!free(h, l)) return false; h.lane = l; h.lc = 0.28; return true; }
  function ai(h) {
    var remain = LEN - h.x, canD = h.st / 9 * VS * h.sk;
    if (remain <= canD * 1.03) h.sprint = true; else { if (h.rest) { if (h.st > h.thr) h.rest = false; } else if (h.st < h.thr - 30) h.rest = true; h.sprint = !h.rest && h.x > 20; }
    if (h.exh > 0) h.sprint = false;
    if (h.lc > 0) return;
    var a = ahead(h), blocked = a && a.x - h.x < HL + 3 && a.v < h.v + 0.3, tryL = null, i;
    for (i = 0; i < S.items.length; i++) { var it = S.items[i]; if (it.got) continue; var dx = it.x - h.x; if (dx < 4 || dx > 26) continue; if (it.t === 'm' && it.lane === h.lane && dx < 16) { tryL = [-1, 1]; break; } if (it.t === 'c' && Math.abs(it.lane - h.lane) === 1 && h.st < 80 && Math.random() < h.seek * 0.06) { tryL = [it.lane - h.lane]; break; } }
    if (blocked && h.sprint) tryL = Math.random() < 0.5 ? [-1, 1] : [1, -1];
    if (tryL && Math.random() < 0.2) for (i = 0; i < tryL.length; i++) if (move(h, tryL[i])) break;
  }
  function step(dt) {
    parts.step(dt); floats.step(dt);
    if (!S.run) { crowd.set(0); return; }
    S.t += dt; var P = S.P, k = FX.keys;
    P.sprint = !!k.a && P.exh <= 0;
    S.hs.forEach(function (h) {
      if (!h.me) ai(h);
      if (h.lc > 0) h.lc -= dt; h.ly += (h.lane - h.ly) * Math.min(1, dt * 11);
      var a = ahead(h), gap = a ? a.x - h.x - HL : 99, draft = gap < 7 && !h.done;
      if (h.done) { h.v = Math.max(6, h.v - 4 * dt); h.x += h.v * dt; h.ph += h.v * dt * 0.62; return; }
      if (h.exh > 0) { h.exh -= dt; h.st += 9 * dt; if (h.st >= 30) h.exh = 0; }
      else if (h.sprint) { h.st -= 9 * (draft ? 0.55 : 1) * dt; if (h.st <= 0) { h.st = 0; h.exh = 9; if (h.me) { FX.sfx.bad(); floats.add(PX, LY + h.ly * LH - 50, L('力竭！', 'Exhausted!'), '#f87171', 20); } } }
      else h.st = Math.min(100, h.st + 2.2 * (draft ? 1.6 : 1) * dt);
      var tv = (h.exh > 0 ? 11 : h.sprint ? VS : VC) * h.sk; if (h.mud > 0) { h.mud -= dt; tv *= 0.68; }
      h.v += FX.clamp(tv - h.v, -9 * dt, 5.5 * dt);
      if (a && gap < 0.4 && h.v > a.v) { h.v = a.v; if (h.me && !S.blockT) { S.blockT = 1.2; floats.add(PX + 30, LY + h.ly * LH - 46, L('被擋住！換跑道', 'Blocked! Change lane'), '#fde047', 14); } }
      h.x += h.v * dt; h.ph += h.v * dt * 0.62;
      S.items.forEach(function (it) { if (it.got || it.lane !== h.lane || Math.abs(it.x - h.x + 1.5) > 2.6) return; it.got = true; if (it.t === 'c') { h.st = Math.min(100, h.st + 22); if (h.exh > 0 && h.st >= 30) h.exh = 0; if (h.me) { FX.sfx.coin(); floats.add(PX + 20, LY + h.ly * LH - 46, L('體力 +22', 'Stamina +22'), '#4ade80', 16); } } else { h.mud = 0.9; it.got = false; it.hit = S.t; if (h.me && !(it.me)) { it.me = 1; FX.sfx.bad(); floats.add(PX + 20, LY + h.ly * LH - 46, L('泥巴！', 'Mud!'), '#d6a36c', 16); } if (Math.abs(h.x - P.x) < 30) parts.burst(PX + (h.x - P.x) * PPM, LY + h.ly * LH + 12, 8, { c: '#7c5a3a', sp: 120, life: 0.5, size: 4, g: 300, up: 1 }); } });
      if (h.x >= LEN && !h.done) { h.done = S.t - (h.x - LEN) / h.v; S.fin++; if (h.me) finish(); }
      if (h.v > 12 && Math.abs(h.x - P.x) < 30 && Math.random() < 0.3) parts.add({ x: PX + (h.x - P.x) * PPM - 26, y: LY + h.ly * LH + 14, vx: -40 - Math.random() * 40, vy: -20 - Math.random() * 40, life: 0.45, c: 'rgba(214,196,150,.7)', size: 4, g: 80, round: 1 });
    });
    if (S.blockT) S.blockT = Math.max(0, S.blockT - dt);
    S.top = Math.max(S.top, P.v);
    S.stride += P.v * dt * 0.62; if (S.stride > Math.PI) { S.stride -= Math.PI; K.beep(P.sprint ? 105 : 85, 0.035, 'sine', 0.035); }
    crowd.set(K.muted ? 0 : (P.x > LEN - 250 ? 0.05 : 0.012), 900); hud();
  }
  function finish() {
    var P = S.P, r = rank(), t = P.done, sec = window.SCLB ? (SCLB.elapsed(GAME) || t) : t, s0 = S; S.over = true;
    if (r === 1) FX.sfx.great(); else FX.sfx.good();
    setTimeout(function () {
      if (S !== s0) return; S.run = false; crowd.stop();
      $('endEmoji').textContent = ['🥇', '🥈', '🥉', '🏇', '🏇', '🏇'][r - 1]; $('endTitle').textContent = r === 1 ? L('冠軍！', 'You Win!') : L('第 ' + r + ' 名', ['', '', '2nd Place', '3rd Place', '4th Place', '5th Place', '6th Place'][r]);
      $('endPos').textContent = r + '/6'; $('endTime').textContent = fmt(t); $('endTop').textContent = Math.round(S.top * 3.6) + ' km/h';
      var b = r === 1 ? FX.best('scderby_best', Math.round(t * 100) / 100, true) : { best: K.load('scderby_best', 0) };
      $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : b.best ? L('個人最佳：', 'Personal best: ') + fmt(b.best) : L('拿到第 1 名才能上排行榜', 'Win the race to enter the leaderboard');
      K.open('ovEnd'); $('cover').classList.remove('off');
      if (window.SC) SC.post('gameover', { game: GAME, win: r === 1, sec: t });
      if (window.SCLB && r === 1) SCLB.offer({ game: GAME, mode: 'classic', score: sec, text: L('冠軍', 'Winner') });
    }, 2200);
  }
  // ---------- 繪圖 ----------
  function horse(x, y, h) {
    var ph = h.ph, bob = Math.sin(ph * 2) * 2, coat = h.c[0], dk = FX.shade(coat, -0.35), silk = h.c[1], gal = Math.min(1, h.v / 14);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 15, 30, 5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineCap = 'round';
    [[-15, 0.0, 1], [-13, 0.7, 0], [15, 3.3, 1], [17, 2.6, 0]].forEach(function (lg) { var a = Math.sin(ph + lg[1]) * 0.95 * gal, kx = lg[0] + Math.sin(a) * 11, ky = 3 + bob + Math.cos(a) * 9, a2 = a - 0.5 - Math.max(0, Math.sin(ph + lg[1] + 1.2)) * 1.0 * gal; ctx.lineWidth = lg[2] ? 4.5 : 4; ctx.strokeStyle = lg[2] ? dk : FX.shade(coat, -0.5); ctx.beginPath(); ctx.moveTo(lg[0], 2 + bob); ctx.lineTo(kx, ky); ctx.lineTo(kx + Math.sin(a2) * 9, Math.min(15, ky + Math.cos(a2) * 9)); ctx.stroke(); });
    ctx.strokeStyle = dk; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-23, -7 + bob); ctx.quadraticCurveTo(-34, -8 + bob, -39, 1 + Math.sin(ph) * 5); ctx.stroke();
    ctx.fillStyle = coat; ctx.beginPath(); ctx.ellipse(0, -4 + bob, 25, 11, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -12 + bob); ctx.lineTo(27, -27 + bob); ctx.lineTo(35, -22 + bob); ctx.lineTo(23, -1 + bob); ctx.fill();
    ctx.save(); ctx.translate(33, -26 + bob); ctx.rotate(0.55); ctx.beginPath(); ctx.ellipse(3, 0, 10, 5.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(11, 1, 3, 3.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(2, -1.5, 1.4, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = coat; ctx.beginPath(); ctx.moveTo(26, -29 + bob); ctx.lineTo(28, -36 + bob); ctx.lineTo(31, -29 + bob); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(14, -13 + bob); ctx.lineTo(26, -27 + bob); ctx.stroke();
    ctx.fillStyle = '#f8fafc'; FX.rr(ctx, -8, -15 + bob, 14, 11, 2); ctx.fill(); FX.text(ctx, String(h.i + 1), -1, -9 + bob, 9, '#111');
    ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.ellipse(-2, -15 + bob, 5, 4, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = silk; ctx.beginPath(); ctx.ellipse(4, -21 + bob, 8, 5.5, -0.5, 0, 7); ctx.fill(); ctx.strokeStyle = silk; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -21 + bob); ctx.lineTo(17, -17 + bob); ctx.stroke();
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(11, -28 + bob, 3.6, 0, 7); ctx.fill(); ctx.fillStyle = silk; ctx.beginPath(); ctx.arc(11, -29 + bob, 3.9, Math.PI, 0); ctx.fill(); ctx.fillRect(11, -30 + bob, 6, 1.6);
    if (h.me) { ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(4, -50); ctx.lineTo(-3, -60); ctx.lineTo(11, -60); ctx.fill(); FX.text(ctx, L('你', 'YOU'), 4, -68, 11, '#fde047', 'center', '#000'); }
    if (h.exh > 0) FX.text(ctx, '💦', 30, -40, 14);
    ctx.restore();
  }
  function sx(m) { return PX + (m - S.P.x) * PPM; }
  function draw(time) {
    var P = S.P, cam = P.x * PPM, i, x;
    var sky = ctx.createLinearGradient(0, 0, 0, 150); sky.addColorStop(0, '#60a5fa'); sky.addColorStop(1, '#dbeafe'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 150);
    ctx.fillStyle = '#86b98a'; for (i = -1; i < 4; i++) { x = i * 220 - (cam * 0.08) % 220; ctx.beginPath(); ctx.ellipse(x + 110, 150, 150, 46, 0, Math.PI, 0); ctx.fill(); }
    for (i = -1; i < 3; i++) ctx.drawImage(stand, i * 240 - (cam * 0.45) % 240, 122);
    ctx.fillStyle = '#3f8f4e'; ctx.fillRect(0, 240, W, H - 240);
    // 草地條紋（每 50m 換色）
    var m0 = Math.floor((P.x - PX / PPM) / 50) * 50; for (var m = m0; m < P.x + 40; m += 50) { ctx.fillStyle = (m / 50) % 2 ? '#4fa860' : '#46994f'; ctx.fillRect(sx(m), 272, 50 * PPM + 1, LH * 6 + 10); }
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; for (i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, LY + i * LH - LH / 2 + 4); ctx.lineTo(W, LY + i * LH - LH / 2 + 4); ctx.stroke(); }
    // 內欄
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 258, W, 4); for (x = -((cam) % 44); x < W; x += 44) ctx.fillRect(x, 258, 3, 16);
    for (m = Math.ceil((P.x - 15) / 200) * 200; m < P.x + 40; m += 200) { if (m <= 0 || m >= LEN) continue; x = sx(m); ctx.fillStyle = '#1e293b'; ctx.fillRect(x - 1.5, 226, 3, 34); ctx.fillStyle = '#fff'; FX.rr(ctx, x - 24, 208, 48, 22, 4); ctx.fill(); FX.text(ctx, (LEN - m) + 'm', x, 219, 12, '#0f172a'); }
    // 起點、終點
    x = sx(0); if (x > -20) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 28, 272, 3, LH * 6 + 10); }
    x = sx(LEN); if (x < W + 40) { for (i = 0; i < 26; i++) for (var j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(x + 30 + j * 7, 272 + i * 10, 7, 10); } ctx.fillStyle = '#e11d48'; ctx.fillRect(x + 34, 190, 5, 84); ctx.beginPath(); ctx.arc(x + 36.5, 186, 11, 0, 7); ctx.fill(); FX.text(ctx, '🏁', x + 36.5, 186, 12); }
    // 道具
    S.items.forEach(function (it) { if (it.got) return; var ix = sx(it.x) + 30, iy = LY + it.lane * LH + 8; if (ix < -30 || ix > W + 30) return; if (it.t === 'c') { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(ix, iy + 6, 9, 3, 0, 0, 7); ctx.fill(); FX.text(ctx, '🥕', ix, iy - 4 + Math.sin(time * 5 + it.x) * 2, 18); } else { ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.ellipse(ix, iy + 4, 22, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a6540'; ctx.beginPath(); ctx.ellipse(ix - 4, iy + 2, 9, 3, 0, 0, 7); ctx.fill(); } });
    parts.draw(ctx);
    S.hs.slice().sort(function (a, b) { return a.ly - b.ly; }).forEach(function (h) { var hx = sx(h.x); if (hx > -60 && hx < W + 60) horse(hx, LY + h.ly * LH, h); });
    // 外欄與前景
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 536, W, 4); for (x = -((cam * 1.06) % 48); x < W; x += 48) ctx.fillRect(x, 536, 4, 20);
    ctx.fillStyle = '#2f7a3e'; ctx.fillRect(0, 556, W, 64);
    for (i = 0; i < 9; i++) { x = ((i * 97 - cam * 1.25) % (W + 80) + W + 80) % (W + 80) - 40; ctx.fillStyle = '#256b34'; ctx.beginPath(); ctx.ellipse(x, 606, 30, 16, 0, 0, 7); ctx.fill(); ctx.fillStyle = ['#fde047', '#f9a8d4', '#fff'][i % 3]; ctx.beginPath(); ctx.arc(x - 8, 596, 2.5, 0, 7); ctx.arc(x + 9, 600, 2.5, 0, 7); ctx.fill(); }
    floats.draw(ctx);
    // 進度條
    ctx.fillStyle = 'rgba(15,23,42,.55)'; FX.rr(ctx, 14, 10, W - 28, 20, 10); ctx.fill(); FX.text(ctx, '🏁', W - 24, 20, 12);
    S.hs.slice().sort(function (a, b) { return (a.me ? 1 : 0) - (b.me ? 1 : 0); }).forEach(function (h) { var px = 26 + Math.min(1, h.x / LEN) * (W - 64); ctx.fillStyle = h.c[1]; ctx.beginPath(); ctx.arc(px, 20, h.me ? 7 : 5, 0, 7); ctx.fill(); if (h.me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } });
    // 體力
    var st = P.st / 100, bw = 250, bx = (W - bw) / 2, by = 572; ctx.fillStyle = 'rgba(15,23,42,.7)'; FX.rr(ctx, bx - 4, by - 4, bw + 8, 26, 13); ctx.fill();
    ctx.fillStyle = P.exh > 0 ? (Math.floor(time * 6) % 2 ? '#ef4444' : '#7f1d1d') : st < 0.25 ? '#f97316' : P.sprint ? '#facc15' : '#4ade80'; if (st > 0.02) { FX.rr(ctx, bx, by, bw * st, 18, 9); ctx.fill(); }
    FX.text(ctx, P.exh > 0 ? L('力竭 — 恢復中', 'Exhausted — recovering') : L('體力 ', 'Stamina ') + Math.round(P.st), W / 2, by + 9.5, 12, '#fff', 'center', '#000');
    FX.text(ctx, Math.round(P.v * 3.6) + ' km/h', W - 50, by + 9, 13, '#fff', 'center', '#000');
  }
  FX.pad($('touch'), [{ k: 'up', t: '▲' }, { k: 'down', t: '▼' }, { gap: 1 }, { k: 'a', t: '🔥', cls: 'wide go' }]);
  FX.onKey = function (k, d) { if (!d || !S.run || S.P.done || (k !== 'up' && k !== 'down')) return; if (!move(S.P, k === 'up' ? -1 : 1)) K.beep(140, 0.06, 'square', 0.03); };
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; start(); } };
  FX.sound(function () { if (K.muted) crowd.stop(); });
  reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__db = { S: function () { return S; }, go: function () { reset(); $('cover').classList.add('off'); S.run = true; }, move: move, ahead: ahead };
})();
