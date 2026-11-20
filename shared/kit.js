/* stockcorp.github.io 共用：新遊戲的小工具（彈窗、提示、音效、存檔）。放在 app.js 之後載入。 */
(function () {
  'use strict';
  var d = document;
  var K = window.K = {
    $: function (id) { return d.getElementById(id); },
    L: function (zh, en) { return window.SC && SC.lang === 'en' ? en : zh; },
    load: function (k, def) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } },
    save: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 略過 */ } },
    open: function (id) { var o = K.$(id); if (o) o.classList.add('on'); },
    close: function (id) { var o = K.$(id); if (o) o.classList.remove('on'); },
    isOpen: function (id) { var o = K.$(id); return !!(o && o.classList.contains('on')); },
    toast: function (msg, ms) {
      var t = K.$('kToast'); if (!t) { t = d.createElement('div'); t.id = 'kToast'; t.className = 'k-toast'; d.body.appendChild(t); }
      t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, ms || 1800);
    },
    esc: function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    fmtTime: function (s) { s = Math.max(0, Math.floor(s)); var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; },
    shuffle: function (a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    muted: false,
    beep: function (f, dur, type, vol, slide) {
      if (K.muted) return;
      try {
        var A = K._ac || (K._ac = new (window.AudioContext || window.webkitAudioContext)());
        if (A.state === 'suspended') A.resume();
        var o = A.createOscillator(), g = A.createGain(), t = A.currentTime;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + (dur || 0.1));
        g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.1));
        o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + (dur || 0.1) + 0.02);
      } catch (e) { /* 沒有音效就算了 */ }
    }
  };
  // 點彈窗外面或 [data-close] 關閉；App 返回鍵先關彈窗
  d.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('[data-close]'); if (c) { var ov = c.closest('.k-ov'); if (ov) ov.classList.remove('on'); }
    if (e.target.classList && e.target.classList.contains('k-ov') && !e.target.hasAttribute('data-sticky')) e.target.classList.remove('on');
  });
  if (window.SC) SC.onBack(function () { var o = d.querySelectorAll('.k-ov.on'); if (o.length) { o[o.length - 1].classList.remove('on'); return true; } return false; });
  // ---------- 特效：粒子、彩帶、飄字、震動、彈跳（全部畫在一張蓋住畫面的透明畫布上，不擋操作） ----------
  var fxC = null, fxX = null, fxP = [], fxOn = false, fxT = 0;
  function fxInit() {
    if (fxC) return; fxC = d.createElement('canvas'); fxC.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147481000'; d.body.appendChild(fxC); fxX = fxC.getContext('2d');
    var rs = function () { var r = Math.min(2, window.devicePixelRatio || 1); fxC.width = innerWidth * r; fxC.height = innerHeight * r; fxX.setTransform(r, 0, 0, r, 0, 0); }; rs(); window.addEventListener('resize', rs);
  }
  function fxLoop(t) {
    var dt = Math.min(0.034, (t - fxT) / 1000 || 0.016); fxT = t; fxX.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = fxP.length - 1; i >= 0; i--) {
      var p = fxP[i]; p.life -= dt; if (p.life <= 0 || p.y > innerHeight + 40) { fxP.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      var a = Math.min(1, p.life / p.fade); fxX.globalAlpha = a; fxX.fillStyle = p.c;
      if (p.txt) { fxX.font = '900 ' + p.size + 'px ui-rounded,"Segoe UI",system-ui,sans-serif'; fxX.textAlign = 'center'; fxX.textBaseline = 'middle'; fxX.lineWidth = Math.max(3, p.size * 0.18); fxX.strokeStyle = 'rgba(0,0,0,.55)'; fxX.lineJoin = 'round'; fxX.strokeText(p.txt, p.x, p.y); fxX.fillText(p.txt, p.x, p.y); }
      else if (p.rect) { fxX.save(); fxX.translate(p.x, p.y); fxX.rotate(p.rot); fxX.scale(1, Math.cos(p.rot * 1.7)); fxX.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); fxX.restore(); }
      else if (p.star) { fxX.save(); fxX.translate(p.x, p.y); fxX.rotate(p.rot); fxX.beginPath(); for (var k = 0; k < 10; k++) { var rr = k % 2 ? p.size * 0.45 : p.size, an = k * Math.PI / 5; fxX.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } fxX.fill(); fxX.restore(); }
      else { fxX.beginPath(); fxX.arc(p.x, p.y, p.size * (p.shrink ? a : 1), 0, 7); fxX.fill(); }
    }
    fxX.globalAlpha = 1; if (fxP.length) requestAnimationFrame(fxLoop); else fxOn = false;
  }
  function fxGo() { if (!fxOn) { fxOn = true; fxT = performance.now(); requestAnimationFrame(fxLoop); } }
  function pos(t) { if (!t) return { x: innerWidth / 2, y: innerHeight / 2 }; if (t.getBoundingClientRect) { var r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } return t; }
  function pickC(c) { return Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c; }
  // K.burst(元素或{x,y}, {n,c,sp,life,size,g,star})
  K.burst = function (t, o) {
    try { fxInit(); o = o || {}; var q = pos(t), n = o.n || 14; for (var i = 0; i < n && fxP.length < 500; i++) { var a = Math.random() * 6.283, v = (o.sp || 170) * (0.35 + Math.random() * 0.65); fxP.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g == null ? 260 : o.g, drag: 1.6, life: (o.life || 0.6) * (0.6 + Math.random() * 0.4), fade: 0.3, c: pickC(o.c || ['#fde047', '#fff', '#f59e0b']), size: (o.size || 4) * (0.6 + Math.random() * 0.7), rot: Math.random() * 6, vr: 6, shrink: 1, star: o.star }); } fxGo(); } catch (e) { /* 略過 */ }
  };
  K.confetti = function (n) {
    try { fxInit(); var C = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6', '#fff']; n = n || 130; for (var i = 0; i < n; i++) { var left = i % 2 === 0; fxP.push({ x: left ? -10 : innerWidth + 10, y: innerHeight * (0.35 + Math.random() * 0.35), vx: (left ? 1 : -1) * (250 + Math.random() * 520), vy: -(320 + Math.random() * 520), g: 620, drag: 0.9, life: 2.4 + Math.random() * 1.4, fade: 0.5, c: C[i % C.length], size: 8 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, rect: 1 }); } fxGo(); } catch (e) { /* 略過 */ }
  };
  K.float = function (t, txt, c, size) { try { fxInit(); var q = pos(t); fxP.push({ x: q.x, y: q.y, vx: 0, vy: -70, g: 0, drag: 1.2, life: 1.1, fade: 0.4, c: c || '#fde047', size: size || 20, txt: String(txt), rot: 0, vr: 0 }); fxGo(); } catch (e) { /* 略過 */ } };
  function anim(el, kf, o) { try { if (el && el.animate) return el.animate(kf, o); } catch (e) { /* 略過 */ } return null; }
  K.shake = function (el, px) { px = px || 6; anim(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -px + 'px)' }, { transform: 'translateX(' + px + 'px)' }, { transform: 'translateX(' + -px * 0.6 + 'px)' }, { transform: 'translateX(' + px * 0.4 + 'px)' }, { transform: 'translateX(0)' }], { duration: 320, easing: 'ease-out' }); };
  K.pop = function (el, sc) { anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(' + (sc || 1.18) + ')' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' }); };
  K.drop = function (el) { anim(el, [{ transform: 'translateY(-18px) scale(.8)', opacity: 0 }, { transform: 'translateY(2px) scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'ease-out' }); };
  K.glow = function (el, c) { anim(el, [{ boxShadow: '0 0 0 0 ' + (c || '#fde047') }, { boxShadow: '0 0 22px 6px ' + (c || '#fde047') }, { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }], { duration: 650, easing: 'ease-out' }); };
  K.buzz = function (ms) { try { if (!K.muted && navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) { /* 略過 */ } };
  K.tune = function (notes, gap, type, vol) { (notes || []).forEach(function (f, i) { setTimeout(function () { K.beep(f, 0.16, type || 'triangle', vol || 0.06); }, i * (gap || 90)); }); };
  K.win = function () { K.confetti(); K.tune([523, 659, 784, 1047, 1319], 95); };
  K.muted = K.load('sc_mute', false);
  K.setMute = function (m) { K.muted = m; K.save('sc_mute', m); };
})();
