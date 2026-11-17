/* 搶救 AI 教父大作戰 - 關卡資料（人物、公司與情節純屬虛構）
   每一關由多個「區塊」左右拼接而成。符號：
   # 地面  = 磚塊  - 單向平台  ^ 尖刺  ~ 過熱地板  C 輸送帶  ? 補給箱  L 雷射
   c 算力晶片  s 股權碎片  H 愛心  J 彈簧  K 存檔點  G 終點  P 起點
   E 巡邏敵人  F 飛行敵人  T 投擲敵人  M 橫移平台  V 升降平台  B 魔王 */
(function (root) {
  'use strict';
  const R = 12;
  function mk(w, rows) {
    const g = [];
    for (let r = 0; r < R; r++) {
      let s = rows[r] != null ? rows[r] : (r >= 10 ? '#'.repeat(w) : '');
      s = s.replace(/\./g, ' ');
      g.push((s + ' '.repeat(w)).slice(0, w));
    }
    return g;
  }
  const CH = {
    start:   mk(10, { 9: '..P.......' }),
    flat:    mk(10, { 8: '...ccc....' }),
    walker:  mk(14, { 8: '....c.c.c.....', 9: '.........E....' }),
    walker2: mk(16, { 8: '..c..........c..', 9: '.....E....E.....' }),
    pit:     mk(12, { 7: '.....cc.....', 8: '....c..c....', 10: '####...#####', 11: '####...#####' }),
    pit2:    mk(16, { 7: '.......cc.......', 8: '.......--.......', 10: '####........####', 11: '####........####' }),
    pitShare:mk(14, { 7: '......s.......', 10: '#####...######', 11: '#####...######' }),
    steps:   mk(14, { 6: '.........s....', 7: '.........=....', 8: '......=.......', 9: '...=......E...' }),
    spikes:  mk(12, { 7: '....cc..cc..', 9: '....^^..^^..' }),
    drone:   mk(14, { 6: '......F.......', 8: '...c..c..c....' }),
    drones:  mk(16, { 5: '....F.....F.....', 8: '..c...c...c...c.' }),
    turret:  mk(14, { 7: '....c.........', 8: '....=.........', 9: '...........T..' }),
    spring:  mk(12, { 3: '...c........', 4: '......c.s...', 5: '......---...', 9: '...J........' }),
    movers:  mk(18, { 7: '.....c..c..c......', 8: '.....M............', 10: '####..........####', 11: '####..........####' }),
    vert:    mk(12, { 4: '.......sc...', 5: '.......==...', 9: '....V.......' }),
    conveyor:mk(14, { 7: '....c...c.....', 9: '......^.......', 10: '###CCCCCCCC###' }),
    laser:   mk(12, { 5: '.....L......', 6: '..c..L..c...', 7: '.....L......', 8: '.....L......', 9: '.....L......' }),
    heat:    mk(14, { 6: '.........c....', 7: '.....cc..--...', 8: '.....--.......', 10: '###~~~~~~~~###' }),
    check:   mk(8,  { 9: '...K....' }),
    heart:   mk(8,  { 8: '...H....' }),
    crates:  mk(12, { 8: '....?.......', 9: '...??...?...' }),
    shelf:   mk(12, { 5: '.....s......', 6: '....---.....', 8: '.--.........' }),
    goal:    mk(12, { 9: '.......G....' }),
    boss:    mk(26, { 6: '.....---........---.......', 9: '....................B.....' })
  };
  const LEVELS = [
    { name: '夜市突圍', theme: 'market', tip: '← → 移動，空白鍵跳躍，X 丟晶片。踩在敵人頭上也能打倒他們。',
      seq: ['start', 'flat', 'walker', 'pit', 'steps', 'spikes', 'check', 'crates', 'pitShare', 'walker', 'spring', 'flat', 'goal'] },
    { name: '機場追逐', theme: 'airport', tip: '輸送帶會把你往前推；狗仔無人機可以用晶片打下來。',
      seq: ['start', 'conveyor', 'drone', 'pit2', 'check', 'walker', 'vert', 'turret', 'movers', 'steps', 'drone', 'check', 'pitShare', 'goal'] },
    { name: '無塵室潛入', theme: 'fab', tip: '雷射會一開一關，看準熄滅的瞬間通過。',
      seq: ['start', 'laser', 'walker', 'movers', 'check', 'turret', 'spring', 'spikes', 'laser', 'vert', 'check', 'pit2', 'drone', 'shelf', 'goal'] },
    { name: '資料中心過熱', theme: 'dc', tip: '發紅的地板溫度過高，踩到會受傷，請走上方的平台。',
      seq: ['start', 'heat', 'drone', 'conveyor', 'check', 'laser', 'heat', 'steps', 'turret', 'movers', 'check', 'spring', 'heat', 'drones', 'pitShare', 'goal'] },
    { name: '股市大廳', theme: 'stock', tip: '空頭熊會丟出利空新聞，跳過去或用晶片反擊。',
      seq: ['start', 'turret', 'pit2', 'drone', 'vert', 'check', 'movers', 'spikes', 'turret', 'laser', 'check', 'shelf', 'conveyor', 'heat', 'steps', 'walker2', 'goal'] },
    { name: '總部頂樓決戰', theme: 'roof', tip: '魔王砸到地面後會暫時當機，那是攻擊的最好時機！',
      seq: ['start', 'spikes', 'drone', 'pit', 'check', 'spring', 'turret', 'pitShare', 'check', 'shelf', 'heart', 'boss'] }
  ];
  function build(i) {
    const L = LEVELS[i], rows = []; for (let r = 0; r < R; r++) rows.push('');
    L.seq.forEach(function (k) { const c = CH[k]; if (!c) throw new Error('unknown chunk ' + k); for (let r = 0; r < R; r++) rows[r] += c[r]; });
    return { name: L.name, theme: L.theme, tip: L.tip, rows: rows, w: rows[0].length, h: R };
  }
  root.AIG_LEVELS = { count: LEVELS.length, build: build, names: LEVELS.map(function (l) { return l.name; }), R: R };
})(typeof window !== 'undefined' ? window : globalThis);
