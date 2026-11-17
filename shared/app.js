/* stockcorp.github.io 共用：App（WebView 套殼）偵測、AdSense 載入、原生橋接
   放在每個頁面的 <head>，要同步載入（不要加 async/defer）。

   ■ 怎麼讓網頁知道自己在 App 裡（任一即可）
     1) 開啟網址時帶 ?app=1（會記在這台裝置；?app=0 取消）
     2) WebView 的 User-Agent 加上 "StockcorpApp/版本"（舊的 WacpApp/、AigApp/ 也認得）
     3) 原生橋接物件：ReactNativeWebView、Capacitor、cordova、flutter_inappwebview、
        iOS webkit.messageHandlers.stockcorp、Android window.StockcorpAndroid
   ■ 在 App 裡會：不載入 AdSense（App 請用 AdMob）、隱藏遊戲切換列、加上 html.in-app
   ■ 原生 → 網頁：window.SC.back() 處理返回鍵（回傳 true 代表網頁已處理）、window.SC.pause()／resume()
   ■ 網頁 → 原生：window.SC.post(type, data)，例如 SC.post('gameover', {win:true}) */
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
  var html = d.documentElement;
  html.className += app ? ' in-app' : ' on-web';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) html.className += ' ios';

  var backHandlers = [], pauseHandlers = [], resumeHandlers = [];
  var SC = w.SC = {
    isApp: app,
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
