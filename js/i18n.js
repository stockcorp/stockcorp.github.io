/* 我愛操盤手 - 多語系（鍵為繁體中文原文，找不到英文時退回原文）*/
(function (root) {
  'use strict';

  const EN = {
    /* ===== 靜態頁面 ===== */
    '我愛操盤手｜股票、比特幣、房地產、基金投資模擬遊戲': 'I Love Trading | Stock, Bitcoin, Real Estate & Fund Investing Simulator',
    '免費的投資模擬遊戲：用 10 年時間操作股票、比特幣、房地產與基金，面對新聞事件、利率變化與追繳保證金，挑戰成為股神。': 'A free investing simulator: trade stocks, Bitcoin, real estate and funds over 10 years, handle breaking news, interest-rate swings and margin calls, and try to become a market legend.',
    '我愛操盤手': 'I Love Trading',
    '股票・比特幣・房地產・基金': 'Stocks · Bitcoin · Real Estate · Funds',
    '玩法說明': 'How to Play',
    '新遊戲': 'New Game',
    '本遊戲所有公司、新聞與數據皆為<strong>虛構模擬</strong>，僅供娛樂與投資教育，<strong>不構成任何投資建議</strong>，過去的模擬績效不代表真實市場表現。': 'All companies, news and data in this game are <strong>fictional simulations</strong>, for entertainment and investment education only. They are <strong>not investment advice</strong>, and simulated results do not reflect real markets.',
    '隱私權政策與廣告說明': 'Privacy Policy & Ads',
    '台灣習慣：<span class="up">紅色代表上漲</span>、<span class="down">綠色代表下跌</span>': 'Taiwan convention: <span class="up">red = up</span>, <span class="down">green = down</span>',

    /* ===== 分頁與欄位 ===== */
    '股票': 'Stocks', '比特幣': 'Bitcoin', '房地產': 'Real Estate', '基金': 'Funds', '借貸': 'Loans', '資產總覽': 'Portfolio',
    '名稱': 'Name', '價格': 'Price', '淨值': 'NAV', '月漲跌': 'Month', '近一年': '1 Year', '持有': 'Held',
    '點選一列查看走勢與交易　紅漲綠跌': 'Tap a row for chart & trading · red = up, green = down',
    '{0} 股': '{0} sh', '{0} 枚': '{0} BTC', '{0} 間': '{0} unit(s)', '{0} 單位': '{0} units',
    '股': 'sh', '間': 'unit(s)',
    '產業': 'Sector', '年殖利率': 'Dividend yield', '敏感度 β': 'Beta (β)', '月波動': 'Monthly vol.',
    '交易成本': 'Trading cost', '買賣各 0.5%': '0.5% each way', '特性': 'Traits', '24 小時交易、波動極大': 'Trades 24/7, extremely volatile',
    '月租金': 'Monthly rent', '租金報酬率': 'Rental yield', '房貸餘額': 'Mortgage balance', '買進／賣出成本': 'Buy / sell cost', '3% ／ 4%': '3% / 4%',
    '風險等級': 'Risk level', '申購手續費': 'Subscription fee',
    '開局': 'Start', '開局前{0}月': '{0}m before start', '第{0}月': 'M{0}',
    '目標': 'Goal', '尚無資產': 'No assets yet', '總資產': 'Total assets',
    '房市狀態：{0}　買房可用房貸（七成），利率 = 政策利率 + 1%，現值 {1}，每月淨租金約 {2}。': 'Housing market: {0}. Mortgages cover 70%, rate = policy rate + 1%. Holdings worth {1}, about {2} rent per month.',
    '本月 {0}': 'This month {0}', '無': 'None', '市值': 'Value', '未實現損益': 'Unrealized P/L', '買進': 'Buy', '賣出': 'Sell',

    /* ===== 統計列 ===== */
    '遊戲結束': 'Game over', '共 {0} 個月': '{0} months', '第 {0} 年 {1} 月': 'Year {0} · Month {1}', '已過 {0} / {1} 個月': '{0} / {1} months elapsed',
    '淨資產': 'Net worth', '較上月 {0}': '{0} vs last month', '起始資金 {0}': 'Starting cash {0}',
    '現金': 'Cash', '月儲蓄 +{0}': 'Saves +{0}/mo', '總負債': 'Total debt', '利率 {0}': 'Rate {0}',
    '目標 {0}': 'Goal {0}', '　🎉 已達成': '  🎉 Reached',

    /* ===== 新聞面板 ===== */
    '📰 本月新聞': '📰 This Month\'s News', '消息不一定準確': 'Reports may be wrong',
    '內線：屬實': 'Insider: true', '內線：不實': 'Insider: false', '傳聞': 'Rumor',
    '遊戲已結束。': 'The game has ended.',
    '偏多': 'Bullish', '中性': 'Neutral', '偏空': 'Bearish',
    '市場情緒指標：': 'Market sentiment: ', '政策利率：': 'Policy rate: ',
    '💼 買內線情報（{0}）': '💼 Buy insider tip ({0})',
    '新聞約 6～8 成會成真；消息落空時，市場常會朝反方向小幅波動。情緒指標約 7 成準確，僅供參考。': 'About 60–80% of news comes true; when it fails, markets often move slightly the other way. The sentiment gauge is ~70% accurate — use it as a hint only.',
    '淨資產走勢': 'Net Worth Trend', '虛線為目標': 'Dashed line = goal',
    '📒 每月紀錄': '📒 Monthly Log', '還沒有紀錄，按「下一個月」開始。': 'Nothing yet — press "Next Month" to begin.',
    '再玩一次': 'Play Again', '查看成績': 'View Result', '下一個月 ▶': 'Next Month ▶', '快轉 3 個月 ⏩': 'Skip 3 Months ⏩',

    /* ===== 借貸 ===== */
    '借貸與槓桿': 'Loans & Leverage', '以股票、比特幣、基金為擔保': 'Secured by stocks, Bitcoin and funds',
    '融資借款': 'Margin loan', '融資利率': 'Margin rate', '可再借額度': 'Borrowing room', '融資維持情況（借款／證券市值）': 'Margin ratio (loan / securities)',
    '借款比例超過 {0} 會被追繳並強制賣出持股（另收 1% 費用）。借得越多，賺得多但也可能一次賠光。': 'If the ratio exceeds {0}, you face a margin call and forced selling (plus a 1% fee). More leverage can mean bigger gains — or losing it all at once.',
    '輸入金額（元）': 'Amount (NT$)', '最大可借': 'Max borrow', '全部還清': 'Repay all', '10 萬': '100K', '50 萬': '500K', '借款': 'Borrow', '還款': 'Repay',
    '房貸（買房時自動辦理，七成）': 'Mortgages (set up automatically when buying, 70%)', '房產': 'Property',
    '房貸只付利息，賣出房產時一次還清。': 'Mortgages are interest-only and repaid in full when you sell.', '目前沒有房貸。': 'No mortgages.',

    /* ===== 資產總覽 ===== */
    '資產配置': 'Allocation', '分散風險是投資的第一課': 'Diversification is investing lesson #1',
    '已實現損益': 'Realized P/L', '交易次數': 'Trades', '追繳次數': 'Margin calls', '歷史最高淨資產': 'Peak net worth',
    '成就': 'Achievements', '本機排行榜': 'Local Leaderboard', '只存在你的瀏覽器': 'Stored only in your browser',
    '名次': 'Rank', '模式': 'Mode', '最終淨資產': 'Final net worth', '稱號': 'Title',
    '玩完一場遊戲後，成績會出現在這裡。': 'Finish a game and your score will appear here.',

    /* ===== 開始畫面與說明 ===== */
    '用 10 年時間操作股票、比特幣、房地產與基金，達成你的財富目標。': 'Trade stocks, Bitcoin, real estate and funds over 10 years to reach your wealth goal.',
    '▶ 繼續上次的遊戲': '▶ Continue last game', '{0}・第 {1} 個月・淨資產 {2}': '{0} · Month {1} · Net worth {2}',
    '本遊戲為虛構模擬，不構成投資建議。': 'Fictional simulation — not investment advice.',
    '要開始新遊戲嗎？': 'Start a new game?', '目前進行中的遊戲（第 {0} 個月）會被覆蓋，無法復原。': 'Your current game (month {0}) will be overwritten and cannot be recovered.',
    '覆蓋並開始新遊戲': 'Overwrite & start new', '取消': 'Cancel',
    '🎯 目標': '🎯 Goal', '在 120 個月（10 年）內，把淨資產提高到模式目標。淨資產 = 現金 + 股票 + 比特幣 + 基金 + 房產市值 − 所有借款。淨資產歸零就破產。': 'Within 120 months (10 years), grow your net worth to the mode\'s goal. Net worth = cash + stocks + Bitcoin + funds + property value − all debt. Hit zero and you\'re bankrupt.',
    '🔄 每個月': '🔄 Each Month', '先看「本月新聞」與情緒指標，決定要買還是賣。': 'Read this month\'s news and the sentiment gauge, then decide whether to buy or sell.',
    '按「下一個月」後，價格依新聞與市場變化，並結算股利、租金、利息、薪資。': 'Press "Next Month": prices move with the news and market, and dividends, rent, interest and salary are settled.',
    '每月會自動存入儲蓄，每年加薪 3%、年底有獎金，偶爾會有突發支出或意外之財。': 'Savings are added every month, with a 3% raise each year and a year-end bonus, plus the occasional surprise expense or windfall.',
    '💹 四大資產': '💹 Four Asset Classes',
    '<b>股票</b>：七家虛構公司，各有產業與個性；每季配息。手續費買 0.2%、賣 0.45%。': '<b>Stocks</b>: seven fictional companies, each with its own sector and personality; dividends every quarter. Fees: 0.2% to buy, 0.45% to sell.',
    '<b>比特幣</b>：波動最大，牛熊分明，買賣各 0.5%。': '<b>Bitcoin</b>: the most volatile, with clear bull and bear cycles; 0.5% each way.',
    '<b>房地產</b>：每月收租，可用七成房貸，但買賣成本高（3%／4%），也可能空租。': '<b>Real estate</b>: monthly rent and 70% mortgages, but high trading costs (3% / 4%) and occasional vacancies.',
    '<b>基金</b>：從貨幣型到成長型，風險與費用各不同；指數基金等於一籃子買進七檔股票。': '<b>Funds</b>: from money-market to growth funds with different risks and fees; the index fund holds all seven stocks.',
    '📰 新聞與情報': '📰 News & Tips', '每月 1～3 則新聞，約 6～8 成會成真；落空時市場常反向小幅波動。可花 {0} 元買「內線情報」確認本月消息真偽。': '1–3 news items per month; about 60–80% come true, and when they don\'t the market often drifts the other way. Spend NT${0} on an "insider tip" to confirm whether this month\'s news is real.',
    '⚠️ 槓桿與追繳': '⚠️ Leverage & Margin Calls', '可抵押股票、比特幣、基金向券商借款（上限 50%）。當借款／證券市值超過 70%，會被強制賣出持股。': 'Pledge stocks, Bitcoin and funds to borrow from your broker (up to 50%). If loan ÷ securities exceeds 70%, holdings are sold by force.',
    '🎨 顏色': '🎨 Colors', '採用台灣習慣：{0}、{1}。': 'Taiwan convention: {0}, {1}.', '紅色上漲': 'red = up', '綠色下跌': 'green = down',
    '💾 存檔與重新開始': '💾 Saving & Restarting',
    '遊戲每個動作後自動存在你的瀏覽器（localStorage），重新整理（F5）不會重來，會從上次進度繼續；換裝置或清除瀏覽資料會消失。想重玩請按右上角「新遊戲」。': 'The game autosaves in your browser (localStorage) after every action. Refreshing (F5) does NOT restart — you continue where you left off. Switching devices or clearing browser data erases it. To replay, press "New Game" at the top right.',
    '所有公司、新聞、價格皆為虛構模擬，僅供娛樂與教育，不構成投資建議。': 'All companies, news and prices are fictional simulations for entertainment and education only — not investment advice.',
    '開始玩': 'Let\'s play',

    /* ===== 交易視窗 ===== */
    '買進數量（{0}）': 'Quantity to buy ({0})', '25% 現金': '25% of cash', '50% 現金': '50% of cash', '全部現金': 'All cash',
    '投入金額（元）': 'Amount to invest (NT$)', '賣出數量（{0}）': 'Quantity to sell ({0})', '全部': 'All', '賣出比例（%）': 'Percent to sell (%)',
    '買進 {0}': 'Buy {0}', '賣出 {0}': 'Sell {0}', '現價 {0}　可用現金 {1}': 'Price {0} · Cash {1}', '　持有 {0}': ' · Holding {0}',
    '使用房貸（七成，利率 {0}）': 'Use a mortgage (70%, rate {0})', '輸入數量後會顯示預估結果。': 'Enter an amount to preview the result.',
    '確認買進': 'Confirm Buy', '確認賣出': 'Confirm Sell', '（含手續費／稅費 {0}）': ' (incl. fees/taxes {0})',

    /* ===== 提示與結算 ===== */
    '🏆 解鎖成就：{0}': '🏆 Achievement unlocked: {0}',
    '第 {0} 月　大盤 {1}': 'Month {0} · Market {1}', '已快轉到第 {0} 月，淨資產 {1}': 'Skipped to month {0}, net worth {1}',
    '追繳保證金！': 'Margin Call!', '你的借款占證券市值的比例過高，券商已強制賣出部分持股並償還借款。槓桿是雙面刃，下次記得留點緩衝。': 'Your loan is too large relative to your securities, so your broker force-sold part of your holdings to repay it. Leverage cuts both ways — keep a buffer next time.',
    '我知道了': 'Got it', '達成目標！': 'Goal Reached!',
    '你的淨資產已突破 {0}。要見好就收，還是繼續挑戰更高的成績？遊戲會繼續到第 120 個月，最終成績看那時的淨資產。': 'Your net worth has passed {0}. Cash out, or push for a higher score? The game runs to month 120 and your final score is your net worth then.',
    '繼續挑戰': 'Keep going',
    '遊戲開始！先看看本月新聞，再決定怎麼布局。': 'Game on! Read this month\'s news, then decide how to position.',
    '已複製成績，貼到社群分享吧！': 'Result copied — paste it to share!', '無法複製，請手動複製。': 'Could not copy — please copy manually.',
    '我在《我愛操盤手》（{0}）玩了 {1} 個月，最終淨資產 {2}，稱號「{3}」！你也來挑戰：{4}': 'I played "I Love Trading" ({0}) for {1} months and finished with {2} net worth — title: "{3}"! Try it yourself: {4}',
    '你破產了': 'You went bankrupt', '目標 {0}（達成率 {1}%）': 'Goal {0} ({1}% reached)', '稱號：{0}': 'Title: {0}', '遊戲月數': 'Months played', '關閉': 'Close', '複製成績分享': 'Copy result to share',
    '廣告': 'Advertisement',

    /* ===== 引擎訊息 ===== */
    '本月已經買過情報了。': 'You already bought a tip this month.', '現金不足，無法購買情報。': 'Not enough cash for a tip.', '已取得內線情報，本月消息真偽已揭曉。': 'Insider tip acquired — this month\'s news has been verified.',
    '⚠️ 追繳保證金！融資維持率不足，券商強制賣出部分持股並償還借款。': '⚠️ Margin call! Your margin ratio was too low, so your broker force-sold holdings to repay the loan.',
    '現金不足，已自動賣出部分資產補足。': 'Not enough cash — some assets were sold automatically to cover it.', '現金不足且無資產可賣，差額轉為借款。': 'Not enough cash and nothing left to sell — the shortfall became a loan.',
    '📰 消息成真：{0:e}': '📰 News came true: {0:e}', '📰 消息落空：{0:e}': '📰 News fizzled: {0:e}',
    '💰 領到股利 {0:m}': '💰 Dividends received {0:m}', '🏠 收租 {0:m}（扣除持有成本與房貸利息後淨 {1:m}）': '🏠 Rent {0:m} ({1:m} after holding costs and mortgage interest)',
    '📈 新的一年，月儲蓄提高為 {0:m}': '📈 New year — monthly savings rise to {0:m}', '🎁 年終獎金 {0:m}': '🎁 Year-end bonus {0:m}',
    '💸 突發支出：{0:t} -{1:m}': '💸 Unexpected expense: {0:t} -{1:m}', '🍀 意外之財：{0:t} +{1:m}': '🍀 Windfall: {0:t} +{1:m}',
    '請輸入大於 0 的數字。': 'Enter a number greater than 0.', '找不到這檔股票。': 'Stock not found.', '至少要 1 股。': 'At least 1 share.',
    '現金不足，需要 {0:m}。': 'Not enough cash — need {0:m}.', '買進 {0} 股，共花費 {1:m}': 'Bought {0} shares for {1:m}', '持股不足。': 'Not enough shares.', '賣出 {0} 股，入帳 {1:m}': 'Sold {0} shares, received {1:m}',
    '現金不足。': 'Not enough cash.', '投入 {0:m}，買到 {1} 枚': 'Invested {0:m} for {1} BTC', '沒有持有比特幣。': 'You hold no Bitcoin.', '賣出 {0} 枚，入帳 {1:m}': 'Sold {0} BTC, received {1:m}',
    '找不到這檔基金。': 'Fund not found.', '申購 {0:m}，取得 {1} 單位': 'Subscribed {0:m} for {1} units', '沒有持有這檔基金。': 'You hold none of this fund.', '贖回 {0} 單位，入帳 {1:m}': 'Redeemed {0} units, received {1:m}',
    '找不到這項房產。': 'Property not found.', '至少要 1 間。': 'At least 1 unit.', '現金不足，需要 {0:m}（含 3% 稅費）。': 'Not enough cash — need {0:m} (incl. 3% fees).',
    '買進 {0} 間，現金支出 {1:m}': 'Bought {0} unit(s), cash out {1:m}', '，房貸 {0:m}': ', mortgage {0:m}', '持有數量不足。': 'Not enough units.', '賣出後仍不足以清償房貸，無法成交。': 'Sale proceeds would not cover the mortgage — order rejected.',
    '賣出 {0} 間，扣除房貸與 4% 費用後入帳 {1:m}': 'Sold {0} unit(s); {1:m} received after mortgage and 4% costs', '未知的交易類型。': 'Unknown trade type.',
    '請輸入借款金額。': 'Enter a loan amount.', '超過可借額度，目前最多可借 {0:m}（以股票、比特幣、基金為擔保，上限 50%）。': 'Over your limit — you can borrow up to {0:m} (secured by stocks, Bitcoin and funds, 50% cap).',
    '已借款 {0:m}': 'Borrowed {0:m}', '請輸入還款金額。': 'Enter a repayment amount.', '已還款 {0:m}': 'Repaid {0:m}',
    '破產': 'Bankrupt', '帳戶歸零，但別氣餒，市場永遠有下一次機會。': 'Your account hit zero, but don\'t give up — the market always offers another chance.',

    /* ===== 模式 ===== */
    '輕鬆模式': 'Easy', '資金充裕': 'Well funded', '起始資金 300 萬，每月可存 4 萬，目標 1,800 萬。適合第一次玩。': 'Start with NT$3M, save NT$40K/month, goal NT$18M. Great for your first run.',
    '一般模式': 'Normal', '推薦': 'Recommended', '起始資金 150 萬，每月可存 2.5 萬，目標 2,200 萬。': 'Start with NT$1.5M, save NT$25K/month, goal NT$22M.',
    '困難模式': 'Hard', '小資翻身': 'Underdog', '起始資金 60 萬，每月可存 1.5 萬，目標 1,000 萬。': 'Start with NT$600K, save NT$15K/month, goal NT$10M.',

    /* ===== 股票 / 資產 ===== */
    '芯鼎半導體': 'CoreChip Semiconductor', '晶圓代工龍頭，業績跟著 AI 與景氣走，波動偏大。': 'A leading chip foundry; earnings follow AI demand and the economy, with fairly large swings.',
    '宏圖電腦': 'Grandview Computers', '品牌電腦與伺服器廠，景氣循環明顯。': 'PC and server maker with a clear business cycle.',
    '穩盛金控': 'SteadyRise Financial', '大型金控，配息穩定，利率上升時獲利較佳。': 'Large financial group with steady dividends; profits improve when rates rise.',
    '海運飛航': 'Seawing Shipping', '貨櫃航運，運價一飆就大賺、一崩就大虧。': 'Container shipping — big profits when freight rates spike, big losses when they crash.',
    '康福生技': 'WellBridge Biotech', '新藥研發公司，不配息，一則臨床消息就可能暴漲暴跌。': 'Drug developer that pays no dividend; one clinical headline can send it soaring or plunging.',
    '民生食品': 'Everyday Foods', '民生必需品，景氣再差也要吃飯，走勢穩健。': 'Consumer staples — people eat in any economy, so it moves steadily.',
    '綠能電力': 'GreenWatt Power', '電力與再生能源，受油價與政策補貼影響。': 'Power and renewables, driven by oil prices and policy subsidies.',
    '科技': 'Tech', '金融': 'Finance', '航運': 'Shipping', '生技': 'Biotech', '民生': 'Consumer', '能源': 'Energy',
    '比特幣 BTC': 'Bitcoin BTC', '全年無休的加密資產，波動極大，牛熊週期明顯。': 'A crypto asset that never sleeps — extremely volatile with clear bull and bear cycles.',
    '市區車位': 'City Parking Space', '總價低、好入門，租金穩定但成長有限。': 'Low price and easy entry; stable rent but limited growth.',
    '捷運套房': 'Metro Studio', '單身租客的最愛，出租率高。': 'A favorite of single renters, with high occupancy.',
    '小家庭公寓': 'Family Apartment', '剛需族群需求大，景氣好時漲幅可觀。': 'Strong demand from first-time buyers; can rise a lot in good times.',
    '商圈店面': 'Retail Storefront', '租金較高，但景氣差時容易空租，價格也較敏感。': 'Higher rent, but prone to vacancies and price swings in a downturn.',
    '商辦大樓樓層': 'Office Tower Floor', '總價最高，景氣循環性最強。': 'The highest price tag and the most cyclical.',
    '貨幣市場基金': 'Money Market Fund', '類似活存加強版，報酬跟著利率走，幾乎不會虧。': 'A souped-up savings account; returns follow interest rates and it almost never loses money.',
    '穩健債券基金': 'Stable Bond Fund', '利率下降時上漲，利率上升時下跌。大跌時常有避險效果。': 'Rises when rates fall and drops when rates rise; often a safe haven in a crash.',
    '大盤指數基金': 'Market Index Fund', '一籃子買進本遊戲的七檔股票，費用低、配息自動再投入。': 'Holds all seven stocks in this game; low fees and dividends are reinvested automatically.',
    '全球科技成長基金': 'Global Tech Growth Fund', '主動式基金，偏重科技，經理費較高，不一定打敗大盤。': 'An actively managed tech-heavy fund with higher fees — it won\'t always beat the market.',
    '高股息收益基金': 'High Dividend Income Fund', '偏愛配息股，大跌時抗跌，大漲時漲得比較少。': 'Favors dividend payers — resilient in crashes, but lags in rallies.',
    '極低': 'Very low', '低': 'Low', '中': 'Medium', '中高': 'Medium-high', '中低': 'Medium-low',
    '房市熱絡': 'Hot', '房市持平': 'Flat', '房市低迷': 'Weak',

    /* ===== 個人事件 ===== */
    '牙齒治療': 'Dental treatment', '家電壞掉換新': 'Replacing a broken appliance', '朋友結婚包紅包': 'Wedding gift for a friend', '出國旅遊': 'Overseas trip', '機車被撞、修車': 'Scooter accident repairs', '父母看病花費': 'Parents\' medical bills',
    '發票中獎': 'Won the receipt lottery', '接案外快': 'Freelance side income', '退稅': 'Tax refund', '績效獎金': 'Performance bonus',

    /* ===== 成就 ===== */
    '第一桶金': 'First Big Gain', '淨資產超過起始資金 20%': 'Net worth is 20% above starting cash',
    '雞蛋不放一籃': 'Don\'t Put All Eggs in One Basket', '同時持有股票、比特幣、房地產、基金': 'Hold stocks, Bitcoin, real estate and funds at once',
    '包租公／婆': 'Landlord', '同時持有 3 間以上的房地產': 'Own 3 or more properties at once',
    '比特幣信仰': 'Bitcoin Believer', '比特幣部位市值超過 500 萬': 'Hold over NT$5M of Bitcoin',
    '槓桿初體驗': 'First Taste of Leverage', '第一次向券商借錢': 'Borrow from your broker for the first time',
    '壯士斷腕': 'Cut Your Losses', '虧損 20% 以上賣出一檔持股': 'Sell a stock at a loss of 20% or more',
    '躲過崩盤': 'Dodged the Crash', '大盤單月重挫 8% 以上時，持有 70% 以上現金': 'Hold 70%+ cash during an 8%+ monthly market drop',
    '大難不死': 'Survivor', '經歷追繳保證金並存活': 'Survive a margin call',
    '千萬富翁': 'Ten-Million Club', '淨資產達到 1,000 萬': 'Reach NT$10M net worth',
    '達成目標': 'Goal Achieved', '淨資產達到模式目標': 'Reach the mode\'s net-worth goal',
    '十年磨一劍': 'A Decade of Grinding', '完整玩完 10 年（120 個月）': 'Play the full 10 years (120 months)',
    '十倍奇蹟': 'The 10x Miracle', '淨資產達到起始資金的 10 倍': 'Reach 10x your starting cash',

    /* ===== 稱號 ===== */
    '韭菜': 'Fresh Leek', '市場教了你一課，下次一定會更好。': 'The market taught you a lesson — you\'ll do better next time.',
    '小散戶': 'Small Retail Trader', '有賺有賠，繼續累積經驗。': 'Some wins, some losses — keep building experience.',
    '穩健投資人': 'Steady Investor', '穩穩累積，距離目標只差一步。': 'Slow and steady — just one step from the goal.',
    '專業操盤手': 'Pro Trader', '達成目標，操盤功力令人佩服。': 'Goal reached — impressive trading skills.',
    '華爾街之狼': 'Wolf of Wall Street', '遠遠超出預期，風控與膽識兼備。': 'Far beyond expectations, with nerve and risk control to match.',
    '股神': 'Market Legend', '傳奇等級的成績，請去買張樂透。': 'Legendary results — go buy a lottery ticket.',

    /* ===== 新聞事件 ===== */
    '央行意外降息': 'Central bank surprises with a rate cut', '中央銀行宣布降息一碼，市場資金行情升溫。': 'The central bank cuts rates by 25 bp and liquidity-driven buying heats up.',
    '央行宣布升息': 'Central bank raises rates', '為抑制通膨，央行升息一碼，資金成本上升。': 'To fight inflation, the central bank hikes by 25 bp and funding costs rise.',
    '通膨數據超乎預期': 'Inflation comes in hotter than expected', '物價指數創近年新高，市場擔心央行加速緊縮。': 'Consumer prices hit a multi-year high and markets fear faster tightening.',
    '經濟成長優於預期': 'Economic growth beats expectations', '本季 GDP 與出口訂單雙雙亮眼。': 'Both quarterly GDP and export orders are strong.',
    '景氣衰退疑慮升溫': 'Recession fears grow', '製造業採購經理人指數連續萎縮。': 'The manufacturing PMI keeps contracting.',
    'AI 晶片需求暴增': 'AI chip demand surges', '雲端大廠擴大資本支出，晶片供不應求。': 'Cloud giants expand capex and chips are in short supply.',
    '晶片出口管制擴大': 'Chip export controls widen', '主要國家宣布新一輪晶片出口限制。': 'Major countries announce a new round of chip export limits.',
    '航運運價大漲': 'Freight rates soar', '紅海繞道與缺櫃，貨櫃運價一週暴漲。': 'Rerouting and a container shortage send freight rates up sharply in a week.',
    '港口塞港紓解、運價崩跌': 'Port congestion clears, freight rates crash', '運力過剩，貨櫃運價快速回落。': 'Overcapacity sends container rates tumbling.',
    '新藥臨床三期傳出好消息': 'Phase 3 drug trial looks promising', '康福生技的主力新藥臨床試驗數據傳出理想。': 'Data from WellBridge Biotech\'s lead drug trial reportedly looks great.',
    '新藥臨床試驗未達標': 'Drug trial misses its target', '生技族群新藥臨床結果不如預期。': 'Biotech trial results fall short of expectations.',
    '國際油價大漲': 'Oil prices jump', '產油國宣布擴大減產。': 'Oil producers announce deeper output cuts.',
    '國際油價崩跌': 'Oil prices collapse', '需求疲弱疊加增產，油價重挫。': 'Weak demand plus higher output hammer oil prices.',
    '綠能補貼法案過關': 'Green energy subsidy bill passes', '政府加碼再生能源補助與躉購費率。': 'The government boosts renewable subsidies and feed-in tariffs.',
    '銀行業獲利創新高': 'Banks post record profits', '利差擴大與手續費收入帶動金融股。': 'Wider margins and fee income lift financial stocks.',
    '金融業爆發弊案': 'Financial scandal erupts', '大型金控爆出違規放款，市場信心動搖。': 'A major financial group is caught in improper lending, shaking confidence.',
    '比特幣現貨 ETF 傳出將獲核准': 'Spot Bitcoin ETF rumored to get approval', '監管機關審查進入最後階段。': 'Regulators are reportedly in the final stage of review.',
    '大型加密交易所傾倒': 'Major crypto exchange collapses', '交易所暫停提領，加密市場恐慌。': 'The exchange halts withdrawals and crypto markets panic.',
    '多國加強加密貨幣監管': 'Countries tighten crypto regulation', '監管趨嚴，市場擔心資金流出。': 'Stricter rules raise fears of capital outflows.',
    '機構大戶大舉買進比特幣': 'Institutions pile into Bitcoin', '鏈上數據顯示巨鯨持續吸籌。': 'On-chain data shows whales steadily accumulating.',
    '比特幣減半效應發酵': 'Bitcoin halving effect kicks in', '供給減少預期推升價格。': 'Expectations of reduced supply push prices up.',
    '政府推出打房新政': 'Government launches housing cooling measures', '祭出貸款管制與重稅，抑制投機炒作。': 'Loan limits and heavy taxes target speculation.',
    '青年購屋補貼上路': 'Youth home-buying subsidy takes effect', '利息補貼與頭期款協助提高剛需買盤。': 'Interest and down-payment support boosts first-time buyer demand.',
    '捷運新線通車': 'New metro line opens', '沿線生活圈機能提升，買盤湧入。': 'Neighborhoods along the line improve and buyers rush in.',
    '銀行推出房貸優惠': 'Banks roll out mortgage deals', '多家銀行搶客，首購族貸款成本下降。': 'Banks compete for customers and first-time buyers\' loan costs fall.',
    '都市更新計畫公布': 'Urban renewal plan announced', '老舊社區改建題材發酵。': 'Redevelopment of older neighborhoods fuels excitement.',
    '商辦空置率攀升': 'Office vacancy rate climbs', '企業縮編與遠距上班，租賃需求降溫。': 'Downsizing and remote work cool leasing demand.',
    '地緣政治緊張升高': 'Geopolitical tensions rise', '區域衝突擴大，避險情緒濃厚。': 'A regional conflict widens and risk aversion spikes.',
    '貿易協議簽署': 'Trade deal signed', '關稅調降，出口產業受惠。': 'Tariffs fall and exporters benefit.',
    '強颱來襲': 'Strong typhoon hits', '港口停工、消費活動減少。': 'Ports shut down and consumer activity drops.',
    '政府發放消費券': 'Government hands out spending vouchers', '振興方案帶動內需。': 'The stimulus plan lifts domestic demand.',
    '全球股市恐慌性修正': 'Global stocks plunge in panic', '槓桿部位被迫平倉，波動指數飆升。': 'Leveraged positions are forced out and the volatility index spikes.',
    '大盤創歷史新高': 'Market hits an all-time high', '資金行情推升指數，市場情緒樂觀。': 'A liquidity rally lifts the index and sentiment is upbeat.',
    '外資大舉買超': 'Foreign investors buy heavily', '外資連續買超，資金湧入權值股。': 'Foreign funds keep buying and pour into blue chips.',
    '外資大舉賣超': 'Foreign investors sell heavily', '外資連日賣超，匯率同步貶值。': 'Days of foreign selling also weigh on the currency.',
    '財報季普遍亮眼': 'Earnings season impresses', '多數公司財報優於預期。': 'Most companies beat expectations.',
    '財報季令人失望': 'Earnings season disappoints', '企業下修展望，法人調降目標價。': 'Companies cut guidance and analysts lower targets.',
    '食品原料大漲': 'Food ingredient prices spike', '成本壓力讓食品業毛利下滑。': 'Cost pressure squeezes food-industry margins.',
    '新型病毒疫情擴散': 'New virus outbreak spreads', '市場擔憂經濟活動受限，防疫概念股走強。': 'Markets worry about restrictions, while health-related stocks rally.',
    '央行總裁暗示維持寬鬆': 'Central bank chief hints at easy policy', '談話偏鴿派，市場解讀為利多。': 'Dovish remarks are read as bullish.',
    '美元指數強勢走升': 'US dollar index strengthens', '資金回流美元資產，新興市場承壓。': 'Money flows back to dollar assets and emerging markets feel the pressure.',
    '科技大廠宣布裁員': 'Tech giant announces layoffs', '成本控管下，市場擔心需求放緩。': 'Cost cutting raises fears of slowing demand.',
    '能源危機': 'Energy crisis', '供應中斷讓電價與油價同步飆升。': 'Supply disruptions push power and oil prices up together.',
    '全球央行聯手救市': 'Central banks launch coordinated rescue', '大規模流動性挹注，風險資產全面反彈。': 'Massive liquidity injections spark a broad rebound in risk assets.',
    '金融海嘯警報': 'Financial crisis alarm', '大型機構傳出流動性危機，全球金融市場動盪。': 'A major institution reportedly faces a liquidity crisis, rattling global markets.',
    '市場平靜無波': 'Markets are calm', '本月沒有重大消息，盤勢以個股表現為主。': 'No major news this month; individual stocks drive the action.',
    '投資人觀望氣氛濃厚': 'Investors stay on the sidelines', '成交量縮小，資金靜待下一個催化劑。': 'Volume shrinks as money waits for the next catalyst.'
  };

  const I = { lang: 'zh', EN: EN };
  function pctFmt(v) { return v; }

  I.money = function (n) {
    const a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (I.lang === 'en') {
      if (a >= 1e9) return sg + 'NT$' + (a / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return sg + 'NT$' + (a / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return sg + 'NT$' + (a / 1e3).toFixed(1) + 'K';
      return sg + 'NT$' + Math.round(a);
    }
    if (a >= 1e8) return sg + (a / 1e8).toFixed(2) + ' 億';
    if (a >= 1e4) return sg + (a / 1e4).toFixed(1) + ' 萬';
    return sg + Math.round(a).toLocaleString('en-US');
  };

  I.t = function (key, params) {
    let s = key;
    if (I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key)) s = EN[key];
    if (!params) return s;
    return s.replace(/\{(\d+)(?::([a-z]))?\}/g, function (m, i, f) {
      const v = params[+i];
      if (v == null) return '';
      if (f === 'm') return I.money(v);
      if (f === 'e') { const ev = (root.GAME_DATA.EVENTS || []).find(function (e) { return e.id === v; }); return ev ? I.t(ev.t) : String(v); }
      if (f === 't') return I.t(v);
      return String(v);
    });
  };

  I.setLang = function (l) {
    I.lang = l === 'en' ? 'en' : 'zh';
    try { localStorage.setItem('wacp_lang', I.lang); } catch (e) { /* 忽略 */ }
  };

  (function init() {
    let l = null;
    try {
      const m = /[?&]lang=(zh|en)\b/.exec(location.search);
      if (m) l = m[1];
      if (!l) l = localStorage.getItem('wacp_lang');
    } catch (e) { /* 忽略 */ }
    if (!l) l = /^zh/i.test(navigator.language || 'zh') ? 'zh' : 'en';
    I.lang = l === 'en' ? 'en' : 'zh';
    try { localStorage.setItem('wacp_lang', I.lang); } catch (e) { /* 忽略 */ }
  })();

  root.I18N = I;
  if (typeof module !== 'undefined' && module.exports) module.exports = I;
})(typeof window !== 'undefined' ? window : globalThis);
