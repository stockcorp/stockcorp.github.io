/* 太空隧道 — stockcorp.github.io/tunnel/
   3D 霓虹隧道：12 面管壁，一圈一圈的環往鏡頭飛來；鏡頭跟著飛船旋轉（飛船永遠在畫面下方）。
   牆板依「時間間隔」產生，缺口位移保證轉得過去；能量球 5 顆換一層護盾。
   排行榜：mode = classic，比分數（距離 + 能量球 + 擦邊）。 */
(function () {
  'use strict';
  var GAME = 'tunnel', $ = K.$, L = K.L, W = 480, H = 620, N = 12, D = 120, VIS = 36, PZ = 150, F = 262, RAD = 150, STEP = Math.PI * 2 / N, ROT = 3.3;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), S = null, parts = FX.Parts(220), floats = FX.Floats(), shake = FX.Shake(), eng = FX.Engine('sawtooth');
  var stars = []; for (var i = 0; i < 70; i++) stars.push({ a: Math.random() * 6.283, r: Math.random(), s: 0.5 + Math.random() * 1.5 });
  var CX = W / 2, CY = 285;

  function reset() {
    S = { z: 0, a: 0, va: 0, sp: 950, run: false, over: false, score: 0, orbs: 0, charge: 0, shield: 0, near: 0, t: 0, obs: {}, orbL: [], nextK: 14, gap: 0, dead: 0, flash: 0, tilt: 0, pat: null };
    parts.clear(); floats.clear(); $('best').textContent = FX.fmt(K.load('sctunnel_best', 0)); hud();
  }
  function hud() { $('score').textContent = FX.fmt(Math.floor(S.score)); $('spd').textContent = 'x' + (S.sp / 950).toFixed(1); }
  function start() { reset(); $('cover').classList.add('off'); K.close('ovEnd'); FX.countdown($('big'), function () { S.run = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }); }
  // 產生牆板：缺口（寬 gw 面）從上一個缺口位移不超過「這段時間轉得到」的量
  function gen() {
    var horizon = Math.floor(S.z / D) + VIS + 4;
    while (S.nextK < horizon) {
      var prog = Math.min(1, S.t / 110), tg = FX.lerp(0.78, 0.4, prog), maxShift = Math.max(1, Math.floor(ROT * tg * 0.72 / STEP));
      if (S.pat && S.pat.n > 0) { S.pat.n--; S.gap = (S.gap + S.pat.d + N) % N; put(S.nextK, S.gap, S.pat.w); S.nextK += S.pat.gapK; continue; }
      var r = Math.random(), gapK = Math.max(3, Math.round(S.sp * tg / D));
      if (r < 0.2 && S.t > 8) { S.pat = { n: 4 + Math.floor(Math.random() * 4), d: Math.random() < 0.5 ? 1 : -1, w: 3, gapK: Math.max(2, Math.round(S.sp * 0.3 / D)) }; continue; }
      var shift = Math.floor(Math.random() * (maxShift * 2 + 1)) - maxShift, gw = prog < 0.3 ? 4 : prog < 0.7 ? 3 : (Math.random() < 0.5 ? 3 : 2);
      S.gap = (S.gap + shift + N) % N; put(S.nextK, S.gap, gw, r > 0.75);
      if (Math.random() < 0.75) S.orbL.push({ k: S.nextK - Math.floor(gapK / 2), a: (S.gap + gw / 2 + (Math.random() - 0.5) * 2) * STEP, got: false });
      S.nextK += gapK;
    }
  }
  function put(k, gap, gw, twin) {
    var mask = 0; for (var i = 0; i < N; i++) { var d = (i - gap + N) % N; if (d >= gw) mask |= 1 << i; }
    if (twin) { var g2 = (gap + 6) % N; for (var j = 0; j < 2; j++) mask &= ~(1 << ((g2 + j) % N)); }
    S.obs[k] = { mask: mask, done: false };
  }
  function cxz(z) { return Math.sin(z * 0.0009) * 520 + Math.sin(z * 0.0023 + 1) * 210; }
  function cyz(z) { return Math.cos(z * 0.0007) * 330 + Math.sin(z * 0.0019) * 150; }
  function step(dt) {
    parts.step(dt); floats.step(dt); shake.step(dt); if (S.flash > 0) S.flash -= dt;
    if (S.dead > 0) { S.dead -= dt; if (S.dead <= 0) end(); eng.set(60, 0); return; }
    if (!S.run) { eng.set(60, 0); return; }
    S.t += dt; S.sp = Math.min(2700, 950 + S.t * 15.5);
    var k = FX.keys, st = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    S.va += (st * ROT - S.va) * Math.min(1, dt * 14); S.a += S.va * dt; S.tilt += (st - S.tilt) * Math.min(1, dt * 9);
    var z0 = S.z + PZ; S.z += S.sp * dt; var z1 = S.z + PZ; S.score += S.sp * dt / 12;
    gen();
    var pa = (((S.a % 6.2832) + 6.2832) % 6.2832) / STEP;
    for (var kk = Math.ceil(z0 / D); kk * D <= z1; kk++) {
      var o = S.obs[kk]; if (!o || o.done) continue; o.done = true;
      var i1 = Math.floor(pa - 0.2 + N) % N, i2 = Math.floor(pa + 0.2) % N, hit = (o.mask >> i1 & 1) || (o.mask >> i2 & 1);
      if (hit) { if (S.shield > 0) { S.shield--; S.flash = 0.35; shake.kick(14); FX.sfx.crash(); floats.add(CX, 470, L('護盾擋下！', 'Shield!'), '#7dd3fc', 22); parts.burst(CX, 520, 26, { c: '#7dd3fc', sp: 260, life: 0.6, size: 4, g: 0 }); } else { die(); return; } }
      else { var n1 = Math.floor(pa - 0.62 + N) % N, n2 = Math.floor(pa + 0.62) % N; if ((o.mask >> n1 & 1) || (o.mask >> n2 & 1)) { S.near++; S.score += 25; floats.add(CX + (Math.random() - 0.5) * 60, 480, L('擦邊 +25', 'Close +25'), '#fde047', 15); K.beep(1300, 0.05, 'triangle', 0.03); } }
    }
    for (var j = S.orbL.length - 1; j >= 0; j--) {
      var ob = S.orbL[j], oz = ob.k * D;
      if (oz < S.z - 50) { S.orbL.splice(j, 1); continue; }
      if (!ob.got && oz > z0 - 30 && oz <= z1 + 30) { var da = Math.atan2(Math.sin(ob.a - S.a), Math.cos(ob.a - S.a)); if (Math.abs(da) < 0.36) { ob.got = true; S.orbs++; S.score += 50; S.charge++; FX.sfx.coin(); parts.burst(CX, 515, 12, { c: '#38bdf8', sp: 200, life: 0.45, size: 4, g: 0, round: 1 }); if (S.charge >= 5) { S.charge = 0; if (S.shield < 2) { S.shield++; floats.add(CX, 450, L('護盾 +1', 'Shield +1'), '#7dd3fc', 20); FX.sfx.great(); } else { S.score += 200; floats.add(CX, 450, '+200', '#fde047', 20); } } else floats.add(CX, 470, '+50', '#7dd3fc', 16); } }
    }
    for (var key in S.obs) if (key * D < S.z - 300) delete S.obs[key];
    if (Math.random() < 0.5) parts.add({ x: CX + (Math.random() - 0.5) * 16 - S.tilt * 8, y: 548, vx: (Math.random() - 0.5) * 40 - S.tilt * 60, vy: 220 + Math.random() * 120, life: 0.3, c: Math.random() < 0.5 ? '#f0abfc' : '#67e8f9', size: 3, g: 0 });
    eng.set(70 + S.sp / 16, K.muted ? 0 : 0.018); hud();
  }
  function die() { S.run = false; S.over = true; S.dead = 1.3; FX.sfx.crash(); shake.kick(26); S.flash = 0.5; parts.burst(CX, 520, 70, { c: ['#f87171', '#fbbf24', '#fff', '#c084fc'], sp: 420, life: 1.1, size: 5, g: 120 }); }
  function end() {
    var sc = Math.floor(S.score), b = FX.best('sctunnel_best', sc); eng.stop();
    $('endScore').textContent = FX.fmt(sc); $('endDist').textContent = FX.fmt(Math.round(S.z / 100)) + ' m'; $('endOrb').textContent = S.orbs;
    $('endBest').textContent = b.isNew ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.fmt(b.best);
    $('best').textContent = FX.fmt(b.best); K.open('ovEnd'); $('cover').classList.remove('off');
    if (window.SC) SC.post('gameover', { game: GAME, score: sc });
    if (window.SCLB && sc > 0) SCLB.offer({ game: GAME, mode: 'classic', score: sc, text: FX.fmt(Math.round(S.z / 100)) + ' m' });
  }
  // ---------- 繪圖 ----------
  function ring(k) { // 回傳這一圈 12 個頂點的螢幕座標
    var rel = k * D - S.z; if (rel < 28) rel = 28; var sc = F / rel, ox = (cxz(k * D) - cxz(S.z + PZ)) * sc * 0.55, oy = (cyz(k * D) - cyz(S.z + PZ)) * sc * 0.55, r = RAD * sc, p = [];
    for (var i = 0; i <= N; i++) { var a = i * STEP - S.a + Math.PI / 2; p.push(CX + ox + Math.cos(a) * r, CY + oy + Math.sin(a) * r); }
    p.sc = sc; p.ox = CX + ox; p.oy = CY + oy; p.r = r; return p;
  }
  function draw(time) {
    ctx.save(); shake.apply(ctx);
    var bg = ctx.createRadialGradient(CX, CY, 10, CX, CY, 420); bg.addColorStop(0, '#1b1147'); bg.addColorStop(1, '#05030f'); ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);
    var k0 = Math.floor(S.z / D), prev = ring(k0 + VIS + 1), k, i;
    ctx.fillStyle = '#fff'; stars.forEach(function (s) { var a = s.a - S.a * 0.3, rr = 6 + s.r * 60; ctx.globalAlpha = 0.5 + s.r * 0.5; ctx.fillRect(prev.ox + Math.cos(a) * rr, prev.oy + Math.sin(a) * rr, s.s, s.s); }); ctx.globalAlpha = 1;
    for (k = k0 + VIS; k >= k0; k--) {
      var cur = ring(k), fog = Math.max(0, 1 - (k - k0) / VIS), hue = 250 + Math.sin(k * 0.055) * 62;
      for (i = 0; i < N; i++) {
        var lit = (k + i) % 2 ? 7 : 12; if (k % 6 === 0) lit += 12;
        ctx.fillStyle = 'hsl(' + hue + ',70%,' + (lit * fog + 1.5) + '%)';
        ctx.beginPath(); ctx.moveTo(cur[i * 2], cur[i * 2 + 1]); ctx.lineTo(cur[i * 2 + 2], cur[i * 2 + 3]); ctx.lineTo(prev[i * 2 + 2], prev[i * 2 + 3]); ctx.lineTo(prev[i * 2], prev[i * 2 + 1]); ctx.fill();
      }
      ctx.strokeStyle = 'hsla(' + hue + ',100%,70%,' + (fog * 0.3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); for (i = 0; i < N; i++) { ctx.moveTo(cur[i * 2], cur[i * 2 + 1]); ctx.lineTo(prev[i * 2], prev[i * 2 + 1]); } ctx.stroke();
      if (k % 2 === 0) { ctx.strokeStyle = 'hsla(' + hue + ',100%,68%,' + (fog * 0.85) + ')'; ctx.lineWidth = Math.max(0.6, cur.sc * 2.2); ctx.beginPath(); for (i = 0; i <= N; i++) { if (i) ctx.lineTo(cur[i * 2], cur[i * 2 + 1]); else ctx.moveTo(cur[0], cur[1]); } ctx.stroke(); }
      var o = S.obs[k];
      if (o && k * D - S.z > 30) {
        var pulse = 0.75 + Math.sin(time * 9) * 0.25;
        for (i = 0; i < N; i++) if (o.mask >> i & 1) {
          var x1 = cur[i * 2], y1 = cur[i * 2 + 1], x2 = cur[i * 2 + 2], y2 = cur[i * 2 + 3], q = 0.42;
          ctx.fillStyle = 'rgba(244,63,94,' + (0.3 + fog * 0.55) + ')'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2 + (cur.ox - x2) * q, y2 + (cur.oy - y2) * q); ctx.lineTo(x1 + (cur.ox - x1) * q, y1 + (cur.oy - y1) * q); ctx.fill();
          ctx.strokeStyle = 'rgba(254,205,211,' + fog * pulse + ')'; ctx.lineWidth = Math.max(1, cur.sc * 3); ctx.stroke();
        }
      }
      for (var j = 0; j < S.orbL.length; j++) { var ob = S.orbL[j]; if (ob.k !== k || ob.got) continue; var a = ob.a - S.a + Math.PI / 2, rr = cur.r * 0.8, ox = cur.ox + Math.cos(a) * rr, oy = cur.oy + Math.sin(a) * rr, os = Math.max(2, 15 * cur.sc); var g2 = ctx.createRadialGradient(ox, oy, 0, ox, oy, os * 2); g2.addColorStop(0, 'rgba(255,255,255,' + fog + ')'); g2.addColorStop(0.35, 'rgba(56,189,248,' + fog + ')'); g2.addColorStop(1, 'rgba(56,189,248,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(ox, oy, os * 2, 0, 7); ctx.fill(); }
      prev = cur;
    }
    // 速度線
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; for (i = 0; i < 14; i++) { var sa = i * 0.449 + S.a * -1 + Math.floor(time * 3 + i * 0.37) * 1.7, r1 = 150 + ((time * (700 + i * 40) + i * 90) % 260); ctx.beginPath(); ctx.moveTo(CX + Math.cos(sa) * r1, CY + Math.sin(sa) * r1); ctx.lineTo(CX + Math.cos(sa) * (r1 + 30 + S.sp / 60), CY + Math.sin(sa) * (r1 + 30 + S.sp / 60)); ctx.stroke(); }
    parts.draw(ctx);
    if (!S.over) ship(time);
    ctx.restore();
    if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, S.flash * 1.5) + ')'; ctx.fillRect(0, 0, W, H); }
    floats.draw(ctx);
    // 護盾與能量
    for (i = 0; i < 5; i++) { ctx.fillStyle = i < S.charge ? '#38bdf8' : 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(18 + i * 15, 20, 5, 0, 7); ctx.fill(); }
    for (i = 0; i < S.shield; i++) FX.text(ctx, '🛡️', 110 + i * 24, 21, 16);
  }
  function ship(time) {
    var x = CX, y = 520; ctx.save(); ctx.translate(x, y); ctx.rotate(S.tilt * 0.38);
    if (S.shield > 0) { ctx.strokeStyle = 'rgba(125,211,252,' + (0.5 + Math.sin(time * 6) * 0.2) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 36, 26, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, 26, 26, 6, 0, 0, 7); ctx.fill();
    var fl = 14 + Math.random() * 10; var gf = ctx.createLinearGradient(0, 8, 0, 8 + fl); gf.addColorStop(0, '#fff'); gf.addColorStop(0.4, '#67e8f9'); gf.addColorStop(1, 'rgba(192,132,252,0)'); ctx.fillStyle = gf; ctx.beginPath(); ctx.moveTo(-7, 8); ctx.lineTo(0, 8 + fl); ctx.lineTo(7, 8); ctx.fill();
    ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.moveTo(-28, 12); ctx.lineTo(-8, -2); ctx.lineTo(-8, 10); ctx.fill(); ctx.beginPath(); ctx.moveTo(28, 12); ctx.lineTo(8, -2); ctx.lineTo(8, 10); ctx.fill();
    var gb = ctx.createLinearGradient(-10, 0, 10, 0); gb.addColorStop(0, '#cbd5e1'); gb.addColorStop(0.5, '#fff'); gb.addColorStop(1, '#94a3b8'); ctx.fillStyle = gb; ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(12, -6, 9, 10); ctx.lineTo(-9, 10); ctx.quadraticCurveTo(-12, -6, 0, -26); ctx.fill();
    ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.ellipse(0, -8, 4, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f0abfc'; ctx.fillRect(-28, 10, 6, 3); ctx.fillRect(22, 10, 6, 3);
    ctx.restore();
  }
  FX.pad($('touch'), [{ k: 'left', t: '◀', cls: 'wide' }, { gap: 1 }, { k: 'right', t: '▶', cls: 'wide' }]);
  var held = {}; function rel(e) { var s = held[e.pointerId]; if (s) { FX.keys[s] = 0; delete held[e.pointerId]; } }
  cv.addEventListener('pointerdown', function (e) { if (!S.run) return; var p = ctx.pt(e), s = p.x < W / 2 ? 'left' : 'right'; held[e.pointerId] = s; FX.keys[s] = 1; e.preventDefault(); });
  cv.addEventListener('pointerup', rel); cv.addEventListener('pointercancel', rel); cv.addEventListener('pointerleave', rel);
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) { S.run = false; eng.stop(); start(); } };
  FX.sound(function () { if (K.muted) eng.stop(); });
  reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__tn = { S: function () { return S; }, go: function () { reset(); $('cover').classList.add('off'); S.run = true; }, N: N, D: D, PZ: PZ, STEP: STEP };
})();
