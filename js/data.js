/* 我愛操盤手 - 遊戲資料（全部為虛構公司與事件，僅供娛樂與學習） */
(function (root) {
  'use strict';

  const MODES = [
    { id: 'easy', name: '輕鬆模式', tag: '資金充裕', desc: '起始資金 300 萬，每月可存 4 萬，目標 1,800 萬。適合第一次玩。', cash: 3000000, save: 40000, target: 18000000 },
    { id: 'normal', name: '一般模式', tag: '推薦', desc: '起始資金 150 萬，每月可存 2.5 萬，目標 2,200 萬。', cash: 1500000, save: 25000, target: 22000000 },
    { id: 'hard', name: '困難模式', tag: '小資翻身', desc: '起始資金 60 萬，每月可存 1.5 萬，目標 1,000 萬。', cash: 600000, save: 15000, target: 10000000 }
  ];

  // 股票：beta=對大盤敏感度，vol=個股月波動，div=年殖利率，w=指數權重
  const STOCKS = [
    { id: 'xd', name: '芯鼎半導體', sector: 'tech', price: 620, beta: 1.3, vol: 0.055, div: 0.015, w: 0.22, desc: '晶圓代工龍頭，業績跟著 AI 與景氣走，波動偏大。' },
    { id: 'ht', name: '宏圖電腦', sector: 'tech', price: 85, beta: 1.1, vol: 0.05, div: 0.03, w: 0.14, desc: '品牌電腦與伺服器廠，景氣循環明顯。' },
    { id: 'ws', name: '穩盛金控', sector: 'finance', price: 32, beta: 0.9, vol: 0.03, div: 0.05, w: 0.2, desc: '大型金控，配息穩定，利率上升時獲利較佳。' },
    { id: 'hy', name: '海運飛航', sector: 'shipping', price: 140, beta: 1.5, vol: 0.085, div: 0.06, w: 0.08, desc: '貨櫃航運，運價一飆就大賺、一崩就大虧。' },
    { id: 'kf', name: '康福生技', sector: 'biotech', price: 210, beta: 0.8, vol: 0.08, div: 0, w: 0.06, desc: '新藥研發公司，不配息，一則臨床消息就可能暴漲暴跌。' },
    { id: 'ms', name: '民生食品', sector: 'consumer', price: 58, beta: 0.5, vol: 0.025, div: 0.035, w: 0.14, desc: '民生必需品，景氣再差也要吃飯，走勢穩健。' },
    { id: 'lny', name: '綠能電力', sector: 'energy', price: 46, beta: 1.0, vol: 0.05, div: 0.04, w: 0.16, desc: '電力與再生能源，受油價與政策補貼影響。' }
  ];

  const SECTOR_NAMES = { tech: '科技', finance: '金融', shipping: '航運', biotech: '生技', consumer: '民生', energy: '能源' };

  const BTC = { id: 'btc', name: '比特幣 BTC', price: 1200000, desc: '全年無休的加密資產，波動極大，牛熊週期明顯。' };

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
    { id: 'index', name: '大盤指數基金', nav: 35, buyFee: 0.001, risk: '中', desc: '一籃子買進本遊戲的七檔股票，費用低、配息自動再投入。' },
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
    { id: 'gdp', t: '經濟成長優於預期', d: '本季 GDP 與出口訂單雙雙亮眼。', fx: { market: 0.04, shipping: 0.03 }, w: 2 },
    { id: 'recess', t: '景氣衰退疑慮升溫', d: '製造業採購經理人指數連續萎縮。', fx: { market: -0.05, shipping: -0.08, tech: -0.03 }, w: 1.4 },
    { id: 'ai', t: 'AI 晶片需求暴增', d: '雲端大廠擴大資本支出，晶片供不應求。', fx: { tech: 0.12, market: 0.02, energy: 0.02 }, w: 1.6, acc: 0.8 },
    { id: 'chipban', t: '晶片出口管制擴大', d: '主要國家宣布新一輪晶片出口限制。', fx: { tech: -0.1, market: -0.02 }, w: 1.2 },
    { id: 'freight', t: '航運運價大漲', d: '紅海繞道與缺櫃，貨櫃運價一週暴漲。', fx: { shipping: 0.18, consumer: -0.01 }, w: 1.2 },
    { id: 'freightdn', t: '港口塞港紓解、運價崩跌', d: '運力過剩，貨櫃運價快速回落。', fx: { shipping: -0.12 }, w: 1.2 },
    { id: 'drugok', t: '新藥臨床三期傳出好消息', d: '康福生技的主力新藥臨床試驗數據傳出理想。', fx: { biotech: 0.25 }, w: 0.9, acc: 0.6 },
    { id: 'drugfail', t: '新藥臨床試驗未達標', d: '生技族群新藥臨床結果不如預期。', fx: { biotech: -0.25 }, w: 0.9, acc: 0.6 },
    { id: 'oilup', t: '國際油價大漲', d: '產油國宣布擴大減產。', fx: { energy: 0.1, consumer: -0.015, market: -0.01 }, w: 1.3 },
    { id: 'oildn', t: '國際油價崩跌', d: '需求疲弱疊加增產，油價重挫。', fx: { energy: -0.1, consumer: 0.015, market: 0.01 }, w: 1.3 },
    { id: 'green', t: '綠能補貼法案過關', d: '政府加碼再生能源補助與躉購費率。', fx: { energy: 0.12, market: 0.005 }, w: 1 },
    { id: 'bankup', t: '銀行業獲利創新高', d: '利差擴大與手續費收入帶動金融股。', fx: { finance: 0.08 }, w: 1.1 },
    { id: 'scandal', t: '金融業爆發弊案', d: '大型金控爆出違規放款，市場信心動搖。', fx: { finance: -0.12, market: -0.02 }, w: 0.9 },
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
    { id: 'trade', t: '貿易協議簽署', d: '關稅調降，出口產業受惠。', fx: { market: 0.04, shipping: 0.04 }, w: 1.3 },
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
    { id: 'diversify', name: '雞蛋不放一籃', desc: '同時持有股票、比特幣、房地產、基金' },
    { id: 'landlord', name: '包租公／婆', desc: '同時持有 3 間以上的房地產' },
    { id: 'btcfaith', name: '比特幣信仰', desc: '比特幣部位市值超過 500 萬' },
    { id: 'leverage', name: '槓桿初體驗', desc: '第一次向券商借錢' },
    { id: 'cutloss', name: '壯士斷腕', desc: '虧損 20% 以上賣出一檔持股' },
    { id: 'dodge', name: '躲過崩盤', desc: '大盤單月重挫 8% 以上時，持有 70% 以上現金' },
    { id: 'survivor', name: '大難不死', desc: '經歷追繳保證金並存活' },
    { id: 'rich', name: '千萬富翁', desc: '淨資產達到 1,000 萬' },
    { id: 'goal', name: '達成目標', desc: '淨資產達到模式目標' },
    { id: 'finish', name: '十年磨一劍', desc: '完整玩完 10 年（120 個月）' },
    { id: 'tenx', name: '十倍奇蹟', desc: '淨資產達到起始資金的 10 倍' }
  ];

  const RANKS = [
    { min: -Infinity, name: '韭菜', text: '市場教了你一課，下次一定會更好。' },
    { min: 0.3, name: '小散戶', text: '有賺有賠，繼續累積經驗。' },
    { min: 0.6, name: '穩健投資人', text: '穩穩累積，距離目標只差一步。' },
    { min: 1.0, name: '專業操盤手', text: '達成目標，操盤功力令人佩服。' },
    { min: 1.6, name: '華爾街之狼', text: '遠遠超出預期，風控與膽識兼備。' },
    { min: 3.0, name: '股神', text: '傳奇等級的成績，請去買張樂透。' }
  ];

  root.GAME_DATA = { MODES, STOCKS, SECTOR_NAMES, BTC, PROPERTIES, FUNDS, MARKET, BTC_REG, RE_REG, RULES, EVENTS, PERSONAL_BAD, PERSONAL_GOOD, ACHIEVEMENTS, RANKS };
})(typeof window !== 'undefined' ? window : globalThis);
