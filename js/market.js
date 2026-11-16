/* 我愛操盤手 - 真實行情載入
   股票：臺灣證券交易所（www.twse.com.tw）每日收盤行情與殖利率
   加密貨幣：CoinGecko（新台幣報價）
   全部在玩家的瀏覽器直接讀取，失敗時改用 data.js 內建的快照，不影響遊戲。 */
(function (root) {
  'use strict';
  const D = root.GAME_DATA;
  const CACHE_KEY = 'wacp_mkt_v1', TTL = 6 * 3600 * 1000;
  const M = { status: 'idle', live: false, date: D.SNAP.date, taiex: D.SNAP.taiex, all: {}, yields: {}, crypto: {}, cryptoLive: false, listeners: [] };

  function num(x) { const v = parseFloat(String(x).replace(/,/g, '')); return isFinite(v) ? v : NaN; }
  function rocDate(d) { // 1151116 或 115/11/16 → 2026-11-16
    const m = String(d).replace(/\D/g, ''); if (m.length < 6) return D.SNAP.date;
    const y = parseInt(m.slice(0, m.length - 4), 10) + 1911; return y + '-' + m.slice(-4, -2) + '-' + m.slice(-2);
  }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  function get(url, type) { return timeout(fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return type === 'json' ? r.json() : r.text(); }), 12000); }

  function parseStocks(csv) {
    const out = {}; let date = null;
    const lines = csv.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split('","').map(function (x) { return x.replace(/"/g, '').trim(); });
      if (c.length < 10) continue;
      const price = num(c[8]); if (!(price > 0)) continue;
      if (!date) date = rocDate(c[0]);
      const chg = num(c[9]), prev = price - (isFinite(chg) ? chg : 0);
      out[c[1]] = { n: c[2].replace(/\*$/, ''), p: price, c: prev > 0 && isFinite(chg) ? chg / prev : 0 };
    }
    return { map: out, date: date };
  }

  function apply(data) {
    if (data.all && Object.keys(data.all).length > 200) { M.all = data.all; M.date = data.date || M.date; M.live = true; }
    if (data.yields) M.yields = data.yields;
    if (data.taiex > 0) M.taiex = data.taiex;
    if (data.crypto && Object.keys(data.crypto).length) { M.crypto = data.crypto; M.cryptoLive = true; }
  }
  function notify() { M.listeners.forEach(function (f) { try { f(M); } catch (e) { /* 忽略 */ } }); }

  M.onChange = function (f) { M.listeners.push(f); };

  M.load = function (force) {
    if (M.status === 'loading') return M.promise;
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (c && Date.now() - c.t < TTL) { apply(c); M.status = 'done'; notify(); return Promise.resolve(M); }
      } catch (e) { /* 忽略 */ }
    }
    if (typeof fetch !== 'function') { M.status = 'failed'; notify(); return Promise.resolve(M); }
    M.status = 'loading';
    const data = {};
    const jobs = [
      get('https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json', 'text').then(function (t) { const r = parseStocks(t); data.all = r.map; data.date = r.date; }),
      get('https://www.twse.com.tw/exchangeReport/BWIBBU_ALL?response=json', 'json').then(function (j) { const y = {}; (j.data || []).forEach(function (r) { const v = num(r[3]); if (isFinite(v)) y[r[0]] = v; }); data.yields = y; }),
      get('https://www.twse.com.tw/exchangeReport/FMTQIK?response=json', 'json').then(function (j) { const d = j.data || []; if (d.length) data.taiex = num(d[d.length - 1][4]); }),
      get('https://api.coingecko.com/api/v3/simple/price?ids=' + D.CRYPTOS.map(function (c) { return c.cg; }).join(',') + '&vs_currencies=twd&include_24hr_change=true', 'json').then(function (j) {
        const out = {}; D.CRYPTOS.forEach(function (c) { const r = j[c.cg]; if (r && r.twd > 0) out[c.id] = { p: r.twd, c: (r.twd_24h_change || 0) / 100 }; }); data.crypto = out;
      })
    ].map(function (p) { return p.catch(function () { /* 個別來源失敗就用快照 */ }); });
    M.promise = Promise.all(jobs).then(function () {
      apply(data);
      M.status = (M.live || M.cryptoLive) ? 'done' : 'failed';
      if (M.live || M.cryptoLive) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), all: M.live ? M.all : null, date: M.date, yields: M.yields, taiex: M.taiex, crypto: M.cryptoLive ? M.crypto : null })); } catch (e) { /* 容量不足就不快取 */ } }
      notify(); return M;
    });
    return M.promise;
  };

  /* 取得一檔股票的遊戲定義（優先用即時收盤價與殖利率） */
  M.stock = function (code) {
    const base = D.REAL_STOCKS.find(function (x) { return x.code === code; });
    const live = M.all[code];
    if (!base && !live) return null;
    const y = M.yields[code];
    const d = base ? Object.assign({}, base) : D.makeStock(code, live.n, '', 'other', live.p, y);
    if (live) { d.price = live.p; d.chg = live.c; if (!base) d.name = live.n; }
    if (base && isFinite(y) && base.sector !== 'etf') d.div = Math.min(0.08, Math.max(0, y / 100));
    return d;
  };
  M.coin = function (id) {
    const base = D.CRYPTOS.find(function (x) { return x.id === id; }); if (!base) return null;
    const d = Object.assign({}, base), live = M.crypto[id];
    if (live) { d.price = live.p; d.chg = live.c; }
    return d;
  };
  /* 搜尋全部上市證券（代號或名稱），回傳最多 n 筆 */
  M.search = function (q, n) {
    q = String(q || '').trim().toUpperCase(); if (!q) return [];
    const out = [], seen = {};
    const push = function (code, name) { if (seen[code] || out.length >= (n || 8)) return; seen[code] = 1; out.push({ code: code, name: name }); };
    D.REAL_STOCKS.forEach(function (s) { if (s.code.indexOf(q) === 0 || s.name.toUpperCase().indexOf(q) >= 0 || s.en.toUpperCase().indexOf(q) >= 0) push(s.code, s.name); });
    for (const code in M.all) { if (out.length >= (n || 8)) break; if (code.indexOf(q) === 0 || M.all[code].n.toUpperCase().indexOf(q) >= 0) push(code, M.all[code].n); }
    return out;
  };

  root.Market = M;
})(typeof window !== 'undefined' ? window : globalThis);
