/* 迷你城市 — stockcorp.github.io/city/
   7×7 格、回合制 20 年。建築：住宅、公寓、商店、工廠、公園、學校、電廠。
   住宅容量受相鄰建築影響（公園 +3、商店 +2、工廠/電廠 −4、兩格內學校 +4），沒電減半。
   人口每年朝 min(住宅容量, 工作數 × 1.6 + 20) 移動一半。收入 = 人口 × 6 + 商店 + 工廠 − 維護費。
   排行榜：mode = 20years，比最終人口。 */
(function () {
  'use strict';
  var GAME = 'city', $ = K.$, L = K.L, W = 480, H = 660, N = 7, TS = 60, GX = 30, GY = 62, YEARS = 20;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(200), floats = FX.Floats();
  var B = {
    house: { e: '🏠', zh: '住宅', en: 'House', cost: 100, up: 0 }, apt: { e: '🏢', zh: '公寓', en: 'Apartment', cost: 400, up: 10, yr: 5 }, shop: { e: '🏪', zh: '商店', en: 'Shop', cost: 200, up: 0, jobs: 6 },
    fac: { e: '🏭', zh: '工廠', en: 'Factory', cost: 350, up: 0, jobs: 20 }, park: { e: '🌳', zh: '公園', en: 'Park', cost: 150, up: 10 }, school: { e: '🏫', zh: '學校', en: 'School', cost: 600, up: 40, jobs: 10 }, power: { e: '⚡', zh: '電廠', en: 'Power', cost: 500, up: 60, jobs: 8 }
  };
  var TOOLS = ['house', 'apt', 'shop', 'fac', 'park', 'school', 'power', 'del'], EVENTS = [null, null, null, { zh: '🎉 景氣大好！今年收入 +50%', en: '🎉 Boom year! Income +50%', inc: 1.5 }, { zh: '🌀 颱風來襲，今年收入 −40%', en: '🌀 Typhoon! Income −40%', inc: 0.6 }, { zh: '👶 嬰兒潮！人口成長加倍', en: '👶 Baby boom! Growth doubled', grow: 1 }, { zh: '🏛️ 中央補助款 +$300', en: '🏛️ Government grant +$300', cash: 300 }];
  function reset() {
    S = { run: false, over: false, started: false, g: [], money: 800, pop: 0, year: 0, tool: 'house', seq: 0, info: null, ev: null, stat: null, delAsk: -1, anim: 0 };
    for (var i = 0; i < N * N; i++) S.g.push(null); S.g[0] = { t: 'power', n: S.seq++, pop: 1 };
    calc(); parts.clear(); floats.clear(); hud();
  }
  function hud() { $('pop').textContent = FX.fmt(S.pop); $('money').textContent = FX.money(S.money); $('year').textContent = Math.min(YEARS, S.year + 1) + '/' + YEARS; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, '20years'); if (window.SC) SC.post('start', { game: GAME }); }
  function nb(i, r) { var x = i % N, y = Math.floor(i / N), o = []; for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { if (!dx && !dy) continue; if (r === 1 && dx && dy) continue; var nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && S.g[ny * N + nx]) o.push(S.g[ny * N + nx]); } return o; }
  function calc() {
    var plants = 0, need = [], i, b; for (i = 0; i < N * N; i++) { b = S.g[i]; if (!b) continue; b.i = i; if (b.t === 'power') plants++; else if (b.t !== 'park') need.push(b); }
    need.sort(function (a, c) { return a.n - c.n; }); var supply = plants * 14; need.forEach(function (o, k) { o.pw = k < supply; });
    var cap = 0, jobs = 0, inc = 0, up = 0, cnt = 0;
    for (i = 0; i < N * N; i++) {
      b = S.g[i]; if (!b) continue; cnt++; var d = B[b.t], adj = nb(i, 1); up += d.up; b.note = [];
      if (b.t === 'house' || b.t === 'apt') {
        var m = b.t === 'apt' ? 2 : 1, c = b.t === 'apt' ? 30 : 10, pk = 0, sh = 0, bad = 0; adj.forEach(function (a) { if (a.t === 'park') pk++; else if (a.t === 'shop') sh++; else if (a.t === 'fac' || a.t === 'power') bad++; });
        var sc = nb(i, 2).some(function (a) { return a.t === 'school' && a.pw; }); c += (pk * 3 + Math.min(2, sh) * 2 - bad * 4 + (sc ? 4 : 0)) * m; c = Math.max(2, c); if (!b.pw) c = Math.floor(c / 2);
        b.cap = c; cap += c; if (pk) b.note.push(L('公園 +', 'park +') + pk * 3 * m); if (sh) b.note.push(L('商店 +', 'shop +') + Math.min(2, sh) * 2 * m); if (sc) b.note.push(L('學校 +', 'school +') + 4 * m); if (bad) b.note.push(L('污染 −', 'pollution −') + bad * 4 * m); if (!b.pw) b.note.push(L('沒電 ÷2', 'no power ÷2'));
      } else if (b.t === 'shop') { var hs = 0; adj.forEach(function (a) { if (a.t === 'house') hs += 1; else if (a.t === 'apt') hs += 2.5; }); b.inc = b.pw ? Math.min(90, Math.round(hs * 15)) : 0; inc += b.inc; if (b.pw) jobs += d.jobs; }
      else if (b.t === 'fac') { b.inc = b.pw ? 130 : 0; inc += b.inc; if (b.pw) jobs += d.jobs; }
      else if (b.t === 'school') { if (b.pw) jobs += d.jobs; } else if (b.t === 'power') jobs += d.jobs;
    }
    var target = Math.min(cap, Math.round(jobs * 1.6 + 20));
    S.stat = { cap: cap, jobs: jobs, supply: supply, need: need.length, inc: inc, up: up, target: target, cnt: cnt, tax: S.pop * 6, net: S.pop * 6 + inc - up };
  }
  function tapTile(i) {
    if (!S.run) return; var b = S.g[i], t = S.tool, x = GX + (i % N) * TS + TS / 2, y = GY + Math.floor(i / N) * TS + TS / 2;
    if (t === 'del') { if (!b) return; if (S.delAsk !== i) { S.delAsk = i; S.info = L('再點一次拆除（不退費）', 'Tap again to demolish (no refund)'); return; } S.g[i] = null; S.delAsk = -1; S.info = null; K.beep(180, 0.12, 'sawtooth', 0.04, 80); parts.burst(x, y, 14, { c: ['#a8a29e', '#78716c'], sp: 150, life: 0.5, size: 5, g: 300 }); calc(); return; }
    S.delAsk = -1;
    if (b && !(t === 'apt' && b.t === 'house')) { var d0 = B[b.t]; S.info = d0.e + ' ' + L(d0.zh, d0.en) + '：' + (b.cap != null ? L('容量 ', 'capacity ') + b.cap + (b.note.length ? '（' + b.note.join('、') + '）' : '') : b.t === 'shop' ? L('年收入 $', 'income $') + b.inc + L('（看相鄰住宅數）', ' (by adjacent homes)') + (b.pw ? '' : L('・沒電', ' · no power')) : b.t === 'fac' ? L('年收入 $', 'income $') + b.inc + L('、工作 20', ', 20 jobs') + (b.pw ? '' : L('・沒電', ' · no power')) : b.t === 'park' ? L('相鄰住宅容量 +3', 'adjacent homes +3') : b.t === 'school' ? L('兩格內住宅 +4、工作 10', 'homes within 2 tiles +4, 10 jobs') : L('供 14 棟建築用電', 'powers 14 buildings')); return; }
    var d = B[t]; if (d.yr && S.year < d.yr) { K.toast(L('公寓第 6 年才解鎖', 'Apartments unlock in year 6')); return; }
    if (S.money < d.cost) { K.toast(L('錢不夠', 'Not enough money')); FX.sfx.bad(); return; }
    S.money -= d.cost; S.g[i] = { t: t, n: b ? b.n : S.seq++, pop: 0 }; S.info = null; FX.sfx.click(); K.beep(520, 0.08, 'triangle', 0.05, 780); parts.burst(x, y, 10, { c: ['#fde047', '#fff'], sp: 120, life: 0.4, size: 4, g: 0 }); calc(); hud();
  }
  function nextYear() {
    if (!S.run || S.anim > 0) return; calc(); var st = S.stat, ev = S.ev, inc = Math.round((S.pop * 6 + st.inc) * (ev && ev.inc ? ev.inc : 1)) - st.up + (ev && ev.cash ? ev.cash : 0), p0 = S.pop, k = ev && ev.grow ? 1 : 0.5;
    S.pop = Math.max(0, Math.round(S.pop + (st.target - S.pop) * (st.target > S.pop ? k : 0.5))); S.money += inc; S.year++;
    floats.add(W / 2, 250, (inc >= 0 ? '+' : '−') + FX.money(Math.abs(inc)), inc >= 0 ? '#fde047' : '#f87171', 26); floats.add(W / 2, 286, L('人口 ', 'Pop ') + (S.pop >= p0 ? '+' : '') + (S.pop - p0), S.pop >= p0 ? '#86efac' : '#fca5a5', 20);
    if (inc >= 0) FX.sfx.cash(); else FX.sfx.bad(); S.anim = 0.5; S.info = null;
    if (S.year >= YEARS) { hud(); end(); return; }
    S.ev = S.year >= 2 && Math.random() < 0.45 ? EVENTS[3 + Math.floor(Math.random() * 4)] : null; if (S.year === 5) S.info = L('🏢 公寓解鎖了！可以直接蓋在住宅上', '🏢 Apartments unlocked! Build them on top of houses');
    calc(); hud();
  }
  function end() {
    S.run = false; S.over = true; var b = FX.best('sccity_best', S.pop), s0 = S;
    setTimeout(function () { if (S !== s0) return; FX.sfx.great(); $('endPop').textContent = FX.fmt(S.pop); $('endBld').textContent = S.stat.cnt; $('endMoney').textContent = FX.money(S.money); $('endBest').textContent = b.isNew && S.pop > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.fmt(b.best); K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: S.pop }); if (window.SCLB && S.pop > 0) SCLB.offer({ game: GAME, mode: '20years', score: S.pop, text: L('人口 ', 'Population ') + FX.fmt(S.pop) }); }, 1200);
  }
  function step(dt) { parts.step(dt); floats.step(dt); if (S.anim > 0) S.anim -= dt; S.g.forEach(function (b) { if (b && b.pop < 1) b.pop = Math.min(1, b.pop + dt * 5); }); }
  // ---------- 繪圖 ----------
  function bld(b, x, y, time) { // (x,y) = 格子左上
    var cx = x + TS / 2, s = 0.6 + 0.4 * FX.ease(b.pop), t = b.t, i;
    ctx.save(); ctx.translate(cx, y + TS - 6); ctx.scale(s, s); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(3, 1, 22, 6, 0, 0, 7); ctx.fill();
    if (t === 'house') { ctx.fillStyle = '#fde8c8'; ctx.fillRect(-16, -24, 32, 24); ctx.fillStyle = '#e2c79a'; ctx.fillRect(6, -24, 10, 24); ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(-21, -23); ctx.lineTo(0, -42); ctx.lineTo(21, -23); ctx.fill(); ctx.fillStyle = '#7c2d12'; ctx.fillRect(-4, -13, 8, 13); ctx.fillStyle = b.pw ? '#fef08a' : '#64748b'; ctx.fillRect(-13, -19, 6, 6); ctx.fillRect(8, -19, 6, 6); }
    else if (t === 'apt') { ctx.fillStyle = '#93a4c2'; ctx.fillRect(-17, -48, 34, 48); ctx.fillStyle = '#7386a8'; ctx.fillRect(8, -48, 9, 48); ctx.fillStyle = '#5b6b8a'; ctx.fillRect(-19, -51, 38, 5); for (i = 0; i < 12; i++) { ctx.fillStyle = !b.pw ? '#475569' : (Math.sin(time * 0.7 + i * 2.3 + b.n) > -0.3 ? '#fef08a' : '#334155'); ctx.fillRect(-13 + (i % 3) * 9, -43 + Math.floor(i / 3) * 10, 6, 6); } ctx.fillStyle = '#334155'; ctx.fillRect(-4, -8, 8, 8); }
    else if (t === 'shop') { ctx.fillStyle = '#f1f5f9'; ctx.fillRect(-19, -24, 38, 24); ctx.fillStyle = '#7dd3fc'; ctx.fillRect(-15, -16, 18, 12); ctx.fillStyle = '#475569'; ctx.fillRect(7, -15, 8, 15); for (i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#f97316'; ctx.fillRect(-21 + i * 8.4, -31, 8.4, 9); } ctx.fillStyle = '#ea580c'; ctx.fillRect(-21, -34, 42, 4); }
    else if (t === 'fac') { ctx.fillStyle = '#78716c'; ctx.fillRect(-21, -22, 42, 22); ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.moveTo(-21, -22); ctx.lineTo(-21, -32); ctx.lineTo(-7, -22); ctx.lineTo(-7, -32); ctx.lineTo(7, -22); ctx.fill(); ctx.fillStyle = '#a8a29e'; ctx.fillRect(9, -46, 9, 46); ctx.fillStyle = '#dc2626'; ctx.fillRect(9, -42, 9, 4); ctx.fillStyle = b.pw ? '#fde047' : '#44403c'; ctx.fillRect(-16, -14, 8, 7); ctx.fillRect(-4, -14, 8, 7); if (b.pw) for (i = 0; i < 3; i++) { var ph = (time * 0.5 + i / 3) % 1; ctx.fillStyle = 'rgba(214,211,209,' + (0.6 * (1 - ph)) + ')'; ctx.beginPath(); ctx.arc(13 + ph * 10, -50 - ph * 22, 4 + ph * 7, 0, 7); ctx.fill(); } }
    else if (t === 'park') { ctx.fillStyle = '#4ade80'; FX.rr(ctx, -24, -44, 48, 44, 10); ctx.fill(); ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.ellipse(8, -12, 10, 6, 0, 0, 7); ctx.fill(); [[-12, -26], [10, -32], [-6, -8]].forEach(function (p) { ctx.fillStyle = '#92400e'; ctx.fillRect(p[0] - 1.5, p[1], 3, 8); ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(p[0], p[1] - 3, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(p[0] - 2, p[1] - 5, 5, 0, 7); ctx.fill(); }); }
    else if (t === 'school') { ctx.fillStyle = '#fca5a5'; ctx.fillRect(-21, -24, 42, 24); ctx.fillStyle = '#b91c1c'; ctx.fillRect(-23, -28, 46, 6); ctx.fillStyle = '#fef2f2'; ctx.fillRect(-7, -38, 14, 14); ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-10, -38); ctx.lineTo(0, -47); ctx.lineTo(10, -38); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, -31, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = b.pw ? '#fef08a' : '#64748b'; ctx.fillRect(-17, -17, 7, 7); ctx.fillRect(10, -17, 7, 7); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-4, -12, 8, 12); }
    else { ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-12, -22, -15, -42); ctx.lineTo(1, -42); ctx.quadraticCurveTo(-2, -22, 6, 0); ctx.fill(); ctx.fillStyle = '#64748b'; ctx.fillRect(6, -20, 16, 20); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(16, -17); ctx.lineTo(10, -9); ctx.lineTo(14, -9); ctx.lineTo(12, -2); ctx.lineTo(19, -11); ctx.lineTo(15, -11); ctx.fill(); for (i = 0; i < 3; i++) { var p2 = (time * 0.4 + i / 3) % 1; ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - p2)) + ')'; ctx.beginPath(); ctx.arc(-7 + p2 * 6, -46 - p2 * 20, 5 + p2 * 8, 0, 7); ctx.fill(); } }
    ctx.restore();
    if (b.cap != null) { ctx.fillStyle = 'rgba(10,20,32,.8)'; FX.rr(ctx, x + 2, y + 2, 24, 15, 5); ctx.fill(); FX.text(ctx, String(b.cap), x + 14, y + 10, 10.5, b.note.some(function (n) { return n.indexOf('−') >= 0 || n.indexOf('÷') >= 0; }) ? '#fca5a5' : '#86efac'); }
    if (b.inc != null && b.t !== 'house') { ctx.fillStyle = 'rgba(10,20,32,.8)'; FX.rr(ctx, x + 2, y + 2, 30, 15, 5); ctx.fill(); FX.text(ctx, '$' + b.inc, x + 17, y + 10, 10, b.inc > 0 ? '#fde047' : '#fca5a5'); }
    if (b.pw === false && Math.floor(time * 2) % 2) FX.text(ctx, '🔌', x + TS - 12, y + 12, 14);
  }
  function draw(time) {
    hit.begin(); ctx.fillStyle = '#0f2a1c'; ctx.fillRect(0, 0, W, H); var st = S.stat, i;
    // 上方數據
    ctx.fillStyle = '#122032'; FX.rr(ctx, 6, 6, 468, 50, 12); ctx.fill();
    var cells = [[L('人口 / 目標', 'Pop / target'), FX.fmt(S.pop) + ' / ' + FX.fmt(st.target), st.target >= S.pop ? '#86efac' : '#fca5a5'], [L('住宅容量', 'Housing'), FX.fmt(st.cap), st.cap <= st.target ? '#fde047' : '#fff'], [L('工作', 'Jobs'), FX.fmt(st.jobs), Math.round(st.jobs * 1.6 + 20) <= st.target ? '#fde047' : '#fff'], [L('電力', 'Power'), st.need + '/' + st.supply, st.need > st.supply ? '#f87171' : '#fff'], [L('年收支', 'Net / yr'), (st.net >= 0 ? '+' : '−') + FX.money(Math.abs(st.net)), st.net >= 0 ? '#fde047' : '#f87171']];
    cells.forEach(function (c, k) { var cx = 6 + 468 / 5 * (k + 0.5); FX.text(ctx, c[0], cx, 20, 10, '#94a3b8'); FX.text(ctx, c[1], cx, 40, k === 0 ? 13 : 14.5, c[2]); });
    for (i = 0; i < N * N; i++) { var gx = GX + (i % N) * TS, gy = GY + Math.floor(i / N) * TS; ctx.fillStyle = ((i % N) + Math.floor(i / N)) % 2 ? '#5fae52' : '#68b85a'; ctx.fillRect(gx, gy, TS, TS); if (S.delAsk === i) { ctx.fillStyle = 'rgba(239,68,68,.45)'; ctx.fillRect(gx, gy, TS, TS); } hit.add(gx, gy, TS, TS, tapTile, i); }
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; for (i = 0; i <= N; i++) { ctx.beginPath(); ctx.moveTo(GX + i * TS, GY); ctx.lineTo(GX + i * TS, GY + N * TS); ctx.moveTo(GX, GY + i * TS); ctx.lineTo(GX + N * TS, GY + i * TS); ctx.stroke(); }
    ctx.strokeStyle = '#3f7d3a'; ctx.lineWidth = 4; ctx.strokeRect(GX - 2, GY - 2, N * TS + 4, N * TS + 4);
    for (i = 0; i < N * N; i++) if (S.g[i]) bld(S.g[i], GX + (i % N) * TS, GY + Math.floor(i / N) * TS, time);
    if (S.ev) { ctx.fillStyle = 'rgba(10,20,32,.88)'; FX.rr(ctx, 60, GY + 6, 360, 26, 13); ctx.fill(); FX.text(ctx, L(S.ev.zh, S.ev.en), W / 2, GY + 19.5, 13, '#fde047'); }
    // 工具列
    TOOLS.forEach(function (t, k) { var bx = 6 + (k % 4) * 117.5, by = 490 + Math.floor(k / 4) * 48, d = B[t], lock = d && d.yr && S.year < d.yr, cant = d && S.money < d.cost; FX.button(ctx, bx, by, 112, 42, '', { bg: t === 'del' ? '#7f1d1d' : '#1e3a5f', sel: S.tool === t, off: lock }); if (t === 'del') FX.text(ctx, L('🔨 拆除', '🔨 Demolish'), bx + 56, by + 22, 13.5, '#fff'); else { FX.text(ctx, d.e + ' ' + L(d.zh, d.en), bx + 56, by + 14, 13, lock ? '#8a93a6' : '#fff'); FX.text(ctx, lock ? L('第 6 年解鎖', 'Year 6') : '$' + d.cost, bx + 56, by + 31, 11, lock ? '#8a93a6' : cant ? '#fca5a5' : '#fde047'); } hit.add(bx, by, 112, 44, function (tt) { S.tool = tt; S.delAsk = -1; K.beep(600, 0.04, 'triangle', 0.03); }, t); });
    var tip = S.info || (S.tool === 'del' ? L('點建築拆除', 'Tap a building to demolish it') : S.tool === 'house' ? L('住宅：容量 10。旁邊蓋公園、商店更好', 'House: capacity 10. Better next to parks and shops') : S.tool === 'apt' ? L('公寓：容量 30，加成都是兩倍', 'Apartment: capacity 30, all bonuses doubled') : S.tool === 'shop' ? L('商店：工作 6，收入看相鄰住宅', 'Shop: 6 jobs, income from adjacent homes') : S.tool === 'fac' ? L('工廠：工作 20、年收 $130，但有污染', 'Factory: 20 jobs, $130/yr, but pollutes') : S.tool === 'park' ? L('公園：相鄰住宅 +3，維護費 $10', 'Park: adjacent homes +3, upkeep $10') : S.tool === 'school' ? L('學校：兩格內住宅 +4、工作 10', 'School: homes within 2 tiles +4, 10 jobs') : L('電廠：供 14 棟用電，有污染', 'Power plant: powers 14 buildings, pollutes'));
    FX.text(ctx, tip, 10, 600, tip.length > 30 ? 10.5 : 12, '#cbd5e1', 'left');
    FX.button(ctx, 250, 612, 224, 42, S.year + 1 >= YEARS ? L('最後一年 ▶', 'Final year ▶') : L('下一年 ▶', 'Next year ▶'), { bg: '#0284c7', size: 17 }); hit.add(250, 610, 224, 46, nextYear);
    FX.text(ctx, L('稅收 ', 'Tax ') + FX.money(S.pop * 6) + L('　商業 ', '  Biz ') + FX.money(st.inc), 10, 624, 11, '#94a3b8', 'left'); FX.text(ctx, L('維護 −', 'Upkeep −') + FX.money(st.up), 10, 642, 11, '#94a3b8', 'left');
    parts.draw(ctx); floats.draw(ctx);
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__ct = { S: function () { return S; }, go: start, tap: tapTile, next: nextYear, calc: calc, B: B };
})();
