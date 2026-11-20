/* 極速公路 — stockcorp.github.io/highway/
   仿 3D（分段投影）公路賽車。賽道 = 5 個場景各 2000 段循環；每個場景尾端是檢查點。
   車子自動加速；左右轉向、煞車、氮氣。分數 = 距離(m) + 超車 30 + 擦身 80。
   排行榜：mode = classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'highway', $ = K.$, L = K.L, W = 480, H = 620;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H);
  var SEG = 200, RUMBLE = 3, ROADW = 2000, CAMH = 1000, DRAW = 170, STAGE = 2000, NSTAGE = 5, MAXSP = SEG * 60, UNIT = 144;
  var segs = [], cars = [], TRACK = 0, S = null, loop = null, eng = FX.Engine(), wind = FX.Noise('bandpass'), parts = FX.Parts(200), floats = FX.Floats(), shake = FX.Shake();
  // 場景配色：天空上/下、遠山、近山、草地、路面、路肩、太陽、星星、霧
  var PAL = [
    { sky: [[36, 132, 232], [176, 226, 255]], m1: [96, 150, 200], m2: [44, 120, 110], grass: [70, 170, 80], road: [92, 96, 104], rum: [230, 60, 60], sun: [255, 244, 190], stars: 0, name: ['海岸公路', 'Coast'] },
    { sky: [[250, 120, 60], [255, 214, 140]], m1: [196, 108, 72], m2: [150, 78, 52], grass: [222, 176, 108], road: [116, 96, 84], rum: [250, 240, 220], sun: [255, 210, 120], stars: 0, name: ['夕陽沙漠', 'Desert'] },
    { sky: [[6, 8, 30], [40, 30, 86]], m1: [22, 24, 60], m2: [14, 16, 40], grass: [18, 34, 44], road: [44, 46, 58], rum: [250, 204, 21], sun: [230, 236, 255], stars: 1, name: ['夜晚都市', 'Night City'] },
    { sky: [[120, 160, 210], [236, 244, 252]], m1: [190, 206, 226], m2: [150, 172, 200], grass: [238, 244, 250], road: [108, 114, 126], rum: [60, 120, 220], sun: [255, 255, 255], stars: 0, name: ['雪地山路', 'Snow Pass'] },
    { sky: [[90, 60, 140], [255, 170, 150]], m1: [70, 80, 120], m2: [30, 70, 60], grass: [36, 110, 66], road: [78, 82, 90], rum: [240, 240, 240], sun: [255, 190, 170], stars: 0.25, name: ['黃昏森林', 'Dusk Forest'] }
  ];
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, k) { k = k == null ? 1 : k; return 'rgb(' + (c[0] * k | 0) + ',' + (c[1] * k | 0) + ',' + (c[2] * k | 0) + ')'; }

  // ---------- 預先畫好的圖（路邊物件、車尾） ----------
  function spr(w, h, worldW, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return { c: c, w: w, h: h, ww: worldW }; }
  function leafBlob(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  var SP = {
    palm: spr(160, 260, 1300, function (g, w, h) { g.strokeStyle = '#7a5230'; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2 + 6, h); g.quadraticCurveTo(w / 2 - 16, h * 0.6, w / 2, 66); g.stroke(); for (var i = 0; i < 7; i++) { var a = -Math.PI / 2 + (i - 3) * 0.52; g.strokeStyle = i % 2 ? '#1f9d4a' : '#27b85a'; g.lineWidth = 11; g.beginPath(); g.moveTo(w / 2, 66); g.quadraticCurveTo(w / 2 + Math.cos(a) * 46, 66 + Math.sin(a) * 46 - 18, w / 2 + Math.cos(a) * 76, 66 + Math.sin(a) * 50 + 22); g.stroke(); } }),
    cactus: spr(110, 190, 800, function (g, w, h) { g.strokeStyle = '#2f8f4e'; g.lineCap = 'round'; g.lineWidth = 26; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 26); g.stroke(); g.lineWidth = 16; g.beginPath(); g.moveTo(w / 2, 110); g.lineTo(20, 110); g.lineTo(20, 60); g.moveTo(w / 2, 86); g.lineTo(92, 86); g.lineTo(92, 40); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 6, h); g.lineTo(w / 2 - 6, 30); g.stroke(); }),
    rock: spr(150, 90, 900, function (g, w, h) { g.fillStyle = '#9a6b4c'; g.beginPath(); g.moveTo(4, h); g.lineTo(26, 30); g.lineTo(66, 6); g.lineTo(118, 24); g.lineTo(146, h); g.fill(); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(26, 30); g.lineTo(66, 6); g.lineTo(74, 46); g.fill(); }),
    pine: spr(140, 250, 1200, function (g, w, h) { g.fillStyle = '#5b3d24'; g.fillRect(w / 2 - 8, h - 46, 16, 46); for (var i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#14633a' : '#1a7a46'; g.beginPath(); g.moveTo(w / 2, i * 44); g.lineTo(w / 2 + 34 + i * 12, 78 + i * 44); g.lineTo(w / 2 - 34 - i * 12, 78 + i * 44); g.fill(); } }),
    snowpine: spr(140, 250, 1200, function (g, w, h) { g.fillStyle = '#5b3d24'; g.fillRect(w / 2 - 8, h - 46, 16, 46); for (var i = 0; i < 4; i++) { g.fillStyle = '#1f6b4a'; g.beginPath(); g.moveTo(w / 2, i * 44); g.lineTo(w / 2 + 34 + i * 12, 78 + i * 44); g.lineTo(w / 2 - 34 - i * 12, 78 + i * 44); g.fill(); g.fillStyle = '#f4f8fc'; g.beginPath(); g.moveTo(w / 2, i * 44); g.lineTo(w / 2 + 20 + i * 7, 44 + i * 44); g.lineTo(w / 2, 34 + i * 44); g.lineTo(w / 2 - 20 - i * 7, 44 + i * 44); g.fill(); } }),
    lamp: spr(90, 260, 620, function (g, w, h) { g.fillStyle = '#39404f'; g.fillRect(w - 16, 20, 9, h - 20); g.fillRect(14, 20, w - 26, 8); var r = g.createRadialGradient(20, 34, 2, 20, 34, 30); r.addColorStop(0, 'rgba(255,240,170,1)'); r.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = r; g.fillRect(0, 4, 60, 60); g.fillStyle = '#fff6c8'; g.fillRect(12, 28, 18, 7); }),
    tower: spr(170, 330, 1700, function (g, w, h) { g.fillStyle = '#141a33'; g.fillRect(10, 20, w - 20, h); g.fillStyle = '#1d2547'; g.fillRect(10, 20, 22, h); for (var y = 34; y < h - 10; y += 22) for (var x = 40; x < w - 26; x += 22) { g.fillStyle = Math.random() < 0.55 ? (Math.random() < 0.5 ? '#ffd166' : '#7dd3fc') : '#0c1024'; g.fillRect(x, y, 12, 13); } g.fillStyle = '#ef4444'; g.fillRect(w / 2 - 2, 0, 4, 22); }),
    board: spr(230, 190, 1500, function (g, w, h) { g.fillStyle = '#39404f'; g.fillRect(30, 96, 10, h); g.fillRect(w - 40, 96, 10, h); var gr = g.createLinearGradient(0, 0, w, 100); gr.addColorStop(0, '#f43f5e'); gr.addColorStop(1, '#f59e0b'); g.fillStyle = gr; FX.rr(g, 4, 4, w - 8, 100, 10); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#fff'; g.font = '900 40px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOCKCORP', w / 2, 40, w - 30); g.font = '700 20px system-ui'; g.fillText('GAMES ★ 2026', w / 2, 76); }),
    bush: spr(130, 80, 800, function (g, w, h) { leafBlob(g, 34, 52, 30, '#1c8d48'); leafBlob(g, 70, 40, 36, '#22a355'); leafBlob(g, 100, 54, 26, '#178041'); }),
    snowman: spr(90, 130, 560, function (g, w, h) { leafBlob(g, 45, 96, 32, '#f8fafc'); leafBlob(g, 45, 48, 23, '#f8fafc'); g.fillStyle = '#111'; g.fillRect(36, 42, 5, 5); g.fillRect(50, 42, 5, 5); g.fillStyle = '#f97316'; g.beginPath(); g.moveTo(45, 50); g.lineTo(62, 54); g.lineTo(45, 57); g.fill(); g.fillStyle = '#ef4444'; g.fillRect(26, 66, 38, 7); }),
    gate: spr(600, 300, 5200, function (g, w, h) { g.fillStyle = '#e5e7eb'; g.fillRect(14, 40, 20, h); g.fillRect(w - 34, 40, 20, h); var gr = g.createLinearGradient(0, 0, 0, 80); gr.addColorStop(0, '#fde047'); gr.addColorStop(1, '#f59e0b'); g.fillStyle = gr; FX.rr(g, 6, 6, w - 12, 80, 12); g.fill(); g.fillStyle = '#111827'; g.font = '900 50px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHECK POINT', w / 2, 48); for (var i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(14 + i * 48, 86, 48, 12); } })
  };
  function carRear(g, w, h, col, o) {
    o = o || {};
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(w / 2, h - 5, w * 0.48, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#0c0d11'; FX.rr(g, w * 0.04, h * 0.62, w * 0.2, h * 0.34, 6); g.fill(); FX.rr(g, w * 0.76, h * 0.62, w * 0.2, h * 0.34, 6); g.fill();
    var top = o.truck ? 0.02 : 0.2, gr = g.createLinearGradient(0, h * top, 0, h); gr.addColorStop(0, FX.shade(col, 0.25)); gr.addColorStop(0.5, col); gr.addColorStop(1, FX.shade(col, -0.45));
    g.fillStyle = gr;
    if (o.truck) { FX.rr(g, w * 0.08, h * 0.02, w * 0.84, h * 0.8, 8); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h * 0.04); g.lineTo(w / 2, h * 0.8); g.stroke(); g.strokeRect(w * 0.12, h * 0.06, w * 0.76, h * 0.72); }
    else {
      g.beginPath(); g.moveTo(w * 0.24, h * 0.5); g.lineTo(w * 0.3, h * 0.22); g.quadraticCurveTo(w / 2, h * 0.14, w * 0.7, h * 0.22); g.lineTo(w * 0.76, h * 0.5); g.fill();
      var wg = g.createLinearGradient(0, h * 0.24, 0, h * 0.5); wg.addColorStop(0, '#1b2a44'); wg.addColorStop(1, '#3c5f8f'); g.fillStyle = wg; g.beginPath(); g.moveTo(w * 0.29, h * 0.47); g.lineTo(w * 0.34, h * 0.27); g.lineTo(w * 0.66, h * 0.27); g.lineTo(w * 0.71, h * 0.47); g.fill();
      g.fillStyle = gr; FX.rr(g, w * 0.07, h * 0.44, w * 0.86, h * 0.4, 12); g.fill();
      if (o.wing) { g.fillStyle = '#111827'; g.fillRect(w * 0.1, h * 0.36, w * 0.8, h * 0.06); g.fillRect(w * 0.2, h * 0.4, w * 0.05, h * 0.08); g.fillRect(w * 0.75, h * 0.4, w * 0.05, h * 0.08); }
    }
    g.fillStyle = '#16181d'; FX.rr(g, w * 0.07, h * 0.78, w * 0.86, h * 0.1, 5); g.fill();
    g.fillStyle = '#ff2b2b'; FX.rr(g, w * 0.1, h * 0.52, w * 0.22, h * 0.1, 4); g.fill(); FX.rr(g, w * 0.68, h * 0.52, w * 0.22, h * 0.1, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(w * 0.12, h * 0.535, w * 0.07, h * 0.03); g.fillRect(w * 0.81, h * 0.535, w * 0.07, h * 0.03);
    g.fillStyle = '#f8fafc'; FX.rr(g, w * 0.4, h * 0.64, w * 0.2, h * 0.09, 2); g.fill();
    if (o.wing) { g.fillStyle = '#2a2e38'; g.beginPath(); g.arc(w * 0.3, h * 0.84, 5, 0, 7); g.arc(w * 0.7, h * 0.84, 5, 0, 7); g.fill(); }
  }
  var CARCOL = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#e5e7eb', '#14b8a6', '#f97316'];
  var CARS = CARCOL.map(function (c) { return spr(150, 120, 760, function (g, w, h) { carRear(g, w, h, c); }); });
  var TRUCKS = ['#e2e8f0', '#fbbf24', '#60a5fa'].map(function (c) { return spr(170, 190, 900, function (g, w, h) { carRear(g, w, h, c, { truck: 1 }); }); });
  var HERO = spr(190, 140, 0, function (g, w, h) { carRear(g, w, h, '#e11d48', { wing: 1 }); });

  // ---------- 賽道 ----------
  function lastY() { return segs.length ? segs[segs.length - 1].p2.y : 0; }
  function addSeg(curve, y) { var n = segs.length; segs.push({ i: n, p1: { y: lastY(), z: n * SEG }, p2: { y: y, z: (n + 1) * SEG }, curve: curve, spr: [], cars: [], dark: Math.floor(n / RUMBLE) % 2 }); }
  function ein(a, b, p) { return a + (b - a) * p * p; } function eout(a, b, p) { return a + (b - a) * (1 - (1 - p) * (1 - p)); } function eio(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }
  function addRoad(en, hold, lv, curve, hill) {
    var sy = lastY(), ey = sy + hill * SEG, tot = en + hold + lv, n;
    for (n = 0; n < en; n++) addSeg(ein(0, curve, n / en), eio(sy, ey, n / tot));
    for (n = 0; n < hold; n++) addSeg(curve, eio(sy, ey, (en + n) / tot));
    for (n = 0; n < lv; n++) addSeg(eio(curve, 0, n / lv), eio(sy, ey, (en + hold + n) / tot));
  }
  function build() {
    segs = []; var seed = 12345, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var st = 0; st < NSTAGE; st++) {
      var end = (st + 1) * STAGE; addRoad(40, 40, 40, 0, 0);
      while (segs.length < end - 160) {
        var r = rnd(), len = 30 + (rnd() * 50 | 0), c = [0, 2, -2, 3.5, -3.5, 5, -5, 0][(rnd() * 8) | 0] * (0.8 + st * 0.08), hl = [0, 0, 22, -22, 42, -42][(rnd() * 6) | 0];
        if (r < 0.2) addRoad(len, len, len, 0, hl); else addRoad(len, len + (rnd() * 40 | 0), len, c, hl * (rnd() < 0.6 ? 1 : 0));
      }
      var rest = end - segs.length, y0 = lastY(); for (var k = 0; k < rest; k++) addSeg(0, eio(y0, 0, (k + 1) / rest));
    }
    TRACK = segs.length * SEG;
    // 路邊物件
    var KIND = [['palm', 'palm', 'bush', 'board'], ['cactus', 'rock', 'cactus', 'board'], ['lamp', 'tower', 'tower', 'board'], ['snowpine', 'snowpine', 'snowman', 'rock'], ['pine', 'pine', 'bush', 'board']];
    for (var i = 20; i < segs.length; i += 4) {
      var s = Math.floor(i / STAGE), ks = KIND[s], side = rnd() < 0.5 ? -1 : 1;
      if (s === 2 && i % 16 === 0) { segs[i].spr.push({ s: SP.lamp, o: -1.25, flip: 1 }); segs[i].spr.push({ s: SP.lamp, o: 1.25 }); }
      if (rnd() < 0.72) { var kd = ks[(rnd() * ks.length) | 0]; if (kd === 'board' && rnd() < 0.8) kd = ks[0]; if (kd === 'lamp') kd = 'tower'; segs[i].spr.push({ s: SP[kd], o: side * (1.5 + rnd() * (kd === 'tower' ? 4 : 2.6)), solid: 1 }); }
      if (rnd() < 0.5) { var k2 = ks[(rnd() * 3) | 0]; if (k2 === 'lamp') k2 = 'tower'; segs[i + 2].spr.push({ s: SP[k2], o: -side * (2.2 + rnd() * 5) }); }
    }
    for (st = 0; st < NSTAGE; st++) segs[(st + 1) * STAGE - 30].spr.push({ s: SP.gate, o: 0, gate: 1 });
  }
  function seg(z) { return segs[Math.floor(z / SEG) % segs.length]; }
  function resetCars(density) {
    segs.forEach(function (s) { s.cars.length = 0; }); cars = [];
    for (var n = 0; n < density; n++) {
      var z = 6000 + Math.random() * (TRACK - 9000), truck = Math.random() < 0.2;
      var c = { z: z, o: FX.pick([-0.66, 0, 0.66]), s: truck ? FX.pick(TRUCKS) : FX.pick(CARS), sp: MAXSP * (truck ? FX.rnd(0.22, 0.34) : FX.rnd(0.3, 0.55)), w: truck ? 0.24 : 0.2, sway: Math.random() < 0.25 ? FX.rnd(0.3, 0.8) : 0, ph: Math.random() * 6, o0: 0 };
      c.o0 = c.o; cars.push(c); seg(z).cars.push(c);
    }
  }

  // ---------- 遊戲狀態 ----------
  function reset() {
    S = { pos: 0, x: 0, sp: 0, time: 50, started: false, over: false, run: false, dist: 0, lap: 0, pass: 0, near: 0, nitro: 0.5, boost: false, stageN: 1, nextCp: STAGE - 30, sky: 0, tilt: 0, bounce: 0, banner: 0, bannerTxt: '', coast: false, top: 0 };
    resetCars(150); parts.clear(); floats.clear(); hud();
  }
  function hud() { $('spd').textContent = Math.round(S.sp / MAXSP * 300) + ' km/h'; $('time').textContent = Math.max(0, Math.ceil(S.time)); $('dist').textContent = FX.fmt(S.dist) + ' m'; }
  function score() { return Math.round(S.dist + S.pass * 30 + S.near * 80); }
  function start() {
    reset(); $('cover').classList.add('off'); K.close('ovEnd');
    FX.countdown($('big'), function () { S.run = true; S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); });
  }
  function step(dt) {
    floats.step(dt); parts.step(dt); shake.step(dt);
    if (!S.run) { eng.set(60, S.over ? 0 : 0.012); wind.set(0); return; }
    var k = FX.keys, pseg = seg(S.pos + CAMH * 0.84), spct = S.sp / MAXSP, dx = dt * 2.4 * Math.min(1, spct * 1.6 + 0.05);
    S.boost = !!k.a && S.nitro > 0 && !S.coast;
    if (S.boost) { S.nitro = Math.max(0, S.nitro - dt * 0.3); if (Math.random() < 0.7) parts.burst(W / 2 + FX.rnd(-22, 22), H - 66, 1, { c: ['#fde047', '#fb923c', '#60a5fa'], sp: 60, life: 0.3, g: 300, size: 6, round: 1, ang: Math.PI / 2, spread: 0.4 }); }
    var steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    S.x += steer * dx; S.tilt += (steer - S.tilt) * Math.min(1, dt * 9);
    S.x -= dx * spct * pseg.curve * 0.3;
    var max = MAXSP * (S.boost ? 1.3 : 1), acc = S.coast ? -MAXSP / 3.5 : k.down ? -MAXSP * 0.9 : (S.sp < max ? (S.boost ? MAXSP / 2.4 : MAXSP / 5.5) * (1.25 - spct * 0.5) : -MAXSP / 4);
    S.sp += acc * dt;
    var off = Math.abs(S.x) > 1;
    if (off) {
      if (S.sp > MAXSP * 0.3) S.sp -= MAXSP * 0.9 * dt; shake.kick(2.5 * spct); if (Math.random() < 0.5) parts.burst(W / 2 + FX.rnd(-40, 40), H - 50, 1, { c: rgb(pal().grass, 0.8), sp: 140, life: 0.4, size: 5, ang: -Math.PI / 2, spread: 1 });
      for (var n = 0; n < pseg.spr.length; n++) { var sp = pseg.spr[n], ao = Math.abs(sp.o), ax = Math.abs(S.x); if (sp.solid && Math.sign(sp.o) === Math.sign(S.x) && ax > ao - 0.25 && ax < ao + 0.6 && S.sp > 600) { S.sp = 0; crash(18); S.x = Math.sign(S.x) * Math.max(1.02, ao - 0.5); break; } }
    }
    S.x = FX.clamp(S.x, -2.4, 2.4); S.sp = FX.clamp(S.sp, 0, max * 1.02);
    // 車流
    var pz = S.pos + CAMH * 0.84;
    cars.forEach(function (c) {
      var os = seg(c.z), before = rel(c.z, pz);
      c.z = (c.z + c.sp * dt) % TRACK; if (c.sway) { c.ph += dt * c.sway; c.o = FX.clamp(c.o0 + Math.sin(c.ph) * 0.5, -0.8, 0.8); }
      var ns = seg(c.z); if (ns !== os) { os.cars.splice(os.cars.indexOf(c), 1); ns.cars.push(c); }
      c._b = before;
    });
    var np = S.pos + S.sp * dt;
    cars.forEach(function (c) {
      var after = rel(c.z, np + CAMH * 0.84), ddx = Math.abs(c.o - S.x);
      if (c._b > 0 && after <= 0) {
        if (ddx < (c.w + 0.27) && S.sp > c.sp) { S.sp = c.sp * 0.55; np = S.pos; crash(12); S.x += (S.x >= c.o ? 0.35 : -0.35); return; }
        S.pass++; if (ddx < 0.78) { S.near++; S.nitro = Math.min(1, S.nitro + 0.16); floats.add(W / 2, H - 170, L('擦身 +80', 'Close! +80'), '#fde047', 22); FX.sfx.good(); }
      }
    });
    S.dist += (np - S.pos) / UNIT; S.pos = np; if (S.pos >= TRACK) { S.pos -= TRACK; S.lap++; S.nextCp -= segs.length; resetCars(Math.min(320, 150 + S.lap * 50)); }
    S.sky += pseg.curve * spct * dt * 0.06; S.bounce = Math.sin(S.pos / 90) * spct * (off ? 5 : 1.4);
    S.top = Math.max(S.top, S.sp);
    // 檢查點與時間
    var si = Math.floor(S.pos / SEG);
    if (si >= S.nextCp) { S.nextCp += STAGE; S.stageN++; var add = Math.max(22, 37 - S.stageN * 1.5 | 0); S.time += add; S.nitro = Math.min(1, S.nitro + 0.4); S.banner = 2.2; S.bannerTxt = 'CHECKPOINT  +' + add + 's'; FX.sfx.great(); }
    if (!S.coast) { S.time -= dt; if (S.time <= 0) { S.time = 0; S.coast = true; S.banner = 3; S.bannerTxt = L('時間到！', 'TIME UP!'); FX.sfx.bad(); } else if (S.time < 10 && Math.floor(S.time + dt) !== Math.floor(S.time)) FX.sfx.tick(); }
    else if (S.sp <= 20) return finish();
    S.banner -= dt;
    eng.set(70 + spct * 190 + (S.boost ? 40 : 0), 0.028); wind.set(spct * 0.035 + (off ? 0.05 : 0), off ? 300 : 900 + spct * 1400);
    hud();
  }
  function rel(z, pz) { var d = z - pz; if (d > TRACK / 2) d -= TRACK; if (d < -TRACK / 2) d += TRACK; return d; }
  function crash(v) { shake.kick(v); FX.sfx.crash(); parts.burst(W / 2, H - 110, 16, { c: ['#fff', '#fbbf24', '#9ca3af'], sp: 260, life: 0.6, size: 6 }); }
  function finish() {
    S.run = false; S.over = true; eng.stop(); wind.stop();
    var sc = score(), b = FX.best('schighway_best', sc);
    $('endScore').textContent = FX.fmt(sc); $('endDist').textContent = FX.fmt(S.dist) + ' m'; $('endPass').textContent = S.pass;
    $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.fmt(b.best);
    if (window.SC) SC.post('gameover', { game: GAME, score: sc });
    setTimeout(function () { K.open('ovEnd'); $('cover').classList.remove('off'); if (sc > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: sc, text: L('第 ', 'Stage ') + S.stageN + L(' 關・', ' · ') + FX.fmt(S.dist) + ' m' }); }, 500);
  }

  // ---------- 繪圖 ----------
  var HM = [[], []]; (function () { for (var l = 0; l < 2; l++) for (var i = 0; i <= 64; i++) HM[l].push(0.35 + 0.3 * Math.sin(i * 0.39 + l * 2) + 0.2 * Math.sin(i * 0.98 + l) + 0.15 * Math.sin(i * 2.36 + l * 5)); })();
  var STARS = []; for (var si = 0; si < 70; si++) STARS.push([Math.random() * W, Math.random() * H * 0.42, Math.random() * 1.6 + 0.4]);
  var curPal = null;
  function pal() { return curPal || PAL[0]; }
  function calcPal() {
    var p = (S.pos / SEG) / STAGE, i = Math.floor(p) % NSTAGE, f = p - Math.floor(p), a = PAL[i], b = PAL[(i + 1) % NSTAGE], t = f > 0.94 ? (f - 0.94) / 0.06 : 0;
    curPal = t ? { sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t)], m1: mix(a.m1, b.m1, t), m2: mix(a.m2, b.m2, t), grass: mix(a.grass, b.grass, t), road: mix(a.road, b.road, t), rum: mix(a.rum, b.rum, t), sun: mix(a.sun, b.sun, t), stars: a.stars + (b.stars - a.stars) * t } : a;
  }
  function ridge(l, base, amp, col, par) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    var offx = ((S.sky * par) % 1 + 1) % 1 * 64;
    for (var x = 0; x <= 64; x++) { var hx = (x + offx) % 64, a = HM[l][Math.floor(hx)], b = HM[l][Math.floor(hx) + 1], v = a + (b - a) * (hx % 1); ctx.lineTo(x / 64 * W, base - v * amp); }
    ctx.lineTo(W, H); ctx.fill();
  }
  function project(p, cx, cy, cz, depth) { var z = p.z - cz, sc = depth / z; p.sc = sc; p.sx = W / 2 + sc * (p.x - cx) * W / 2; p.sy = H * 0.46 - sc * (p.y - cy) * H * 0.62; p.sw = sc * ROADW * W / 2; }
  function quad(x1, y1, w1, x2, y2, w2, col) { y1 += 0.8; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1); ctx.fill(); }
  function draw(time) {
    calcPal(); var P = curPal, depth = 0.84 * (S.boost ? 0.92 : 1);
    ctx.save(); shake.apply(ctx);
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.5); g.addColorStop(0, rgb(P.sky[0])); g.addColorStop(1, rgb(P.sky[1])); ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    if (P.stars > 0.02) { ctx.fillStyle = '#fff'; STARS.forEach(function (s) { ctx.globalAlpha = P.stars * (0.5 + 0.5 * Math.sin(time * 2 + s[0])); ctx.fillRect(s[0], s[1], s[2], s[2]); }); ctx.globalAlpha = 1; }
    var sunx = W * 0.72 - ((S.sky * 30) % W), sg = ctx.createRadialGradient(sunx, H * 0.2, 4, sunx, H * 0.2, 110); sg.addColorStop(0, rgb(P.sun)); sg.addColorStop(0.22, rgb(P.sun)); sg.addColorStop(0.24, 'rgba(' + (P.sun[0] | 0) + ',' + (P.sun[1] | 0) + ',' + (P.sun[2] | 0) + ',.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(sunx - 120, H * 0.2 - 120, 240, 240);
    ridge(0, H * 0.47, 120, rgb(P.m1), 0.6); ridge(1, H * 0.49, 70, rgb(P.m2), 1.3);
    ctx.fillStyle = rgb(P.grass, 0.9); ctx.fillRect(-20, H * 0.46, W + 40, H);
    var base = seg(S.pos), bp = (S.pos % SEG) / SEG, pseg = seg(S.pos + CAMH * depth), pp = ((S.pos + CAMH * depth) % SEG) / SEG;
    var py = pseg.p1.y + (pseg.p2.y - pseg.p1.y) * pp, camY = py + CAMH, maxy = H, x = 0, dxx = -(base.curve * bp), n, s;
    for (n = 0; n < DRAW; n++) {
      s = segs[(base.i + n) % segs.length]; var loopd = s.i < base.i ? TRACK : 0;
      s.p1.x = x; s.p2.x = x + dxx; s.fog = n / DRAW; s.clip = maxy;
      project(s.p1, S.x * ROADW, camY, S.pos - loopd, depth); project(s.p2, S.x * ROADW, camY, S.pos - loopd, depth);
      x += dxx; dxx += s.curve;
      if (s.p1.z - (S.pos - loopd) <= depth || s.p2.sy >= s.p1.sy || s.p2.sy >= maxy) continue;
      var dk = s.dark ? 0.9 : 1, y1 = s.p1.sy, y2 = s.p2.sy;
      ctx.fillStyle = rgb(P.grass, dk); ctx.fillRect(0, y2, W, y1 - y2 + 1);
      var r1 = s.p1.sw * 1.14, r2 = s.p2.sw * 1.14;
      quad(s.p1.sx, y1, r1, s.p2.sx, y2, r2, s.dark ? rgb(P.rum) : '#f1f5f9');
      quad(s.p1.sx, y1, s.p1.sw, s.p2.sx, y2, s.p2.sw, rgb(P.road, dk));
      if (!s.dark) { var l1 = s.p1.sw / 46, l2 = s.p2.sw / 46; quad(s.p1.sx - s.p1.sw / 3, y1, l1, s.p2.sx - s.p2.sw / 3, y2, l2, 'rgba(255,255,255,.85)'); quad(s.p1.sx + s.p1.sw / 3, y1, l1, s.p2.sx + s.p2.sw / 3, y2, l2, 'rgba(255,255,255,.85)'); }
      if (s.fog > 0.45) { ctx.fillStyle = 'rgba(' + (P.sky[1][0] | 0) + ',' + (P.sky[1][1] | 0) + ',' + (P.sky[1][2] | 0) + ',' + ((s.fog - 0.45) * 1.7).toFixed(2) + ')'; ctx.fillRect(0, y2, W, y1 - y2 + 1); }
      maxy = y2;
    }
    for (n = DRAW - 1; n > 0; n--) {
      s = segs[(base.i + n) % segs.length]; if (!s.p1.sc || s.p1.sc <= 0) continue;
      var al = s.fog > 0.6 ? Math.max(0, 1 - (s.fog - 0.6) * 2.5) : 1; ctx.globalAlpha = al;
      for (var i = 0; i < s.spr.length; i++) { var o = s.spr[i]; sprite(o.s, s.p1.sc, s.p1.sx + s.p1.sc * o.o * ROADW * W / 2, s.p1.sy, o.gate ? -0.5 : (o.o < 0 ? -1 : 0), s.clip, o.flip); }
      for (i = 0; i < s.cars.length; i++) { var c = s.cars[i], cp = (c.z % SEG) / SEG, sc = s.p1.sc + (s.p2.sc - s.p1.sc) * cp; sprite(c.s, sc, (s.p1.sx + (s.p2.sx - s.p1.sx) * cp) + sc * c.o * ROADW * W / 2, s.p1.sy + (s.p2.sy - s.p1.sy) * cp, -0.5, s.clip); }
      ctx.globalAlpha = 1;
    }
    // 玩家車
    if (S.boost) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (i = 0; i < 14; i++) { var a = Math.random() * 6.28, r0 = 150 + Math.random() * 120; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.5 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 90), H * 0.5 + Math.sin(a) * (r0 + 90)); ctx.stroke(); } }
    ctx.save(); ctx.translate(W / 2 + S.tilt * 10, H - 92 + S.bounce); ctx.rotate(S.tilt * 0.07 - (pseg.curve * 0.004 * S.sp / MAXSP)); ctx.drawImage(HERO.c, -HERO.w * 0.46, -HERO.h * 0.5, HERO.w * 0.92, HERO.h * 0.92);
    if (FX.keys.down && S.run) { ctx.fillStyle = 'rgba(255,60,60,.55)'; ctx.fillRect(-72, 2, 40, 14); ctx.fillRect(34, 2, 40, 14); }
    ctx.restore(); parts.draw(ctx); floats.draw(ctx);
    ctx.restore();
    // 抬頭資訊
    var tw = 150; ctx.fillStyle = 'rgba(0,0,0,.4)'; FX.rr(ctx, W / 2 - tw / 2, 10, tw, 44, 14); ctx.fill();
    FX.text(ctx, Math.max(0, Math.ceil(S.time)) + '', W / 2, 34, 30, S.time < 10 && S.run ? (Math.floor(time * 4) % 2 ? '#fecaca' : '#ef4444') : '#fff');
    FX.text(ctx, S.stageN + '・' + L(P.name ? P.name[0] : '', P.name ? P.name[1] : ''), 14, 26, 13, 'rgba(255,255,255,.8)', 'left');
    ctx.fillStyle = 'rgba(0,0,0,.4)'; FX.rr(ctx, W - 124, 16, 110, 16, 8); ctx.fill(); var ng = ctx.createLinearGradient(W - 122, 0, W - 16, 0); ng.addColorStop(0, '#38bdf8'); ng.addColorStop(1, '#f97316'); ctx.fillStyle = ng; FX.rr(ctx, W - 122, 18, 106 * S.nitro, 12, 6); ctx.fill(); FX.text(ctx, '🔥', W - 136, 25, 14);
    if (S.banner > 0) { ctx.globalAlpha = Math.min(1, S.banner); FX.text(ctx, S.bannerTxt, W / 2, H * 0.3, 30, '#fde047', 'center', 'rgba(0,0,0,.7)'); ctx.globalAlpha = 1; }
  }
  function sprite(sp, sc, x, y, ox, clip, flip) {
    var dw = sp.ww * sc * W / 2, dh = dw * sp.h / sp.w; if (dw < 2 || dw > W * 3) return;
    var dx = x + dw * ox, dy = y - dh, ch = clip != null ? Math.max(0, dy + dh - clip) : 0; if (ch >= dh) return;
    if (flip) { ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(sp.c, 0, 0, sp.w, sp.h - sp.h * ch / dh, 0, 0, dw, dh - ch); ctx.restore(); }
    else ctx.drawImage(sp.c, 0, 0, sp.w, sp.h - sp.h * ch / dh, dx, dy, dw, dh - ch);
  }

  FX.pad($('touch'), [{ k: 'left', t: '◀' }, { k: 'right', t: '▶' }, { gap: 1 }, { k: 'down', t: '🛑' }, { k: 'a', t: '🔥', cls: 'go' }]);
  $('bStart').onclick = start;
  $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; eng.stop(); wind.stop(); start(); } };
  $('bAgain').onclick = start;
  FX.sound(function () { if (K.muted) { eng.stop(); wind.stop(); } });
  build(); reset();
  loop = FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__hw = { S: function () { return S; }, start: function () { reset(); $('cover').classList.add('off'); S.run = true; S.started = true; }, end: function () { S.time = 0.01; }, segs: segs };
})();
