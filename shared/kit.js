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
  K.muted = K.load('sc_mute', false);
  K.setMute = function (m) { K.muted = m; K.save('sc_mute', m); };
})();
