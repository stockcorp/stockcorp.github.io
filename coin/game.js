/* 金幣大亨 — stockcorp.github.io/coin/
   10 分鐘急速經營：點金幣、買事業（每秒收入）、一次性升級、幸運金幣。
   排行榜：mode 10min，分數 = 時間到時的累計收入（越高越好）。伺服器要求開局到上傳至少 590 秒。 */
(function () {
  'use strict';
  var GAME = 'coin', MODE = '10min', DUR = 600, SAVE = 'sccoin_save', $ = K.$, L = K.L;
  var BIZ = [
    { ic: '🍋', zh: '檸檬水攤', en: 'Lemonade Stand', c: 15, r: 1 },
    { ic: '🍗', zh: '雞排攤', en: 'Fried Chicken Stall', c: 100, r: 6 },
    { ic: '🏪', zh: '便利商店', en: 'Convenience Store', c: 1100, r: 36 },
    { ic: '🧋', zh: '手搖飲連鎖', en: 'Bubble Tea Chain', c: 12000, r: 200 },
    { ic: '🎡', zh: '夜市集團', en: 'Night Market Group', c: 130000, r: 1100 },
    { ic: '💻', zh: '科技新創', en: 'Tech Startup', c: 1.4e6, r: 6500 },
    { ic: '🏭', zh: '晶圓廠', en: 'Chip Fab', c: 2e7, r: 42000 },
    { ic: '🚀', zh: '太空礦業', en: 'Space Mining', c: 3e8, r: 280000 },
    { ic: '⏳', zh: '時光銀行', en: 'Time Bank', c: 5e9, r: 2e6 }
  ];
  var GROW = 1.13, MILES = [10, 25, 50, 100, 150, 200];
  var UPS = [
    { id: 't1', ic: '👆', zh: '金手指', en: 'Golden Finger', dzh: '點擊 ×2', den: 'Tap ×2', c: 100, tap: 2 },
    { id: 'a1', ic: '📣', zh: '街頭傳單', en: 'Street Flyers', dzh: '所有事業收入 ×1.5', den: 'All income ×1.5', c: 3000, all: 1.5 },
    { id: 't2', ic: '🖐️', zh: '鑽石手', en: 'Diamond Hands', dzh: '點擊 ×3', den: 'Tap ×3', c: 20000, tap: 3 },
    { id: 'm1', ic: '🧲', zh: '幸運磁鐵', en: 'Lucky Magnet', dzh: '幸運金幣出現更頻繁', den: 'Lucky coins appear more often', c: 80000, magnet: 1 },
    { id: 'a2', ic: '📺', zh: '電視廣告', en: 'TV Ads', dzh: '所有事業收入 ×2', den: 'All income ×2', c: 500000, all: 2 },
    { id: 't3', ic: '🤖', zh: '自動點擊機', en: 'Auto Tapper', dzh: '每秒自動點 5 下', den: '5 automatic taps per second', c: 3e6, auto: 5 },
    { id: 'a3', ic: '🌏', zh: '跨國併購', en: 'Global Merger', dzh: '所有事業收入 ×2', den: 'All income ×2', c: 6e7, all: 2 },
    { id: 't4', ic: '⚡', zh: '閃電手', en: 'Lightning Hands', dzh: '點擊 ×5', den: 'Tap ×5', c: 2e8, tap: 5 },
    { id: 'a4', ic: '🪐', zh: '星際品牌', en: 'Galactic Brand', dzh: '所有事業收入 ×3', den: 'All income ×3', c: 8e9, all: 3 }
  ];
  var S = null, qty = '1', last = 0, tapLog = [], goldT = null, ended = false, offered = false;

  // ---------- 數字格式 ----------
  function fmt(n) {
    if (n < 100 && n % 1 > 0.05) return n.toFixed(1);
    n = Math.floor(n);
    if (window.SC && SC.lang === 'en') {
      var u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'], i = 0;
      while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
      return (i ? n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) : n) + u[i];
    }
    var z = [[1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '萬']];
    for (var k = 0; k < z.length; k++) if (n >= z[k][0]) { var v = n / z[k][0]; return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + z[k][1]; }
    return String(n);
  }

  // ---------- 計算 ----------
  function fresh() { return { t0: 0, cash: 0, total: 0, own: BIZ.map(function () { return 0; }), ups: {}, feverUntil: 0, nextGold: 0, done: false }; }
  function cost(i, n) { var b = BIZ[i], o = S.own[i]; return b.c * Math.pow(GROW, o) * (Math.pow(GROW, n) - 1) / (GROW - 1); }
  function maxBuy(i) { var b = BIZ[i], o = S.own[i], base = b.c * Math.pow(GROW, o); return Math.max(0, Math.floor(Math.log(S.cash * (GROW - 1) / base + 1) / Math.log(GROW))); }
  function mult(i) { var m = 1, o = S.own[i]; MILES.forEach(function (x) { if (o >= x) m *= 2; }); return m; }
  function allMult() { var m = 1; UPS.forEach(function (u) { if (S.ups[u.id] && u.all) m *= u.all; }); return m; }
  function fever() { return Date.now() < S.feverUntil ? 7 : 1; }
  function ipsBase() { var s = 0; for (var i = 0; i < BIZ.length; i++) s += BIZ[i].r * S.own[i] * mult(i); return s * allMult(); }
  function ips() { return ipsBase() * fever() + autoTaps() * tapVal(); }
  function tapMult() { var m = 1; UPS.forEach(function (u) { if (S.ups[u.id] && u.tap) m *= u.tap; }); return m; }
  function tapVal() { return (1 + ipsBase() * 0.04) * tapMult() * fever(); }
  function autoTaps() { var a = 0; UPS.forEach(function (u) { if (S.ups[u.id] && u.auto) a += u.auto; }); return a; }
  function left() { return S.t0 ? Math.max(0, DUR - (Date.now() - S.t0) / 1000) : DUR; }
  function earn(x) { S.cash += x; S.total += x; }

  // ---------- 主迴圈 ----------
  function loop() {
    var now = Date.now();
    if (S.t0 && !S.done) {
      var end = S.t0 + DUR * 1000, to = Math.min(now, end), dt = Math.max(0, (to - last) / 1000);
      if (dt > 0) {
        // 狂熱可能在這段時間內結束，分兩段算
        var base = ipsBase(), aut = autoTaps() * (1 + base * 0.04) * tapMult(), fe = Math.max(0, Math.min(to, S.feverUntil) - last) / 1000;
        earn((base + aut) * (dt - fe) + (base + aut) * 7 * fe);
      }
      last = to;
      if (now >= end) finish();
      if (now >= S.nextGold && !goldT && !S.done) spawnGold();
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- 操作 ----------
  function tap(e) {
    if (!S.t0 || S.done) return;
    var now = Date.now(); tapLog = tapLog.filter(function (t) { return now - t < 1000; });
    if (tapLog.length >= 15) return; // 每秒最多 15 下
    tapLog.push(now);
    var v = tapVal(); earn(v);
    var c = $('coin'); c.classList.add('hit'); setTimeout(function () { c.classList.remove('hit'); }, 60);
    var r = c.getBoundingClientRect(), x = e && e.clientX ? e.clientX : r.left + r.width / 2, y = e && e.clientY ? e.clientY : r.top + r.height / 3;
    floatText('+' + fmt(v), x - 20 + Math.random() * 40, y - 10);
    K.beep(880 + Math.random() * 200, 0.04, 'square', 0.025);
  }
  function floatText(t, x, y) {
    var f = document.createElement('div'); f.className = 'fly'; f.textContent = t; f.style.left = x + 'px'; f.style.top = y + 'px';
    document.body.appendChild(f); setTimeout(function () { f.remove(); }, 800);
  }
  function buy(i) {
    if (!S.t0 || S.done) return;
    var n = qty === 'max' ? maxBuy(i) : +qty; if (n < 1) return;
    var c = cost(i, n); if (c > S.cash + 1e-9) return;
    var before = mult(i);
    S.cash -= c; S.own[i] += n;
    if (mult(i) > before) { K.toast(L(BIZ[i].zh + ' 收入翻倍！', BIZ[i].en + ' income doubled!')); K.beep(660, 0.25, 'triangle', 0.06, 1320); }
    else K.beep(520, 0.07, 'triangle', 0.05);
    persist(); drawShop(true);
  }
  function buyUp(id) {
    var u = UPS.filter(function (x) { return x.id === id; })[0];
    if (!u || S.ups[id] || S.cash < u.c || !S.t0 || S.done) return;
    S.cash -= u.c; S.ups[id] = 1; K.beep(740, 0.25, 'triangle', 0.06, 1480);
    K.toast(L(u.zh + '：' + u.dzh, u.en + ': ' + u.den)); persist(); drawUps(true);
  }

  // ---------- 幸運金幣 ----------
  function schedGold() { var m = S.ups.m1 ? 0.55 : 1; S.nextGold = Date.now() + (25 + Math.random() * 35) * 1000 * m; }
  function spawnGold() {
    var g = $('gold'), w = innerWidth, h = innerHeight, y0 = h * (0.2 + Math.random() * 0.5), ltr = Math.random() < 0.5, t0 = performance.now(), dur = 7000;
    g.hidden = false;
    function step(t) {
      if (g.hidden) return;
      var p = (t - t0) / dur; if (p >= 1) { hideGold(); return; }
      var x = ltr ? -60 + (w + 120) * p : w + 60 - (w + 120) * p;
      g.style.left = x + 'px'; g.style.top = (y0 + Math.sin(p * 12) * 40) + 'px';
      requestAnimationFrame(step);
    }
    goldT = requestAnimationFrame(step);
  }
  function hideGold() { $('gold').hidden = true; goldT = null; schedGold(); }
  $('gold').addEventListener('pointerdown', function (e) {
    e.preventDefault(); if (S.done) return;
    var r = $('gold').getBoundingClientRect();
    if (Math.random() < 0.5) { S.feverUntil = Date.now() + 15000; floatText(L('狂熱 ×7！', 'Frenzy ×7!'), r.left, r.top); K.beep(500, 0.5, 'sawtooth', 0.05, 1500); }
    else { var bonus = Math.max(77, ipsBase() * 90 + tapVal() * 30); earn(bonus); floatText('+' + fmt(bonus), r.left, r.top); K.beep(1200, 0.3, 'triangle', 0.06, 2000); }
    hideGold(); persist();
  });

  // ---------- 開始／結束 ----------
  function begin() {
    S = fresh(); S.t0 = Date.now(); last = S.t0; ended = false; offered = false; S.cash = 15;
    schedGold(); persist(); K.close('ovStart'); drawShop(true); drawUps(true);
    if (window.SCLB) SCLB.start(GAME, MODE);
    if (window.SC) SC.post('start', { game: GAME });
  }
  function finish() {
    if (S.done) return;
    S.done = true; persist(); $('gold').hidden = true;
    var tot = Math.floor(S.total), best = K.load('sccoin_best', 0);
    if (tot > best) K.save('sccoin_best', tot);
    $('endTotal').textContent = fmt(tot);
    $('endBiz').textContent = S.own.reduce(function (a, b) { return a + b; }, 0);
    $('endBest').textContent = tot > best ? L('🎉 新的個人紀錄！', '🎉 New personal best!') : L('個人最佳：', 'Personal best: ') + fmt(best);
    K.open('ovEnd'); K.beep(392, 0.6, 'triangle', 0.07, 784);
    if (window.SC) SC.post('gameover', { game: GAME, score: tot });
    $('bUpload').style.display = window.SCLB && SCLB.has(GAME, MODE) ? '' : 'none';
    setTimeout(upload, 600);
  }
  function upload() {
    if (!window.SCLB) return;
    var tot = Math.floor(S.total);
    if (SCLB.offer({ game: GAME, mode: MODE, score: tot, text: fmt(tot) })) offered = true;
  }

  // ---------- 畫面 ----------
  var rows = [], upEls = {};
  function buildShop() {
    var box = $('biz'); box.innerHTML = '';
    BIZ.forEach(function (b, i) {
      var d = document.createElement('div'); d.className = 'b';
      d.innerHTML = '<div class="ic">' + b.ic + '</div><div><div class="nm"><span class="n"></span><em class="o">0</em></div><div class="sub"></div><div class="bar"><i></i></div></div><button type="button"><span class="bl"></span><small class="bc"></small></button>';
      d.querySelector('button').onclick = function () { buy(i); };
      box.appendChild(d); rows.push(d);
    });
  }
  var lastShop = 0;
  function drawShop(force) {
    var now = Date.now(); if (!force && now - lastShop < 120) return; lastShop = now;
    var en = window.SC && SC.lang === 'en', shown = 0;
    BIZ.forEach(function (b, i) {
      var d = rows[i], o = S.own[i], n = qty === 'max' ? Math.max(1, maxBuy(i)) : +qty, c = cost(i, n), can = S.t0 && !S.done && c <= S.cash;
      var visible = i === 0 || S.own[i - 1] > 0 || S.total >= b.c * 0.3;
      d.classList.toggle('hide', !visible && shown > 0 && i > 0 && S.own[i - 1] === 0 && S.total < BIZ[i - 1].c * 0.3);
      d.classList.toggle('lock', !visible);
      if (visible) shown++;
      d.querySelector('.n').textContent = visible ? (en ? b.en : b.zh) : '？？？';
      d.querySelector('.o').textContent = o;
      var nx = MILES.filter(function (x) { return x > o; })[0];
      d.querySelector('.sub').textContent = (en ? 'Each ' : '每間 ') + fmt(b.r * mult(i) * allMult()) + (en ? '/s · total ' : '/秒 · 共 ') + fmt(b.r * o * mult(i) * allMult()) + (en ? '/s' : '/秒') + (nx ? (en ? ' · ×2 at ' : ' · ') + nx + (en ? '' : ' 間翻倍') : '');
      var prev = MILES.filter(function (x) { return x <= o; }).pop() || 0;
      d.querySelector('.bar i').style.width = nx ? ((o - prev) / (nx - prev) * 100) + '%' : '100%';
      var btn = d.querySelector('button');
      btn.disabled = !can;
      d.querySelector('.bl').textContent = (en ? 'Buy ×' : '買 ×') + n;
      d.querySelector('.bc').textContent = '$' + fmt(c);
    });
  }
  function drawUps(force) {
    if (!force && Date.now() - lastShop > 10) { /* 跟商店同步更新 */ }
    var box = $('ups'), list = UPS.filter(function (u) { return !S.ups[u.id]; }).slice(0, 3), en = window.SC && SC.lang === 'en';
    var key = list.map(function (u) { return u.id; }).join(',') + (en ? 'e' : 'z');
    if (box.dataset.k !== key) {
      box.dataset.k = key; box.innerHTML = '';
      list.forEach(function (u) {
        var b = document.createElement('button'); b.className = 'up'; b.type = 'button'; b.dataset.id = u.id;
        b.innerHTML = '<span>' + u.ic + '</span><b>' + K.esc(en ? u.en : u.zh) + '<br><span class="mute" style="font-weight:400;font-size:12px">' + K.esc(en ? u.den : u.dzh) + '</span></b><small>$' + fmt(u.c) + '</small>';
        b.onclick = function () { buyUp(u.id); };
        box.appendChild(b);
      });
    }
    [].forEach.call(box.children, function (b) { var u = UPS.filter(function (x) { return x.id === b.dataset.id; })[0]; b.disabled = !S.t0 || S.done || S.cash < u.c; });
  }
  function draw() {
    $('cash').textContent = '$' + fmt(S.cash);
    $('ips').textContent = '$' + fmt(ips()) + '/s';
    $('total').textContent = '$' + fmt(S.total);
    $('perTap').textContent = '$' + fmt(tapVal());
    var lf = left(); $('timer').textContent = K.fmtTime(Math.ceil(lf));
    $('timer').parentNode.classList.toggle('warn', S.t0 && lf < 30 && !S.done);
    $('progBar').style.width = (100 - lf / DUR * 100) + '%';
    var fv = S.feverUntil - Date.now();
    $('fever').textContent = fv > 0 ? L('🔥 狂熱 ×7　', '🔥 Frenzy ×7 ') + Math.ceil(fv / 1000) + 's' : '';
    drawShop(); drawUps();
  }

  // ---------- 存檔 ----------
  function persist() { if (S.t0 && !S.done) S.saved = Math.min(Date.now(), S.t0 + DUR * 1000); K.save(SAVE, S); }
  setInterval(function () { if (S && S.t0 && !S.done) persist(); }, 2000);
  document.addEventListener('visibilitychange', function () { if (document.hidden && S && S.t0) persist(); });

  // ---------- 啟動 ----------
  buildShop();
  $('coin').addEventListener('pointerdown', function (e) { e.preventDefault(); tap(e); });
  document.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && e.target === document.body) { e.preventDefault(); if (!e.repeat) tap(); } });
  $('qty').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; qty = b.dataset.q; [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); drawShop(true); });
  $('bStart').onclick = begin;
  $('bAgain').onclick = function () { K.close('ovEnd'); showStart(); };
  $('bUpload').onclick = upload;
  $('bNew').onclick = function () {
    if (S.t0 && !S.done && !(Date.now() - (S.askNew || 0) < 2500)) { S.askNew = Date.now(); K.toast(L('再按一次「重新開始」放棄這局', 'Tap Restart again to abandon this run')); return; }
    K.close('ovEnd'); S = fresh(); persist(); showStart();
  };
  $('bSound').onclick = function () { K.setMute(!K.muted); snd(); };
  function snd() { $('bSound').textContent = K.muted ? '🔇' : '🔊'; } snd();
  function showStart() {
    S = fresh(); drawShop(true); drawUps(true);
    var best = K.load('sccoin_best', 0);
    $('bestLine').textContent = best ? L('個人最佳：$', 'Personal best: $') + fmt(best) : '';
    K.open('ovStart');
  }
  if (window.SC) SC.onLang(function () { drawShop(true); $('ups').dataset.k = ''; drawUps(true); });

  var sv = K.load(SAVE, null);
  if (sv && sv.t0 && !sv.done && sv.own && sv.own.length === BIZ.length) {
    // 接續上次：離開期間的收入從上次存檔時間補算（時間到就直接結算）
    S = sv; last = Math.max(S.t0, sv.saved || Date.now());
    drawShop(true); drawUps(true);
  } else showStart();
  requestAnimationFrame(loop);
})();
