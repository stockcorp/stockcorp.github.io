/* 開心農場 — stockcorp.github.io/farm/
   一季 240 秒。5×4 田地（一開始開 6 格），5 種作物依累計收入解鎖。
   作物長到 40% 會口渴要澆水，成熟後 18 秒沒收會枯掉；烏鴉 4 秒內沒趕走會吃掉作物；偶爾下雨（自動澆水、成長 +50%）。
   設備：灑水器 2 級、肥料 3 級、稻草人、收割機。排行榜：mode = season，比季末資金。 */
(function () {
  'use strict';
  var GAME = 'farm', $ = K.$, L = K.L, W = 480, H = 660, TIME = 240, COLS = 5, ROWS = 4, PS = 84, GX = 22, GY = 92, PT = 88;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(200), floats = FX.Floats(), rainN = FX.Noise('highpass');
  var CROPS = [{ e: '🥕', zh: '紅蘿蔔', en: 'Carrot', cost: 10, t: 8, sell: 24, at: 0 }, { e: '🍅', zh: '番茄', en: 'Tomato', cost: 40, t: 14, sell: 100, at: 150 }, { e: '🌽', zh: '玉米', en: 'Corn', cost: 120, t: 22, sell: 330, at: 800 }, { e: '🍓', zh: '草莓', en: 'Berry', cost: 400, t: 30, sell: 1150, at: 4000 }, { e: '🎃', zh: '南瓜', en: 'Pumpkin', cost: 1500, t: 42, sell: 4600, at: 20000 }];
  var UPS = [{ id: 'spr', e: '💦', zh: '灑水器', en: 'Sprinkler', cost: [150, 900], d: ['自動澆水', 'Auto-water'] }, { id: 'fer', e: '🧪', zh: '肥料', en: 'Fertiliser', cost: [200, 1200, 6000], d: ['成長 +25%', 'Growth +25%'] }, { id: 'sca', e: '🎃', zh: '稻草人', en: 'Scarecrow', cost: [500], d: ['趕走烏鴉', 'No crows'] }, { id: 'har', e: '🚜', zh: '收割機', en: 'Harvester', cost: [2500], d: ['自動收成', 'Auto-harvest'] }];
  UPS[2].e = '🧍';
  var START = [6, 7, 8, 11, 12, 13], ground = document.createElement('canvas'); ground.width = W; ground.height = H;
  (function () { var g = ground.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7ec850'); gr.addColorStop(1, '#5aa83a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (var i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,60,0,.09)'; var x = Math.random() * W, y = 60 + Math.random() * 400; g.fillRect(x, y, 2, 5); } g.fillStyle = '#9ad0f5'; g.fillRect(0, 0, W, 62); g.fillStyle = '#6fb544'; g.beginPath(); g.ellipse(120, 66, 170, 26, 0, Math.PI, 0); g.ellipse(380, 66, 150, 20, 0, Math.PI, 0); g.fill(); g.fillStyle = '#b91c1c'; g.fillRect(396, 24, 56, 40); g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(388, 26); g.lineTo(424, 4); g.lineTo(460, 26); g.fill(); g.fillStyle = '#fef3c7'; g.fillRect(416, 42, 16, 22); g.strokeStyle = '#fef3c7'; g.lineWidth = 2; g.strokeRect(402, 30, 10, 10); g.strokeRect(436, 30, 10, 10); g.fillStyle = '#e8d5a8'; for (i = 0; i < 13; i++) { g.fillRect(8 + i * 38, 62, 5, 18); } g.fillRect(0, 66, W, 4); g.fillRect(0, 74, W, 3); g.fillStyle = '#4a3a22'; g.fillRect(0, 446, W, H - 446); g.fillStyle = '#5c4a2e'; g.fillRect(0, 446, W, 5); })();

  function reset() {
    S = { run: false, over: false, started: false, money: 50, earned: 0, t: TIME, harv: 0, sel: 0, plots: [], up: { spr: 0, fer: 0, sca: 0, har: 0 }, crows: [], crowT: 16, rain: 0, rainT: 35 + Math.random() * 25, drag: false, unl: 0, bought: 0 };
    for (var i = 0; i < COLS * ROWS; i++) S.plots.push({ open: START.indexOf(i) >= 0, crop: -1, g: 0, st: 0, wet: 0, ripeT: 0, gold: false, thirstT: 0, pop: 0 });
    parts.clear(); floats.clear(); hud();
  }
  function hud() { $('money').textContent = FX.money(S.money); var t = Math.max(0, Math.ceil(S.t)); $('time').textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + t % 60; $('harv').textContent = S.harv; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, 'season'); if (window.SC) SC.post('start', { game: GAME }); }
  function pxy(i) { return { x: GX + (i % COLS) * PT, y: GY + Math.floor(i / COLS) * PT }; }
  function plotCost() { return Math.round(60 * Math.pow(1.42, S.bought) / 10) * 10; }
  function pay(n) { if (S.money < n) { K.toast(L('錢不夠', 'Not enough money')); FX.sfx.bad(); return false; } S.money -= n; hud(); return true; }
  function tapPlot(i, dragging) {
    if (!S.run) return; var p = S.plots[i], c = pxy(i), cx = c.x + PS / 2, cy = c.y + PS / 2;
    for (var k = 0; k < S.crows.length; k++) if (S.crows[k].i === i && S.crows[k].land) { shoo(S.crows[k]); return; }
    if (!p.open) { if (dragging) return; var cost = plotCost(); if (!pay(cost)) return; p.open = true; S.bought++; p.pop = 0.3; FX.sfx.good(); parts.burst(cx, cy, 16, { c: ['#a16207', '#ca8a04', '#fde047'], sp: 160, life: 0.5, size: 5, g: 300, up: 1 }); return; }
    if (p.crop < 0) { var cr = CROPS[S.sel]; if (S.money < cr.cost) { if (!dragging) { K.toast(L('錢不夠買種子', 'Not enough money for seeds')); FX.sfx.bad(); } return; } S.money -= cr.cost; p.crop = S.sel; p.g = 0; p.st = 0; p.wet = 0; p.gold = false; p.pop = 0.2; K.beep(500, 0.05, 'triangle', 0.04); hud(); return; }
    if (p.st === 1) { water(p, cx, cy); return; }
    if (p.st === 2) { harvest(i); return; }
    if (p.st === 3) { p.crop = -1; p.st = 0; K.beep(200, 0.08, 'sawtooth', 0.03); }
  }
  function water(p, cx, cy) { p.st = 0; p.wet = 6; p.g = Math.max(p.g, 0.41); K.beep(900, 0.08, 'sine', 0.04, 500); parts.burst(cx, cy - 10, 8, { c: '#7dd3fc', sp: 120, life: 0.5, size: 4, g: 500, round: 1, up: 1 }); }
  function harvest(i) { var p = S.plots[i], c = pxy(i), cr = CROPS[p.crop], v = cr.sell * (p.gold ? 3 : 1); S.money += v; S.earned += v; S.harv++; p.crop = -1; p.st = 0; p.pop = 0.2; FX.sfx.coin(); floats.add(c.x + PS / 2, c.y + 10, '+' + FX.money(v), p.gold ? '#fde047' : '#fff', p.gold ? 20 : 15); parts.burst(c.x + PS / 2, c.y + PS / 2, p.gold ? 20 : 8, { c: ['#fde047', '#fbbf24', '#fff'], sp: 170, life: 0.6, size: 4, g: 400, up: 1, round: 1 }); CROPS.forEach(function (o, k) { if (k > S.unl && S.earned >= o.at) { S.unl = k; floats.add(W / 2, 250, L('新種子：', 'New seed: ') + o.e + ' ' + L(o.zh, o.en), '#7dd3fc', 20); FX.sfx.great(); } }); hud(); }
  function shoo(c) { c.land = false; c.away = true; K.beep(700, 0.12, 'square', 0.04, 1400); floats.add(c.x, c.y - 20, L('走開！', 'Shoo!'), '#fff', 14); }
  function buyUp(k) { if (!S.run) return; var u = UPS[k], lv = S.up[u.id]; if (lv >= u.cost.length) return; if (!pay(u.cost[lv])) return; S.up[u.id]++; FX.sfx.great(); floats.add(60 + k * 116, 560, L(u.zh, u.en) + ' Lv' + S.up[u.id], '#bef264', 16); if (u.id === 'sca') S.crows.forEach(function (c) { if (!c.away) shoo(c); }); }
  function step(dt) {
    parts.step(dt); floats.step(dt);
    if (!S.run) { rainN.set(0); return; }
    S.t -= dt; if (S.t <= 0) { S.t = 0; end(); return; }
    var speed = (1 + S.up.fer * 0.25) * (S.rain > 0 ? 1.5 : 1);
    S.rainT -= dt; if (S.rainT <= 0 && S.rain <= 0) { S.rain = 12; S.rainT = 50 + Math.random() * 40; floats.add(W / 2, 120, L('🌧️ 下雨了！作物長得更快', '🌧️ Rain! Crops grow faster'), '#bae6fd', 16); }
    if (S.rain > 0) S.rain -= dt;
    S.plots.forEach(function (p, i) {
      if (p.pop > 0) p.pop -= dt; if (p.wet > 0) p.wet -= dt; if (p.crop < 0) return; var cr = CROPS[p.crop], c = pxy(i);
      if (p.st === 0) { var g0 = p.g; p.g += dt / cr.t * speed; if (g0 < 0.4 && p.g >= 0.4) { if (S.rain > 0 || S.up.spr >= 2) { p.wet = 6; } else { p.st = 1; p.g = 0.4; p.thirstT = 0; } } if (p.g >= 1) { p.g = 1; p.st = 2; p.ripeT = 0; p.gold = Math.random() < 0.08; p.pop = 0.3; if (p.gold) K.beep(1500, 0.15, 'sine', 0.04); } }
      else if (p.st === 1) { p.thirstT += dt; if (S.rain > 0 || (S.up.spr === 1 && p.thirstT > 3.5)) water(p, c.x + PS / 2, c.y + PS / 2); }
      else if (p.st === 2) { p.ripeT += dt; if (S.up.har && p.ripeT > 1.5) harvest(i); else if (p.ripeT > 18) { p.st = 3; } }
    });
    // 烏鴉
    if (!S.up.sca) { S.crowT -= dt; if (S.crowT <= 0) { S.crowT = 13 + Math.random() * 12; var cand = []; S.plots.forEach(function (p, i) { if (p.crop >= 0 && p.st !== 3) cand.push(i); }); if (cand.length) { var ti = FX.pick(cand), c2 = pxy(ti); S.crows.push({ i: ti, x: Math.random() < 0.5 ? -30 : W + 30, y: 20, tx: c2.x + PS / 2, ty: c2.y + 26, land: false, away: false, t: 0 }); K.beep(520, 0.15, 'sawtooth', 0.035, 380); } } }
    for (var k = S.crows.length - 1; k >= 0; k--) { var c = S.crows[k]; if (c.away) { c.x += (c.x < W / 2 ? -1 : 1) * 260 * dt; c.y -= 200 * dt; if (c.y < -40) S.crows.splice(k, 1); continue; } if (!c.land) { var dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy); if (d < 6) { c.land = true; c.t = 0; } else { c.x += dx / d * 190 * dt; c.y += dy / d * 190 * dt; } } else { c.t += dt; var p2 = S.plots[c.i]; if (p2.crop < 0) { c.land = false; c.away = true; } else if (c.t > 4) { p2.crop = -1; p2.st = 0; c.land = false; c.away = true; FX.sfx.bad(); floats.add(c.x, c.y - 10, L('被吃掉了！', 'Eaten!'), '#f87171', 15); } } }
    rainN.set(K.muted ? 0 : (S.rain > 0 ? 0.02 : 0), 3000); hud();
  }
  function end() {
    S.run = false; S.over = true; rainN.stop(); FX.sfx.great(); var m = Math.round(S.money), b = FX.best('scfarm_best', m), open = 0; S.plots.forEach(function (p) { if (p.open) open++; });
    $('endMoney').textContent = FX.money(m); $('endHarv').textContent = S.harv; $('endPlot').textContent = open + '/20'; $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.money(b.best);
    K.open('ovEnd'); hud(); if (window.SC) SC.post('gameover', { game: GAME, score: m }); if (window.SCLB && m > 0) SCLB.offer({ game: GAME, mode: 'season', score: m, text: FX.money(m) });
  }
  // ---------- 繪圖 ----------
  function draw(time) {
    hit.begin(); ctx.drawImage(ground, 0, 0, W, H); var i, p, c;
    // 太陽 = 季節進度
    var f = 1 - S.t / TIME; ctx.fillStyle = 'rgba(255,255,255,.35)'; FX.rr(ctx, 16, 8, 330, 8, 4); ctx.fill(); ctx.fillStyle = '#fde047'; FX.rr(ctx, 16, 8, Math.max(8, 330 * f), 8, 4); ctx.fill(); FX.text(ctx, S.rain > 0 ? '🌧️' : '☀️', 16 + 330 * f, 13, 20);
    FX.text(ctx, [L('春', 'Spring'), L('夏', 'Summer'), L('秋', 'Autumn'), L('冬', 'Winter')][Math.min(3, Math.floor(f * 4))], 365, 13, 12, '#14532d');
    for (i = 0; i < COLS * ROWS; i++) {
      p = S.plots[i]; c = pxy(i); var sc = 1 + (p.pop > 0 ? Math.sin(p.pop * 20) * 0.04 : 0), cx = c.x + PS / 2, cy = c.y + PS / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
      if (!p.open) { ctx.fillStyle = 'rgba(20,60,15,.35)'; FX.rr(ctx, -PS / 2, -PS / 2, PS, PS, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); var pc = plotCost(), can = S.money >= pc; FX.text(ctx, '🔒', 0, -10, 20); FX.text(ctx, FX.money(pc), 0, 16, 13, can ? '#fde047' : 'rgba(255,255,255,.6)', 'center', can ? '#14532d' : null); }
      else {
        ctx.fillStyle = '#5b3a1e'; FX.rr(ctx, -PS / 2, -PS / 2 + 3, PS, PS, 12); ctx.fill(); ctx.fillStyle = p.wet > 0 || S.rain > 0 ? '#6b4423' : '#8b5a2b'; FX.rr(ctx, -PS / 2, -PS / 2, PS, PS - 3, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 3; for (var r = -1; r <= 1; r++) { ctx.beginPath(); ctx.moveTo(-PS / 2 + 10, r * 22); ctx.lineTo(PS / 2 - 10, r * 22); ctx.stroke(); }
        if (p.crop >= 0) {
          var cr = CROPS[p.crop];
          if (p.st === 3) { ctx.globalAlpha = 0.75; FX.text(ctx, '🥀', 0, 0, 34); ctx.globalAlpha = 1; }
          else if (p.g < 0.25) FX.text(ctx, '🌱', 0, 6, 18 + p.g * 40);
          else { var s2 = p.st === 2 ? 44 + Math.sin(time * 6 + i) * 3 : 20 + p.g * 22; if (p.gold && p.st === 2) { ctx.fillStyle = 'rgba(253,224,71,' + (0.35 + Math.sin(time * 8) * 0.15) + ')'; ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.fill(); } if (p.st !== 2) ctx.globalAlpha = 0.55 + p.g * 0.45; FX.text(ctx, cr.e, 0, 2, s2); ctx.globalAlpha = 1; }
          if (p.st === 1) { var by = -26 + Math.sin(time * 7 + i) * 4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(22, by, 15, 0, 7); ctx.fill(); FX.text(ctx, '💧', 22, by + 1, 17); }
          if (p.st === 0 || p.st === 1) { ctx.fillStyle = 'rgba(0,0,0,.35)'; FX.rr(ctx, -30, 30, 60, 6, 3); ctx.fill(); ctx.fillStyle = p.st === 1 ? '#38bdf8' : '#a3e635'; FX.rr(ctx, -30, 30, Math.max(6, 60 * p.g), 6, 3); ctx.fill(); }
          if (p.st === 2 && p.ripeT > 12) { ctx.fillStyle = 'rgba(0,0,0,.35)'; FX.rr(ctx, -30, 30, 60, 6, 3); ctx.fill(); ctx.fillStyle = '#f87171'; FX.rr(ctx, -30, 30, Math.max(6, 60 * (1 - (p.ripeT - 12) / 6)), 6, 3); ctx.fill(); }
        }
      }
      ctx.restore(); hit.add(c.x, c.y, PS, PS, function (k) { S.drag = true; S.last = k; tapPlot(k, false); }, i);
    }
    S.crows.forEach(function (cw) { var fl = cw.land ? 0 : Math.sin(time * 22) * 8; ctx.save(); ctx.translate(cw.x, cw.y); if (cw.x > cw.tx && !cw.away) ctx.scale(-1, 1); ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 10, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, -8, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-22, -14 - fl); ctx.lineTo(-2, 4); ctx.fill(); ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(19, -9); ctx.lineTo(28, -6); ctx.lineTo(19, -4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(14, -10, 2.2, 0, 7); ctx.fill(); ctx.restore(); if (cw.land) { ctx.fillStyle = '#ef4444'; FX.rr(ctx, cw.x - 22, cw.y - 30, 44 * (1 - cw.t / 4), 5, 2.5); ctx.fill(); } });
    if (S.rain > 0) { ctx.strokeStyle = 'rgba(186,230,253,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (i = 0; i < 50; i++) { var rx = (i * 97 + time * 300) % (W + 40) - 20, ry = (i * 53 + time * 900) % 450; ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 14); } ctx.stroke(); }
    // 種子
    for (i = 0; i < 5; i++) { var cr2 = CROPS[i], lock = S.earned < cr2.at, bx = 8 + i * 94; FX.button(ctx, bx, 456, 88, 92, '', { bg: lock ? '#3a4152' : '#3f6212', sel: S.sel === i && !lock, off: lock }); if (lock) { FX.text(ctx, '🔒', bx + 44, 486, 20); FX.text(ctx, L('累計 ', 'Earn ') + FX.money(cr2.at), bx + 44, 520, 10.5, '#a8b0c0'); } else { FX.text(ctx, cr2.e, bx + 44, 482, 28); FX.text(ctx, FX.money(cr2.cost) + ' → ' + FX.money(cr2.sell), bx + 44, 512, 10.5, S.money >= cr2.cost ? '#fde047' : '#fca5a5'); FX.text(ctx, L(cr2.zh, cr2.en) + ' ' + cr2.t + 's', bx + 44, 530, 10.5, '#ecfccb'); hit.add(bx, 456, 88, 92, function (k) { S.sel = k; K.beep(600, 0.04, 'triangle', 0.03); }, i); } }
    for (i = 0; i < 4; i++) { var u = UPS[i], lv = S.up[u.id], max = lv >= u.cost.length, ux = 8 + i * 117.5; FX.button(ctx, ux, 560, 111, 90, '', { bg: max ? '#166534' : '#1e3a5f', off: !max && S.money < u.cost[lv] }); FX.text(ctx, u.e + ' ' + L(u.zh, u.en), ux + 55, 582, 12.5, '#fff'); FX.text(ctx, L(u.d[0], u.d[1]) + (u.cost.length > 1 ? ' Lv' + lv : ''), ux + 55, 604, 10.5, '#cbd5e1'); FX.text(ctx, max ? L('✓ 已滿級', '✓ Max') : FX.money(u.cost[lv]), ux + 55, 628, 13, max ? '#86efac' : S.money >= u.cost[lv] ? '#fde047' : '#fca5a5'); if (!max) hit.add(ux, 560, 111, 90, buyUp, i); }
    parts.draw(ctx); floats.draw(ctx);
    if (S.run && S.t <= 10) FX.text(ctx, String(Math.ceil(S.t)), W / 2, 260, 70, 'rgba(255,255,255,' + (0.4 + (S.t % 1) * 0.5) + ')', 'center', '#14532d');
  }
  hit.move = function (pt) { if (!S.drag || !S.run) return; var cx = Math.floor((pt.x - GX) / PT), cy = Math.floor((pt.y - GY) / PT); if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return; if ((pt.x - GX) % PT > PS || (pt.y - GY) % PT > PS) return; var k = cy * COLS + cx; if (k !== S.last) { S.last = k; tapPlot(k, true); } };
  hit.up = function () { if (S) S.drag = false; };
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(function () { if (K.muted) rainN.stop(); }); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__fm = { step: step, S: function () { return S; }, go: start, tap: tapPlot, up: buyUp, cost: plotCost, CROPS: CROPS, UPS: UPS };
})();
