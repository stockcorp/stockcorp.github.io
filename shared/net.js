/* stockcorp.github.io 共用：線上玩家對戰（點對點 WebRTC，透過 PeerJS 公用伺服器配對）
   - 房主建立房間取得 6 碼房號，對手輸入房號或開分享連結（?room=房號）加入。
   - 隨機配對：用 SEATS 個公開「等候座位」ID（stockcorp-<game>-rN）。有人在等就連過去，沒人就自己佔一個座位等；
     等待中的人會定期探測編號比自己小的座位，有人就主動合併，避免兩人各等各的。等待人數靠探測座位估算。
   - 連線建立後資料直接在兩台裝置之間傳送；房主負責驗證每一步，避免作弊。
   - 不需要帳號。手機網路等無法直連時，資料會經由 TURN 中繼伺服器轉送（只轉送、不保存）。
   用法：
     SCNet.openLobby({ game: 'darkchess', title: '暗棋', onReady: function (conn) { ... } })
     conn.role  'host' | 'guest'
     conn.send(obj)；conn.onData = fn(obj)；conn.onClose = fn(reason)；conn.close() */
(function () {
  'use strict';
  var T = function (zh, en) { return window.SC ? SC.t(zh, en) : zh; };
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // 連線設定：STUN 找出自己的公開位址；TURN 是「中繼」，手機 4G/5G、公司網路這類無法直連的情況靠它轉送。
  // TURN 帳號由 Linode /api/turn.php 發（Cloudflare 或自架 coturn）。PeerJS、openrelay 的免費 TURN 實測已失效（2026-11），不再使用。
  var TURN_API = 'https://game.ldigi.com.tw/api/turn.php';
  var ICE = { iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }
  ], sdpSemantics: 'unified-plan' };
  var iceP = null;
  function iceReady() {
    if (iceP) return iceP;
    iceP = new Promise(function (res) {
      var add = function (list) { if (list && list.length) ICE.iceServers = list.concat(ICE.iceServers); res(); };
      try { var c = JSON.parse(sessionStorage.getItem('sc_turn') || 'null'); if (c && c.exp > Date.now() / 1000 + 600) { add(c.ice); return; } } catch (e) { /* 略過 */ }
      if (!window.fetch) { res(); return; }
      var done = false, t = setTimeout(function () { if (!done) { done = true; res(); } }, 3500);
      fetch(TURN_API, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (done) return; done = true; clearTimeout(t);
        if (j && j.ok && j.iceServers && j.iceServers.length) { try { sessionStorage.setItem('sc_turn', JSON.stringify({ ice: j.iceServers, exp: j.exp || 0 })); } catch (e) { /* 略過 */ } add(j.iceServers); } else res();
      }).catch(function () { if (!done) { done = true; clearTimeout(t); res(); } });
    });
    return iceP;
  }
  // 手機切到別的 App（例如去 LINE 傳房號）時，和配對伺服器的連線會被系統切斷；回來時自動重連，房間才找得到
  var live = [];
  function mkPeer(Peer, id) {
    var peer = id ? new Peer(id, { config: ICE, debug: 0 }) : new Peer({ config: ICE, debug: 0 });
    live.push(peer);
    peer.on('disconnected', function () { setTimeout(function () { if (!peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) { /* 略過 */ } }, 400); });
    peer.on('close', function () { var i = live.indexOf(peer); if (i >= 0) live.splice(i, 1); });
    return peer;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    live.forEach(function (p) { if (!p.destroyed && p.disconnected) try { p.reconnect(); } catch (e) { /* 略過 */ } });
  });
  var libP = null;
  function lib() {
    if (libP) return libP;
    if (window.Peer) { libP = iceReady().then(function () { return window.Peer; }); return libP; }
    libP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = '/shared/vendor/peerjs-1.5.5.min.js';
      s.onload = function () { iceReady().then(function () { res(window.Peer); }); }; s.onerror = function () { libP = null; rej(new Error('load')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  function code6() { var s = ''; for (var i = 0; i < 6; i++) s += ALPHA[(Math.random() * ALPHA.length) | 0]; return s; }
  function pid(game, code) { return 'stockcorp-' + game + '-' + code; }

  // shared：多人房間時同一個 peer 有多條連線，單一連線斷掉不能把 peer 關掉
  function wrap(peer, dc, role, code, shared) {
    var c = { role: role, code: code, open: true, onData: null, onClose: null, last: Date.now() };
    var hb = setInterval(function () {
      if (!c.open) return;
      try { dc.send({ t: '__ping' }); } catch (e) { /* 略過 */ }
      if (!document.hidden && Date.now() - c.last > 40000) end('timeout');
    }, 5000);
    var vis = function () { if (!document.hidden) c.last = Date.now(); };
    document.addEventListener('visibilitychange', vis);
    function end(reason) {
      if (!c.open) return; c.open = false; clearInterval(hb); document.removeEventListener('visibilitychange', vis);
      try { dc.close(); } catch (e) { /* 略過 */ }
      if (!shared) try { peer.destroy(); } catch (e) { /* 略過 */ }
      if (c.onClose) c.onClose(reason || 'closed');
    }
    dc.on('data', function (m) { c.last = Date.now(); if (!m || m.t === '__ping') return; if (m.t === '__bye') { end('left'); return; } if (c.onData) c.onData(m); });
    dc.on('close', function () { end('closed'); });
    dc.on('error', function () { end('error'); });
    c.send = function (m) { if (c.open) try { dc.send(m); } catch (e) { end('error'); } };
    c.close = function () { if (!c.open) return; try { dc.send({ t: '__bye' }); } catch (e) { /* 略過 */ } setTimeout(function () { end('self'); }, 150); };
    window.addEventListener('pagehide', function () { if (c.open) try { dc.send({ t: '__bye' }); } catch (e) { /* 略過 */ } });
    return c;
  }

  // 建立房間
  // max：房間人數上限（含房主），預設 2；多人房間 onConn 會被呼叫多次
  function host(game, onCode, onConn, onErr, max) {
    var tries = 0, peer = null, cancelled = false, n = 0, multi = (max || 2) > 2;
    function attempt() {
      var code = code6();
      lib().then(function (Peer) {
        if (cancelled) return;
        peer = mkPeer(Peer, pid(game, code));
        peer.on('open', function () { onCode(code); });
        peer.on('connection', function (dc) {
          dc.on('open', function () {
            if (dc.metadata && dc.metadata.probe) { try { dc.send({ t: '__probe', busy: !!peer._sc_taken }); } catch (e) { /* 略過 */ } setTimeout(function () { try { dc.close(); } catch (e) { /* 略過 */ } }, 400); return; }
            if (peer._sc_taken) { try { dc.send({ t: '__full' }); } catch (e) { /* 略過 */ } setTimeout(function () { dc.close(); }, 300); return; }
            n++; if (n >= (max || 2) - 1) peer._sc_taken = true;
            var c = wrap(peer, dc, 'host', code, multi);
            if (multi) { var oc = null; Object.defineProperty(c, 'onClose', { get: function () { return function (r) { n--; if (!peer._sc_locked) peer._sc_taken = false; if (oc) oc(r); }; }, set: function (f) { oc = f; } }); }
            onConn(c);
          });
        });
        peer.on('error', function (e) {
          if (e && e.type === 'unavailable-id' && tries++ < 4) { try { peer.destroy(); } catch (x) { /* 略過 */ } attempt(); return; }
          if (!peer._sc_taken && !n) onErr(e && e.type || 'error');
        });
      }, function () { onErr('load'); });
    }
    attempt();
    var cancel = function () { cancelled = true; try { if (peer && !n) peer.destroy(); } catch (e) { /* 略過 */ } };
    // 多人房間開局後不再收人；全部人都離開時關掉 peer
    cancel.lock = function () { if (peer) { peer._sc_taken = true; peer._sc_locked = true; } };
    cancel.destroy = function () { cancelled = true; try { if (peer) peer.destroy(); } catch (e) { /* 略過 */ } };
    return cancel;
  }
  // 加入房間
  function join(game, code, onConn, onErr) {
    var peer = null, done = false, cancelled = false;
    lib().then(function (Peer) {
      if (cancelled) return;
      peer = mkPeer(Peer);
      var to = setTimeout(function () { if (!done) { done = true; onErr('timeout'); try { peer.destroy(); } catch (e) { /* 略過 */ } } }, 32000);
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


  /* ---------- 隨機配對 ---------- */
  var SEATS = 20;
  function seatId(game, k) { return 'stockcorp-' + game + '-r' + k; }
  function seatOf(game, id) { var m = new RegExp('stockcorp-' + game + '-r(\\d+)').exec(id || ''); return m ? +m[1] : 0; }
  // 用已開啟的 peer 探測指定座位：回傳 {k: 'empty'|'wait'|'busy'|'unknown'}
  function probe(peer, game, list) {
    return new Promise(function (res) {
      var out = {}, left = list.length, fin = false;
      if (!left) { res(out); return; }
      function set(k, v) { if (fin || out[k]) return; out[k] = v; if (--left === 0) { fin = true; peer.off && peer.off('error', onErr); res(out); } }
      function onErr(e) { if (e && e.type === 'peer-unavailable') { var k = seatOf(game, e.message); if (k) set(k, 'empty'); } }
      peer.on('error', onErr);
      list.forEach(function (k) {
        var dc; try { dc = peer.connect(seatId(game, k), { reliable: true, serialization: 'json', metadata: { probe: 1 } }); } catch (e) { set(k, 'unknown'); return; }
        dc.on('data', function (m) { if (m && m.t === '__probe') { set(k, m.busy ? 'busy' : 'wait'); setTimeout(function () { try { dc.close(); } catch (e) { /* 略過 */ } }, 50); } });
        setTimeout(function () { set(k, 'unknown'); try { dc.close(); } catch (e) { /* 略過 */ } }, 6000);
      });
    });
  }
  function seatList(n) { var a = []; for (var i = 1; i <= (n || SEATS); i++) a.push(i); return a; }
  function count(st) { var w = 0, b = 0; for (var k in st) { if (st[k] === 'wait') w++; else if (st[k] === 'busy') b++; } return { waiting: w, playing: b }; }
  // 估算目前等待人數（給大廳顯示用）
  function estimate(game) {
    return lib().then(function (Peer) {
      return new Promise(function (res) {
        var peer = mkPeer(Peer), t = setTimeout(function () { try { peer.destroy(); } catch (e) { /* 略過 */ } res(null); }, 9000);
        peer.on('open', function () { probe(peer, game, seatList()).then(function (st) { clearTimeout(t); try { peer.destroy(); } catch (e) { /* 略過 */ } res(count(st)); }); });
        peer.on('error', function (e) { if (e && e.type !== 'peer-unavailable') { clearTimeout(t); try { peer.destroy(); } catch (x) { /* 略過 */ } res(null); } });
      });
    }, function () { return null; });
  }
  // 用現有 peer 以「真的要對戰」身分連到某座位；成功回傳 wrap 後的連線
  function joinVia(peer, game, k, onConn, onFail) {
    var dc, ok = false, fail = false;
    function bad(r) { if (ok || fail) return; fail = true; clearTimeout(to); peer.off && peer.off('error', onErr); try { dc.close(); } catch (e) { /* 略過 */ } onFail(r); }
    function onErr(e) { if (e && e.type === 'peer-unavailable' && seatOf(game, e.message) === k) bad('gone'); }
    var to = setTimeout(function () { bad('timeout'); }, 15000);
    peer.on('error', onErr);
    try { dc = peer.connect(seatId(game, k), { reliable: true, serialization: 'json' }); } catch (e) { bad('error'); return; }
    dc.on('open', function () {
      var early = [];
      var first = function (m) { if (m && m.t === '__full') bad('full'); else if (m && m.t !== '__ping') early.push(m); };
      dc.on('data', first);
      setTimeout(function () {
        if (fail) return; ok = true; clearTimeout(to); peer.off && peer.off('error', onErr); if (dc.off) dc.off('data', first);
        var c = wrap(peer, dc, 'guest', 'R' + k); onConn(c);
        early.forEach(function (m) { if (c.onData) c.onData(m); });
      }, 350);
    });
    dc.on('error', function () { bad('error'); });
  }
  // 隨機配對主流程。onStatus({phase:'search'|'wait', waiting, seat})
  function random(game, onStatus, onConn, onErr) {
    var cancelled = false, peer = null, timer = null, joining = false, rounds = 0;
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    function kill() { clearInterval(timer); timer = null; try { if (peer && !peer._sc_taken) peer.destroy(); } catch (e) { /* 略過 */ } }
    function search(Peer) {
      if (cancelled) return;
      if (++rounds > 6) { onErr('server-error'); return; }
      onStatus({ phase: 'search' });
      peer = mkPeer(Peer);
      peer.on('error', function (e) { if (e && e.type !== 'peer-unavailable' && !joining && !cancelled) { kill(); onErr(e.type || 'error'); } });
      peer.on('open', function () {
        probe(peer, game, seatList()).then(function (st) {
          if (cancelled) return;
          var waits = shuffle(Object.keys(st).filter(function (k) { return st[k] === 'wait'; }).map(Number));
          var empties = Object.keys(st).filter(function (k) { return st[k] === 'empty'; }).map(Number);
          // 偶爾配對伺服器沒回「查無此人」，探測結果會是 unknown；這時也可以去坐（真的有人坐會收到 unavailable-id，重新搜尋）
          if (!empties.length) empties = Object.keys(st).filter(function (k) { return st[k] !== 'wait' && st[k] !== 'busy'; }).map(Number);
          (function next() {
            if (cancelled) return;
            if (!waits.length) { var me = peer; peer = null; try { me.destroy(); } catch (e) { /* 略過 */ } sit(Peer, empties, count(st).waiting); return; }
            var k = waits.shift(); joining = true;
            joinVia(peer, game, k, function (c) { if (cancelled) { c.close(); return; } onConn(c); }, function () { joining = false; next(); });
          })();
        });
      });
    }
    function sit(Peer, empties, others) {
      if (cancelled) return;
      if (!empties.length) { onErr('busy-seats'); return; }
      var k = empties[(Math.random() * empties.length) | 0];
      peer = mkPeer(Peer, seatId(game, k));
      peer.on('open', function () {
        onStatus({ phase: 'wait', seat: k, waiting: others });
        // 定期探測編號比自己小的座位；有人在等就主動過去，避免兩人各等各的
        timer = setInterval(function () {
          if (cancelled || peer._sc_taken || joining) return;
          var lower = seatList(k - 1);
          probe(peer, game, seatList().filter(function (j) { return j !== k; })).then(function (st) {
            if (cancelled || peer._sc_taken || joining) return;
            onStatus({ phase: 'wait', seat: k, waiting: count(st).waiting });
            var target = lower.filter(function (j) { return st[j] === 'wait'; })[0];
            if (!target) return;
            joining = true; peer._sc_taken = true;
            joinVia(peer, game, target, function (c) { clearInterval(timer); if (cancelled) { c.close(); return; } onConn(c); },
              function () { joining = false; peer._sc_taken = false; });
          });
        }, 7000);
      });
      peer.on('connection', function (dc) {
        dc.on('open', function () {
          if (dc.metadata && dc.metadata.probe) { try { dc.send({ t: '__probe', busy: !!peer._sc_taken }); } catch (e) { /* 略過 */ } setTimeout(function () { try { dc.close(); } catch (e) { /* 略過 */ } }, 400); return; }
          if (peer._sc_taken) { try { dc.send({ t: '__full' }); } catch (e) { /* 略過 */ } setTimeout(function () { dc.close(); }, 300); return; }
          peer._sc_taken = true; clearInterval(timer); onConn(wrap(peer, dc, 'host', 'R' + k));
        });
      });
      peer.on('error', function (e) {
        if (!e || e.type === 'peer-unavailable' || cancelled) return;
        if (e.type === 'unavailable-id') { clearInterval(timer); try { peer.destroy(); } catch (x) { /* 略過 */ } search(Peer); return; }
        if (!peer._sc_taken) { kill(); onErr(e.type || 'error'); }
      });
    }
    lib().then(search, function () { onErr('load'); });
    return function cancel() { cancelled = true; kill(); };
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
    '.scn-note{font-size:12px!important;color:#7f8ba5!important}' +
    '.scn-btn.r{background:linear-gradient(#7fe0a8,#2fae6c);color:#06210f;font-size:17px;padding:14px}.scn-cnt{font-size:13px;color:#9fe3bb;text-align:center;margin-top:6px;min-height:18px}.scn-hr{border:0;border-top:1px solid #33415e;margin:14px 0 4px}';
  var styled = false;
  function errText(e) {
    return ({ 'peer-unavailable': T('找不到這個房號。請確認房號，並請房主回到遊戲頁面（手機切到別的 App 時房間會暫停）。', 'Room not found. Check the code and ask the host to return to the game page (a room pauses while the host is in another app).'),
      full: T('這個房間已經有人了。', 'This room is already full.'), timeout: T('連線逾時，請再試一次；若一直失敗，請雙方都改用 Wi-Fi 或換一個網路。', 'Connection timed out. Please try again; if it keeps failing, both players should try Wi-Fi or another network.'),
      'socket-error': T('和配對伺服器的連線中斷，請再試一次。', 'Lost the connection to the matchmaking server. Please try again.'), 'socket-closed': T('和配對伺服器的連線中斷，請再試一次。', 'Lost the connection to the matchmaking server. Please try again.'),
      disconnected: T('和配對伺服器的連線中斷，請再試一次。', 'Lost the connection to the matchmaking server. Please try again.'), webrtc: T('點對點連線建立失敗，請雙方換個網路再試。', 'Could not set up the direct connection. Both players should try another network.'),
      network: T('無法連到配對伺服器，請檢查網路。', 'Cannot reach the matchmaking server. Check your connection.'), 'server-error': T('配對伺服器忙碌，請稍後再試。', 'Matchmaking server is busy. Please try again later.'),
      'busy-seats': T('隨機配對的座位暫時滿了，請稍後再試，或改用房號邀請朋友。', 'Random-match seats are full right now. Try again soon, or invite a friend with a room code.'),
      load: T('連線元件載入失敗，請重新整理頁面。', 'Failed to load the online module. Please reload.'), 'browser-incompatible': T('這個瀏覽器不支援線上對戰。若是在 LINE、Facebook 裡開啟，請改用 Safari 或 Chrome 開啟網頁。', 'This browser does not support online play. If you opened it inside LINE or Facebook, open the page in Safari or Chrome instead.') })[e] || T('連線失敗（' + e + '），請再試一次。', 'Connection failed (' + e + '). Please try again.');
  }
  function openLobby(o) {
    if (!styled) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); styled = true; }
    var ov = document.createElement('div'); ov.className = 'scn-ov'; document.body.appendChild(ov);
    var cancel = null, closed = false, homeGen = 0;
    function close() { if (closed) return; closed = true; if (cancel) cancel(); ov.remove(); if (o.onCancel) o.onCancel(); }
    function done(conn) { closed = true; ov.remove(); o.onReady(conn); }
    if (window.SC) SC.onBack(function () { if (!closed) { close(); return true; } return false; });
    function home() {
      if (cancel) { cancel(); cancel = null; }
      ov.innerHTML = '<div class="scn-box"><h2>🌐 ' + T('線上對戰', 'Play online') + '・' + o.title + '</h2>' +
        '<div class="scn-row"><button class="scn-btn r" data-a="rand">🎲 ' + T('隨機配對', 'Random match') + '</button></div>' +
        '<div class="scn-cnt"><span class="scn-spin"></span>' + T('估算等待人數中…', 'Checking who is waiting…') + '</div>' +
        '<hr class="scn-hr"><p>' + T('和朋友對戰：建立房間後把房號或連結傳給朋友。', 'Play a friend: create a room and send them the code or link.') + '</p>' +
        '<div class="scn-row"><button class="scn-btn" data-a="host">' + T('建立房間', 'Create room') + '</button></div>' +
        '<p style="margin-top:14px">' + T('或輸入朋友的房號：', 'Or enter a friend\'s room code:') + '</p>' +
        '<input class="scn-in" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters">' +
        '<div class="scn-row"><button class="scn-btn" data-a="join">' + T('加入房間', 'Join room') + '</button><button class="scn-btn g" data-a="close">' + T('取消', 'Cancel') + '</button></div>' +
        '<div class="scn-st"></div><p class="scn-note">' + T('點對點連線，不需註冊；對局資料直接在你和對手的裝置間傳送。', 'Peer-to-peer, no sign-up. Game data goes directly between the two devices.') + '</p></div>';
      var inp = ov.querySelector('.scn-in'), st = ov.querySelector('.scn-st');
      if (o.code) inp.value = o.code;
      inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      ov.querySelector('[data-a=host]').onclick = hosting;
      ov.querySelector('[data-a=rand]').onclick = randoming;
      ov.querySelector('[data-a=close]').onclick = close;
      var cnt = ov.querySelector('.scn-cnt'), gen = ++homeGen;
      (function refresh() {
        estimate(o.game).then(function (r) {
          if (closed || gen !== homeGen || !cnt.isConnected) return;
          cnt.textContent = r ? (r.waiting ? T('目前約 ' + r.waiting + ' 人在等隨機配對', 'About ' + r.waiting + ' waiting for a random match') : T('目前沒人在等，按下去就是第一位', 'Nobody is waiting yet — be the first')) + (r.playing ? T('・' + r.playing + ' 局對戰中', ' · ' + r.playing + ' games in progress') : '') : '';
          setTimeout(refresh, 15000);
        });
      })();
      ov.querySelector('[data-a=join]').onclick = function () {
        var c = inp.value.trim().toUpperCase(); if (c.length !== 6) { st.className = 'scn-st err'; st.textContent = T('房號是 6 個字元', 'Room codes have 6 characters'); return; }
        st.className = 'scn-st'; st.innerHTML = '<span class="scn-spin"></span>' + T('連線中…', 'Connecting…');
        this.disabled = true; var btn = this;
        cancel = join(o.game, c, done, function (e) { st.className = 'scn-st err'; st.textContent = errText(e); btn.disabled = false; cancel = null; });
      };
      if (o.code && o.autoJoin) ov.querySelector('[data-a=join]').click();
    }
    function randoming() {
      homeGen++;
      var t0 = Date.now();
      ov.innerHTML = '<div class="scn-box"><h2>🎲 ' + T('隨機配對', 'Random match') + '・' + o.title + '</h2>' +
        '<div class="scn-st" style="font-size:15px;color:#e6ebf5"><span class="scn-spin"></span>' + T('尋找對手中…', 'Looking for an opponent…') + '</div>' +
        '<div class="scn-cnt"></div><div class="scn-row"><button class="scn-btn g" data-a="back">' + T('取消', 'Cancel') + '</button></div>' +
        '<p class="scn-note">' + T('找到對手會自動開局，等待時請不要關閉這個頁面。', 'The game starts automatically when someone is found. Keep this page open.') + '</p></div>';
      var st = ov.querySelector('.scn-st'), cnt = ov.querySelector('.scn-cnt'), tick = null;
      ov.querySelector('[data-a=back]').onclick = function () { clearInterval(tick); home(); };
      function sec() { return Math.floor((Date.now() - t0) / 1000); }
      cancel = random(o.game, function (s) {
        if (s.phase === 'search') { st.innerHTML = '<span class="scn-spin"></span>' + T('尋找對手中…', 'Looking for an opponent…'); return; }
        st.innerHTML = '<span class="scn-spin"></span>' + T('等待對手加入中… ', 'Waiting for an opponent… ') + '<b class="scn-sec">' + sec() + 's</b>';
        cnt.textContent = s.waiting ? T('另外約有 ' + s.waiting + ' 人在等，正在嘗試配對', 'About ' + s.waiting + ' others waiting — trying to pair') : T('你是目前第一位在等的玩家，有人按隨機配對就會配到你', 'You are first in line — the next player to tap Random match will join you');
        if (!tick) tick = setInterval(function () { var b = ov.querySelector('.scn-sec'); if (b) b.textContent = sec() + 's'; }, 1000);
      }, function (conn) { clearInterval(tick); done(conn); }, function (e) { clearInterval(tick); st.className = 'scn-st err'; st.textContent = errText(e); cancel = null; });
    }
    function hosting() {
      homeGen++;
      if ((o.max || 2) > 2) return hostingMulti();
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
    // 多人房間（大老二、麻將）：房主看到已加入人數，按「開始」才開局，空位由電腦補
    function hostingMulti() {
      var conns = [], link = '';
      ov.innerHTML = '<div class="scn-box"><h2>🌐 ' + T('建立房間', 'Your room') + '・' + o.title + '</h2><p>' + T('把房號告訴朋友（最多 ' + (o.max - 1) + ' 位）：', 'Share this code (up to ' + (o.max - 1) + ' friends):') + '</p>' +
        '<div class="scn-code">······</div><div class="scn-cnt scn-who"></div>' +
        '<div class="scn-row"><button class="scn-btn" data-a="copy" disabled>' + T('複製邀請連結', 'Copy invite link') + '</button></div>' +
        '<div class="scn-row"><button class="scn-btn r" data-a="go" disabled>' + T('開始（空位由電腦補）', 'Start (AI fills empty seats)') + '</button><button class="scn-btn g" data-a="back">' + T('返回', 'Back') + '</button></div>' +
        '<div class="scn-st"><span class="scn-spin"></span>' + T('建立房間中…', 'Creating room…') + '</div></div>';
      var st = ov.querySelector('.scn-st'), cp = ov.querySelector('[data-a=copy]'), go = ov.querySelector('[data-a=go]'), who = ov.querySelector('.scn-who');
      function upd() {
        who.textContent = T('已加入：' + conns.length + ' 位朋友', 'Joined: ' + conns.length + ' friend(s)') + (conns.length ? '（' + conns.map(function (c) { return c.name || '?'; }).join('、') + '）' : '');
        go.disabled = !conns.length;
      }
      ov.querySelector('[data-a=back]').onclick = function () { conns.forEach(function (c) { c.close(); }); if (cancel && cancel.destroy) cancel.destroy(); cancel = null; home(); };
      cp.onclick = function () {
        var txt = T('來跟我玩' + o.title + '！房號 ', 'Play ' + o.title + ' with me! Room code ') + link.split('room=')[1] + '\n' + link;
        if (navigator.share) { navigator.share({ title: o.title, text: txt, url: link }).catch(function () { /* 略過 */ }); return; }
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { cp.textContent = T('已複製！', 'Copied!'); }, function () { window.prompt(T('複製這個連結：', 'Copy this link:'), link); });
      };
      go.onclick = function () {
        if (!conns.length) return;
        if (cancel && cancel.lock) cancel.lock();
        conns.forEach(function (c) { c.onData = null; c.onClose = null; });
        closed = true; ov.remove(); o.onRoom(conns.slice());
      };
      cancel = host(o.game, function (code) {
        ov.querySelector('.scn-code').textContent = code; cp.disabled = false;
        link = location.origin + location.pathname + '?room=' + code;
        st.innerHTML = '<span class="scn-spin"></span>' + T('等朋友加入，人到齊就按開始', 'Waiting for friends. Press Start when ready');
        upd();
      }, function (c) {
        conns.push(c);
        c.onData = function (m) { if (m && m.t === 'hello') { c.name = String(m.name || '').slice(0, 16); upd(); } };
        c.onClose = function () { conns = conns.filter(function (x) { return x !== c; }); upd(); };
        c.send({ t: 'lobby' });
        upd(); if (window.K && K.beep) K.beep(660, 0.12, 'triangle', 0.06);
      }, function (e) { st.className = 'scn-st err'; st.textContent = errText(e); }, o.max);
    }
    home();
    return close;
  }
  // 網址帶 ?room= 時回傳房號
  function roomFromUrl() { var m = /[?&]room=([A-Za-z0-9]{6})\b/.exec(location.search); return m ? m[1].toUpperCase() : null; }
  function clearRoomFromUrl() { if (history.replaceState) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]room=[A-Za-z0-9]{6}/, '').replace(/^&/, '?') + location.hash); }
  window.SCNet = { openLobby: openLobby, host: host, join: join, random: random, estimate: estimate, roomFromUrl: roomFromUrl, clearRoomFromUrl: clearRoomFromUrl, EMOTES: ['👍', '😂', '😮', '😡', '🙏', '👋'] };
})();
