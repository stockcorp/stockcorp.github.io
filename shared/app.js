/* stockcorp.github.io 共用：App（WebView 套殼）偵測、AdSense 載入、原生橋接
   放在每個頁面的 <head>，要同步載入（不要加 async/defer）。

   ■ 怎麼讓網頁知道自己在 App 裡（任一即可）
     1) 開啟網址時帶 ?app=1（會記在這台裝置；?app=0 取消）
     2) WebView 的 User-Agent 加上 "StockcorpApp/版本"（舊的 WacpApp/、AigApp/ 也認得）
     3) 原生橋接物件：ReactNativeWebView、Capacitor、cordova、flutter_inappwebview、
        iOS webkit.messageHandlers.stockcorp、Android window.StockcorpAndroid
   ■ 在 App 裡會：不載入 AdSense（App 請用 AdMob）、加上 html.in-app。
     遊戲切換列（回大廳／上一款／下一款）與結算推薦在大廳 App 裡照常顯示；
     只包單一款遊戲的舊套殼（WacpApp／AigApp）或網址帶 ?nav=0 才隱藏。
   ■ 套殼注意：WebView 的高度請用 match_parent，不要用 wrap_content、也不要包在 ScrollView 裡，
     否則 CSS 的 vh 會變成 0。下面有自動修正，但原生端設對才是正解。
   ■ 原生 → 網頁：window.SC.back() 處理返回鍵（回傳 true 代表網頁已處理）、window.SC.pause()／resume()
   ■ 網頁 → 原生：window.SC.post(type, data)，例如 SC.post('gameover', {win:true})
   ■ 中英切換：SC.lang、SC.setLang('en')、SC.onLang(fn)；HTML 元素加 data-en="英文" 會自動替換，
     按鈕加 data-lang-toggle 就是切換鈕。原生端可在網址帶 ?lang=en 指定語言。 */
(function () {
  'use strict';
  var w = window, d = document, q = location.search, app = false, ua = navigator.userAgent || '';
  var KEYS = ['sc_app', 'wacp_app', 'aig_app'];
  try {
    if (/[?&]app=1\b/.test(q)) localStorage.setItem('sc_app', '1');
    if (/[?&]app=0\b/.test(q)) KEYS.forEach(function (k) { localStorage.removeItem(k); });
    app = KEYS.some(function (k) { return localStorage.getItem(k) === '1'; });
  } catch (e) { app = /[?&]app=1\b/.test(q); }
  var bridge = {
    rn: !!w.ReactNativeWebView,
    ios: !!(w.webkit && w.webkit.messageHandlers && (w.webkit.messageHandlers.stockcorp || w.webkit.messageHandlers.wacp)),
    android: !!(w.StockcorpAndroid || w.WacpAndroid),
    flutter: !!w.flutter_inappwebview,
    cap: !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform()),
    cordova: !!w.cordova
  };
  if (!app) app = /(StockcorpApp|WacpApp|AigApp)\//.test(ua) || bridge.rn || bridge.ios || bridge.android || bridge.flutter || bridge.cap || bridge.cordova;
  w.SC_IS_APP = w.WACP_IS_APP = w.AIG_IS_APP = app;
  // 只包「單一款遊戲」的舊套殼（Wacp／Aig）不顯示遊戲切換列；包整個大廳的 App 要顯示，玩家才回得了大廳
  var single = false; try { single = localStorage.getItem('wacp_app') === '1' || localStorage.getItem('aig_app') === '1'; } catch (e) { /* 略過 */ }
  w.SC_APP_NAV = !(single || /(WacpApp|AigApp)\//.test(ua) || !!w.WacpAndroid || /[?&]nav=0\b/.test(q));
  var html = d.documentElement;
  html.className += app ? ' in-app' : ' on-web';
  // ---------- 套殼 App 的 WebView 高度修正 ----------
  // 有些套殼把 WebView 的高度設成 wrap_content（或包在 ScrollView 裡），這時 CSS 的 vh 會是 0：
  // 彈窗被壓成一條線、遊戲區高度變 0、切換列被「橫向矮螢幕」的規則藏起來。
  // 偵測到就把樣式表裡的 vh 換成依螢幕高度算出來的 px，並修正跟高度有關的 @media。
  // 一般瀏覽器不會進來；要強制開啟可在網址加 ?vhfix=1（?vhfix=0 取消）。
  (function () {
    var forced = false;
    try { if (/[?&]vhfix=1\b/.test(q)) localStorage.setItem('sc_vhfix', '1'); if (/[?&]vhfix=0\b/.test(q)) localStorage.removeItem('sc_vhfix'); forced = localStorage.getItem('sc_vhfix') === '1'; } catch (e) { forced = /[?&]vhfix=1\b/.test(q); }
    function probe() { var p = d.createElement('div'); p.style.cssText = 'position:absolute;left:-9px;top:0;width:1px;height:100vh;visibility:hidden;pointer-events:none'; html.appendChild(p); var h = p.offsetHeight; html.removeChild(p); return h; }
    if (!forced && probe() >= 160) return;
    var sh = (w.screen && w.screen.height) || 760, sw = (w.screen && w.screen.width) || 390, H = Math.max(420, Math.min(sh, 1400) - 190), W0 = w.innerWidth || sw;
    w.SC_VH_FIX = H; html.className += ' vh-fix';
    try { Object.defineProperty(w, 'innerHeight', { configurable: true, get: function () { return H; } }); } catch (e) { /* 略過 */ }
    var RE = /(-?\d*\.?\d+)[dsl]?vh\b/g, YES = '(min-width:0px)', NO = '(max-width:0px)';
    function media(t) {
      return t.replace(/\(\s*(max|min)-height\s*:\s*(\d+)px\s*\)/g, function (m, k, n) { return (k === 'max' ? H <= +n : H >= +n) ? YES : NO; })
        .replace(/\(\s*orientation\s*:\s*(landscape|portrait)\s*\)/g, function (m, o) { return ((W0 > H) === (o === 'landscape')) ? YES : NO; });
    }
    function walk(rules) {
      for (var i = 0; rules && i < rules.length; i++) {
        var r = rules[i];
        try {
          if (r.media && r.media.mediaText && /height|orientation/.test(r.media.mediaText)) { var nt = media(r.media.mediaText); if (nt !== r.media.mediaText) r.media.mediaText = nt; }
          if (r.cssRules) walk(r.cssRules);
          var st = r.style; if (!st || st.cssText.indexOf('vh') < 0) continue;
          for (var k = 0; k < st.length; k++) { var p = st[k], v = st.getPropertyValue(p); if (v.indexOf('vh') >= 0) st.setProperty(p, v.replace(RE, function (m, n) { return (n * H / 100).toFixed(1) + 'px'; }), st.getPropertyPriority(p)); }
        } catch (e) { /* 單一規則失敗就跳過 */ }
      }
    }
    function fix() { for (var i = 0; i < d.styleSheets.length; i++) { try { walk(d.styleSheets[i].cssRules); } catch (e) { /* 跨網域樣式表讀不到 */ } } }
    // 彈窗：WebView 被撐成整頁高時，「置中」會跑到看不到的地方，改成貼著上面
    var css = d.createElement('style'); css.textContent = 'html.vh-fix .k-ov,html.vh-fix .ov,html.vh-fix .scg-ov{align-items:flex-start!important;padding-top:56px!important}html.vh-fix .scg-bar{display:flex!important}';
    (d.head || html).appendChild(css);
    fix(); d.addEventListener('DOMContentLoaded', fix); w.addEventListener('load', fix); [300, 1200, 3000].forEach(function (t) { setTimeout(fix, t); });
  })();

  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) html.className += ' ios';

  /* ---- 語言：?lang=zh|en ＞ 上次選擇 ＞ 瀏覽器語言。全站共用（sc_lang，並同步我愛操盤手的 wacp_lang）---- */
  var LKEYS = ['sc_lang', 'wacp_lang'], lang = null, lm = /[?&]lang=(zh|en)\b/.exec(q);
  if (lm) lang = lm[1];
  try { if (!lang) for (var li = 0; li < LKEYS.length && !lang; li++) { var lv = localStorage.getItem(LKEYS[li]); if (lv === 'zh' || lv === 'en') lang = lv; } } catch (e) { /* 略過 */ }
  if (lang !== 'zh' && lang !== 'en') lang = /^zh/i.test(navigator.language || 'zh') ? 'zh' : 'en';
  try { LKEYS.forEach(function (k) { localStorage.setItem(k, lang); }); } catch (e) { /* 略過 */ }
  html.lang = lang === 'en' ? 'en' : 'zh-Hant';
  var langHandlers = [];
  // 把有 data-en 的元素換成英文（原本的中文存在 data-zh）
  function applyI18n(root) {
    var list = (root || d).querySelectorAll('[data-en]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute('data-zh') == null) el.setAttribute('data-zh', el.innerHTML);
      el.innerHTML = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-zh');
    }
    var tl = (root || d).querySelectorAll('[data-en-title]');
    for (var j = 0; j < tl.length; j++) { var e2 = tl[j]; if (e2.getAttribute('data-zh-title') == null) e2.setAttribute('data-zh-title', e2.getAttribute('title') || ''); e2.setAttribute('title', lang === 'en' ? e2.getAttribute('data-en-title') : e2.getAttribute('data-zh-title')); }
    var bt = d.querySelectorAll('[data-lang-toggle]');
    for (var k = 0; k < bt.length; k++) bt[k].textContent = lang === 'en' ? '中文' : 'EN';
  }
  var backHandlers = [], pauseHandlers = [], resumeHandlers = [];
  var SC = w.SC = {
    isApp: app,
    get lang() { return lang; },
    t: function (zh, en) { return lang === 'en' ? en : zh; },
    setLang: function (l) {
      lang = l === 'en' ? 'en' : 'zh';
      try { LKEYS.forEach(function (k) { localStorage.setItem(k, lang); }); } catch (e) { /* 略過 */ }
      html.lang = lang === 'en' ? 'en' : 'zh-Hant';
      if (/[?&]lang=/.test(location.search) && history.replaceState) history.replaceState(null, '', location.pathname + location.search.replace(/([?&])lang=(zh|en)/, '$1lang=' + lang) + location.hash);
      applyI18n(); langHandlers.forEach(function (f) { try { f(lang); } catch (e) { /* 略過 */ } });
    },
    toggleLang: function () { SC.setLang(lang === 'en' ? 'zh' : 'en'); },
    onLang: function (fn) { langHandlers.push(fn); },
    applyI18n: applyI18n,
    // 遊戲用：註冊返回鍵處理（後註冊的先處理），回傳 true 代表已處理
    onBack: function (fn) { backHandlers.push(fn); },
    onPause: function (fn) { pauseHandlers.push(fn); },
    onResume: function (fn) { resumeHandlers.push(fn); },
    back: function () { for (var i = backHandlers.length - 1; i >= 0; i--) { try { if (backHandlers[i]()) return true; } catch (e) { /* 略過 */ } } return false; },
    pause: function () { pauseHandlers.forEach(function (f) { try { f(); } catch (e) { /* 略過 */ } }); },
    resume: function () { resumeHandlers.forEach(function (f) { try { f(); } catch (e) { /* 略過 */ } }); },
    post: function (type, data) {
      var msg = JSON.stringify({ type: type, data: data || null, page: location.pathname });
      try {
        if (w.ReactNativeWebView) w.ReactNativeWebView.postMessage(msg);
        else if (w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.stockcorp) w.webkit.messageHandlers.stockcorp.postMessage(msg);
        else if (w.StockcorpAndroid && w.StockcorpAndroid.postMessage) w.StockcorpAndroid.postMessage(msg);
        else if (w.flutter_inappwebview && w.flutter_inappwebview.callHandler) w.flutter_inappwebview.callHandler('stockcorp', msg);
      } catch (e) { /* 沒有原生端就忽略 */ }
    }
  };
  d.addEventListener('DOMContentLoaded', function () {
    applyI18n();
    d.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-lang-toggle]'); if (t) { e.preventDefault(); SC.toggleLang(); } });
  });
  // 切到背景時自動暫停（App 被切走、瀏覽器換分頁都適用）
  d.addEventListener('visibilitychange', function () { if (d.hidden) SC.pause(); else SC.resume(); });
  // Android 實體返回鍵（Capacitor）
  d.addEventListener('backbutton', function (e) { if (SC.back()) e.preventDefault(); }, false);
  if (app) {
    // App 內：不出現長按選單、不讓頁面整個被拖動
    d.addEventListener('contextmenu', function (e) { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
    w.addEventListener('load', function () { SC.post('ready', { title: d.title }); });
    return;
  }
  // ---- 網頁版：載入 Google AdSense（自動廣告）----
  var s = d.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3440199491716602';
  d.head.appendChild(s);
  // 底部錨定廣告出現時，把它的高度存成 CSS 變數 --sc-anchor，讓遊戲按鈕往上讓位
  function measure() {
    var h = 0, list = d.querySelectorAll('ins.adsbygoogle[data-anchor-status="displayed"], ins.adsbygoogle[data-anchor-shown="true"]');
    for (var i = 0; i < list.length; i++) { var r = list[i].getBoundingClientRect(); if (r.height > 0 && r.bottom >= w.innerHeight - 4) h = Math.max(h, Math.round(w.innerHeight - r.top)); }
    html.style.setProperty('--sc-anchor', Math.min(h, 160) + 'px');
  }
  w.addEventListener('load', function () {
    measure();
    if (w.MutationObserver) new MutationObserver(measure).observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-anchor-status', 'style'] });
    w.addEventListener('resize', measure);
  });
})();
