/* 珍奶手搖店 — stockcorp.github.io/boba/
   三個櫃台位置的客人各有訂單（1 種茶 + 0~3 種配料）。下方點配料／茶做杯子，點客人送出。
   耐心歸零的客人會生氣離開，氣走 3 位就結束。賣越多來客越快、訂單越複雜，品項逐步解鎖。
   排行榜：mode = classic，比營業額。 */
(function () {
  'use strict';
  var GAME = 'boba', $ = K.$, L = K.L, W = 480, H = 660;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(160), floats = FX.Floats();
  var BASES = [{ zh: '紅茶', en: 'Black tea', c: '#9a4a12', at: 0 }, { zh: '綠茶', en: 'Green tea', c: '#a3c644', at: 0 }, { zh: '奶茶', en: 'Milk tea', c: '#d2a679', at: 3 }, { zh: '抹茶拿鐵', en: 'Matcha latte', c: '#8fbf6a', at: 10 }];
  var TOPS = [{ zh: '珍珠', en: 'Pearls', at: 0 }, { zh: '椰果', en: 'Jelly', at: 5 }, { zh: '布丁', en: 'Pudding', at: 8 }, { zh: '冰塊', en: 'Ice', at: 13 }];
  var SKIN = ['#fcd9b6', '#f1c27d', '#e0ac69', '#c68642'], SHIRT = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#eab308'], HAIR = ['#1f1611', '#3b2414', '#6b4423', '#111827', '#7c2d12'], SX = [84, 240, 396];

  function reset() { S = { run: false, over: false, started: false, money: 0, served: 0, lives: 3, combo: 0, best: 0, cs: [null, null, null], cup: { base: -1, tops: [] }, spawnT: 1, t: 0, fill: 0, shakeCup: 0, unl: 0 }; parts.clear(); floats.clear(); hud(); }
  function hud() { $('money').textContent = '$' + FX.fmt(S.money); $('served').textContent = S.served; $('life').textContent = S.lives; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
  function avail(list) { var r = []; list.forEach(function (o, i) { if (S.served >= o.at) r.push(i); }); return r; }
  function spawn() {
    var free = []; S.cs.forEach(function (c, i) { if (!c) free.push(i); }); if (!free.length) return;
    var n = S.served, bs = avail(BASES), ts = avail(TOPS), k = n < 4 ? Math.floor(Math.random() * 2) : n < 12 ? Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3), tops = K.shuffle(ts.slice()).slice(0, Math.min(k, ts.length)).sort(), pat = Math.max(10, 22 - n * 0.22) + tops.length * 1.5;
    S.cs[free[Math.floor(Math.random() * free.length)]] = { base: bs[Math.floor(Math.random() * bs.length)], tops: tops, pat: pat, max: pat, skin: FX.pick(SKIN), shirt: FX.pick(SHIRT), hair: FX.pick(HAIR), hs: Math.floor(Math.random() * 3), in: 0, out: 0, mood: 0 };
    K.beep(880, 0.07, 'sine', 0.04); setTimeout(function () { K.beep(1100, 0.1, 'sine', 0.04); }, 90);
  }
  function match(c) { var u = S.cup; return c && !c.out && u.base === c.base && u.tops.length === c.tops.length && u.tops.slice().sort().join() === c.tops.join(); }
  function addBase(i) { if (!S.run || S.served < BASES[i].at) return; if (S.cup.base >= 0) { K.toast(L('已經倒茶了，做錯請按 🗑 重做', 'Tea is already poured — hit 🗑 to start over')); FX.sfx.bad(); return; } S.cup.base = i; S.fill = 0; K.beep(300, 0.25, 'sine', 0.04, 700); }
  function addTop(i) { if (!S.run || S.served < TOPS[i].at) return; if (S.cup.tops.indexOf(i) >= 0) { FX.sfx.bad(); return; } S.cup.tops.push(i); S.shakeCup = 0.15; K.beep(i === 3 ? 1500 : 220 + i * 60, 0.06, 'triangle', 0.05); parts.burst(240, 330, 6, { c: i === 0 ? '#1c1917' : i === 1 ? '#f8fafc' : i === 2 ? '#fde047' : '#bae6fd', sp: 80, life: 0.4, size: 5, g: 500, round: 1 }); }
  function trash() { if (!S.run || (S.cup.base < 0 && !S.cup.tops.length)) return; S.cup = { base: -1, tops: [] }; S.combo = 0; K.beep(160, 0.15, 'sawtooth', 0.04, 80); }
  function serve(i) {
    if (!S.run) return; var c = S.cs[i]; if (!c || c.out) return;
    if (S.cup.base < 0) { K.toast(L('先把飲料做好再送出', 'Finish the drink first')); return; }
    if (!match(c)) { c.pat -= c.max * 0.22; c.mood = 0.8; S.combo = 0; FX.sfx.bad(); floats.add(SX[i], 150, L('不是這杯！', 'Wrong drink!'), '#f87171', 16); return; }
    var price = 35 + c.tops.length * 10, tip = Math.round(c.pat / c.max * 20), mult = 1 + Math.min(10, S.combo) * 0.05, got = Math.round((price + tip) * mult);
    S.money += got; S.served++; S.combo++; S.best = Math.max(S.best, S.combo); c.out = 1; c.happy = true; S.cup = { base: -1, tops: [] };
    FX.sfx.cash(); floats.add(SX[i], 150, '+$' + got, '#4ade80', 22); if (S.combo >= 3) floats.add(SX[i], 176, L('連擊 x', 'Combo x') + S.combo, '#fde047', 14);
    parts.burst(SX[i], 200, 14, { c: ['#fde047', '#fbbf24', '#fff'], sp: 200, life: 0.7, size: 5, g: 400, up: 1, round: 1 });
    BASES.concat(TOPS).forEach(function (o) { if (o.at === S.served && o.at > 0) { floats.add(240, 300, L('新品項：', 'New: ') + L(o.zh, o.en) + '！', '#7dd3fc', 20); FX.sfx.great(); } });
    hud();
  }
  function step(dt) {
    parts.step(dt); floats.step(dt); if (S.shakeCup > 0) S.shakeCup -= dt; if (S.cup.base >= 0 && S.fill < 1) S.fill = Math.min(1, S.fill + dt * 3);
    S.cs.forEach(function (c, i) { if (!c) return; if (c.in < 1) c.in = Math.min(1, c.in + dt * 3); if (c.mood > 0) c.mood -= dt; if (c.out) { c.out += dt * 2.2; if (c.out > 2) S.cs[i] = null; return; } if (!S.run) return; c.pat -= dt; if (c.pat <= 0) { c.out = 1; c.happy = false; S.lives--; S.combo = 0; FX.sfx.crash(); floats.add(SX[i], 150, L('不等了！', 'I\'m leaving!'), '#f87171', 16); hud(); if (S.lives <= 0) end(); } });
    if (!S.run) return; S.t += dt; S.spawnT -= dt;
    if (S.spawnT <= 0) { spawn(); S.spawnT = Math.max(2.1, 4.6 - S.served * 0.08) * (0.8 + Math.random() * 0.4); if (!S.cs[0] && !S.cs[1] && !S.cs[2]) S.spawnT = 0.5; }
  }
  function end() {
    S.run = false; S.over = true; var b = FX.best('scboba_best', S.money), s0 = S;
    setTimeout(function () { if (S !== s0) return; FX.sfx.good(); $('endMoney').textContent = '$' + FX.fmt(S.money); $('endServed').textContent = S.served; $('endCombo').textContent = 'x' + S.best; $('endBest').textContent = b.isNew && S.money > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：$', 'Personal best: $') + FX.fmt(b.best); K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: S.money }); if (window.SCLB && S.money > 0) SCLB.offer({ game: GAME, mode: 'classic', score: S.money, text: '$' + FX.fmt(S.money) + L('・', ' · ') + S.served + L(' 杯', ' cups') }); }, 900);
  }
  // ---------- 繪圖 ----------
  function topping(i, x, y, s) { // 畫一顆配料
    if (i === 0) { ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.arc(x, y, 4.2 * s, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x - 1.2 * s, y - 1.4 * s, 1.2 * s, 0, 7); ctx.fill(); }
    else if (i === 1) { ctx.fillStyle = 'rgba(255,255,255,.92)'; FX.rr(ctx, x - 4 * s, y - 3.5 * s, 8 * s, 7 * s, 2 * s); ctx.fill(); ctx.strokeStyle = 'rgba(148,163,184,.8)'; ctx.lineWidth = 1; ctx.stroke(); }
    else if (i === 2) { ctx.fillStyle = '#facc15'; FX.rr(ctx, x - 6 * s, y - 4 * s, 12 * s, 8 * s, 3 * s); ctx.fill(); ctx.fillStyle = '#92400e'; FX.rr(ctx, x - 6 * s, y - 4 * s, 12 * s, 3 * s, 2 * s); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(186,230,253,.85)'; FX.rr(ctx, x - 5 * s, y - 5 * s, 10 * s, 10 * s, 2 * s); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  function cup(x, y, s, base, tops, fill) { // (x,y) = 杯底中心；s = 縮放
    var tw = 34 * s, bw = 25 * s, h = 82 * s, i;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - tw, y - h); ctx.lineTo(x + tw, y - h); ctx.lineTo(x + bw, y); ctx.lineTo(x - bw, y); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.clip();
    if (base >= 0) { ctx.fillStyle = BASES[base].c; ctx.fillRect(x - tw, y - h * 0.88 * fill, tw * 2, h); if (base >= 2) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x - tw, y - h * 0.88 * fill, tw * 2, 7 * s); } }
    var seedI = 0; tops.forEach(function (t) { if (t === 3) return; for (i = 0; i < 6; i++) { var px = x + ((i * 37 + t * 53 + seedI * 17) % 40 - 20) * s * 1.1, py = y - (6 + ((i * 29 + t * 11) % 22)) * s - seedI * 7 * s; topping(t, px, py, s * 0.95); } seedI++; });
    if (tops.indexOf(3) >= 0) for (i = 0; i < 4; i++) topping(3, x + (i * 15 - 22) * s, y - h * (base >= 0 ? 0.8 * fill : 0.25) + (i % 2) * 6 * s, s);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x - tw, y - h); ctx.lineTo(x - bw, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + tw, y - h); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x - tw * 0.72, y - h * 0.9, 4 * s, h * 0.7);
    if (base >= 0 && fill >= 1) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 8 * s, y - 10 * s); ctx.lineTo(x + 22 * s, y - h - 20 * s); ctx.stroke(); ctx.fillStyle = '#e5e7eb'; FX.rr(ctx, x - tw - 2 * s, y - h - 4 * s, tw * 2 + 4 * s, 6 * s, 3 * s); ctx.fill(); }
  }
  function person(c, i, time) {
    var x = SX[i], slide = c.out ? (c.out - 1) * 140 : (1 - c.in) * 140, y = 262 + slide, f = c.pat / c.max, bob = Math.sin(time * 3 + i * 2) * 1.5, mad = c.out ? !c.happy : (f < 0.28 || c.mood > 0), glad = c.out && c.happy;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 60, W, 202); ctx.clip();
    ctx.fillStyle = c.shirt; FX.rr(ctx, x - 38, y - 62 + bob, 76, 90, 22); ctx.fill(); ctx.fillStyle = FX.shade(c.shirt, -0.2); ctx.fillRect(x - 3, y - 50 + bob, 6, 60);
    ctx.fillStyle = c.skin; ctx.fillRect(x - 8, y - 72 + bob, 16, 14); ctx.beginPath(); ctx.arc(x, y - 96 + bob, 30, 0, 7); ctx.fill();
    ctx.fillStyle = c.hair; ctx.beginPath(); ctx.arc(x, y - 102 + bob, 31, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); if (c.hs === 1) { ctx.fillRect(x - 31, y - 104 + bob, 9, 40); ctx.fillRect(x + 22, y - 104 + bob, 9, 40); } else if (c.hs === 2) { ctx.beginPath(); ctx.arc(x, y - 130 + bob, 11, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1f1611'; if (glad) { ctx.strokeStyle = '#1f1611'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x - 11, y - 96 + bob, 4, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 11, y - 96 + bob, 4, Math.PI, 0); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(x - 11, y - 97 + bob, 3.2, 0, 7); ctx.arc(x + 11, y - 97 + bob, 3.2, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#1f1611'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    if (mad) { ctx.beginPath(); ctx.moveTo(x - 17, y - 107 + bob); ctx.lineTo(x - 6, y - 103 + bob); ctx.moveTo(x + 17, y - 107 + bob); ctx.lineTo(x + 6, y - 103 + bob); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - 78 + bob, 7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y - 88 + bob, glad ? 10 : 7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    ctx.fillStyle = 'rgba(244,114,182,.35)'; ctx.beginPath(); ctx.arc(x - 19, y - 87 + bob, 5, 0, 7); ctx.arc(x + 19, y - 87 + bob, 5, 0, 7); ctx.fill();
    ctx.restore();
    if (c.out || c.in < 1) return;
    // 訂單對話框
    var bw = 132, bx = FX.clamp(x - bw / 2, 6, W - bw - 6), by = 66, ok = match(c);
    ctx.fillStyle = ok ? '#dcfce7' : '#fffdf5'; FX.rr(ctx, bx, by, bw, 66, 12); ctx.fill(); ctx.strokeStyle = ok ? '#22c55e' : '#d6c7a1'; ctx.lineWidth = ok ? 3 : 2; ctx.stroke();
    ctx.fillStyle = ok ? '#dcfce7' : '#fffdf5'; ctx.beginPath(); ctx.moveTo(x - 8, by + 65); ctx.lineTo(x, by + 76); ctx.lineTo(x + 8, by + 65); ctx.fill();
    cup(bx + 28, by + 52, 0.5, c.base, c.tops, 1);
    FX.text(ctx, L(BASES[c.base].zh, BASES[c.base].en), bx + 52, by + 15, 11.5, '#422006', 'left');
    if (c.tops.length) c.tops.forEach(function (t, k) { topping(t, bx + 60 + k * 26, by + 38, 1.25); }); else FX.text(ctx, L('不加料', 'No toppings'), bx + 52, by + 38, 10.5, '#a8a29e', 'left');
    ctx.fillStyle = '#e7e5e4'; FX.rr(ctx, bx + 8, by + 56, bw - 16, 6, 3); ctx.fill(); ctx.fillStyle = f > 0.5 ? '#22c55e' : f > 0.25 ? '#f59e0b' : '#ef4444'; if (f > 0.03) { FX.rr(ctx, bx + 8, by + 56, (bw - 16) * f, 6, 3); ctx.fill(); }
    hit.add(x - 70, 60, 140, 210, serve, i);
  }
  function draw(time) {
    hit.begin(); var i;
    var g = ctx.createLinearGradient(0, 0, 0, 270); g.addColorStop(0, '#f6d9a8'); g.addColorStop(1, '#e9b872'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 270);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; for (i = 0; i < 12; i++) ctx.fillRect(i * 44, 56, 22, 214);
    ctx.fillStyle = '#7c2d12'; ctx.fillRect(0, 0, W, 56); ctx.fillStyle = '#fef3c7'; for (i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(20 + i * 40, 56, 20, 0, Math.PI); ctx.fill(); ctx.fillStyle = i % 2 ? '#fef3c7' : '#f97316'; }
    FX.text(ctx, L('🧋 珍奶手搖店', '🧋 BOBA SHOP'), W / 2, 27, 22, '#fef3c7'); for (i = 0; i < 3; i++) FX.text(ctx, i < S.lives ? '❤️' : '🖤', 22 + i * 22, 28, 14);
    if (S.combo >= 2) FX.text(ctx, L('連擊 x', 'Combo x') + S.combo, W - 50, 28, 14, '#fde047');
    S.cs.forEach(function (c, k) { if (c) person(c, k, time); });
    // 櫃台與工作台
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(0, 262, W, 26); ctx.fillStyle = '#a9713a'; ctx.fillRect(0, 262, W, 8); ctx.fillStyle = '#3b2412'; ctx.fillRect(0, 288, W, H - 288);
    ctx.fillStyle = '#4a2f18'; FX.rr(ctx, 12, 298, W - 24, 176, 16); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.05)'; FX.rr(ctx, 12, 298, W - 24, 60, 16); ctx.fill();
    var sh = S.shakeCup > 0 ? Math.sin(time * 80) * 3 : 0; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(240, 458, 52, 9, 0, 0, 7); ctx.fill();
    cup(240 + sh, 456, 1.7, S.cup.base, S.cup.tops, S.fill);
    var has = S.cup.base >= 0 || S.cup.tops.length; FX.button(ctx, 384, 396, 72, 62, '🗑', { bg: has ? '#b91c1c' : '#4b5563', size: 24, sub: L('倒掉', 'Trash'), off: !has }); hit.add(384, 396, 72, 62, trash);
    FX.text(ctx, L('做好後點客人送出', 'Tap a customer to serve'), 96, 330, 12, 'rgba(255,255,255,.55)');
    var names = []; if (S.cup.base >= 0) names.push(L(BASES[S.cup.base].zh, BASES[S.cup.base].en)); S.cup.tops.forEach(function (t) { names.push(L(TOPS[t].zh, TOPS[t].en)); });
    names.forEach(function (n, k) { FX.text(ctx, '• ' + n, 30, 360 + k * 20, 13, '#fde68a', 'left'); });
    // 材料按鈕
    for (i = 0; i < 4; i++) {
      var bx = 12 + i * 116, lockB = S.served < BASES[i].at, lockT = S.served < TOPS[i].at, selB = S.cup.base === i, selT = S.cup.tops.indexOf(i) >= 0;
      FX.button(ctx, bx, 484, 108, 78, '', { bg: lockB ? '#3a4152' : '#5b3a1e', sel: selB, off: lockB }); if (lockB) FX.text(ctx, '🔒 ' + BASES[i].at + L(' 杯', ' sold'), bx + 54, 524, 12, '#8a93a6'); else { ctx.fillStyle = BASES[i].c; ctx.beginPath(); ctx.arc(bx + 54, 514, 19, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(bx + 48, 507, 7, 4, -0.5, 0, 7); ctx.fill(); FX.text(ctx, L(BASES[i].zh, BASES[i].en), bx + 54, 547, 12.5, '#fff'); hit.add(bx, 484, 108, 78, addBase, i); }
      FX.button(ctx, bx, 572, 108, 78, '', { bg: lockT ? '#3a4152' : '#374151', sel: selT, off: lockT }); if (lockT) FX.text(ctx, '🔒 ' + TOPS[i].at + L(' 杯', ' sold'), bx + 54, 612, 12, '#8a93a6'); else { for (var k = 0; k < 3; k++) topping(i, bx + 36 + k * 18, 602 + (k % 2) * 5, 1.5); FX.text(ctx, L(TOPS[i].zh, TOPS[i].en), bx + 54, 635, 12.5, '#fff'); hit.add(bx, 572, 108, 78, addTop, i); }
    }
    parts.draw(ctx); floats.draw(ctx);
  }
  document.addEventListener('keydown', function (e) { if (!S || !S.run || e.repeat) return; var k = e.key.toLowerCase(), i; if ((i = '1234'.indexOf(k)) >= 0) addBase(i); else if ((i = 'qwer'.indexOf(k)) >= 0) addTop(i); else if ((i = 'asd'.indexOf(k)) >= 0) serve(i); else if (k === 'x') trash(); });
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__bb = { S: function () { return S; }, go: start, base: addBase, top: addTop, serve: serve };
})();
