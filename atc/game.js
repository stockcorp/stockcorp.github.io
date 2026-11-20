/* 塔台管制員 — stockcorp.github.io/atc/
   飛機從邊緣進場，玩家從飛機拖曳畫路線；路線畫到同色跑道的進場端（或停機坪）就會降落。
   客機（紅，快）→ 長跑道；小飛機（黃）→ 短跑道；直升機（藍，慢）→ 停機坪。兩機距離 < 20 相撞即結束。
   排行榜：mode = classic，比降落架次。 */
(function () {
  'use strict';
  var GAME = 'atc', $ = K.$, L = K.L, W = 480, H = 660;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(220), floats = FX.Floats();
  var TY = [{ id: 'jet', c: '#ef4444', sp: 58, r: 15 }, { id: 'prop', c: '#facc15', sp: 44, r: 12 }, { id: 'heli', c: '#38bdf8', sp: 30, r: 12 }];
  var RW = [{ x1: 96, y1: 262, x2: 336, y2: 262, w: 30 }, { x1: 372, y1: 340, x2: 372, y2: 520, w: 24 }], PAD = { x: 170, y: 440, r: 26 };
  var ENTRY = [{ x: 96, y: 262 }, { x: 372, y: 340 }, { x: PAD.x, y: PAD.y }];
  var clouds = []; for (var i = 0; i < 5; i++) clouds.push({ x: Math.random() * W, y: Math.random() * H, s: 40 + Math.random() * 50, v: 6 + Math.random() * 6 });
  var bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H;
  (function () {
    var g = bgc.getContext('2d'); g.fillStyle = '#5a9e4b'; g.fillRect(0, 0, W, H);
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var i = 0; i < 16; i++) { g.fillStyle = ['#64a853', '#559645', '#6fb25d', '#8bbf5f', '#c9c46a'][Math.floor(rnd() * 5)]; g.save(); g.translate(rnd() * W, rnd() * H); g.rotate(rnd() * 0.6 - 0.3); g.fillRect(-50, -34, 60 + rnd() * 70, 40 + rnd() * 50); g.restore(); }
    g.fillStyle = '#e8d9a6'; g.beginPath(); g.moveTo(300, 0); g.quadraticCurveTo(350, 96, 480, 124); g.lineTo(480, 0); g.fill(); g.fillStyle = '#3b9bd9'; g.beginPath(); g.moveTo(322, 0); g.quadraticCurveTo(366, 80, 480, 104); g.lineTo(480, 0); g.fill(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(340, 0); g.quadraticCurveTo(380, 66, 480, 86); g.stroke();
    g.fillStyle = '#2f6b33'; for (i = 0; i < 46; i++) { var x = rnd() * W, y = rnd() * H; if (x > 60 && x < 420 && y > 210 && y < 560) continue; if (x > 300 && y < 130) continue; g.beginPath(); g.arc(x, y, 5 + rnd() * 5, 0, 7); g.fill(); }
    g.fillStyle = '#6b7280'; g.fillRect(150, 276, 20, 140); g.fillRect(150, 396, 222, 18); g.fillRect(196, 276, 16, 60); g.fillStyle = '#9ca3af'; FX.rr(g, 204, 300, 130, 84, 6); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(226, 322, 96, 46); g.fillStyle = '#e5e7eb'; g.fillRect(220, 314, 96, 46); g.fillStyle = '#93c5fd'; for (i = 0; i < 6; i++) g.fillRect(226 + i * 15, 320, 10, 8); g.fillStyle = '#cbd5e1'; g.fillRect(220, 336, 96, 5); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(300, 392, 13, 0, 7); g.fill(); g.fillStyle = '#f1f5f9'; g.beginPath(); g.arc(296, 386, 13, 0, 7); g.fill(); g.fillStyle = '#0ea5e9'; g.beginPath(); g.arc(296, 386, 8, 0, 7); g.fill();
    RW.forEach(function (r, k) {
      var hz = r.y1 === r.y2, len = hz ? r.x2 - r.x1 : r.y2 - r.y1, col = TY[k].c; g.save(); g.translate(r.x1, r.y1); if (!hz) g.rotate(Math.PI / 2);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-4, -r.w / 2 + 3, len + 8, r.w); g.fillStyle = '#374151'; g.fillRect(-6, -r.w / 2, len + 12, r.w); g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(-6, -r.w / 2, len + 12, r.w);
      g.fillStyle = '#f9fafb'; for (var q = 0; q < 4; q++) g.fillRect(2, -r.w / 2 + 5 + q * (r.w - 10) / 3.6, 14, 2.5); for (q = 40; q < len - 20; q += 26) g.fillRect(q, -1.2, 14, 2.4);
      g.fillStyle = col; for (q = 0; q < 3; q++) { g.beginPath(); g.moveTo(-44 + q * 12, -8); g.lineTo(-34 + q * 12, 0); g.lineTo(-44 + q * 12, 8); g.lineTo(-40 + q * 12, 0); g.fill(); } g.restore();
    });
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(PAD.x + 2, PAD.y + 3, PAD.r + 4, 0, 7); g.fill(); g.fillStyle = '#374151'; g.beginPath(); g.arc(PAD.x, PAD.y, PAD.r + 4, 0, 7); g.fill(); g.strokeStyle = '#38bdf8'; g.lineWidth = 4; g.beginPath(); g.arc(PAD.x, PAD.y, PAD.r - 2, 0, 7); g.stroke(); g.fillStyle = '#f9fafb'; g.font = '900 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', PAD.x, PAD.y + 1);
  })();

  function reset() { S = { run: false, over: false, started: false, planes: [], t: 0, score: 0, spawnT: 1.2, sel: null, drawing: false, boom: null, boomT: 0, maxAir: 0, warnT: 0, incoming: [] }; parts.clear(); floats.clear(); $('best').textContent = K.load('scatc_best', 0); hud(); }
  function hud() { $('score').textContent = S.score; $('air').textContent = S.planes.filter(function (p) { return !p.land; }).length; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
  function spawn() {
    var r = Math.random(), ty = r < 0.4 ? 0 : r < 0.75 ? 1 : 2, side = Math.floor(Math.random() * 4), x, y;
    for (var tries = 0; tries < 12; tries++) { if (side === 0) { x = 40 + Math.random() * 260; y = -26; } else if (side === 1) { x = W + 26; y = 150 + Math.random() * 460; } else if (side === 2) { x = 40 + Math.random() * 400; y = H + 26; } else { x = -26; y = 40 + Math.random() * 580; } var ok = S.planes.concat(S.incoming).every(function (p) { return Math.hypot(p.x - x, p.y - y) > 120; }); if (ok) break; side = (side + 1) % 4; }
    var a = Math.atan2(330 + (Math.random() - 0.5) * 240 - y, 240 + (Math.random() - 0.5) * 200 - x);
    S.incoming.push({ ty: ty, x: x, y: y, a: a, t: 1.6 }); K.beep(1040, 0.07, 'sine', 0.035);
  }
  function near(p, r) { var best = null, bd = r; S.planes.forEach(function (q) { if (q.land) return; var d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }); return best; }
  hit.miss = function (p) { if (!S.run) return; var pl = near(p, 40); if (!pl) return; S.sel = pl; S.drawing = true; pl.path = []; pl.go = false; K.beep(700, 0.04, 'triangle', 0.03); };
  hit.move = function (p) {
    if (!S.drawing || !S.sel || !S.run) return; var pl = S.sel, last = pl.path.length ? pl.path[pl.path.length - 1] : pl, e = ENTRY[pl.ty];
    if (Math.hypot(p.x - e.x, p.y - e.y) < 30 && Math.hypot(pl.x - e.x, pl.y - e.y) > 34) { pl.path.push({ x: e.x, y: e.y }); pl.go = true; S.drawing = false; FX.sfx.good(); return; }
    if (Math.hypot(p.x - last.x, p.y - last.y) > 9 && pl.path.length < 260) pl.path.push({ x: FX.clamp(p.x, 6, W - 6), y: FX.clamp(p.y, 6, H - 6) });
  };
  hit.up = function () { if (S) S.drawing = false; };
  function step(dt) {
    parts.step(dt); floats.step(dt); clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > W + 100) { c.x = -100; c.y = Math.random() * H; } });
    if (S.boom) { S.boomT += dt; if (S.boomT > 1.7 && !S.over) end(); return; }
    if (!S.run) return; S.t += dt;
    S.spawnT -= dt; if (S.spawnT <= 0) { spawn(); S.spawnT = Math.max(1.7, 5.4 - S.t / 38) * (0.75 + Math.random() * 0.5); }
    for (var i = S.incoming.length - 1; i >= 0; i--) { var inc = S.incoming[i]; inc.t -= dt; if (inc.t <= 0) { S.planes.push({ ty: inc.ty, x: inc.x, y: inc.y, a: inc.a, path: [], go: false, land: 0, ph: Math.random() * 6, fast: S.score >= 20 && inc.ty === 0 && Math.random() < 0.3 }); S.incoming.splice(i, 1); } }
    for (i = S.planes.length - 1; i >= 0; i--) {
      var p = S.planes[i], T = TY[p.ty], sp = T.sp * (p.fast ? 1.3 : 1); p.ph += dt;
      if (p.land) { p.land += dt; var dur = p.ty === 2 ? 1.3 : 2.6; if (p.ty !== 2) { var r = RW[p.ty], hz = r.y1 === r.y2, k = Math.max(0.15, 1 - p.land / dur); p.x += (hz ? 1 : 0) * sp * k * dt * 1.2; p.y += (hz ? 0 : 1) * sp * k * dt * 1.2; p.a += (((hz ? 0 : Math.PI / 2) - p.a + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6); } if (p.land > dur) { S.planes.splice(i, 1); S.score++; FX.sfx.coin(); floats.add(p.x, p.y - 16, '+1', '#fff', 18); hud(); } continue; }
      var want = p.a;
      if (p.path.length) { var tg = p.path[0], d = Math.hypot(tg.x - p.x, tg.y - p.y); if (d < 5) { p.path.shift(); if (!p.path.length && p.go) { p.land = 0.001; if (S.sel === p) S.sel = null; K.beep(880, 0.12, 'sine', 0.05, 1320); hud(); continue; } } else want = Math.atan2(tg.y - p.y, tg.x - p.x); }
      else { p.go = false; if (p.x < 24 || p.x > W - 24 || p.y < 24 || p.y > H - 24) want = Math.atan2(330 - p.y, 240 - p.x); }
      var da = ((want - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; p.a += FX.clamp(da, -3.2 * dt, 3.2 * dt); if (p.path.length && Math.abs(da) < 0.4) p.a = want;
      p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt;
    }
    // 相撞與警示
    var fl = S.planes.filter(function (q) { return !q.land; }), warn = false; S.maxAir = Math.max(S.maxAir, fl.length); fl.forEach(function (q) { q.warn = false; });
    for (i = 0; i < fl.length; i++) for (var j = i + 1; j < fl.length; j++) { var dd = Math.hypot(fl[i].x - fl[j].x, fl[i].y - fl[j].y); if (dd < 20) { crash(fl[i], fl[j]); return; } if (dd < 62) { fl[i].warn = fl[j].warn = true; warn = true; } }
    if (warn) { S.warnT -= dt; if (S.warnT <= 0) { S.warnT = 0.45; K.beep(1500, 0.08, 'square', 0.04); } } else S.warnT = 0;
    if (Math.floor(S.t * 2) !== Math.floor((S.t - dt) * 2)) hud();
  }
  function crash(a, b) { S.run = false; S.boom = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; S.boomT = 0; FX.sfx.crash(); parts.burst(S.boom.x, S.boom.y, 70, { c: ['#f97316', '#fde047', '#fff', '#78716c'], sp: 300, life: 1.1, size: 6, g: 120 }); a.dead = b.dead = true; }
  function end() {
    S.over = true; var b = FX.best('scatc_best', S.score), t = Math.floor(S.t);
    $('endScore').textContent = S.score; $('endTime').textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + t % 60; $('endMax').textContent = S.maxAir; $('endBest').textContent = b.isNew && S.score > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + b.best; $('best').textContent = b.best;
    K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: S.score }); if (window.SCLB && S.score > 0) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: S.score + L(' 架次', ' landings') });
  }
  // ---------- 繪圖 ----------
  function plane(p, time, ghost) {
    var T = TY[p.ty], sc = 1, al = 1; if (p.land) { var dur = p.ty === 2 ? 1.3 : 2.6, f = Math.min(1, p.land / dur); sc = 1 - f * 0.45; al = 1 - Math.max(0, f - 0.6) / 0.4; }
    ctx.save(); ctx.globalAlpha = ghost ? 0.5 : al; ctx.translate(p.x, p.y);
    if (!p.land && !ghost) { ctx.save(); ctx.translate(7, 9); ctx.rotate(p.a); ctx.scale(sc, sc); ctx.fillStyle = 'rgba(0,0,0,.22)'; shape(p.ty, time, p, true); ctx.restore(); }
    ctx.rotate(p.a); ctx.scale(sc, sc); shape(p.ty, time, p, false); ctx.restore();
  }
  function shape(ty, time, p, shadow) { // 機頭朝 +X
    var c = TY[ty].c, i; if (!shadow) { ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.3; }
    function fs() { ctx.fill(); if (!shadow) ctx.stroke(); }
    if (ty === 0) { if (!shadow) ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-7, -17); ctx.lineTo(-12, -17); ctx.lineTo(-5, 0); ctx.lineTo(-12, 17); ctx.lineTo(-7, 17); ctx.closePath(); fs(); ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-18, -7); ctx.lineTo(-20, -7); ctx.lineTo(-17, 0); ctx.lineTo(-20, 7); ctx.lineTo(-18, 7); ctx.closePath(); fs(); if (!shadow) ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(-1, 0, 18, 4.2, 0, 0, 7); fs(); if (!shadow) { ctx.fillStyle = '#1e3a5f'; ctx.beginPath(); ctx.ellipse(12, 0, 3.5, 2.4, 0, 0, 7); ctx.fill(); if (p.fast) { ctx.fillStyle = '#fde047'; ctx.fillRect(-10, -1.2, 14, 2.4); } } }
    else if (ty === 1) { if (!shadow) ctx.fillStyle = c; ctx.beginPath(); FX.rr(ctx, -1, -15, 7, 30, 3); fs(); ctx.beginPath(); FX.rr(ctx, -14, -6, 4, 12, 2); fs(); if (!shadow) ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(-2, 0, 13, 3.6, 0, 0, 7); fs(); if (!shadow) { ctx.fillStyle = '#1e3a5f'; ctx.beginPath(); ctx.ellipse(4, 0, 3, 2.2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(31,41,55,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(11.5, -6 * Math.cos(time * 40)); ctx.lineTo(11.5, 6 * Math.cos(time * 40)); ctx.stroke(); } }
    else { if (!shadow) ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(2, 0, 9, 6, 0, 0, 7); fs(); ctx.beginPath(); FX.rr(ctx, -16, -1.5, 12, 3, 1.5); fs(); ctx.beginPath(); FX.rr(ctx, -17, -5, 2.5, 10, 1); fs(); if (!shadow) { ctx.fillStyle = '#1e3a5f'; ctx.beginPath(); ctx.ellipse(6, 0, 3.5, 3.6, 0, 0, 7); ctx.fill(); } ctx.save(); ctx.translate(2, 0); ctx.rotate(time * 26); ctx.strokeStyle = shadow ? 'rgba(0,0,0,.18)' : 'rgba(31,41,55,.75)'; ctx.lineWidth = 2; for (i = 0; i < 2; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke(); } ctx.restore(); }
  }
  function draw(time) {
    hit.begin(); ctx.drawImage(bgc, 0, 0, W, H); var i;
    ctx.fillStyle = 'rgba(0,0,0,.07)'; clouds.forEach(function (c) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.s, c.s * 0.5, 0, 0, 7); ctx.ellipse(c.x + c.s * 0.6, c.y + 8, c.s * 0.7, c.s * 0.4, 0, 0, 7); ctx.fill(); });
    // 選取中的飛機：標示它的降落點
    if (S.sel && !S.sel.land && S.run) { var e = ENTRY[S.sel.ty]; ctx.strokeStyle = TY[S.sel.ty].c; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + Math.sin(time * 7) * 0.4; ctx.beginPath(); ctx.arc(e.x, e.y, 26 + Math.sin(time * 7) * 3, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    S.planes.forEach(function (p) { if (p.land || !p.path.length) return; ctx.strokeStyle = p.go ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -time * 24; ctx.beginPath(); ctx.moveTo(p.x, p.y); p.path.forEach(function (q) { ctx.lineTo(q.x, q.y); }); ctx.stroke(); ctx.setLineDash([]); var l = p.path[p.path.length - 1]; ctx.fillStyle = p.go ? TY[p.ty].c : '#fff'; ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, 7); ctx.fill(); });
    S.planes.forEach(function (p) { if (p.dead) return; if (p.warn) { ctx.strokeStyle = 'rgba(239,68,68,' + (0.5 + Math.sin(time * 14) * 0.4) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 7); ctx.stroke(); } if (S.sel === p && !p.land) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 7); ctx.stroke(); } plane(p, time); });
    S.incoming.forEach(function (n) { var x = FX.clamp(n.x, 18, W - 18), y = FX.clamp(n.y, 18, H - 18), b = Math.floor(time * 6) % 2; ctx.fillStyle = b ? TY[n.ty].c : '#fff'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.stroke(); FX.text(ctx, '!', x, y + 1, 15, '#1f2937'); });
    parts.draw(ctx); floats.draw(ctx);
    if (S.boom) { var f = Math.min(1, S.boomT / 0.5); ctx.fillStyle = 'rgba(255,255,255,' + (1 - f) * 0.7 + ')'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(249,115,22,' + (1 - f) + ')'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(S.boom.x, S.boom.y, f * 90, 0, 7); ctx.stroke(); FX.text(ctx, '💥', S.boom.x, S.boom.y, 40 + f * 20); }
    // 圖例
    ctx.fillStyle = 'rgba(8,19,28,.72)'; FX.rr(ctx, 8, 8, 196, 30, 15); ctx.fill(); [[0, 24], [1, 88], [2, 150]].forEach(function (a) { ctx.save(); ctx.translate(a[1] + 4, 23); ctx.scale(0.62, 0.62); shape(a[0], time, {}, false); ctx.restore(); FX.text(ctx, '→', a[1] + 22, 23, 12, '#fff'); ctx.fillStyle = TY[a[0]].c; if (a[0] === 2) { ctx.beginPath(); ctx.arc(a[1] + 38, 23, 6, 0, 7); ctx.fill(); } else ctx.fillRect(a[1] + 31, 20, a[0] ? 12 : 18, 6); });
    if (S.run && S.score === 0 && S.t < 22 && S.planes.length && !S.planes.some(function (p) { return p.go; })) { var p0 = S.planes[0], e0 = ENTRY[p0.ty], ff = (time * 0.5) % 1; ctx.fillStyle = 'rgba(8,19,28,.88)'; FX.rr(ctx, 60, 600, 360, 32, 16); ctx.fill(); FX.text(ctx, L('從飛機按住，拖到同顏色跑道的箭頭端', 'Press on a plane and drag to the arrows of its runway'), W / 2, 616.5, 12.5, '#fff'); FX.text(ctx, '👆', p0.x + (e0.x - p0.x) * ff + 6, p0.y + (e0.y - p0.y) * ff + 16, 26); }
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__at = { S: function () { return S; }, go: start, step: step, ENTRY: ENTRY, TY: TY };
})();
