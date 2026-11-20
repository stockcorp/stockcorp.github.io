/* stockcorp.github.io 共用：遊戲特效與手感工具（51 號以後的競速、模擬經營遊戲使用）。放在 kit.js 之後載入。
   FX.canvas(cv,W,H)      高解析度畫布，回傳 ctx（之後一律用邏輯座標 W×H 畫）
   FX.loop(step,draw)     固定上限 dt 的遊戲迴圈；分頁切到背景自動暫停，回傳 {stop()}
   FX.Parts()             粒子：burst(x,y,n,{c,sp,life,g,size,up})、step(dt)、draw(ctx)
   FX.Floats()            漂浮文字：add(x,y,txt,color,size)
   FX.Shake()             畫面震動：kick(強度)、step(dt)、apply(ctx)
   FX.Engine()/FX.Noise() 持續音（引擎、胎噪、風聲）：set(頻率,音量)、stop()
   FX.keys                目前按住的方向：left/right/up/down/a/b（鍵盤與觸控按鈕共用）
   FX.pad(el,[...])       螢幕觸控按鈕
   FX.car(ctx,...)        俯視車輛；FX.rr 圓角矩形；FX.clamp/lerp/rnd/ease 小工具 */
(function () {
  'use strict';
  var FX = window.FX = {};
  FX.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  FX.lerp = function (a, b, t) { return a + (b - a) * t; };
  FX.rnd = function (a, b) { return a + Math.random() * (b - a); };
  FX.pick = function (a) { return a[(Math.random() * a.length) | 0]; };
  FX.ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  FX.fmt = function (n) { n = Math.round(n); return n.toLocaleString(); };
  FX.money = function (n) { var a = Math.abs(n); return (n < 0 ? '-' : '') + '$' + (a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (a / 1e3).toFixed(1) + 'K' : Math.round(a).toLocaleString()); };

  // ---------- 畫布 ----------
  FX.canvas = function (cv, W, H) {
    var ctx = cv.getContext('2d');
    function fit() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2.5, window.devicePixelRatio || 1), s = Math.max(0.5, Math.min(3, (r.width || W) * dpr / W));
      var w = Math.round(W * s), h = Math.round(H * s);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      ctx.setTransform(w / W, 0, 0, h / H, 0, 0); ctx.imageSmoothingQuality = 'high';
    }
    fit(); window.addEventListener('resize', fit); setTimeout(fit, 300);
    ctx.fit = fit;
    ctx.pt = function (e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    return ctx;
  };
  FX.rr = function (ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  FX.text = function (ctx, t, x, y, size, color, align, stroke) { ctx.font = '900 ' + size + 'px ui-rounded,"Segoe UI",system-ui,sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; if (stroke) { ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); } ctx.fillStyle = color || '#fff'; ctx.fillText(t, x, y); };

  // ---------- 迴圈 ----------
  FX.loop = function (step, draw) {
    var last = performance.now(), on = true, raf = 0, o = { paused: false, time: 0 };
    function f(t) {
      if (!on) return;
      var dt = Math.min(0.034, (t - last) / 1000); last = t;
      if (dt > 0 && !o.paused) { o.time += dt; step(dt, o.time); }
      draw(o.time); raf = requestAnimationFrame(f);
    }
    function vis() { last = performance.now(); }
    document.addEventListener('visibilitychange', vis);
    raf = requestAnimationFrame(f);
    o.stop = function () { on = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); };
    return o;
  };

  // ---------- 粒子 ----------
  FX.Parts = function (max) {
    var a = [], P = { list: a };
    P.add = function (p) { if (a.length < (max || 400)) a.push(p); };
    P.burst = function (x, y, n, o) {
      o = o || {};
      for (var i = 0; i < n; i++) {
        var ang = o.ang != null ? o.ang + FX.rnd(-(o.spread || 0.5), o.spread || 0.5) : Math.random() * 6.283, sp = FX.rnd((o.sp || 120) * 0.3, o.sp || 120), life = FX.rnd((o.life || 0.6) * 0.5, o.life || 0.6);
        P.add({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (o.up || 0), g: o.g == null ? 300 : o.g, t: life, life: life, c: Array.isArray(o.c) ? FX.pick(o.c) : (o.c || '#fff'), s: FX.rnd((o.size || 4) * 0.5, o.size || 4), round: o.round, fade: o.fade !== false, grow: o.grow || 0, drag: o.drag || 0 });
      }
    };
    P.step = function (dt) { for (var i = a.length - 1; i >= 0; i--) { var p = a[i]; p.t -= dt; if (p.t <= 0) { a.splice(i, 1); continue; } if (p.drag) { var k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.grow * dt; } };
    P.draw = function (ctx) {
      for (var i = 0; i < a.length; i++) { var p = a[i]; ctx.globalAlpha = p.fade ? Math.min(1, p.t / p.life * 1.6) : 1; ctx.fillStyle = p.c; if (p.round) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.3, p.s), 0, 6.3); ctx.fill(); } else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      ctx.globalAlpha = 1;
    };
    P.clear = function () { a.length = 0; };
    return P;
  };
  FX.Floats = function () {
    var a = [], F = {};
    F.add = function (x, y, txt, color, size) { a.push({ x: x, y: y, txt: txt, c: color || '#fff', s: size || 20, t: 1 }); if (a.length > 40) a.shift(); };
    F.step = function (dt) { for (var i = a.length - 1; i >= 0; i--) { a[i].t -= dt * 1.1; a[i].y -= 46 * dt; if (a[i].t <= 0) a.splice(i, 1); } };
    F.draw = function (ctx) { a.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.t * 2.2); var k = f.t > 0.85 ? 1 + (f.t - 0.85) * 3 : 1; FX.text(ctx, f.txt, f.x, f.y, f.s * k, f.c, 'center', 'rgba(0,0,0,.55)'); }); ctx.globalAlpha = 1; };
    F.clear = function () { a.length = 0; };
    return F;
  };
  FX.Shake = function () {
    var m = 0, S = { x: 0, y: 0 };
    S.kick = function (v) { m = Math.max(m, v); if (v >= 8 && navigator.vibrate && !K.muted) try { navigator.vibrate(Math.min(120, v * 6)); } catch (e) { /* 略過 */ } };
    S.step = function (dt) { m = Math.max(0, m - dt * 40 - m * dt * 6); S.x = (Math.random() - 0.5) * m * 2; S.y = (Math.random() - 0.5) * m * 2; };
    S.apply = function (ctx) { if (m > 0.1) ctx.translate(S.x, S.y); };
    return S;
  };

  // ---------- 聲音 ----------
  function AC() { if (K.muted) return null; try { var A = K._ac || (K._ac = new (window.AudioContext || window.webkitAudioContext)()); if (A.state === 'suspended') A.resume(); return A; } catch (e) { return null; } }
  FX.Engine = function (type) {
    var o1, o2, g, f, A, E = {};
    function mk() { A = AC(); if (!A) return false; o1 = A.createOscillator(); o2 = A.createOscillator(); g = A.createGain(); f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o1.type = type || 'sawtooth'; o2.type = 'square'; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(A.destination); o1.start(); o2.start(); return true; }
    E.set = function (freq, vol) {
      if (K.muted) { if (g) g.gain.value = 0; return; }
      if (!g && !mk()) return;
      var t = A.currentTime; o1.frequency.setTargetAtTime(freq, t, 0.04); o2.frequency.setTargetAtTime(freq * 0.502, t, 0.04); f.frequency.setTargetAtTime(500 + freq * 5, t, 0.05); g.gain.setTargetAtTime(vol, t, 0.05);
    };
    E.stop = function () { if (g) try { g.gain.setTargetAtTime(0, A.currentTime, 0.05); } catch (e) { /* 略過 */ } };
    return E;
  };
  FX.Noise = function (kind) {
    var src, g, f, A, N = {};
    function mk() { A = AC(); if (!A) return false; var len = A.sampleRate, buf = A.createBuffer(1, len, A.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; src = A.createBufferSource(); src.buffer = buf; src.loop = true; f = A.createBiquadFilter(); f.type = kind || 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8; g = A.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(A.destination); src.start(); return true; }
    N.set = function (vol, freq) { if (K.muted) { if (g) g.gain.value = 0; return; } if (vol <= 0.0005 && !g) return; if (!g && !mk()) return; var t = A.currentTime; g.gain.setTargetAtTime(vol, t, 0.05); if (freq) f.frequency.setTargetAtTime(freq, t, 0.05); };
    N.stop = function () { if (g) try { g.gain.setTargetAtTime(0, A.currentTime, 0.05); } catch (e) { /* 略過 */ } };
    return N;
  };
  // 幾個常用音效
  FX.sfx = {
    coin: function () { K.beep(988, 0.07, 'square', 0.04); setTimeout(function () { K.beep(1319, 0.14, 'square', 0.04); }, 60); },
    good: function () { K.beep(660, 0.1, 'triangle', 0.06, 990); },
    great: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { K.beep(f, 0.14, 'triangle', 0.06); }, i * 70); }); },
    bad: function () { K.beep(180, 0.25, 'sawtooth', 0.06, 90); },
    crash: function () { K.beep(110, 0.4, 'sawtooth', 0.09, 40); K.beep(70, 0.5, 'square', 0.06, 30); },
    tick: function () { K.beep(880, 0.03, 'square', 0.025); },
    click: function () { K.beep(520, 0.035, 'triangle', 0.04); },
    cash: function () { K.beep(1200, 0.05, 'square', 0.035); setTimeout(function () { K.beep(1600, 0.1, 'square', 0.035); }, 50); },
    go: function () { K.beep(1046, 0.4, 'square', 0.06); },
    beep3: function () { K.beep(523, 0.15, 'square', 0.05); }
  };

  // ---------- 輸入 ----------
  var keys = FX.keys = { left: 0, right: 0, up: 0, down: 0, a: 0, b: 0 };
  var KM = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'a', Enter: 'a', Shift: 'b', x: 'b', X: 'b' };
  FX.onKey = null; // function(name, down)
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('.k-ov.on')) return; var k = KM[e.key]; if (!k) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault(); if (!keys[k] && FX.onKey) FX.onKey(k, true); keys[k] = 1;
  });
  document.addEventListener('keyup', function (e) { var k = KM[e.key]; if (k) { keys[k] = 0; if (FX.onKey) FX.onKey(k, false); } });
  window.addEventListener('blur', function () { for (var k in keys) keys[k] = 0; });
  FX.resetKeys = function () { for (var k in keys) keys[k] = 0; };
  // 螢幕按鈕：defs = [{k:'left', t:'◀', cls:'l'}...]，放進 el（通常是 .touch 容器）
  FX.pad = function (el, defs) {
    el.innerHTML = '';
    defs.forEach(function (d) {
      if (d.gap) { var s = document.createElement('span'); s.className = 'gap'; el.appendChild(s); return; }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tb ' + (d.cls || ''); b.innerHTML = d.t; if (d.en) b.dataset.en = d.en;
      var dn = function (e) { e.preventDefault(); if (!keys[d.k] && FX.onKey) FX.onKey(d.k, true); keys[d.k] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { /* 略過 */ } };
      var up = function () { if (keys[d.k] && FX.onKey) FX.onKey(d.k, false); keys[d.k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      el.appendChild(b);
    });
  };

  // ---------- 俯視車輛（車頭朝 -Y，呼叫前自行 translate/rotate） ----------
  FX.car = function (ctx, w, h, color, o) {
    o = o || {};
    var x = -w / 2, y = -h / 2;
    if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.28)'; FX.rr(ctx, x + 3, y + 5, w, h, w * 0.3); ctx.fill(); }
    ctx.fillStyle = '#15171c'; var ww = w * 0.2, wh = h * 0.2;
    [[x - ww * 0.35, y + h * 0.14], [x + w - ww * 0.65, y + h * 0.14], [x - ww * 0.35, y + h * 0.66], [x + w - ww * 0.65, y + h * 0.66]].forEach(function (p, i) { ctx.save(); ctx.translate(p[0] + ww / 2, p[1] + wh / 2); if (i < 2 && o.steer) ctx.rotate(o.steer); FX.rr(ctx, -ww / 2, -wh / 2, ww, wh, 2); ctx.fill(); ctx.restore(); });
    var g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, shade(color, -0.25)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.3));
    ctx.fillStyle = g; FX.rr(ctx, x, y, w, h, w * 0.32); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; FX.rr(ctx, x + w * 0.2, y + h * 0.03, w * 0.6, h * 0.2, w * 0.2); ctx.fill();
    ctx.fillStyle = o.glass || '#0f2233'; FX.rr(ctx, x + w * 0.14, y + h * 0.24, w * 0.72, h * 0.2, w * 0.14); ctx.fill();
    FX.rr(ctx, x + w * 0.18, y + h * 0.7, w * 0.64, h * 0.12, w * 0.1); ctx.fill();
    ctx.fillStyle = shade(color, 0.12); FX.rr(ctx, x + w * 0.16, y + h * 0.43, w * 0.68, h * 0.28, w * 0.1); ctx.fill();
    if (o.stripe) { ctx.fillStyle = o.stripe; ctx.fillRect(-w * 0.09, y + 1, w * 0.18, h * 0.23); ctx.fillRect(-w * 0.09, y + h * 0.43, w * 0.18, h * 0.56); }
    ctx.fillStyle = '#fff7c2'; ctx.fillRect(x + w * 0.1, y + 1, w * 0.2, h * 0.04); ctx.fillRect(x + w * 0.7, y + 1, w * 0.2, h * 0.04);
    ctx.fillStyle = o.brake ? '#ff2d2d' : '#8a1c1c'; ctx.fillRect(x + w * 0.1, y + h - h * 0.045, w * 0.22, h * 0.04); ctx.fillRect(x + w * 0.68, y + h - h * 0.045, w * 0.22, h * 0.04);
    if (o.sign) { ctx.fillStyle = '#facc15'; FX.rr(ctx, -w * 0.22, y + h * 0.5, w * 0.44, h * 0.1, 2); ctx.fill(); }
  };
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(FX.clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255)); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  FX.shade = shade;

  // ---------- 倒數 3-2-1 ----------
  FX.countdown = function (el, done) {
    var n = 3, f = function () {
      if (n > 0) { el.textContent = n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); FX.sfx.beep3(); n--; setTimeout(f, 750); }
      else { el.textContent = 'GO!'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); FX.sfx.go(); done(); setTimeout(function () { if (el.textContent === 'GO!') el.textContent = ''; }, 700); }
    }; f();
  };
  // ---------- 畫布上的按鈕（即時模式）：每一幀 begin()，畫的時候 add() 登記範圍，點到就呼叫 ----------
  FX.Hit = function (cv, ctx) {
    var regs = [], Hh = { down: null, miss: null, move: null, up: null };
    Hh.begin = function () { regs.length = 0; };
    Hh.add = function (x, y, w, h, fn, data) { regs.push([x, y, w, h, fn, data]); };
    Hh.at = function (p) { for (var i = regs.length - 1; i >= 0; i--) { var r = regs[i]; if (p.x >= r[0] && p.x <= r[0] + r[2] && p.y >= r[1] && p.y <= r[1] + r[3]) return r; } return null; };
    cv.addEventListener('pointerdown', function (e) { var p = ctx.pt(e), r = Hh.at(p); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* 略過 */ } if (r) { r[4](r[5], p); return; } if (Hh.miss) Hh.miss(p, e); });
    cv.addEventListener('pointermove', function (e) { if (Hh.move) Hh.move(ctx.pt(e), e); });
    var up = function (e) { if (Hh.up) Hh.up(ctx.pt(e), e); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    return Hh;
  };
  // 圓角按鈕：o = { bg, fg, size, off（停用）, sel（選取）, sub（第二行小字）, r }
  FX.button = function (ctx, x, y, w, h, label, o) {
    o = o || {}; var r = o.r == null ? 10 : o.r, bg = o.off ? '#3a4152' : (o.bg || '#2563eb');
    ctx.fillStyle = 'rgba(0,0,0,.35)'; FX.rr(ctx, x, y + 3, w, h, r); ctx.fill();
    var g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(bg, 0.18)); g.addColorStop(1, bg); ctx.fillStyle = g; FX.rr(ctx, x, y, w, h, r); ctx.fill();
    if (o.sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
    var fg = o.off ? '#8a93a6' : (o.fg || '#fff'), sz = o.size || 14;
    if (o.sub) { FX.text(ctx, label, x + w / 2, y + h / 2 - sz * 0.45, sz, fg); FX.text(ctx, o.sub, x + w / 2, y + h / 2 + sz * 0.62, Math.max(9, sz * 0.72), o.off ? '#8a93a6' : (o.subc || 'rgba(255,255,255,.8)')); }
    else FX.text(ctx, label, x + w / 2, y + h / 2 + 1, sz, fg);
  };
  // 共用：靜音鍵、最佳紀錄
  FX.sound = function (onChange) { var b = K.$('bSound'); if (!b) return; var u = function () { b.textContent = K.muted ? '🔇' : '🔊'; }; b.onclick = function () { K.setMute(!K.muted); u(); if (onChange) onChange(); }; u(); };
  FX.best = function (key, v, lowerBetter) { var b = K.load(key, null), nb = b == null || (lowerBetter ? v < b : v > b); if (nb) K.save(key, v); return { best: nb ? v : b, isNew: nb }; };
  FX.again = function (S, msg) { if (S && S.started && !S.over && !(Date.now() - (S._ask || 0) < 2500)) { S._ask = Date.now(); K.toast(msg || K.L('再按一次放棄這局', 'Tap again to abandon this game')); return false; } return true; };
})();
