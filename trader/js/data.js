/* 我愛操盤手 - 遊戲資料。真實市場模式只採用真實的名稱、代號與起始價格（快照），走勢與新聞事件全為模擬。 */
(function (root) {
  'use strict';

  const MODES = [
    { id: 'easy', name: '輕鬆模式', tag: '資金充裕', desc: '起始資金 300 萬，每月可存 4 萬，目標 1,800 萬。適合第一次玩。', cash: 3000000, save: 40000, target: 18000000 },
    { id: 'normal', name: '一般模式', tag: '推薦', desc: '起始資金 150 萬，每月可存 2.5 萬，目標 2,200 萬。', cash: 1500000, save: 25000, target: 22000000 },
    { id: 'hard', name: '困難模式', tag: '小資翻身', desc: '起始資金 60 萬，每月可存 1.5 萬，目標 1,000 萬。', cash: 600000, save: 15000, target: 10000000 }
  ];

  // 股票：beta=對大盤敏感度，vol=個股月波動，div=年殖利率，w=指數權重
  const STOCKS = [
    { id: 'xd', code: '', name: '芯鼎半導體', sector: 'tech', price: 620, beta: 1.3, vol: 0.055, div: 0.015, w: 0.22, desc: '晶圓代工龍頭，業績跟著 AI 與景氣走，波動偏大。' },
    { id: 'ht', code: '', name: '宏圖電腦', sector: 'tech', price: 85, beta: 1.1, vol: 0.05, div: 0.03, w: 0.14, desc: '品牌電腦與伺服器廠，景氣循環明顯。' },
    { id: 'ws', code: '', name: '穩盛金控', sector: 'finance', price: 32, beta: 0.9, vol: 0.03, div: 0.05, w: 0.2, desc: '大型金控，配息穩定，利率上升時獲利較佳。' },
    { id: 'hy', code: '', name: '海運飛航', sector: 'shipping', price: 140, beta: 1.5, vol: 0.085, div: 0.06, w: 0.08, desc: '貨櫃航運，運價一飆就大賺、一崩就大虧。' },
    { id: 'kf', code: '', name: '康福生技', sector: 'biotech', price: 210, beta: 0.8, vol: 0.08, div: 0, w: 0.06, desc: '新藥研發公司，不配息，一則臨床消息就可能暴漲暴跌。' },
    { id: 'ms', code: '', name: '民生食品', sector: 'consumer', price: 58, beta: 0.5, vol: 0.025, div: 0.035, w: 0.14, desc: '民生必需品，景氣再差也要吃飯，走勢穩健。' },
    { id: 'lny', code: '', name: '綠能電力', sector: 'energy', price: 46, beta: 1.0, vol: 0.05, div: 0.04, w: 0.16, desc: '電力與再生能源，受油價與政策補貼影響。' }
  ];

  const SECTOR_NAMES = { tech: '科技', finance: '金融', shipping: '航運', biotech: '生技', consumer: '民生', energy: '能源', industry: '傳產', etf: 'ETF', other: '其他' };
  // 各產業預設：[beta, 月波動, 說明]
  const SECTOR_DEF = {
    tech: [1.25, 0.055, '半導體與電子科技股，跟著 AI 與景氣循環走，波動偏大。'],
    finance: [0.9, 0.03, '金融股，配息相對穩定，利率上升時獲利較佳。'],
    shipping: [1.4, 0.08, '航運股，運價一飆就大賺、一崩就大虧。'],
    biotech: [0.8, 0.08, '生技醫療股，一則臨床或藥證消息就可能暴漲暴跌。'],
    consumer: [0.5, 0.025, '民生消費與電信股，景氣再差也有需求，走勢穩健。'],
    energy: [1.0, 0.05, '能源與電力設備股，受油價與政策補貼影響。'],
    industry: [1.0, 0.04, '塑化、鋼鐵、水泥等傳統產業，跟著景氣與原物料價格走。'],
    etf: [1.0, 0.012, '指數型 ETF，一次買進一籃子股票，個股風險低。'],
    other: [1.0, 0.06, '自行加入的上市股票，使用一般的市場敏感度與波動設定。']
  };

  /* 真實市場快照（資料來源：臺灣證券交易所、CoinGecko）。遊戲啟動時會嘗試更新為最新收盤價。 */
  const SNAP = { date: '2026-11-16', taiex: 41040.08 };
  // [代號, 名稱, 英文名, 產業, 收盤價, 殖利率%]
  const REAL_RAW = [
    ['2330', '台積電', 'TSMC', 'tech', 2215, 0.99], ['2317', '鴻海', 'Hon Hai (Foxconn)', 'tech', 218.5, 3.28], ['2454', '聯發科', 'MediaTek', 'tech', 3795, 1.41],
    ['2308', '台達電', 'Delta Electronics', 'tech', 1120, 1.04], ['2382', '廣達', 'Quanta Computer', 'tech', 264.5, 5.9], ['3711', '日月光投控', 'ASE Technology', 'tech', 550, 1.2],
    ['2303', '聯電', 'UMC', 'tech', 95.2, 2.74], ['3231', '緯創', 'Wistron', 'tech', 159, 3.46], ['2357', '華碩', 'ASUS', 'tech', 836, 5.02],
    ['2379', '瑞昱', 'Realtek', 'tech', 716, 3.49], ['3008', '大立光', 'Largan Precision', 'tech', 4780, 1.67], ['2345', '智邦', 'Accton', 'tech', 1380, 1.09],
    ['6669', '緯穎', 'Wiwynn', 'tech', 1515, 8], ['3034', '聯詠', 'Novatek', 'tech', 451, 5.1], ['3017', '奇鋐', 'Asia Vital Components', 'tech', 2740, 0.76],
    ['2376', '技嘉', 'Gigabyte', 'tech', 277.5, 4.32], ['2408', '南亞科', 'Nanya Technology', 'tech', 340, 0.4], ['3661', '世芯-KY', 'Alchip', 'tech', 3660, 0.89],
    ['2881', '富邦金', 'Fubon Financial', 'finance', 152, 2.8], ['2882', '國泰金', 'Cathay Financial', 'finance', 110, 3.18], ['2891', '中信金', 'CTBC Financial', 'finance', 76.8, 3.26],
    ['2886', '兆豐金', 'Mega Financial', 'finance', 54.5, 3.21], ['2884', '玉山金', 'E.SUN Financial', 'finance', 48.3, 2.9], ['2892', '第一金', 'First Financial', 'finance', 42.35, 3.07],
    ['5880', '合庫金', 'Taiwan Cooperative Financial', 'finance', 28.25, 3.72], ['2885', '元大金', 'Yuanta Financial', 'finance', 68.7, 3.2], ['5871', '中租-KY', 'Chailease', 'finance', 100.5, 5.97],
    ['2603', '長榮', 'Evergreen Marine', 'shipping', 257, 6.23], ['2609', '陽明', 'Yang Ming Marine', 'shipping', 60, 3.33], ['2615', '萬海', 'Wan Hai Lines', 'shipping', 109.5, 2.74],
    ['2618', '長榮航', 'EVA Air', 'shipping', 47.4, 4.22], ['2610', '華航', 'China Airlines', 'shipping', 22.7, 3.57],
    ['6446', '藥華藥', 'PharmaEssentia', 'biotech', 1295, 0.2], ['1795', '美時', 'Lotus Pharmaceutical', 'biotech', 128, 2.11], ['1760', '寶齡富錦', 'Panion & BF Biotech', 'biotech', 45.65, 4.38], ['4142', '國光生', 'Adimmune', 'biotech', 16.35, 0],
    ['1216', '統一', 'Uni-President', 'consumer', 78.5, 3.82], ['2912', '統一超', 'President Chain Store', 'consumer', 214, 4.21], ['2412', '中華電', 'Chunghwa Telecom', 'consumer', 163.5, 3.18],
    ['3045', '台灣大', 'Taiwan Mobile', 'consumer', 129, 3.67], ['4904', '遠傳', 'Far EasTone', 'consumer', 109, 3.5], ['2633', '台灣高鐵', 'Taiwan High Speed Rail', 'consumer', 25.65, 4.48],
    ['1301', '台塑', 'Formosa Plastics', 'industry', 67, 0.75], ['1303', '南亞', 'Nan Ya Plastics', 'industry', 274, 0.29], ['2002', '中鋼', 'China Steel', 'industry', 18, 0.83],
    ['1101', '台泥', 'Taiwan Cement', 'industry', 26.45, 3.02], ['2207', '和泰車', 'Hotai Motor', 'industry', 526, 3.8], ['9910', '豐泰', 'Feng Tay', 'industry', 66.8, 6.14],
    ['6505', '台塑化', 'Formosa Petrochemical', 'energy', 89.6, 1.34], ['1513', '中興電', 'Chung-Hsin Electric', 'energy', 141, 4.26], ['1519', '華城', 'Fortune Electric', 'energy', 483.5, 2.48],
    ['1503', '士電', 'Shihlin Electric', 'energy', 164, 3.05], ['3576', '聯合再生', 'United Renewable Energy', 'energy', 16.25, 0],
    ['0050', '元大台灣50', 'Yuanta Taiwan 50 ETF', 'etf', 96.45, 3], ['006208', '富邦台50', 'Fubon Taiwan 50 ETF', 'etf', 220.85, 3],
    ['0056', '元大高股息', 'Yuanta High Dividend ETF', 'etf', 50.6, 7], ['00878', '國泰永續高股息', 'Cathay ESG High Dividend ETF', 'etf', 32.43, 7], ['00919', '群益台灣精選高息', 'Capital TW Select High Dividend ETF', 'etf', 30.5, 8]
  ];
  const HIGH_DIV_ETF = { '0056': 1, '00878': 1, '00919': 1 };
  function makeStock(code, name, en, sector, price, divPct) {
    const sd = SECTOR_DEF[sector] || SECTOR_DEF.other;
    return { id: 's' + code, code: code, name: name, en: en || '', sector: sector, price: +price, beta: HIGH_DIV_ETF[code] ? 0.7 : sd[0], vol: sd[1],
      div: Math.min(0.08, Math.max(0, (+divPct || 0) / 100)), w: 1, real: true };
  }
  const REAL_STOCKS = REAL_RAW.map(function (r) { return makeStock.apply(null, r); });
  const DEFAULT_REAL = ['2330', '2317', '2454', '2881', '2603', '6446', '1216', '1519', '0050'];

  // 加密貨幣：[id, 代號, 名稱, 英文名, CoinGecko id, 價格(TWD), beta(對幣市共同走勢), 個別月波動]
  const CRYPTO_RAW = [
    ['btc', 'BTC', '比特幣', 'Bitcoin', 'bitcoin', 2125080, 1.0, 0.02], ['eth', 'ETH', '以太幣', 'Ethereum', 'ethereum', 59429, 1.15, 0.06],
    ['sol', 'SOL', '索拉納', 'Solana', 'solana', 2346.59, 1.3, 0.1], ['bnb', 'BNB', '幣安幣', 'BNB', 'binancecoin', 19424.45, 1.0, 0.06],
    ['xrp', 'XRP', '瑞波幣', 'XRP', 'ripple', 31.28, 1.2, 0.1], ['doge', 'DOGE', '狗狗幣', 'Dogecoin', 'dogecoin', 1.92, 1.35, 0.14],
    ['ada', 'ADA', '艾達幣', 'Cardano', 'cardano', 5.0, 1.25, 0.1], ['trx', 'TRX', '波場幣', 'TRON', 'tron', 9.97, 0.9, 0.07],
    ['avax', 'AVAX', '雪崩幣', 'Avalanche', 'avalanche-2', 234.08, 1.35, 0.11], ['link', 'LINK', 'Chainlink', 'Chainlink', 'chainlink', 300.52, 1.25, 0.1],
    ['ltc', 'LTC', '萊特幣', 'Litecoin', 'litecoin', 1464.43, 1.05, 0.08], ['dot', 'DOT', '波卡幣', 'Polkadot', 'polkadot', 23.85, 1.3, 0.1],
    ['sui', 'SUI', 'Sui', 'Sui', 'sui', 23.72, 1.4, 0.13], ['ton', 'TON', 'Toncoin', 'Toncoin', 'the-open-network', 34.59, 1.2, 0.1],
    ['bch', 'BCH', '比特幣現金', 'Bitcoin Cash', 'bitcoin-cash', 6783.69, 1.1, 0.08], ['shib', 'SHIB', '柴犬幣', 'Shiba Inu', 'shiba-inu', 0.00012734, 1.45, 0.16]
  ];
  const CRYPTOS = CRYPTO_RAW.map(function (r) { return { id: r[0], code: r[1], name: r[2], en: r[3], cg: r[4], price: r[5], beta: r[6], vol: r[7] }; });
  const DEFAULT_CRYPTO = ['btc', 'eth', 'sol'];
  const CRYPTO_DESC = '全年無休的加密資產，波動極大，牛熊週期明顯；小型幣漲跌通常比比特幣更劇烈。';


  // 房地產：price=單價、rent=月租（含管理費後）、vol=月波動、mult=對房市共同因子的敏感度
  const PROPERTIES = [
    { id: 'park', name: '市區車位', price: 1500000, rent: 4000, vol: 0.005, mult: 0.7, desc: '總價低、好入門，租金穩定但成長有限。' },
    { id: 'studio', name: '捷運套房', price: 6000000, rent: 17000, vol: 0.008, mult: 1.0, desc: '單身租客的最愛，出租率高。' },
    { id: 'flat', name: '小家庭公寓', price: 12000000, rent: 32000, vol: 0.009, mult: 1.0, desc: '剛需族群需求大，景氣好時漲幅可觀。' },
    { id: 'shop', name: '商圈店面', price: 25000000, rent: 70000, vol: 0.012, mult: 1.25, desc: '租金較高，但景氣差時容易空租，價格也較敏感。' },
    { id: 'office', name: '商辦大樓樓層', price: 45000000, rent: 120000, vol: 0.014, mult: 1.4, desc: '總價最高，景氣循環性最強。' }
  ];

  // 基金：buyFee=申購手續費
  const FUNDS = [
    { id: 'money', name: '貨幣市場基金', nav: 10, buyFee: 0, risk: '極低', desc: '類似活存加強版，報酬跟著利率走，幾乎不會虧。' },
    { id: 'bond', name: '穩健債券基金', nav: 12, buyFee: 0.001, risk: '低', desc: '利率下降時上漲，利率上升時下跌。大跌時常有避險效果。' },
    { id: 'index', name: '大盤指數基金', nav: 35, buyFee: 0.001, risk: '中', desc: '一籃子買進你這一局選的所有股票，費用低、配息自動再投入。' },
    { id: 'growth', name: '全球科技成長基金', nav: 20, buyFee: 0.005, risk: '中高', desc: '主動式基金，偏重科技，經理費較高，不一定打敗大盤。' },
    { id: 'divi', name: '高股息收益基金', nav: 15, buyFee: 0.003, risk: '中低', desc: '偏愛配息股，大跌時抗跌，大漲時漲得比較少。' }
  ];

  // 市場狀態：0=牛市 1=盤整 2=熊市
  const MARKET = {
    names: ['牛市', '盤整', '熊市'],
    drift: [0.014, 0.004, -0.014],
    chain: [[0.86, 0.11, 0.03], [0.17, 0.68, 0.15], [0.05, 0.17, 0.78]]
  };
  const BTC_REG = {
    drift: [0.058, 0.0, -0.065],
    chain: [[0.88, 0.08, 0.04], [0.2, 0.6, 0.2], [0.07, 0.15, 0.78]]
  };
  const RE_REG = {
    names: ['房市熱絡', '房市持平', '房市低迷'],
    drift: [0.0065, 0.0022, -0.005],
    chain: [[0.9, 0.08, 0.02], [0.1, 0.82, 0.08], [0.04, 0.16, 0.8]]
  };

  // 交易成本與規則
  const RULES = {
    stockBuyFee: 0.002, stockSellFee: 0.0045,
    btcFee: 0.005,
    reBuyCost: 0.03, reSellCost: 0.04, reLtv: 0.7, reHoldCost: 0.0004,
    marginMaxRatio: 0.5, marginCallRatio: 0.7, marginTargetRatio: 0.45,
    marginSpread: 0.025, mortgageSpread: 0.01, cashRateFactor: 0.4,
    intelCost: 5000, months: 120
  };

  /*
    新聞事件：fx 以「當月漲跌幅」表示（0.05=+5%），rate 為政策利率變動（0.0025=0.25 個百分點）。
    acc=消息準確率（預設 0.75）。消息不實時，市場反應為相反方向且較小。
  */
  const EVENTS = [
    { id: 'cut', t: '央行意外降息', d: '中央銀行宣布降息一碼，市場資金行情升溫。', fx: { market: 0.03, finance: -0.01, re: 0.008, rate: -0.0025, btc: 0.03 }, w: 2.2 },
    { id: 'hike', t: '央行宣布升息', d: '為抑制通膨，央行升息一碼，資金成本上升。', fx: { market: -0.03, finance: 0.02, re: -0.008, rate: 0.0025, btc: -0.04 }, w: 2.2 },
    { id: 'cpi', t: '通膨數據超乎預期', d: '物價指數創近年新高，市場擔心央行加速緊縮。', fx: { market: -0.025, consumer: -0.02, energy: 0.03, rate: 0.0025, btc: -0.02 }, w: 1.6 },
    { id: 'gdp', t: '經濟成長優於預期', d: '本季 GDP 與出口訂單雙雙亮眼。', fx: { market: 0.04, shipping: 0.03, industry: 0.02 }, w: 2 },
    { id: 'recess', t: '景氣衰退疑慮升溫', d: '製造業採購經理人指數連續萎縮。', fx: { market: -0.05, shipping: -0.08, tech: -0.03, industry: -0.03 }, w: 1.4 },
    { id: 'ai', t: 'AI 晶片需求暴增', d: '雲端大廠擴大資本支出，晶片供不應求。', fx: { tech: 0.12, market: 0.02, energy: 0.02 }, w: 1.6, acc: 0.8 },
    { id: 'chipban', t: '晶片出口管制擴大', d: '主要國家宣布新一輪晶片出口限制。', fx: { tech: -0.1, market: -0.02 }, w: 1.2 },
    { id: 'freight', t: '航運運價大漲', d: '紅海繞道與缺櫃，貨櫃運價一週暴漲。', fx: { shipping: 0.18, consumer: -0.01 }, w: 1.2 },
    { id: 'freightdn', t: '港口塞港紓解、運價崩跌', d: '運力過剩，貨櫃運價快速回落。', fx: { shipping: -0.12 }, w: 1.2 },
    { id: 'drugok', t: '新藥臨床三期傳出好消息', d: '生技族群的主力新藥臨床試驗數據傳出理想。', fx: { biotech: 0.25 }, w: 0.9, acc: 0.6 },
    { id: 'drugfail', t: '新藥臨床試驗未達標', d: '生技族群新藥臨床結果不如預期。', fx: { biotech: -0.25 }, w: 0.9, acc: 0.6 },
    { id: 'oilup', t: '國際油價大漲', d: '產油國宣布擴大減產。', fx: { energy: 0.1, consumer: -0.015, market: -0.01, industry: -0.02 }, w: 1.3 },
    { id: 'oildn', t: '國際油價崩跌', d: '需求疲弱疊加增產，油價重挫。', fx: { energy: -0.1, consumer: 0.015, market: 0.01 }, w: 1.3 },
    { id: 'green', t: '綠能補貼法案過關', d: '政府加碼再生能源補助與躉購費率。', fx: { energy: 0.12, market: 0.005 }, w: 1 },
    { id: 'bankup', t: '銀行業獲利創新高', d: '利差擴大與手續費收入帶動金融股。', fx: { finance: 0.08 }, w: 1.1 },
    { id: 'scandal', t: '金融業爆發弊案', d: '市場傳出金融業違規放款疑慮，信心動搖。', fx: { finance: -0.12, market: -0.02 }, w: 0.9 },
    { id: 'etf', t: '比特幣現貨 ETF 傳出將獲核准', d: '監管機關審查進入最後階段。', fx: { btc: 0.25 }, w: 0.9, acc: 0.65 },
    { id: 'exfail', t: '大型加密交易所傾倒', d: '交易所暫停提領，加密市場恐慌。', fx: { btc: -0.3, market: -0.01 }, w: 0.8 },
    { id: 'cryptoreg', t: '多國加強加密貨幣監管', d: '監管趨嚴，市場擔心資金流出。', fx: { btc: -0.15 }, w: 1.1 },
    { id: 'whale', t: '機構大戶大舉買進比特幣', d: '鏈上數據顯示巨鯨持續吸籌。', fx: { btc: 0.15 }, w: 1.3 },
    { id: 'halving', t: '比特幣減半效應發酵', d: '供給減少預期推升價格。', fx: { btc: 0.2 }, w: 0.7 },
    { id: 'dahousing', t: '政府推出打房新政', d: '祭出貸款管制與重稅，抑制投機炒作。', fx: { re: -0.025, finance: -0.01 }, w: 1.1 },
    { id: 'subsidy', t: '青年購屋補貼上路', d: '利息補貼與頭期款協助提高剛需買盤。', fx: { re: 0.02 }, w: 1.1 },
    { id: 'mrt', t: '捷運新線通車', d: '沿線生活圈機能提升，買盤湧入。', fx: { re: 0.015 }, w: 1 },
    { id: 'mortgage', t: '銀行推出房貸優惠', d: '多家銀行搶客，首購族貸款成本下降。', fx: { re: 0.015 }, w: 1 },
    { id: 'urban', t: '都市更新計畫公布', d: '老舊社區改建題材發酵。', fx: { re: 0.02 }, w: 0.8 },
    { id: 'vacancy', t: '商辦空置率攀升', d: '企業縮編與遠距上班，租賃需求降溫。', fx: { re: -0.012 }, w: 0.9 },
    { id: 'geo', t: '地緣政治緊張升高', d: '區域衝突擴大，避險情緒濃厚。', fx: { market: -0.06, energy: 0.05, btc: 0.03 }, w: 1.1 },
    { id: 'trade', t: '貿易協議簽署', d: '關稅調降，出口產業受惠。', fx: { market: 0.04, shipping: 0.04, industry: 0.03 }, w: 1.3 },
    { id: 'typhoon', t: '強颱來襲', d: '港口停工、消費活動減少。', fx: { shipping: -0.03, consumer: -0.01, re: -0.003 }, w: 1 },
    { id: 'voucher', t: '政府發放消費券', d: '振興方案帶動內需。', fx: { consumer: 0.06, market: 0.015 }, w: 1 },
    { id: 'panic', t: '全球股市恐慌性修正', d: '槓桿部位被迫平倉，波動指數飆升。', fx: { market: -0.09, btc: -0.1, shipping: -0.04 }, w: 0.8, acc: 0.7 },
    { id: 'record', t: '大盤創歷史新高', d: '資金行情推升指數，市場情緒樂觀。', fx: { market: 0.04, btc: 0.02 }, w: 1.2 },
    { id: 'fbuy', t: '外資大舉買超', d: '外資連續買超，資金湧入權值股。', fx: { market: 0.045, tech: 0.02 }, w: 1.2 },
    { id: 'fsell', t: '外資大舉賣超', d: '外資連日賣超，匯率同步貶值。', fx: { market: -0.045, tech: -0.02 }, w: 1.2 },
    { id: 'earn', t: '財報季普遍亮眼', d: '多數公司財報優於預期。', fx: { market: 0.03, tech: 0.03 }, w: 1.3 },
    { id: 'earnbad', t: '財報季令人失望', d: '企業下修展望，法人調降目標價。', fx: { market: -0.03, tech: -0.01 }, w: 1.3 },
    { id: 'food', t: '食品原料大漲', d: '成本壓力讓食品業毛利下滑。', fx: { consumer: -0.04 }, w: 0.9 },
    { id: 'virus', t: '新型病毒疫情擴散', d: '市場擔憂經濟活動受限，防疫概念股走強。', fx: { market: -0.04, biotech: 0.1, consumer: -0.01 }, w: 0.8 },
    { id: 'dovish', t: '央行總裁暗示維持寬鬆', d: '談話偏鴿派，市場解讀為利多。', fx: { market: 0.025, rate: -0.0025, btc: 0.04 }, w: 1.1 },
    { id: 'usd', t: '美元指數強勢走升', d: '資金回流美元資產，新興市場承壓。', fx: { btc: -0.05, market: -0.015 }, w: 1.1 },
    { id: 'layoff', t: '科技大廠宣布裁員', d: '成本控管下，市場擔心需求放緩。', fx: { tech: -0.05 }, w: 1 },
    { id: 'energycrisis', t: '能源危機', d: '供應中斷讓電價與油價同步飆升。', fx: { energy: 0.15, market: -0.04, consumer: -0.03 }, w: 0.6 },
    { id: 'rescue', t: '全球央行聯手救市', d: '大規模流動性挹注，風險資產全面反彈。', fx: { market: 0.06, btc: 0.05, rate: -0.005 }, w: 0.5, acc: 0.85 },
    { id: 'crisis', t: '金融海嘯警報', d: '大型機構傳出流動性危機，全球金融市場動盪。', fx: { market: -0.12, finance: -0.1, re: -0.02, btc: -0.15 }, w: 0.4, acc: 0.7 },
    { id: 'quiet1', t: '市場平靜無波', d: '本月沒有重大消息，盤勢以個股表現為主。', fx: {}, w: 2.5, quiet: true },
    { id: 'quiet2', t: '投資人觀望氣氛濃厚', d: '成交量縮小，資金靜待下一個催化劑。', fx: {}, w: 1.5, quiet: true }
  ];

  const PERSONAL_BAD = [
    { t: '牙齒治療', m: 1.5 }, { t: '家電壞掉換新', m: 1.0 }, { t: '朋友結婚包紅包', m: 0.5 },
    { t: '出國旅遊', m: 2.0 }, { t: '機車被撞、修車', m: 0.8 }, { t: '父母看病花費', m: 1.2 }
  ];
  const PERSONAL_GOOD = [
    { t: '發票中獎', m: 0.2 }, { t: '接案外快', m: 1.0 }, { t: '退稅', m: 1.2 }, { t: '績效獎金', m: 1.5 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', name: '第一桶金', desc: '淨資產超過起始資金 20%' },
    { id: 'diversify', name: '雞蛋不放一籃', desc: '同時持有股票、加密貨幣、房地產、基金' },
    { id: 'landlord', name: '包租公／婆', desc: '同時持有 3 間以上的房地產' },
    { id: 'btcfaith', name: '幣圈信仰', desc: '加密貨幣部位市值超過 500 萬' },
    { id: 'leverage', name: '槓桿初體驗', desc: '第一次向券商借錢' },
    { id: 'cutloss', name: '壯士斷腕', desc: '虧損 20% 以上賣出一檔持股' },
    { id: 'dodge', name: '躲過崩盤', desc: '大盤單月重挫 8% 以上時，持有 70% 以上現金' },
    { id: 'survivor', name: '大難不死', desc: '經歷追繳保證金並存活' },
    { id: 'rich', name: '千萬富翁', desc: '淨資產達到 1,000 萬' },
    { id: 'goal', name: '達成目標', desc: '淨資產達到模式目標' },
    { id: 'finish', name: '十年磨一劍', desc: '完整玩完 10 年（120 個月）' },
    { id: 'tenx', name: '十倍奇蹟', desc: '淨資產達到起始資金的 10 倍' },
    { id: 'dca', name: '紀律投資人', desc: '定期定額累計扣款 12 個月' },
    { id: 'order', name: '說到做到', desc: '停損或停利條件單成功觸發' },
    { id: 'altcoin', name: '幣圈探險家', desc: '同時持有 3 種以上的加密貨幣' }
  ];

  const RANKS = [
    { min: -Infinity, name: '韭菜', text: '市場教了你一課，下次一定會更好。' },
    { min: 0.3, name: '小散戶', text: '有賺有賠，繼續累積經驗。' },
    { min: 0.6, name: '穩健投資人', text: '穩穩累積，距離目標只差一步。' },
    { min: 1.0, name: '專業操盤手', text: '達成目標，操盤功力令人佩服。' },
    { min: 1.6, name: '華爾街之狼', text: '遠遠超出預期，風控與膽識兼備。' },
    { min: 3.0, name: '股神', text: '傳奇等級的成績，請去買張樂透。' }
  ];

  root.GAME_DATA = { MODES, STOCKS, SECTOR_NAMES, SECTOR_DEF, SNAP, REAL_STOCKS, DEFAULT_REAL, makeStock, CRYPTOS, DEFAULT_CRYPTO, CRYPTO_DESC, PROPERTIES, FUNDS, MARKET, BTC_REG, RE_REG, RULES, EVENTS, PERSONAL_BAD, PERSONAL_GOOD, ACHIEVEMENTS, RANKS };
})(typeof window !== 'undefined' ? window : globalThis);
