/* 夢幻水族箱 — stockcorp.github.io/aquarium/
   5 分鐘。點水丟飼料（$3），魚吃飽長大後定時吐錢；餓 22 秒變色、30 秒死亡。
   魚：孔雀魚（長大要吃 3 次，$25/6s）、小丑魚（$60/7s）、神仙魚（$250/9s）；螃蟹自動撿底部金幣。
   60 秒後每隔一段時間來鯊魚，點 8 下打退，掉珍珠 $200。排行榜：mode = 5min，比最終資金。 */
(function () {
  'use strict';
  var GAME = 'aquarium', $ = K.$, L = K.L, W = 480, H = 660, TIME = 300, FLOOR = 528, TOP = 40, MAXF = 20;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(200), floats = FX.Floats();
  var TYPES = [{ zh: '孔雀魚', en: 'Guppy', cost: 50, coin: 25, every: 6, grow: 3, size: 15 }, { zh: '小丑魚', en: 'Clownfish', cost: 300, coin: 60, every: 7, grow: 2, size: 19 }, { zh: '神仙魚', en: 'Angelfish', cost: 1200, coin: 250, every: 9, grow: 2, size: 22 }];
  var GUP = ['#fb923c', '#60a5fa', '#f472b6', '#a3e635', '#facc15'], bubbles = [];
  for (var i = 0; i < 18; i++) bubbles.push({ x: Math.random() * W, y: Math.random() * FLOOR, r: 2 + Math.random() * 4, v: 20 + Math.random() * 30 });
  var bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H;
  (function () { var g = bgc.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, FLOOR); gr.addColorStop(0, '#3bc0e6'); gr.addColorStop(0.5, '#1a8fc2'); gr.addColorStop(1, '#0b4f7d'); g.fillStyle = gr; g.fillRect(0, 0, W, 566); g.fillStyle = 'rgba(255,255,255,.07)'; for (var i = 0; i < 6; i++) { g.beginPath(); g.moveTo(40 + i * 80, 0); g.lineTo(90 + i * 80, 0); g.lineTo(10 + i * 80 + 60, FLOOR); g.lineTo(i * 80 - 40, FLOOR); g.fill(); }
    g.fillStyle = '#5a6b7a'; g.beginPath(); g.moveTo(330, FLOOR + 10); g.quadraticCurveTo(350, 430, 400, 440); g.quadraticCurveTo(450, 430, 470, FLOOR + 10); g.fill(); g.fillStyle = '#0b3a55'; g.beginPath(); g.ellipse(400, 500, 26, 22, 0, 0, 7); g.fill();
    [[40, 110, '#16a34a'], [70, 80, '#22c55e'], [100, 130, '#15803d'], [250, 70, '#22c55e'], [280, 100, '#16a34a']].forEach(function (p) { g.strokeStyle = p[2]; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(p[0], FLOOR + 6); g.quadraticCurveTo(p[0] - 18, FLOOR - p[1] / 2, p[0] + 6, FLOOR - p[1]); g.stroke(); });
    [[170, '#f472b6'], [200, '#fb7185']].forEach(function (p) { g.fillStyle = p[1]; for (var k = 0; k < 5; k++) { g.beginPath(); g.ellipse(p[0] + (k - 2) * 9, FLOOR - 12 - (k % 2) * 10, 7, 20, (k - 2) * 0.25, 0, 7); g.fill(); } });
    g.fillStyle = '#e7cf9a'; g.beginPath(); g.moveTo(0, FLOOR); for (i = 0; i <= W; i += 40) g.quadraticCurveTo(i + 20, FLOOR - 8 + (i / 40 % 2) * 12, i + 40, FLOOR); g.lineTo(W, 566); g.lineTo(0, 566); g.fill(); g.fillStyle = 'rgba(160,120,60,.35)'; for (i = 0; i < 90; i++) g.fillRect(Math.random() * W, FLOOR + 6 + Math.random() * 30, 2, 2); g.fillStyle = '#0c2230'; g.fillRect(0, 566, W, H - 566); })();

  function reset() { S = { run: false, over: false, started: false, money: 150, t: TIME, fish: [], food: [], coins: [], crabs: [], pellets: 2, premium: false, shark: null, sharkT: 62, warn: 0, beaten: 0, drag: false }; addFish(0, true); addFish(0, true); S.fish[0].x = 160; S.fish[1].x = 320; parts.clear(); floats.clear(); hud(); }
  function hud() { $('money').textContent = FX.money(S.money); var t = Math.max(0, Math.ceil(S.t)); $('time').textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + t % 60; $('fish').textContent = S.fish.length + '/' + MAXF; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, '5min'); if (window.SC) SC.post('start', { game: GAME }); }
  function addFish(ty, free) { var T = TYPES[ty]; S.fish.push({ ty: ty, x: 60 + Math.random() * 360, y: free ? 200 + Math.random() * 150 : TOP, vx: 0, vy: 0, tx: 240, ty2: 250, dir: 1, hunger: 0, fed: free ? 1 : 0, coinT: T.every * (0.5 + Math.random() * 0.5), c: FX.pick(GUP), ph: Math.random() * 6, wT: 0, dead: 0 }); }
  function buy(k) {
    if (!S.run) return; var cost, ok = true;
    if (k < 3) { cost = TYPES[k].cost; if (S.fish.length >= MAXF) { K.toast(L('魚缸滿了（最多 20 隻）', 'The tank is full (20 fish max)')); return; } }
    else if (k === 3) { cost = 600; if (S.crabs.length >= 2) return; } else { cost = upCost(); if (cost == null) return; }
    if (S.money < cost) { K.toast(L('錢不夠', 'Not enough money')); FX.sfx.bad(); return; }
    S.money -= cost; if (k < 3) { addFish(k); parts.burst(S.fish[S.fish.length - 1].x, TOP + 10, 10, { c: '#e0f2fe', sp: 90, life: 0.6, size: 4, g: 100, round: 1 }); } else if (k === 3) S.crabs.push({ x: Math.random() * W, dir: 1 }); else { if (S.pellets < 5) S.pellets++; else S.premium = true; }
    FX.sfx.good(); hud();
  }
  function upCost() { return S.pellets < 5 ? [200, 500, 1000][S.pellets - 2] : S.premium ? null : 1500; }
  function feed(p) { if (!S.run || p.y > FLOOR - 6 || p.y < TOP) return; if (S.food.length >= S.pellets) { K.beep(200, 0.05, 'square', 0.02); return; } if (S.money < 3) { K.toast(L('連飼料錢都沒有了…', 'Not even enough for food…')); return; } S.money -= 3; S.food.push({ x: p.x, y: p.y, vy: 30 }); K.beep(1200, 0.05, 'sine', 0.03, 700); hud(); }
  function grab(p, rad) {
    var got = false; for (var i = S.coins.length - 1; i >= 0; i--) { var c = S.coins[i]; if (Math.hypot(c.x - p.x, c.y - p.y) < rad) { collect(c); S.coins.splice(i, 1); got = true; } } return got;
  }
  function collect(c) { S.money += c.v; floats.add(c.x, c.y - 10, '+$' + c.v, c.v >= 200 ? '#a5f3fc' : '#fde047', c.v >= 200 ? 18 : 14); if (c.v >= 200) FX.sfx.great(); else FX.sfx.coin(); parts.burst(c.x, c.y, 6, { c: ['#fde047', '#fff'], sp: 90, life: 0.4, size: 3, g: 0 }); hud(); }
  hit.miss = function (p) {
    if (!S.run) return; S.drag = true;
    if (S.shark && !S.shark.flee && Math.hypot(S.shark.x - p.x, S.shark.y - p.y) < 62) { S.shark.hp--; S.shark.hit = 0.15; K.beep(300, 0.06, 'square', 0.05, 150); parts.burst(p.x, p.y, 8, { c: ['#fff', '#fca5a5'], sp: 150, life: 0.3, size: 4, g: 0 }); if (S.shark.hp <= 0) { S.coins.push({ x: S.shark.x, y: S.shark.y, v: 200, t: 0, vy: 40 }); S.shark.flee = true; S.beaten++; FX.sfx.great(); floats.add(S.shark.x, S.shark.y - 40, L('打退鯊魚！', 'Shark defeated!'), '#fff', 18); } return; }
    if (!grab(p, 34)) feed(p);
  };
  hit.move = function (p) { if (S.drag && S.run) grab(p, 30); }; hit.up = function () { if (S) S.drag = false; };
  function step(dt) {
    parts.step(dt); floats.step(dt); bubbles.forEach(function (b) { b.y -= b.v * dt; b.x += Math.sin(b.y / 20) * 10 * dt; if (b.y < TOP - 10) { b.y = FLOOR; b.x = Math.random() * W; } });
    if (!S.run) return; S.t -= dt; if (S.t <= 0) { S.t = 0; end(); return; }
    var i, hungAt = S.premium ? 12 : 9;
    for (i = S.food.length - 1; i >= 0; i--) { var fd = S.food[i]; fd.y += fd.vy * dt; if (fd.y > FLOOR + 4) S.food.splice(i, 1); }
    for (i = S.fish.length - 1; i >= 0; i--) {
      var f = S.fish[i], T = TYPES[f.ty];
      if (f.dead) { f.dead += dt; f.y -= 25 * dt; if (f.y < TOP - 20) S.fish.splice(i, 1); continue; }
      f.hunger += dt; f.ph += dt * (4 + Math.hypot(f.vx, f.vy) / 20);
      if (f.hunger > 30) { f.dead = 0.01; FX.sfx.bad(); floats.add(f.x, f.y - 20, L('餓死了…', 'Starved…'), '#fca5a5', 14); hud(); continue; }
      var sp = 45, tx = f.tx, ty = f.ty2;
      if (f.hunger > hungAt && S.food.length) { var best = null, bd = 1e9; S.food.forEach(function (o) { var d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } }); tx = best.x; ty = best.y; sp = 130; if (bd < 14) { S.food.splice(S.food.indexOf(best), 1); f.hunger = 0; if (f.fed < T.grow) { f.fed++; if (f.fed >= T.grow) { floats.add(f.x, f.y - 22, L('長大了！', 'Grown up!'), '#bbf7d0', 13); K.beep(880, 0.1, 'sine', 0.04, 1300); } } K.beep(500, 0.04, 'sine', 0.03); } }
      else { f.wT -= dt; if (f.wT <= 0 || Math.hypot(tx - f.x, ty - f.y) < 10) { f.tx = 30 + Math.random() * (W - 60); f.ty2 = TOP + 30 + Math.random() * (FLOOR - TOP - 80); f.wT = 3 + Math.random() * 4; } }
      var dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1; f.vx += (dx / d * sp - f.vx) * Math.min(1, dt * 2.5); f.vy += (dy / d * sp - f.vy) * Math.min(1, dt * 2.5); f.x += f.vx * dt; f.y += f.vy * dt; if (Math.abs(f.vx) > 4) f.dir = f.vx > 0 ? 1 : -1;
      f.y = FX.clamp(f.y, TOP + 10, FLOOR - 16);
      if (f.fed >= T.grow) { f.coinT -= dt; if (f.coinT <= 0) { f.coinT = T.every; if (f.hunger < 22) S.coins.push({ x: f.x, y: f.y + 8, v: T.coin, t: 0, vy: 34 }); } }
    }
    for (i = S.coins.length - 1; i >= 0; i--) { var c = S.coins[i]; if (c.y < FLOOR - 4) c.y += c.vy * dt; else { c.t += dt; if (c.t > 7) S.coins.splice(i, 1); } }
    S.crabs.forEach(function (cr) { var tg = null, bd = 1e9; S.coins.forEach(function (c2) { if (c2.y > FLOOR - 60) { var d2 = Math.abs(c2.x - cr.x); if (d2 < bd) { bd = d2; tg = c2; } } }); if (tg) { cr.dir = tg.x > cr.x ? 1 : -1; cr.x += cr.dir * 150 * dt; if (bd < 16 && tg.y > FLOOR - 26) { collect(tg); S.coins.splice(S.coins.indexOf(tg), 1); } } else { cr.x += cr.dir * 30 * dt; if (cr.x < 20 || cr.x > W - 20) cr.dir *= -1; } });
    // 鯊魚
    if (!S.shark) { S.sharkT -= dt; if (S.sharkT < 2.5 && S.warn <= 0 && S.fish.length) { S.warn = 2.5; K.beep(440, 0.25, 'square', 0.05); setTimeout(function () { K.beep(440, 0.25, 'square', 0.05); }, 400); } if (S.warn > 0) S.warn -= dt; if (S.sharkT <= 0 && S.fish.length) { var left = Math.random() < 0.5; S.shark = { x: left ? -70 : W + 70, y: 150 + Math.random() * 250, dir: left ? 1 : -1, hp: 8 + Math.floor((TIME - S.t) / 60) * 2, max: 0, eat: 3.5, hit: 0 }; S.shark.max = S.shark.hp; S.warn = 0; } }
    else { var sh = S.shark; if (sh.hit > 0) sh.hit -= dt; if (sh.flee) { sh.x += sh.dir * -260 * dt; if (sh.x < -100 || sh.x > W + 100) { S.shark = null; S.sharkT = 38 + Math.random() * 16; } } else { var prey = null, pd = 1e9; S.fish.forEach(function (o) { if (o.dead) return; var d3 = Math.hypot(o.x - sh.x, o.y - sh.y); if (d3 < pd) { pd = d3; prey = o; } }); if (prey) { var ax = prey.x - sh.x, ay = prey.y - sh.y; sh.x += ax / pd * 85 * dt; sh.y += ay / pd * 85 * dt; sh.dir = ax > 0 ? 1 : -1; sh.eat -= dt; if (pd < 34 && sh.eat <= 0) { S.fish.splice(S.fish.indexOf(prey), 1); sh.eat = 3.5; FX.sfx.crash(); floats.add(prey.x, prey.y - 20, L('被吃掉了！', 'Eaten!'), '#fca5a5', 15); parts.burst(prey.x, prey.y, 14, { c: '#fca5a5', sp: 140, life: 0.5, size: 4, g: 0 }); hud(); } } else { sh.flee = true; } } }
    if (Math.floor(S.t) !== Math.floor(S.t + dt)) hud();
  }
  function end() {
    S.run = false; S.over = true; FX.sfx.great(); var m = Math.round(S.money), b = FX.best('scaqua_best', m);
    $('endMoney').textContent = FX.money(m); $('endFish').textContent = S.fish.length; $('endShark').textContent = S.beaten; $('endBest').textContent = b.isNew && m > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.money(b.best);
    K.open('ovEnd'); hud(); if (window.SC) SC.post('gameover', { game: GAME, score: m }); if (window.SCLB && m > 0) SCLB.offer({ game: GAME, mode: '5min', score: m, text: FX.money(m) });
  }
  // ---------- 繪圖 ----------
  function fishDraw(f, time, mini) {
    var T = TYPES[f.ty], grown = f.fed >= T.grow, s = mini ? 0.9 : T.size * (grown ? 1 : 0.55 + 0.2 * f.fed / T.grow) / 15, wag = Math.sin(f.ph) * 0.45, starving = f.hunger > 22;
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir * s, f.dead ? -s : s); if (f.dead) ctx.globalAlpha = Math.max(0, 1 - f.dead / 3);
    var body = starving || f.dead ? '#9aa67a' : f.ty === 0 ? f.c : f.ty === 1 ? '#f97316' : '#fde047';
    if (f.ty === 2) { ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-10, -30); ctx.lineTo(8, -8); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-10, 30); ctx.lineTo(8, 8); ctx.fill(); }
    ctx.save(); ctx.translate(-13, 0); ctx.rotate(wag); ctx.fillStyle = FX.shade(body.charAt(0) === '#' ? body : '#9aa67a', -0.12); ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-14, -11); ctx.lineTo(-10, 0); ctx.lineTo(-14, 11); ctx.fill(); ctx.restore();
    var g = ctx.createLinearGradient(0, -11, 0, 11); g.addColorStop(0, FX.shade(body, 0.25)); g.addColorStop(1, FX.shade(body, -0.2)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, f.ty === 2 ? 14 : 16, f.ty === 2 ? 14 : 10, 0, 0, 7); ctx.fill();
    if (f.ty === 1 && !starving) { ctx.fillStyle = '#fff'; ctx.fillRect(-7, -9.5, 4, 19); ctx.fillRect(4, -8.5, 4, 17); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1; ctx.strokeRect(-7, -9.5, 4, 19); ctx.strokeRect(4, -8.5, 4, 17); }
    if (f.ty === 2 && !starving) { ctx.fillStyle = '#1f2937'; ctx.fillRect(-5, -13, 3, 26); ctx.fillRect(3, -12.5, 3, 25); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, -2.5, 3.6, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(10, -2.5, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-2, 3, 5, 3, 0.5 + wag, 0, 7); ctx.fill();
    ctx.restore();
    if (!mini && !f.dead && f.hunger > 16) FX.text(ctx, starving ? '❗' : '💭', f.x, f.y - T.size * 1.2 - 6 + Math.sin(time * 6) * 2, starving ? 16 : 13);
  }
  function draw(time) {
    hit.begin(); ctx.drawImage(bgc, 0, 0, W, H); var i;
    ctx.fillStyle = 'rgba(255,255,255,.25)'; bubbles.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); });
    S.crabs.forEach(function (cr) { var y = FLOOR + 10, w = Math.sin(time * 12) * 3; ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2.5; for (var k = -1; k <= 1; k += 2) { ctx.beginPath(); ctx.moveTo(cr.x + k * 8, y); ctx.lineTo(cr.x + k * 17, y + 6 + w * k); ctx.moveTo(cr.x + k * 6, y + 3); ctx.lineTo(cr.x + k * 14, y + 10 - w * k); ctx.moveTo(cr.x + k * 9, y - 5); ctx.lineTo(cr.x + k * 17, y - 13); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(cr.x + k * 18, y - 15, 5, 0, 7); ctx.fill(); } ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(cr.x, y, 13, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cr.x - 4, y - 8, 3, 0, 7); ctx.arc(cr.x + 4, y - 8, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cr.x - 4, y - 8, 1.4, 0, 7); ctx.arc(cr.x + 4, y - 8, 1.4, 0, 7); ctx.fill(); });
    S.food.forEach(function (o) { ctx.fillStyle = S.premium ? '#f472b6' : '#b45309'; ctx.beginPath(); ctx.arc(o.x, o.y, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(o.x - 1.5, o.y - 1.5, 1.5, 0, 7); ctx.fill(); });
    S.fish.forEach(function (f) { fishDraw(f, time); });
    S.coins.forEach(function (c) { var blink = c.t > 5 && Math.floor(time * 8) % 2; if (blink) return; var big = c.v >= 200, col = big ? '#a5f3fc' : c.v >= 60 ? '#fde047' : '#fbbf24', r = big ? 12 : c.v >= 60 ? 10 : 8.5, sq = Math.abs(Math.cos(time * 4 + c.x)); ctx.fillStyle = FX.shade(big ? '#a5f3fc' : '#f59e0b', -0.25); ctx.beginPath(); ctx.ellipse(c.x, c.y + 1.5, r * (0.35 + sq * 0.65), r, 0, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(c.x, c.y, r * (0.35 + sq * 0.65), r, 0, 0, 7); ctx.fill(); if (sq > 0.5) FX.text(ctx, big ? '◆' : '$', c.x, c.y + 0.5, r * 1.1, big ? '#0e7490' : '#92400e'); });
    if (S.shark) { var sh = S.shark; ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sh.dir, 1); var wg = Math.sin(time * 9) * 0.3; ctx.fillStyle = sh.hit > 0 ? '#fecaca' : '#64748b'; ctx.save(); ctx.translate(-50, 0); ctx.rotate(wg); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-26, -24); ctx.lineTo(-16, 0); ctx.lineTo(-26, 20); ctx.fill(); ctx.restore(); ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(-2, -44); ctx.lineTo(18, -16); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 0, 54, 22, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.ellipse(4, 9, 44, 11, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.moveTo(22, 6); ctx.lineTo(50, 4); ctx.lineTo(30, 16); ctx.fill(); ctx.fillStyle = '#fff'; for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(26 + k * 6, 5.5); ctx.lineTo(29 + k * 6, 11); ctx.lineTo(32 + k * 6, 5); ctx.fill(); } ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(32, -6, 3.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(26, -13); ctx.lineTo(38, -9); ctx.stroke(); ctx.restore(); ctx.fillStyle = 'rgba(0,0,0,.5)'; FX.rr(ctx, sh.x - 32, sh.y - 44, 64, 8, 4); ctx.fill(); ctx.fillStyle = '#ef4444'; if (sh.hp > 0) { FX.rr(ctx, sh.x - 32, sh.y - 44, 64 * sh.hp / sh.max, 8, 4); ctx.fill(); } if (!sh.flee) FX.text(ctx, L('快點牠！', 'Tap it!'), sh.x, sh.y - 58, 14, '#fff', 'center', '#7f1d1d'); }
    if (S.warn > 0 && Math.floor(time * 5) % 2) { ctx.fillStyle = 'rgba(220,38,38,.18)'; ctx.fillRect(0, 0, W, 566); FX.text(ctx, L('⚠️ 鯊魚來了！', '⚠️ Shark incoming!'), W / 2, 90, 22, '#fff', 'center', '#7f1d1d'); }
    parts.draw(ctx); floats.draw(ctx);
    // 水面與飼料數
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(0, TOP - 6); for (i = 0; i <= W; i += 24) ctx.quadraticCurveTo(i + 12, TOP - 6 + Math.sin(time * 2 + i) * 4, i + 24, TOP - 6); ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.fill();
    for (i = 0; i < S.pellets; i++) { ctx.fillStyle = i < S.pellets - S.food.length ? (S.premium ? '#f472b6' : '#b45309') : 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(16 + i * 14, 16, 5, 0, 7); ctx.fill(); }
    // 商店
    var items = [[L('孔雀魚', 'Guppy'), 50], [L('小丑魚', 'Clownfish'), 300], [L('神仙魚', 'Angelfish'), 1200], [L('螃蟹', 'Crab'), S.crabs.length >= 2 ? null : 600], [S.pellets < 5 ? L('飼料 +1', 'Food +1') : L('高級飼料', 'Premium food'), upCost()]];
    items.forEach(function (it, k) { var bx = 6 + k * 94.5, max = it[1] == null, can = !max && S.money >= it[1] && (k > 2 || S.fish.length < MAXF); FX.button(ctx, bx, 574, 88, 80, '', { bg: max ? '#166534' : '#0e4a66', off: !max && !can }); if (k < 3) fishDraw({ ty: k, x: bx + 44, y: 600, dir: 1, fed: 9, hunger: 0, ph: time * 4 + k, c: GUP[0] }, time, true); else if (k === 3) FX.text(ctx, '🦀', bx + 44, 600, 26); else { ctx.fillStyle = S.pellets >= 5 ? '#f472b6' : '#b45309'; for (var q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(bx + 32 + q * 12, 600 - (q % 2) * 6, 5.5, 0, 7); ctx.fill(); } } FX.text(ctx, it[0], bx + 44, 626, 11.5, '#fff'); FX.text(ctx, max ? L('✓ 已滿', '✓ Max') : '$' + FX.fmt(it[1]), bx + 44, 642, 12, max ? '#86efac' : can ? '#fde047' : '#fca5a5'); if (!max) hit.add(bx, 574, 88, 80, buy, k); });
    if (S.run && S.t <= 10) FX.text(ctx, String(Math.ceil(S.t)), W / 2, 280, 70, 'rgba(255,255,255,' + (0.4 + (S.t % 1) * 0.5) + ')', 'center', '#0c4a6e');
    if (S.run && S.t > TIME - 9) { ctx.fillStyle = 'rgba(6,19,28,.8)'; FX.rr(ctx, 80, 60, 320, 30, 15); ctx.fill(); FX.text(ctx, L('點水面丟飼料，魚吃飽才會吐金幣', 'Tap the water to feed — fed fish drop coins'), W / 2, 75.5, 12.5, '#fff'); }
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__aq = { S: function () { return S; }, go: start, step: step, buy: buy, feed: feed, tap: function (p) { hit.miss(p); }, TYPES: TYPES };
})();
