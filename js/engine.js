/* 我愛操盤手 - 遊戲引擎（純邏輯，無 DOM）*/
(function (root) {
  'use strict';
  const D = root.GAME_DATA;
  const R = D.RULES;
  const SECS = ['tech', 'finance', 'shipping', 'biotech', 'consumer', 'energy'];
  const WARMUP = 12;

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
  function btcValue(s) { return s.btc.units * s.btc.price; }
  function fundValue(s) { let v = 0; for (const k in s.funds) v += s.funds[k].units * s.funds[k].nav; return v; }
  function reValue(s) { let v = 0; for (const k in s.re) v += s.re[k].count * s.re[k].price; return v; }
  function mortgageTotal(s) { let v = 0; for (const k in s.re) v += s.re[k].mortgage; return v; }
  function liquidValue(s) { return stockValue(s) + btcValue(s) + fundValue(s); }
  function netWorth(s) { return s.cash + liquidValue(s) + reValue(s) - s.marginDebt - mortgageTotal(s); }
  function propertyCount(s) { let n = 0; for (const k in s.re) n += s.re[k].count; return n; }
  function monthlyRent(s) { let v = 0; for (const k in s.re) v += s.re[k].count * s.re[k].rent; return v; }
  function holdsStocks(s) { for (const k in s.stocks) if (s.stocks[k].shares > 0) return true; return false; }
  function holdsFunds(s) { for (const k in s.funds) if (s.funds[k].units > 0) return true; return false; }

  /* ---------- 建立新遊戲 ---------- */
  function newGame(modeId, seed) {
    const mode = D.MODES.find(m => m.id === modeId) || D.MODES[1];
    const s = {
      v: 1, mode: mode.id, month: 0, months: R.months,
      rng: ((seed != null ? seed : Math.floor(Math.random() * 4294967296)) >>> 0),
      cash: mode.cash, startCash: mode.cash, save: mode.save, target: mode.target,
      marginDebt: 0, rate: 0.02, reg: 1, btcReg: 1, reReg: 1,
      stocks: {}, btc: {}, re: {}, funds: {},
      rateHist: [], netHist: [], news: [], log: [], flags: {}, ach: {},
      stats: { realized: 0, mcCount: 0, trades: 0, maxNW: mode.cash },
      won: false, finished: false, bankrupt: false, intel: false, warm: WARMUP
    };
    for (const st of D.STOCKS) s.stocks[st.id] = { price: st.price, hist: [st.price], shares: 0, cost: 0, last: 0 };
    s.btc = { price: D.BTC.price, hist: [D.BTC.price], units: 0, cost: 0, last: 0 };
    for (const p of D.PROPERTIES) s.re[p.id] = { price: p.price, hist: [p.price], count: 0, cost: 0, mortgage: 0, rent: p.rent, last: 0 };
    for (const f of D.FUNDS) s.funds[f.id] = { nav: f.nav, hist: [f.nav], units: 0, cost: 0, last: 0 };
    s.reg = chainNext(s, 1, D.MARKET.chain);
    s.btcReg = chainNext(s, 1, D.BTC_REG.chain);
    s.rateHist.push(s.rate);
    // 先模擬 12 個月，讓圖表一開始就有歷史
    const zero = zeroShocks();
    for (let i = 0; i < WARMUP; i++) stepPrices(s, zero);
    s.netHist.push(netWorth(s));
    genNews(s);
    return s;
  }

  function zeroShocks() { return { market: 0, tech: 0, finance: 0, shipping: 0, biotech: 0, consumer: 0, energy: 0, btc: 0, re: 0, rate: 0 }; }

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
      for (const key in n.fx) sh[key] += n.fx[key] * k;
    }
    return sh;
  }
  function buyIntel(s) {
    if (s.intel) return { ok: false, msg: '本月已經買過情報了。' };
    if (s.cash < R.intelCost) return { ok: false, msg: '現金不足，無法購買情報。' };
    s.cash -= R.intelCost; s.intel = true;
    for (const n of s.news) n.known = true;
    return { ok: true, msg: '已取得內線情報，本月消息真偽已揭曉。' };
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
    const sec = {};
    for (const k of SECS) sec[k] = randn(s) * 0.02 + sh[k];
    info.sec = sec;

    // 股票
    const sr = {};
    for (const st of D.STOCKS) {
      let r = st.beta * mret + sec[st.sector] + randn(s) * st.vol;
      if (st.sector === 'biotech' && rnd(s) < 0.04) r += (rnd(s) < 0.5 ? 1 : -1) * 0.2;
      r = clamp(r, -0.5, 0.8);
      sr[st.id] = r;
      const o = s.stocks[st.id];
      o.last = r;
      o.price = Math.max(3, +(o.price * (1 + r)).toFixed(2));
      o.hist.push(o.price);
    }
    info.stockRets = sr;

    // 比特幣
    {
      let r = D.BTC_REG.drift[s.btcReg] + randn(s) * 0.13 + 0.25 * mret + sh.btc;
      r = clamp(r, -0.6, 1.2);
      s.btc.last = r;
      s.btc.price = Math.max(1000, Math.round(s.btc.price * (1 + r)));
      s.btc.hist.push(s.btc.price);
      info.btcRet = r;
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
      let idx = 0;
      for (const st of D.STOCKS) idx += st.w * sr[st.id];
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
    if (s.btc.units > 0) {
      const q = s.btc.units * f, got = q * s.btc.price * (1 - fee);
      s.stats.realized += got - s.btc.cost * f; s.btc.cost -= s.btc.cost * f; s.btc.units -= q; net += got;
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
    rep.lines.push({ k: 'bad', m: '⚠️ 追繳保證金！融資維持率不足，券商強制賣出部分持股並償還借款。' });
  }

  function settleCash(s, rep) {
    if (s.cash >= 0) return;
    const got = liquidate(s, -s.cash);
    if (got > 0) rep.lines.push({ k: 'bad', m: '現金不足，已自動賣出部分資產補足。' });
    if (s.cash < 0) { s.marginDebt += -s.cash; s.cash = 0; rep.lines.push({ k: 'bad', m: '現金不足且無資產可賣，差額轉為借款。' }); }
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
      rep.lines.push({ k: n.truth ? 'info' : 'warn', m: (n.truth ? '📰 消息成真：' : '📰 消息落空：') + n.t });
    }

    // 股利（每季）
    if (m % 3 === 0) {
      let div = 0;
      for (const st of D.STOCKS) { const o = s.stocks[st.id]; if (o.shares > 0 && st.div > 0) div += o.shares * o.price * st.div / 4; }
      if (div > 0) { s.cash += div; rep.lines.push({ k: 'good', m: '💰 領到股利 ' + fmtMoney(div) }); }
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
    if (rent > 0) rep.lines.push({ k: 'good', m: '🏠 收租 ' + fmtMoney(rent) + '（扣除持有成本與房貸利息後淨 ' + fmtMoney(rent - hold - mortInt) + '）' });

    // 薪資、加薪、獎金、個人突發事件
    if (m % 12 === 1 && m > 1) { s.save = Math.round(s.save * 1.03 / 100) * 100; rep.lines.push({ k: 'info', m: '📈 新的一年，月儲蓄提高為 ' + fmtMoney(s.save) }); }
    s.cash += s.save;
    if (m % 12 === 0) { const b = s.save * 1.5; s.cash += b; rep.lines.push({ k: 'good', m: '🎁 年終獎金 ' + fmtMoney(b) }); }
    const pr = rnd(s);
    if (pr < 0.07) {
      const e = D.PERSONAL_BAD[Math.floor(rnd(s) * D.PERSONAL_BAD.length)];
      const amt = Math.round(e.m * s.save / 100) * 100; s.cash -= amt;
      rep.lines.push({ k: 'bad', m: '💸 突發支出：' + e.t + ' -' + fmtMoney(amt) });
    } else if (pr < 0.1) {
      const e = D.PERSONAL_GOOD[Math.floor(rnd(s) * D.PERSONAL_GOOD.length)];
      const amt = Math.round(e.m * s.save / 100) * 100; s.cash += amt;
      rep.lines.push({ k: 'good', m: '🍀 意外之財：' + e.t + ' +' + fmtMoney(amt) });
    }

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
    s.log.unshift({ m, lines: rep.lines.slice(0, 8) });
    if (s.log.length > 24) s.log.length = 24;
    return rep;
  }

  /* ---------- 交易 ---------- */
  function fmtMoney(n) {
    const a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (a >= 1e8) return sg + (a / 1e8).toFixed(2) + ' 億';
    if (a >= 1e4) return sg + (a / 1e4).toFixed(1) + ' 萬';
    return sg + Math.round(a).toLocaleString('en-US');
  }

  /*
    trade(s, kind, side, id, x, opts, dry)
    kind: stock | btc | fund | re
    股票/房地產：x=數量；比特幣/基金：買=金額，賣=比例(0~100)
    opts.mortgage：買房是否使用房貸
  */
  function trade(s, kind, side, id, x, opts, dry) {
    opts = opts || {};
    x = Number(x);
    if (!isFinite(x) || x <= 0) return { ok: false, msg: '請輸入大於 0 的數字。' };
    if (s.finished) return { ok: false, msg: '遊戲已結束。' };
    const fail = m => ({ ok: false, msg: m });
    let res;

    if (kind === 'stock') {
      const o = s.stocks[id]; if (!o) return fail('找不到這檔股票。');
      x = Math.floor(x);
      if (x < 1) return fail('至少要 1 股。');
      if (side === 'buy') {
        const gross = x * o.price, fee = gross * R.stockBuyFee, cost = gross + fee;
        if (cost > s.cash + 1e-6) return fail('現金不足，需要 ' + fmtMoney(cost) + '。');
        res = { ok: true, qty: x, fee, total: cost, msg: '買進 ' + x + ' 股，共花費 ' + fmtMoney(cost) };
        if (!dry) { s.cash -= cost; o.shares += x; o.cost += cost; }
      } else {
        if (x > o.shares) return fail('持股不足。');
        const gross = x * o.price, fee = gross * R.stockSellFee, got = gross - fee;
        const basis = o.cost * (x / o.shares);
        res = { ok: true, qty: x, fee, total: got, pnl: got - basis, msg: '賣出 ' + x + ' 股，入帳 ' + fmtMoney(got) };
        if (!dry) {
          s.cash += got; s.stats.realized += got - basis;
          if (got < basis * 0.8) s.flags.cutLoss = true;
          o.cost -= basis; o.shares -= x; if (o.shares === 0) o.cost = 0;
        }
      }
    } else if (kind === 'btc') {
      const o = s.btc;
      if (side === 'buy') {
        if (x > s.cash + 1e-6) return fail('現金不足。');
        const fee = x * R.btcFee, units = (x - fee) / o.price;
        res = { ok: true, qty: units, fee, total: x, msg: '投入 ' + fmtMoney(x) + '，買到 ' + units.toFixed(4) + ' 枚' };
        if (!dry) { s.cash -= x; o.units += units; o.cost += x; }
      } else {
        const pct = clamp(x, 0, 100) / 100;
        if (o.units <= 0) return fail('沒有持有比特幣。');
        const units = o.units * pct, gross = units * o.price, fee = gross * R.btcFee, got = gross - fee;
        const basis = o.cost * pct;
        res = { ok: true, qty: units, fee, total: got, pnl: got - basis, msg: '賣出 ' + units.toFixed(4) + ' 枚，入帳 ' + fmtMoney(got) };
        if (!dry) {
          s.cash += got; s.stats.realized += got - basis;
          o.cost -= basis; o.units -= units; if (pct >= 0.9999) { o.units = 0; o.cost = 0; }
        }
      }
    } else if (kind === 'fund') {
      const o = s.funds[id]; if (!o) return fail('找不到這檔基金。');
      const def = D.FUNDS.find(f => f.id === id);
      if (side === 'buy') {
        if (x > s.cash + 1e-6) return fail('現金不足。');
        const fee = x * def.buyFee, units = (x - fee) / o.nav;
        res = { ok: true, qty: units, fee, total: x, msg: '申購 ' + fmtMoney(x) + '，取得 ' + units.toFixed(2) + ' 單位' };
        if (!dry) { s.cash -= x; o.units += units; o.cost += x; }
      } else {
        const pct = clamp(x, 0, 100) / 100;
        if (o.units <= 0) return fail('沒有持有這檔基金。');
        const units = o.units * pct, got = units * o.nav, basis = o.cost * pct;
        res = { ok: true, qty: units, fee: 0, total: got, pnl: got - basis, msg: '贖回 ' + units.toFixed(2) + ' 單位，入帳 ' + fmtMoney(got) };
        if (!dry) {
          s.cash += got; s.stats.realized += got - basis;
          o.cost -= basis; o.units -= units; if (pct >= 0.9999) { o.units = 0; o.cost = 0; }
        }
      }
    } else if (kind === 're') {
      const o = s.re[id]; if (!o) return fail('找不到這項房產。');
      x = Math.floor(x);
      if (x < 1) return fail('至少要 1 間。');
      if (side === 'buy') {
        const total = o.price * x, fees = total * R.reBuyCost;
        const loan = opts.mortgage ? total * R.reLtv : 0;
        const need = total - loan + fees;
        if (need > s.cash + 1e-6) return fail('現金不足，需要 ' + fmtMoney(need) + '（含 3% 稅費）。');
        res = { ok: true, qty: x, fee: fees, total: need, loan, msg: '買進 ' + x + ' 間，現金支出 ' + fmtMoney(need) + (loan ? '，房貸 ' + fmtMoney(loan) : '') };
        if (!dry) { s.cash -= need; o.count += x; o.cost += total + fees; o.mortgage += loan; }
      } else {
        if (x > o.count) return fail('持有數量不足。');
        const gross = o.price * x, fee = gross * R.reSellCost;
        const share = o.mortgage * (x / o.count);
        const got = gross - fee - share;
        if (s.cash + got < -1e-6) return fail('賣出後仍不足以清償房貸，無法成交。');
        const basis = o.cost * (x / o.count);
        res = { ok: true, qty: x, fee, total: got, pnl: gross - fee - basis, msg: '賣出 ' + x + ' 間，扣除房貸與 4% 費用後入帳 ' + fmtMoney(got) };
        if (!dry) {
          s.cash += got; s.stats.realized += gross - fee - basis;
          o.mortgage -= share; o.cost -= basis; o.count -= x;
          if (o.count === 0) { o.mortgage = 0; o.cost = 0; }
        }
      }
    } else return fail('未知的交易類型。');

    if (!dry) { s.stats.trades++; res.ach = checkAch(s); }
    return res;
  }

  /* ---------- 借貸 ---------- */
  function maxBorrow(s) { return Math.max(0, R.marginMaxRatio * liquidValue(s) - s.marginDebt); }
  function borrow(s, amt) {
    amt = Math.floor(Number(amt));
    if (!(amt > 0)) return { ok: false, msg: '請輸入借款金額。' };
    const mb = maxBorrow(s);
    if (amt > mb + 1) return { ok: false, msg: '超過可借額度，目前最多可借 ' + fmtMoney(mb) + '（以股票、比特幣、基金為擔保，上限 50%）。' };
    s.marginDebt += amt; s.cash += amt; s.flags.borrowed = true;
    return { ok: true, msg: '已借款 ' + fmtMoney(amt), ach: checkAch(s) };
  }
  function repay(s, amt) {
    amt = Math.floor(Number(amt));
    if (!(amt > 0)) return { ok: false, msg: '請輸入還款金額。' };
    amt = Math.min(amt, s.marginDebt);
    if (amt > s.cash) return { ok: false, msg: '現金不足。' };
    s.cash -= amt; s.marginDebt -= amt;
    return { ok: true, msg: '已還款 ' + fmtMoney(amt) };
  }

  /* ---------- 成就 ---------- */
  function checkAch(s) {
    const nw = netWorth(s), out = [];
    const tests = {
      first: () => nw >= s.startCash * 1.2,
      diversify: () => holdsStocks(s) && s.btc.units > 0 && propertyCount(s) > 0 && holdsFunds(s),
      landlord: () => propertyCount(s) >= 3,
      btcfaith: () => btcValue(s) >= 5000000,
      leverage: () => !!s.flags.borrowed,
      cutloss: () => !!s.flags.cutLoss,
      dodge: () => !!s.flags.dodge,
      survivor: () => !!s.flags.survivedMC && nw > 0,
      rich: () => nw >= 10000000,
      goal: () => s.won,
      finish: () => !!s.flags.finish && !s.bankrupt,
      tenx: () => nw >= s.startCash * 10
    };
    for (const a of D.ACHIEVEMENTS) {
      if (!s.ach[a.id] && tests[a.id] && tests[a.id]()) { s.ach[a.id] = s.month; out.push(a); }
    }
    return out;
  }

  function rankOf(s) {
    const nw = netWorth(s);
    if (s.bankrupt || nw <= 0) return { name: '破產', text: '帳戶歸零，但別氣餒，市場永遠有下一次機會。' };
    const ratio = nw / s.target;
    let r = D.RANKS[0];
    for (const x of D.RANKS) if (ratio >= x.min) r = x;
    return r;
  }

  const api = {
    newGame, advance, trade, borrow, repay, maxBorrow, buyIntel, checkAch, rankOf,
    netWorth, liquidValue, stockValue, btcValue, fundValue, reValue, mortgageTotal, propertyCount, monthlyRent, fmtMoney,
    WARMUP
  };
  root.GameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
