/* stockcorp.github.io 共用：線上玩家對戰（點對點 WebRTC，透過 PeerJS 公用伺服器配對）
   - 房主建立房間取得 6 碼房號，對手輸入房號或開分享連結（?room=房號）加入。
   - 連線建立後資料直接在兩台裝置之間傳送；房主負責驗證每一步，避免作弊。
   - 不需要帳號，也不經過我們的伺服器（本站沒有伺服器）。
   用法：
     SCNet.openLobby({ game: 'darkchess', title: '暗棋', onReady: function (conn) { ... } })
     conn.role  'host' | 'guest'
     conn.send(obj)；conn.onData = fn(obj)；conn.onClose = fn(reason)；conn.close() */
(function () {
  'use strict';
  var T = function (zh, en) { return window.SC ? SC.t(zh, en) : zh; };
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };
  var libP = null;
  function lib() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = '/shared/vendor/peerjs-1.5.5.min.js';
      s.onload = function () { res(window.Peer); }; s.onerror = function () { libP = null; rej(new Error('load')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  function code6() { var s = ''; for (var i = 0; i < 6; i++) s += ALPHA[(Math.random() * ALPHA.length) | 0]; return s; }
  function pid(game, code) { return 'stockcorp-' + game + '-' + code; }

  function wrap(peer, dc, role, code) {
    var c = { role: role, code: code, open: true, onData: null, onClose: null, last: Date.now() };
    var hb = setInterval(function () {
      if (!c.open) return;
      try { dc.send({ t: '__ping' }); } catch (e) { /* 略過 */ }
      if (Date.now() - c.last > 25000) end('timeout');
    }, 5000);
    function end(reason) {
      if (!c.open) return; c.open = false; clearInterval(hb);
      try { dc.close(); } catch (e) { /* 略過 */ }
      try { peer.destroy(); } catch (e) { /* 略過 */ }
      if (c.onClose) c.onClose(reason || 'closed');
    }
    dc.on('data', function (m) { c.last = Date.now(); if (!m || m.t === '__ping') return; if (m.t === '__bye') { end('left'); return; } if (c.onData) c.onData(m); });
    dc.on('close', function () { end('closed'); });
    dc.on('error', function () { end('error'); });
    peer.on('disconnected', function () { try { peer.reconnect(); } catch (e) { /* 略過 */ } });
    c.send = function (m) { if (c.open) try { dc.send(m); } catch (e) { end('error'); } };
    c.close = function () { if (!c.open) return; try { dc.send({ t: '__bye' }); } catch (e) { /* 略過 */ } setTimeout(function () { end('self'); }, 150); };
    window.addEventListener('pagehide', function () { if (c.open) try { dc.send({ t: '__bye' }); } catch (e) { /* 略過 */ } });
    return c;
  }

  // 建立房間
  function host(game, onCode, onConn, onErr) {
    var tries = 0, peer = null, cancelled = false;
    function attempt() {
      var code = code6();
      lib().then(function (Peer) {
        if (cancelled) return;
        peer = new Peer(pid(game, code), { config: ICE, debug: 0 });
        peer.on('open', function () { onCode(code); });
        peer.on('connection', function (dc) {
          dc.on('open', function () {
            if (peer._sc_taken) { try { dc.send({ t: '__full' }); } catch (e) { /* 略過 */ } setTimeout(function () { dc.close(); }, 300); return; }
            peer._sc_taken = true; onConn(wrap(peer, dc, 'host', code));
          });
        });
        peer.on('error', function (e) {
          if (e && e.type === 'unavailable-id' && tries++ < 4) { try { peer.destroy(); } catch (x) { /* 略過 */ } attempt(); return; }
          if (!peer._sc_taken) onErr(e && e.type || 'error');
        });
      }, function () { onErr('load'); });
    }
    attempt();
    return function cancel() { cancelled = true; try { if (peer && !peer._sc_taken) peer.destroy(); } catch (e) { /* 略過 */ } };
  }
  // 加入房間
  function join(game, code, onConn, onErr) {
    var peer = null, done = false, cancelled = false;
    lib().then(function (Peer) {
      if (cancelled) return;
      peer = new Peer({ config: ICE, debug: 0 });
      var to = setTimeout(function () { if (!done) { done = true; onErr('timeout'); try { peer.destroy(); } catch (e) { /* 略過 */ } } }, 20000);
      peer.on('open', function () {
        var dc = peer.connect(pid(game, code), { reliable: true, serialization: 'json' });
        dc.on('open', function () {
          var early = [];
          var first = function (m) { if (m && m.t === '__full') { done = true; clearTimeout(to); onErr('full'); try { peer.destroy(); } catch (e) { /* 略過 */ } } else if (m && m.t !== '__ping') early.push(m); };
          dc.on('data', first);
          setTimeout(function () {
            if (done) return; done = true; clearTimeout(to); if (dc.off) dc.off('data', first);
            var c = wrap(peer, dc, 'guest', code); onConn(c);
            early.forEach(function (m) { if (c.onData) c.onData(m); });
          }, 350);
        });
      });
      peer.on('error', function (e) { if (done) return; done = true; clearTimeout(to); onErr(e && e.type || 'error'); try { peer.destroy(); } catch (x) { /* 略過 */ } });
    }, function () { onErr('load'); });
    return function cancel() { cancelled = true; done = true; try { if (peer) peer.destroy(); } catch (e) { /* 略過 */ } };
  }

  /* ---------- 大廳視窗 ---------- */
  var css = '.scn-ov{position:fixed;inset:0;z-index:2147482000;background:rgba(5,8,15,.82);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}' +
    '.scn-box{background:#18202f;border:1px solid #33415e;border-radius:18px;max-width:440px;width:100%;padding:18px 20px;color:#e6ebf5;box-shadow:0 20px 60px rgba(0,0,0,.6)}' +
    '.scn-box h2{margin:0 0 6px;font-size:20px;color:#ffd77a}.scn-box p{margin:6px 0;line-height:1.6;font-size:14px;color:#c4cde0}' +
    '.scn-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.scn-row>*{flex:1}' +
    '.scn-btn{border:0;border-radius:12px;padding:12px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:linear-gradient(#ffd77a,#e0a83a);color:#2a1606}' +
    '.scn-btn.g{background:#263149;color:#e6ebf5;font-weight:600}.scn-btn:disabled{opacity:.45}' +
    '.scn-code{font:800 40px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:8px;text-align:center;background:#0f1522;border:2px dashed #ffd77a;border-radius:14px;padding:10px;margin:10px 0;color:#fff;user-select:all}' +
    '.scn-in{width:100%;font:800 28px ui-monospace,Menlo,Consolas,monospace;letter-spacing:6px;text-align:center;text-transform:uppercase;padding:10px;border-radius:12px;border:2px solid #33415e;background:#0f1522;color:#fff;box-sizing:border-box}' +
    '.scn-st{margin-top:10px;font-size:13px;color:#9fb0cf;min-height:20px}.scn-st.err{color:#ff9a8a}' +
    '.scn-spin{display:inline-block;width:12px;height:12px;border:2px solid #9fb0cf;border-top-color:transparent;border-radius:50%;animation:scnsp 1s linear infinite;vertical-align:-1px;margin-right:6px}@keyframes scnsp{to{transform:rotate(360deg)}}' +
    '.scn-note{font-size:12px!important;color:#7f8ba5!important}';
  var styled = false;
  function errText(e) {
    return ({ 'peer-unavailable': T('找不到這個房號，請確認房號或請對方重新建立房間。', 'Room not found. Check the code or ask your friend to create a new room.'),
      full: T('這個房間已經有人了。', 'This room is already full.'), timeout: T('連線逾時，請再試一次。部分公司或校園網路會擋住點對點連線，可改用手機網路。', 'Connection timed out. Some office or school networks block peer-to-peer play; try mobile data.'),
      network: T('無法連到配對伺服器，請檢查網路。', 'Cannot reach the matchmaking server. Check your connection.'), 'server-error': T('配對伺服器忙碌，請稍後再試。', 'Matchmaking server is busy. Please try again later.'),
      load: T('連線元件載入失敗，請重新整理頁面。', 'Failed to load the online module. Please reload.'), 'browser-incompatible': T('這個瀏覽器不支援線上對戰。', 'This browser does not support online play.') })[e] || T('連線失敗（' + e + '），請再試一次。', 'Connection failed (' + e + '). Please try again.');
  }
  function openLobby(o) {
    if (!styled) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); styled = true; }
    var ov = document.createElement('div'); ov.className = 'scn-ov'; document.body.appendChild(ov);
    var cancel = null, closed = false;
    function close() { if (closed) return; closed = true; if (cancel) cancel(); ov.remove(); if (o.onCancel) o.onCancel(); }
    function done(conn) { closed = true; ov.remove(); o.onReady(conn); }
    if (window.SC) SC.onBack(function () { if (!closed) { close(); return true; } return false; });
    function home() {
      if (cancel) { cancel(); cancel = null; }
      ov.innerHTML = '<div class="scn-box"><h2>🌐 ' + T('線上對戰', 'Play online') + '・' + o.title + '</h2>' +
        '<p>' + T('建立房間後把房號或連結傳給朋友，對方加入就開始。', 'Create a room and send the code or link to a friend. The game starts when they join.') + '</p>' +
        '<div class="scn-row"><button class="scn-btn" data-a="host">' + T('建立房間', 'Create room') + '</button></div>' +
        '<p style="margin-top:14px">' + T('或輸入朋友的房號：', 'Or enter a friend\'s room code:') + '</p>' +
        '<input class="scn-in" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters">' +
        '<div class="scn-row"><button class="scn-btn" data-a="join">' + T('加入房間', 'Join room') + '</button><button class="scn-btn g" data-a="close">' + T('取消', 'Cancel') + '</button></div>' +
        '<div class="scn-st"></div><p class="scn-note">' + T('點對點連線，不需註冊；對局資料直接在你和對手的裝置間傳送。', 'Peer-to-peer, no sign-up. Game data goes directly between the two devices.') + '</p></div>';
      var inp = ov.querySelector('.scn-in'), st = ov.querySelector('.scn-st');
      if (o.code) inp.value = o.code;
      inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      ov.querySelector('[data-a=host]').onclick = hosting;
      ov.querySelector('[data-a=close]').onclick = close;
      ov.querySelector('[data-a=join]').onclick = function () {
        var c = inp.value.trim().toUpperCase(); if (c.length !== 6) { st.className = 'scn-st err'; st.textContent = T('房號是 6 個字元', 'Room codes have 6 characters'); return; }
        st.className = 'scn-st'; st.innerHTML = '<span class="scn-spin"></span>' + T('連線中…', 'Connecting…');
        this.disabled = true; var btn = this;
        cancel = join(o.game, c, done, function (e) { st.className = 'scn-st err'; st.textContent = errText(e); btn.disabled = false; cancel = null; });
      };
      if (o.code && o.autoJoin) ov.querySelector('[data-a=join]').click();
    }
    function hosting() {
      ov.innerHTML = '<div class="scn-box"><h2>🌐 ' + T('等待對手加入', 'Waiting for opponent') + '</h2><p>' + T('把房號告訴朋友：', 'Tell your friend this code:') + '</p>' +
        '<div class="scn-code">······</div><div class="scn-row"><button class="scn-btn" data-a="copy" disabled>' + T('複製邀請連結', 'Copy invite link') + '</button><button class="scn-btn g" data-a="back">' + T('返回', 'Back') + '</button></div>' +
        '<div class="scn-st"><span class="scn-spin"></span>' + T('建立房間中…', 'Creating room…') + '</div><p class="scn-note">' + T('對方加入前請不要關閉這個頁面。', 'Keep this page open until your friend joins.') + '</p></div>';
      var st = ov.querySelector('.scn-st'), cp = ov.querySelector('[data-a=copy]'), link = '';
      ov.querySelector('[data-a=back]').onclick = home;
      cp.onclick = function () {
        var txt = T('來跟我下' + o.title + '！房號 ', 'Play ' + o.title + ' with me! Room code ') + link.split('room=')[1] + '\n' + link;
        if (navigator.share) { navigator.share({ title: o.title, text: txt, url: link }).catch(function () { /* 略過 */ }); return; }
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { cp.textContent = T('已複製！', 'Copied!'); }, function () { window.prompt(T('複製這個連結：', 'Copy this link:'), link); });
      };
      cancel = host(o.game, function (code) {
        ov.querySelector('.scn-code').textContent = code; cp.disabled = false;
        link = location.origin + location.pathname + '?room=' + code;
        st.innerHTML = '<span class="scn-spin"></span>' + T('房間已建立，等待對手加入…', 'Room ready. Waiting for your opponent…');
      }, done, function (e) { st.className = 'scn-st err'; st.textContent = errText(e); });
    }
    home();
    return close;
  }
  // 網址帶 ?room= 時回傳房號
  function roomFromUrl() { var m = /[?&]room=([A-Za-z0-9]{6})\b/.exec(location.search); return m ? m[1].toUpperCase() : null; }
  function clearRoomFromUrl() { if (history.replaceState) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]room=[A-Za-z0-9]{6}/, '').replace(/^&/, '?') + location.hash); }
  window.SCNet = { openLobby: openLobby, host: host, join: join, roomFromUrl: roomFromUrl, clearRoomFromUrl: clearRoomFromUrl, EMOTES: ['👍', '😂', '😮', '😡', '🙏', '👋'] };
})();
