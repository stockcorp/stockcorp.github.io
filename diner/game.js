/* 美味餐廳 — stockcorp.github.io/diner/
   一位服務生、最多 6 桌。桌子狀態：空 → 看菜單 → 等點餐 📋 → 等上菜 → 用餐 → 等結帳 💵 → 待收拾 🧽 → 空。
   點空桌 = 讓門口第一組客人入座；其他動作排進服務生的工作佇列，依序走過去做。一次最多端兩盤。
   客人 5 顆愛心，等待時會掉；歸零就生氣離開（扣一命）。收入 = 人數 × $40 + 愛心小費，連擊加成。
   排行榜：mode = classic，比營業額。 */
(function () {
  'use strict';
  var GAME = 'diner', $ = K.$, L = K.L, W = 480, H = 660;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(140), floats = FX.Floats();
  var TP = [[175, 250], [305, 250], [430, 250], [175, 460], [305, 460], [430, 460]], DISH = ['🍝', '🍔', '🍛', '🍜', '🍕', '🥗'], SHIRT = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#eab308'], SKIN = ['#fcd9b6', '#f1c27d', '#e0ac69', '#c68642'];
  function passX(i) { return 196 + i * 62; }
  function reset() {
    S = { run: false, over: false, started: false, money: 0, served: 0, lives: 3, combo: 0, best: 0, t: 0, tables: [], queue: [], tasks: [], cook: [], pass: [null, null, null, null], w: { x: 240, y: 130, hands: [], cur: null, wait: 0, ph: 0, dir: 1 }, arrT: 1.5, nT: 4 };
    for (var i = 0; i < 6; i++) S.tables.push({ id: i, x: TP[i][0], y: TP[i][1], st: 'empty', p: null, t: 0 });
    parts.clear(); floats.clear(); hud();
  }
  function hud() { $('money').textContent = '$' + FX.fmt(S.money); $('served').textContent = S.served; $('life').textContent = S.lives; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
  function heartSec() { return Math.max(3.6, 7.5 - S.served * 0.13); }
  function party() { var n = Math.random() < 0.45 ? 1 : 2, m = []; for (var i = 0; i < n; i++) m.push({ shirt: FX.pick(SHIRT), skin: FX.pick(SKIN) }); return { m: m, hearts: 5, dish: FX.pick(DISH) }; }
  function has(type, a) { return S.tasks.some(function (k) { return k.type === type && k.a === a; }) || (S.w.cur && S.w.cur.type === type && S.w.cur.a === a); }
  function push(type, a) { if (has(type, a)) return; S.tasks.push({ type: type, a: a }); K.beep(640, 0.04, 'triangle', 0.035); }
  function tapTable(i) {
    if (!S.run || i >= S.nT) return; var t = S.tables[i];
    if (t.st === 'empty') { if (!S.queue.length) { K.toast(L('門口還沒有客人', 'Nobody is waiting at the door')); return; } t.p = S.queue.shift(); t.st = 'read'; t.t = 2.6; t.p.hearts = Math.min(5, t.p.hearts + 0.5); K.beep(700, 0.08, 'sine', 0.04, 900); return; }
    if (t.st === 'order') push('order', i); else if (t.st === 'pay') push('pay', i); else if (t.st === 'dirty') push('clean', i);
    else if (t.st === 'food') { var ok = S.w.hands.some(function (d) { return d.table === i; }) || S.pass.some(function (d, k) { return d && d.table === i && has('pick', k); }); if (ok) push('serve', i); else K.toast(S.pass.some(function (d) { return d && d.table === i; }) ? L('先去出菜口拿菜', 'Pick up the dish at the pass first') : L('菜還在做，等一下', 'The food is still cooking')); }
  }
  function tapPass(k) { if (!S.run || !S.pass[k]) return; var cnt = S.w.hands.length + S.tasks.filter(function (q) { return q.type === 'pick'; }).length + (S.w.cur && S.w.cur.type === 'pick' ? 1 : 0); if (cnt >= 2 && !has('pick', k)) { K.toast(L('一次最多端兩盤', 'You can carry two plates at most')); return; } push('pick', k); }
  function leave(t, happy) {
    var p = t.p; if (!p) return;
    if (happy) { var base = p.m.length * 40, tip = Math.round(p.hearts) * 6 * p.m.length, mult = 1 + Math.min(10, S.combo) * 0.1, got = Math.round((base + tip) * mult); S.money += got; S.served++; if (p.hearts >= 3) { S.combo++; S.best = Math.max(S.best, S.combo); } else S.combo = 0; FX.sfx.cash(); floats.add(t.x, t.y - 50, '+$' + got, '#4ade80', 20); if (S.combo >= 2) floats.add(t.x, t.y - 28, L('連擊 x', 'Combo x') + S.combo, '#fde047', 13); parts.burst(t.x, t.y - 20, 12, { c: ['#fde047', '#fbbf24', '#fff'], sp: 170, life: 0.6, size: 4, g: 400, up: 1, round: 1 }); if (S.served === 5 || S.served === 12) { S.nT++; floats.add(W / 2, 330, L('🎉 多開一桌！', '🎉 New table opened!'), '#7dd3fc', 20); FX.sfx.great(); } }
    else { S.lives--; S.combo = 0; FX.sfx.crash(); floats.add(t.x, t.y - 50, L('不吃了！', 'We\'re leaving!'), '#f87171', 16); S.cook = S.cook.filter(function (c) { return c.table !== t.id; }); S.pass = S.pass.map(function (d) { return d && d.table === t.id ? null : d; }); S.w.hands = S.w.hands.filter(function (d) { return d.table !== t.id; }); if (S.lives <= 0) end(); }
    t.p = null; t.st = 'dirty'; hud();
  }
  function perform(k) {
    var t = S.tables[k.a], w = S.w;
    if (k.type === 'order' && t.st === 'order') { t.st = 'food'; S.cook.push({ table: t.id, dish: t.p.dish, t: 4.2 + Math.random() * 1.6, max: 0 }); t.p.hearts = Math.min(5, t.p.hearts + 0.5); K.beep(820, 0.06, 'sine', 0.04); }
    else if (k.type === 'pick' && S.pass[k.a] && w.hands.length < 2) { w.hands.push(S.pass[k.a]); S.pass[k.a] = null; K.beep(520, 0.05, 'triangle', 0.04); }
    else if (k.type === 'serve' && t.st === 'food') { var idx = -1; w.hands.forEach(function (d, i) { if (d.table === t.id) idx = i; }); if (idx < 0) { FX.sfx.bad(); return; } w.hands.splice(idx, 1); t.st = 'eat'; t.t = 4.5; t.p.hearts = Math.min(5, t.p.hearts + 1); FX.sfx.good(); }
    else if (k.type === 'pay' && t.st === 'pay') leave(t, true);
    else if (k.type === 'clean' && t.st === 'dirty') { t.st = 'empty'; K.beep(1000, 0.05, 'sine', 0.03, 1400); parts.burst(t.x, t.y, 8, { c: '#e0f2fe', sp: 90, life: 0.4, size: 4, g: 0, round: 1 }); }
  }
  function target(k) { if (k.type === 'pick') return { x: passX(k.a), y: 122 }; var t = S.tables[k.a]; return { x: t.x - 2, y: t.y + 52 }; }
  function step(dt) {
    parts.step(dt); floats.step(dt); if (!S.run) return; S.t += dt; var hs = heartSec(), w = S.w;
    S.arrT -= dt; if (S.arrT <= 0) { if (S.queue.length < 3) { S.queue.push(party()); K.beep(880, 0.07, 'sine', 0.04); setTimeout(function () { K.beep(1100, 0.1, 'sine', 0.04); }, 90); } S.arrT = Math.max(3.2, 8.5 - S.served * 0.2) * (0.75 + Math.random() * 0.5); }
    for (var i = S.queue.length - 1; i >= 0; i--) { var q = S.queue[i]; q.hearts -= dt / (hs * 1.1); if (q.hearts <= 0) { S.queue.splice(i, 1); S.lives--; S.combo = 0; FX.sfx.crash(); floats.add(50, 250, L('等太久，走了！', 'Tired of waiting!'), '#f87171', 14); hud(); if (S.lives <= 0) { end(); return; } } }
    S.tables.forEach(function (t) { if (!t.p) return; if (t.st === 'read') { t.t -= dt; if (t.t <= 0) { t.st = 'order'; K.beep(900, 0.05, 'triangle', 0.03); } } else if (t.st === 'eat') { t.t -= dt; if (t.t <= 0) { t.st = 'pay'; K.beep(1000, 0.05, 'triangle', 0.03); } } else { t.p.hearts -= dt / (t.st === 'food' ? hs * 1.7 : hs); if (t.p.hearts <= 0) leave(t, false); } });
    if (!S.run) return;
    var cooking = 0; S.cook.forEach(function (c) { if (cooking >= 2) return; cooking++; if (!c.max) c.max = c.t; c.t -= dt; });
    for (i = S.cook.length - 1; i >= 0; i--) if (S.cook[i].t <= 0) { var slot = S.pass.indexOf(null); if (slot < 0) { S.cook[i].t = 0.01; continue; } S.pass[slot] = { table: S.cook[i].table, dish: S.cook[i].dish, pop: 0.3 }; S.cook.splice(i, 1); K.beep(1320, 0.1, 'sine', 0.05); }
    S.pass.forEach(function (d) { if (d && d.pop > 0) d.pop -= dt; });
    // 服務生
    if (!w.cur && S.tasks.length) { w.cur = S.tasks.shift(); w.wait = -1; }
    if (w.cur) { var tg = target(w.cur), dx = tg.x - w.x, dy = tg.y - w.y, d = Math.hypot(dx, dy); if (w.wait < 0) { if (d < 5) w.wait = w.cur.type === 'clean' ? 0.55 : w.cur.type === 'pick' ? 0.12 : 0.3; else { var v = Math.min(d, 270 * dt); w.x += dx / d * v; w.y += dy / d * v; w.ph += dt * 14; if (Math.abs(dx) > 2) w.dir = dx > 0 ? 1 : -1; } } else { w.wait -= dt; if (w.wait <= 0) { perform(w.cur); w.cur = null; } } }
  }
  function end() {
    S.run = false; S.over = true; var b = FX.best('scdiner_best', S.money), s0 = S;
    setTimeout(function () { if (S !== s0) return; FX.sfx.good(); $('endMoney').textContent = '$' + FX.fmt(S.money); $('endServed').textContent = S.served; $('endCombo').textContent = 'x' + S.best; $('endBest').textContent = b.isNew && S.money > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：$', 'Personal best: $') + FX.fmt(b.best); K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: S.money }); if (window.SCLB && S.money > 0) SCLB.offer({ game: GAME, mode: 'classic', score: S.money, text: '$' + FX.fmt(S.money) + L('・', ' · ') + S.served + L(' 桌', ' tables') }); }, 900);
  }
  // ---------- 繪圖 ----------
  function guy(x, y, m, mood, seated) { ctx.fillStyle = m.shirt; FX.rr(ctx, x - 11, y - 6, 22, seated ? 20 : 30, 8); ctx.fill(); ctx.fillStyle = m.skin; ctx.beginPath(); ctx.arc(x, y - 16, 10.5, 0, 7); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(x, y - 19, 10.5, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#1f1611'; ctx.beginPath(); ctx.arc(x - 3.5, y - 15, 1.4, 0, 7); ctx.arc(x + 3.5, y - 15, 1.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#1f1611'; ctx.lineWidth = 1.5; ctx.beginPath(); if (mood > 2.5) ctx.arc(x, y - 13, 3.5, 0.2, Math.PI - 0.2); else if (mood > 1.2) { ctx.moveTo(x - 3, y - 10.5); ctx.lineTo(x + 3, y - 10.5); } else ctx.arc(x, y - 8, 3.5, Math.PI + 0.3, -0.3); ctx.stroke(); }
  function hearts(x, y, h) { for (var i = 0; i < 5; i++) { ctx.globalAlpha = i < Math.ceil(h) ? (i + 1 > h ? 0.25 + (h - i) * 0.75 : 1) : 0.18; FX.text(ctx, '❤', x - 22 + i * 11, y, 10, h <= 1.5 ? '#ef4444' : '#f43f5e'); } ctx.globalAlpha = 1; }
  function bubble(x, y, ic, time, urgent) { var b = urgent ? Math.sin(time * 8) * 3 : 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y + b, 17, 0, 7); ctx.fill(); ctx.strokeStyle = urgent ? '#f43f5e' : '#d6d3d1'; ctx.lineWidth = 2.5; ctx.stroke(); FX.text(ctx, ic, x, y + b + 1, 19); }
  function draw(time) {
    hit.begin(); var i, w = S.w;
    ctx.fillStyle = '#f5e6d3'; ctx.fillRect(0, 0, W, H); for (i = 0; i < 14 * 16; i++) { if (((i % 14) + Math.floor(i / 14)) % 2) continue; ctx.fillStyle = '#ecd7bd'; ctx.fillRect((i % 14) * 36, 96 + Math.floor(i / 14) * 36, 36, 36); }
    ctx.fillStyle = '#7c2d12'; ctx.fillRect(0, 0, W, 96); ctx.fillStyle = '#9a3412'; ctx.fillRect(0, 88, W, 8);
    // 出菜口
    ctx.fillStyle = '#1c1917'; FX.rr(ctx, 150, 14, 316, 70, 8); ctx.fill(); ctx.fillStyle = '#44403c'; ctx.fillRect(150, 70, 316, 14); ctx.fillStyle = '#d6d3d1'; ctx.fillRect(146, 82, 324, 8);
    FX.text(ctx, '👨‍🍳', 176, 42, 26); var cooking = S.cook.slice(0, 2); cooking.forEach(function (c, k) { var f = c.max ? 1 - c.t / c.max : 0; ctx.fillStyle = '#57534e'; FX.rr(ctx, 156, 60 + k * 9 - 8 * 0, 40, 5, 2); ctx.fill(); ctx.fillStyle = '#f59e0b'; FX.rr(ctx, 156, 60 + k * 9, Math.max(4, 40 * f), 5, 2); ctx.fill(); });
    if (S.cook.length > 2) FX.text(ctx, '+' + (S.cook.length - 2), 208, 62, 11, '#a8a29e');
    for (i = 0; i < 4; i++) { var d = S.pass[i], px = passX(i) + 22; ctx.fillStyle = 'rgba(255,255,255,.06)'; FX.rr(ctx, px - 26, 20, 52, 48, 8); ctx.fill(); if (!d) continue; var sc = 1 + (d.pop > 0 ? d.pop : 0); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px, 48, 21 * sc, 13 * sc, 0, 0, 7); ctx.fill(); FX.text(ctx, d.dish, px, 42, 24 * sc); ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(px + 20, 26, 10, 0, 7); ctx.fill(); FX.text(ctx, String(d.table + 1), px + 20, 27, 12, '#fff'); if (has('pick', i)) { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; FX.rr(ctx, px - 26, 20, 52, 48, 8); ctx.stroke(); } hit.add(px - 30, 10, 60, 84, tapPass, i); }
    // 門口
    ctx.fillStyle = '#57534e'; FX.rr(ctx, 6, 110, 76, 250, 12); ctx.fill(); ctx.fillStyle = '#292524'; FX.rr(ctx, 12, 116, 64, 34, 8); ctx.fill(); FX.text(ctx, L('候位', 'Queue'), 44, 133, 13, '#fde68a');
    S.queue.forEach(function (q, k) { var qy = 200 + k * 62; q.m.forEach(function (m, j) { guy(34 + j * 22, qy, m, q.hearts, false); }); hearts(44, qy + 32, q.hearts); });
    if (S.queue.length && S.tables.some(function (t, k) { return k < S.nT && t.st === 'empty'; })) FX.text(ctx, L('點空桌帶位 →', 'Tap a table →'), 44, 380, 10.5, '#be123c');
    // 桌子
    S.tables.forEach(function (t, k) {
      if (k >= S.nT) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#a8a29e'; ctx.beginPath(); ctx.arc(t.x, t.y, 34, 0, 7); ctx.fill(); ctx.globalAlpha = 1; FX.text(ctx, '🔒', t.x, t.y, 18); return; }
      ctx.fillStyle = '#92400e'; FX.rr(ctx, t.x - 58, t.y - 14, 18, 30, 6); ctx.fill(); FX.rr(ctx, t.x + 40, t.y - 14, 18, 30, 6); ctx.fill();
      if (t.p) t.p.m.forEach(function (m, j) { guy(t.x + (j ? 49 : -49), t.y - 4, m, t.p.hearts, true); });
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 8, 36, 30, 0, 0, 7); ctx.fill(); ctx.fillStyle = t.st === 'empty' && S.queue.length ? '#fef9c3' : '#fff'; ctx.beginPath(); ctx.ellipse(t.x, t.y, 36, 30, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 3; ctx.stroke(); if (t.st === 'empty' && S.queue.length) { ctx.strokeStyle = 'rgba(234,179,8,' + (0.5 + Math.sin(time * 6) * 0.4) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(t.x, t.y, 41, 35, 0, 0, 7); ctx.stroke(); }
      FX.text(ctx, String(k + 1), t.x, t.y + 1, 15, 'rgba(225,29,72,.35)');
      if (t.st === 'eat') { FX.text(ctx, t.p.dish, t.x, t.y - 2, 26); } else if (t.st === 'pay') FX.text(ctx, '🍽️', t.x, t.y - 2, 22); else if (t.st === 'dirty') { FX.text(ctx, '🍽️', t.x - 8, t.y - 4, 18); FX.text(ctx, '🥤', t.x + 12, t.y + 4, 14); }
      var ic = t.st === 'read' ? '📖' : t.st === 'order' ? '📋' : t.st === 'food' ? '⏳' : t.st === 'eat' ? '😋' : t.st === 'pay' ? '💵' : t.st === 'dirty' ? '🧽' : null, act = t.st === 'order' || t.st === 'pay' || t.st === 'dirty' || (t.st === 'food' && (S.pass.some(function (d2) { return d2 && d2.table === k; }) || w.hands.some(function (d2) { return d2.table === k; })));
      if (t.st === 'food' && act) ic = t.p.dish; if (ic) bubble(t.x, t.y - 52, ic, time, act); if (t.p) hearts(t.x, t.y + 42, t.p.hearts);
      var qi = -1; S.tasks.forEach(function (q, j) { if (q.type !== 'pick' && q.a === k && qi < 0) qi = j; }); if (w.cur && w.cur.type !== 'pick' && w.cur.a === k) qi = -2; if (qi !== -1) { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(t.x + 24, t.y - 66, 9, 0, 7); ctx.fill(); FX.text(ctx, qi === -2 ? '…' : String(qi + 1), t.x + 24, t.y - 65, 11, '#422006'); }
      hit.add(t.x - 62, t.y - 72, 124, 126, tapTable, k);
    });
    // 服務生
    var bob = w.cur && w.wait < 0 ? Math.sin(w.ph) * 2.5 : 0; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(w.x, w.y + 18, 14, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#111827'; FX.rr(ctx, w.x - 12, w.y - 12 + bob, 24, 30, 8); ctx.fill(); ctx.fillStyle = '#fff'; FX.rr(ctx, w.x - 8, w.y - 2 + bob, 16, 20, 4); ctx.fill(); ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.moveTo(w.x - 5, w.y - 11 + bob); ctx.lineTo(w.x + 5, w.y - 7 + bob); ctx.lineTo(w.x + 5, w.y - 11 + bob); ctx.lineTo(w.x - 5, w.y - 7 + bob); ctx.fill();
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(w.x, w.y - 23 + bob, 11.5, 0, 7); ctx.fill(); ctx.fillStyle = '#3b2414'; ctx.beginPath(); ctx.arc(w.x, w.y - 26 + bob, 11.5, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#1f1611'; ctx.beginPath(); ctx.arc(w.x - 4 + w.dir, w.y - 22 + bob, 1.5, 0, 7); ctx.arc(w.x + 4 + w.dir, w.y - 22 + bob, 1.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#1f1611'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w.x + w.dir, w.y - 19 + bob, 3.5, 0.2, Math.PI - 0.2); ctx.stroke();
    w.hands.forEach(function (d2, j) { var hx = w.x + (j ? 22 : -22), hy = w.y - 22 + bob; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(hx, hy + 5, 14, 6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 1; ctx.stroke(); FX.text(ctx, d2.dish, hx, hy - 2, 17); ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(hx + 11, hy - 11, 7, 0, 7); ctx.fill(); FX.text(ctx, String(d2.table + 1), hx + 11, hy - 10.5, 9, '#fff'); });
    for (i = 0; i < 3; i++) FX.text(ctx, i < S.lives ? '❤️' : '🖤', 20 + i * 22, 30, 15); if (S.combo >= 2) FX.text(ctx, L('連擊 x', 'Combo x') + S.combo, 60, 58, 13, '#fde047');
    parts.draw(ctx); floats.draw(ctx);
    if (S.run && S.served === 0 && S.t < 30) { var tip = S.queue.length && S.tables.every(function (t) { return t.st === 'empty'; }) ? L('有客人了！點任何一張空桌讓他們入座', 'Guests! Tap any free table to seat them') : S.tables.some(function (t) { return t.st === 'order'; }) ? L('點 📋 的桌子去點餐', 'Tap the 📋 table to take the order') : S.pass.some(Boolean) && !w.hands.length ? L('菜好了！點上方的菜拿起來', 'Order up! Tap the dish at the top') : w.hands.length ? L('點那一桌把菜送過去', 'Tap that table to serve the dish') : S.tables.some(function (t) { return t.st === 'pay'; }) ? L('點 💵 的桌子收錢', 'Tap the 💵 table to collect payment') : null; if (tip) { ctx.font = '900 13px system-ui'; var tw = ctx.measureText(tip).width + 30; ctx.fillStyle = 'rgba(26,15,20,.9)'; FX.rr(ctx, (W - tw) / 2, 606, tw, 34, 17); ctx.fill(); FX.text(ctx, tip, W / 2, 623.5, 13, '#fde047'); } }
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__dn = { S: function () { return S; }, go: start, step: step, table: tapTable, pass: tapPass };
})();
