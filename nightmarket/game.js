/* 夜市大亨 — stockcorp.github.io/nightmarket/
   14 天回合制。每天：看預報（85% 準）與人潮 → 設定各攤備料量與售價 → 開市（動畫）→ 結算。
   需求 = 人潮 × 商品佔比 × 天氣係數 × 人氣 × (參考價/售價)^1.7 × 設備加成 × 隨機。
   人氣：價格公道且供應足 → 上升；太貴或常賣光 → 下降。排行榜：mode = 14days，比最終資金。 */
(function () {
  'use strict';
  var GAME = 'nightmarket', $ = K.$, L = K.L, W = 480, H = 660, DAYS = 14, RENT = 80;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(120), floats = FX.Floats(), crowdN = FX.Noise('bandpass');
  var P = [
    { e: '🍗', zh: '雞排', en: 'Fried chicken', share: 0.22, p0: 80, cost: 35, w: [1, 1, 0.9, 1.15, 0.85], buy: 0, c: '#f59e0b' },
    { e: '🧋', zh: '珍奶', en: 'Boba tea', share: 0.25, p0: 55, cost: 18, w: [1.15, 1, 0.8, 0.55, 1.6], buy: 2500, c: '#a16207' },
    { e: '🍡', zh: '地瓜球', en: 'Potato balls', share: 0.2, p0: 40, cost: 12, w: [1, 1, 0.85, 1.05, 0.9], buy: 2000, c: '#f97316' },
    { e: '🍧', zh: '剉冰', en: 'Shaved ice', share: 0.16, p0: 70, cost: 22, w: [1.3, 0.9, 0.5, 0.2, 2.0], buy: 4000, c: '#38bdf8' },
    { e: '🍲', zh: '麻辣燙', en: 'Hot pot', share: 0.14, p0: 120, cost: 55, w: [0.8, 1, 1.2, 1.8, 0.45], buy: 6000, c: '#dc2626' }
  ];
  var WX = [{ e: '☀️', zh: '晴天', en: 'Sunny', m: 1.1 }, { e: '☁️', zh: '陰天', en: 'Cloudy', m: 1 }, { e: '🌧️', zh: '下雨', en: 'Rain', m: 0.55 }, { e: '🥶', zh: '寒流', en: 'Cold snap', m: 0.8 }, { e: '🥵', zh: '悶熱', en: 'Hot', m: 0.95 }];
  var EV = [{ zh: '平日', en: 'Weekday', n: 300 }, { zh: '週末', en: 'Weekend', n: 450 }, { zh: '廟會', en: 'Temple fair', n: 650 }, { zh: '連假', en: 'Holiday', n: 550 }];
  var UP = [{ id: 'sign', e: '💡', zh: '霓虹招牌', en: 'Neon sign', cost: 3500, d: ['所有攤位客人 +20%', '+20% customers at every stall'] }, { id: 'fridge', e: '🧊', zh: '大冰箱', en: 'Big fridge', cost: 3000, d: ['賣剩的食材 60% 留到明天', 'Keep 60% of leftovers for tomorrow'] }, { id: 'app', e: '📱', zh: '外送合作', en: 'Delivery app', cost: 8000, d: ['所有攤位客人再 +25%', 'Another +25% customers'] }];
  var people = [];
  function rollDay(d) { var r = Math.random(), wx = r < 0.3 ? 0 : r < 0.52 ? 1 : r < 0.68 ? 2 : r < 0.82 ? 3 : 4, ev = d % 7 === 5 || d % 7 === 6 ? 1 : 0; if (d === 4 || d === 11) ev = 2; if (d === 13) ev = 3; var fc = Math.random() < 0.85 ? wx : (wx + 1 + Math.floor(Math.random() * 4)) % 5; return { wx: wx, fc: fc, ev: ev }; }
  function reset() {
    S = { ph: 'plan', run: false, over: false, started: false, money: 3000, day: 0, rep: 1, own: [true, false, false, false, false], qty: [60, 0, 0, 0, 0], price: P.map(function (p) { return p.p0; }), stock: [0, 0, 0, 0, 0], last: [null, null, null, null, null], up: {}, today: rollDay(0), res: null, nt: 0, bestDay: 0, shop: false, sold: [0, 0, 0, 0, 0] };
    people = []; parts.clear(); floats.clear(); hud();
  }
  function hud() { $('money').textContent = FX.money(S.money); $('day').textContent = Math.min(DAYS, S.day + 1) + '/' + DAYS; $('rep').textContent = Math.round(S.rep * 100); }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, '14days'); if (window.SC) SC.post('start', { game: GAME }); }
  function planCost() { var c = 0; for (var i = 0; i < 5; i++) if (S.own[i]) c += Math.max(0, S.qty[i] - S.stock[i]) * P[i].cost + RENT; return c; }
  function foodCost() { var c = 0; for (var i = 0; i < 5; i++) if (S.own[i]) c += Math.max(0, S.qty[i] - S.stock[i]) * P[i].cost; return c; }
  function adj(a) { if (S.ph !== 'plan' || S.shop) return; var i = a[0]; if (a[1] === 'q') S.qty[i] = FX.clamp(S.qty[i] + a[2], 0, 600); else S.price[i] = FX.clamp(S.price[i] + a[2], Math.round(P[i].p0 * 0.5 / 5) * 5, P[i].p0 * 2); K.beep(a[2] > 0 ? 660 : 520, 0.04, 'triangle', 0.03); }
  function open() {
    if (S.ph !== 'plan' || S.shop) return; var cost = planCost(), food = foodCost(); if (cost > S.money && food > 0) { K.toast(L('錢不夠備這麼多料', 'Not enough cash for that much stock')); FX.sfx.bad(); return; }
    var t = S.today, wx = WX[t.wx], crowd = EV[t.ev].n * wx.m, boost = (S.up.sign ? 1.2 : 1) * (S.up.app ? 1.25 : 1), R = { rows: [], rev: 0, cost: 0, rent: 0, rep0: S.rep, wx: t.wx, miss: t.wx !== t.fc }, repD = 0, n = 0;
    for (var i = 0; i < 5; i++) {
      if (!S.own[i]) continue; n++; var p = P[i], q = S.qty[i], buyN = Math.max(0, q - S.stock[i]), dem = Math.round(crowd * p.share * p.w[t.wx] * S.rep * Math.pow(p.p0 / S.price[i], 1.7) * boost * (t.ev >= 1 && i === 2 ? 1.25 : 1) * (0.88 + Math.random() * 0.24)), sold = Math.min(q, dem), left = q - sold;
      R.rows.push({ i: i, q: q, dem: dem, sold: sold, rev: sold * S.price[i], cost: buyN * p.cost, left: left }); R.rev += sold * S.price[i]; R.cost += buyN * p.cost; R.rent += RENT;
      var ratio = S.price[i] / p.p0, unmet = dem > 0 ? (dem - sold) / dem : 0; repD += (ratio > 1.3 ? -0.035 : ratio <= 1.0 ? 0.02 : 0) + (q > 0 && unmet > 0.3 ? -0.03 : q > 0 && unmet < 0.1 ? 0.025 : 0) + (q === 0 ? -0.02 : 0);
      S.last[i] = { dem: dem, sold: sold, price: S.price[i] }; S.stock[i] = S.up.fridge ? Math.floor(left * 0.6) : 0;
    }
    R.net = R.rev - R.cost - R.rent; S.money -= R.cost + R.rent; S.rep = FX.clamp(S.rep + repD / Math.max(1, n) * 1.2, 0.5, 2); R.rep1 = S.rep; S.res = R; S.ph = 'night'; S.nt = 0; S.sold = [0, 0, 0, 0, 0]; people = []; hud(); FX.sfx.go();
  }
  function skip() { if (S.ph === 'night') S.nt = Math.max(S.nt, 5.9); }
  function next() {
    if (S.ph !== 'result') return; S.day++; FX.sfx.click();
    if (S.day >= DAYS) { end(); return; }
    S.today = rollDay(S.day); S.ph = 'plan'; hud();
    for (var i = 0; i < 5; i++) if (S.own[i] && S.last[i]) S.qty[i] = Math.max(S.stock[i], Math.round(S.last[i].dem / 10) * 10);
  }
  function buy(a) {
    if (a[0] === 's') { var i = a[1]; if (S.own[i] || S.money < P[i].buy) { FX.sfx.bad(); return; } S.money -= P[i].buy; S.own[i] = true; S.qty[i] = 40; }
    else { var u = UP[a[1]]; if (S.up[u.id] || S.money < u.cost) { FX.sfx.bad(); return; } S.money -= u.cost; S.up[u.id] = 1; }
    FX.sfx.great(); hud();
  }
  function step(dt) {
    parts.step(dt); floats.step(dt);
    if (S.ph !== 'night') { crowdN.set(0); return; }
    S.nt += dt; var f = Math.min(1, S.nt / 6), R = S.res;
    R.rows.forEach(function (r) { var tgt = Math.floor(r.sold * f), x = 58 + r.i * 91; if (tgt > S.sold[r.i]) { var d = tgt - S.sold[r.i]; S.sold[r.i] = tgt; if (Math.random() < 0.35) { floats.add(x + (Math.random() - 0.5) * 30, 120, '+$' + S.price[r.i] * d, '#fde047', 12); K.beep(900 + r.i * 80, 0.03, 'triangle', 0.02); } } });
    if (people.length < 26 && Math.random() < dt * 9 * WX[R.wx].m) { var dir = Math.random() < 0.5 ? 1 : -1; people.push({ x: dir > 0 ? -12 : W + 12, y: 158 + Math.random() * 34, v: dir * (40 + Math.random() * 50), c: FX.pick(['#f87171', '#60a5fa', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#f1f5f9']), stop: 0, ph: Math.random() * 6 }); }
    for (var i = people.length - 1; i >= 0; i--) { var p = people[i]; if (p.stop > 0) p.stop -= dt; else { p.x += p.v * dt * (S.nt > 5.9 ? 4 : 1); if (Math.random() < dt * 0.5) p.stop = 0.5 + Math.random(); } if (p.x < -20 || p.x > W + 20) people.splice(i, 1); }
    crowdN.set(K.muted ? 0 : 0.012, 700);
    if (S.nt >= 6.6) { S.ph = 'result'; S.money += R.rev; S.bestDay = Math.max(S.bestDay, R.net); crowdN.stop(); if (R.net >= 0) FX.sfx.cash(); else FX.sfx.bad(); hud(); }
  }
  function end() {
    S.ph = 'over'; S.run = false; S.over = true; var m = Math.round(S.money), b = FX.best('scnm_best', m), n = S.own.filter(Boolean).length; FX.sfx.great();
    $('endMoney').textContent = FX.money(m); $('endBestDay').textContent = FX.money(S.bestDay); $('endStall').textContent = n + '/5'; $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.money(b.best);
    K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: m }); if (window.SCLB && m > 0) SCLB.offer({ game: GAME, mode: '14days', score: m, text: FX.money(m) });
  }
  // ---------- 繪圖 ----------
  function scene(time) {
    var night = S.ph === 'night' || S.ph === 'result', g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, night ? '#0b1026' : '#3b2a5c'); g.addColorStop(1, night ? '#2a1a3e' : '#f59e6b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; for (var i = 0; i < 24; i++) ctx.fillRect((i * 83) % W, (i * 37) % 60, 1.5, 1.5);
    ctx.fillStyle = night ? '#141a33' : '#3a2d52'; for (i = 0; i < 7; i++) ctx.fillRect(i * 74 - 6, 50 - (i * 29) % 28, 60, 110);
    ctx.fillStyle = '#3a3340'; ctx.fillRect(0, 150, W, 50); ctx.fillStyle = '#4a4252'; ctx.fillRect(0, 150, W, 4);
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 26); ctx.quadraticCurveTo(120, 46, 240, 28); ctx.quadraticCurveTo(360, 46, 480, 26); ctx.stroke();
    for (i = 0; i < 17; i++) { var lx = 14 + i * 28.5, ly = 30 + Math.sin(i / 16 * Math.PI * 2) * -8 + 8; ctx.fillStyle = ['#f87171', '#fde047', '#4ade80', '#60a5fa', '#f472b6'][i % 5]; ctx.globalAlpha = night ? 0.75 + Math.sin(time * 4 + i) * 0.25 : 0.6; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    for (i = 0; i < 5; i++) {
      var x = 16 + i * 91, p = P[i];
      if (!S.own[i]) { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(x + 4, 82, 76, 68); ctx.setLineDash([]); FX.text(ctx, L('空位', 'Vacant'), x + 42, 118, 11, 'rgba(255,255,255,.3)'); continue; }
      ctx.fillStyle = '#5b4636'; ctx.fillRect(x + 6, 78, 5, 74); ctx.fillRect(x + 73, 78, 5, 74); ctx.fillStyle = '#e7e5e4'; ctx.fillRect(x + 4, 122, 76, 30); ctx.fillStyle = p.c; ctx.fillRect(x + 4, 122, 76, 6);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(x - 2, 84); ctx.lineTo(x + 86, 84); ctx.lineTo(x + 80, 64); ctx.lineTo(x + 4, 64); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (var k = 0; k < 4; k++) ctx.fillRect(x + 8 + k * 20, 64, 9, 20);
      if (night) { var gl = ctx.createRadialGradient(x + 42, 100, 4, x + 42, 100, 60); gl.addColorStop(0, 'rgba(253,224,71,.4)'); gl.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 20, 50, 124, 110); }
      FX.text(ctx, p.e, x + 42, 104, 26); if (S.up.sign) { ctx.strokeStyle = 'hsl(' + ((time * 120 + i * 60) % 360) + ',100%,65%)'; ctx.lineWidth = 2; ctx.strokeRect(x + 3, 63, 78, 22); }
      if (night) { var r = null; S.res.rows.forEach(function (o) { if (o.i === i) r = o; }); if (r) { var out = S.sold[i] >= r.q && r.dem > r.q; if (out) { ctx.fillStyle = '#dc2626'; FX.rr(ctx, x + 10, 128, 64, 18, 4); ctx.fill(); FX.text(ctx, L('賣完了', 'SOLD OUT'), x + 42, 137.5, 11, '#fff'); } else FX.text(ctx, S.sold[i] + '/' + r.q, x + 42, 138, 12, '#1f2937'); } }
    }
    people.forEach(function (q) { var bob = q.stop > 0 ? 0 : Math.sin(time * 10 + q.ph) * 2; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 12, 7, 2.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = q.c; FX.rr(ctx, q.x - 6, q.y - 6 + bob, 12, 17, 5); ctx.fill(); ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(q.x, q.y - 11 + bob, 5.5, 0, 7); ctx.fill(); });
    if (S.ph === 'night' && S.res.wx === 2) { ctx.strokeStyle = 'rgba(186,230,253,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (i = 0; i < 40; i++) { var rx = (i * 97 + time * 200) % W, ry = (i * 53 + time * 700) % 200; ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); } ctx.stroke(); }
  }
  function panel(x, y, w, h, c) { ctx.fillStyle = c || '#22121e'; FX.rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke(); }
  function draw(time) {
    hit.begin(); ctx.fillStyle = '#140a12'; ctx.fillRect(0, 0, W, H); scene(time); var i, t = S.today, y;
    if (S.ph === 'plan' || S.ph === 'over') {
      panel(8, 206, 464, 58); var fw = WX[t.fc], ev = EV[t.ev];
      FX.text(ctx, fw.e, 38, 236, 30); FX.text(ctx, L('預報：', 'Forecast: ') + L(fw.zh, fw.en), 62, 226, 15, '#fff', 'left'); FX.text(ctx, [L('一切正常', 'Business as usual'), L('普通的一天', 'An ordinary day'), L('人潮少一半，別備太多', 'Half the crowd — stock less'), L('麻辣燙大賣，冰品滯銷', 'Hot pot booms, ice flops'), L('冰品、珍奶大賣', 'Ice and boba sell big')][t.fc], 62, 247, 11.5, '#fda4af', 'left');
      ctx.fillStyle = t.ev ? '#b45309' : '#374151'; FX.rr(ctx, 330, 216, 132, 38, 10); ctx.fill(); FX.text(ctx, (t.ev === 2 ? '🏮 ' : t.ev ? '🎉 ' : '') + L(ev.zh, ev.en), 396, 228, 14, '#fff'); FX.text(ctx, L('人潮約 ', 'Crowd ~') + ev.n, 396, 245, 11, '#fde68a');
      y = 270; var rows = 0;
      for (i = 0; i < 5; i++) {
        if (!S.own[i]) continue; var p = P[i], ry = y + rows * 60; rows++; panel(8, ry, 464, 55);
        FX.text(ctx, p.e, 30, ry + 21, 24); FX.text(ctx, L(p.zh, p.en), 50, ry + 15, 13, '#fff', 'left'); var la = S.last[i];
        FX.text(ctx, la ? L('昨天想買 ', 'Wanted: ') + la.dem + L(' 賣 ', ' sold ') + la.sold : L('成本 $', 'Cost $') + p.cost + L(' 參考價 $', ' · ref $') + p.p0, 16, ry + 42, 10.5, la && la.dem > la.sold ? '#fca5a5' : '#a8a29e', 'left');
        FX.button(ctx, 172, ry + 8, 36, 40, '−', { bg: '#475569', size: 20 }); hit.add(172, ry + 4, 36, 48, adj, [i, 'q', -10]); FX.text(ctx, String(S.qty[i]), 236, ry + 21, 17, '#fff'); FX.text(ctx, L('份', 'pcs') + (S.stock[i] ? L(' (庫存' , ' (kept ') + S.stock[i] + ')' : ''), 236, ry + 41, 9.5, '#94a3b8'); FX.button(ctx, 264, ry + 8, 36, 40, '+', { bg: '#475569', size: 20 }); hit.add(264, ry + 4, 36, 48, adj, [i, 'q', 10]);
        FX.button(ctx, 320, ry + 8, 36, 40, '−', { bg: '#7c2d12', size: 20 }); hit.add(320, ry + 4, 36, 48, adj, [i, 'p', -5]); var rt = S.price[i] / p.p0; FX.text(ctx, '$' + S.price[i], 388, ry + 21, 17, rt > 1.3 ? '#f87171' : rt <= 1 ? '#86efac' : '#fde047'); FX.text(ctx, rt > 1.3 ? L('太貴', 'Pricey') : rt < 0.85 ? L('佛心', 'Bargain') : rt <= 1 ? L('公道', 'Fair') : L('偏貴', 'High'), 388, ry + 41, 9.5, '#94a3b8'); FX.button(ctx, 420, ry + 8, 36, 40, '+', { bg: '#7c2d12', size: 20 }); hit.add(420, ry + 4, 36, 48, adj, [i, 'p', 5]);
      }
      var cost = planCost(), ok = cost <= S.money || foodCost() === 0; FX.text(ctx, L('今日支出（食材＋攤租）', 'Today\'s spend (stock + rent)'), 14, 584, 11.5, '#a8a29e', 'left'); FX.text(ctx, FX.money(cost), 14, 604, 18, ok ? '#fde047' : '#f87171', 'left');
      FX.button(ctx, 8, 618, 150, 36, L('🛒 商店', '🛒 Shop'), { bg: '#6d28d9', size: 14 }); hit.add(8, 614, 150, 44, function () { S.shop = true; FX.sfx.click(); });
      FX.button(ctx, 250, 590, 222, 62, L('開市 ▶', 'Open ▶'), { bg: ok ? '#e11d48' : '#3a4152', size: 22, off: !ok }); hit.add(250, 590, 222, 62, open);
    } else if (S.ph === 'night') {
      panel(8, 206, 464, 446); var aw = WX[S.res.wx]; FX.text(ctx, aw.e, W / 2, 300, 64); FX.text(ctx, L('今晚：', 'Tonight: ') + L(aw.zh, aw.en) + (S.res.miss ? L('（預報失準！）', ' (forecast was wrong!)') : ''), W / 2, 360, 17, S.res.miss ? '#fca5a5' : '#fff');
      var tot = 0; S.res.rows.forEach(function (r) { tot += S.sold[r.i] * S.price[r.i]; }); FX.text(ctx, L('營業中… ', 'Open… ') + FX.money(tot), W / 2, 410, 26, '#fde047'); ctx.fillStyle = '#42233a'; FX.rr(ctx, 60, 450, 360, 12, 6); ctx.fill(); ctx.fillStyle = '#e11d48'; FX.rr(ctx, 60, 450, Math.max(12, 360 * Math.min(1, S.nt / 6)), 12, 6); ctx.fill();
      FX.button(ctx, 170, 500, 140, 44, L('快轉 ⏩', 'Skip ⏩'), { bg: '#475569' }); hit.add(170, 500, 140, 44, skip);
    } else if (S.ph === 'result') {
      panel(8, 206, 464, 446); var R = S.res; FX.text(ctx, L('第 ', 'Day ') + (S.day + 1) + L(' 天結算', ' results') + '　' + WX[R.wx].e, W / 2, 228, 17, '#fff');
      FX.text(ctx, L('攤位', 'Stall'), 20, 256, 11, '#94a3b8', 'left'); FX.text(ctx, L('賣出/備料', 'Sold/Made'), 200, 256, 11, '#94a3b8'); FX.text(ctx, L('想買', 'Wanted'), 290, 256, 11, '#94a3b8'); FX.text(ctx, L('營收', 'Revenue'), 460, 256, 11, '#94a3b8', 'right');
      R.rows.forEach(function (r, k) { var yy = 282 + k * 34, p = P[r.i]; ctx.fillStyle = 'rgba(255,255,255,.04)'; FX.rr(ctx, 14, yy - 15, 452, 30, 8); ctx.fill(); FX.text(ctx, p.e + ' ' + L(p.zh, p.en), 20, yy, 13, '#fff', 'left'); FX.text(ctx, r.sold + '/' + r.q, 200, yy, 13, r.left > r.q * 0.3 ? '#fca5a5' : '#fff'); FX.text(ctx, String(r.dem), 290, yy, 13, r.dem > r.q ? '#fde047' : '#cbd5e1'); FX.text(ctx, r.dem > r.q ? L('不夠賣', 'Sold out') : r.left > r.q * 0.3 ? L('剩太多', 'Wasted') : '👍', 350, yy, 11, r.dem > r.q ? '#fde047' : '#fca5a5'); FX.text(ctx, FX.money(r.rev), 460, yy, 13, '#86efac', 'right'); });
      y = 470; [[L('營收', 'Revenue'), R.rev, '#86efac'], [L('食材成本', 'Ingredients'), -R.cost, '#fca5a5'], [L('攤租', 'Rent'), -R.rent, '#fca5a5']].forEach(function (a, k) { FX.text(ctx, a[0], 30, y + k * 22, 13, '#cbd5e1', 'left'); FX.text(ctx, (a[1] < 0 ? '−' : '') + FX.money(Math.abs(a[1])), 450, y + k * 22, 13, a[2], 'right'); });
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(24, 528, 432, 1.5); FX.text(ctx, L('今日淨利', 'Net profit'), 30, 548, 16, '#fff', 'left'); FX.text(ctx, (R.net < 0 ? '−' : '+') + FX.money(Math.abs(R.net)), 450, 548, 20, R.net >= 0 ? '#fde047' : '#f87171', 'right');
      var dr = Math.round((R.rep1 - R.rep0) * 100); FX.text(ctx, L('人氣 ', 'Fame ') + Math.round(R.rep1 * 100) + (dr ? ' (' + (dr > 0 ? '+' : '') + dr + ')' : ''), 30, 574, 12.5, dr >= 0 ? '#86efac' : '#fca5a5', 'left');
      FX.button(ctx, 250, 596, 222, 52, S.day + 1 >= DAYS ? L('看結果 ▶', 'Final result ▶') : L('下一天 ▶', 'Next day ▶'), { bg: '#e11d48', size: 19 }); hit.add(250, 596, 222, 52, next);
    }
    if (S.shop) {
      hit.begin(); ctx.fillStyle = 'rgba(8,4,10,.82)'; ctx.fillRect(0, 0, W, H); panel(14, 40, 452, 590, '#2a1626'); FX.text(ctx, L('🛒 商店', '🛒 Shop'), W / 2, 68, 20, '#fff'); FX.text(ctx, L('資金 ', 'Cash ') + FX.money(S.money), W / 2, 94, 14, '#fde047');
      var items = []; for (i = 1; i < 5; i++) items.push(['s', i, P[i].e + ' ' + L(P[i].zh + '攤', P[i].en + ' stall'), L('成本 $', 'Cost $') + P[i].cost + L('・參考價 $', ' · ref $') + P[i].p0, P[i].buy, S.own[i]]); UP.forEach(function (u, k) { items.push(['u', k, u.e + ' ' + L(u.zh, u.en), L(u.d[0], u.d[1]), u.cost, !!S.up[u.id]]); });
      items.forEach(function (it, k) { var yy = 114 + k * 64; ctx.fillStyle = 'rgba(255,255,255,.05)'; FX.rr(ctx, 26, yy, 428, 56, 10); ctx.fill(); FX.text(ctx, it[2], 38, yy + 19, 14.5, '#fff', 'left'); FX.text(ctx, it[3], 38, yy + 40, 11, '#cbd5e1', 'left'); if (it[5]) FX.text(ctx, L('✓ 已擁有', '✓ Owned'), 400, yy + 28, 13, '#86efac'); else { var can = S.money >= it[4]; FX.button(ctx, 348, yy + 9, 96, 38, FX.money(it[4]), { bg: '#16a34a', off: !can, size: 14 }); if (can) hit.add(348, yy + 5, 96, 46, buy, [it[0], it[1]]); } });
      FX.button(ctx, 150, 576, 180, 42, L('關閉', 'Close'), { bg: '#475569', size: 15 }); hit.add(150, 572, 180, 50, function () { S.shop = false; FX.sfx.click(); });
    }
    parts.draw(ctx); floats.draw(ctx);
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(function () { if (K.muted) crowdN.stop(); }); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__nm = { WX: WX, EV: EV, S: function () { return S; }, go: start, open: open, skip: skip, next: next, buy: buy, adj: adj, P: P, step: step };
})();
