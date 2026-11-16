/* 我愛操盤手 - 遊戲引擎（純邏輯，無 DOM）*/
(function (root) {
  'use strict';
  const D = root.GAME_DATA;
  const R = D.RULES;
  const SECS = ['tech', 'finance', 'shipping', 'biotech', 'consumer', 'energy', 'industry'];
  const WARMUP = 12;
  const T = (k, p) => root.I18N.t(k, p);
  function L(rep, k, key, p) { rep.lines.push({ k: k, key: key, p: p || [] }); }

  /* ---------- 亂數（可存檔的種子亂數） ---------- */
  function rnd(s) {
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randn(s) {
    const u = rnd(s) || 1e-9, v = rnd(s);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function chainNext(s, cur, chain) {
    const r = rnd(s); let a = 0;
    for (let i = 0; i < chain[cur].length; i++) { a += chain[cur][i]; if (r < a) return i; }
    return chain[cur].length - 1;
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  /* ---------- 估值 ---------- */
  function stockValue(s) { let v = 0; for (const k in s.stocks) v += s.stocks[k].shares * s.stocks[k].price; return v; }
  function cryptoValue(s) { let v = 0; for (const k in s.crypto) v += s.crypto[k].units * s.crypto[k].price; return v; }
  function cryptoCount(s) { let n = 0; for (const k in s.crypto) if (s.crypto[k].units > 0) n++; return n; }
  function fundValue(s) { let v = 0; for (const k in s.funds) v += s.funds[k].units * s.funds[k].nav; return v; }
  function reValue(s) { let v = 0; for (const k in s.re) v += s.re[k].count * s.re[k].price; return v; }
  function mortgageTotal(s) { let v = 0; for (const k in s.re) v += s.re[k].mortgage; return v; }
  function liquidValue(s) { return stockValue(s) + cryptoValue(s) + fundValue(s); }
  function netWorth(s) { return s.cash + liquidValue(s) + reValue(s) - s.marginDebt - mortgageTotal(s); }
  function propertyCount(s) { let n = 0; for (const k in s.re) n += s.re[k].count; return n; }
  function monthlyRent(s) { let v = 0; for (const k in s.re) v += s.re[k].count * s.re[k].rent; return v; }
  function holdsStocks(s) { for (const k in s.stocks) if (s.stocks[k].shares > 0) return true; return false; }
  function holdsFunds(s) { for (const k in s.funds) if (s.funds[k].units > 0) return true; return false; }

  /* ---------- 建立新遊戲 ---------- */
  function sig(p) { return p >= 1000 ? Math.round(p) : p >= 1 ? +p.toFixed(2) : +p.toPrecision(4); }
  function defaultCfg() {
    return { market: 'fic', stocks: D.STOCKS.map(x => Object.assign({}, x)), cryptos: D.CRYPTOS.filter(c => D.DEFAULT_CRYPTO.indexOf(c.id) >= 0).map(x => Object.assign({}, x)), taiex: D.SNAP.taiex, date: D.SNAP.date, live: false };
  }
  function newGame(modeId, seed, cfg) {
    const mode = D.MODES.find(m => m.id === modeId) || D.MODES[1];
    cfg = cfg || defaultCfg();
    const s = {
      v: 2, cfg: cfg, crypto: {}, plans: [], orders: {}, trades: [], index: cfg.taiex || D.SNAP.taiex, indexHist: [cfg.taiex || D.SNAP.taiex], mode: mode.id, month: 0, months: R.months,
      rng: ((seed != null ? seed : Math.floor(Math.random() * 4294967296)) >>> 0),
      cash: mode.cash, startCash: mode.cash, save: mode.save, target: mode.target,
      marginDebt: 0, rate: 0.02, reg: 1, btcReg: 1, reReg: 1,
      stocks: {}, re: {}, funds: {},
      rateHist: [], netHist: [], news: [], log: [], flags: {}, ach: {},
      stats: { realized: 0, mcCount: 0, trades: 0, maxNW: mode.cash },
      won: false, finished: false, bankrupt: false, intel: false, warm: WARMUP
    };
    for (const st of cfg.stocks) s.stocks[st.id] = { price: st.price, hist: [st.price], shares: 0, cost: 0, last: 0 };
    for (const c of cfg.cryptos) s.crypto[c.id] = { price: c.price, hist: [c.price], units: 0, cost: 0, last: 0 };
    for (const p of D.PROPERTIES) s.re[p.id] = { price: p.price, hist: [p.price], count: 0, cost: 0, mortgage: 0, rent: p.rent, last: 0 };
    for (const f of D.FUNDS) s.funds[f.id] = { nav: f.nav, hist: [f.nav], units: 0, cost: 0, last: 0 };
    s.reg = chainNext(s, 1, D.MARKET.chain);
    s.btcReg = chainNext(s, 1, D.BTC_REG.chain);
    s.rateHist.push(s.rate);
    // 先模擬 12 個月，讓圖表一開始就有歷史
    const zero = zeroShocks();
    for (let i = 0; i < WARMUP; i++) stepPrices(s, zero);
    // 把暖身後的價格校正回起始價（真實市場模式＝真實收盤價），歷史走勢等比例縮放
    const fix = (o, target, f) => { const k = target / o.price; o.hist = o.hist.map(v => f(v * k)); o.price = target; o.hist[o.hist.length - 1] = target; };
    for (const st of cfg.stocks) fix(s.stocks[st.id], st.price, v => +v.toFixed(2));
    for (const c of cfg.cryptos) fix(s.crypto[c.id], c.price, sig);
    { const k = s.indexHist[0] / s.index; s.indexHist = s.indexHist.map(v => +(v * k).toFixed(2)); s.index = s.indexHist[s.indexHist.length - 1]; }
    s.netHist.push(netWorth(s));
    genNews(s);
    return s;
  }

  function zeroShocks() { return { market: 0, tech: 0, finance: 0, shipping: 0, biotech: 0, consumer: 0, energy: 0, industry: 0, btc: 0, re: 0, rate: 0 }; }

  /* ---------- 新聞 ---------- */
  function genNews(s) {
    const r = rnd(s);
    const n = r < 0.5 ? 1 : r < 0.9 ? 2 : 3;
    const used = {}; s.news = []; s.intel = false;
    for (let i = 0; i < n; i++) {
      let total = 0;
      for (const e of D.EVENTS) if (!used[e.id]) total += e.w;
      let x = rnd(s) * total, ev = null;
      for (const e of D.EVENTS) { if (used[e.id]) continue; x -= e.w; if (x <= 0) { ev = e; break; } }
      if (!ev) ev = D.EVENTS[D.EVENTS.length - 1];
      used[ev.id] = 1;
      if (ev.quiet && s.news.length) continue;
      const acc = ev.acc != null ? ev.acc : 0.75;
      s.news.push({ id: ev.id, t: ev.t, d: ev.d, fx: ev.fx, quiet: !!ev.quiet, truth: ev.quiet ? true : rnd(s) < acc, known: false });
      if (ev.quiet) break;
    }
    s.sent = rnd(s) < 0.7 ? s.reg : Math.floor(rnd(s) * 3);
    if (!s.news.length) s.news.push({ id: 'quiet1', t: D.EVENTS[D.EVENTS.length - 2].t, d: D.EVENTS[D.EVENTS.length - 2].d, fx: {}, quiet: true, truth: true, known: false });
  }
  function shocksFromNews(s) {
    const sh = zeroShocks();
    for (const n of s.news) {
      const k = n.truth ? 1 : -0.4;
      for (const key in n.fx) sh[key] = (sh[key] || 0) + n.fx[key] * k;
    }
    return sh;
  }
  function buyIntel(s) {
    if (s.intel) return { ok: false, msg: T('本月已經買過情報了。') };
    if (s.cash < R.intelCost) return { ok: false, msg: T('現金不足，無法購買情報。') };
    s.cash -= R.intelCost; s.intel = true;
    for (const n of s.news) n.known = true;
    return { ok: true, msg: T('已取得內線情報，本月消息真偽已揭曉。') };
  }

  /* ---------- 價格更新 ---------- */
  function stepRate(s, sh) {
    const old = s.rate;
    let d = sh.rate;
    if (rnd(s) < 0.12) d += (rnd(s) < 0.5 ? 1 : -1) * 0.0025;
    d += (0.02 - old) * 0.01;
    s.rate = clamp(old + d, 0.0025, 0.07);
    s.rateHist.push(s.rate);
    return s.rate - old;
  }

  function stepPrices(s, sh) {
    const info = {};
    const dRate = stepRate(s, sh);
    s.reg = chainNext(s, s.reg, D.MARKET.chain);
    s.btcReg = chainNext(s, s.btcReg, D.BTC_REG.chain);
    s.reReg = chainNext(s, s.reReg, D.RE_REG.chain);

    const mret = D.MARKET.drift[s.reg] + randn(s) * 0.035 + sh.market;
    info.mret = mret;
    s.index = +(s.index * (1 + clamp(mret, -0.5, 0.8))).toFixed(2); s.indexHist.push(s.index);
    const sec = {};
    for (const k of SECS) sec[k] = randn(s) * 0.02 + sh[k];
    info.sec = sec;

    // 股票
    const sr = {};
    for (const st of s.cfg.stocks) {
      let r = st.beta * mret + (st.sector === 'etf' ? 0 : (sec[st.sector] || 0)) + randn(s) * st.vol;
      if (st.sector === 'biotech' && rnd(s) < 0.04) r += (rnd(s) < 0.5 ? 1 : -1) * 0.2;
      r = clamp(r, -0.5, 0.8);
      sr[st.id] = r;
      const o = s.stocks[st.id];
      o.last = r;
      o.price = Math.max(0.5, +(o.price * (1 + r)).toFixed(2));
      o.hist.push(o.price);
    }
    info.stockRets = sr;

    // 比特幣
    {
      const common = D.BTC_REG.drift[s.btcReg] + randn(s) * 0.13 + 0.25 * mret + sh.btc;
      info.btcRet = clamp(common, -0.6, 1.2);
      for (const c of s.cfg.cryptos) {
        const o = s.crypto[c.id];
        let r = c.beta * common + randn(s) * c.vol - (c.beta - 1) * 0.012 - c.vol * c.vol / 2;
        r = clamp(r, -0.7, 1.5);
        o.last = r;
        o.price = sig(Math.max(o.price * (1 + r), 1e-9));
        o.hist.push(o.price);
      }
    }

    // 房地產
    {
      const common = D.RE_REG.drift[s.reReg] + sh.re - (s.rate - 0.02) * 0.04;
      for (const p of D.PROPERTIES) {
        const o = s.re[p.id];
        let r = p.mult * common + 0.08 * p.mult * Math.min(0, mret) + randn(s) * p.vol;
        r = clamp(r, -0.15, 0.15);
        o.last = r;
        o.price = Math.round(o.price * (1 + r));
        o.rent = Math.round(p.rent * Math.pow(o.price / p.price, 0.6) / 100) * 100;
        o.hist.push(o.price);
      }
    }

    // 基金
    {
      const fr = {};
      fr.money = s.rate * 0.9 / 12 + randn(s) * 0.0002;
      fr.bond = s.rate / 12 - 4 * dRate + randn(s) * 0.004 - 0.004 / 12 + (mret < -0.05 ? 0.01 : 0);
      let idx = 0, wsum = 0;
      for (const st of s.cfg.stocks) { idx += st.w * sr[st.id]; wsum += st.w; }
      idx = wsum > 0 ? idx / wsum : mret;
      fr.index = idx + 0.03 / 12 - 0.0005 / 12;
      fr.growth = 1.1 * mret + 0.6 * sec.tech + randn(s) * 0.02 - 0.015 / 12;
      fr.divi = 0.6 * mret + 0.3 * sec.consumer + randn(s) * 0.012 + 0.05 / 12 - 0.004 / 12;
      for (const f of D.FUNDS) {
        const o = s.funds[f.id];
        const r = clamp(fr[f.id], -0.5, 0.6);
        o.last = r;
        o.nav = Math.max(1, +(o.nav * (1 + r)).toFixed(4));
        o.hist.push(o.nav);
      }
    }
    return info;
  }

  /* ---------- 強制賣出 ---------- */
  // 依比例賣掉 fraction（0~1）的所有流動資產，回傳淨入帳現金
  function sellFraction(s, f, fee) {
    f = clamp(f, 0, 1);
    let net = 0;
    for (const id in s.stocks) {
      const o = s.stocks[id]; if (o.shares <= 0) continue;
      const q = Math.min(o.shares, Math.ceil(o.shares * f - 1e-9));
      if (q <= 0) continue;
      const got = q * o.price * (1 - fee);
      s.stats.realized += got - o.cost * (q / o.shares);
      o.cost -= o.cost * (q / o.shares); o.shares -= q; net += got;
    }
    for (const id in s.crypto) {
      const o = s.crypto[id]; if (o.units <= 0) continue;
      const q = o.units * f, got = q * o.price * (1 - fee);
      s.stats.realized += got - o.cost * f; o.cost -= o.cost * f; o.units -= q; net += got;
    }
    for (const id in s.funds) {
      const o = s.funds[id]; if (o.units <= 0) continue;
      const q = o.units * f, got = q * o.nav * (1 - fee);
      s.stats.realized += got - o.cost * f; o.cost -= o.cost * f; o.units -= q; net += got;
    }
    s.cash += net;
    return net;
  }
  function liquidate(s, need) {
    const fee = 0.005;
    const liq = liquidValue(s);
    if (liq <= 0 || need <= 0) return 0;
    const gross = Math.min(liq, need / (1 - fee));
    return sellFraction(s, gross / liq, fee);
  }

  function marginCheck(s, rep) {
    if (s.marginDebt <= 0) return;
    const liq = liquidValue(s);
    const ratio = liq > 0 ? s.marginDebt / liq : 99;
    if (ratio <= R.marginCallRatio) return;
    const fee = 0.01;
    let G = (s.marginDebt - R.marginTargetRatio * liq) / ((1 - fee) - R.marginTargetRatio);
    G = clamp(G, 0, liq);
    if (liq > 0) sellFraction(s, G / liq, fee);
    const pay = Math.min(s.marginDebt, Math.max(0, s.cash));
    s.cash -= pay; s.marginDebt -= pay;
    rep.mc = true; s.stats.mcCount++;
    L(rep, 'bad', '⚠️ 追繳保證金！融資維持率不足，券商強制賣出部分持股並償還借款。');
  }

  function settleCash(s, rep) {
    if (s.cash >= 0) return;
    const got = liquidate(s, -s.cash);
    if (got > 0) L(rep, 'bad', '現金不足，已自動賣出部分資產補足。');
    if (s.cash < 0) { s.marginDebt += -s.cash; s.cash = 0; L(rep, 'bad', '現金不足且無資產可賣，差額轉為借款。'); }
  }

  /* ---------- 推進一個月 ---------- */
  function advance(s) {
    const rep = { lines: [], mc: false, win: false, finished: false, bankrupt: false, ach: [], mret: 0, month: s.month + 1 };
    if (s.finished) return rep;
    const sh = shocksFromNews(s);
    const nwBefore = netWorth(s);
    const cashShare = nwBefore > 0 ? s.cash / nwBefore : 0;
    const info = stepPrices(s, sh);
    rep.mret = info.mret;
    s.month++;
    const m = s.month;

    // 新聞結果
    for (const n of s.news) {
      if (n.quiet) continue;
      L(rep, n.truth ? 'info' : 'warn', n.truth ? '📰 消息成真：{0:e}' : '📰 消息落空：{0:e}', [n.id]);
    }

    // 停損／停利條件單
    runOrders(s, rep);

    // 股利（每季）
    if (m % 3 === 0) {
      let div = 0;
      for (const st of s.cfg.stocks) { const o = s.stocks[st.id]; if (o.shares > 0 && st.div > 0) div += o.shares * o.price * st.div / 4; }
      if (div > 0) { s.cash += div; L(rep, 'good', '💰 領到股利 {0:m}', [div]); }
    }

    // 租金與持有成本、房貸利息
    let rent = 0, hold = 0;
    for (const p of D.PROPERTIES) {
      const o = s.re[p.id];
      for (let i = 0; i < o.count; i++) if (rnd(s) > 0.03) rent += o.rent;
      hold += o.count * o.price * R.reHoldCost;
    }
    const mortInt = mortgageTotal(s) * (s.rate + R.mortgageSpread) / 12;
    const marInt = s.marginDebt * (s.rate + R.marginSpread) / 12;
    const cashInt = Math.max(0, s.cash) * s.rate * R.cashRateFactor / 12;
    s.cash += rent - hold - mortInt - marInt + cashInt;
    if (rent > 0) L(rep, 'good', '🏠 收租 {0:m}（扣除持有成本與房貸利息後淨 {1:m}）', [rent, rent - hold - mortInt]);

    // 薪資、加薪、獎金、個人突發事件
    if (m % 12 === 1 && m > 1) { s.save = Math.round(s.save * 1.03 / 100) * 100; L(rep, 'info', '📈 新的一年，月儲蓄提高為 {0:m}', [s.save]); }
    s.cash += s.save;
    if (m % 12 === 0) { const b = s.save * 1.5; s.cash += b; L(rep, 'good', '🎁 年終獎金 {0:m}', [b]); }
    const pr = rnd(s);
    if (pr < 0.07) {
      const e = D.PERSONAL_BAD[Math.floor(rnd(s) * D.PERSONAL_BAD.length)];
      const amt = Math.round(e.m * s.save / 100) * 100; s.cash -= amt;
      L(rep, 'bad', '💸 突發支出：{0:t} -{1:m}', [e.t, amt]);
    } else if (pr < 0.1) {
      const e = D.PERSONAL_GOOD[Math.floor(rnd(s) * D.PERSONAL_GOOD.length)];
      const amt = Math.round(e.m * s.save / 100) * 100; s.cash += amt;
      L(rep, 'good', '🍀 意外之財：{0:t} +{1:m}', [e.t, amt]);
    }

    runPlans(s, rep);
    settleCash(s, rep);
    marginCheck(s, rep);

    const nw = netWorth(s);
    s.netHist.push(nw);
    s.stats.maxNW = Math.max(s.stats.maxNW, nw);
    if (info.mret < -0.08 && cashShare >= 0.7) s.flags.dodge = true;
    if (rep.mc) s.flags.survivedMC = true;

    if (nw <= 0) { s.finished = true; s.bankrupt = true; rep.finished = true; rep.bankrupt = true; }
    else {
      if (!s.won && nw >= s.target) { s.won = true; rep.win = true; }
      if (m >= s.months) { s.finished = true; rep.finished = true; s.flags.finish = true; }
    }
    rep.ach = checkAch(s);
    if (!s.finished) genNews(s);
    s.log.unshift({ m, lines: rep.lines.slice(0, 10) });
    if (s.log.length > 24) s.log.length = 24;
    return rep;
  }

  /* ---------- 交易 ---------- */
  function fmtMoney(n) { return root.I18N.money(n); }

  /*
    trade(s, kind, side, id, x, opts, dry)
    kind: stock | btc | fund | re
    股票/房地產：x=數量；比特幣/基金：買=金額，賣=比例(0~100)
    opts.mortgage：買房是否使用房貸
  */
  function trade(s, kind, side, id, x, opts, dry) {
    opts = opts || {};
    x = Number(x);
    if (!isFinite(x) || x <= 0) return { ok: false, msg: T('請輸入大於 0 的數字。') };
    if (s.finished) return { ok: false, msg: T('遊戲已結束。') };
    const fail = m => ({ ok: false, msg: m });
    let res;

    if (kind === 'stock') {
      const o = s.stocks[id]; if (!o) return fail(T('找不到這檔股票。'));
      x = Math.floor(x);
      if (x < 1) return fail(T('至少要 1 股。'));
      if (side === 'buy') {
        const gross = x * o.price, fee = gross * R.stockBuyFee, cost = gross + fee;
        if (cost > s.cash + 1e-6) return fail(T('現金不足，需要 {0:m}。', [cost]));
        res = { ok: true, qty: x, fee, total: cost, msg: T('買進 {0} 股，共花費 {1:m}', [x, cost]) };
        if (!dry) { s.cash -= cost; o.shares += x; o.cost += cost; }
      } else {
        if (x > o.shares) return fail(T('持股不足。'));
        const gross = x * o.price, fee = gross * R.stockSellFee, got = gross - fee;
        const basis = o.cost * (x / o.shares);
        res = { ok: true, qty: x, fee, total: got, pnl: got - basis, msg: T('賣出 {0} 股，入帳 {1:m}', [x, got]) };
        if (!dry) {
          s.cash += got; s.stats.realized += got - basis;
          if (got < basis * 0.8) s.flags.cutLoss = true;
          o.cost -= basis; o.shares -= x; if (o.shares === 0) o.cost = 0;
        }
      }
    } else if (kind === 'crypto') {
      const o = s.crypto[id]; if (!o) return fail(T('找不到這個幣種。'));
      if (side === 'buy') {
        if (x > s.cash + 1e-6) return fail(T('現金不足。'));
        const fee = x * R.btcFee, units = (x - fee) / o.price;
        res = { ok: true, qty: units, fee, total: x, msg: T('投入 {0:m}，買到 {1} 枚', [x, fmtUnits(units)]) };
        if (!dry) { s.cash -= x; o.units += units; o.cost += x; }
      } else {
        const pct = clamp(x, 0, 100) / 100;
        if (o.units <= 0) return fail(T('沒有持有這個幣種。'));
        const units = o.units * pct, gross = units * o.price, fee = gross * R.btcFee, got = gross - fee;
        const basis = o.cost * pct;
        res = { ok: true, qty: units, fee, total: got, pnl: got - basis, msg: T('賣出 {0} 枚，入帳 {1:m}', [fmtUnits(units), got]) };
        if (!dry) {
          s.cash += got; s.stats.realized += got - basis;
          o.cost -= basis; o.units -= units; if (pct >= 0.9999) { o.units = 0; o.cost = 0; }
        }
      }
    } else if (kind === 'fund') {
      const o = s.funds[id]; if (!o) return fail(T('找不到這檔基金。'));
      const def = D.FUNDS.find(f => f.id === id);
      if (side === 'buy') {
        if (x > s.cash + 1e-6) return fail(T('現金不足。'));
        const fee = x * def.buyFee, units = (x - fee) / o.nav;
        res = { ok: true, qty: units, fee, total: x, msg: T('申購 {0:m}，取得 {1} 單位', [x, units.toFixed(2)]) };
        if (!dry) { s.cash -= x; o.units += units; o.cost += x; }
      } else {
        const pct = clamp(x, 0, 100) / 100;
        if (o.units <= 0) return fail(T('沒有持有這檔基金。'));
        const units = o.units * pct, got = units * o.nav, basis = o.cost * pct;
        res = { ok: true, qty: units, fee: 0, total: got, pnl: got - basis, msg: T('贖回 {0} 單位，入帳 {1:m}', [units.toFixed(2), got]) };
        if (!dry) {
          s.cash += got; s.stats.realized += got - basis;
          o.cost -= basis; o.units -= units; if (pct >= 0.9999) { o.units = 0; o.cost = 0; }
        }
      }
    } else if (kind === 're') {
      const o = s.re[id]; if (!o) return fail(T('找不到這項房產。'));
      x = Math.floor(x);
      if (x < 1) return fail(T('至少要 1 間。'));
      if (side === 'buy') {
        const total = o.price * x, fees = total * R.reBuyCost;
        const loan = opts.mortgage ? total * R.reLtv : 0;
        const need = total - loan + fees;
        if (need > s.cash + 1e-6) return fail(T('現金不足，需要 {0:m}（含 3% 稅費）。', [need]));
        res = { ok: true, qty: x, fee: fees, total: need, loan, msg: T('買進 {0} 間，現金支出 {1:m}', [x, need]) + (loan ? T('，房貸 {0:m}', [loan]) : '') };
        if (!dry) { s.cash -= need; o.count += x; o.cost += total + fees; o.mortgage += loan; }
      } else {
        if (x > o.count) return fail(T('持有數量不足。'));
        const gross = o.price * x, fee = gross * R.reSellCost;
        const share = o.mortgage * (x / o.count);
        const got = gross - fee - share;
        if (s.cash + got < -1e-6) return fail(T('賣出後仍不足以清償房貸，無法成交。'));
        const basis = o.cost * (x / o.count);
        res = { ok: true, qty: x, fee, total: got, pnl: gross - fee - basis, msg: T('賣出 {0} 間，扣除房貸與 4% 費用後入帳 {1:m}', [x, got]) };
        if (!dry) {
          s.cash += got; s.stats.realized += gross - fee - basis;
          o.mortgage -= share; o.cost -= basis; o.count -= x;
          if (o.count === 0) { o.mortgage = 0; o.cost = 0; }
        }
      }
    } else return fail(T('未知的交易類型。'));

    if (!dry) {
      s.stats.trades++;
      s.trades.unshift({ m: s.month, kind: kind, side: side, id: id, qty: res.qty, total: res.total, pnl: res.pnl == null ? null : res.pnl, auto: opts.auto || '' });
      if (s.trades.length > 60) s.trades.length = 60;
      res.ach = checkAch(s);
    }
    return res;
  }

  function fmtUnits(u) { return u >= 1000 ? Math.round(u).toLocaleString('en-US') : u >= 1 ? u.toFixed(3) : u.toFixed(5); }

  /* ---------- 資產定義、定期定額、條件單 ---------- */
  function assetDef(s, kind, id) {
    if (kind === 'stock') return s.cfg.stocks.find(x => x.id === id);
    if (kind === 'crypto') return s.cfg.cryptos.find(x => x.id === id);
    if (kind === 'fund') return D.FUNDS.find(x => x.id === id);
    return D.PROPERTIES.find(x => x.id === id);
  }
  function nameRef(s, kind, id) { const d = assetDef(s, kind, id) || {}; return [d.name || id, d.en || '']; }
  function holding(s, kind, id) {
    if (kind === 'stock') { const o = s.stocks[id]; return o ? { qty: o.shares, cost: o.cost, price: o.price } : null; }
    if (kind === 'crypto') { const o = s.crypto[id]; return o ? { qty: o.units, cost: o.cost, price: o.price } : null; }
    if (kind === 'fund') { const o = s.funds[id]; return o ? { qty: o.units, cost: o.cost, price: o.nav } : null; }
    return null;
  }
  // 定期定額：amt=每月金額，0＝取消
  function setPlan(s, kind, id, amt) {
    amt = Math.floor(Number(amt) || 0);
    if (!holding(s, kind, id)) return { ok: false, msg: T('這項資產不能設定定期定額。') };
    s.plans = s.plans.filter(p => !(p.kind === kind && p.id === id));
    if (amt <= 0) return { ok: true, msg: T('已取消定期定額。') };
    if (amt < 1000) return { ok: false, msg: T('每月金額至少 1,000 元。') };
    if (s.plans.length >= 8) return { ok: false, msg: T('最多同時設定 8 筆定期定額。') };
    s.plans.push({ kind: kind, id: id, amt: amt });
    return { ok: true, msg: T('已設定每月定期定額 {0:m}', [amt]) };
  }
  function getPlan(s, kind, id) { return s.plans.find(p => p.kind === kind && p.id === id) || null; }
  function runPlans(s, rep) {
    if (!s.plans.length || s.finished) return;
    let done = 0;
    for (const p of s.plans) {
      const h = holding(s, p.kind, p.id); if (!h) continue;
      if (s.cash < p.amt) { L(rep, 'warn', '🔁 定期定額 {0:n}：現金不足，本月跳過', [nameRef(s, p.kind, p.id)]); continue; }
      let x = p.amt;
      if (p.kind === 'stock') { x = Math.floor(p.amt / (h.price * (1 + R.stockBuyFee))); if (x < 1) { L(rep, 'warn', '🔁 定期定額 {0:n}：金額不足買 1 股，本月跳過', [nameRef(s, p.kind, p.id)]); continue; } }
      const r = trade(s, p.kind, 'buy', p.id, x, { auto: 'dca' });
      if (r.ok) { done++; L(rep, 'info', '🔁 定期定額買進 {0:n} {1:m}', [nameRef(s, p.kind, p.id), r.total]); }
    }
    if (done) s.flags.dcaCount = (s.flags.dcaCount || 0) + 1;
  }
  // 條件單：sl=停損%（跌破平均成本多少），tp=停利%；0＝不設
  function setOrder(s, kind, id, sl, tp) {
    sl = Math.max(0, Number(sl) || 0); tp = Math.max(0, Number(tp) || 0);
    if (!holding(s, kind, id)) return { ok: false, msg: T('這項資產不能設定條件單。') };
    const key = kind + ':' + id;
    if (!sl && !tp) { delete s.orders[key]; return { ok: true, msg: T('已取消條件單。') }; }
    if (sl >= 95) return { ok: false, msg: T('停損幅度需小於 95%。') };
    s.orders[key] = { sl: sl / 100, tp: tp / 100 };
    return { ok: true, msg: T('已設定條件單。') };
  }
  function getOrder(s, kind, id) { return s.orders[kind + ':' + id] || null; }
  function runOrders(s, rep) {
    for (const key of Object.keys(s.orders)) {
      const kind = key.split(':')[0], id = key.slice(kind.length + 1), od = s.orders[key];
      const h = holding(s, kind, id);
      if (!h || h.qty <= 0 || h.cost <= 0) continue;
      const ret = h.price * h.qty / h.cost - 1;
      const hitSL = od.sl > 0 && ret <= -od.sl, hitTP = od.tp > 0 && ret >= od.tp;
      if (!hitSL && !hitTP) continue;
      const r = trade(s, kind, 'sell', id, kind === 'stock' ? h.qty : 100, { auto: hitSL ? 'sl' : 'tp' });
      if (r.ok) {
        delete s.orders[key]; s.flags.orderHit = true;
        L(rep, hitSL ? 'bad' : 'good', hitSL ? '🛑 停損觸發：賣出 {0:n}，入帳 {1:m}' : '🎯 停利觸發：賣出 {0:n}，入帳 {1:m}', [nameRef(s, kind, id), r.total]);
      }
    }
  }

  /* ---------- 借貸 ---------- */
  function maxBorrow(s) { return Math.max(0, R.marginMaxRatio * liquidValue(s) - s.marginDebt); }
  function borrow(s, amt) {
    amt = Math.floor(Number(amt));
    if (!(amt > 0)) return { ok: false, msg: T('請輸入借款金額。') };
    const mb = maxBorrow(s);
    if (amt > mb + 1) return { ok: false, msg: T('超過可借額度，目前最多可借 {0:m}（以股票、加密貨幣、基金為擔保，上限 50%）。', [mb]) };
    s.marginDebt += amt; s.cash += amt; s.flags.borrowed = true;
    return { ok: true, msg: T('已借款 {0:m}', [amt]), ach: checkAch(s) };
  }
  function repay(s, amt) {
    amt = Math.floor(Number(amt));
    if (!(amt > 0)) return { ok: false, msg: T('請輸入還款金額。') };
    amt = Math.min(amt, s.marginDebt);
    if (amt > s.cash) return { ok: false, msg: T('現金不足。') };
    s.cash -= amt; s.marginDebt -= amt;
    return { ok: true, msg: T('已還款 {0:m}', [amt]) };
  }

  /* ---------- 成就 ---------- */
  function checkAch(s) {
    const nw = netWorth(s), out = [];
    const tests = {
      first: () => nw >= s.startCash * 1.2,
      diversify: () => holdsStocks(s) && cryptoCount(s) > 0 && propertyCount(s) > 0 && holdsFunds(s),
      landlord: () => propertyCount(s) >= 3,
      btcfaith: () => cryptoValue(s) >= 5000000,
      leverage: () => !!s.flags.borrowed,
      cutloss: () => !!s.flags.cutLoss,
      dodge: () => !!s.flags.dodge,
      survivor: () => !!s.flags.survivedMC && nw > 0,
      rich: () => nw >= 10000000,
      goal: () => s.won,
      finish: () => !!s.flags.finish && !s.bankrupt,
      tenx: () => nw >= s.startCash * 10,
      dca: () => (s.flags.dcaCount || 0) >= 12,
      order: () => !!s.flags.orderHit,
      altcoin: () => cryptoCount(s) >= 3
    };
    for (const a of D.ACHIEVEMENTS) {
      if (!s.ach[a.id] && tests[a.id] && tests[a.id]()) { s.ach[a.id] = s.month; out.push(a); }
    }
    return out;
  }

  function rankOf(s) {
    const nw = netWorth(s);
    if (s.bankrupt || nw <= 0) return { name: T('破產'), text: T('帳戶歸零，但別氣餒，市場永遠有下一次機會。') };
    const ratio = nw / s.target;
    let r = D.RANKS[0];
    for (const x of D.RANKS) if (ratio >= x.min) r = x;
    return r;
  }

  const api = {
    newGame, advance, trade, borrow, repay, maxBorrow, buyIntel, checkAch, rankOf,
    defaultCfg, assetDef, setPlan, getPlan, setOrder, getOrder, fmtUnits, cryptoCount,
    netWorth, liquidValue, stockValue, cryptoValue, fundValue, reValue, mortgageTotal, propertyCount, monthlyRent, fmtMoney,
    WARMUP
  };
  root.GameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
