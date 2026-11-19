/* 我愛操盤手 - 使用者介面（支援中／英文）*/
(function () {
  'use strict';
  const D = window.GAME_DATA, E = window.GameEngine, I = window.I18N, M = window.Market, R = D.RULES, CFG = window.SITE_CONFIG || {};
  const T = I.t;
  const SAVE_KEY = 'wacp_save_v2', LB_KEY = 'wacp_lb_v1';
  const COLORS = { cash: '#8b97b3', stock: '#4f8cff', crypto: '#f5b83d', fund: '#a78bfa', re: '#34d399' };
  const TABS = [['stock', '股票'], ['crypto', '加密貨幣'], ['re', '房地產'], ['fund', '基金'], ['loan', '借貸'], ['port', '資產總覽']];
  let S = null, tab = 'stock', sel = { kind: 'stock', id: '' }, range = 36, setup = null;

  const $ = id => document.getElementById(id);
  const money = E.fmtMoney;
  const full = n => Math.round(n).toLocaleString('en-US');
  const pct = (r, d) => (r > 0 ? '+' : '') + (r * 100).toFixed(d == null ? 2 : d) + '%';
  const cls = r => (r > 0.00005 ? 'up' : r < -0.00005 ? 'down' : 'mute');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nm = d => !d ? '' : (I.lang === 'en' ? (d.en || T(d.name)) : d.name);
  const fmtP = p => p >= 1000 ? full(p) : p >= 1 ? p.toFixed(2) : String(+p.toPrecision(4));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const firstStock = () => ({ kind: 'stock', id: S.cfg.stocks[0].id });

  /* ---------- 存檔 ---------- */
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ } }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 2 && s.cfg && s.stocks && s.crypto ? s : null;
    } catch (e) { return null; }
  }
  function getLB() { try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch (e) { return []; } }
  function addLB(entry) {
    const lb = getLB(); lb.push(entry);
    lb.sort((a, b) => b.nw - a.nw); lb.length = Math.min(lb.length, 10);
    try { localStorage.setItem(LB_KEY, JSON.stringify(lb)); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 資產資訊 ---------- */
  function info(kind, id) {
    if (kind === 'stock') {
      const d = S.cfg.stocks.find(x => x.id === id), o = S.stocks[id];
      return { name: esc(nm(d)), code: d.code || '', desc: d.real ? T(D.SECTOR_DEF[d.sector][2]) : T(d.desc), price: o.price, ptxt: o.price.toFixed(2), hist: o.hist, last: o.last, qty: o.shares, qtxt: T('{0} 股', [full(o.shares)]), value: o.shares * o.price, cost: o.cost,
        kv: [[T('產業'), T(D.SECTOR_NAMES[d.sector])], [T('年殖利率'), (d.div * 100).toFixed(1) + '%'], [T('敏感度 β'), d.beta.toFixed(1)], [T('月波動'), (d.vol * 100).toFixed(1) + '%']] };
    }
    if (kind === 'crypto') {
      const d = S.cfg.cryptos.find(x => x.id === id), o = S.crypto[id];
      return { name: nm(d), code: d.code, desc: T(D.CRYPTO_DESC), price: o.price, ptxt: fmtP(o.price), hist: o.hist, last: o.last, qty: o.units, qtxt: T('{0} 枚', [E.fmtUnits(o.units)]), value: o.units * o.price, cost: o.cost,
        kv: [[T('交易成本'), T('買賣各 0.5%')], [T('相對幣市的波動倍數'), d.beta.toFixed(2) + 'x'], [T('特性'), T('24 小時交易、波動極大')]] };
    }
    if (kind === 're') {
      const d = D.PROPERTIES.find(x => x.id === id), o = S.re[id];
      return { name: T(d.name), desc: T(d.desc), price: o.price, ptxt: full(o.price), hist: o.hist, last: o.last, qty: o.count, qtxt: T('{0} 間', [o.count]), value: o.count * o.price, cost: o.cost,
        kv: [[T('月租金'), full(o.rent)], [T('租金報酬率'), (o.rent * 12 / o.price * 100).toFixed(2) + '%'], [T('房貸餘額'), money(o.mortgage)], [T('買進／賣出成本'), T('3% ／ 4%')]] };
    }
    const d = D.FUNDS.find(x => x.id === id), o = S.funds[id];
    return { name: T(d.name), desc: T(d.desc), price: o.nav, ptxt: o.nav.toFixed(3), hist: o.hist, last: o.last, qty: o.units, qtxt: T('{0} 單位', [o.units.toFixed(2)]), value: o.units * o.nav, cost: o.cost,
      kv: [[T('風險等級'), T(d.risk)], [T('申購手續費'), (d.buyFee * 100).toFixed(1) + '%']] };
  }
  function yoy(hist) { const n = hist.length; return n > 13 ? hist[n - 1] / hist[n - 13] - 1 : hist[n - 1] / hist[0] - 1; }
  function monthLabel(i) { const m = i - E.WARMUP; return m <= 0 ? (m === 0 ? T('開局') : T('開局前{0}月', [-m])) : T('第{0}月', [m]); }

  /* ---------- 圖表 ---------- */
  function drawLine(cv, ys, o) {
    if (!cv) return; o = o || {};
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, hh = cv.clientHeight; if (!w || ys.length < 2) return;
    cv.width = w * dpr; cv.height = hh * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, hh);
    const pl = 62, pr = 10, pt = 10, pb = 22;
    let lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    if (o.line != null) { lo = Math.min(lo, o.line); hi = Math.max(hi, o.line); }
    if (hi === lo) { hi += 1; lo -= 1; }
    const mg = (hi - lo) * 0.08; lo -= mg; hi += mg;
    const X = i => pl + (w - pl - pr) * i / (ys.length - 1), Y = v => pt + (hh - pt - pb) * (1 - (v - lo) / (hi - lo));
    c.font = '11px sans-serif'; c.fillStyle = '#8b97b3'; c.strokeStyle = '#26304a'; c.lineWidth = 1; c.textAlign = 'right';
    for (let g = 0; g <= 3; g++) {
      const v = lo + (hi - lo) * g / 3, y = Y(v);
      c.beginPath(); c.moveTo(pl, y); c.lineTo(w - pr, y); c.stroke();
      c.fillText(o.fmt ? o.fmt(v) : (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)), pl - 6, y + 4);
    }
    const up = ys[ys.length - 1] >= ys[0], col = o.color || (up ? '#ef4444' : '#22c55e');
    if (o.line != null) {
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = '#f5b83d'; c.beginPath(); c.moveTo(pl, Y(o.line)); c.lineTo(w - pr, Y(o.line)); c.stroke(); c.restore();
      c.fillStyle = '#f5b83d'; c.textAlign = 'left'; c.fillText(T('目標'), pl + 4, Y(o.line) - 4);
    }
    const grd = c.createLinearGradient(0, pt, 0, hh - pb); grd.addColorStop(0, col + '55'); grd.addColorStop(1, col + '00');
    c.beginPath(); c.moveTo(X(0), Y(ys[0]));
    for (let i = 1; i < ys.length; i++) c.lineTo(X(i), Y(ys[i]));
    c.lineTo(X(ys.length - 1), hh - pb); c.lineTo(X(0), hh - pb); c.closePath(); c.fillStyle = grd; c.fill();
    c.beginPath(); c.strokeStyle = col; c.lineWidth = 2; c.lineJoin = 'round';
    for (let i = 0; i < ys.length; i++) i ? c.lineTo(X(i), Y(ys[i])) : c.moveTo(X(i), Y(ys[i]));
    c.stroke();
    if (o.ma) {
      c.beginPath(); c.strokeStyle = '#f5b83d'; c.lineWidth = 1.2; let started = false;
      for (let i = 0; i < o.ma.length; i++) { if (o.ma[i] == null) continue; if (started) c.lineTo(X(i), Y(o.ma[i])); else { c.moveTo(X(i), Y(o.ma[i])); started = true; } }
      c.stroke();
    }
    if (o.cost != null && o.cost > lo && o.cost < hi) {
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = '#a78bfa'; c.lineWidth = 1; c.beginPath(); c.moveTo(pl, Y(o.cost)); c.lineTo(w - pr, Y(o.cost)); c.stroke(); c.restore();
      c.fillStyle = '#a78bfa'; c.textAlign = 'left'; c.fillText(T('成本'), pl + 4, Y(o.cost) - 4);
    }
    c.beginPath(); c.arc(X(ys.length - 1), Y(ys[ys.length - 1]), 3.5, 0, 7); c.fillStyle = col; c.fill();
    c.fillStyle = '#8b97b3'; c.textAlign = 'left'; c.fillText(o.x0 || '', pl, hh - 6);
    c.textAlign = 'right'; c.fillText(o.x1 || '', w - pr, hh - 6);
  }
  function drawDonut(cv, items) {
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, hh = cv.clientHeight; if (!w) return;
    cv.width = w * dpr; cv.height = hh * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, hh);
    const total = items.reduce((a, b) => a + Math.max(0, b.value), 0), cx = w / 2, cy = hh / 2, r = Math.min(w, hh) / 2 - 8;
    if (total <= 0) { c.fillStyle = '#8b97b3'; c.textAlign = 'center'; c.fillText(T('尚無資產'), cx, cy); return; }
    let a0 = -Math.PI / 2;
    for (const it of items) {
      if (it.value <= 0) continue;
      const a1 = a0 + it.value / total * Math.PI * 2;
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a1); c.closePath(); c.fillStyle = it.color; c.fill(); a0 = a1;
    }
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx, cy, r * 0.58, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#e6ebf5'; c.textAlign = 'center'; c.font = 'bold 14px sans-serif'; c.fillText(T('總資產'), cx, cy - 2);
    c.font = '12px sans-serif'; c.fillStyle = '#8b97b3'; c.fillText(money(total), cx, cy + 16);
  }

  /* ---------- 靜態文字（語言切換）---------- */
  function applyStatic() {
    document.documentElement.lang = I.lang === 'en' ? 'en' : 'zh-Hant';
    document.title = T('我愛操盤手｜股票、比特幣、房地產、基金投資模擬遊戲');
    const md = document.querySelector('meta[name=description]'); if (md) md.content = T('免費的投資模擬遊戲：用 10 年時間操作股票、比特幣、房地產與基金，面對新聞事件、利率變化與追繳保證金，挑戰成為股神。');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = T(el.getAttribute('data-i18n')); });
    $('btnLang').textContent = I.lang === 'en' ? '中文' : 'EN';
    const pl = document.querySelector('a[data-privacy]'); if (pl) pl.href = 'privacy.html?lang=' + I.lang;
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    applyStatic(); renderStats(); renderTabs(); renderMain(); renderNews(); renderLog(); renderActions();
  }
  function renderStats() {
    const nw = E.netWorth(S), prev = S.netHist.length > 1 ? S.netHist[S.netHist.length - 2] : S.startCash;
    const dnw = nw - prev, debt = S.marginDebt + E.mortgageTotal(S), prog = clamp(nw / S.target, 0, 1);
    const yr = Math.floor(S.month / 12) + 1, mo = S.month % 12 + 1;
    $('dateBox').innerHTML = S.finished ? T('遊戲結束') + '<small>' + T('共 {0} 個月', [S.month]) + '</small>' : T('第 {0} 年 {1} 月', [Math.min(yr, 10), mo]) + '<small>' + T('已過 {0} / {1} 個月', [S.month, S.months]) + '</small>';
    $('stats').innerHTML =
      '<div class="stat"><div class="k">' + T('淨資產') + '</div><div class="v">' + money(nw) + '</div><div class="s ' + cls(dnw) + '">' + (S.month ? T('較上月 {0}', [(dnw >= 0 ? '+' : '') + money(dnw)]) : T('起始資金 {0}', [money(S.startCash)])) + '</div></div>' +
      '<div class="stat"><div class="k">' + T('現金') + '</div><div class="v">' + money(S.cash) + '</div><div class="s">' + T('月儲蓄 +{0}', [money(S.save)]) + '</div></div>' +
      '<div class="stat"><div class="k">' + T('總負債') + '</div><div class="v ' + (debt > 0 ? 'down' : '') + '">' + money(debt) + '</div><div class="s">' + T('利率 {0}', [(S.rate * 100).toFixed(2) + '%']) + '</div></div>' +
      '<div class="stat goal"><div class="k">' + T('目標 {0}', [money(S.target)]) + (S.won ? T('　🎉 已達成') : '') + '</div><div class="v">' + (nw / S.target * 100).toFixed(1) + '%</div><div class="bar"><i style="width:' + (prog * 100).toFixed(1) + '%"></i></div></div>';
  }
  function renderTabs() {
    $('tabs').innerHTML = TABS.map(t => '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + T(t[1]) + '</button>').join('');
  }
  function renderMain() {
    const lb = $('listBox'), db = $('detailBox');
    if (tab === 'loan') { lb.innerHTML = loanHTML(); db.style.display = 'none'; return; }
    if (tab === 'port') { lb.innerHTML = portHTML(); db.style.display = 'none'; requestAnimationFrame(drawPort); return; }
    db.style.display = '';
    let rows = '';
    const row = (kind, id) => {
      const f = info(kind, id);
      return '<tr class="row' + (sel.kind === kind && sel.id === id ? ' sel' : '') + '" data-act="sel" data-k="' + kind + '" data-v="' + id + '"><td class="name"><b>' + f.name + '</b>' + (f.code ? '<small class="code">' + f.code + '</small>' : '') + '</td><td>' + f.ptxt + '</td><td class="' + cls(f.last) + '">' + pct(f.last) + '</td><td class="' + cls(yoy(f.hist)) + '">' + pct(yoy(f.hist), 1) + '</td><td>' + (f.qty > 0 ? f.qtxt : '<span class="mute">—</span>') + '</td></tr>';
    };
    const head = '<tr><th>' + T('名稱') + '</th><th>' + (tab === 'fund' ? T('淨值') : T('價格')) + '</th><th>' + T('月漲跌') + '</th><th>' + T('近一年') + '</th><th>' + T('持有') + '</th></tr>';
    if (tab === 'stock') { if (sel.kind !== 'stock' || !S.stocks[sel.id]) sel = firstStock(); rows = S.cfg.stocks.map(s => row('stock', s.id)).join(''); }
    if (tab === 'crypto') { if (sel.kind !== 'crypto' || !S.crypto[sel.id]) sel = { kind: 'crypto', id: S.cfg.cryptos[0].id }; rows = S.cfg.cryptos.map(s => row('crypto', s.id)).join(''); }
    if (tab === 're') { if (sel.kind !== 're' || !S.re[sel.id]) sel = { kind: 're', id: D.PROPERTIES[0].id }; rows = D.PROPERTIES.map(s => row('re', s.id)).join(''); }
    if (tab === 'fund') { if (sel.kind !== 'fund' || !S.funds[sel.id]) sel = { kind: 'fund', id: D.FUNDS[0].id }; rows = D.FUNDS.map(s => row('fund', s.id)).join(''); }
    let note = '';
    const src = S.cfg.live ? T('最新收盤') : T('內建快照');
    if (tab === 'stock' && S.cfg.market === 'real') note = '<p class="mute" style="margin:8px 0 0;font-size:13px">' + T('真實市場模式：名稱、代號與起始價格取自臺灣證券交易所 {0}（{1}）；圖表上開局前後的走勢與新聞都是模擬。', [S.cfg.date, src]) + '</p>';
    if (tab === 'crypto') note = '<p class="mute" style="margin:8px 0 0;font-size:13px">' + T('起始價格為 CoinGecko 新台幣報價（{0}）；圖表上開局前後的走勢都是模擬。', [S.cfg.cryptoLive ? T('即時') : T('內建快照')]) + '</p>';
    if (tab === 're') note = '<p class="mute" style="margin:8px 0 0;font-size:13px">' + T('房市狀態：{0}　買房可用房貸（七成），利率 = 政策利率 + 1%，現值 {1}，每月淨租金約 {2}。', ['<b>' + T(D.RE_REG.names[S.reReg]) + '</b>', money(E.reValue(S)), money(E.monthlyRent(S))]) + '</p>';
    lb.innerHTML = '<h3>' + T(TABS.find(t => t[0] === tab)[1]) + '<small>' + T('點選一列查看走勢與交易　紅漲綠跌') + '</small></h3><div class="tbl-wrap"><table>' + head + rows + '</table></div>' + note;
    renderDetail();
  }
  function renderDetail() {
    const f = info(sel.kind, sel.id), pnl = f.value - f.cost, pr = f.cost > 0 ? pnl / f.cost : 0;
    const n = f.hist.length, from = range ? Math.max(0, n - 1 - range) : 0, ys = f.hist.slice(from);
    const ma = f.hist.map((v, i) => { if (i < 5) return null; let a = 0; for (let k = i - 5; k <= i; k++) a += f.hist[k]; return a / 6; }).slice(from);
    const yr = f.hist.slice(Math.max(0, n - 13)), hi = Math.max.apply(null, yr), lo = Math.min.apply(null, yr);
    const avgCost = f.qty > 0 && f.cost > 0 ? f.cost / f.qty : null;
    const canAuto = sel.kind !== 're', pl = canAuto ? E.getPlan(S, sel.kind, sel.id) : null, od = canAuto ? E.getOrder(S, sel.kind, sel.id) : null;
    const seg = [[12, T('1 年')], [36, T('3 年')], [0, T('全部')]].map(x => '<button class="' + (range === x[0] ? 'on' : '') + '" data-act="range" data-v="' + x[0] + '">' + x[1] + '</button>').join('');
    $('detailBox').innerHTML =
      '<div class="detail-head"><div><h2>' + f.name + (f.code ? ' <small class="code">' + f.code + '</small>' : '') + '</h2><div class="mute" style="font-size:13px;max-width:460px">' + f.desc + '</div></div><div style="text-align:right"><div class="price">' + f.ptxt + '</div><div class="' + cls(f.last) + '">' + T('本月 {0}', [pct(f.last)]) + '</div></div></div>' +
      '<div class="chart-bar"><div class="seg">' + seg + '</div><span class="mute">' + T('黃線：6 個月均線　紫色虛線：平均成本') + '</span></div>' +
      '<canvas id="chart"></canvas>' +
      '<div class="kv">' + f.kv.map(k => '<div><small>' + k[0] + '</small><b>' + k[1] + '</b></div>').join('') +
      '<div><small>' + T('近一年最高／最低') + '</small><b>' + fmtP(hi) + '／' + fmtP(lo) + '</b></div>' +
      '<div><small>' + T('持有') + '</small><b>' + (f.qty > 0 ? f.qtxt : T('無')) + '</b></div><div><small>' + T('市值') + '</small><b>' + money(f.value) + '</b></div>' +
      (f.cost > 0 ? '<div><small>' + T('未實現損益') + '</small><b class="' + cls(pnl) + '">' + (pnl >= 0 ? '+' : '') + money(pnl) + '（' + pct(pr, 1) + '）</b></div>' : '') + '</div>' +
      '<div class="btn-row"><button class="btn buy" data-act="trade" data-side="buy">' + T('買進') + '</button><button class="btn sell" data-act="trade" data-side="sell"' + (f.qty > 0 ? '' : ' disabled') + '>' + T('賣出') + '</button>' +
      (canAuto ? '<button class="btn ghost small" data-act="plan">' + (pl ? T('🔁 定期定額：每月 {0}', [money(pl.amt)]) : T('🔁 設定定期定額')) + '</button>' +
        '<button class="btn ghost small" data-act="order">' + (od ? T('🛑 條件單：停損 {0}／停利 {1}', [od.sl ? '-' + Math.round(od.sl * 100) + '%' : T('無'), od.tp ? '+' + Math.round(od.tp * 100) + '%' : T('無')]) : T('🛑 設定停損停利')) + '</button>' : '') + '</div>';
    requestAnimationFrame(() => drawLine($('chart'), ys, { x0: monthLabel(from), x1: monthLabel(n - 1), ma: ma, cost: avgCost, fmt: f.price < 1 ? (v => String(+v.toPrecision(3))) : null }));
  }
  function renderNews() {
    const ntag = n => n.quiet ? '' : n.known ? (n.truth ? '<span class="tag ok">' + T('內線：屬實') + '</span>' : '<span class="tag no">' + T('內線：不實') + '</span>') : '<span class="tag rumor">' + T('傳聞') + '</span>';
    const si = S.sent == null ? 1 : S.sent, sentTxt = [T('偏多'), T('中性'), T('偏空')][si], sentCls = ['up', 'mute', 'down'][si];
    const ev = id => D.EVENTS.find(e => e.id === id) || {};
    $('newsBox').innerHTML = '<h3>' + T('📰 本月新聞') + '<small>' + T('消息不一定準確') + '</small></h3>' +
      (S.finished ? '<p class="mute">' + T('遊戲已結束。') + '</p>' : S.news.map(n => '<div class="news"><b>' + T(ev(n.id).t || n.t) + ntag(n) + '</b><p>' + T(ev(n.id).d || n.d) + '</p></div>').join('') +
        '<div class="sent"><span>' + T('加權指數（模擬）：') + '<b>' + full(S.index) + '</b> ' + (S.month ? '<em class="' + cls(S.index / S.indexHist[S.indexHist.length - 2] - 1) + '">' + pct(S.index / S.indexHist[S.indexHist.length - 2] - 1, 1) + '</em>' : '') + '</span></div>' +
        '<div class="sent"><span>' + T('市場情緒指標：') + '<b class="' + sentCls + '">' + sentTxt + '</b></span><span>' + T('政策利率：') + '<b>' + (S.rate * 100).toFixed(2) + '%</b></span></div>' +
        '<div class="btn-row"><button class="btn blue small" data-act="intel"' + (S.intel || S.cash < R.intelCost ? ' disabled' : '') + '>' + T('💼 買內線情報（{0}）', [full(R.intelCost)]) + '</button></div>' +
        '<p class="mute" style="font-size:12px;margin:6px 0 0">' + T('新聞約 6～8 成會成真；消息落空時，市場常會朝反方向小幅波動。情緒指標約 7 成準確，僅供參考。') + '</p>');
    $('netBox').innerHTML = '<h3>' + T('淨資產走勢') + '<small>' + T('虛線為目標') + '</small></h3><canvas id="netChart" class="short"></canvas>';
    requestAnimationFrame(() => {
      const ys = S.netHist.length > 1 ? S.netHist : [S.netHist[0], S.netHist[0]];
      drawLine($('netChart'), ys, { line: S.target, fmt: v => money(v), color: '#4f8cff', x0: T('開局'), x1: T('第{0}月', [S.month]) });
    });
  }
  function renderLog() {
    $('logBox').innerHTML = '<h3>' + T('📒 每月紀錄') + '</h3>' + (S.log.length ? S.log.slice(0, 8).map(l => '<div class="log-item"><span class="m">' + T('第{0}月', [l.m]) + '</span>' + l.lines.map(x => '<span class="log-line ' + x.k + '">' + (x.key ? T(x.key, x.p) : x.m) + '</span>').join('') + '</div>').join('') : '<p class="mute">' + T('還沒有紀錄，按「下一個月」開始。') + '</p>');
  }
  function renderActions() {
    $('actionBar').innerHTML = S.finished ? '<button class="btn" data-act="newgame">' + T('再玩一次') + '</button><button class="btn ghost" data-act="result">' + T('查看成績') + '</button>' :
      '<button class="btn" data-act="next">' + T('下一個月 ▶') + '</button><button class="btn ghost" data-act="next3">' + T('快轉 3 個月 ⏩') + '</button>';
  }

  /* ---------- 借貸 ---------- */
  function loanHTML() {
    const liq = E.liquidValue(S), ratio = liq > 0 ? S.marginDebt / liq : 0, mb = E.maxBorrow(S);
    const rate = (S.rate + R.marginSpread) * 100, mrate = (S.rate + R.mortgageSpread) * 100;
    const warn = ratio > 0.6 ? 'down' : ratio > 0.45 ? '' : 'mute';
    let mort = '';
    for (const p of D.PROPERTIES) { const o = S.re[p.id]; if (o.mortgage > 0) mort += '<tr><td>' + T(p.name) + ' × ' + o.count + '</td><td>' + money(o.mortgage) + '</td></tr>'; }
    return '<h3>' + T('借貸與槓桿') + '<small>' + T('以股票、加密貨幣、基金為擔保') + '</small></h3>' +
      '<div class="kv"><div><small>' + T('融資借款') + '</small><b>' + money(S.marginDebt) + '</b></div><div><small>' + T('融資利率') + '</small><b>' + rate.toFixed(2) + '%</b></div><div><small>' + T('可再借額度') + '</small><b>' + money(mb) + '</b></div>' +
      '<div><small>' + T('融資維持情況（借款／證券市值）') + '</small><b class="' + warn + '">' + (ratio * 100).toFixed(1) + '%</b></div></div>' +
      '<p class="mute" style="font-size:13px">' + T('借款比例超過 {0} 會被追繳並強制賣出持股（另收 1% 費用）。借得越多，賺得多但也可能一次賠光。', ['<b>70%</b>']) + '</p>' +
      '<div class="field"><input type="number" id="loanAmt" min="0" step="10000" placeholder="' + T('輸入金額（元）') + '"></div>' +
      '<div class="quick"><button data-act="loanq" data-v="max">' + T('最大可借') + '</button><button data-act="loanq" data-v="all">' + T('全部還清') + '</button><button data-act="loanq" data-v="100000">' + T('10 萬') + '</button><button data-act="loanq" data-v="500000">' + T('50 萬') + '</button></div>' +
      '<div class="btn-row"><button class="btn buy" data-act="borrow">' + T('借款') + '</button><button class="btn sell" data-act="repay">' + T('還款') + '</button></div>' +
      '<h3 style="margin-top:16px">' + T('房貸（買房時自動辦理，七成）') + '<small>' + T('利率 {0}', [mrate.toFixed(2) + '%']) + '</small></h3>' +
      (mort ? '<table><tr><th>' + T('房產') + '</th><th>' + T('房貸餘額') + '</th></tr>' + mort + '</table><p class="mute" style="font-size:13px">' + T('房貸只付利息，賣出房產時一次還清。') + '</p>' : '<p class="mute">' + T('目前沒有房貸。') + '</p>');
  }

  /* ---------- 資產總覽 ---------- */
  function allocItems() {
    return [
      { label: T('現金'), value: Math.max(0, S.cash), color: COLORS.cash }, { label: T('股票'), value: E.stockValue(S), color: COLORS.stock },
      { label: T('加密貨幣'), value: E.cryptoValue(S), color: COLORS.crypto }, { label: T('基金'), value: E.fundValue(S), color: COLORS.fund }, { label: T('房地產'), value: E.reValue(S), color: COLORS.re }
    ];
  }
  function drawPort() { drawDonut($('donut'), allocItems()); }
  function portHTML() {
    const items = allocItems(), total = items.reduce((a, b) => a + b.value, 0);
    const lb = getLB();
    const unlocked = D.ACHIEVEMENTS.filter(a => S.ach[a.id]).length;
    return '<h3>' + T('資產配置') + '<small>' + T('分散風險是投資的第一課') + '</small></h3><div class="grid2"><canvas id="donut" class="short"></canvas><div>' +
      '<div class="legend" style="flex-direction:column">' + items.map(i => '<span><i style="background:' + i.color + '"></i>' + i.label + '　<b>' + money(i.value) + '</b>' + (total > 0 ? '（' + (i.value / total * 100).toFixed(1) + '%）' : '') + '</span>').join('') + '</div>' +
      '<div class="kv" style="margin-top:10px"><div><small>' + T('已實現損益') + '</small><b class="' + cls(S.stats.realized) + '">' + money(S.stats.realized) + '</b></div><div><small>' + T('交易次數') + '</small><b>' + S.stats.trades + '</b></div><div><small>' + T('追繳次數') + '</small><b>' + S.stats.mcCount + '</b></div><div><small>' + T('歷史最高淨資產') + '</small><b>' + money(S.stats.maxNW) + '</b></div></div></div></div>' +
      holdingsHTML() +
      '<h3 style="margin-top:14px">' + T('成就') + ' <small>' + unlocked + ' / ' + D.ACHIEVEMENTS.length + '</small></h3><div class="ach">' + D.ACHIEVEMENTS.map(a => '<div class="' + (S.ach[a.id] ? 'on' : '') + '"><b>' + (S.ach[a.id] ? '🏆 ' : '🔒 ') + T(a.name) + '</b><span>' + T(a.desc) + '</span></div>').join('') + '</div>' +
      '<h3 style="margin-top:14px">' + T('本機排行榜') + '<small>' + T('只存在你的瀏覽器') + '</small></h3>' + (lb.length ? '<table><tr><th>' + T('名次') + '</th><th>' + T('模式') + '</th><th>' + T('最終淨資產') + '</th><th>' + T('稱號') + '</th></tr>' + lb.map((e, i) => '<tr><td>' + (i + 1) + '</td><td>' + T(e.mode) + '</td><td>' + money(e.nw) + '</td><td>' + T(e.rank) + '</td></tr>').join('') + '</table>' : '<p class="mute">' + T('玩完一場遊戲後，成績會出現在這裡。') + '</p>');
  }

  function holdingsHTML() {
    const rows = [];
    const add = (kind, id) => { const f = info(kind, id); if (!(f.qty > 0)) return; const pnl = f.value - f.cost; rows.push('<tr class="row" data-act="goto" data-k="' + kind + '" data-v="' + id + '"><td class="name"><b>' + f.name + '</b>' + (f.code ? '<small class="code">' + f.code + '</small>' : '') + '</td><td>' + f.qtxt + '</td><td>' + money(f.value) + '</td><td class="' + cls(pnl) + '">' + (pnl >= 0 ? '+' : '') + money(pnl) + (f.cost > 0 ? '（' + pct(pnl / f.cost, 1) + '）' : '') + '</td></tr>'); };
    S.cfg.stocks.forEach(d => add('stock', d.id)); S.cfg.cryptos.forEach(d => add('crypto', d.id)); D.FUNDS.forEach(d => add('fund', d.id)); D.PROPERTIES.forEach(d => add('re', d.id));
    let h = '<h3 style="margin-top:14px">' + T('持有明細') + '<small>' + T('點選可前往交易') + '</small></h3>' +
      (rows.length ? '<div class="tbl-wrap"><table><tr><th>' + T('名稱') + '</th><th>' + T('持有') + '</th><th>' + T('市值') + '</th><th>' + T('未實現損益') + '</th></tr>' + rows.join('') + '</table></div>' : '<p class="mute">' + T('目前沒有任何持有部位。') + '</p>');
    const autos = [];
    S.plans.forEach(p => autos.push('<span class="chip on" data-act="goto" data-k="' + p.kind + '" data-v="' + p.id + '">🔁 ' + esc(nm(E.assetDef(S, p.kind, p.id))) + ' ' + T('每月 {0}', [money(p.amt)]) + '</span>'));
    Object.keys(S.orders).forEach(k => { const kind = k.split(':')[0], id = k.slice(kind.length + 1), o = S.orders[k]; autos.push('<span class="chip on" data-act="goto" data-k="' + kind + '" data-v="' + id + '">🛑 ' + esc(nm(E.assetDef(S, kind, id))) + ' ' + (o.sl ? '-' + Math.round(o.sl * 100) + '%' : '') + (o.sl && o.tp ? ' / ' : '') + (o.tp ? '+' + Math.round(o.tp * 100) + '%' : '') + '</span>'); });
    h += '<h3 style="margin-top:14px">' + T('自動交易') + '<small>' + T('定期定額與停損停利') + '</small></h3>' + (autos.length ? '<div class="chips">' + autos.join('') + '</div>' : '<p class="mute">' + T('尚未設定。到股票、加密貨幣或基金的明細可以設定定期定額與停損停利。') + '</p>');
    const tag = { dca: T('定期定額'), sl: T('停損'), tp: T('停利') };
    h += '<h3 style="margin-top:14px">' + T('交易紀錄') + '<small>' + T('最近 12 筆') + '</small></h3>' + (S.trades.length ? '<div class="tbl-wrap"><table><tr><th>' + T('月份') + '</th><th>' + T('動作') + '</th><th>' + T('名稱') + '</th><th>' + T('金額') + '</th><th>' + T('損益') + '</th></tr>' +
      S.trades.slice(0, 12).map(t => '<tr><td>' + T('第{0}月', [t.m]) + '</td><td class="' + (t.side === 'buy' ? 'up' : 'down') + '">' + (t.side === 'buy' ? T('買進') : T('賣出')) + (t.auto ? '<small class="code">' + tag[t.auto] + '</small>' : '') + '</td><td>' + esc(nm(E.assetDef(S, t.kind, t.id))) + '</td><td>' + money(t.total) + '</td><td class="' + (t.pnl == null ? 'mute' : cls(t.pnl)) + '">' + (t.pnl == null ? '—' : (t.pnl >= 0 ? '+' : '') + money(t.pnl)) + '</td></tr>').join('') + '</table></div>' : '<p class="mute">' + T('還沒有交易。') + '</p>');
    return h;
  }

  /* ---------- 彈窗 ---------- */
  function openModal(html, wide, closable) {
    $('modalRoot').innerHTML = '<div class="modal-bg" ' + (closable === false ? '' : 'data-act="bgclose"') + '><div class="modal' + (wide ? ' wide' : '') + '" data-stop="1">' + (closable === false ? '' : '<button class="close" data-act="closemodal">×</button>') + html + '</div></div>';
  }
  function closeModal() { $('modalRoot').innerHTML = ''; }

  function startScreen() {
    const sv = loadSave();
    const svMode = sv && D.MODES.find(m => m.id === sv.mode);
    openModal('<div class="center"><div style="font-size:44px">📈</div><h2 style="font-size:26px">' + T('我愛操盤手') + '</h2><p class="mute">' + T('用 10 年時間操作股票、加密貨幣、房地產與基金，達成你的財富目標。可選真實市場的股票與幣種。') + '</p></div>' +
      (sv && !sv.finished ? '<button class="mode" data-act="continue"><b>' + T('▶ 繼續上次的遊戲') + '</b><span>' + T('{0}・第 {1} 個月・淨資產 {2}', [svMode ? T(svMode.name) : '', sv.month, money(E.netWorth(sv))]) + '</span></button>' : '') +
      '<div class="modes">' + D.MODES.map(m => '<button class="mode" data-act="mode" data-v="' + m.id + '"><b>' + T(m.name) + '</b><em>' + T(m.tag) + '</em><span>' + T(m.desc) + '</span></button>').join('') + '</div>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn ghost small" data-act="help">' + T('玩法說明') + '</button><button class="btn ghost small" data-act="lang">' + (I.lang === 'en' ? '中文' : 'English') + '</button></div>' +
      '<p class="mute center" style="font-size:12px;margin-top:10px">' + T('本遊戲為模擬，不構成投資建議。') + '</p>', false, false);
  }
  function confirmNew() {
    openModal('<h2>' + T('要開始新遊戲嗎？') + '</h2><p>' + T('目前進行中的遊戲（第 {0} 個月）會被覆蓋，無法復原。', [S.month]) + '</p>' +
      '<div class="btn-row"><button class="btn sell" data-act="startok">' + T('覆蓋並開始新遊戲') + '</button><button class="btn ghost" data-act="backsetup">' + T('取消') + '</button></div>', false, false);
  }

  /* ---------- 開局設定：選市場、選股票、選幣種 ---------- */
  const MAX_ST = 12, MIN_ST = 3, MAX_CR = 6;
  function openSetup(modeId) {
    setup = { mode: modeId, market: 'real', stocks: D.DEFAULT_REAL.slice(), cryptos: D.DEFAULT_CRYPTO.slice(), q: '', sec: 'all' };
    setupScreen(); M.load();
  }
  function stockChip(code, on) {
    const d = M.stock(code); if (!d) return '';
    return '<button class="chip' + (on ? ' on' : '') + '" data-act="pick" data-c="' + code + '"><b>' + code + '</b> ' + esc(nm(d)) + ' <small>' + fmtP(d.price) + '</small></button>';
  }
  function searchHTML() {
    if (!setup.q) return '';
    const res = M.search(setup.q, 8).filter(r => setup.stocks.indexOf(r.code) < 0);
    return res.length ? res.map(r => stockChip(r.code, false)).join('') : '<span class="mute">' + (M.live ? T('找不到符合的上市證券。') : T('目前只能搜尋熱門標的（最新行情尚未載入）。')) + '</span>';
  }
  function setupScreen() {
    const mode = D.MODES.find(m => m.id === setup.mode), real = setup.market === 'real';
    const st = M.status === 'loading' ? T('⏳ 正在讀取最新行情…') : M.live ? T('✅ 已載入臺灣證券交易所 {0} 收盤價，可搜尋全部上市股票與 ETF', [M.date]) : T('⚠️ 無法取得最新行情，改用內建快照（{0}）', [D.SNAP.date]);
    const cst = M.cryptoLive ? T('✅ 加密貨幣為 CoinGecko 即時報價（新台幣）') : T('加密貨幣使用內建快照（{0}）', [D.SNAP.date]);
    const secs = ['all'].concat(Object.keys(D.SECTOR_NAMES).filter(k => k !== 'other'));
    const cat = D.REAL_STOCKS.filter(d => (setup.sec === 'all' || d.sector === setup.sec) && setup.stocks.indexOf(d.code) < 0);
    let h = '<div id="setupBox"><h2>' + T('開局設定') + ' <small class="code">' + T(mode.name) + '</small></h2>' +
      '<div class="modes two"><button class="mode' + (real ? ' on' : '') + '" data-act="mkt" data-v="real"><b>' + T('🌐 真實市場') + '</b><span>' + T('自選台股上市公司、ETF 與加密貨幣，使用真實名稱與最新價格開局。') + '</span></button>' +
      '<button class="mode' + (real ? '' : ' on') + '" data-act="mkt" data-v="fic"><b>' + T('🎲 虛構市場') + '</b><span>' + T('七家虛構公司，適合只想輕鬆玩的人。') + '</span></button></div>';
    if (real) {
      h += '<p class="mute" style="font-size:13px;margin:8px 0">' + st + '</p>' +
        '<h3>' + T('已選股票') + ' <small>' + setup.stocks.length + ' / ' + MAX_ST + '（' + T('至少 {0} 檔', [MIN_ST]) + '）</small></h3><div class="chips">' + setup.stocks.map(c => stockChip(c, true)).join('') + '</div>' +
        '<div class="field" style="margin-top:10px"><input type="text" id="stockQ" placeholder="' + T('輸入代號或名稱搜尋，例如 2330 或 台積電') + '" value="' + esc(setup.q) + '" autocomplete="off"></div><div class="chips" id="searchRes">' + searchHTML() + '</div>' +
        '<h3 style="margin-top:10px">' + T('熱門標的') + '</h3><div class="seg wrap">' + secs.map(k => '<button class="' + (setup.sec === k ? 'on' : '') + '" data-act="sec" data-v="' + k + '">' + (k === 'all' ? T('全部') : T(D.SECTOR_NAMES[k])) + '</button>').join('') + '</div>' +
        '<div class="chips scroll">' + cat.map(d => stockChip(d.code, false)).join('') + '</div>';
    } else {
      h += '<div class="chips" style="margin-top:8px">' + D.STOCKS.map(d => '<span class="chip on">' + T(d.name) + '</span>').join('') + '</div>';
    }
    h += '<h3 style="margin-top:12px">' + T('加密貨幣') + ' <small>' + setup.cryptos.length + ' / ' + MAX_CR + '</small></h3><p class="mute" style="font-size:13px;margin:0 0 6px">' + cst + '</p><div class="chips">' +
      D.CRYPTOS.map(c => { const d = M.coin(c.id), on = setup.cryptos.indexOf(c.id) >= 0; return '<button class="chip' + (on ? ' on' : '') + '" data-act="cpick" data-c="' + c.id + '"><b>' + c.code + '</b> ' + nm(c) + ' <small>' + fmtP(d.price) + '</small></button>'; }).join('') + '</div>' +
      '<p class="mute" style="font-size:12px;margin-top:10px">' + T('只採用真實的名稱、代號與起始價格；開局後的漲跌、新聞與事件全部是模擬，與真實公司無關，不構成投資建議。資料來源：臺灣證券交易所、CoinGecko。') + '</p>' +
      '<div class="btn-row"><button class="btn" data-act="start">' + T('開始遊戲 ▶') + '</button><button class="btn ghost" data-act="newgame">' + T('上一步') + '</button></div></div>';
    openModal(h, true, false);
  }
  function buildCfg() {
    const real = setup.market === 'real';
    const stocks = real ? setup.stocks.map(c => M.stock(c)).filter(Boolean) : D.STOCKS.map(x => Object.assign({}, x));
    const cryptos = setup.cryptos.map(id => M.coin(id)).filter(Boolean);
    return { market: setup.market, stocks: stocks, cryptos: cryptos, taiex: M.taiex, date: M.date, live: real && M.live, cryptoLive: M.cryptoLive };
  }
  function tryStart() {
    if (setup.market === 'real' && setup.stocks.length < MIN_ST) { toast(T('請至少選 {0} 檔股票。', [MIN_ST]), 'bad'); return; }
    if (!setup.cryptos.length) { toast(T('請至少選 1 種加密貨幣。'), 'bad'); return; }
    if (S && S.month > 0 && !S.finished) confirmNew(); else newGame(setup.mode, buildCfg());
  }

  /* ---------- 定期定額與條件單 ---------- */
  function planModal() {
    const f = info(sel.kind, sel.id), pl = E.getPlan(S, sel.kind, sel.id);
    openModal('<h2>' + T('定期定額：{0}', [f.name]) + '</h2><p class="mute">' + T('每個月領薪後自動買進固定金額；現金不足時該月會跳過。股票以整股計算，金額不足 1 股也會跳過。') + '</p>' +
      '<div class="field"><label>' + T('每月金額（元）') + '</label><input type="number" id="planAmt" min="0" step="1000" placeholder="5000" value="' + (pl ? pl.amt : '') + '" inputmode="numeric"></div>' +
      '<div class="quick">' + [3000, 5000, 10000, 20000].map(v => '<button data-act="planq" data-v="' + v + '">' + full(v) + '</button>').join('') + '</div>' +
      '<div class="btn-row"><button class="btn" data-act="planok">' + T('儲存') + '</button>' + (pl ? '<button class="btn sell" data-act="plandel">' + T('取消定期定額') + '</button>' : '') + '<button class="btn ghost" data-act="closemodal">' + T('關閉') + '</button></div>');
    $('planAmt').focus();
  }
  function orderModal() {
    const f = info(sel.kind, sel.id), od = E.getOrder(S, sel.kind, sel.id);
    const cur = f.cost > 0 && f.qty > 0 ? T('目前相對平均成本 {0}', ['<b class="' + cls(f.value / f.cost - 1) + '">' + pct(f.value / f.cost - 1, 1) + '</b>']) : T('目前尚未持有，買進後才會開始判斷。');
    openModal('<h2>' + T('停損停利：{0}', [f.name]) + '</h2><p class="mute">' + T('每個月價格更新後，如果相對「平均成本」的跌幅或漲幅達到設定值，就自動全數賣出，並取消這張條件單。留空或填 0 表示不設。') + '</p><p>' + cur + '</p>' +
      '<div class="grid2"><div class="field"><label>' + T('停損：下跌超過（%）') + '</label><input type="number" id="odSL" min="0" max="94" step="1" placeholder="15" value="' + (od && od.sl ? Math.round(od.sl * 100) : '') + '" inputmode="numeric"></div>' +
      '<div class="field"><label>' + T('停利：上漲超過（%）') + '</label><input type="number" id="odTP" min="0" step="1" placeholder="50" value="' + (od && od.tp ? Math.round(od.tp * 100) : '') + '" inputmode="numeric"></div></div>' +
      '<div class="btn-row"><button class="btn" data-act="orderok">' + T('儲存') + '</button>' + (od ? '<button class="btn sell" data-act="orderdel">' + T('取消條件單') + '</button>' : '') + '<button class="btn ghost" data-act="closemodal">' + T('關閉') + '</button></div>');
  }
  function helpModal() {
    openModal('<div class="help"><h2>' + T('玩法說明') + '</h2>' +
      '<h3>' + T('🎯 目標') + '</h3><p>' + T('在 120 個月（10 年）內，把淨資產提高到模式目標。淨資產 = 現金 + 股票 + 加密貨幣 + 基金 + 房產市值 − 所有借款。淨資產歸零就破產。') + '</p>' +
      '<h3>' + T('🔄 每個月') + '</h3><ul><li>' + T('先看「本月新聞」與情緒指標，決定要買還是賣。') + '</li><li>' + T('按「下一個月」後，價格依新聞與市場變化，並結算股利、租金、利息、薪資。') + '</li><li>' + T('每月會自動存入儲蓄，每年加薪 3%、年底有獎金，偶爾會有突發支出或意外之財。') + '</li></ul>' +
      '<h3>' + T('💹 四大資產') + '</h3><ul><li>' + T('<b>股票</b>：真實市場模式可從台股上市公司與 ETF 自選 3～12 檔（真實名稱與起始價格），也可以選虛構市場；每季配息。手續費買 0.2%、賣 0.45%。') + '</li><li>' + T('<b>加密貨幣</b>：可選比特幣、以太幣等 1～6 種，波動最大，小型幣更劇烈；買賣各 0.5%。') + '</li><li>' + T('<b>房地產</b>：每月收租，可用七成房貸，但買賣成本高（3%／4%），也可能空租。') + '</li><li>' + T('<b>基金</b>：從貨幣型到成長型，風險與費用各不同；指數基金等於一籃子買進你選的所有股票。') + '</li></ul>' +
      '<h3>' + T('📰 新聞與情報') + '</h3><p>' + T('每月 1～3 則新聞，約 6～8 成會成真；落空時市場常反向小幅波動。可花 {0} 元買「內線情報」確認本月消息真偽。', [full(R.intelCost)]) + '</p>' +
      '<h3>' + T('🤖 自動交易') + '</h3><p>' + T('在股票、加密貨幣、基金的明細可以設定「定期定額」（每月自動買進固定金額）與「停損停利條件單」（月底依平均成本的漲跌幅自動全數賣出）。') + '</p>' +
      '<h3>' + T('⚠️ 槓桿與追繳') + '</h3><p>' + T('可抵押股票、加密貨幣、基金向券商借款（上限 50%）。當借款／證券市值超過 70%，會被強制賣出持股。') + '</p>' +
      '<h3>' + T('🌐 真實市場資料') + '</h3><p>' + T('真實市場模式的名稱、代號與起始價格來自臺灣證券交易所與 CoinGecko 的公開資料；開局之後的漲跌、新聞與事件全部是電腦模擬，與真實公司無關，也不代表未來走勢。') + '</p>' +
      '<h3>' + T('🎨 顏色') + '</h3><p>' + T('採用台灣習慣：{0}、{1}。', ['<span class="up">' + T('紅色上漲') + '</span>', '<span class="down">' + T('綠色下跌') + '</span>']) + '</p>' +
      '<h3>' + T('💾 存檔與重新開始') + '</h3><p>' + T('遊戲每個動作後自動存在你的瀏覽器（localStorage），重新整理（F5）不會重來，會從上次進度繼續；換裝置或清除瀏覽資料會消失。想重玩請按右上角「新遊戲」。') + '</p>' +
      '<p class="mute" style="margin-top:12px">' + T('開局後的價格走勢、新聞與事件皆為模擬，僅供娛樂與教育，不構成投資建議。') + '</p></div><div class="btn-row"><button class="btn" data-act="closemodal">' + T('開始玩') + '</button></div>', true);
  }
  function tradeModal(side) {
    const kind = sel.kind, id = sel.id, f = info(kind, id);
    const unit = kind === 'stock' ? T('股') : kind === 're' ? T('間') : '';
    let label, ph, quick = '';
    if (side === 'buy') {
      if (kind === 'stock' || kind === 're') {
        label = T('買進數量（{0}）', [unit]); ph = '1';
        quick = [[T('25% 現金'), 0.25], [T('50% 現金'), 0.5], [T('全部現金'), 1]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="buyqty">' + x[0] + '</button>').join('');
      } else {
        label = T('投入金額（元）'); ph = '100000';
        quick = [['10%', .1], ['25%', .25], ['50%', .5], [T('全部現金'), 1]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="buyamt">' + x[0] + '</button>').join('');
      }
    } else {
      if (kind === 'stock' || kind === 're') {
        label = T('賣出數量（{0}）', [unit]); ph = '1';
        quick = [['25%', .25], ['50%', .5], [T('全部'), 1]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="sellqty">' + x[0] + '</button>').join('');
      } else {
        label = T('賣出比例（%）'); ph = '100';
        quick = [['25%', 25], ['50%', 50], [T('全部'), 100]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="sellpct">' + x[0] + '</button>').join('');
      }
    }
    openModal('<h2>' + (side === 'buy' ? T('買進 {0}', [f.name]) : T('賣出 {0}', [f.name])) + '</h2><p class="mute">' + T('現價 {0}　可用現金 {1}', [f.ptxt, money(S.cash)]) + (f.qty > 0 ? T('　持有 {0}', [f.qtxt]) : '') + '</p>' +
      '<div class="field"><label>' + label + '</label><input type="number" id="tradeX" min="0" placeholder="' + ph + '" inputmode="decimal"></div><div class="quick">' + quick + '</div>' +
      (kind === 're' && side === 'buy' ? '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="mortgage" checked> ' + T('使用房貸（七成，利率 {0}）', [((S.rate + R.mortgageSpread) * 100).toFixed(2) + '%']) + '</label>' : '') +
      '<div class="preview" id="tradePrev">' + T('輸入數量後會顯示預估結果。') + '</div>' +
      '<div class="btn-row"><button class="btn ' + (side === 'buy' ? 'buy' : 'sell') + '" id="tradeOk" data-act="tradeok" data-side="' + side + '">' + (side === 'buy' ? T('確認買進') : T('確認賣出')) + '</button><button class="btn ghost" data-act="closemodal">' + T('取消') + '</button></div>');
    $('tradeX').focus();
    window._tradeCtx = { side, kind, id };
  }
  function tradePreview() {
    const c = window._tradeCtx; if (!c) return;
    const x = parseFloat($('tradeX').value), p = $('tradePrev');
    if (!(x > 0)) { p.className = 'preview'; p.textContent = T('輸入數量後會顯示預估結果。'); return; }
    const r = E.trade(S, c.kind, c.side, c.id, x, { mortgage: $('mortgage') ? $('mortgage').checked : false }, true);
    p.className = 'preview' + (r.ok ? '' : ' err');
    p.textContent = r.msg + (r.ok && r.fee ? T('（含手續費／稅費 {0}）', [money(r.fee)]) : '');
  }
  function qset(m, pr) {
    const c = window._tradeCtx, f = info(c.kind, c.id), inp = $('tradeX');
    let v = 0;
    if (m === 'buyqty') {
      if (c.kind === 'stock') v = Math.floor(S.cash * pr / (f.price * (1 + R.stockBuyFee)));
      else { const useM = $('mortgage') && $('mortgage').checked; v = Math.floor(S.cash * pr / (f.price * (useM ? (1 - R.reLtv) + R.reBuyCost : 1 + R.reBuyCost))); }
    }
    if (m === 'buyamt') v = Math.floor(S.cash * pr);
    if (m === 'sellqty') v = Math.max(1, Math.floor(f.qty * pr));
    if (m === 'sellpct') v = pr;
    inp.value = v; tradePreview();
  }

  /* ---------- 提示 ---------- */
  function toast(msg, k) {
    const t = document.createElement('div'); t.className = 'toast ' + (k || ''); t.textContent = msg;
    $('toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
  }
  function achToast(list) { (list || []).forEach(a => toast(T('🏆 解鎖成就：{0}', [T(a.name)]), 'ach')); }

  /* ---------- 結算畫面 ---------- */
  function resultModal() {
    const nw = E.netWorth(S), rk = E.rankOf(S), mode = D.MODES.find(m => m.id === S.mode);
    if (!S.lbSaved) { S.lbSaved = true; addLB({ mode: mode.name, nw, rank: rk.name, date: new Date().toISOString().slice(0, 10) }); save(); }
    const text = T('我在《我愛操盤手》（{0}）玩了 {1} 個月，最終淨資產 {2}，稱號「{3}」！你也來挑戰：{4}', [T(mode.name), S.month, money(nw), T(rk.name), location.origin + location.pathname]);
    window._shareText = text;
    openModal('<div class="center"><div style="font-size:42px">' + (S.bankrupt ? '💥' : nw >= S.target ? '🏆' : '📊') + '</div><h2>' + (S.bankrupt ? T('你破產了') : T('遊戲結束')) + '</h2>' +
      '<div class="big">' + money(nw) + '</div><div class="mute">' + T('目標 {0}（達成率 {1}%）', [money(S.target), (nw / S.target * 100).toFixed(0)]) + '</div>' +
      '<p style="font-size:20px;margin:10px 0 2px"><b>' + T('稱號：{0}', [T(rk.name)]) + '</b></p><p class="mute">' + T(rk.text) + '</p></div>' +
      '<div class="kv"><div><small>' + T('遊戲月數') + '</small><b>' + S.month + '</b></div><div><small>' + T('交易次數') + '</small><b>' + S.stats.trades + '</b></div><div><small>' + T('已實現損益') + '</small><b class="' + cls(S.stats.realized) + '">' + money(S.stats.realized) + '</b></div><div><small>' + T('成就') + '</small><b>' + Object.keys(S.ach).length + ' / ' + D.ACHIEVEMENTS.length + '</b></div></div>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn" data-act="newgame">' + T('再玩一次') + '</button><button class="btn ghost" data-act="share">' + T('複製成績分享') + '</button><button class="btn ghost" data-act="closemodal">' + T('關閉') + '</button></div>');
  }

  /* ---------- 動作 ---------- */
  function doNext(n) {
    if (S.finished) return;
    let rep = null;
    for (let i = 0; i < n; i++) {
      rep = E.advance(S);
      const notable = rep.lines.filter(l => l.k === 'bad' || (l.k === 'good' && /年終|意外/.test(l.key)));
      if (n === 1) { toast(T('第 {0} 月　大盤 {1}', [rep.month, pct(rep.mret, 1)]), rep.mret >= 0 ? 'good' : 'bad'); notable.slice(0, 3).forEach(l => toast(T(l.key, l.p), l.k)); }
      achToast(rep.ach);
      if (rep.mc || rep.win || rep.finished) break;
    }
    if (n > 1) toast(T('已快轉到第 {0} 月，淨資產 {1}', [S.month, money(E.netWorth(S))]));
    save(); renderAll();
    if (rep.finished) { resultModal(); return; }
    if (rep.mc) openModal('<div class="center"><div style="font-size:42px">⚠️</div><h2>' + T('追繳保證金！') + '</h2></div><p>' + T('你的借款占證券市值的比例過高，券商已強制賣出部分持股並償還借款。槓桿是雙面刃，下次記得留點緩衝。') + '</p><div class="btn-row"><button class="btn" data-act="closemodal">' + T('我知道了') + '</button></div>');
    else if (rep.win) openModal('<div class="center"><div style="font-size:42px">🎉</div><h2>' + T('達成目標！') + '</h2></div><p>' + T('你的淨資產已突破 {0}。要見好就收，還是繼續挑戰更高的成績？遊戲會繼續到第 120 個月，最終成績看那時的淨資產。', ['<b>' + money(S.target) + '</b>']) + '</p><div class="btn-row"><button class="btn" data-act="closemodal">' + T('繼續挑戰') + '</button></div>');
  }
  function afterTrade(r) {
    if (!r.ok) { toast(r.msg, 'bad'); return false; }
    toast(r.msg, r.pnl != null ? (r.pnl >= 0 ? 'good' : 'bad') : ''); achToast(r.ach); save(); renderAll(); return true;
  }
  function newGame(mode, cfg) { S = E.newGame(mode, undefined, cfg); sel = firstStock(); tab = 'stock'; setup = null; save(); closeModal(); renderAll(); toast(T('遊戲開始！先看看本月新聞，再決定怎麼布局。')); }
  function setLang(l) {
    I.setLang(l); renderAll();
    if ($('modalRoot').firstChild) { if ($('setupBox')) setupScreen(); else if ($('modalRoot').querySelector('[data-act=mode]')) startScreen(); else closeModal(); }
  }

  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act;
    if (act === 'bgclose') { if (e.target === t) closeModal(); return; }
    switch (act) {
      case 'tab': tab = t.dataset.v; renderTabs(); renderMain(); break;
      case 'sel': sel = { kind: t.dataset.k, id: t.dataset.v }; renderMain(); break;
      case 'trade': tradeModal(t.dataset.side); break;
      case 'tradeok': {
        const c = window._tradeCtx, x = parseFloat($('tradeX').value);
        const r = E.trade(S, c.kind, c.side, c.id, x, { mortgage: $('mortgage') ? $('mortgage').checked : false });
        if (afterTrade(r)) closeModal(); break;
      }
      case 'qset': qset(t.dataset.m, parseFloat(t.dataset.p)); break;
      case 'next': doNext(1); break;
      case 'next3': doNext(3); break;
      case 'intel': { const r = E.buyIntel(S); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { save(); renderAll(); } break; }
      case 'help': helpModal(); break;
      case 'lang': setLang(I.lang === 'en' ? 'zh' : 'en'); break;
      case 'closemodal': closeModal(); break;
      case 'new': case 'newgame': startScreen(); break;
      case 'mode': openSetup(t.dataset.v); break;
      case 'mkt': setup.market = t.dataset.v; setupScreen(); break;
      case 'sec': setup.sec = t.dataset.v; setupScreen(); break;
      case 'pick': {
        const c = t.dataset.c, i = setup.stocks.indexOf(c);
        if (i >= 0) setup.stocks.splice(i, 1); else if (setup.stocks.length >= MAX_ST) { toast(T('最多選 {0} 檔股票。', [MAX_ST]), 'bad'); break; } else { setup.stocks.push(c); setup.q = ''; }
        setupScreen(); break;
      }
      case 'cpick': {
        const c = t.dataset.c, i = setup.cryptos.indexOf(c);
        if (i >= 0) setup.cryptos.splice(i, 1); else if (setup.cryptos.length >= MAX_CR) { toast(T('最多選 {0} 種加密貨幣。', [MAX_CR]), 'bad'); break; } else setup.cryptos.push(c);
        setupScreen(); break;
      }
      case 'start': tryStart(); break;
      case 'startok': newGame(setup.mode, buildCfg()); break;
      case 'backsetup': setupScreen(); break;
      case 'range': range = parseInt(t.dataset.v, 10) || 0; renderDetail(); break;
      case 'goto': { const k = t.dataset.k; tab = k; sel = { kind: k, id: t.dataset.v }; renderTabs(); renderMain(); window.scrollTo(0, 0); break; }
      case 'plan': planModal(); break;
      case 'planq': $('planAmt').value = t.dataset.v; break;
      case 'planok': case 'plandel': { const r = E.setPlan(S, sel.kind, sel.id, act === 'plandel' ? 0 : $('planAmt').value); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { save(); closeModal(); renderMain(); } break; }
      case 'order': orderModal(); break;
      case 'orderok': case 'orderdel': { const r = act === 'orderdel' ? E.setOrder(S, sel.kind, sel.id, 0, 0) : E.setOrder(S, sel.kind, sel.id, $('odSL').value, $('odTP').value); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { save(); closeModal(); renderMain(); } break; }
      case 'continue': { const sv = loadSave(); if (sv) { S = sv; sel = firstStock(); tab = 'stock'; closeModal(); renderAll(); } break; }
      case 'result': resultModal(); break;
      case 'share': navigator.clipboard && navigator.clipboard.writeText(window._shareText).then(() => toast(T('已複製成績，貼到社群分享吧！')), () => toast(T('無法複製，請手動複製。'), 'bad')); break;
      case 'loanq': {
        const inp = $('loanAmt'), v = t.dataset.v;
        inp.value = v === 'max' ? Math.floor(E.maxBorrow(S)) : v === 'all' ? Math.floor(Math.min(S.marginDebt, S.cash)) : v; break;
      }
      case 'borrow': { const r = E.borrow(S, $('loanAmt').value); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { achToast(r.ach); save(); renderAll(); } break; }
      case 'repay': { const r = E.repay(S, $('loanAmt').value); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { save(); renderAll(); } break; }
    }
  });
  document.addEventListener('input', e => { if (e.target.id === 'tradeX') tradePreview(); if (e.target.id === 'stockQ' && setup) { setup.q = e.target.value; $('searchRes').innerHTML = searchHTML(); } });
  document.addEventListener('change', e => { if (e.target.id === 'mortgage') tradePreview(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.querySelector('.modal-bg .close')) closeModal();
    if (e.key === 'Enter' && $('tradeOk') && document.activeElement === $('tradeX')) $('tradeOk').click();
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S) { if (tab !== 'loan' && tab !== 'port') renderDetail(); renderNews(); if (tab === 'port') drawPort(); } }, 150); });
  $('btnHelp').addEventListener('click', helpModal);
  $('btnNew').addEventListener('click', startScreen);
  $('btnLang').addEventListener('click', () => setLang(I.lang === 'en' ? 'zh' : 'en'));

  /* ---------- 廣告（App 內不顯示）---------- */
  function initAds() {
    if (window.WACP_IS_APP) return;
    const map = { adTop: CFG.slots && CFG.slots.top, adSide: CFG.slots && CFG.slots.side, adBottom: CFG.slots && CFG.slots.bottom };
    for (const id in map) {
      if (!map[id]) continue;
      $(id).innerHTML = '<div class="adlabel">' + T('廣告') + '</div><ins class="adsbygoogle" style="display:block" data-ad-client="' + CFG.adsenseClient + '" data-ad-slot="' + map[id] + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 廣告載入失敗不影響遊戲 */ }
    }
  }

  /* ---------- 啟動 ---------- */
  function boot() {
    initAds();
    const sv = loadSave();
    if (sv && !sv.finished) S = sv; else S = E.newGame('normal');
    sel = firstStock(); renderAll(); startScreen();
    M.onChange(() => { if (setup && $('setupBox') && document.activeElement !== $('stockQ')) setupScreen(); });
    M.load();
  }
  boot();
})();
