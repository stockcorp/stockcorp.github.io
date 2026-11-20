/* 地鐵大亨 — stockcorp.github.io/metro/
   車站（●▲■★）陸續出現，玩家在車站間拖曳拉線；每條線一班列車來回跑（可加開）。
   乘客 = 目的地形狀。路徑用整張路網的 BFS：只搭「這條線上有比現在這站更接近目的地的站」的車，
   到了「這條線已經沒有更近的站」就下車轉乘。車站等候 > 6 人，擁擠計時 25 秒轉滿就結束。
   排行榜：mode = classic，比載送人數。 */
(function () {
  'use strict';
  var GAME = 'metro', $ = K.$, L = K.L, W = 480, H = 660, MAPB = 566, CAP = 6, SPEED = 92, OVER = 25;
  var cv = $('cv'), ctx = FX.canvas(cv, W, H), hit = FX.Hit(cv, ctx), S = null, parts = FX.Parts(120), floats = FX.Floats();
  var COLS = ['#e11d48', '#2563eb', '#f59e0b', '#16a34a', '#9333ea'], bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H;
  (function () { var g = bgc.getContext('2d'); g.fillStyle = '#f3eee3'; g.fillRect(0, 0, W, H); g.strokeStyle = '#bcdcf0'; g.lineWidth = 46; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-20, 150); g.bezierCurveTo(140, 110, 170, 300, 300, 320); g.bezierCurveTo(400, 335, 420, 470, 510, 500); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.03)'; g.lineWidth = 1; for (var i = 0; i < W; i += 30) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, MAPB); g.stroke(); } for (i = 0; i < MAPB; i += 30) { g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); } g.fillStyle = '#1a2130'; g.fillRect(0, MAPB, W, H - MAPB); })();

  function reset() {
    S = { run: false, over: false, started: false, st: [], lines: [], t: 0, score: 0, sel: 0, nLines: 3, tokens: 0, spawnT: 2, stT: 12, dirty: true, dist: {}, drag: null, ptr: null, dead: null, deadT: 0, given: 0 };
    for (var i = 0; i < 5; i++) S.lines.push({ path: [], trains: [] });
    addStation(0, 240 - 80, 300 + 40); addStation(1, 240 + 70, 300 + 70); addStation(2, 240 + 10, 300 - 80);
    parts.clear(); floats.clear(); hud();
  }
  function hud() { $('score').textContent = S.score; $('stn').textContent = S.st.length; var t = Math.floor(S.t); $('time').textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + t % 60; }
  function start() { reset(); S.run = true; S.started = true; $('cover').classList.add('off'); K.close('ovEnd'); if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); }
  function addStation(sh, x, y) {
    if (x == null) { var n = S.st.length, m = Math.max(40, 150 - n * 12), ok = false, tries = 0; while (!ok && tries++ < 300) { x = m + Math.random() * (W - m * 2); y = Math.max(46, m * 1.1) + Math.random() * (MAPB - 40 - Math.max(46, m * 1.1) - Math.max(0, m - 40)); ok = S.st.every(function (s) { return Math.hypot(s.x - x, s.y - y) > 74; }); } if (!ok) return; var r = Math.random(); sh = n === 8 ? 3 : r < 0.45 ? 0 : r < 0.75 ? 1 : 2; }
    S.st.push({ id: S.st.length, x: x, y: y, sh: sh, wait: [], over: 0, born: 0 }); S.dirty = true; if (S.run) { K.beep(700, 0.1, 'sine', 0.05, 1000); }
  }
  function bfs() {
    var adj = S.st.map(function () { return []; }); S.lines.forEach(function (l) { for (var i = 0; i + 1 < l.path.length; i++) { adj[l.path[i]].push(l.path[i + 1]); adj[l.path[i + 1]].push(l.path[i]); } });
    S.dist = {}; for (var sh = 0; sh < 4; sh++) { var d = S.st.map(function (s) { return s.sh === sh ? 0 : 1e9; }), q = []; S.st.forEach(function (s) { if (s.sh === sh) q.push(s.id); }); while (q.length) { var u = q.shift(); adj[u].forEach(function (v) { if (d[v] > d[u] + 1) { d[v] = d[u] + 1; q.push(v); } }); } S.dist[sh] = d; } S.dirty = false;
  }
  function lineBest(l, dst, except) { var b = 1e9; l.path.forEach(function (id) { if (id !== except) b = Math.min(b, S.dist[dst][id]); }); return b; }
  function extend(k, from, to) { // 從 from（必須是端點或空線）延伸到 to
    var l = S.lines[k], p = l.path; if (from === to || p.indexOf(to) >= 0) return false;
    if (!p.length) { p.push(from, to); l.trains.push({ node: 0, dir: 1, d: 0, dwell: 0.3, pax: [] }); }
    else if (p[p.length - 1] === from) p.push(to);
    else if (p[0] === from) { p.unshift(to); l.trains.forEach(function (t) { t.node++; }); }
    else return false;
    S.dirty = true; K.beep(520 + k * 60, 0.07, 'triangle', 0.05, 800); return true;
  }
  function clearLine(k) { var l = S.lines[k]; if (!l.path.length) return; l.trains.forEach(function (t) { var s = S.st[l.path[FX.clamp(t.node, 0, l.path.length - 1)]]; t.pax.forEach(function (p) { s.wait.push(p); }); }); if (l.trains.length > 1) S.tokens += l.trains.length - 1; l.path = []; l.trains = []; S.dirty = true; K.beep(240, 0.12, 'sawtooth', 0.04, 120); }
  function pickLine(from) { // 拖曳起點決定用哪條線
    var cur = S.lines[S.sel].path; if (!cur.length || cur[0] === from || cur[cur.length - 1] === from) return S.sel;
    for (var k = 0; k < S.nLines; k++) if (!S.lines[k].path.length) return k;
    for (k = 0; k < S.nLines; k++) { var p = S.lines[k].path; if (p[0] === from || p[p.length - 1] === from) return k; }
    return -1;
  }
  function stationAt(p, r) { for (var i = 0; i < S.st.length; i++) if (Math.hypot(S.st[i].x - p.x, S.st[i].y - p.y) < (r || 26)) return S.st[i]; return null; }
  hit.miss = function (p) { if (!S.run || p.y > MAPB) return; var s = stationAt(p); if (!s) return; var k = pickLine(s.id); if (k < 0) { K.toast(L('沒有空的線了：從線的端點拉，或按 ✕ 拆一條', 'No free line: drag from a line end, or tap ✕ to remove one')); return; } S.sel = k; S.drag = { from: s.id, k: k }; S.ptr = p; };
  hit.move = function (p) { if (!S.drag) return; S.ptr = p; var s = stationAt(p, 22); if (s && s.id !== S.drag.from) { if (extend(S.drag.k, S.drag.from, s.id)) S.drag.from = s.id; } };
  hit.up = function () { if (S) S.drag = null; };
  function arrive(l, t, s) {
    var keep = [], out = 0; t.pax.forEach(function (p) { if (p.dst === s.sh) { S.score++; out++; } else if (lineBest(l, p.dst, -1) >= 1e9 || (lineBest(l, p.dst, -1) >= S.dist[p.dst][s.id] && S.dist[p.dst][s.id] > 0)) s.wait.push(p); else keep.push(p); }); t.pax = keep;
    if (out) { floats.add(s.x, s.y - 26, '+' + out, '#16a34a', 16); K.beep(980, 0.05, 'sine', 0.04); reward(); }
    for (var i = 0; i < s.wait.length && t.pax.length < CAP;) { var p = s.wait[i]; if (lineBest(l, p.dst, s.id) < S.dist[p.dst][s.id]) { t.pax.push(p); s.wait.splice(i, 1); } else i++; }
    t.dwell = 0.45; hud();
  }
  function reward() { var a = [[30, 'l'], [50, 't'], [80, 'l'], [120, 't'], [200, 't'], [300, 't']]; while (S.given < a.length && S.score >= a[S.given][0]) { if (a[S.given][1] === 'l') { S.nLines++; floats.add(W / 2, 200, L('🎉 新路線解鎖！', '🎉 New line unlocked!'), '#2563eb', 20); } else { S.tokens++; floats.add(W / 2, 200, L('🚆 獲得加開列車！點下方的線', '🚆 Extra train! Tap a line below'), '#e11d48', 17); } FX.sfx.great(); S.given++; } }
  function addTrain(k) { var l = S.lines[k]; if (S.tokens <= 0 || l.path.length < 2 || l.trains.length >= 3) return false; S.tokens--; l.trains.push({ node: l.path.length - 1, dir: -1, d: 0, dwell: 0.3, pax: [] }); FX.sfx.good(); return true; }
  function tapLine(k) { if (!S.run || k >= S.nLines) return; if (S.sel === k && S.tokens > 0 && addTrain(k)) return; S.sel = k; K.beep(600, 0.04, 'triangle', 0.03); }
  function step(dt) {
    parts.step(dt); floats.step(dt); S.st.forEach(function (s) { if (s.born < 1) s.born = Math.min(1, s.born + dt * 3); });
    if (S.dead) { S.deadT += dt; if (S.deadT > 1.6 && !S.over) end(); return; }
    if (!S.run) return; S.t += dt; if (S.dirty) bfs();
    S.stT -= dt; if (S.stT <= 0 && S.st.length < 16) { addStation(); S.stT = 12 + S.st.length * 0.9; }
    S.spawnT -= dt; if (S.spawnT <= 0) { S.spawnT = 3.0 / Math.pow(1 + S.t / 50, 1.34) * (0.7 + Math.random() * 0.6); var s = FX.pick(S.st), shapes = []; S.st.forEach(function (o) { if (o.sh !== s.sh) shapes.push(o.sh); }); if (shapes.length) s.wait.push({ dst: FX.pick(shapes) }); }
    S.lines.forEach(function (l) {
      if (l.path.length < 2) return;
      l.trains.forEach(function (t) {
        t.node = FX.clamp(t.node, 0, l.path.length - 1); if (t.node + t.dir < 0 || t.node + t.dir >= l.path.length) t.dir = -t.dir;
        var a = S.st[l.path[t.node]], b = S.st[l.path[t.node + t.dir]], len = Math.hypot(b.x - a.x, b.y - a.y);
        if (t.dwell > 0) { t.dwell -= dt; t.x = a.x; t.y = a.y; t.ang = Math.atan2(b.y - a.y, b.x - a.x); return; }
        t.d += SPEED * dt; if (t.d >= len) { t.d = 0; t.node += t.dir; t.x = b.x; t.y = b.y; arrive(l, t, b); if (t.node + t.dir < 0 || t.node + t.dir >= l.path.length) t.dir = -t.dir; return; }
        var f = t.d / len; t.x = a.x + (b.x - a.x) * f; t.y = a.y + (b.y - a.y) * f; t.ang = Math.atan2(b.y - a.y, b.x - a.x);
      });
    });
    S.st.forEach(function (s2) { if (s2.wait.length > CAP) { s2.over += dt; if (s2.over >= OVER) { S.dead = s2; S.run = false; FX.sfx.crash(); } } else s2.over = Math.max(0, s2.over - dt * 2); });
    if (Math.floor(S.t) !== Math.floor(S.t - dt)) hud();
  }
  function end() {
    S.over = true; var b = FX.best('scmetro_best', S.score), t = Math.floor(S.t);
    $('endScore').textContent = S.score; $('endStn').textContent = S.st.length; $('endTime').textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + t % 60; $('endBest').textContent = b.isNew && S.score > 0 ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + b.best;
    K.open('ovEnd'); if (window.SC) SC.post('gameover', { game: GAME, score: S.score }); if (window.SCLB && S.score > 0) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: S.score + L(' 人', ' passengers') });
  }
  // ---------- 繪圖 ----------
  function shape(sh, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    if (sh === 0) ctx.arc(x, y, r, 0, 7); else if (sh === 1) { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); } else if (sh === 2) ctx.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76); else { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.55 : r * 1.25; if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function draw(time) {
    hit.begin(); ctx.drawImage(bgc, 0, 0, W, H); var i;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    S.lines.forEach(function (l, k) { if (l.path.length < 2) return; var off = (k - 2) * 2.6; ctx.strokeStyle = COLS[k]; ctx.lineWidth = 7; ctx.beginPath(); l.path.forEach(function (id, j) { var s = S.st[id]; if (j) ctx.lineTo(s.x + off, s.y + off); else ctx.moveTo(s.x + off, s.y + off); }); ctx.stroke(); [l.path[0], l.path[l.path.length - 1]].forEach(function (id) { var s = S.st[id]; ctx.fillStyle = COLS[k]; ctx.beginPath(); ctx.arc(s.x + off, s.y + off, 7, 0, 7); ctx.fill(); }); });
    if (S.drag && S.ptr) { var fs = S.st[S.drag.from]; ctx.strokeStyle = COLS[S.drag.k]; ctx.globalAlpha = 0.55; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(fs.x, fs.y); ctx.lineTo(S.ptr.x, S.ptr.y); ctx.stroke(); ctx.globalAlpha = 1; }
    S.lines.forEach(function (l, k) { l.trains.forEach(function (t) { if (t.x == null) return; ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang || 0); ctx.fillStyle = 'rgba(0,0,0,.2)'; FX.rr(ctx, -17, -9, 36, 22, 5); ctx.fill(); ctx.fillStyle = COLS[k]; FX.rr(ctx, -18, -11, 36, 22, 5); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); t.pax.forEach(function (p, j) { shape(p.dst, -11 + (j % 3) * 11, -5 + Math.floor(j / 3) * 10, 3.6, '#fff'); }); ctx.restore(); }); });
    S.st.forEach(function (s) {
      var r = 14 * FX.ease(s.born), full = s.wait.length > CAP;
      if (s.over > 0) { ctx.strokeStyle = 'rgba(220,38,38,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(s.x, s.y, 27, 0, 7); ctx.stroke(); ctx.strokeStyle = '#dc2626'; ctx.beginPath(); ctx.arc(s.x, s.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.over / OVER)); ctx.stroke(); }
      if (S.drag && s.id !== S.drag.from && S.lines[S.drag.k].path.indexOf(s.id) < 0) { ctx.strokeStyle = COLS[S.drag.k]; ctx.globalAlpha = 0.35 + Math.sin(time * 6) * 0.15; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, 22, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      shape(s.sh, s.x, s.y, r, '#fff', full && Math.floor(time * 4) % 2 ? '#dc2626' : '#1f2937', 4.5);
      s.wait.forEach(function (p, j) { if (j >= 12) return; shape(p.dst, s.x + 22 + (j % 4) * 10, s.y - 12 + Math.floor(j / 4) * 10, 3.8, j >= CAP ? '#dc2626' : '#374151'); });
    });
    if (S.dead) { var z = Math.min(1, S.deadT / 0.6); ctx.fillStyle = 'rgba(220,38,38,' + 0.25 * z + ')'; ctx.fillRect(0, 0, W, MAPB); ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(S.dead.x, S.dead.y, 30 + (1 - z) * 200, 0, 7); ctx.stroke(); }
    parts.draw(ctx); floats.draw(ctx);
    // 下方線路列
    for (i = 0; i < 5; i++) { var bx = 6 + i * 94.5, l = S.lines[i], lock = i >= S.nLines; FX.button(ctx, bx, 574, 88, 52, '', { bg: lock ? '#3a4152' : '#243044', sel: S.sel === i && !lock, off: lock }); if (lock) { FX.text(ctx, '🔒 ' + (i === 3 ? 30 : 80), bx + 44, 600, 13, '#8a93a6'); continue; } ctx.fillStyle = COLS[i]; ctx.beginPath(); ctx.arc(bx + 20, 600, 11, 0, 7); ctx.fill(); FX.text(ctx, l.path.length ? l.path.length + L(' 站', ' stn') : L('未使用', 'Free'), bx + 58, 592, 11.5, '#fff'); FX.text(ctx, l.path.length ? '🚆×' + l.trains.length : '—', bx + 58, 610, 11, '#cbd5e1'); hit.add(bx, 574, 88, 52, tapLine, i); if (l.path.length) { FX.button(ctx, bx + 24, 630, 40, 24, '✕', { bg: '#7f1d1d', size: 13, r: 8 }); hit.add(bx + 14, 626, 60, 32, clearLine, i); } else if (S.sel === i) FX.text(ctx, L('拖曳車站', 'Drag stations'), bx + 44, 642, 10, '#93c5fd'); }
    if (S.tokens > 0 && S.run) { ctx.fillStyle = 'rgba(225,29,72,.92)'; FX.rr(ctx, 90, MAPB - 34, 300, 26, 13); ctx.fill(); FX.text(ctx, L('🚆 加開列車 ×', '🚆 Extra train ×') + S.tokens + L('：選好線再點一次', ': select a line, then tap it again'), W / 2, MAPB - 20.5, 12, '#fff'); }
    if (S.run && S.t < 14 && !S.lines.some(function (l2) { return l2.path.length; })) { var a = S.st[0], b = S.st[1], f = (time * 0.6) % 1; ctx.fillStyle = 'rgba(26,33,48,.9)'; FX.rr(ctx, 70, 46, 340, 30, 15); ctx.fill(); FX.text(ctx, L('從一個車站按住，拖到另一個車站', 'Press on a station and drag to another'), W / 2, 61.5, 13.5, '#fff'); FX.text(ctx, '👆', a.x + (b.x - a.x) * f + 6, a.y + (b.y - a.y) * f + 16, 26); }
  }
  $('bStart').onclick = start; $('bAgain').onclick = start; $('bNew').onclick = function () { if (FX.again(S)) start(); };
  FX.sound(); reset(); FX.loop(step, draw);
  if (location.hash.indexOf('#test') === 0) window.__mt = { S: function () { return S; }, go: start, extend: extend, step: step, clear: clearLine, addTrain: addTrain };
})();
