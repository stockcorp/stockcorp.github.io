/* 坦克大戰 — stockcorp.github.io/tank/
   13×13 格、每格 40（邏輯 520×520）。地形：1 磚、2 鋼、3 水、4 草。基地在最下排中央。
   每關 12 輛敵軍（畫面上最多 4 輛），第 2 關起有要打兩下的裝甲車。排行榜：mode = classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'tank', $ = K.$, L = K.L, N = 13, T = 40, W = N * T;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, keys = {}, held = -1;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], BASE = [6, 12];
  function newGame() { S = { score: 0, stage: 0, lives: 3, over: false, started: false }; K.close('ovEnd'); nextStage(); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); }
  function genMap() {
    var m = [];
    for (var y = 0; y < N; y++) { m.push(new Array(N).fill(0)); }
    // 左右對稱亂數地形
    for (y = 1; y < N - 1; y++) for (var x = 0; x <= 6; x++) {
      var r = Math.random(), v = r < 0.36 ? 1 : r < 0.42 ? 2 : r < 0.47 ? 3 : r < 0.53 ? 4 : 0;
      if (y >= 10 && v === 3) v = 0;
      m[y][x] = v; m[y][N - 1 - x] = v;
    }
    // 出生點與基地周圍淨空
    [[0, 0], [6, 0], [12, 0], [4, 12], [8, 12]].forEach(function (p) { m[p[1]][p[0]] = 0; if (p[1] + 1 < N) m[p[1] + 1][p[0]] = m[p[1] + 1][p[0]] === 3 ? 0 : m[p[1] + 1][p[0]]; });
    m[0] = new Array(N).fill(0);
    m[12][6] = 0; [[5, 12], [5, 11], [6, 11], [7, 11], [7, 12]].forEach(function (p) { m[p[1]][p[0]] = 1; });
    m[12][4] = 0; m[12][8] = 0; m[11][4] = 0; m[11][8] = 0;
    return m;
  }
  function nextStage() {
    S.stage++; S.map = genMap(); S.bul = []; S.foes = []; S.left = 12; S.spawnT = 1; S.boom = []; S.clear = 0;
    S.me = { x: 4 * T, y: 12 * T, d: 0, cool: 0, me: true, shield: 3 };
    $('stage').textContent = S.stage; msg(L('第 ' + S.stage + ' 關', 'Stage ' + S.stage), 1500); hud();
  }
  function msg(t, ms) { $('msg').textContent = t; if (ms) setTimeout(function () { if ($('msg').textContent === t) $('msg').textContent = ''; }, ms); }
  function hud() { $('score').textContent = S.score.toLocaleString(); $('foes').textContent = S.left + S.foes.length; $('lives').textContent = '❤️'.repeat(Math.max(0, S.lives)); }
  function solid(px, py, sz, who) {
    if (px < 0 || py < 0 || px + sz > W || py + sz > W) return true;
    for (var y = Math.floor(py / T); y <= Math.floor((py + sz - 1) / T); y++) for (var x = Math.floor(px / T); x <= Math.floor((px + sz - 1) / T); x++) { var v = S.map[y][x]; if (v === 1 || v === 2 || v === 3) return true; if (x === BASE[0] && y === BASE[1]) return true; }
    var all = S.foes.concat([S.me]);
    for (var i = 0; i < all.length; i++) { var o = all[i]; if (o === who || o.dead) continue; if (px < o.x + T - 4 && px + sz > o.x + 2 && py < o.y + T - 4 && py + sz > o.y + 2) return true; }
    return false;
  }
  function moveTank(t, d, sp) {
    t.d = d;
    // 轉彎時對齊半格，比較好鑽進路口
    if (d % 2 === 0) t.x = Math.round(t.x / (T / 2)) * (T / 2); else t.y = Math.round(t.y / (T / 2)) * (T / 2);
    var nx = t.x + DX[d] * sp, ny = t.y + DY[d] * sp;
    if (!solid(nx + 3, ny + 3, T - 6, t)) { t.x = nx; t.y = ny; return true; }
    return false;
  }
  function fire(t) {
    if (t.cool > 0) return; t.cool = t.me ? 0.38 : 1.1 + Math.random() * 0.8;
    if (S.bul.some(function (b) { return b.own === t; })) return;
    S.bul.push({ x: t.x + T / 2 + DX[t.d] * T / 2, y: t.y + T / 2 + DY[t.d] * T / 2, d: t.d, own: t, me: !!t.me });
    if (t.me) K.beep(300, 0.05, 'square', 0.03);
  }
  function spawn() {
    if (S.left <= 0 || S.foes.length >= 4) return;
    var spots = [0, 6, 12].map(function (x) { return x * T; }).filter(function (x) { return !solid(x + 3, 3, T - 6, null); });
    if (!spots.length) return;
    var arm = S.stage >= 2 && Math.random() < Math.min(0.5, 0.15 * S.stage);
    S.foes.push({ x: spots[(Math.random() * spots.length) | 0], y: 0, d: 2, cool: 1, hp: arm ? 2 : 1, arm: arm, turn: 0.5 + Math.random() });
    S.left--; hud();
  }
  function loop(t) { var dt = Math.min(0.033, (t - last) / 1000); last = t; if (!S.over) step(dt); draw(); raf = requestAnimationFrame(loop); }
  function step(dt) {
    var me = S.me;
    if (!me.dead) {
      me.cool -= dt; me.shield = Math.max(0, me.shield - dt);
      var d = held >= 0 ? held : keys.ArrowUp ? 0 : keys.ArrowRight ? 1 : keys.ArrowDown ? 2 : keys.ArrowLeft ? 3 : -1;
      if (d >= 0) { moveTank(me, d, 120 * dt); if (!S.started) { S.started = true; if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); } }
      if (keys[' '] || keys.fire) fire(me);
    } else { me.respawn -= dt; if (me.respawn <= 0 && S.lives > 0) { S.me = { x: 4 * T, y: 12 * T, d: 0, cool: 0, me: true, shield: 3 }; } }
    S.spawnT -= dt; if (S.spawnT <= 0) { spawn(); S.spawnT = 2.6; }
    var sp = 70 + Math.min(40, S.stage * 6);
    S.foes.forEach(function (f) {
      f.cool -= dt; f.turn -= dt;
      if (!moveTank(f, f.d, sp * dt) || f.turn <= 0) {
        f.turn = 0.6 + Math.random() * 1.8;
        var r = Math.random(), tx = BASE[0] * T - f.x, ty = BASE[1] * T - f.y;
        f.d = r < 0.4 ? (Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 1 : 3) : 2) : r < 0.55 && !S.me.dead ? (Math.abs(S.me.x - f.x) > Math.abs(S.me.y - f.y) ? (S.me.x > f.x ? 1 : 3) : (S.me.y > f.y ? 2 : 0)) : (Math.random() * 4) | 0;
      }
      if (Math.random() < 0.02 + S.stage * 0.004) fire(f);
    });
    // 子彈
    for (var i = S.bul.length - 1; i >= 0; i--) {
      var b = S.bul[i]; b.x += DX[b.d] * 330 * dt; b.y += DY[b.d] * 330 * dt;
      var gone = false, cx = Math.floor(b.x / T), cy = Math.floor(b.y / T);
      if (b.x < 0 || b.y < 0 || b.x >= W || b.y >= W) gone = true;
      else {
        var v = S.map[cy][cx];
        if (cx === BASE[0] && cy === BASE[1]) { gone = true; boom(b.x, b.y, 30); return lose(L('基地被摧毀了！', 'Your base was destroyed!')); }
        if (v === 1) { S.map[cy][cx] = 0; gone = true; boom(b.x, b.y, 8); K.beep(160, 0.06, 'square', 0.03); }
        else if (v === 2) { gone = true; boom(b.x, b.y, 5); }
      }
      if (!gone) {
        if (b.me) { for (var k = 0; k < S.foes.length; k++) { var f = S.foes[k]; if (b.x > f.x + 2 && b.x < f.x + T - 2 && b.y > f.y + 2 && b.y < f.y + T - 2) { gone = true; f.hp--; boom(b.x, b.y, 10); if (f.hp <= 0) { f.dead = true; S.score += f.arm ? 200 : 100; boom(f.x + T / 2, f.y + T / 2, 26); K.beep(120, 0.3, 'sawtooth', 0.06, 50); hud(); } else K.beep(500, 0.05, 'square', 0.03); break; } } }
        else if (!S.me.dead && b.x > S.me.x + 2 && b.x < S.me.x + T - 2 && b.y > S.me.y + 2 && b.y < S.me.y + T - 2) { gone = true; if (!S.me.shield) hitMe(); }
        // 子彈互相抵銷
        for (var j = 0; j < S.bul.length && !gone; j++) { var o = S.bul[j]; if (o !== b && o.me !== b.me && Math.abs(o.x - b.x) < 8 && Math.abs(o.y - b.y) < 8) { gone = true; o.dead = true; } }
      }
      if (gone) S.bul.splice(i, 1);
    }
    S.bul = S.bul.filter(function (b) { return !b.dead && !b.own.dead; });
    S.foes = S.foes.filter(function (f) { return !f.dead; });
    S.boom.forEach(function (x) { x.t -= dt; }); S.boom = S.boom.filter(function (x) { return x.t > 0; });
    if (!S.left && !S.foes.length && !S.clear) { S.clear = 1; S.score += 500; hud(); msg(L('過關！+500', 'Stage clear! +500'), 1500); K.beep(660, 0.4, 'triangle', 0.06, 1320); setTimeout(function () { if (!S.over) nextStage(); }, 1800); }
  }
  function boom(x, y, r) { S.boom.push({ x: x, y: y, r: r, t: 0.3 }); }
  function hitMe() {
    var me = S.me; me.dead = true; me.respawn = 1.5; S.lives--; boom(me.x + T / 2, me.y + T / 2, 30); hud();
    K.beep(90, 0.5, 'sawtooth', 0.08, 40); navigator.vibrate && navigator.vibrate([80, 40, 80]);
    if (S.lives <= 0) setTimeout(function () { lose(L('坦克全部被擊毀', 'All your tanks are destroyed')); }, 600);
  }
  function lose(t) {
    if (S.over) return; S.over = true; msg(t);
    var best = K.load('sctank_best', 0), nb = S.score > best; if (nb) K.save('sctank_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endStage').textContent = S.stage;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.started && S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: L('第 ', 'Stage ') + S.stage + L(' 關', '') }); }, 1000);
  }
  function tank(t, col, col2) {
    ctx.save(); ctx.translate(t.x + T / 2, t.y + T / 2); ctx.rotate(t.d * Math.PI / 2);
    ctx.fillStyle = '#1f2937'; ctx.fillRect(-17, -16, 8, 32); ctx.fillRect(9, -16, 8, 32);
    ctx.fillStyle = col; ctx.fillRect(-11, -12, 22, 26);
    ctx.fillStyle = col2; ctx.beginPath(); ctx.arc(0, 2, 8, 0, 7); ctx.fill(); ctx.fillRect(-2.5, -18, 5, 18);
    ctx.restore();
    if (t.shield) { ctx.strokeStyle = 'rgba(125,211,252,' + (0.5 + 0.4 * Math.sin(performance.now() / 60)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x + T / 2, t.y + T / 2, T * 0.58, 0, 7); ctx.stroke(); }
  }
  function draw() {
    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, W, W);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var v = S.map[y][x], px = x * T, py = y * T;
      if (v === 1) { ctx.fillStyle = '#b45309'; ctx.fillRect(px, py, T, T); ctx.fillStyle = '#7c2d12'; for (var r = 0; r < 4; r++) { ctx.fillRect(px, py + r * 10 + 9, T, 1); ctx.fillRect(px + (r % 2 ? 10 : 30), py + r * 10, 1, 10); } }
      else if (v === 2) { ctx.fillStyle = '#9ca3af'; ctx.fillRect(px, py, T, T); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(px + 6, py + 6, T - 12, T - 12); ctx.fillStyle = '#6b7280'; ctx.fillRect(px + 12, py + 12, T - 24, T - 24); }
      else if (v === 3) { ctx.fillStyle = '#1d4ed8'; ctx.fillRect(px, py, T, T); ctx.fillStyle = 'rgba(147,197,253,.5)'; var o = (performance.now() / 200 + x) % 4; ctx.fillRect(px + 4 + o * 4, py + 10, 10, 2); ctx.fillRect(px + 20 - o * 3, py + 26, 12, 2); }
    }
    ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.over && $('msg').textContent.indexOf(L('基地', 'base')) >= 0 ? '💥' : '💎', BASE[0] * T + T / 2, BASE[1] * T + T / 2 + 2);
    S.foes.forEach(function (f) { tank(f, f.arm ? (f.hp > 1 ? '#dc2626' : '#f87171') : '#d4d4d8', '#71717a'); });
    if (!S.me.dead) tank(S.me, '#facc15', '#a16207');
    ctx.fillStyle = '#fff'; S.bul.forEach(function (b) { ctx.fillRect(b.x - 3, b.y - 3, 6, 6); });
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (S.map[y][x] === 4) { ctx.fillStyle = 'rgba(22,163,74,.92)'; ctx.fillRect(x * T, y * T, T, T); ctx.fillStyle = '#15803d'; for (var g = 0; g < 4; g++) { ctx.beginPath(); ctx.arc(x * T + 8 + (g % 2) * 22, y * T + 10 + (g >> 1) * 20, 8, 0, 7); ctx.fill(); } }
    S.boom.forEach(function (b) { ctx.fillStyle = 'rgba(251,146,60,' + b.t * 3 + ')'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1.3 - b.t), 0, 7); ctx.fill(); });
  }
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) { e.preventDefault(); keys[e.key] = true; } });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });
  [].forEach.call(document.querySelectorAll('.dpad button'), function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); held = +b.dataset.d; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { if (held === +b.dataset.d) held = -1; }); }); });
  var fb = $('bFire'); fb.addEventListener('pointerdown', function (e) { e.preventDefault(); keys.fire = true; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { fb.addEventListener(n, function () { keys.fire = false; }); });
  $('bNew').onclick = function () { if (S && S.started && !S.over && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; } newGame(); };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); keys = {}; held = -1; });
  if (location.hash.indexOf('#test') === 0) window.__tk = { S: function () { return S; }, keys: keys, killAll: function () { S.left = 0; S.foes.forEach(function (f) { f.dead = true; }); }, hit: hitMe };
  newGame();
})();
