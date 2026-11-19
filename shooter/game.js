/* 太空射擊 — stockcorp.github.io/shooter/
   邏輯 480×720；拖曳（相對位移）或方向鍵移動、自動開火；波次遞增，每 5 波一隻魔王。
   道具：⚡ 火力、🛡 護盾、💥 清彈。排行榜：classic，分數越高越好。 */
(function () {
  'use strict';
  var GAME = 'shooter', $ = K.$, L = K.L, W = 480, H = 720;
  var cv = $('cv'), ctx = cv.getContext('2d'), S = null, raf = 0, last = 0, keys = {};
  var stars = []; for (var i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 1.2 });

  function newGame() {
    S = { score: 0, wave: 0, lives: 3, x: W / 2, y: H - 90, pow: 1, shield: 0, inv: 2, cool: 0, bul: [], eb: [], en: [], drops: [], parts: [], over: false, started: false, waveT: 0, spawnQ: [], boss: null };
    K.close('ovEnd'); hud(); nextWave();
    if (window.SCLB) SCLB.start(GAME, 'classic'); if (window.SC) SC.post('start', { game: GAME }); S.started = true;
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function hud() { $('score').textContent = S.score.toLocaleString(); $('wave').textContent = Math.max(1, S.wave); $('lives').textContent = S.lives > 5 ? '🚀×' + S.lives : '🚀'.repeat(Math.max(0, S.lives)); }
  function nextWave() {
    S.wave++; hud();
    var w = S.wave;
    $('msg').textContent = w % 5 === 0 ? L('⚠️ 魔王來襲！', '⚠️ Boss incoming!') : L('第 ' + w + ' 波', 'Wave ' + w);
    setTimeout(function () { if (S && !S.over) $('msg').textContent = ''; }, 1400);
    S.spawnQ = [];
    if (w % 5 === 0) { S.spawnQ.push({ t: 1.4, boss: true }); return; }
    var n = 6 + Math.min(18, w * 2), t = 1.2;
    for (var k = 0; k < n; k++) {
      var r = Math.random(), type = w >= 3 && r < 0.25 ? 'gun' : w >= 2 && r < 0.55 ? 'sine' : 'dive';
      if (w >= 4 && r > 0.9) type = 'tank';
      S.spawnQ.push({ t: t, type: type, x: 40 + Math.random() * (W - 80) }); t += Math.max(0.22, 0.75 - w * 0.04);
    }
  }
  function spawn(q) {
    var w = S.wave;
    if (q.boss) { var hp = 120 + w * 40; S.boss = { x: W / 2, y: -80, hp: hp, max: hp, t: 0, r: 56, boss: true }; S.en.push(S.boss); return; }
    var e = { type: q.type, x: q.x, y: -30, x0: q.x, t: 0, r: 16, hp: 1, vy: 120 + w * 8, fire: 1 + Math.random() * 2 };
    if (q.type === 'gun') { e.hp = 3; e.vy = 70; e.r = 18; }
    if (q.type === 'tank') { e.hp = 10; e.vy = 45; e.r = 26; }
    if (q.type === 'sine') { e.hp = 2; }
    S.en.push(e);
  }

  function loop(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    stars.forEach(function (s) { s.y += s.z * 60 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    if (!S.over) step(dt);
    draw(); raf = requestAnimationFrame(loop);
  }
  function fire() {
    var p = S.pow, mk = function (dx, vx) { S.bul.push({ x: S.x + dx, y: S.y - 22, vx: vx, vy: -720 }); };
    mk(0, 0);
    if (p >= 2) { mk(-10, 0); mk(10, 0); S.bul.shift(); }
    if (p >= 3) { mk(-14, -120); mk(14, 120); }
    if (p >= 4) { mk(0, 0); }
    if (p >= 5) { mk(-20, -240); mk(20, 240); }
    S.cool = 0.11;
    if (Math.random() < 0.3) K.beep(1200, 0.015, 'square', 0.008);
  }
  function step(dt) {
    var sp = 360; if (keys.L) S.x -= sp * dt; if (keys.R) S.x += sp * dt; if (keys.U) S.y -= sp * dt; if (keys.D) S.y += sp * dt;
    S.x = Math.max(18, Math.min(W - 18, S.x)); S.y = Math.max(60, Math.min(H - 30, S.y));
    S.inv = Math.max(0, S.inv - dt);
    S.cool -= dt; if (S.cool <= 0) fire();
    S.waveT += dt;
    while (S.spawnQ.length && S.spawnQ[0].t <= S.waveT) spawn(S.spawnQ.shift());
    if (!S.spawnQ.length && !S.en.length) { S.waveT = 0; nextWave(); }
    S.bul.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; }); S.bul = S.bul.filter(function (b) { return b.y > -20 && b.x > -20 && b.x < W + 20; });
    S.eb.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; }); S.eb = S.eb.filter(function (b) { return b.y < H + 20 && b.y > -40 && b.x > -20 && b.x < W + 20; });
    S.en.forEach(function (e) {
      e.t += dt;
      if (e.boss) {
        e.y += (110 - e.y) * Math.min(1, dt * 1.2); e.x = W / 2 + Math.sin(e.t * 0.8) * 150;
        e.fire -= dt; if (e.fire === undefined || isNaN(e.fire)) e.fire = 1;
        if (e.fire <= 0) { var ph = e.hp / e.max; e.fire = ph < 0.4 ? 0.55 : 0.85; var n = ph < 0.4 ? 14 : 10, off = e.t;
          for (var k = 0; k < n; k++) { var a = Math.PI / 2 + (k - (n - 1) / 2) * 0.17 + Math.sin(off) * 0.2; S.eb.push({ x: e.x, y: e.y + 30, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 }); } }
        return;
      }
      e.y += e.vy * dt;
      if (e.type === 'sine') e.x = e.x0 + Math.sin(e.t * 3) * 70;
      if (e.type === 'dive' && e.y > 120) e.x += Math.sign(S.x - e.x) * 60 * dt;
      if (e.type === 'gun' || e.type === 'tank') { e.fire -= dt; if (e.fire <= 0 && e.y > 0 && e.y < H * 0.7) { e.fire = e.type === 'tank' ? 1.1 : 1.8; var a = Math.atan2(S.y - e.y, S.x - e.x), v = 200 + S.wave * 6; S.eb.push({ x: e.x, y: e.y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); if (e.type === 'tank') { S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a - 0.3) * v, vy: Math.sin(a - 0.3) * v }); S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a + 0.3) * v, vy: Math.sin(a + 0.3) * v }); } } }
    });
    // 子彈打敵人
    S.bul = S.bul.filter(function (b) {
      for (var k = 0; k < S.en.length; k++) { var e = S.en[k]; if ((b.x - e.x) * (b.x - e.x) + (b.y - e.y) * (b.y - e.y) < (e.r + 4) * (e.r + 4)) { e.hp--; e.flash = 0.06; if (e.hp <= 0) kill(e); return false; } }
      return true;
    });
    S.en = S.en.filter(function (e) { if (e.flash) e.flash = Math.max(0, e.flash - dt); return e.hp > 0 && e.y < H + 40; });
    // 道具
    S.drops.forEach(function (d) { d.y += 110 * dt; });
    S.drops = S.drops.filter(function (d) { if (Math.abs(d.x - S.x) < 26 && Math.abs(d.y - S.y) < 26) { power(d.k); return false; } return d.y < H + 20; });
    S.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); S.parts = S.parts.filter(function (p) { return p.t > 0; });
    // 被打
    if (S.inv <= 0) {
      var hit = S.eb.some(function (b, k) { if ((b.x - S.x) * (b.x - S.x) + (b.y - S.y) * (b.y - S.y) < 100) { S.eb.splice(k, 1); return true; } return false; })
        || S.en.some(function (e) { if ((e.x - S.x) * (e.x - S.x) + (e.y - S.y) * (e.y - S.y) < (e.r + 10) * (e.r + 10)) { if (!e.boss) { e.hp = 0; boom(e.x, e.y, '#f97316', 14); } return true; } return false; });
      if (hit) hurt();
    }
  }
  function kill(e) {
    var pts = e.boss ? 2000 * Math.ceil(S.wave / 5) : e.type === 'tank' ? 150 : e.type === 'gun' ? 60 : e.type === 'sine' ? 40 : 25;
    S.score += pts; hud();
    boom(e.x, e.y, e.boss ? '#facc15' : '#fb923c', e.boss ? 60 : 14);
    K.beep(e.boss ? 80 : 200 + Math.random() * 100, e.boss ? 0.8 : 0.12, 'sawtooth', e.boss ? 0.09 : 0.04, 50);
    if (e.boss) { S.boss = null; S.eb = []; S.drops.push({ x: e.x, y: e.y, k: 'pow' }); S.drops.push({ x: e.x - 40, y: e.y, k: 'shield' }); return; }
    var r = Math.random(), ch = e.type === 'tank' ? 0.6 : 0.07;
    if (r < ch) { var ks = ['pow', 'pow', 'pow', 'shield', 'bomb']; S.drops.push({ x: e.x, y: e.y, k: ks[(Math.random() * ks.length) | 0] }); }
  }
  function boom(x, y, c, n) { for (var k = 0; k < n; k++) { var a = Math.random() * 7, v = 40 + Math.random() * 200; S.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.3 + Math.random() * 0.4, c: c }); } }
  function power(k) {
    K.beep(880, 0.12, 'sine', 0.05, 1320);
    if (k === 'pow') { if (S.pow < 5) S.pow++; else S.score += 200; K.toast(L('火力 Lv.', 'Power Lv.') + S.pow, 800); }
    else if (k === 'shield') { S.shield = 1; K.toast(L('護盾！', 'Shield!'), 800); }
    else { S.eb = []; S.en.forEach(function (e) { if (!e.boss) { e.hp -= 3; if (e.hp <= 0) kill(e); } }); K.toast(L('清除！', 'Blast!'), 800); }
    hud();
  }
  function hurt() {
    if (S.shield) { S.shield = 0; S.inv = 1; K.beep(400, 0.15, 'square', 0.04); return; }
    S.lives--; S.inv = 2.2; S.pow = Math.max(1, S.pow - 1); S.eb = [];
    boom(S.x, S.y, '#38bdf8', 30); K.beep(120, 0.5, 'sawtooth', 0.08, 40); navigator.vibrate && navigator.vibrate([80, 40, 80]);
    hud(); if (S.lives <= 0) gameOver();
  }
  function gameOver() {
    S.over = true;
    var best = K.load('scshoot_best', 0), nb = S.score > best; if (nb) K.save('scshoot_best', S.score);
    $('endScore').textContent = S.score.toLocaleString(); $('endWave').textContent = S.wave;
    $('endBest').textContent = nb ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + best.toLocaleString();
    if (window.SC) SC.post('gameover', { game: GAME, score: S.score });
    setTimeout(function () { K.open('ovEnd'); if (S.score > 0 && window.SCLB) SCLB.offer({ game: GAME, mode: 'classic', score: S.score, text: L('第 ', 'Wave ') + S.wave + L(' 波', '') }); }, 900);
  }

  // ---------- 畫面 ----------
  function ship(x, y, blink) {
    if (blink) return;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(-6, 16); ctx.lineTo(0, 26 + Math.random() * 8); ctx.lineTo(6, 16); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(8, -4); ctx.lineTo(20, 10); ctx.lineTo(20, 16); ctx.lineTo(-20, 16); ctx.lineTo(-20, 10); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.ellipse(0, -4, 5, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#64748b'; ctx.fillRect(-20, 8, 5, 10); ctx.fillRect(15, 8, 5, 10);
    ctx.restore();
  }
  function enemy(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    var c = e.flash ? '#fff' : e.boss ? '#a855f7' : e.type === 'tank' ? '#64748b' : e.type === 'gun' ? '#ef4444' : e.type === 'sine' ? '#22c55e' : '#f59e0b';
    ctx.fillStyle = c;
    if (e.boss) {
      ctx.beginPath(); ctx.moveTo(-60, -20); ctx.lineTo(-30, -36); ctx.lineTo(30, -36); ctx.lineTo(60, -20); ctx.lineTo(48, 24); ctx.lineTo(16, 38); ctx.lineTo(-16, 38); ctx.lineTo(-48, 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, 4, 12, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(60, 14, W - 120, 8); ctx.fillStyle = '#e879f9'; ctx.fillRect(60, 14, (W - 120) * e.hp / e.max, 8);
      return;
    }
    var r = e.r;
    ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.4); ctx.lineTo(r * 0.5, -r); ctx.lineTo(-r * 0.5, -r); ctx.lineTo(-r, -r * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.32, 0, 7); ctx.fill();
    ctx.restore();
  }
  function draw() {
    ctx.fillStyle = '#02050d'; ctx.fillRect(0, 0, W, H);
    stars.forEach(function (s) { ctx.fillStyle = 'rgba(255,255,255,' + (s.z * 0.55) + ')'; ctx.fillRect(s.x, s.y, s.z * 1.6, s.z * 1.6); });
    if (!S) return;
    S.en.forEach(enemy);
    ctx.fillStyle = '#7dd3fc'; S.bul.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y - 8, 3, 12); });
    ctx.fillStyle = '#f472b6'; S.eb.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, 7); ctx.fill(); });
    ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    S.drops.forEach(function (d) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(d.x, d.y, 15, 0, 7); ctx.fill(); ctx.fillText(d.k === 'pow' ? '⚡' : d.k === 'shield' ? '🛡' : '💥', d.x, d.y + 1); });
    S.parts.forEach(function (p) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }); ctx.globalAlpha = 1;
    if (!S.over) {
      ship(S.x, S.y, S.inv > 0 && Math.floor(S.inv * 12) % 2 === 0);
      if (S.shield) { ctx.strokeStyle = 'rgba(56,189,248,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S.x, S.y, 28, 0, 7); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.fillText('⚡Lv.' + S.pow, 8, H - 12);
  }

  // ---------- 輸入：相對拖曳 ----------
  var drag = null;
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  cv.addEventListener('pointerdown', function (e) { if (!S || S.over) return; var p = pt(e); drag = { px: p.x, py: p.y, sx: S.x, sy: S.y }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', function (e) { if (!drag || !S || S.over) return; var p = pt(e); S.x = drag.sx + (p.x - drag.px) * 1.15; S.y = drag.sy + (p.y - drag.py) * 1.15; });
  cv.addEventListener('pointerup', function () { drag = null; }); cv.addEventListener('pointercancel', function () { drag = null; });
  var KM = { ArrowLeft: 'L', a: 'L', ArrowRight: 'R', d: 'R', ArrowUp: 'U', w: 'U', ArrowDown: 'D', s: 'D' };
  document.addEventListener('keydown', function (e) { if (K.isOpen && K.isOpen()) return; var k = KM[e.key]; if (k) { keys[k] = 1; e.preventDefault(); } });
  document.addEventListener('keyup', function (e) { var k = KM[e.key]; if (k) keys[k] = 0; });
  $('bNew').onclick = function () {
    if (S && !S.over && S.score > 0 && !(Date.now() - (S.ask || 0) < 2500)) { S.ask = Date.now(); K.toast(L('再按一次放棄這局', 'Tap again to abandon this game')); return; }
    newGame();
  };
  $('bAgain').onclick = newGame;
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  if (location.hash.indexOf('#test') === 0) window.__sh = { S: function () { return S; }, hurt: hurt, wave: function (n) { S.wave = n - 1; S.en = []; S.spawnQ = []; S.waveT = 0; nextWave(); } };
  // 第一次進來先顯示開始提示，點一下才開始（避免一進頁面就被打）
  S = { score: 0, wave: 1, lives: 3, x: W / 2, y: H - 90, pow: 1, shield: 0, inv: 0, bul: [], eb: [], en: [], drops: [], parts: [], over: true };
  $('msg').textContent = L('點一下開始', 'Tap to start');
  cv.addEventListener('pointerdown', function first(e) { cv.removeEventListener('pointerdown', first); if (S.over && !S.started) { newGame(); var p = pt(e); drag = { px: p.x, py: p.y, sx: S.x, sy: S.y }; } });
  document.addEventListener('keydown', function firstK(e) { if (KM[e.key] || e.key === ' ') { document.removeEventListener('keydown', firstK); if (S.over && !S.started) newGame(); } });
  last = performance.now(); raf = requestAnimationFrame(loop);
})();
