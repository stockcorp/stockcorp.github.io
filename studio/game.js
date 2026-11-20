/* 遊戲工作室 — stockcorp.github.io/studio/
   回合制：20 回合（每回合半年）。企劃 = 類型 × 題材 × 規模 × 兩個開發重點 × 行銷。
   評分 Q = 3 + 團隊×0.7 + 引擎×0.5 + 重點吻合×1.0 + 相性×(−1.6 ~ +1.3) + 規模加成 + 隨機。
   營收 = 規模基準 × (Q/6)^2.2 × 相性 × 流行 × 行銷 × 粉絲 × 新鮮度。排行榜：mode = 10years，比最終資金。 */
(function () {
  'use strict';
  var GAME = 'studio', $ = K.$, L = K.L, W = 480, H = 660, TURNS = 20;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(160), floats = FX.Floats();
  var GEN = [['動作', 'Action', '大亂鬥', 'Brawl'], ['RPG', 'RPG', '傳說', 'Legends'], ['模擬', 'Sim', '物語', 'Story'], ['益智', 'Puzzle', '方塊', 'Blocks'], ['競速', 'Racing', '狂飆', 'Rush'], ['冒險', 'Adventure', '歷險記', 'Quest']];
  var THM = [['奇幻', 'Fantasy', '🐉'], ['科幻', 'Sci-fi', '🤖'], ['忍者', 'Ninja', '🥷'], ['殭屍', 'Zombie', '🧟'], ['料理', 'Cooking', '🍳'], ['足球', 'Soccer', '⚽'], ['太空', 'Space', '🚀'], ['校園', 'School', '🏫']];
  var MAT = [[2, 2, 3, 3, 0, 1, 2, 1], [3, 2, 2, 1, 1, 0, 2, 2], [1, 2, 0, 1, 3, 3, 2, 2], [2, 1, 1, 2, 3, 0, 1, 2], [1, 3, 1, 1, 0, 1, 3, 0], [3, 2, 2, 3, 1, 0, 2, 2]];
  var CM = [0.65, 0.9, 1.1, 1.3], CQ = [-1.6, -0.3, 0.5, 1.3], CN = [['不搭', 'Bad', '✕', '#f87171'], ['普通', 'So-so', '△', '#cbd5e1'], ['不錯', 'Good', '○', '#86efac'], ['絕配', 'Perfect', '★', '#fde047']];
  var FOC = [['玩法', 'Gameplay'], ['畫面', 'Graphics'], ['劇情', 'Story'], ['音效', 'Sound']], IDEAL = [[0, 1], [2, 3], [0, 2], [0, 3], [1, 3], [2, 1]];
  var SIZE = [{ zh: '小品', en: 'Small', turns: 1, cost: 20000, rev: 60000, q: 0, fan: 5 }, { zh: '中型', en: 'Medium', turns: 2, cost: 70000, rev: 230000, q: 0.3, fan: 15 }, { zh: '大作', en: 'Large', turns: 3, cost: 220000, rev: 760000, q: 0.6, fan: 40 }];
  var MKT = [{ zh: '不行銷', en: 'None', cost: 0, m: 1 }, { zh: '網路廣告', en: 'Online ads', cost: 15000, m: 1.3 }, { zh: '大型宣傳', en: 'Big campaign', cost: 60000, m: 1.8 }];
  var STAFF = [0, 30000, 90000, 220000, 550000], ENG = [0, 50000, 160000, 420000];
  function reset() { S = { ph: 'plan', run: false, over: false, started: false, money: 100000, turn: 0, fans: 0, staff: 1, eng: 0, g: 0, th: 0, size: 0, foc: [0, 1], mkt: 0, known: {}, last: null, hot: Math.floor(Math.random() * 6), games: [], bestQ: 0, at: 0, res: null, shop: false, bail: false, names: {} }; parts.clear(); floats.clear(); hud(); }
  function turnName(t) { t = Math.min(TURNS - 1, t); return L('第 ' + (Math.floor(t / 2) + 1) + ' 年' + (t % 2 ? '下' : '上'), 'Y' + (Math.floor(t / 2) + 1) + (t % 2 ? ' H2' : ' H1')); }
  function hud() { $('money').textContent = FX.money(S.money); $('turn').textContent = turnName(S.turn); $('fans').textContent = FX.fmt(S.fans); }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, '10years'); if (window.SC) SC.post('start', { game: GAME }); }
  function cost() { var z = SIZE[S.size]; return Math.round(z.cost * (1 + 0.15 * (S.staff - 1))) + MKT[S.mkt].cost + S.staff * 8000 * z.turns; }
  function set(a) { if (S.ph !== 'plan' || S.shop) return; var k = a[0], v = a[1]; if (k === 'foc') { if (S.foc.indexOf(v) >= 0) return; S.foc.shift(); S.foc.push(v); } else S[k] = v; K.beep(600, 0.04, 'triangle', 0.03); }
  function dev() {
    if (S.ph !== 'plan' || S.shop) return; var z = SIZE[S.size], c = cost();
    if (S.turn + z.turns > TURNS) { K.toast(L('剩下的時間不夠做這個規模', 'Not enough time left for this size')); return; }
    if (c > S.money) { K.toast(L('資金不夠', 'Not enough cash')); FX.sfx.bad(); return; }
    var comp = MAT[S.g][S.th], id = IDEAL[S.g], match = (S.foc.indexOf(id[0]) >= 0 ? 1 : 0) + (S.foc.indexOf(id[1]) >= 0 ? 1 : 0), rnd = (Math.random() - 0.5) * 1.6;
    var Q = FX.clamp(3 + S.staff * 0.7 + S.eng * 0.5 + match * 1.0 + CQ[comp] + z.q + rnd, 1, 10), same = S.last && S.last.g === S.g, same2 = same && S.last.th === S.th, nov = same2 ? 0.65 : same ? 0.85 : 1, hot = S.hot === S.g;
    var rev = Math.round(z.rev * Math.pow(Q / 6, 2.2) * CM[comp] * (hot ? 1.4 : 1) * MKT[S.mkt].m * (1 + Math.min(600, S.fans) / 200) * nov * (0.9 + Math.random() * 0.2) / 100) * 100, key = S.g + '_' + S.th;
    S.names[key] = (S.names[key] || 0) + 1; var nm = [THM[S.th][0] + GEN[S.g][2] + (S.names[key] > 1 ? ' ' + S.names[key] : ''), THM[S.th][1] + ' ' + GEN[S.g][3] + (S.names[key] > 1 ? ' ' + S.names[key] : '')];
    var crit = []; for (var i = 0; i < 4; i++) crit.push(FX.clamp(Math.round(Q + (Math.random() - 0.5) * 1.8), 1, 10));
    var notes = [[L('類型和題材：', 'Genre × theme: ') + L(CN[comp][0], CN[comp][1]) + ' ' + CN[comp][2], CN[comp][3]]]; id.forEach(function (f) { if (S.foc.indexOf(f) < 0) notes.push([L(FOC[f][0] + '不夠到位，這類遊戲很看重', FOC[f][1] + ' fell short — it matters for this genre'), '#fca5a5']); }); if (match === 2) notes.push([L('開發重點抓得很準！', 'Spot-on development focus!'), '#86efac']); if (hot) notes.push([L('搭上流行，銷量 +40%', 'Riding the trend: sales +40%'), '#fde047']); if (nov < 1) notes.push([L('和上一款太像，玩家有點膩', 'Too similar to your last game'), '#fca5a5']);
    var fan = Math.round(Math.max(0, Q - 5) * z.fan * (comp === 3 ? 1.3 : 1));
    S.money -= c; S.known[key] = comp; S.res = { name: nm, Q: Q, crit: crit, rev: rev, cost: c, notes: notes.slice(0, 4), fan: fan, g: S.g, th: S.th, size: S.size, sum: crit[0] + crit[1] + crit[2] + crit[3] }; S.ph = 'dev'; S.at = 0; hud(); FX.sfx.go();
  }
  function done() {
    var R = S.res, z = SIZE[R.size]; S.money += R.rev; S.fans += R.fan; S.turn += z.turns; S.last = { g: R.g, th: R.th }; S.games.push(R); S.bestQ = Math.max(S.bestQ, R.sum);
    if (Math.floor(S.turn / 2) !== Math.floor((S.turn - z.turns) / 2)) { var h; do { h = Math.floor(Math.random() * 6); } while (h === S.hot); S.hot = h; }
    hud(); if (S.turn >= TURNS) { end(); return; }
    S.ph = 'plan'; if (S.money < 20000 + S.staff * 8000) { if (!S.bail) { S.bail = true; S.money += 60000; K.toast(L('資金見底！投資人紓困 +$60K（只有一次）', 'Out of cash! Investors bail you out: +$60K (once only)'), 4000); hud(); } else { end(); } }
    while (SIZE[S.size].turns + S.turn > TURNS && S.size > 0) S.size--;
  }
  function upg(k) { var price = k === 'staff' ? (S.staff < 5 ? STAFF[S.staff] : null) : (S.eng < 3 ? ENG[S.eng + 1] : null); if (price == null) return; if (S.money < price) { FX.sfx.bad(); K.toast(L('資金不夠', 'Not enough cash')); return; } S.money -= price; S[k]++; FX.sfx.great(); hud(); }
  function step(dt) { parts.step(dt); floats.step(dt); if (S.ph === 'dev') { S.at += dt; if (Math.random() < dt * 9) { var f = FX.pick(S.foc); floats.add(120 + Math.random() * 240, 120, L(FOC[f][0], FOC[f][1]) + ' +' + (1 + Math.floor(Math.random() * 3)), ['#7dd3fc', '#f9a8d4', '#fde047', '#86efac'][f], 13); K.beep(700 + f * 120, 0.03, 'square', 0.015); } if (S.at > 3.2) { S.ph = 'review'; S.at = 0; } } else if (S.ph === 'review') { var b = S.at; S.at += dt; for (var i = 0; i < 4; i++) if (b < 0.5 + i * 0.55 && S.at >= 0.5 + i * 0.55) { K.beep(500 + S.res.crit[i] * 70, 0.12, 'triangle', 0.05); } if (b < 3 && S.at >= 3) { if (S.res.sum >= 32) { FX.sfx.great(); parts.burst(W / 2, 250, 60, { c: ['#fde047', '#f472b6', '#7dd3fc', '#86efac'], sp: 340, life: 1.2, size: 5, g: 300, up: 1 }); } else if (S.res.rev >= S.res.cost) FX.sfx.cash(); else FX.sfx.bad(); } } }
  function end() {
    S.ph = 'over'; S.run = false; S.over = true; var m = Math.max(0, Math.round(S.money)), b = FX.best('scstudio_best', m); FX.sfx.great();
    $('endMoney').textContent = FX.money(m); $('endBestQ').textContent = S.bestQ + '/40'; $('endGames').textContent = S.games.length; $('endBest').textContent = b.isNew && m > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + FX.money(b.best);
    K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: m }); if (window.SCLB && m > 0) SCLB.offer({ game: GAME, mode: '10years', score: m, text: FX.money(m) });
  }
  // ---------- 繪圖 ----------
  function panel(x, y, w, h, c) { ctx.fillStyle = c || '#1d1532'; FX.rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke(); }
  function chip(x, y, w, h, label, sel, fn, data, o) { o = o || {}; FX.button(ctx, x, y, w, h, label, { bg: sel ? '#7c3aed' : '#2a2148', sel: sel, size: o.size || 13, sub: o.sub, subc: o.subc, off: o.off }); if (!o.off) hit.add(x, y, w, h + 3, fn, data); if (o.badge) { ctx.fillStyle = '#120d1f'; ctx.beginPath(); ctx.arc(x + w - 9, y + 9, 9, 0, 7); ctx.fill(); FX.text(ctx, o.badge[0], x + w - 9, y + 9.5, 12, o.badge[1]); } }
  function office(time, busy) {
    var g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#2b1f4d'); g.addColorStop(1, '#1b1433'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 150); ctx.fillStyle = '#3b2d66'; ctx.fillRect(0, 118, W, 32);
    ctx.fillStyle = '#0f172a'; FX.rr(ctx, 16, 14, 120, 54, 6); ctx.fill(); var wg = ctx.createLinearGradient(0, 14, 0, 68); wg.addColorStop(0, '#312e81'); wg.addColorStop(1, '#f472b6'); ctx.fillStyle = wg; FX.rr(ctx, 20, 18, 112, 46, 4); ctx.fill(); ctx.fillStyle = '#0f172a'; for (var b = 0; b < 7; b++) ctx.fillRect(24 + b * 16, 64 - 12 - (b * 37 % 22), 11, 40);
    ctx.fillStyle = '#fde047'; FX.rr(ctx, 356, 16, 108, 44, 8); ctx.fill(); FX.text(ctx, L('流行：', 'Hot: ') + L(GEN[S.hot][0], GEN[S.hot][1]), 410, 30, 12.5, '#422006'); FX.text(ctx, L('銷量 +40%', 'Sales +40%'), 410, 47, 10.5, '#854d0e');
    for (var i = 0; i < S.staff; i++) { var x = 170 + i * 58 - (S.staff - 1) * 29 + 70, y = 112, t = busy ? Math.sin(time * 16 + i * 2) * 2 : 0; ctx.fillStyle = '#4c3d80'; ctx.fillRect(x - 22, y, 44, 8); ctx.fillStyle = '#0f172a'; FX.rr(ctx, x - 14, y - 26, 28, 20, 3); ctx.fill(); ctx.fillStyle = busy ? 'hsl(' + ((time * 200 + i * 70) % 360) + ',80%,65%)' : '#38bdf8'; ctx.fillRect(x - 11, y - 23, 22, 14); ctx.fillStyle = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899'][i]; FX.rr(ctx, x - 10, y + 8 + t, 20, 22, 7); ctx.fill(); ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(x, y + 2 + t, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(x, y - 1 + t, 9, Math.PI, 0); ctx.fill(); }
    FX.text(ctx, L('團隊 Lv', 'Team Lv') + S.staff + L('　引擎 Lv', '  Engine Lv') + S.eng, 76, 86, 11, '#c4b5fd');
  }
  function draw(time) {
    hit.begin(); ctx.fillStyle = '#120d1f'; ctx.fillRect(0, 0, W, H); office(time, S.ph === 'dev'); var i, y;
    if (S.ph === 'plan' || S.ph === 'over') {
      FX.text(ctx, L('類型', 'Genre'), 12, 166, 12, '#a78bfa', 'left'); for (i = 0; i < 6; i++) chip(8 + (i % 6) * 78, 176, 73, 38, L(GEN[i][0], GEN[i][1]), S.g === i, set, ['g', i], { size: 13, badge: S.hot === i ? ['🔥', '#fff'] : null });
      FX.text(ctx, L('題材（做過的組合會標記相性）', 'Theme (tried combos are marked)'), 12, 234, 12, '#a78bfa', 'left'); for (i = 0; i < 8; i++) { var kn = S.known[S.g + '_' + i]; chip(8 + (i % 4) * 117.5, 244 + Math.floor(i / 4) * 46, 112, 40, THM[i][2] + ' ' + L(THM[i][0], THM[i][1]), S.th === i, set, ['th', i], { badge: kn != null ? [CN[kn][2], CN[kn][3]] : null }); }
      FX.text(ctx, L('規模', 'Size'), 12, 350, 12, '#a78bfa', 'left'); for (i = 0; i < 3; i++) { var z = SIZE[i], no = S.turn + z.turns > TURNS; chip(8 + i * 156.5, 360, 151, 44, L(z.zh, z.en), S.size === i, set, ['size', i], { sub: z.turns + L(' 回合・$', ' turn' + (z.turns > 1 ? 's' : '') + ' · $') + Math.round(z.cost / 1000) + 'K', off: no }); }
      FX.text(ctx, L('開發重點（選 2 個）', 'Focus (pick 2)'), 12, 424, 12, '#a78bfa', 'left'); for (i = 0; i < 4; i++) chip(8 + i * 117.5, 434, 112, 36, L(FOC[i][0], FOC[i][1]), S.foc.indexOf(i) >= 0, set, ['foc', i]);
      FX.text(ctx, L('行銷', 'Marketing'), 12, 490, 12, '#a78bfa', 'left'); for (i = 0; i < 3; i++) chip(8 + i * 156.5, 500, 151, 44, L(MKT[i].zh, MKT[i].en), S.mkt === i, set, ['mkt', i], { sub: MKT[i].cost ? '$' + MKT[i].cost / 1000 + 'K・×' + MKT[i].m : L('免費', 'Free') });
      var c = cost(), ok = c <= S.money, kn2 = S.known[S.g + '_' + S.th]; FX.text(ctx, L('總成本（含薪水）', 'Total cost (incl. salaries)'), 12, 566, 11, '#a8a29e', 'left'); FX.text(ctx, FX.money(c), 12, 585, 18, ok ? '#fde047' : '#f87171', 'left'); if (kn2 != null) FX.text(ctx, L('相性：', 'Match: ') + L(CN[kn2][0], CN[kn2][1]) + ' ' + CN[kn2][2], 150, 585, 13, CN[kn2][3], 'left'); else FX.text(ctx, L('相性：？（還沒試過）', 'Match: ? (untried)'), 150, 585, 12, '#94a3b8', 'left');
      FX.button(ctx, 8, 606, 150, 46, L('🛠 升級', '🛠 Upgrades'), { bg: '#0e7490', size: 15 }); hit.add(8, 604, 150, 50, function () { S.shop = true; FX.sfx.click(); });
      FX.button(ctx, 168, 606, 304, 46, L('開始開發 ▶', 'Start development ▶'), { bg: ok ? '#7c3aed' : '#3a4152', size: 18, off: !ok }); hit.add(168, 604, 304, 50, dev);
    } else if (S.ph === 'dev') {
      var R = S.res, f = Math.min(1, S.at / 3.2); panel(8, 160, 464, 490); FX.text(ctx, L('開發中…', 'In development…'), W / 2, 220, 16, '#c4b5fd'); FX.text(ctx, '「' + L(R.name[0], R.name[1]) + '」', W / 2, 262, 26, '#fff'); FX.text(ctx, THM[R.th][2], W / 2, 350, 80 + Math.sin(time * 8) * 6);
      ctx.fillStyle = '#33265a'; FX.rr(ctx, 60, 440, 360, 16, 8); ctx.fill(); ctx.fillStyle = '#a78bfa'; FX.rr(ctx, 60, 440, Math.max(16, 360 * f), 16, 8); ctx.fill(); FX.text(ctx, Math.round(f * 100) + '%', W / 2, 480, 16, '#fff'); hit.add(0, 150, W, 510, function () { S.at = 9; });
    } else if (S.ph === 'review') {
      R = S.res; panel(8, 160, 464, 490); FX.text(ctx, '「' + L(R.name[0], R.name[1]) + '」', W / 2, 190, 21, '#fff'); FX.text(ctx, L(GEN[R.g][0], GEN[R.g][1]) + ' × ' + L(THM[R.th][0], THM[R.th][1]) + '・' + L(SIZE[R.size].zh, SIZE[R.size].en), W / 2, 214, 12, '#c4b5fd');
      for (i = 0; i < 4; i++) { var shown = S.at >= 0.5 + i * 0.55, cx = 78 + i * 108; ctx.fillStyle = '#2a2148'; FX.rr(ctx, cx - 44, 234, 88, 92, 12); ctx.fill(); FX.text(ctx, ['🧐', '😎', '🤓', '🧑‍💻'][i], cx, 258, 22); if (shown) { var sc = 1 + Math.max(0, 0.3 - (S.at - 0.5 - i * 0.55)) * 2; FX.text(ctx, String(R.crit[i]), cx, 298, 34 * sc, R.crit[i] >= 8 ? '#fde047' : R.crit[i] >= 6 ? '#86efac' : R.crit[i] >= 4 ? '#fff' : '#f87171'); } else FX.text(ctx, '?', cx, 298, 30, '#6b5ca5'); }
      if (S.at >= 3) {
        FX.text(ctx, L('總分 ', 'Total ') + R.sum + ' / 40　' + (R.sum >= 36 ? L('神作！', 'Masterpiece!') : R.sum >= 30 ? L('佳作', 'Great') : R.sum >= 22 ? L('還不錯', 'Decent') : R.sum >= 14 ? L('普普', 'Mediocre') : L('雷作…', 'Flop…')), W / 2, 350, 18, R.sum >= 30 ? '#fde047' : '#fff');
        R.notes.forEach(function (n, k) { FX.text(ctx, '• ' + n[0], 30, 384 + k * 24, 12.5, n[1], 'left'); });
        var cf = Math.min(1, (S.at - 3) / 1.2), rv = Math.round(R.rev * cf); y = 492; FX.text(ctx, L('營收', 'Revenue'), 30, y, 14, '#cbd5e1', 'left'); FX.text(ctx, FX.money(rv), 450, y, 18, '#86efac', 'right'); FX.text(ctx, L('成本', 'Cost'), 30, y + 26, 14, '#cbd5e1', 'left'); FX.text(ctx, '−' + FX.money(R.cost), 450, y + 26, 15, '#fca5a5', 'right'); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(24, y + 44, 432, 1.5); var net = R.rev - R.cost; FX.text(ctx, L('損益', 'Profit'), 30, y + 64, 16, '#fff', 'left'); if (cf >= 1) { FX.text(ctx, (net >= 0 ? '+' : '−') + FX.money(Math.abs(net)), 450, y + 64, 21, net >= 0 ? '#fde047' : '#f87171', 'right'); FX.text(ctx, L('粉絲 +', 'Fans +') + R.fan, 150, y + 64, 12.5, '#c4b5fd', 'left'); FX.button(ctx, 168, 598, 304, 46, S.turn + SIZE[R.size].turns >= TURNS ? L('看結果 ▶', 'Final result ▶') : L('下一個企劃 ▶', 'Next project ▶'), { bg: '#7c3aed', size: 17 }); hit.add(168, 596, 304, 50, done); }
      } else hit.add(0, 150, W, 510, function () { S.at = Math.max(S.at, 3); });
    }
    if (S.shop) {
      hit.begin(); ctx.fillStyle = 'rgba(8,5,16,.84)'; ctx.fillRect(0, 0, W, H); panel(14, 150, 452, 360, '#221940'); FX.text(ctx, L('🛠 升級', '🛠 Upgrades'), W / 2, 180, 20, '#fff'); FX.text(ctx, L('資金 ', 'Cash ') + FX.money(S.money), W / 2, 206, 14, '#fde047');
      [['staff', L('👩‍💻 擴編團隊', '👩‍💻 Grow the team'), L('評分 +0.7／級，但薪水和開發成本也會增加', 'Score +0.7 per level; salaries and costs rise too'), S.staff < 5 ? STAFF[S.staff] : null, S.staff + '/5'], ['eng', L('⚙️ 研發引擎', '⚙️ Engine R&D'), L('評分 +0.5／級，沒有額外開銷', 'Score +0.5 per level, no extra upkeep'), S.eng < 3 ? ENG[S.eng + 1] : null, S.eng + '/3']].forEach(function (it, k) { var yy = 230 + k * 96; ctx.fillStyle = 'rgba(255,255,255,.05)'; FX.rr(ctx, 26, yy, 428, 84, 10); ctx.fill(); FX.text(ctx, it[1] + '　Lv ' + it[4], 38, yy + 22, 15, '#fff', 'left'); FX.text(ctx, it[2], 38, yy + 48, 11, '#cbd5e1', 'left'); if (it[3] == null) FX.text(ctx, L('✓ 已滿級', '✓ Maxed'), 396, yy + 66, 13, '#86efac'); else { var can = S.money >= it[3]; FX.button(ctx, 340, yy + 44, 104, 32, FX.money(it[3]), { bg: '#16a34a', off: !can, size: 14 }); hit.add(340, yy + 40, 104, 40, upg, it[0]); } });
      FX.button(ctx, 150, 446, 180, 44, L('關閉', 'Close'), { bg: '#475569', size: 15 }); hit.add(150, 442, 180, 52, function () { S.shop = false; FX.sfx.click(); });
    }
    parts.draw(ctx); floats.draw(ctx);
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__sd = { S: function () { return S; }, go: start, dev: dev, done: done, upg: upg, step: step, MAT: MAT, IDEAL: IDEAL, SIZE: SIZE, STAFF: STAFF, ENG: ENG };
})();
