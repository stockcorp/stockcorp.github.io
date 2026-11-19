/* stockcorp.github.io 共用：全球排行榜（後端在 Linode：game.ldigi.com.tw/api/score.php，本檔沒有任何密碼）
   流程：開局 SCLB.start(game, mode) 向伺服器拿一張「開局憑證」存在瀏覽器；
         結算 SCLB.offer({ game, mode, score, text }) 跳出「上傳到排行榜」視窗，輸入暱稱後送出（憑證只能用一次）。
   棋類的成績（勝局秒數）由伺服器依憑證時間計算，前端送的 score 不採用。
   伺服器連不上時全部靜默略過，不影響遊戲。 */
(function () {
  'use strict';
  var API = 'https://game.ldigi.com.tw/api/score.php';
  var T = function (zh, en) { return window.SC ? SC.t(zh, en) : zh; };
  var get = function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  var put = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 略過 */ } };
  var KEY = function (game) { return 'sc_lb_tok_' + game; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function start(game, mode) {
    put(KEY(game), null);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch(API + '?action=start&game=' + encodeURIComponent(game) + '&mode=' + encodeURIComponent(mode), { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { put(KEY(game), { token: j.token, mode: String(mode), t: Date.now() }); return j.token; } return null; })
      .catch(function () { return null; });
  }
  function elapsed(game) { var t = get(KEY(game)); return t && t.t ? Math.max(0, Math.round((Date.now() - t.t) / 1000)) : 0; }
  function has(game, mode) { var t = get(KEY(game)); return !!(t && t.token && (mode == null || t.mode === String(mode))); }

  var css = '.sclb-ov{position:fixed;inset:0;z-index:2147483100;background:rgba(5,8,15,.78);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}' +
    '.sclb-box{width:100%;max-width:380px;background:#141a29;border:1px solid #2a3550;border-radius:18px;padding:20px;color:#e6ebf5;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.5)}' +
    '.sclb-box h3{margin:0 0 6px;font-size:20px}.sclb-box p{margin:6px 0;color:#aab4cc;font-size:14px;line-height:1.55}' +
    '.sclb-score{font-size:28px;font-weight:800;color:#f5b83d;margin:8px 0}' +
    '.sclb-box input{width:100%;box-sizing:border-box;margin:10px 0 4px;padding:12px 14px;border-radius:12px;border:1px solid #2a3550;background:#0b0f19;color:#fff;font-size:16px;text-align:center}' +
    '.sclb-row{display:flex;gap:8px;margin-top:12px}.sclb-row button,.sclb-row a{flex:1;padding:12px;border-radius:12px;border:1px solid #2a3550;background:#1c2438;color:#e6ebf5;font-size:15px;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center}' +
    '.sclb-row .go{background:linear-gradient(135deg,#f5b83d,#ef8f3d);color:#1a1205;border:0;font-weight:800}.sclb-msg{min-height:20px;font-size:13px;color:#ff8a8a}';
  var styled = false;
  function ui(html) {
    if (!styled) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); styled = true; }
    var ov = document.createElement('div'); ov.className = 'sclb-ov'; ov.innerHTML = '<div class="sclb-box" role="dialog">' + html + '</div>';
    // 輸入暱稱時不要讓遊戲收到按鍵
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) { ov.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    document.body.appendChild(ov);
    var back = function () { close(); return true; };
    function close() { ov.remove(); }
    if (window.SC) SC.onBack(function () { if (document.body.contains(ov)) return back(); return false; });
    return { el: ov, close: close };
  }
  var ERR = {
    tooFast: ['這局太快了，未列入排行榜', 'This game was too short to count'],
    used: ['這局成績已經上傳過了', 'This game was already submitted'],
    expired: ['這局開始太久了，請重新開一局', 'This game is too old. Please start a new one'],
    rate: ['上傳太頻繁，請稍後再試', 'Too many submissions. Try again later'],
    name: ['請輸入暱稱', 'Please enter a nickname'],
    range: ['成績超出範圍，未列入', 'Score out of range'],
    score: ['成績異常，未列入', 'Invalid score']
  };
  function boardUrl(game, mode) { return '/leaderboard/?game=' + encodeURIComponent(game) + '&mode=' + encodeURIComponent(mode); }

  // 結算時呼叫：o = { game, mode, score, text }，text 是要顯示的成績文字
  function offer(o) {
    var tk = get(KEY(o.game));
    if (!tk || !tk.token || tk.mode !== String(o.mode)) return false;
    var name = get('sc_lb_name') || '';
    var u = ui('<h3>🏆 ' + T('上傳到全球排行榜？', 'Submit to the global leaderboard?') + '</h3>' +
      '<div class="sclb-score">' + esc(o.text || o.score) + '</div>' +
      '<p>' + T('輸入暱稱（最多 16 個字），排行榜會公開顯示。', 'Pick a nickname (max 16 characters). It will be shown publicly.') + '</p>' +
      '<input maxlength="16" autocomplete="nickname" enterkeyhint="send" value="' + esc(name) + '" placeholder="' + T('你的暱稱', 'Your nickname') + '">' +
      '<div class="sclb-msg"></div>' +
      '<div class="sclb-row"><button type="button" class="no">' + T('不用了', 'No thanks') + '</button><button type="button" class="go">' + T('上傳', 'Submit') + '</button></div>');
    var inp = u.el.querySelector('input'), msg = u.el.querySelector('.sclb-msg'), go = u.el.querySelector('.go'), busy = false;
    setTimeout(function () { try { inp.focus(); } catch (e) { /* 略過 */ } }, 50);
    u.el.querySelector('.no').onclick = function () { u.close(); };
    function send() {
      if (busy) return; var n = inp.value.trim();
      if (!n) { msg.textContent = T('請輸入暱稱', 'Please enter a nickname'); return; }
      busy = true; go.textContent = T('上傳中…', 'Sending…'); put('sc_lb_name', n);
      var body = new URLSearchParams({ action: 'submit', token: tk.token, name: n, score: String(o.score), lang: window.SC ? SC.lang : 'zh' });
      fetch(API, { method: 'POST', body: body, credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          put(KEY(o.game), null);
          u.el.querySelector('.sclb-box').innerHTML = '<h3>🎉 ' + T('上傳成功！', 'Submitted!') + '</h3>' +
            '<p>' + T('目前全球排名', 'Your global rank') + '</p><div class="sclb-score">#' + j.rank + '</div>' +
            '<div class="sclb-row"><button type="button" class="no">' + T('關閉', 'Close') + '</button><a class="go" href="' + boardUrl(o.game, o.mode) + '">' + T('看排行榜', 'View leaderboard') + '</a></div>';
          u.el.querySelector('.no').onclick = function () { u.close(); };
          if (window.SC) SC.post('leaderboard', { game: o.game, mode: o.mode, rank: j.rank });
        } else {
          var e = ERR[j && j.error] || ['上傳失敗，請稍後再試', 'Upload failed. Please try again later'];
          if (j && /used|expired|tooFast|range|score/.test(j.error)) put(KEY(o.game), null);
          msg.textContent = T(e[0], e[1]); busy = false; go.textContent = T('上傳', 'Submit');
        }
      }).catch(function () { msg.textContent = T('連不上排行榜伺服器，請稍後再試', 'Cannot reach the leaderboard server'); busy = false; go.textContent = T('上傳', 'Submit'); });
    }
    go.onclick = send;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    return true;
  }
  function top(game, mode, period, limit) {
    return fetch(API + '?action=top&game=' + encodeURIComponent(game) + '&mode=' + encodeURIComponent(mode) + '&period=' + (period || 'all') + '&limit=' + (limit || 50), { credentials: 'omit' }).then(function (r) { return r.json(); });
  }
  window.SCLB = { API: API, start: start, has: has, elapsed: elapsed, offer: offer, top: top, url: boardUrl };
})();
