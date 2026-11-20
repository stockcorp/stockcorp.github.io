/* 停車大師 — stockcorp.github.io/parking/
   俯視停車，自行車模型轉向（軸距 40、最大轉向角 0.6rad）。20 關：車頭/倒車入庫、路邊停車、斜角車格、車庫、移動車流。
   過關條件：四個車角都在目標車格內、車身和車格夾角 < 12°、停穩 0.5 秒。每關最多撞 3 次。
   每關最高 1000 分（過關 400 + 每星 150 + 時間獎勵 150）。排行榜：mode = stars，比 20 關最佳成績總分。 */
(function () {
  'use strict';
  var GAME = 'parking', $ = K.$, L = K.L, W = 480, H = 620, CW = 30, CH = 62, D2R = Math.PI / 180;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), S = null, parts = FX.Parts(120), floats = FX.Floats(), shake = FX.Shake(), eng = FX.Engine('sawtooth');
  var save = K.load('scpark_v1', null) || { best: [], hits: [] }, cur = 0;
  var COL = ['#ef4444', '#f8fafc', '#22c55e', '#a855f7', '#64748b', '#f97316', '#0ea5e9', '#eab308', '#111827', '#14b8a6'];
  // ---------- 關卡 ----------
  function TX(i) { return 58 + i * 52; } function SYy(i) { return 150 + i * 52; }
  function pcar(x, y, a, i) { return { x: x, y: y, w: CW, h: CH, a: a * D2R, t: 'car', c: COL[(i * 3 + Math.round(x + y)) % COL.length] }; }
  function wall(x, y, w, h) { return { x: x, y: y, w: w, h: h, a: 0, t: 'wall' }; }
  function cone(x, y) { return { x: x, y: y, w: 13, h: 13, a: 0, t: 'cone' }; }
  function row(kind, tg, occ) { // kind: top / bottom / right / left
    var bays = [], obs = [], n = kind === 'top' || kind === 'bottom' ? 8 : 7, T = null;
    for (var i = 0; i < n; i++) { var b = kind === 'top' ? { x: TX(i), y: 62, a: 0 } : kind === 'bottom' ? { x: TX(i), y: 558, a: 0 } : kind === 'right' ? { x: 422, y: SYy(i), a: 90 } : { x: 58, y: SYy(i), a: 90 }; bays.push(b); if (i === tg) T = b; if (occ.indexOf(i) >= 0) obs.push(pcar(b.x + (i % 3 - 1) * 2, b.y + (i % 2 ? 3 : -3), b.a + (i % 2 ? 180 : 0), i)); }
    return { bays: bays, obs: obs, T: { x: T.x, y: T.y, a: T.a * D2R, w: 50, h: 88 } };
  }
  function angled(y, deg, tg, occ) { var bays = [], obs = [], T; for (var i = 0; i < 6; i++) { var b = { x: 66 + i * 70, y: y, a: deg }; bays.push(b); if (i === tg) T = b; if (occ.indexOf(i) >= 0) obs.push(pcar(b.x, b.y, deg + (i % 2 ? 180 : 0), i)); } return { bays: bays, obs: obs, T: { x: T.x, y: T.y, a: deg * D2R, w: 50, h: 90 } }; }
  function parallel(x, y, gap) { return { bays: [{ x: x, y: y, a: 0, long: gap - 8 }], obs: [pcar(x, y - gap / 2 - 31, 0, 1), pcar(x, y + gap / 2 + 31, 180, 4)], T: { x: x, y: y, a: 0, w: 46, h: gap - 8 } }; }
  function garage(x, y, a) { var o = []; if (a === 0) { o.push(wall(x - 37, y, 10, 112), wall(x + 37, y, 10, 112), wall(x, y - 51, 84, 10)); } else { o.push(wall(x, y - 37, 112, 10), wall(x, y + 37, 112, 10), wall(x + 51, y, 10, 84)); } return { bays: [], obs: o, T: { x: x, y: y, a: a * D2R, w: 54, h: 90 } }; }
  function mv(x1, y1, x2, y2, sp, i) { return { x1: x1, y1: y1, x2: x2, y2: y2, sp: sp, c: COL[i % COL.length] }; }
  function LV(base, s, par, extra, movers, tip) { return { bays: base.bays, obs: base.obs.concat(extra || []), T: base.T, s: { x: s[0], y: s[1], a: s[2] * D2R }, par: par, mv: movers || [], tip: tip }; }
  var LEVELS = [
    function () { return LV(row('top', 4, []), [240, 470, 0], 9, [], [], ['按住 ▲ 直直開進發亮的車格', 'Hold ▲ and drive straight into the glowing bay']); },
    function () { return LV(row('top', 6, [5, 7, 2]), [110, 470, 0], 13, [], [], ['用 ◀ ▶ 轉彎，小心兩旁的車', 'Steer with ◀ ▶ and mind the cars on both sides']); },
    function () { return LV(row('right', 3, [2, 4, 0, 6]), [150, 540, 0], 14, [], [], ['車格是橫的 — 車身要轉正', 'This bay is sideways — line the car up with it']); },
    function () { return LV(row('left', 2, [1, 3, 5]), [330, 540, 0], 14, [cone(210, 330), cone(210, 370), cone(210, 410)]); },
    function () { return LV(row('bottom', 5, [4, 6, 1, 2]), [90, 250, 90], 18, [], [], ['試試倒車入庫：開過頭再按 ▼', 'Try reversing in: drive past it, then press ▼']); },
    function () { return LV(parallel(438, 250, 150), [300, 540, 0], 20, [], [], ['路邊停車：停進兩台車中間', 'Parallel parking: slot in between the two cars']); },
    function () { return LV(row('top', 0, [1, 2, 3]), [400, 540, 0], 18, [cone(150, 270), cone(195, 270), cone(240, 270), cone(285, 270), cone(330, 270)]); },
    function () { return LV(row('top', 4, [3, 5]), [80, 560, 0], 22, [wall(170, 430, 316, 14), wall(310, 260, 316, 14)]); },
    function () { return LV(garage(240, 112, 0), [70, 560, 0], 22, [wall(240, 340, 240, 14)], [], ['開進車庫，別刮到牆', 'Drive into the garage without scraping the walls']); },
    function () { return LV(row('top', 2, [1, 3, 5, 6]), [380, 560, 0], 20, [], [mv(50, 250, 430, 250, 80, 2)], ['有車在移動，等它過去', 'Traffic is moving — wait for a gap']); },
    function () { return LV(angled(92, 32, 3, [2, 4, 0]), [240, 540, 0], 18, [], [], ['斜角車格：車身要跟著斜', 'Angled bays: match the angle']); },
    function () { return LV(parallel(42, 255, 134), [200, 560, 0], 26, [], [mv(330, 90, 330, 540, 70, 5)]); },
    function () { return LV(row('bottom', 0, [1, 2, 3]), [400, 110, 180], 22, [wall(310, 400, 316, 14)]); },
    function () { return LV(row('right', 6, [5, 4, 3]), [80, 100, 180], 22, [cone(250, 420), cone(250, 460), cone(250, 500)], [mv(50, 300, 330, 300, 85, 7)]); },
    function () { return LV(garage(385, 300, 90), [80, 560, 0], 24, [wall(200, 210, 14, 280)]); },
    function () { return LV(row('top', 3, [0, 1, 2, 4, 5, 6, 7]), [240, 570, 0], 22, [], [mv(50, 235, 430, 235, 95, 1), mv(430, 380, 50, 380, 80, 6)]); },
    function () { return LV(row('bottom', 6, [5, 7]), [70, 80, 180], 26, [wall(170, 210, 316, 14), wall(310, 390, 316, 14)]); },
    function () { return LV(parallel(438, 300, 122), [200, 560, 0], 30, [cone(330, 150), cone(330, 450)], [mv(280, 90, 280, 480, 70, 3)]); },
    function () { return LV(angled(528, -32, 2, [1, 3, 5]), [400, 80, 180], 26, [wall(190, 290, 356, 14)], [mv(430, 390, 60, 390, 85, 8)]); },
    function () { return LV(garage(408, 80, 0), [70, 560, 0], 34, [wall(170, 440, 316, 14), wall(310, 250, 316, 14), cone(100, 330), cone(300, 120)], [mv(50, 345, 430, 345, 90, 4), mv(200, 130, 200, 200, 30, 9)]); }
  ];
  var ground = document.createElement('canvas'); ground.width = W; ground.height = H;
  (function () { var g = ground.getContext('2d'); g.fillStyle = '#3f7d46'; g.fillRect(0, 0, W, H); g.fillStyle = '#9aa1ad'; FX.rr(g, 5, 5, W - 10, H - 10, 10); g.fill(); g.fillStyle = '#3d4352'; FX.rr(g, 11, 11, W - 22, H - 22, 6); g.fill(); for (var i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.07)'; g.fillRect(12 + Math.random() * (W - 24), 12 + Math.random() * (H - 24), 2, 2); } g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1; for (i = 0; i < 7; i++) { var x = 40 + Math.random() * 400, y = 40 + Math.random() * 540; g.beginPath(); g.moveTo(x, y); for (var k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } })();

  // ---------- 幾何 ----------
  function corners(o) { var fx = Math.sin(o.a), fy = -Math.cos(o.a), rx = -fy, ry = fx, hw = o.w / 2, hh = o.h / 2; return [[o.x + rx * hw + fx * hh, o.y + ry * hw + fy * hh], [o.x - rx * hw + fx * hh, o.y - ry * hw + fy * hh], [o.x - rx * hw - fx * hh, o.y - ry * hw - fy * hh], [o.x + rx * hw - fx * hh, o.y + ry * hw - fy * hh]]; }
  function sat(A, B) { var ca = corners(A), cb = corners(B), axes = [[Math.sin(A.a), -Math.cos(A.a)], [Math.cos(A.a), Math.sin(A.a)], [Math.sin(B.a), -Math.cos(B.a)], [Math.cos(B.a), Math.sin(B.a)]]; for (var i = 0; i < 4; i++) { var ax = axes[i], a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (var j = 0; j < 4; j++) { var p = ca[j][0] * ax[0] + ca[j][1] * ax[1]; a0 = Math.min(a0, p); a1 = Math.max(a1, p); p = cb[j][0] * ax[0] + cb[j][1] * ax[1]; b0 = Math.min(b0, p); b1 = Math.max(b1, p); } if (a1 < b0 || b1 < a0) return false; } return true; }
  function mvBox(m) { return { x: m.x, y: m.y, w: CW, h: CH, a: m.a }; }
  function collide(car) { var c = corners(car), i; for (i = 0; i < 4; i++) if (c[i][0] < 12 || c[i][0] > W - 12 || c[i][1] < 12 || c[i][1] > H - 12) return true; for (i = 0; i < S.lv.obs.length; i++) { var o = S.lv.obs[i]; if (Math.abs(o.x - car.x) + Math.abs(o.y - car.y) < 400 && sat(car, o)) return o; } for (i = 0; i < S.mv.length; i++) if (sat(car, mvBox(S.mv[i]))) return true; return false; }
  function parked() { var T = S.lv.T, c = corners(S.car), fx = Math.sin(T.a), fy = -Math.cos(T.a); for (var i = 0; i < 4; i++) { var dx = c[i][0] - T.x, dy = c[i][1] - T.y, f = dx * fx + dy * fy, r = dx * -fy + dy * fx; if (Math.abs(f) > T.h / 2 + 1 || Math.abs(r) > T.w / 2 + 1) return 0; } var d = Math.abs(((S.car.a - T.a) % Math.PI + Math.PI) % Math.PI); d = Math.min(d, Math.PI - d); return d < 0.21 ? 2 : 1; }

  // ---------- 流程 ----------
  function total() { var t = 0; for (var i = 0; i < 20; i++) t += save.best[i] || 0; return t; }
  function solved() { var n = 0; for (var i = 0; i < 20; i++) if (save.best[i]) n++; return n; }
  function menu() {
    var h = '', sv = solved(); for (var i = 0; i < 20; i++) { var b = save.best[i], st = b ? 3 - Math.min(2, save.hits[i] || 0) : 0; h += '<button data-i="' + i + '"' + (i > sv + 1 && !b ? ' disabled' : '') + (i === cur ? ' class="cur"' : '') + '>' + (i + 1) + '<small>' + (b ? '★★★'.slice(0, st) : '') + '</small></button>'; }
    $('lv').innerHTML = h; $('tot').textContent = L('總分 ', 'Total ') + FX.fmt(total()) + ' / 20,000　' + L('已過 ', 'Cleared ') + sv + '/20';
    $('bSubmit').style.display = total() > 0 && window.SCLB && S && S.token ? '' : 'none';
    Array.prototype.forEach.call($('lv').children, function (b) { b.onclick = function () { cur = +b.dataset.i; menu(); }; });
    $('bStart').textContent = L('開始第 ', 'Play level ') + (cur + 1) + L(' 關', '');
  }
  function load(i) {
    cur = i; var lv = LEVELS[i](), tok = S && S.token;
    S = { lv: lv, car: { x: lv.s.x, y: lv.s.y, a: lv.s.a, w: CW, h: CH }, v: 0, steer: 0, t: 0, hits: 0, hitT: 0, run: false, moved: false, ok: 0, done: false, mv: [], token: tok, tipT: 5 };
    lv.mv.forEach(function (m) { var a = Math.atan2(m.x2 - m.x1, -(m.y2 - m.y1)); S.mv.push({ m: m, x: m.x1, y: m.y1, a: a, dir: 1, f: 0, wait: 0, len: Math.hypot(m.x2 - m.x1, m.y2 - m.y1) }); });
    parts.clear(); floats.clear(); hud();
  }
  function hud() { $('lvl').textContent = (cur + 1) + '/20'; $('time').textContent = S.t.toFixed(1); $('hit').textContent = S.hits + '/3'; }
  function start() { load(cur); $('cover').classList.add('off'); K.close('ovEnd'); S.run = true; S.token = true; if (window.SCLB) SCLB.start(GAME, 'stars'); if (window.SC) SC.post('start', { game: GAME }); }
  function hit(o) {
    S.v = -S.v * 0.3; if (S.hitT > 0) return; S.hitT = 0.7; S.hits++; FX.sfx.crash(); shake.kick(9); parts.burst(S.car.x, S.car.y, 14, { c: ['#fde047', '#fff', '#f97316'], sp: 180, life: 0.45, size: 4, g: 0 }); floats.add(S.car.x, S.car.y - 40, L('碰！', 'Bump!'), '#f87171', 18);
    if (o && o.t === 'cone') { o.dead = true; S.lv.obs.splice(S.lv.obs.indexOf(o), 1); }
    if (S.hits > 3) fail();
  }
  function fail() { S.run = false; S.done = true; eng.stop(); $('endEmoji').textContent = '💥'; $('endTitle').textContent = L('撞太多次了', 'Too Many Bumps'); $('endStar').textContent = '—'; $('endTime').textContent = S.t.toFixed(1) + 's'; $('endScore').textContent = '0'; $('endBest').textContent = L('每關最多只能撞 3 次，再試一次！', 'You may bump at most 3 times. Try again!'); $('bAgain').textContent = L('再試一次', 'Try again'); S.next = cur; K.open('ovEnd'); }
  function win() {
    S.run = false; S.done = true; eng.stop(); FX.sfx.great();
    var st = 3 - Math.min(2, S.hits), sc = 400 + st * 150 + Math.round(150 * FX.clamp(1 - (S.t - S.lv.par) / (S.lv.par * 1.5), 0, 1)), old = save.best[cur] || 0, before = total();
    if (sc > old) { save.best[cur] = sc; save.hits[cur] = S.hits; K.save('scpark_v1', save); }
    parts.burst(S.car.x, S.car.y, 40, { c: ['#fde047', '#4ade80', '#93c5fd', '#fff'], sp: 260, life: 0.9, size: 5, g: 200, up: 1 });
    var tot = total(), all = solved() === 20, s0 = S;
    setTimeout(function () {
      if (S !== s0) return;
      $('endEmoji').textContent = '🅿️'; $('endTitle').textContent = all && cur === 19 ? L('全部過關！', 'All Levels Cleared!') : L('停好了！', 'Parked!');
      $('endStar').textContent = '★★★'.slice(0, st) + '☆☆☆'.slice(0, 3 - st); $('endTime').textContent = S.t.toFixed(1) + 's'; $('endScore').textContent = FX.fmt(sc);
      $('endBest').textContent = (sc > old && old ? L('🎉 刷新本關紀錄！', '🎉 New level best!') + '　' : '') + L('總分 ', 'Total ') + FX.fmt(tot) + ' / 20,000';
      S.next = cur < 19 ? cur + 1 : -1; $('bAgain').textContent = S.next >= 0 ? L('下一關 ▶', 'Next level ▶') : L('選關', 'Levels'); K.open('ovEnd');
      if (window.SC) SC.post('gameover', { game: GAME, win: true, score: tot });
      if (window.SCLB && tot > before && ((cur + 1) % 5 === 0 || all)) submit();
    }, 900);
  }
  function submit() { var tot = total(); if (window.SCLB && tot > 0) SCLB.offer({ game: GAME, mode: 'stars', score: tot, text: FX.fmt(tot) + L(' 分・過 ', ' pts · ') + solved() + L(' 關', ' levels') }); }
  function step(dt) {
    parts.step(dt); floats.step(dt); shake.step(dt);
    if (!S.run) { eng.set(50, 0); return; }
    var k = FX.keys, gas = k.up || k.a, rev = k.down || k.b, st = (k.right ? 1 : 0) - (k.left ? 1 : 0), c = S.car;
    if (gas || rev || st) S.moved = true; if (S.moved) S.t += dt; if (S.tipT > 0 && S.moved) S.tipT -= dt; if (S.hitT > 0) S.hitT -= dt;
    if (gas) S.v += (S.v < 0 ? 380 : 190) * dt; else if (rev) S.v -= (S.v > 0 ? 380 : 150) * dt; else S.v -= Math.sign(S.v) * Math.min(Math.abs(S.v), 260 * dt);
    S.v = FX.clamp(S.v, -85, 130); S.steer += (st * 0.6 - S.steer) * Math.min(1, dt * 6);
    var ox = c.x, oy = c.y, oa = c.a; c.a += S.v / 40 * Math.tan(S.steer) * dt; c.x += Math.sin(c.a) * S.v * dt; c.y -= Math.cos(c.a) * S.v * dt;
    var col = collide(c); if (col) { c.x = ox; c.y = oy; c.a = oa; if (Math.abs(S.v) > 12) hit(col); else S.v = 0; if (!S.run) return; }
    // 移動車
    S.mv.forEach(function (m) {
      if (m.wait > 0) { m.wait -= dt; return; }
      var nf = m.f + m.dir * m.m.sp * dt / m.len, t = FX.clamp(nf, 0, 1), nx = m.m.x1 + (m.m.x2 - m.m.x1) * t, ny = m.m.y1 + (m.m.y2 - m.m.y1) * t, px = m.x, py = m.y;
      m.x = nx; m.y = ny; var probe = { x: nx + Math.sin(m.a) * 14, y: ny - Math.cos(m.a) * 14, w: CW + 8, h: CH + 20, a: m.a };
      if (sat(probe, c)) { m.x = px; m.y = py; m.stop = true; return; } m.stop = false; m.f = t;
      if (nf >= 1 || nf <= 0) { m.dir *= -1; m.a += Math.PI; m.wait = 0.5; }
    });
    // 是否停好
    var pk = parked(); S.pk = pk;
    if (pk === 2 && Math.abs(S.v) < 4) { S.ok += dt; if (S.ok > 0.5) { win(); return; } } else S.ok = 0;
    eng.set(48 + Math.abs(S.v) * 0.7, K.muted ? 0 : 0.012 + (gas || rev ? 0.01 : 0)); hud();
  }
  // ---------- 繪圖 ----------
  function draw(time) {
    var lv = S.lv, T = lv.T, i;
    ctx.save(); shake.apply(ctx); ctx.drawImage(ground, 0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
    lv.bays.forEach(function (b) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a * D2R); var hh = (b.long || 88) / 2, hw = b.long ? 23 : 26; ctx.beginPath(); ctx.moveTo(-hw, -hh); ctx.lineTo(-hw, hh); ctx.moveTo(hw, -hh); ctx.lineTo(hw, hh); ctx.stroke(); if (b.long) { ctx.beginPath(); ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.moveTo(-hw, hh); ctx.lineTo(hw, hh); ctx.stroke(); } ctx.restore(); });
    // 目標車格
    ctx.save(); ctx.translate(T.x, T.y); ctx.rotate(T.a); var pu = 0.5 + Math.sin(time * 4) * 0.5, good = S.pk === 2, near = S.pk === 1;
    ctx.fillStyle = good ? 'rgba(74,222,128,' + (0.45 + pu * 0.2) + ')' : near ? 'rgba(253,224,71,.4)' : 'rgba(59,130,246,' + (0.22 + pu * 0.16) + ')'; FX.rr(ctx, -T.w / 2, -T.h / 2, T.w, T.h, 6); ctx.fill();
    ctx.strokeStyle = good ? '#4ade80' : near ? '#fde047' : '#93c5fd'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -time * 30; ctx.stroke(); ctx.setLineDash([]);
    ctx.rotate(-T.a); FX.text(ctx, 'P', 0, 1, 30, 'rgba(255,255,255,' + (0.55 + pu * 0.3) + ')'); ctx.restore();
    lv.obs.forEach(function (o) {
      ctx.save(); ctx.translate(o.x, o.y);
      if (o.t === 'car') { ctx.rotate(o.a); FX.car(ctx, o.w, o.h, o.c); }
      else if (o.t === 'cone') { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(2, 3, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#ea580c'; FX.rr(ctx, -9, -9, 18, 18, 3); ctx.fill(); ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-o.w / 2 + 3, -o.h / 2 + 4, o.w, o.h); ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); ctx.save(); ctx.beginPath(); ctx.rect(-o.w / 2 + 2, -o.h / 2 + 2, o.w - 4, o.h - 4); ctx.clip(); ctx.fillStyle = '#facc15'; ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 5; var m = Math.max(o.w, o.h); for (var q = -m; q < m; q += 16) { ctx.beginPath(); ctx.moveTo(q, -m / 2); ctx.lineTo(q + m, m / 2); ctx.stroke(); } ctx.restore(); }
      ctx.restore();
    });
    S.mv.forEach(function (m) { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a); FX.car(ctx, CW, CH, m.m.c, { brake: m.stop || m.wait > 0 }); ctx.restore(); });
    parts.draw(ctx);
    var c = S.car; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); FX.car(ctx, CW, CH, '#2563eb', { steer: S.steer, brake: S.v < -2 || (!FX.keys.up && !FX.keys.a && Math.abs(S.v) > 3), stripe: '#fff' }); if (S.v < -2) { ctx.fillStyle = '#fff'; ctx.fillRect(-12, CH / 2 - 3, 5, 2.5); ctx.fillRect(7, CH / 2 - 3, 5, 2.5); } ctx.restore();
    floats.draw(ctx); ctx.restore();
    if (S.run && S.lv.tip && S.tipT > 0) { var tp = L(S.lv.tip[0], S.lv.tip[1]); ctx.font = '700 14px system-ui'; var tw = ctx.measureText(tp).width + 28; ctx.globalAlpha = Math.min(1, S.tipT); ctx.fillStyle = 'rgba(13,20,34,.88)'; FX.rr(ctx, (W - tw) / 2, 292, tw, 34, 17); ctx.fill(); FX.text(ctx, tp, W / 2, 309, 14, '#fde047'); ctx.globalAlpha = 1; }
    if (S.run && S.pk === 1) FX.text(ctx, L('車身再擺正一點', 'Straighten the car'), W / 2, 30, 14, '#fde047', 'center', '#000');
    if (S.run && S.ok > 0) { ctx.fillStyle = 'rgba(13,20,34,.8)'; FX.rr(ctx, W / 2 - 62, 18, 124, 12, 6); ctx.fill(); ctx.fillStyle = '#4ade80'; FX.rr(ctx, W / 2 - 60, 20, 120 * Math.min(1, S.ok / 0.5), 8, 4); ctx.fill(); }
  }
  FX.pad($('touch'), [{ k: 'left', t: '◀' }, { k: 'right', t: '▶' }, { gap: 1 }, { k: 'down', t: '▼' }, { k: 'up', t: '▲', cls: 'go' }]);
  function toMenu() { if (S) S.run = false; eng.stop(); K.close('ovEnd'); load(cur); menu(); $('cover').classList.remove('off'); }
  $('bStart').onclick = start; $('bSubmit').onclick = submit; $('bMenu').onclick = toMenu;
  $('bAgain').onclick = function () { K.close('ovEnd'); if (S.next >= 0) { cur = S.next; start(); } else toMenu(); };
  $('bNew').onclick = function () { if ($('cover').classList.contains('off')) start(); };
  FX.sound(function () { if (K.muted) eng.stop(); });
  if (window.SC && SC.onLang) SC.onLang(function () { if (!$('cover').classList.contains('off')) menu(); });
  cur = Math.min(19, solved()); for (var z = 0; z < 20; z++) if (!save.best[z]) { cur = z; break; }
  load(cur); menu(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__pk = { S: function () { return S; }, go: function (i) { cur = i; start(); }, n: LEVELS.length, collide: function () { return collide(S.car); } };
})();
