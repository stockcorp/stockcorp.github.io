/* 直線加速賽 — stockcorp.github.io/drag/
   402 公尺（1/4 英里）側視加速賽。起跑前按住油門控制轉速，綠燈按起跑；之後抓綠區換檔，氮氣一次。
   物理：驅動力 = 馬力 × 扭力曲線(轉速) × 齒比，受輪胎抓地上限限制；空氣阻力 ∝ v²。
   8 位對手（用同一套物理、以二分法求出能跑出目標秒數的馬力）。獎金可升級引擎／輪胎／變速箱／氮氣。
   排行榜：mode = quarter，綠燈到衝線的時間（含反應，伺服器計時，越短越好）。 */
(function () {
  'use strict';
  var GAME = 'drag', $ = K.$, L = K.L, W = 480, H = 600, SCN = 320, DIST = 402, PXM = 26, PX = 118;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H);
  var RATIO = [3.2, 2.1, 1.5, 1.15, 0.92, 0.76], VR0 = 72.2, A0 = 2.25;
  var RIV = [
    { n: ['新手阿明', 'Rookie Ming'], et: 13.6, c: '#94a3b8' }, { n: ['夜市小霸王', 'Night-Market Kid'], et: 12.9, c: '#22c55e' }, { n: ['山道阿輝', 'Touge Hui'], et: 12.2, c: '#3b82f6' }, { n: ['改裝店老闆', 'Tuner Boss'], et: 11.5, c: '#f59e0b' },
    { n: ['零四小王子', 'Quarter Prince'], et: 10.9, c: '#a855f7' }, { n: ['港口女王', 'Harbour Queen'], et: 10.3, c: '#ec4899' }, { n: ['高架幽靈', 'Overpass Ghost'], et: 9.7, c: '#e5e7eb' }, { n: ['傳說車神', 'The Legend'], et: 9.15, c: '#111827' }
  ];
  var UPS = [{ k: 'eng', n: ['引擎', 'Engine'], d: ['馬力大增', 'More power'], base: 500 }, { k: 'tire', n: ['輪胎', 'Tyres'], d: ['起跑抓地', 'Launch grip'], base: 350 }, { k: 'gear', n: ['變速箱', 'Gearbox'], d: ['換檔更快', 'Faster shifts'], base: 300 }, { k: 'nos', n: ['氮氣', 'Nitro'], d: ['噴更久', 'Longer burn'], base: 400 }];
  var SV = K.load('scdrag_save', null) || { cash: 0, up: { eng: 0, tire: 0, gear: 0, nos: 0 }, rival: 0, max: 0, best: 0 };
  var S = null, eng = FX.Engine(), tyre = FX.Noise('bandpass'), parts = FX.Parts(300), floats = FX.Floats(), shake = FX.Shake();

  // ---------- 物理 ----------
  function tq(r) { return Math.max(0.35, 1 - 1.6 * (r - 0.72) * (r - 0.72)); }
  function cfgMe() { return { power: 1 + SV.up.eng * 0.38, grip: 0.86 + SV.up.tire * 0.2, shiftT: 0.34 - SV.up.gear * 0.045, nos: 1.6 + SV.up.nos * 0.45 }; }
  function newCar(cfg) { return { cfg: cfg, d: 0, v: 0, g: 0, r: 0.2, sh: 0, nosT: 0, nosUsed: false, t: 0, q: 'good', fin: 0, lim: false, boost: 0, spin: 0 }; }
  function stepCar(c, dt) {
    c.t += dt; if (c.sh > 0) c.sh -= dt; if (c.nosT > 0) c.nosT -= dt; if (c.boost > 0) c.boost -= dt;
    var rw = c.v * RATIO[c.g] / VR0, r = Math.max(rw, 0.3); c.lim = rw >= 1; if (r > 1) r = 1;
    var pm = c.q === 'bog' && c.t < 1.2 ? 0.55 : c.q === 'perfect' && c.t < 1 ? 1.1 : 1, tm = c.q === 'spin' && c.t < 1.3 ? 0.55 : 1;
    var F = c.sh > 0 || c.lim ? 0 : c.cfg.power * tq(r) * RATIO[c.g] * A0 * pm * (c.nosT > 0 ? 1.38 : 1) * (c.boost > 0 ? 1.12 : 1), cap = c.cfg.grip * 9.8 * tm;
    c.spin = F > cap ? F - cap : 0; if (F > cap) F = cap;
    c.v = Math.max(0, c.v + (F - 0.00042 * c.v * c.v - 0.15) * dt); c.d += c.v * dt; c.r = c.lim ? 0.985 + Math.random() * 0.015 : r;
    if (!c.fin && c.d >= DIST) c.fin = c.t;
  }
  function simET(cfg) { var c = newCar(cfg), n = 0; while (!c.fin && n++ < 2400) { if (c.sh <= 0 && c.g < 5 && c.r >= 0.93) { c.g++; c.sh = cfg.shiftT; } stepCar(c, 1 / 120); } return c.fin || 99; }
  function calib(et) { var lo = 0.4, hi = 5; for (var i = 0; i < 22; i++) { var m = (lo + hi) / 2; if (simET({ power: m, grip: 0.9 + m * 0.22, shiftT: 0.28 }) > et) lo = m; else hi = m; } return { power: hi, grip: 0.9 + hi * 0.22, shiftT: 0.28, nos: 0 }; }
  RIV.forEach(function (r) { r.cfg = calib(r.et); });

  // ---------- 車庫 ----------
  function save() { K.save('scdrag_save', SV); }
  function cost(u) { return Math.round(u.base * Math.pow(1.5, SV.up[u.k])); }
  function garage() {
    var rv = RIV[SV.rival], h = '<div class="gar" style="display:contents"><h3>' + L('車庫', 'Garage') + '　💰 ' + FX.money(SV.cash) + '</h3>';
    h += '<div class="rv"><button id="rvP" ' + (SV.rival ? '' : 'disabled') + '>◀</button><div><small>' + L('對手 ', 'Rival ') + (SV.rival + 1) + '/8' + (SV.rival < SV.max ? ' ✅' : '') + '</small><b>' + L(rv.n[0], rv.n[1]) + '</b><small>' + L('實力約 ', 'About ') + rv.et.toFixed(1) + L(' 秒・獎金 ', 's · prize ') + FX.money(prize(SV.rival)) + '</small></div><button id="rvN" ' + (SV.rival < Math.min(7, SV.max) ? '' : 'disabled') + '>▶</button></div><div class="ups">';
    UPS.forEach(function (u) { var lv = SV.up[u.k], c = cost(u); h += '<button class="up" data-u="' + u.k + '" ' + (lv >= 5 || SV.cash < c ? 'disabled' : '') + '><b>' + L(u.n[0], u.n[1]) + ' Lv.' + lv + '</b>' + L(u.d[0], u.d[1]) + '<i><u style="width:' + lv * 20 + '%"></u></i>' + (lv >= 5 ? 'MAX' : '<span>' + FX.money(c) + '</span>') + '</button>'; });
    h += '</div><p style="font-size:12.5px">' + L('預估你的車：', 'Your car, estimated: ') + '<b style="color:#fde68a">' + simET(cfgMe()).toFixed(2) + L(' 秒', 's') + '</b>' + L('（完美操作會更快）', ' (faster with perfect timing)') + '</p><button class="btn big2" id="bStart">' + L('開始比賽', 'Race!') + '</button></div>';
    var c = $('cover'); c.innerHTML = h; c.classList.remove('off');
    $('bStart').onclick = stage; $('rvP').onclick = function () { SV.rival--; save(); garage(); }; $('rvN').onclick = function () { SV.rival++; save(); garage(); };
    [].forEach.call(c.querySelectorAll('.up'), function (b) { b.onclick = function () { var u = UPS.filter(function (x) { return x.k === b.dataset.u; })[0], cc = cost(u); if (SV.cash < cc || SV.up[u.k] >= 5) return; SV.cash -= cc; SV.up[u.k]++; save(); FX.sfx.cash(); garage(); }; });
    hud();
  }
  function prize(i) { return 400 + i * 400; }
  function hud() { $('cash').textContent = FX.money(SV.cash); $('rival').textContent = (SV.rival + 1) + '/8'; $('bestEt').textContent = SV.best ? SV.best.toFixed(2) + 's' : '—'; }

  // ---------- 比賽流程 ----------
  function stage() {
    $('cover').classList.add('off'); K.close('ovEnd'); parts.clear(); floats.clear();
    S = { ph: 'stage', t: 0, lights: 0, greenAt: 1.4 + Math.random() * 1.6, rev: 0.15, me: newCar(cfgMe()), op: newCar(RIV[SV.rival].cfg), rt: 0, opRt: 0.2 + Math.random() * 0.22 * (1 - SV.rival * 0.06), foul: false, started: true, over: false, wheel: 0, opWheel: 0, msg: L('按住油門，把轉速停在綠色區', 'Hold Gas — keep the revs in the green'), msgT: 99, top: 0, endT: 0, shiftFx: 0, shiftTxt: '' };
    S.op.q = 'good'; pad();
  }
  function launch() {
    if (!S || S.ph !== 'stage') return;
    if (S.lights < 4) { S.foul = true; S.ph = 'done'; S.msg = L('偷跑！紅燈', 'Foul start! Red light'); S.msgT = 9; FX.sfx.bad(); shake.kick(8); return setTimeout(result, 1400); }
    S.rt = S.t - S.greenAt; var r = S.rev, q = r >= 0.55 && r <= 0.68 ? 'perfect' : r > 0.78 ? 'spin' : r < 0.45 ? 'bog' : 'good';
    S.me.q = q; S.ph = 'race'; S.me.t = 0;
    note({ perfect: L('完美起跑！', 'PERFECT LAUNCH!'), good: L('起跑不錯', 'Good launch'), spin: L('轉速太高，輪胎空轉！', 'Too many revs — wheelspin!'), bog: L('轉速太低，起步無力', 'Too few revs — bogged down') }[q], q === 'perfect' ? '#4ade80' : q === 'good' ? '#fff' : '#f87171');
    if (q === 'perfect') FX.sfx.great(); else K.beep(300, 0.1, 'square', 0.05);
    pad();
  }
  function note(t, c) { S.shiftTxt = t; S.shiftCol = c; S.shiftFx = 1.3; }
  function shift() {
    var c = S.me; if (S.ph !== 'race' || c.sh > 0 || c.g >= 5 || c.fin) return;
    var r = c.v * RATIO[c.g] / VR0, q = r >= 0.9 && r <= 0.975 ? 'perfect' : (r >= 0.82 && r < 0.9) || r > 0.975 ? 'good' : 'early';
    c.g++; c.sh = c.cfg.shiftT * (q === 'perfect' ? 0.5 : q === 'early' ? 1.5 : 1); if (q === 'perfect') c.boost = 0.7;
    note(q === 'perfect' ? L('完美換檔！', 'PERFECT SHIFT!') : q === 'good' ? L('換檔', 'Shift') : L('太早換檔', 'Too early'), q === 'perfect' ? '#4ade80' : q === 'good' ? '#fff' : '#fbbf24');
    K.beep(q === 'perfect' ? 900 : 500, 0.07, 'square', 0.05, q === 'perfect' ? 1400 : 300);
    parts.burst(PX - 70, 214, q === 'perfect' ? 12 : 5, { c: ['#fde047', '#fb923c'], sp: 160, life: 0.3, g: 0, size: 6, round: 1, ang: Math.PI, spread: 0.3 });
  }
  function nitro() { var c = S.me; if (S.ph !== 'race' || c.nosUsed || c.fin) return; c.nosUsed = true; c.nosT = c.cfg.nos; note(L('氮氣！', 'NITRO!'), '#38bdf8'); K.beep(200, 0.6, 'sawtooth', 0.07, 900); shake.kick(6); pad(); }
  function step(dt) {
    parts.step(dt); floats.step(dt); shake.step(dt);
    if (!S || S.ph === 'garage') { eng.set(50, 0); tyre.set(0); return; }
    S.t += dt; S.msgT -= dt; S.shiftFx -= dt;
    var me = S.me, op = S.op;
    if (S.ph === 'stage') {
      S.rev = FX.clamp(S.rev + (FX.keys.up ? 1.5 : -1.1) * dt, 0.12, 1); if (S.rev >= 1) S.rev = 0.95 + Math.random() * 0.05;
      var lt = S.t - (S.greenAt - 1.2); S.lights = lt < 0 ? 0 : lt < 0.4 ? 1 : lt < 0.8 ? 2 : lt < 1.2 ? 3 : 4;
      if (S.lights !== S._l) { S._l = S.lights; if (S.lights && S.lights < 4) K.beep(520, 0.12, 'square', 0.05); else if (S.lights === 4) { K.beep(1040, 0.4, 'square', 0.06); S.msg = L('綠燈！按起跑', 'GREEN! Launch!'); S.msgT = 2; if (window.SCLB) SCLB.start(GAME, 'quarter'); if (window.SC) SC.post('start', { game: GAME }); } }
      if (S.t - S.greenAt > 4) { S.rt = 4; S.me.q = 'bog'; S.ph = 'race'; me.t = 0; pad(); }
      eng.set(60 + S.rev * 260, 0.03); tyre.set(0);
    }
    if (!op._go && !S.foul && S.t - S.greenAt > S.opRt) op._go = true;
    if (op._go && !op.fin) { if (op.sh <= 0 && op.g < 5 && op.r >= 0.925 + SV.rival * 0.004) { op.g++; op.sh = op.cfg.shiftT; } for (var i = 0; i < 2; i++) stepCar(op, dt / 2); if (op.fin) op.total = S.opRt + op.fin; }
    if (S.ph === 'race') {
      for (i = 0; i < 2; i++) stepCar(me, dt / 2);
      S.top = Math.max(S.top, me.v);
      if (me.spin > 0.3 && me.t < 2) { tyre.set(0.05, 1800); if (Math.random() < 0.8) parts.burst(PX - 52, 232, 1, { c: 'rgba(235,235,240,.55)', sp: 70, life: 0.8, g: -40, size: 9, round: 1, grow: 36, ang: Math.PI, spread: 0.6 }); } else tyre.set(Math.min(0.02, me.v / 4000), 700);
      if (me.nosT > 0 && Math.random() < 0.9) parts.burst(PX - 74, 216, 1, { c: ['#38bdf8', '#a5f3fc', '#fff'], sp: 220, life: 0.25, g: 0, size: 7, round: 1, ang: Math.PI, spread: 0.2 });
      if (me.lim && Math.random() < 0.2) { note(L('換檔！', 'SHIFT!'), '#f87171'); }
      eng.set(70 + me.r * 300, 0.034);
      if (me.fin) { S.ph = 'done'; S.endT = 0; me.total = S.rt + me.fin; FX.sfx.great(); }
    }
    if (S.ph === 'done' && !S.foul) { S.endT += dt; me.v = Math.max(0, me.v - 14 * dt); me.d += me.v * dt; eng.set(70 + Math.min(1, me.v / 60) * 120, 0.02); tyre.set(0); if (!S.over && (op.fin || S.endT > 2.5) && S.endT > 1.3) result(); }
    S.wheel += me.v * dt / 0.33 + (S.ph === 'race' && me.spin > 0.3 ? 30 * dt : 0); S.opWheel += op.v * dt / 0.33;
  }
  function result() {
    if (S.over) return; S.over = true; eng.stop(); tyre.stop();
    var me = S.me, op = S.op, win = !S.foul && (!op.fin || me.total <= op.total), et = S.foul ? 0 : me.total;
    var first = win && SV.rival >= SV.max, gain = S.foul ? 0 : win ? prize(SV.rival) * (first ? 1 : 0.5) : 80; gain = Math.round(gain); SV.cash += gain;
    if (first) SV.max = Math.min(8, SV.rival + 1);
    var nb = !S.foul && (!SV.best || et < SV.best); if (nb) SV.best = Math.round(et * 1000) / 1000;
    $('endEmoji').textContent = S.foul ? '🚨' : win ? '🏆' : '😤'; $('endTitle').textContent = S.foul ? L('偷跑犯規', 'Foul start') : win ? L('你贏了！', 'You win!') : L('輸給', 'Lost to ') + L(RIV[SV.rival].n[0], RIV[SV.rival].n[1]);
    $('endEt').textContent = S.foul ? '—' : et.toFixed(3) + 's'; $('endRt').textContent = S.foul ? '—' : S.rt.toFixed(3) + 's'; $('endSpd').textContent = Math.round(S.top * 3.6) + ' km/h';
    $('endBest').textContent = (gain ? L('獎金 ', 'Prize ') + FX.money(gain) + '　' : '') + (nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : SV.best ? L('個人最佳：', 'Personal best: ') + SV.best.toFixed(3) + 's' : '') + (op.fin && !S.foul ? '　' + L('對手 ', 'Rival ') + op.total.toFixed(3) + 's' : '');
    if (first && SV.rival < 7) SV.rival++;
    save(); hud(); if (gain) FX.sfx.cash();
    if (window.SC) SC.post('gameover', { game: GAME, win: win });
    var sec = !S.foul && window.SCLB ? (SCLB.elapsed(GAME) || et) : et;
    K.open('ovEnd'); S.ph = 'garage'; garage(); pad();
    if (!S.foul && window.SCLB) SCLB.offer({ game: GAME, mode: 'quarter', score: sec, text: L('尾速 ', 'Trap ') + Math.round(S.top * 3.6) + ' km/h' });
  }

  // ---------- 繪圖 ----------
  function sideCar(x, y, col, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y + (o.squat || 0));
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 18, 82, 7, 0, 0, 7); ctx.fill();
    ctx.rotate(-(o.pitch || 0));
    var g = ctx.createLinearGradient(0, -34, 0, 14); g.addColorStop(0, FX.shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, FX.shade(col, -0.5)); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-80, 8); ctx.lineTo(-79, -8); ctx.lineTo(-64, -12); ctx.quadraticCurveTo(-40, -34, -6, -34); ctx.quadraticCurveTo(18, -33, 36, -14); ctx.lineTo(72, -8); ctx.quadraticCurveTo(82, -4, 80, 8); ctx.lineTo(60, 10); ctx.arc(46, 10, 17, 0, Math.PI, true); ctx.lineTo(-30, 10); ctx.arc(-47, 10, 17, 0, Math.PI, true); ctx.closePath(); ctx.fill();
    var wg = ctx.createLinearGradient(0, -32, 0, -12); wg.addColorStop(0, '#0b1626'); wg.addColorStop(1, '#3d5f8a'); ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(-52, -13); ctx.quadraticCurveTo(-36, -30, -8, -30); ctx.lineTo(-8, -13); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3, -30); ctx.quadraticCurveTo(14, -29, 30, -13); ctx.lineTo(-3, -13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-60, -6, 120, 2.5);
    ctx.fillStyle = '#fff7c2'; ctx.beginPath(); ctx.ellipse(74, -3, 5, 3, 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.fillRect(-80, -6, 4, 7);
    if (o.wing) { ctx.fillStyle = '#111827'; ctx.fillRect(-82, -24, 22, 4); ctx.fillRect(-74, -22, 3, 12); }
    ctx.rotate(o.pitch || 0);
    [-47, 46].forEach(function (wx) { ctx.save(); ctx.translate(wx, 10); ctx.fillStyle = '#0b0c10'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#c7ccd6'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.rotate(rot); ctx.strokeStyle = '#3b4252'; ctx.lineWidth = 2.5; for (var i = 0; i < 5; i++) { ctx.rotate(1.2566); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, 0); ctx.stroke(); } ctx.restore(); });
    ctx.restore();
  }
  var BLD = []; for (var bi = 0; bi < 40; bi++) BLD.push([bi * 46 + Math.random() * 20, 40 + Math.random() * 90, 30 + Math.random() * 24]);
  function scene(time) {
    var me = S ? S.me : null, d = me ? me.d : 0, camx = d * PXM, v = me ? me.v : 0, i, x;
    var g = ctx.createLinearGradient(0, 0, 0, SCN); g.addColorStop(0, '#0d1030'); g.addColorStop(0.55, '#5b2a6e'); g.addColorStop(1, '#f97316'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, SCN);
    ctx.fillStyle = '#14122e'; for (i = 0; i < BLD.length; i++) { x = ((BLD[i][0] - camx * 0.05) % 1840 + 1840) % 1840 - 60; ctx.fillRect(x, 150 - BLD[i][1], BLD[i][2], BLD[i][1]); }
    ctx.fillStyle = 'rgba(253,224,71,.5)'; for (i = 0; i < BLD.length; i++) { x = ((BLD[i][0] - camx * 0.05) % 1840 + 1840) % 1840 - 60; for (var wy = 150 - BLD[i][1] + 8; wy < 142; wy += 14) if ((i * 7 + wy) % 3) ctx.fillRect(x + 6, wy, 4, 5), ctx.fillRect(x + 18, wy, 4, 5); }
    // 看台與圍牆
    var gx = -((camx * 0.4) % 120); ctx.fillStyle = '#1f2440'; ctx.fillRect(0, 118, W, 46);
    for (x = gx; x < W; x += 120) { ctx.fillStyle = '#2a3058'; ctx.fillRect(x, 112, 110, 50); for (i = 0; i < 26; i++) { ctx.fillStyle = ['#f87171', '#fbbf24', '#60a5fa', '#e5e7eb', '#4ade80'][(i * 3 + Math.floor((x - gx) / 120)) % 5]; ctx.beginPath(); ctx.arc(x + 8 + (i % 13) * 8, 124 + Math.floor(i / 13) * 14 + Math.sin(time * 6 + i) * 1.5, 3, 0, 7); ctx.fill(); } }
    var wx0 = -((camx * 0.75) % 160); for (x = wx0; x < W; x += 160) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x, 162, 160, 20); ctx.fillStyle = (Math.floor((camx * 0.75 + x - wx0) / 160) % 2) ? '#dc2626' : '#1d4ed8'; ctx.fillRect(x + 4, 165, 152, 14); FX.text(ctx, 'STOCKCORP', x + 80, 172, 10, '#fff'); }
    // 賽道
    ctx.fillStyle = '#2b2e38'; ctx.fillRect(0, 182, W, SCN - 182); ctx.fillStyle = '#383c48'; ctx.fillRect(0, 182, W, 4);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; var dx0 = -(camx % 80); for (x = dx0; x < W; x += 80) ctx.fillRect(x, 250, 40, 4);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 312, W, 3);
    // 距離牌、起跑線、終點
    for (i = 0; i <= 4; i++) { x = PX + 70 + (i * 100 * (DIST / 400) - d) * PXM; if (x > -60 && x < W + 60) { if (i === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x, 186, 5, 126); } else if (i === 4) { for (var r = 0; r < 12; r++) for (var c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff'; ctx.fillRect(x + c * 10, 186 + r * 10.5, 10, 10.5); } ctx.fillStyle = '#facc15'; ctx.fillRect(x - 4, 96, 8, 90); FX.text(ctx, 'FINISH', x + 10, 86, 16, '#facc15', 'center', '#000'); } else FX.text(ctx, i * 100 + 'm', x, 200, 13, 'rgba(255,255,255,.6)'); } }
    return camx;
  }
  function tree(x) {
    ctx.fillStyle = '#111827'; FX.rr(ctx, x - 14, 60, 28, 112, 6); ctx.fill(); ctx.fillRect(x - 2, 172, 4, 12);
    var L4 = S ? S.lights : 0, foul = S && S.foul;
    for (var i = 0; i < 3; i++) { ctx.fillStyle = L4 > i && L4 < 4 ? '#facc15' : '#3a3520'; if (L4 > i && L4 < 4) { ctx.shadowColor = '#facc15'; ctx.shadowBlur = 14; } ctx.beginPath(); ctx.arc(x, 76 + i * 24, 8, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    ctx.fillStyle = foul ? '#ef4444' : L4 === 4 ? '#22c55e' : '#16321f'; if (L4 === 4 || foul) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18; } ctx.beginPath(); ctx.arc(x, 152, 9, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
  function gauge(time) {
    var cx = W / 2, cy = SCN + 150, R = 112, me = S ? S.me : null, staging = S && S.ph === 'stage', r = !S ? 0.15 : staging ? S.rev : me.r, a0 = Math.PI * 0.8, sw = Math.PI * 1.4;
    var bg = ctx.createLinearGradient(0, SCN, 0, H); bg.addColorStop(0, '#12141d'); bg.addColorStop(1, '#07080c'); ctx.fillStyle = bg; ctx.fillRect(0, SCN, W, H - SCN);
    ctx.fillStyle = '#0c0e15'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a2f42'; ctx.lineWidth = 3; ctx.stroke();
    function arc(f, t, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(cx, cy, R - 6, a0 + sw * f, a0 + sw * t); ctx.stroke(); }
    arc(0, 1, '#1e2233', 14);
    if (staging) { arc(0.45, 0.55, 'rgba(250,204,21,.55)', 14); arc(0.55, 0.68, '#22c55e', 14); arc(0.68, 0.78, 'rgba(250,204,21,.55)', 14); arc(0.78, 1, 'rgba(239,68,68,.75)', 14); }
    else { arc(0.82, 0.9, 'rgba(250,204,21,.55)', 14); arc(0.9, 0.975, '#22c55e', 14); arc(0.975, 1, '#ef4444', 14); }
    for (var i = 0; i <= 10; i++) { var a = a0 + sw * i / 10; ctx.strokeStyle = '#9aa3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22)); ctx.lineTo(cx + Math.cos(a) * (R - 32), cy + Math.sin(a) * (R - 32)); ctx.stroke(); FX.text(ctx, i + '', cx + Math.cos(a) * (R - 46), cy + Math.sin(a) * (R - 46), 13, '#9aa3b8'); }
    var na = a0 + sw * FX.clamp(r, 0, 1); ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(cx - Math.cos(na) * 16, cy - Math.sin(na) * 16); ctx.lineTo(cx + Math.cos(na) * (R - 16), cy + Math.sin(na) * (R - 16)); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#1b1e2b'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 7); ctx.fill();
    FX.text(ctx, staging || !S || S.ph === 'garage' ? 'N' : (me.g + 1) + '', cx, cy + 1, 34, me && me.sh > 0 ? '#facc15' : '#fff');
    FX.text(ctx, Math.round((me ? me.v : 0) * 3.6) + '', cx, cy + 62, 30, '#fff'); FX.text(ctx, 'km/h', cx, cy + 84, 11, '#8b93a7');
    // 換檔燈
    var n = staging ? 0 : r < 0.7 ? 0 : Math.min(5, Math.floor((r - 0.7) / 0.04) + 1), flash = !staging && r >= 0.9 && r <= 0.975;
    for (i = 0; i < 5; i++) { ctx.fillStyle = flash ? (Math.floor(time * 16) % 2 ? '#60a5fa' : '#dbeafe') : i < n ? ['#22c55e', '#22c55e', '#facc15', '#facc15', '#ef4444'][i] : '#232737'; ctx.beginPath(); ctx.arc(cx - 64 + i * 32, SCN + 20, 9, 0, 7); ctx.fill(); }
    // 氮氣與進度
    if (me) { ctx.fillStyle = '#1e2233'; FX.rr(ctx, 20, SCN + 60, 14, 150, 7); ctx.fill(); var nf = me.nosUsed ? Math.max(0, me.nosT / me.cfg.nos) : 1; ctx.fillStyle = '#38bdf8'; FX.rr(ctx, 20, SCN + 60 + 150 * (1 - nf), 14, 150 * nf, 7); ctx.fill(); FX.text(ctx, '🔥', 27, SCN + 226, 16);
      ctx.fillStyle = '#1e2233'; FX.rr(ctx, W - 34, SCN + 60, 14, 150, 7); ctx.fill(); var pf = Math.min(1, me.d / DIST), of = Math.min(1, S.op.d / DIST); ctx.fillStyle = RIV[SV.rival].c === '#111827' ? '#9ca3af' : RIV[SV.rival].c; ctx.beginPath(); ctx.arc(W - 27, SCN + 210 - 150 * of, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(W - 27, SCN + 210 - 150 * pf, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); FX.text(ctx, '🏁', W - 27, SCN + 46, 14); }
  }
  function draw(time) {
    ctx.save(); shake.apply(ctx);
    scene(time);
    if (S && S.ph !== 'garage') {
      var me = S.me, op = S.op, ox = PX + (op.d - me.d) * PXM, tx = PX + 70 - me.d * PXM + 40;
      if (tx > -40 && tx < W + 40) tree(tx);
      if (ox > -120 && ox < W + 120) sideCar(ox, 216, RIV[SV.rival].c, S.opWheel, { wing: SV.rival >= 4, pitch: Math.min(0.05, op.v < 30 && op._go ? 0.04 : 0) });
      else { var gap = (op.d - me.d); FX.text(ctx, (gap > 0 ? '▶ +' : '◀ ') + Math.abs(gap).toFixed(0) + 'm', gap > 0 ? W - 50 : 50, 204, 15, '#fff', 'center', 'rgba(0,0,0,.6)'); }
      FX.text(ctx, L(RIV[SV.rival].n[0], RIV[SV.rival].n[1]), FX.clamp(ox, 60, W - 60), 176 - 4, 11, '#e5e7eb', 'center', 'rgba(0,0,0,.6)');
      parts.draw(ctx);
      sideCar(PX, 286, '#e11d48', S.wheel, { wing: SV.up.eng >= 3, pitch: S.ph === 'race' && me.t < 1.5 && me.sh <= 0 ? 0.045 : me.sh > 0 ? -0.02 : 0, squat: S.ph === 'stage' ? Math.sin(time * 40) * S.rev * 1.2 : 0 });
      if (me.v > 40) { ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.35, me.v / 260) + ')'; ctx.lineWidth = 2; for (var i = 0; i < 8; i++) { var ly = 190 + Math.random() * 118, lx = Math.random() * W; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 40 - me.v, ly); ctx.stroke(); } }
      if (S.msgT > 0 && S.ph !== 'race') FX.text(ctx, S.msg, W / 2, 30, 18, '#fff', 'center', 'rgba(0,0,0,.7)');
      if (S.shiftFx > 0) { ctx.globalAlpha = Math.min(1, S.shiftFx * 2); FX.text(ctx, S.shiftTxt, W / 2, 60, 26 + Math.max(0, S.shiftFx - 1.1) * 60, S.shiftCol, 'center', 'rgba(0,0,0,.7)'); ctx.globalAlpha = 1; }
      if (S.ph === 'race' || S.ph === 'done') FX.text(ctx, (S.me.fin ? S.me.total : S.rt + me.t).toFixed(2) + 's', W / 2, 108, 22, '#fde047', 'center', 'rgba(0,0,0,.7)');
    } else { sideCar(PX + 100, 286, '#e11d48', 0, { wing: SV.up.eng >= 3 }); }
    floats.draw(ctx);
    ctx.restore();
    gauge(time);
  }
  function pad() {
    var st = S && S.ph === 'stage', rc = S && S.ph === 'race';
    FX.pad($('touch'), [{ k: 'up', t: L('油門', 'GAS'), cls: 'wide' + (st ? ' go' : '') }, { k: 'a', t: st ? L('起跑', 'LAUNCH') : L('換檔', 'SHIFT'), cls: 'wide' + (rc ? ' go' : '') }, { k: 'b', t: '🔥', cls: '' }]);
  }
  FX.onKey = function (k, down) { if (!down || !S) return; if (k === 'a') { if (S.ph === 'stage') launch(); else shift(); } else if (k === 'b') nitro(); };
  $('bAgain').onclick = function () { K.close('ovEnd'); };
  FX.sound(function () { if (K.muted) { eng.stop(); tyre.stop(); } });
  if (window.SC) SC.onLang(function () { if (!S || S.ph === 'garage') garage(); pad(); });
  S = null; garage(); pad(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__dg = { S: function () { return S; }, SV: SV, simET: simET, cfgMe: cfgMe, RIV: RIV, stage: stage, launch: launch, shift: shift, nitro: nitro, garage: garage };
})();
