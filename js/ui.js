/* 我愛操盤手 - 使用者介面 */
(function () {
  'use strict';
  const D = window.GAME_DATA, E = window.GameEngine, R = D.RULES, CFG = window.SITE_CONFIG || {};
  const SAVE_KEY = 'wacp_save_v1', LB_KEY = 'wacp_lb_v1';
  const COLORS = { cash: '#8b97b3', stock: '#4f8cff', btc: '#f5b83d', fund: '#a78bfa', re: '#34d399' };
  const TABS = [['stock', '股票'], ['btc', '比特幣'], ['re', '房地產'], ['fund', '基金'], ['loan', '借貸'], ['port', '資產總覽']];
  let S = null, tab = 'stock', sel = { kind: 'stock', id: D.STOCKS[0].id };

  const $ = id => document.getElementById(id);
  const money = E.fmtMoney;
  const full = n => Math.round(n).toLocaleString('en-US');
  const pct = (r, d) => (r > 0 ? '+' : '') + (r * 100).toFixed(d == null ? 2 : d) + '%';
  const cls = r => (r > 0.00005 ? 'up' : r < -0.00005 ? 'down' : 'mute');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------- 存檔 ---------- */
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ } }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 1 && s.stocks ? s : null;
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
      const d = D.STOCKS.find(x => x.id === id), o = S.stocks[id];
      return { name: d.name, desc: d.desc, price: o.price, ptxt: o.price.toFixed(2), hist: o.hist, last: o.last, qty: o.shares, qtxt: full(o.shares) + ' 股', value: o.shares * o.price, cost: o.cost,
        kv: [['產業', D.SECTOR_NAMES[d.sector]], ['年殖利率', (d.div * 100).toFixed(1) + '%'], ['敏感度 β', d.beta.toFixed(1)], ['月波動', (d.vol * 100).toFixed(1) + '%']] };
    }
    if (kind === 'btc') {
      const o = S.btc;
      return { name: D.BTC.name, desc: D.BTC.desc, price: o.price, ptxt: full(o.price), hist: o.hist, last: o.last, qty: o.units, qtxt: o.units.toFixed(4) + ' 枚', value: o.units * o.price, cost: o.cost,
        kv: [['交易成本', '買賣各 0.5%'], ['特性', '24 小時交易、波動極大']] };
    }
    if (kind === 're') {
      const d = D.PROPERTIES.find(x => x.id === id), o = S.re[id];
      return { name: d.name, desc: d.desc, price: o.price, ptxt: full(o.price), hist: o.hist, last: o.last, qty: o.count, qtxt: o.count + ' 間', value: o.count * o.price, cost: o.cost,
        kv: [['月租金', full(o.rent)], ['租金報酬率', (o.rent * 12 / o.price * 100).toFixed(2) + '%'], ['房貸餘額', money(o.mortgage)], ['買進／賣出成本', '3% ／ 4%']] };
    }
    const d = D.FUNDS.find(x => x.id === id), o = S.funds[id];
    return { name: d.name, desc: d.desc, price: o.nav, ptxt: o.nav.toFixed(3), hist: o.hist, last: o.last, qty: o.units, qtxt: o.units.toFixed(2) + ' 單位', value: o.units * o.nav, cost: o.cost,
      kv: [['風險等級', d.risk], ['申購手續費', (d.buyFee * 100).toFixed(1) + '%']] };
  }
  function yoy(hist) { const n = hist.length; return n > 13 ? hist[n - 1] / hist[n - 13] - 1 : hist[n - 1] / hist[0] - 1; }
  function monthLabel(i) { const m = i - E.WARMUP; return m <= 0 ? (m === 0 ? '開局' : '開局前' + (-m) + '月') : '第' + m + '月'; }

  /* ---------- 圖表 ---------- */
  function drawLine(cv, ys, o) {
    if (!cv) return; o = o || {};
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, hh = cv.clientHeight; if (!w || ys.length < 2) return;
    cv.width = w * dpr; cv.height = hh * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, hh);
    const pl = 56, pr = 10, pt = 10, pb = 22;
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
      c.fillStyle = '#f5b83d'; c.textAlign = 'left'; c.fillText('目標', pl + 4, Y(o.line) - 4);
    }
    const grd = c.createLinearGradient(0, pt, 0, hh - pb); grd.addColorStop(0, col + '55'); grd.addColorStop(1, col + '00');
    c.beginPath(); c.moveTo(X(0), Y(ys[0]));
    for (let i = 1; i < ys.length; i++) c.lineTo(X(i), Y(ys[i]));
    c.lineTo(X(ys.length - 1), hh - pb); c.lineTo(X(0), hh - pb); c.closePath(); c.fillStyle = grd; c.fill();
    c.beginPath(); c.strokeStyle = col; c.lineWidth = 2; c.lineJoin = 'round';
    for (let i = 0; i < ys.length; i++) i ? c.lineTo(X(i), Y(ys[i])) : c.moveTo(X(i), Y(ys[i]));
    c.stroke();
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
    if (total <= 0) { c.fillStyle = '#8b97b3'; c.textAlign = 'center'; c.fillText('尚無資產', cx, cy); return; }
    let a0 = -Math.PI / 2;
    for (const it of items) {
      if (it.value <= 0) continue;
      const a1 = a0 + it.value / total * Math.PI * 2;
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a1); c.closePath(); c.fillStyle = it.color; c.fill(); a0 = a1;
    }
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx, cy, r * 0.58, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#e6ebf5'; c.textAlign = 'center'; c.font = 'bold 14px sans-serif'; c.fillText('總資產', cx, cy - 2);
    c.font = '12px sans-serif'; c.fillStyle = '#8b97b3'; c.fillText(money(total), cx, cy + 16);
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    renderStats(); renderTabs(); renderMain(); renderNews(); renderLog(); renderActions();
  }
  function renderStats() {
    const nw = E.netWorth(S), prev = S.netHist.length > 1 ? S.netHist[S.netHist.length - 2] : S.startCash;
    const dnw = nw - prev, debt = S.marginDebt + E.mortgageTotal(S), prog = clamp(nw / S.target, 0, 1);
    const yr = Math.floor(S.month / 12) + 1, mo = S.month % 12 + 1;
    $('dateBox').innerHTML = S.finished ? '遊戲結束<small>共 ' + S.month + ' 個月</small>' : '第 ' + Math.min(yr, 10) + ' 年 ' + mo + ' 月<small>已過 ' + S.month + ' / ' + S.months + ' 個月</small>';
    $('stats').innerHTML =
      '<div class="stat"><div class="k">淨資產</div><div class="v">' + money(nw) + '</div><div class="s ' + cls(dnw) + '">' + (S.month ? '較上月 ' + (dnw >= 0 ? '+' : '') + money(dnw) : '起始資金 ' + money(S.startCash)) + '</div></div>' +
      '<div class="stat"><div class="k">現金</div><div class="v">' + money(S.cash) + '</div><div class="s">月儲蓄 +' + money(S.save) + '</div></div>' +
      '<div class="stat"><div class="k">總負債</div><div class="v ' + (debt > 0 ? 'down' : '') + '">' + money(debt) + '</div><div class="s">利率 ' + (S.rate * 100).toFixed(2) + '%</div></div>' +
      '<div class="stat goal"><div class="k">目標 ' + money(S.target) + (S.won ? '　🎉 已達成' : '') + '</div><div class="v">' + (nw / S.target * 100).toFixed(1) + '%</div><div class="bar"><i style="width:' + (prog * 100).toFixed(1) + '%"></i></div></div>';
  }
  function renderTabs() {
    $('tabs').innerHTML = TABS.map(t => '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('');
  }
  function renderMain() {
    const lb = $('listBox'), db = $('detailBox');
    if (tab === 'loan') { lb.innerHTML = loanHTML(); db.style.display = 'none'; return; }
    if (tab === 'port') { lb.innerHTML = portHTML(); db.style.display = 'none'; requestAnimationFrame(drawPort); return; }
    db.style.display = '';
    let rows = '', head = '';
    const row = (kind, id) => {
      const f = info(kind, id);
      return '<tr class="row' + (sel.kind === kind && sel.id === id ? ' sel' : '') + '" data-act="sel" data-k="' + kind + '" data-v="' + id + '"><td class="name"><b>' + f.name + '</b></td><td>' + f.ptxt + '</td><td class="' + cls(f.last) + '">' + pct(f.last) + '</td><td class="' + cls(yoy(f.hist)) + '">' + pct(yoy(f.hist), 1) + '</td><td>' + (f.qty > 0 ? f.qtxt : '<span class="mute">—</span>') + '</td></tr>';
    };
    head = '<tr><th>名稱</th><th>' + (tab === 'fund' ? '淨值' : '價格') + '</th><th>月漲跌</th><th>近一年</th><th>持有</th></tr>';
    if (tab === 'stock') { sel.kind = sel.kind === 'stock' ? 'stock' : 'stock'; if (!S.stocks[sel.id]) sel.id = D.STOCKS[0].id; rows = D.STOCKS.map(s => row('stock', s.id)).join(''); }
    if (tab === 'btc') { sel = { kind: 'btc', id: 'btc' }; rows = row('btc', 'btc'); }
    if (tab === 're') { if (!S.re[sel.id] || sel.kind !== 're') sel = { kind: 're', id: D.PROPERTIES[0].id }; rows = D.PROPERTIES.map(s => row('re', s.id)).join(''); }
    if (tab === 'fund') { if (!S.funds[sel.id] || sel.kind !== 'fund') sel = { kind: 'fund', id: D.FUNDS[0].id }; rows = D.FUNDS.map(s => row('fund', s.id)).join(''); }
    if (tab === 'stock' && sel.kind !== 'stock') sel = { kind: 'stock', id: D.STOCKS[0].id };
    let note = '';
    if (tab === 're') note = '<p class="mute" style="margin:8px 0 0;font-size:13px">房市狀態：<b>' + D.RE_REG.names[S.reReg] + '</b>　買房可用房貸（七成），利率 = 政策利率 + 1%，現值 ' + money(E.reValue(S)) + '，每月淨租金約 ' + money(E.monthlyRent(S)) + '。</p>';
    lb.innerHTML = '<h3>' + TABS.find(t => t[0] === tab)[1] + '<small>點選一列查看走勢與交易　紅漲綠跌</small></h3><div class="tbl-wrap"><table>' + head + rows + '</table></div>' + note;
    renderDetail();
  }
  function renderDetail() {
    const f = info(sel.kind, sel.id), pnl = f.value - f.cost, pr = f.cost > 0 ? pnl / f.cost : 0;
    const n = f.hist.length, from = Math.max(0, n - 37), ys = f.hist.slice(from);
    $('detailBox').innerHTML =
      '<div class="detail-head"><div><h2>' + f.name + '</h2><div class="mute" style="font-size:13px;max-width:460px">' + f.desc + '</div></div><div style="text-align:right"><div class="price">' + f.ptxt + '</div><div class="' + cls(f.last) + '">本月 ' + pct(f.last) + '</div></div></div>' +
      '<canvas id="chart"></canvas>' +
      '<div class="kv">' + f.kv.map(k => '<div><small>' + k[0] + '</small><b>' + k[1] + '</b></div>').join('') +
      '<div><small>持有</small><b>' + (f.qty > 0 ? f.qtxt : '無') + '</b></div><div><small>市值</small><b>' + money(f.value) + '</b></div>' +
      (f.cost > 0 ? '<div><small>未實現損益</small><b class="' + cls(pnl) + '">' + (pnl >= 0 ? '+' : '') + money(pnl) + '（' + pct(pr, 1) + '）</b></div>' : '') + '</div>' +
      '<div class="btn-row"><button class="btn buy" data-act="trade" data-side="buy">買進</button><button class="btn sell" data-act="trade" data-side="sell"' + (f.qty > 0 ? '' : ' disabled') + '>賣出</button></div>';
    requestAnimationFrame(() => drawLine($('chart'), ys, { x0: monthLabel(from), x1: monthLabel(n - 1) }));
  }
  function renderNews() {
    const ntag = n => n.quiet ? '' : n.known ? (n.truth ? '<span class="tag ok">內線：屬實</span>' : '<span class="tag no">內線：不實</span>') : '<span class="tag rumor">傳聞</span>';
    const sentTxt = ['偏多', '中性', '偏空'][S.sent == null ? 1 : S.sent], sentCls = ['up', 'mute', 'down'][S.sent == null ? 1 : S.sent];
    $('newsBox').innerHTML = '<h3>📰 本月新聞<small>消息不一定準確</small></h3>' +
      (S.finished ? '<p class="mute">遊戲已結束。</p>' : S.news.map(n => '<div class="news"><b>' + n.t + ntag(n) + '</b><p>' + n.d + '</p></div>').join('') +
        '<div class="sent"><span>市場情緒指標：<b class="' + sentCls + '">' + sentTxt + '</b></span><span>政策利率：<b>' + (S.rate * 100).toFixed(2) + '%</b></span></div>' +
        '<div class="btn-row"><button class="btn blue small" data-act="intel"' + (S.intel || S.cash < R.intelCost ? ' disabled' : '') + '>💼 買內線情報（' + full(R.intelCost) + '）</button></div>' +
        '<p class="mute" style="font-size:12px;margin:6px 0 0">新聞約 6～8 成會成真；消息落空時，市場常會朝反方向小幅波動。情緒指標約 7 成準確，僅供參考。</p>');
    $('netBox').innerHTML = '<h3>淨資產走勢<small>虛線為目標</small></h3><canvas id="netChart" class="short"></canvas>';
    requestAnimationFrame(() => {
      const ys = S.netHist.length > 1 ? S.netHist : [S.netHist[0], S.netHist[0]];
      drawLine($('netChart'), ys, { line: S.target, fmt: v => money(v), color: '#4f8cff', x0: '開局', x1: '第' + S.month + '月' });
    });
  }
  function renderLog() {
    $('logBox').innerHTML = '<h3>📒 每月紀錄</h3>' + (S.log.length ? S.log.slice(0, 8).map(l => '<div class="log-item"><span class="m">第' + l.m + '月</span>' + l.lines.map(x => '<span class="log-line ' + x.k + '">' + x.m + '</span>').join('') + '</div>').join('') : '<p class="mute">還沒有紀錄，按「下一個月」開始。</p>');
  }
  function renderActions() {
    $('actionBar').innerHTML = S.finished ? '<button class="btn" data-act="newgame">再玩一次</button><button class="btn ghost" data-act="result">查看成績</button>' :
      '<button class="btn" data-act="next">下一個月 ▶</button><button class="btn ghost" data-act="next3">快轉 3 個月 ⏩</button>';
  }

  /* ---------- 借貸 ---------- */
  function loanHTML() {
    const liq = E.liquidValue(S), ratio = liq > 0 ? S.marginDebt / liq : 0, mb = E.maxBorrow(S);
    const rate = (S.rate + R.marginSpread) * 100, mrate = (S.rate + R.mortgageSpread) * 100;
    const warn = ratio > 0.6 ? 'down' : ratio > 0.45 ? '' : 'mute';
    let mort = '';
    for (const p of D.PROPERTIES) { const o = S.re[p.id]; if (o.mortgage > 0) mort += '<tr><td>' + p.name + ' × ' + o.count + '</td><td>' + money(o.mortgage) + '</td></tr>'; }
    return '<h3>借貸與槓桿<small>以股票、比特幣、基金為擔保</small></h3>' +
      '<div class="kv"><div><small>融資借款</small><b>' + money(S.marginDebt) + '</b></div><div><small>融資利率</small><b>' + rate.toFixed(2) + '%</b></div><div><small>可再借額度</small><b>' + money(mb) + '</b></div>' +
      '<div><small>融資維持情況（借款／證券市值）</small><b class="' + warn + '">' + (ratio * 100).toFixed(1) + '%</b></div></div>' +
      '<p class="mute" style="font-size:13px">借款比例超過 <b>70%</b> 會被追繳並強制賣出持股（另收 1% 費用）。借得越多，賺得多但也可能一次賠光。</p>' +
      '<div class="field"><input type="number" id="loanAmt" min="0" step="10000" placeholder="輸入金額（元）"></div>' +
      '<div class="quick"><button data-act="loanq" data-v="max">最大可借</button><button data-act="loanq" data-v="all">全部還清</button><button data-act="loanq" data-v="100000">10 萬</button><button data-act="loanq" data-v="500000">50 萬</button></div>' +
      '<div class="btn-row"><button class="btn buy" data-act="borrow">借款</button><button class="btn sell" data-act="repay">還款</button></div>' +
      '<h3 style="margin-top:16px">房貸（買房時自動辦理，七成）<small>利率 ' + mrate.toFixed(2) + '%</small></h3>' +
      (mort ? '<table><tr><th>房產</th><th>房貸餘額</th></tr>' + mort + '</table><p class="mute" style="font-size:13px">房貸只付利息，賣出房產時一次還清。</p>' : '<p class="mute">目前沒有房貸。</p>');
  }

  /* ---------- 資產總覽 ---------- */
  function allocItems() {
    return [
      { label: '現金', value: Math.max(0, S.cash), color: COLORS.cash }, { label: '股票', value: E.stockValue(S), color: COLORS.stock },
      { label: '比特幣', value: E.btcValue(S), color: COLORS.btc }, { label: '基金', value: E.fundValue(S), color: COLORS.fund }, { label: '房地產', value: E.reValue(S), color: COLORS.re }
    ];
  }
  function drawPort() { drawDonut($('donut'), allocItems()); }
  function portHTML() {
    const items = allocItems(), total = items.reduce((a, b) => a + b.value, 0);
    const lb = getLB();
    const unlocked = D.ACHIEVEMENTS.filter(a => S.ach[a.id]).length;
    return '<h3>資產配置<small>分散風險是投資的第一課</small></h3><div class="grid2"><canvas id="donut" class="short"></canvas><div>' +
      '<div class="legend" style="flex-direction:column">' + items.map(i => '<span><i style="background:' + i.color + '"></i>' + i.label + '　<b>' + money(i.value) + '</b>' + (total > 0 ? '（' + (i.value / total * 100).toFixed(1) + '%）' : '') + '</span>').join('') + '</div>' +
      '<div class="kv" style="margin-top:10px"><div><small>已實現損益</small><b class="' + cls(S.stats.realized) + '">' + money(S.stats.realized) + '</b></div><div><small>交易次數</small><b>' + S.stats.trades + '</b></div><div><small>追繳次數</small><b>' + S.stats.mcCount + '</b></div><div><small>歷史最高淨資產</small><b>' + money(S.stats.maxNW) + '</b></div></div></div></div>' +
      '<h3 style="margin-top:14px">成就 <small>' + unlocked + ' / ' + D.ACHIEVEMENTS.length + '</small></h3><div class="ach">' + D.ACHIEVEMENTS.map(a => '<div class="' + (S.ach[a.id] ? 'on' : '') + '"><b>' + (S.ach[a.id] ? '🏆 ' : '🔒 ') + a.name + '</b><span>' + a.desc + '</span></div>').join('') + '</div>' +
      '<h3 style="margin-top:14px">本機排行榜<small>只存在你的瀏覽器</small></h3>' + (lb.length ? '<table><tr><th>名次</th><th>模式</th><th>最終淨資產</th><th>稱號</th></tr>' + lb.map((e, i) => '<tr><td>' + (i + 1) + '</td><td>' + e.mode + '</td><td>' + money(e.nw) + '</td><td>' + e.rank + '</td></tr>').join('') + '</table>' : '<p class="mute">玩完一場遊戲後，成績會出現在這裡。</p>');
  }

  /* ---------- 彈窗 ---------- */
  function openModal(html, wide, closable) {
    $('modalRoot').innerHTML = '<div class="modal-bg" ' + (closable === false ? '' : 'data-act="bgclose"') + '><div class="modal' + (wide ? ' wide' : '') + '" data-stop="1">' + (closable === false ? '' : '<button class="close" data-act="closemodal">×</button>') + html + '</div></div>';
  }
  function closeModal() { $('modalRoot').innerHTML = ''; }

  function startScreen() {
    const sv = loadSave();
    openModal('<div class="center"><div style="font-size:44px">📈</div><h2 style="font-size:26px">我愛操盤手</h2><p class="mute">用 10 年時間操作股票、比特幣、房地產與基金，達成你的財富目標。</p></div>' +
      (sv && !sv.finished ? '<button class="mode" data-act="continue"><b>▶ 繼續上次的遊戲</b><span>' + (D.MODES.find(m => m.id === sv.mode) || {}).name + '・第 ' + sv.month + ' 個月・淨資產 ' + money(E.netWorth(sv)) + '</span></button>' : '') +
      '<div class="modes">' + D.MODES.map(m => '<button class="mode" data-act="mode" data-v="' + m.id + '"><b>' + m.name + '</b><em>' + m.tag + '</em><span>' + m.desc + '</span></button>').join('') + '</div>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn ghost small" data-act="help">玩法說明</button></div>' +
      '<p class="mute center" style="font-size:12px;margin-top:10px">本遊戲為虛構模擬，不構成投資建議。</p>', false, false);
  }
  function helpModal() {
    openModal('<div class="help"><h2>玩法說明</h2>' +
      '<h3>🎯 目標</h3><p>在 120 個月（10 年）內，把淨資產提高到模式目標。淨資產 = 現金 + 股票 + 比特幣 + 基金 + 房產市值 − 所有借款。淨資產歸零就破產。</p>' +
      '<h3>🔄 每個月</h3><ul><li>先看「本月新聞」與情緒指標，決定要買還是賣。</li><li>按「下一個月」後，價格依新聞與市場變化，並結算股利、租金、利息、薪資。</li><li>每月會自動存入儲蓄，每年加薪 3%、年底有獎金，偶爾會有突發支出或意外之財。</li></ul>' +
      '<h3>💹 四大資產</h3><ul><li><b>股票</b>：七家虛構公司，各有產業與個性；每季配息。手續費買 0.2%、賣 0.45%。</li><li><b>比特幣</b>：波動最大，牛熊分明，買賣各 0.5%。</li><li><b>房地產</b>：每月收租，可用七成房貸，但買賣成本高（3%／4%），也可能空租。</li><li><b>基金</b>：從貨幣型到成長型，風險與費用各不同；指數基金等於一籃子買進七檔股票。</li></ul>' +
      '<h3>📰 新聞與情報</h3><p>每月 1～3 則新聞，約 6～8 成會成真；落空時市場常反向小幅波動。可花 ' + full(R.intelCost) + ' 元買「內線情報」確認本月消息真偽。</p>' +
      '<h3>⚠️ 槓桿與追繳</h3><p>可抵押股票、比特幣、基金向券商借款（上限 50%）。當借款／證券市值超過 70%，會被強制賣出持股。</p>' +
      '<h3>🎨 顏色</h3><p>採用台灣習慣：<span class="up">紅色上漲</span>、<span class="down">綠色下跌</span>。</p>' +
      '<h3>💾 存檔</h3><p>遊戲每個動作後自動存在你的瀏覽器（localStorage），換裝置或清除瀏覽資料會消失。</p>' +
      '<p class="mute" style="margin-top:12px">所有公司、新聞、價格皆為虛構模擬，僅供娛樂與教育，不構成投資建議。</p></div><div class="btn-row"><button class="btn" data-act="closemodal">開始玩</button></div>', true);
  }
  function tradeModal(side) {
    const kind = sel.kind, id = sel.id, f = info(kind, id);
    const unit = kind === 'stock' ? '股' : kind === 're' ? '間' : '';
    let label, ph, quick = '';
    if (side === 'buy') {
      if (kind === 'stock' || kind === 're') {
        label = '買進數量（' + unit + '）'; ph = '1';
        const q = [['25% 現金', 0.25], ['50% 現金', 0.5], ['全部現金', 1]];
        quick = q.map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="buyqty">' + x[0] + '</button>').join('');
      } else {
        label = '投入金額（元）'; ph = '100000';
        quick = [['10%', .1], ['25%', .25], ['50%', .5], ['全部現金', 1]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="buyamt">' + x[0] + '</button>').join('');
      }
    } else {
      if (kind === 'stock' || kind === 're') {
        label = '賣出數量（' + unit + '）'; ph = '1';
        quick = [['25%', .25], ['50%', .5], ['全部', 1]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="sellqty">' + x[0] + '</button>').join('');
      } else {
        label = '賣出比例（%）'; ph = '100';
        quick = [['25%', 25], ['50%', 50], ['全部', 100]].map(x => '<button data-act="qset" data-p="' + x[1] + '" data-m="sellpct">' + x[0] + '</button>').join('');
      }
    }
    openModal('<h2>' + (side === 'buy' ? '買進 ' : '賣出 ') + f.name + '</h2><p class="mute">現價 ' + f.ptxt + '　可用現金 ' + money(S.cash) + (f.qty > 0 ? '　持有 ' + f.qtxt : '') + '</p>' +
      '<div class="field"><label>' + label + '</label><input type="number" id="tradeX" min="0" placeholder="' + ph + '" inputmode="decimal"></div><div class="quick">' + quick + '</div>' +
      (kind === 're' && side === 'buy' ? '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="mortgage" checked> 使用房貸（七成，利率 ' + ((S.rate + R.mortgageSpread) * 100).toFixed(2) + '%）</label>' : '') +
      '<div class="preview" id="tradePrev">輸入數量後會顯示預估結果。</div>' +
      '<div class="btn-row"><button class="btn ' + (side === 'buy' ? 'buy' : 'sell') + '" id="tradeOk" data-act="tradeok" data-side="' + side + '">確認' + (side === 'buy' ? '買進' : '賣出') + '</button><button class="btn ghost" data-act="closemodal">取消</button></div>');
    $('tradeX').focus();
    window._tradeCtx = { side, kind, id };
  }
  function tradePreview() {
    const c = window._tradeCtx; if (!c) return;
    const x = parseFloat($('tradeX').value), p = $('tradePrev');
    if (!(x > 0)) { p.className = 'preview'; p.textContent = '輸入數量後會顯示預估結果。'; return; }
    const r = E.trade(S, c.kind, c.side, c.id, x, { mortgage: $('mortgage') ? $('mortgage').checked : false }, true);
    p.className = 'preview' + (r.ok ? '' : ' err');
    p.textContent = r.msg + (r.ok && r.fee ? '（含手續費／稅費 ' + money(r.fee) + '）' : '');
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
  function achToast(list) { (list || []).forEach(a => toast('🏆 解鎖成就：' + a.name, 'ach')); }

  /* ---------- 結算畫面 ---------- */
  function resultModal() {
    const nw = E.netWorth(S), rk = E.rankOf(S), mode = D.MODES.find(m => m.id === S.mode);
    if (!S.lbSaved) { S.lbSaved = true; addLB({ mode: mode.name, nw, rank: rk.name, date: new Date().toISOString().slice(0, 10) }); save(); }
    const text = '我在《我愛操盤手》（' + mode.name + '）玩了 ' + S.month + ' 個月，最終淨資產 ' + money(nw) + '，稱號「' + rk.name + '」！你也來挑戰：' + location.origin + location.pathname;
    window._shareText = text;
    openModal('<div class="center"><div style="font-size:42px">' + (S.bankrupt ? '💥' : nw >= S.target ? '🏆' : '📊') + '</div><h2>' + (S.bankrupt ? '你破產了' : '遊戲結束') + '</h2>' +
      '<div class="big">' + money(nw) + '</div><div class="mute">目標 ' + money(S.target) + '（達成率 ' + (nw / S.target * 100).toFixed(0) + '%）</div>' +
      '<p style="font-size:20px;margin:10px 0 2px"><b>稱號：' + rk.name + '</b></p><p class="mute">' + rk.text + '</p></div>' +
      '<div class="kv"><div><small>遊戲月數</small><b>' + S.month + '</b></div><div><small>交易次數</small><b>' + S.stats.trades + '</b></div><div><small>已實現損益</small><b class="' + cls(S.stats.realized) + '">' + money(S.stats.realized) + '</b></div><div><small>成就</small><b>' + Object.keys(S.ach).length + ' / ' + D.ACHIEVEMENTS.length + '</b></div></div>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn" data-act="newgame">再玩一次</button><button class="btn ghost" data-act="share">複製成績分享</button><button class="btn ghost" data-act="closemodal">關閉</button></div>');
  }

  /* ---------- 動作 ---------- */
  function doNext(n) {
    if (S.finished) return;
    let rep = null;
    for (let i = 0; i < n; i++) {
      rep = E.advance(S);
      const notable = rep.lines.filter(l => l.k === 'bad' || l.k === 'good' && /年終|意外/.test(l.m));
      if (n === 1) { toast('第 ' + rep.month + ' 月　大盤 ' + pct(rep.mret, 1), rep.mret >= 0 ? 'good' : 'bad'); notable.slice(0, 3).forEach(l => toast(l.m, l.k)); }
      achToast(rep.ach);
      if (rep.mc || rep.win || rep.finished) break;
    }
    if (n > 1) toast('已快轉到第 ' + S.month + ' 月，淨資產 ' + money(E.netWorth(S)));
    save(); renderAll();
    if (rep.finished) { resultModal(); return; }
    if (rep.mc) openModal('<div class="center"><div style="font-size:42px">⚠️</div><h2>追繳保證金！</h2></div><p>你的借款占證券市值的比例過高，券商已強制賣出部分持股並償還借款。槓桿是雙面刃，下次記得留點緩衝。</p><div class="btn-row"><button class="btn" data-act="closemodal">我知道了</button></div>');
    else if (rep.win) openModal('<div class="center"><div style="font-size:42px">🎉</div><h2>達成目標！</h2></div><p>你的淨資產已突破 <b>' + money(S.target) + '</b>。要見好就收，還是繼續挑戰更高的成績？遊戲會繼續到第 120 個月，最終成績看那時的淨資產。</p><div class="btn-row"><button class="btn" data-act="closemodal">繼續挑戰</button></div>');
  }
  function afterTrade(r) {
    if (!r.ok) { toast(r.msg, 'bad'); return false; }
    toast(r.msg, r.pnl != null ? (r.pnl >= 0 ? 'good' : 'bad') : ''); achToast(r.ach); save(); renderAll(); return true;
  }
  function newGame(mode) { S = E.newGame(mode); sel = { kind: 'stock', id: D.STOCKS[0].id }; tab = 'stock'; save(); closeModal(); renderAll(); toast('遊戲開始！先看看本月新聞，再決定怎麼布局。'); }

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
      case 'closemodal': closeModal(); break;
      case 'new': case 'newgame': startScreen(); break;
      case 'mode': newGame(t.dataset.v); break;
      case 'continue': { const sv = loadSave(); if (sv) { S = sv; closeModal(); renderAll(); } break; }
      case 'result': resultModal(); break;
      case 'share': navigator.clipboard && navigator.clipboard.writeText(window._shareText).then(() => toast('已複製成績，貼到社群分享吧！'), () => toast('無法複製，請手動複製。', 'bad')); break;
      case 'loanq': {
        const inp = $('loanAmt'), v = t.dataset.v;
        inp.value = v === 'max' ? Math.floor(E.maxBorrow(S)) : v === 'all' ? Math.floor(Math.min(S.marginDebt, S.cash)) : v; break;
      }
      case 'borrow': { const r = E.borrow(S, $('loanAmt').value); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { achToast(r.ach); save(); renderAll(); } break; }
      case 'repay': { const r = E.repay(S, $('loanAmt').value); toast(r.msg, r.ok ? '' : 'bad'); if (r.ok) { save(); renderAll(); } break; }
    }
  });
  document.addEventListener('input', e => { if (e.target.id === 'tradeX') tradePreview(); });
  document.addEventListener('change', e => { if (e.target.id === 'mortgage') tradePreview(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.querySelector('.modal-bg .close')) closeModal();
    if (e.key === 'Enter' && $('tradeOk') && document.activeElement === $('tradeX')) $('tradeOk').click();
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S) { renderDetail && tab !== 'loan' && tab !== 'port' && renderDetail(); renderNews(); if (tab === 'port') drawPort(); } }, 150); });
  $('btnHelp').addEventListener('click', helpModal);
  $('btnNew').addEventListener('click', startScreen);

  /* ---------- 廣告 ---------- */
  function initAds() {
    const map = { adTop: CFG.slots && CFG.slots.top, adSide: CFG.slots && CFG.slots.side, adBottom: CFG.slots && CFG.slots.bottom };
    for (const id in map) {
      if (!map[id]) continue;
      $(id).innerHTML = '<div class="adlabel">廣告</div><ins class="adsbygoogle" style="display:block" data-ad-client="' + CFG.adsenseClient + '" data-ad-slot="' + map[id] + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 廣告載入失敗不影響遊戲 */ }
    }
  }

  /* ---------- 啟動 ---------- */
  function boot() {
    initAds();
    const sv = loadSave();
    if (sv && !sv.finished) { S = sv; renderAll(); startScreen(); }
    else { S = E.newGame('normal'); renderAll(); startScreen(); }
  }
  boot();
})();
