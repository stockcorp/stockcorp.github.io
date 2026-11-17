/* 搶救 AI 教父大作戰 - 遊戲主程式（人物、公司與情節純屬虛構，如有雷同純屬巧合）*/
(function (root) {
  'use strict';
  const LV = root.AIG_LEVELS, W = 960, H = 540, TS = 45, R = LV.R;
  const cv = document.getElementById('game'), c = cv.getContext('2d');
  const SAVE_KEY = 'aig_save_v1';
  const Lg = (zh, en) => (root.SC && root.SC.lang === 'en') ? en : zh;
  const TAU = Math.PI * 2, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 存檔 ---------- */
  const UPG = [
    { id: 'dj', name: '二段跳', nameEn: 'Double Jump', desc: '在空中可以再跳一次', descEn: 'Jump once more in mid-air', cost: 30, max: 1 },
    { id: 'magnet', name: '算力磁鐵', nameEn: 'Chip Magnet', desc: '自動吸引附近的算力晶片', descEn: 'Pulls in nearby compute chips', cost: 30, max: 1 },
    { id: 'rapid', name: '晶片連發', nameEn: 'Rapid Fire', desc: '丟晶片的速度加倍', descEn: 'Throw chips twice as fast', cost: 40, max: 1 },
    { id: 'shield', name: '散熱護盾', nameEn: 'Cooling Shield', desc: '每次重生可抵擋一次傷害', descEn: 'Blocks one hit after each respawn', cost: 50, max: 1 },
    { id: 'hp', name: '強化體力', nameEn: 'Extra Heart', desc: '生命上限 +1（最多買 2 次）', descEn: '+1 max health (buy up to 2)', cost: 45, max: 2 }
  ];
  function freshSave() { return { coins: 0, upg: {}, lv: [], unlocked: 1, mute: false, seenStory: false, ended: false }; }
  let SV = freshSave();
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.lv) SV = Object.assign(freshSave(), s); } catch (e) { /* 忽略 */ }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) { /* 忽略 */ } }
  const lvSave = i => SV.lv[i] || (SV.lv[i] = { done: false, stars: 0, shares: [false, false, false], best: 0 });
  const totalShares = () => SV.lv.reduce((a, l) => a + (l ? l.shares.filter(Boolean).length : 0), 0);
  const upg = id => SV.upg[id] || 0;

  /* ---------- 音效（WebAudio 合成，不使用任何音檔）---------- */
  let AC = null;
  function beep(f, d, type, vol, slide) {
    if (SV.mute) return;
    try {
      AC = AC || new (root.AudioContext || root.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
    } catch (e) { /* 沒有音效也能玩 */ }
  }
  const SFX = {
    jump: () => beep(420, 0.16, 'square', 0.05, 1.8), coin: () => { beep(980, 0.07, 'square', 0.05); setTimeout(() => beep(1320, 0.1, 'square', 0.05), 60); },
    share: () => [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.08), i * 80)),
    hit: () => beep(180, 0.25, 'sawtooth', 0.08, 0.4), shoot: () => beep(700, 0.08, 'square', 0.04, 0.6), stomp: () => beep(260, 0.12, 'square', 0.07, 0.5),
    boom: () => beep(120, 0.4, 'sawtooth', 0.1, 0.3), win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'triangle', 0.09), i * 120)),
    click: () => beep(600, 0.05, 'square', 0.04), spring: () => beep(300, 0.25, 'square', 0.06, 3), check: () => { beep(660, 0.1, 'triangle', 0.07); setTimeout(() => beep(990, 0.18, 'triangle', 0.07), 90); }
  };

  /* ---------- 輸入 ---------- */
  const keys = {}, pressed = {};
  const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyX: 'shoot', KeyJ: 'shoot', KeyK: 'jump', Enter: 'ok', Escape: 'pause', KeyP: 'pause', KeyM: 'mute' };
  function setKey(k, v) { if (v && !keys[k]) pressed[k] = true; keys[k] = v; }
  root.addEventListener('keydown', e => { const k = MAP[e.code]; if (k) { setKey(k, true); e.preventDefault(); } });
  root.addEventListener('keyup', e => { const k = MAP[e.code]; if (k) { setKey(k, false); e.preventDefault(); } });
  document.querySelectorAll('[data-key]').forEach(b => {
    const k = b.getAttribute('data-key');
    const on = e => { e.preventDefault(); setKey(k, true); }, off = e => { e.preventDefault(); setKey(k, false); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  });
  let buttons = [], mouse = { x: -1, y: -1 };
  function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  cv.addEventListener('mousemove', e => { mouse = toCanvas(e); });
  cv.addEventListener('click', e => { const p = toCanvas(e); for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { SFX.click(); b.fn(); return; } } });

  /* ---------- 繪圖小工具 ---------- */
  function rr(x, y, w, h, r, fill, stroke, lw) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
  }
  function circ(x, y, r, fill, stroke, lw) { c.beginPath(); c.arc(x, y, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } }
  function text(s, x, y, size, col, align, bold, outline) {
    c.font = (bold === false ? '' : 'bold ') + size + 'px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'; c.textAlign = align || 'left'; c.textBaseline = 'middle';
    if (outline) { c.lineWidth = Math.max(3, size / 6); c.strokeStyle = outline; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = col || '#fff'; c.fillText(s, x, y);
  }
  function wrapText(s, x, y, maxW, size, col, lh) {
    c.font = size + 'px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = col;
    let line = '', yy = y;
    const toks = /[a-z]{2}/i.test(s) && s.indexOf(' ') >= 0 ? s.match(/\n|[^\s\n]+\s*/g) : Array.from(s);
    for (const ch of toks) { if (ch === '\n' || (line && c.measureText(line + ch).width > maxW)) { c.fillText(line, x, yy); yy += lh || size * 1.5; line = ch === '\n' ? '' : ch; } else line += ch; }
    if (line) c.fillText(line, x, yy); return yy;
  }
  function button(label, x, y, w, h, fn, opt) {
    opt = opt || {};
    const hot = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h, dis = opt.disabled;
    rr(x, y + 4, w, h, 12, 'rgba(0,0,0,.35)');
    rr(x, y + (hot && !dis ? 2 : 0), w, h, 12, dis ? '#4b5568' : (opt.color || '#f5b83d'), '#1b1400', 3);
    text(label, x + w / 2, y + h / 2 + (hot && !dis ? 2 : 0), opt.size || 20, dis ? '#9aa3b5' : (opt.tcol || '#1b1400'), 'center');
    if (!dis) buttons.push({ x, y, w, h, fn });
  }

  /* ---------- 主角：雷老大（原創角色）---------- */
  function drawHero(x, y, dir, t, o) {
    o = o || {};
    const run = o.run ? Math.sin(t * 16) : 0, air = o.air, sq = o.squash || 0;
    c.save(); c.translate(x, y); c.scale(dir * (1 + sq * 0.25), 1 - sq * 0.25);
    if (o.blink) c.globalAlpha = 0.45;
    // 風扇背包
    rr(-19, -34, 12, 22, 4, '#8a94a8', '#1b2233', 2);
    c.save(); c.translate(-13, -23); c.rotate(t * (o.run || air ? 26 : 8)); c.fillStyle = '#dfe6f3';
    for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.ellipse(0, -4, 2, 4, 0, 0, TAU); c.fill(); }
    c.restore();
    // 腳
    const la = air ? 0.5 : run * 0.7, lb = air ? -0.4 : -run * 0.7;
    [[-5, la], [5, lb]].forEach(p => { c.save(); c.translate(p[0], -12); c.rotate(p[1]); rr(-4, 0, 8, 13, 3, '#2456c9', '#1b2233', 2); rr(-5, 10, 11, 5, 2, '#30323a', '#1b2233', 1.5); c.restore(); });
    // 身體（工程師連身服）
    rr(-11, -36, 22, 26, 7, '#2f6fed', '#1b2233', 2);
    rr(-11, -20, 22, 4, 0, '#f5b83d'); rr(-3, -30, 8, 7, 2, '#dfe6f3', '#1b2233', 1.5);
    // 手
    c.save(); c.translate(6, -31); c.rotate(o.throwing ? -1.5 : (air ? -0.9 : -run * 0.8)); rr(-3, 0, 7, 14, 3, '#2f6fed', '#1b2233', 2); circ(0.5, 15, 4, '#ffd9b0', '#1b2233', 1.5); c.restore();
    // 頭
    circ(0, -46, 12, '#ffd9b0', '#1b2233', 2);
    c.beginPath(); c.arc(0, -48, 13, Math.PI, 0); c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = '#1b2233'; c.lineWidth = 2; c.stroke();
    rr(-14, -50, 30, 4, 2, '#ffd23f', '#1b2233', 2);
    rr(-7, -58, 14, 6, 3, '#9fe3ff', '#1b2233', 1.5); // 護目鏡
    const bl = (t % 3.2) < 0.12;
    if (bl) { c.fillStyle = '#1b2233'; c.fillRect(3, -45, 5, 2); } else circ(5.5, -44, 2.2, '#1b2233');
    c.strokeStyle = '#5b3a1e'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(2, -39); c.quadraticCurveTo(7, -36, 11, -40); c.stroke(); // 鬍子
    c.restore();
    if (o.shield) { c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 6); circ(x, y - 30, 34, null, '#7de3ff', 4); c.restore(); }
  }
  function drawChip(x, y, t, s) {
    const k = Math.abs(Math.cos(t * 4)) * 0.8 + 0.2; s = s || 1;
    c.save(); c.translate(x, y + Math.sin(t * 3) * 3); c.scale(k * s, s);
    c.fillStyle = '#8a6a12'; for (let i = -1; i <= 1; i++) { c.fillRect(-12, i * 6 - 1.5, 24, 3); c.fillRect(i * 6 - 1.5, -12, 3, 24); }
    rr(-9, -9, 18, 18, 3, '#ffd23f', '#6b4e00', 2); rr(-4, -4, 8, 8, 1, '#fff3b0');
    c.restore();
  }
  function drawShare(x, y, t, got) {
    c.save(); c.translate(x, y + Math.sin(t * 2.5) * 4); c.globalAlpha = got ? 0.35 : 1;
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, 'rgba(125,227,255,.7)'); g.addColorStop(1, 'rgba(125,227,255,0)'); c.fillStyle = g; c.fillRect(-30, -30, 60, 60);
    c.rotate(Math.sin(t * 2) * 0.15); c.beginPath(); c.moveTo(0, -17); c.lineTo(15, 0); c.lineTo(0, 17); c.lineTo(-15, 0); c.closePath(); c.fillStyle = '#7de3ff'; c.fill(); c.strokeStyle = '#0b3a55'; c.lineWidth = 2.5; c.stroke();
    text('%', 0, 1, 15, '#0b3a55', 'center'); c.restore();
  }

  /* ---------- 場景主題 ---------- */
  const TH = {
    market: { sky: ['#1b1440', '#4a2a6b'], ground: '#5a3d2b', top: '#e8a23a', deco: 'lantern', walker: 'cart' },
    airport: { sky: ['#6fb7ff', '#d6efff'], ground: '#5d6778', top: '#c9d3e3', deco: 'plane', walker: 'bag' },
    fab: { sky: ['#fff6d6', '#ffe9a8'], ground: '#b9c2d0', top: '#f4f7fb', deco: 'grid', walker: 'bot' },
    dc: { sky: ['#07111f', '#11263f'], ground: '#1d2a3d', top: '#3b82f6', deco: 'rack', walker: 'server' },
    stock: { sky: ['#101623', '#26324a'], ground: '#2b3346', top: '#f5b83d', deco: 'kline', walker: 'bear' },
    roof: { sky: ['#ff8a5b', '#3a2a6b'], ground: '#3b4256', top: '#8c96ad', deco: 'skyline', walker: 'guard' }
  };
  function drawBG(th, cam, t) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const d = th.deco, p1 = -(cam * 0.2) % 240, p2 = -(cam * 0.45) % 320;
    if (d === 'lantern') {
      for (let i = 0; i < 40; i++) circ((i * 97 + 30 - cam * 0.05) % W, (i * 53) % 220, 1.2, 'rgba(255,255,255,.7)');
      for (let x = p1 - 240; x < W + 240; x += 240) { c.fillStyle = '#2a1e55'; c.fillRect(x, 250, 150, 300); c.fillRect(x + 160, 300, 70, 240); c.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) c.fillRect(x + 15 + (i % 3) * 45, 270 + ((i / 3) | 0) * 60, 18, 24); }
      c.strokeStyle = '#3a2a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 110); for (let x = 0; x <= W; x += 20) c.lineTo(x, 110 + Math.sin((x + cam * 0.45) / 90) * 14); c.stroke();
      for (let x = p2 - 320; x < W + 320; x += 80) { const yy = 118 + Math.sin((x + cam * 0.45 + 10) / 90) * 14; rr(x - 11, yy, 22, 28, 9, (Math.round((x - p2) / 80) % 2) ? '#ff5b5b' : '#ffb03a', '#7a1f1f', 2); c.fillStyle = 'rgba(255,200,120,.18)'; c.beginPath(); c.arc(x, yy + 14, 34 + Math.sin(t * 3 + x) * 3, 0, TAU); c.fill(); }
    } else if (d === 'plane') {
      for (let i = 0; i < 5; i++) { const x = ((i * 260 - cam * 0.1 + t * 12) % (W + 300)) - 150, y = 60 + i * 38; c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x, y, 60, 16, 0, 0, TAU); c.ellipse(x + 40, y + 6, 40, 12, 0, 0, TAU); c.fill(); }
      const px = ((t * 60 - cam * 0.15) % (W + 400)) - 200; c.save(); c.translate(px, 150); rr(-50, -9, 100, 18, 9, '#fff', '#5d6778', 2); c.fillStyle = '#3b82f6'; c.beginPath(); c.moveTo(-10, 0); c.lineTo(-35, 28); c.lineTo(-18, 28); c.lineTo(12, 0); c.fill(); c.beginPath(); c.moveTo(-48, -6); c.lineTo(-62, -28); c.lineTo(-50, -28); c.lineTo(-36, -6); c.fill(); c.restore();
      for (let x = p2 - 320; x < W + 320; x += 320) { c.fillStyle = '#9fb3cf'; c.fillRect(x, 300, 260, 250); c.fillStyle = '#d6efff'; for (let i = 0; i < 5; i++) c.fillRect(x + 14 + i * 50, 320, 36, 110); }
    } else if (d === 'grid') {
      c.strokeStyle = 'rgba(180,150,60,.25)'; c.lineWidth = 1; for (let x = p1 - 240; x < W + 240; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let x = p2 - 320; x < W + 320; x += 320) { rr(x, 250, 200, 220, 10, '#e9edf3', '#9aa7b8', 3); circ(x + 100, 330, 46, '#bfe9ff', '#9aa7b8', 3); c.save(); c.translate(x + 100, 330); c.rotate(t * 0.8); rr(-34, -4, 68, 8, 3, '#7d8ba1'); c.restore(); }
    } else if (d === 'rack') {
      for (let x = p1 - 240; x < W + 240; x += 120) { rr(x, 140, 96, 400, 6, '#0d1a2b', '#1f3a5f', 2); for (let i = 0; i < 14; i++) { const on = Math.sin(t * 5 + i * 1.7 + x) > 0; c.fillStyle = on ? '#35e08a' : '#184a34'; c.fillRect(x + 12, 158 + i * 26, 8, 5); c.fillStyle = Math.sin(t * 3 + i + x * 0.3) > 0.4 ? '#3b82f6' : '#1a2f55'; c.fillRect(x + 26, 158 + i * 26, 56, 5); } }
    } else if (d === 'kline') {
      for (let x = p1 - 240, i = 0; x < W + 240; x += 40, i++) { const k = Math.floor((x - p1) / 40 + Math.floor(cam * 0.2 / 240) * 6), v = Math.sin(k * 1.3) * 60 + Math.sin(k * 0.37) * 50, up = Math.sin(k * 2.1) > 0; c.fillStyle = up ? 'rgba(239,68,68,.55)' : 'rgba(34,197,94,.55)'; c.fillRect(x + 18, 190 + v - 30, 3, 120); c.fillRect(x + 8, 210 + v, 24, 60); }
      for (let x = p2 - 320; x < W + 320; x += 320) { rr(x, 60, 240, 70, 8, '#0b0f19', '#f5b83d', 2); text(Lg('▲ 曜芯 +', '▲ YXT +') + (3 + ((x - p2) / 320 | 0) % 5) + '.8%', x + 120, 95, 22, '#ef4444', 'center'); }
    } else {
      circ(W * 0.75, 150, 70, '#ffd9a0'); for (let x = p1 - 240; x < W + 240; x += 120) { const hh = 140 + ((Math.abs(Math.round((x - p1) / 120)) * 67) % 150); c.fillStyle = '#2a2350'; c.fillRect(x, H - hh - 60, 100, hh + 60); c.fillStyle = '#ffd98a'; for (let i = 0; i < 12; i++) if ((i * 7 + Math.round(x)) % 3) c.fillRect(x + 12 + (i % 4) * 22, H - hh - 44 + ((i / 4) | 0) * 36, 12, 18); }
    }
  }
  function drawWalker(kind, x, y, dir, t, w, h) {
    c.save(); c.translate(x + w / 2, y + h); c.scale(dir, 1); const b = Math.sin(t * 10) * 2;
    if (kind === 'cart') { rr(-20, -30 + b * 0.3, 40, 22, 4, '#e8523a', '#3a1010', 2); c.fillStyle = '#fff3b0'; c.fillRect(-20, -38 + b * 0.3, 40, 8); c.fillStyle = '#e8523a'; for (let i = 0; i < 4; i++) c.fillRect(-20 + i * 10, -38 + b * 0.3, 5, 8); circ(-12, -5, 6, '#30323a', '#111', 2); circ(12, -5, 6, '#30323a', '#111', 2); circ(12, -22 + b * 0.3, 3, '#fff'); circ(13, -22 + b * 0.3, 1.5, '#111'); }
    else if (kind === 'bag') { rr(-16, -34 + b * 0.3, 32, 30, 6, '#7c5cff', '#221a55', 2); rr(-8, -42 + b * 0.3, 16, 10, 3, null, '#221a55', 3); circ(-9, -3, 4, '#30323a'); circ(9, -3, 4, '#30323a'); circ(6, -22, 3.5, '#fff'); circ(7, -22, 1.7, '#111'); circ(-4, -22, 3.5, '#fff'); circ(-3, -22, 1.7, '#111'); }
    else if (kind === 'bear') { circ(0, -18 + b * 0.3, 17, '#6b4a2e', '#2b1a0c', 2); circ(-12, -33, 6, '#6b4a2e', '#2b1a0c', 2); circ(12, -33, 6, '#6b4a2e', '#2b1a0c', 2); circ(6, -22, 3, '#fff'); circ(7, -22, 1.5, '#111'); circ(-3, -22, 3, '#fff'); circ(-2, -22, 1.5, '#111'); rr(-2, -15, 10, 6, 3, '#e9c9a0'); text('↓', -12, -8, 14, '#22c55e', 'center'); }
    else { const col = kind === 'server' ? '#ff6b3a' : kind === 'guard' ? '#4b5568' : '#e9edf3'; rr(-15, -34 + b * 0.3, 30, 30, 6, col, '#1b2233', 2); rr(-9, -28 + b * 0.3, 18, 9, 3, '#0b0f19'); circ(-4, -23.5 + b * 0.3, 2.2, '#ff4d4d'); circ(4, -23.5 + b * 0.3, 2.2, '#ff4d4d'); c.fillStyle = '#1b2233'; c.fillRect(-12, -4, 8, 4); c.fillRect(4, -4, 8, 4); if (kind === 'server') { c.fillStyle = 'rgba(255,120,60,.5)'; c.beginPath(); c.arc(0, -40 - Math.abs(b), 5, 0, TAU); c.fill(); } }
    c.restore();
  }
  function drawDrone(x, y, t, w) {
    c.save(); c.translate(x + w / 2, y + 14); rr(-16, -8, 32, 16, 8, '#30323a', '#111', 2); circ(0, 2, 6, '#9fe3ff', '#111', 2); circ(0, 2, 2.5, '#111');
    c.fillStyle = 'rgba(220,230,255,.8)'; const k = Math.abs(Math.sin(t * 40)); c.fillRect(-26, -14, 20 * k + 4, 3); c.fillRect(6, -14, 20 * k + 4, 3); c.restore();
  }
  function drawThrower(kind, x, y, dir, t, w, h) { drawWalker(kind === 'bear' ? 'bear' : kind, x, y, dir, 0, w, h); c.save(); c.translate(x + w / 2 + dir * 14, y + 6 + Math.sin(t * 4) * 2); rr(-9, -7, 18, 14, 2, '#fff', '#111', 2); c.fillStyle = '#111'; c.fillRect(-6, -3, 12, 2); c.fillRect(-6, 1, 8, 2); c.restore(); }

  /* ---------- 關卡狀態 ---------- */
  let G = null, state = 'title', T = 0, stateT = 0, fade = 0, storyI = 0, curLv = 0, lastResult = null;
  const solidCh = ch => ch === '#' || ch === '=' || ch === '?' || ch === 'C';
  function tile(cx, ry) { if (ry < 0 || ry >= R) return ' '; if (cx < 0 || cx >= G.w) return '#'; return G.grid[ry][cx]; }
  function loadLevel(i) {
    const L = LV.build(i), sv = lvSave(i);
    G = { i, name: L.name, nameEn: L.nameEn, tip: L.tip, tipEn: L.tipEn, th: TH[L.theme], w: L.w, grid: L.rows.map(r => r.split('')), items: [], en: [], plats: [], shots: [], parts: [], texts: [], lasers: [], cam: 0, shake: 0, time: 0, coins: 0, gotShares: [false, false, false], hits: 0, boss: null, won: false, tipT: 5 };
    let sIdx = 0; const hpMax = 3 + upg('hp');
    for (let r = 0; r < R; r++) for (let x = 0; x < L.w; x++) {
      const ch = G.grid[r][x], px = x * TS, py = r * TS; let keep = false;
      if (ch === 'P') G.p = { x: px + 8, y: py + TS - 42, w: 26, h: 42, vx: 0, vy: 0, dir: 1, ground: false, coyote: 0, buf: 0, jumps: 0, hp: hpMax, hpMax, inv: 0, cd: 0, throwT: 0, squash: 0, shield: upg('shield') > 0, cx: px + 8, cy: py + TS - 42 };
      else if (ch === 'c') G.items.push({ k: 'coin', x: px + TS / 2, y: py + TS / 2 });
      else if (ch === 's') G.items.push({ k: 'share', x: px + TS / 2, y: py + TS / 2, idx: sIdx, had: sv.shares[sIdx++] });
      else if (ch === 'H') G.items.push({ k: 'heart', x: px + TS / 2, y: py + TS / 2 });
      else if (ch === 'J') G.items.push({ k: 'spring', x: px + TS / 2, y: py + TS - 8, t: 0 });
      else if (ch === 'K') G.items.push({ k: 'check', x: px + TS / 2, y: py + TS, on: false });
      else if (ch === 'G') G.items.push({ k: 'goal', x: px + TS / 2, y: py + TS });
      else if (ch === 'E') G.en.push({ k: 'walk', x: px + 4, y: py + TS - 36, w: 36, h: 36, vx: -60, hp: 1, dir: -1 });
      else if (ch === 'F') G.en.push({ k: 'fly', x: px + 4, y: py, w: 36, h: 28, bx: px + 4, by: py, ph: x, hp: 1 });
      else if (ch === 'T') G.en.push({ k: 'throw', x: px + 4, y: py + TS - 36, w: 36, h: 36, hp: 2, cd: 1.5, dir: -1 });
      else if (ch === 'M') G.plats.push({ x: px, y: py, w: TS * 2, h: 14, bx: px, by: py, dx: TS * 7, dy: 0, ph: 0 });
      else if (ch === 'V') G.plats.push({ x: px, y: py + TS - 14, w: TS * 2, h: 14, bx: px, by: py + TS - 14, dx: 0, dy: -TS * 4, ph: 0 });
      else if (ch === 'L') { G.lasers.push({ x: px + TS / 2, y: py }); }
      else if (ch === 'B') G.boss = { x: px, y: 200, w: 110, h: 110, hp: 16, hpMax: 16, st: 'hover', t: 0, cd: 2, slamCd: 5, vx: 0, vy: 0, flash: 0, dead: false, homeX: px };
      else keep = true;
      if (!keep) G.grid[r][x] = ' ';
    }
    G.p.cx = G.p.x; G.p.cy = G.p.y; G.arenaX = G.boss ? G.boss.homeX - TS * 20 : 0;
    curLv = i; state = 'play'; stateT = 0;
  }
  function part(x, y, n, col, sp, life, grav) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(0.3, 1) * (sp || 160); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.5, 1) * (life || 0.6), t: 0, col, s: rand(2, 5), g: grav == null ? 500 : grav }); } }
  function ftext(s, x, y, col) { G.texts.push({ s, x, y, t: 0, col: col || '#fff' }); }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function moveBody(b, dt, oneWay) {
    // 水平
    b.x += b.vx * dt;
    let x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - 0.01) / TS), y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - 0.01) / TS);
    b.hitWall = false;
    for (let ry = y0; ry <= y1; ry++) for (let cx = x0; cx <= x1; cx++) if (solidCh(tile(cx, ry))) { if (b.vx > 0) b.x = cx * TS - b.w; else if (b.vx < 0) b.x = (cx + 1) * TS; b.hitWall = true; }
    // 垂直
    const prevBottom = b.y + b.h; b.y += b.vy * dt; b.ground = false; b.headHit = null;
    x0 = Math.floor(b.x / TS); x1 = Math.floor((b.x + b.w - 0.01) / TS); y0 = Math.floor(b.y / TS); y1 = Math.floor((b.y + b.h - 0.01) / TS);
    for (let ry = y0; ry <= y1; ry++) for (let cx = x0; cx <= x1; cx++) {
      const ch = tile(cx, ry);
      if (solidCh(ch)) { if (b.vy > 0) { b.y = ry * TS - b.h; b.vy = 0; b.ground = true; b.floor = ch; } else if (b.vy < 0) { b.y = (ry + 1) * TS; b.vy = 0; b.headHit = { cx, ry, ch }; } }
      else if (ch === '-' && oneWay && b.vy > 0 && prevBottom <= ry * TS + 6) { b.y = ry * TS - b.h; b.vy = 0; b.ground = true; b.floor = '-'; }
    }
  }
  function breakCrate(cx, ry) { G.grid[ry][cx] = ' '; part(cx * TS + TS / 2, ry * TS + TS / 2, 10, '#c98a3a', 220); for (let i = 0; i < 3; i++) G.items.push({ k: 'coin', x: cx * TS + TS / 2 + (i - 1) * 14, y: ry * TS + TS / 2, vy: -260 - i * 40, vx: (i - 1) * 60, loose: 1.2 }); SFX.stomp(); }
  function hurt(n, from) {
    const p = G.p; if (p.inv > 0 || G.won) return;
    if (p.shield) { p.shield = false; p.inv = 1; part(p.x + 13, p.y + 20, 14, '#7de3ff', 240); ftext(Lg('護盾抵擋！', 'Shield blocked!'), p.x, p.y - 20, '#7de3ff'); SFX.spring(); return; }
    p.hp -= n; G.hits++; p.inv = 1.4; p.vy = -420; p.vx = (from != null && from > p.x ? -1 : 1) * 260; G.shake = 0.3; SFX.hit(); part(p.x + 13, p.y + 20, 10, '#ff5b5b', 200);
    if (p.hp <= 0) respawn();
  }
  function respawn() { const p = G.p; p.x = p.cx; p.y = p.cy; p.vx = p.vy = 0; p.hp = p.hpMax; p.inv = 2; p.shield = upg('shield') > 0; G.hits++; ftext(Lg('從存檔點重新出發', 'Back to checkpoint'), p.x - 40, p.y - 30, '#ffd23f'); if (G.boss && !G.boss.dead) { G.boss.hp = Math.min(G.boss.hpMax, G.boss.hp + 3); G.clearShots = true; } }
  function killEnemy(e, i) { G.en.splice(i, 1); part(e.x + e.w / 2, e.y + e.h / 2, 14, '#ffd23f', 240); for (let k = 0; k < 2; k++) G.items.push({ k: 'coin', x: e.x + e.w / 2 + (k ? 10 : -10), y: e.y, vy: -300, vx: (k ? 50 : -50), loose: 1.2 }); SFX.stomp(); }

  function updatePlay(dt) {
    const p = G.p; G.time += dt; G.tipT -= dt;
    // --- 主角控制 ---
    const ax = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), maxV = 290;
    if (ax) { p.vx = lerp(p.vx, ax * maxV, clamp(dt * (p.ground ? 14 : 8), 0, 1)); p.dir = ax; } else p.vx = lerp(p.vx, 0, clamp(dt * (p.ground ? 16 : 4), 0, 1));
    const conv = p.ground && p.floor === 'C' ? 110 : 0;
    p.coyote = p.ground ? 0.1 : p.coyote - dt; if (pressed.jump) p.buf = 0.12; else p.buf -= dt;
    if (p.buf > 0) {
      if (p.coyote > 0) { p.vy = -800; p.jumps = 1; p.buf = 0; p.coyote = 0; SFX.jump(); part(p.x + 13, p.y + p.h, 5, '#fff', 80, 0.3); }
      else if (upg('dj') && p.jumps < 2) { p.vy = -720; p.jumps = 2; p.buf = 0; SFX.jump(); part(p.x + 13, p.y + p.h, 8, '#7de3ff', 120, 0.4); }
    }
    if (!keys.jump && p.vy < -260) p.vy = -260;   // 放開跳躍鍵＝小跳
    p.vy = Math.min(p.vy + 2200 * dt, 1100);
    const wasAir = !p.ground, vyBefore = p.vy;
    p.onPlat = null; p.vx += conv; moveBody(p, dt, true); p.vx -= conv;
    // 移動平台
    for (const pl of G.plats) { if (p.vy >= 0 && p.x + p.w > pl.x && p.x < pl.x + pl.w && p.y + p.h >= pl.y - 2 && p.y + p.h <= pl.y + 16 + vyBefore * dt) { p.y = pl.y - p.h; p.vy = 0; p.ground = true; p.floor = 'M'; p.onPlat = pl; } }
    if (p.ground) { if (wasAir && vyBefore > 300) { p.squash = 0.5; part(p.x + 13, p.y + p.h, 6, '#fff', 90, 0.3); } p.jumps = 0; }
    if (p.headHit && p.headHit.ch === '?') breakCrate(p.headHit.cx, p.headHit.ry);
    p.squash = lerp(p.squash, 0, clamp(dt * 10, 0, 1)); p.inv -= dt; p.cd -= dt; p.throwT -= dt;
    if (G.boss && !G.boss.dead && p.x < G.arenaX && G.bossOn) p.x = G.arenaX;
    // --- 丟晶片 ---
    if (keys.shoot && p.cd <= 0) { p.cd = upg('rapid') ? 0.2 : 0.42; p.throwT = 0.15; G.shots.push({ x: p.x + 13 + p.dir * 14, y: p.y + 14, vx: p.dir * 620, vy: 0, w: 14, h: 14, mine: true, life: 0.9 }); SFX.shoot(); }
    // --- 危險地形 ---
    const fx0 = Math.floor(p.x / TS), fx1 = Math.floor((p.x + p.w - 0.01) / TS), fy0 = Math.floor(p.y / TS), fy1 = Math.floor((p.y + p.h - 0.01) / TS);
    for (let ry = fy0; ry <= fy1; ry++) for (let cx = fx0; cx <= fx1; cx++) { const ch = tile(cx, ry); if (ch === '^' && p.y + p.h > ry * TS + 18) hurt(1); if (ch === '~') { hurt(1); p.vy = -620; } }
    const laserOn = (G.time % 2.4) < 1.3;
    if (laserOn) for (const l of G.lasers) if (p.x < l.x + 7 && p.x + p.w > l.x - 7 && p.y < l.y + TS && p.y + p.h > l.y) hurt(1, l.x);
    if (p.y > H + 120) { p.hp = 0; SFX.hit(); respawn(); }
    // --- 平台移動 ---
    for (const pl of G.plats) { pl.ph += dt; const k = (1 - Math.cos(pl.ph * 1.1)) / 2, nx = pl.bx + pl.dx * k, ny = pl.by + pl.dy * k; if (p.onPlat === pl) { p.x += nx - pl.x; p.y += ny - pl.y; } pl.x = nx; pl.y = ny; }
    // --- 物品 ---
    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i];
      if (it.loose) { it.loose -= dt; it.vy += 1400 * dt; it.x += it.vx * dt; it.y += it.vy * dt; const gy = Math.floor((it.y + 10) / TS), gx = Math.floor(it.x / TS); if (it.vy > 0 && solidCh(tile(gx, gy))) { it.y = gy * TS - 10; it.vy *= -0.4; it.vx *= 0.6; } }
      const dx = it.x - (p.x + 13), dy = it.y - (p.y + 21), d = Math.hypot(dx, dy);
      if (it.k === 'coin') { if (upg('magnet') && d < 150) { it.x -= dx / d * 420 * dt; it.y -= dy / d * 420 * dt; } if (d < 30) { G.items.splice(i, 1); G.coins++; SFX.coin(); part(it.x, it.y, 5, '#ffd23f', 120, 0.4); } }
      else if (it.k === 'share' && !it.got && d < 34) { it.got = true; G.gotShares[it.idx] = true; SFX.share(); part(it.x, it.y, 24, '#7de3ff', 280, 0.9); ftext(it.had ? Lg('股權碎片（已收集過）', 'Share (already found)') : Lg('取得股權碎片！', 'Got a share fragment!'), it.x - 60, it.y - 30, '#7de3ff'); }
      else if (it.k === 'heart' && d < 32 && p.hp < p.hpMax) { G.items.splice(i, 1); p.hp++; SFX.check(); part(it.x, it.y, 10, '#ff5b8a', 160); }
      else if (it.k === 'spring') { it.t -= dt; if (p.vy > 0 && Math.abs(dx) < 26 && p.y + p.h > it.y - 12 && p.y + p.h < it.y + 16) { p.vy = -1180; p.jumps = 1; it.t = 0.3; SFX.spring(); } }
      else if (it.k === 'check' && !it.on && Math.abs(dx) < 30 && Math.abs(dy) < 80) { it.on = true; p.cx = it.x - 13; p.cy = it.y - p.h; p.hp = Math.max(p.hp, Math.min(p.hpMax, p.hp + 1)); SFX.check(); ftext(Lg('已存檔', 'Saved'), it.x - 20, it.y - 90, '#35e08a'); part(it.x, it.y - 60, 12, '#35e08a', 180); }
      else if (it.k === 'goal' && Math.abs(dx) < 34 && Math.abs(dy) < 70 && !G.won) winLevel();
    }
    // --- 敵人 ---
    for (let i = G.en.length - 1; i >= 0; i--) {
      const e = G.en[i]; if (Math.abs(e.x - p.x) > W * 1.2) continue;
      if (e.k === 'walk') {
        e.vy = Math.min((e.vy || 0) + 2200 * dt, 900); const ox = e.x; moveBody(e, dt, true);
        const ahead = tile(Math.floor((e.x + (e.vx > 0 ? e.w + 2 : -2)) / TS), Math.floor((e.y + e.h + 4) / TS));
        if (e.hitWall || (e.ground && !(solidCh(ahead) || ahead === '-'))) { e.vx = -e.vx; e.x = ox; } e.dir = e.vx > 0 ? 1 : -1;
      } else if (e.k === 'fly') { e.x = e.bx + Math.sin(G.time * 1.3 + e.ph) * 110; e.y = e.by + Math.sin(G.time * 2.6 + e.ph) * 34; }
      else if (e.k === 'throw') { e.dir = p.x > e.x ? 1 : -1; e.cd -= dt; if (e.cd <= 0 && Math.abs(p.x - e.x) < TS * 11) { e.cd = 2.3; G.shots.push({ x: e.x + e.w / 2, y: e.y + 6, vx: e.dir * 250, vy: -330, g: 900, w: 18, h: 14, life: 3, news: true }); } }
      if (e.flash) e.flash -= dt;
      if (hit(p, e)) { if (p.vy > 120 && p.y + p.h < e.y + e.h * 0.6) { p.vy = keys.jump ? -760 : -480; p.jumps = 1; e.hp -= 2; if (e.hp <= 0) killEnemy(e, i); else e.flash = 0.2; } else hurt(1, e.x); }
    }
    // --- 子彈 ---
    for (let i = G.shots.length - 1; i >= 0; i--) {
      const s = G.shots[i]; if (!s) continue; s.life -= dt; if (s.g) s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; let dead = s.life <= 0;
      const cx = Math.floor(s.x / TS), ry = Math.floor(s.y / TS), ch = tile(cx, ry);
      if (solidCh(ch)) { dead = true; if (ch === '?' && s.mine) breakCrate(cx, ry); else part(s.x, s.y, 4, s.mine ? '#ffd23f' : '#fff', 100, 0.3); }
      const box = { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h };
      if (s.mine) {
        for (let k = G.en.length - 1; k >= 0 && !dead; k--) if (hit(box, G.en[k])) { dead = true; G.en[k].hp--; G.en[k].flash = 0.15; if (G.en[k].hp <= 0) killEnemy(G.en[k], k); else SFX.stomp(); }
        const b = G.boss; if (!dead && b && !b.dead && G.bossOn && hit(box, b)) { dead = true; damageBoss(1); }
      } else if (hit(box, p)) { dead = true; hurt(1, s.x); }
      if (dead && G.shots[i] === s) G.shots.splice(i, 1);
    }
    if (G.clearShots) { G.clearShots = false; G.shots = G.shots.filter(q => q.mine); }
    if (G.boss) updateBoss(dt);
    // --- 特效 ---
    for (let i = G.parts.length - 1; i >= 0; i--) { const q = G.parts[i]; q.t += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.t > q.life) G.parts.splice(i, 1); }
    for (let i = G.texts.length - 1; i >= 0; i--) { const q = G.texts[i]; q.t += dt; q.y -= 30 * dt; if (q.t > 1.4) G.texts.splice(i, 1); }
    G.shake = Math.max(0, G.shake - dt);
    let target = p.x + p.dir * 60 - W * 0.4; if (G.bossOn && !G.boss.dead) target = G.arenaX;
    G.cam = lerp(G.cam, clamp(target, 0, G.w * TS - W), clamp(dt * 5, 0, 1));
    if (pressed.pause) { state = 'pause'; stateT = 0; }
    if (G.won) { G.wonT += dt; if (G.wonT > 1.6) { state = 'clear'; stateT = 0; } }
  }
  function damageBoss(n) {
    const b = G.boss; b.hp -= n; b.flash = 0.12; SFX.stomp(); part(b.x + b.w / 2, b.y + b.h / 2, 6, '#ffb03a', 220);
    if (b.hp <= 0) { b.dead = true; G.shake = 0.8; SFX.boom(); G.clearShots = true; for (let i = 0; i < 6; i++) setTimeout(() => { if (G && G.boss === b) { part(b.x + rand(0, b.w), b.y + rand(0, b.h), 26, ['#ff5b5b', '#ffd23f', '#fff'][i % 3], 380, 1); SFX.boom(); } }, i * 180);
      for (let i = 0; i < 12; i++) G.items.push({ k: 'coin', x: b.x + b.w / 2, y: b.y + 30, vy: rand(-600, -300), vx: rand(-220, 220), loose: 2 });
      G.items.push({ k: 'goal', x: b.homeX + TS * 2, y: 10 * TS }); ftext(Lg('董事會的機器人被擊敗了！', 'The board\'s robot is down!'), b.x - 60, b.y - 20, '#ffd23f'); }
  }
  function updateBoss(dt) {
    const b = G.boss, p = G.p; if (!G.bossOn) { if (p.x > G.arenaX + TS * 3) { G.bossOn = true; ftext(Lg('魔王登場：董事會巨型機器人', 'BOSS: The Board\'s Mega Robot'), p.x, 120, '#ff5b5b'); SFX.boom(); G.shake = 0.5; } return; }
    if (b.dead) { b.y += 300 * dt; return; }
    b.t += dt; b.flash -= dt; const rage = b.hp <= b.hpMax / 2, floorY = 10 * TS - b.h, cxp = p.x + 13 - b.w / 2;
    if (b.st === 'hover') {
      const tx = clamp(cxp + Math.sin(b.t * 0.9) * 260, G.arenaX + 20, G.arenaX + W - b.w - 20); b.x = lerp(b.x, tx, dt * 1.2); b.y = lerp(b.y, 150 + Math.sin(b.t * 2) * 30, dt * 3);
      b.cd -= dt; b.slamCd -= dt;
      if (b.cd <= 0) { b.cd = rage ? 1.1 : 1.7; const ox = b.x + b.w / 2, oy = b.y + b.h - 10, a0 = Math.atan2(p.y + 20 - oy, p.x + 13 - ox); for (let k = -1; k <= 1; k++) { if (!rage && k) continue; G.shots.push({ x: ox, y: oy, vx: Math.cos(a0 + k * 0.28) * 300, vy: Math.sin(a0 + k * 0.28) * 300, w: 16, h: 16, life: 4 }); } SFX.shoot(); }
      if (b.slamCd <= 0) { b.st = 'aim'; b.t2 = 0.7; }
    } else if (b.st === 'aim') { b.x = lerp(b.x, clamp(cxp, G.arenaX + 20, G.arenaX + W - b.w - 20), dt * 4); b.y = lerp(b.y, 70, dt * 5); b.t2 -= dt; if (b.t2 <= 0) { b.st = 'slam'; b.vy = 200; } }
    else if (b.st === 'slam') { b.vy += 3200 * dt; b.y += b.vy * dt; if (b.y >= floorY) { b.y = floorY; b.st = 'stun'; b.t2 = rage ? 1.6 : 2.2; G.shake = 0.5; SFX.boom(); part(b.x + b.w / 2, b.y + b.h, 24, '#c9d3e3', 320, 0.7); [-1, 1].forEach(d => G.shots.push({ x: b.x + b.w / 2, y: 10 * TS - 12, vx: d * 380, vy: 0, w: 26, h: 22, life: 2.2, wave: true })); } }
    else if (b.st === 'stun') { b.t2 -= dt; if (b.t2 <= 0) { b.st = 'hover'; b.slamCd = rage ? 4 : 6; b.cd = 1; } }
    if (hit(p, b)) { if (b.st === 'stun' && p.vy > 120 && p.y + p.h < b.y + 40) { p.vy = -820; p.jumps = 1; damageBoss(2); } else hurt(1, b.x + b.w / 2); }
  }
  function winLevel() {
    G.won = true; G.wonT = 0; SFX.win(); const sv = lvSave(G.i), p = G.p;
    for (let i = 0; i < 60; i++) G.parts.push({ x: p.x + rand(-200, 200), y: p.y - rand(100, 320), vx: rand(-60, 60), vy: rand(-80, 40), life: rand(1.2, 2.2), t: 0, col: ['#ff5b5b', '#ffd23f', '#7de3ff', '#35e08a', '#c084fc'][i % 5], s: rand(4, 7), g: 220 });
    let newShares = 0; G.gotShares.forEach((g, i) => { if (g && !sv.shares[i]) { sv.shares[i] = true; newShares++; } });
    const stars = 1 + (G.gotShares.every(Boolean) ? 1 : 0) + (G.hits === 0 ? 1 : 0);
    sv.done = true; sv.stars = Math.max(sv.stars, stars); sv.best = sv.best ? Math.min(sv.best, G.time) : G.time;
    SV.coins += G.coins; SV.unlocked = Math.max(SV.unlocked, Math.min(LV.count, G.i + 2));
    lastResult = { stars, coins: G.coins, time: G.time, shares: G.gotShares.filter(Boolean).length, newShares, hits: G.hits, last: G.i === LV.count - 1 }; save();
    if (root.SC) root.SC.post('levelclear', { level: G.i + 1, stars, shares: lastResult.shares });
  }

  /* ---------- 關卡繪製 ---------- */
  function drawTiles() {
    const th = G.th, x0 = Math.max(0, Math.floor(G.cam / TS)), x1 = Math.min(G.w - 1, x0 + Math.ceil(W / TS) + 1);
    for (let r = 0; r < R; r++) for (let x = x0; x <= x1; x++) {
      const ch = G.grid[r][x]; if (ch === ' ') continue; const px = x * TS, py = r * TS;
      if (ch === '#') { c.fillStyle = th.ground; c.fillRect(px, py, TS + 1, TS + 1); if (r === 0 || G.grid[r - 1][x] !== '#') { c.fillStyle = th.top; c.fillRect(px, py, TS + 1, 9); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px, py + 9, TS + 1, 4); } else { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(px + ((x * 7 + r * 13) % 30), py + ((x * 11 + r * 5) % 30), 9, 5); } }
      else if (ch === '=') rr(px + 1, py + 1, TS - 2, TS - 2, 6, th.top, '#1b2233', 2.5);
      else if (ch === '?') { rr(px + 2, py + 2, TS - 4, TS - 4, 5, '#c98a3a', '#5a3610', 3); c.strokeStyle = '#5a3610'; c.lineWidth = 3; c.beginPath(); c.moveTo(px + 6, py + 6); c.lineTo(px + TS - 6, py + TS - 6); c.moveTo(px + TS - 6, py + 6); c.lineTo(px + 6, py + TS - 6); c.stroke(); }
      else if (ch === '-') { rr(px, py, TS + 1, 12, 4, th.top, '#1b2233', 2); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px + 8, py + 12, 4, 8); c.fillRect(px + TS - 12, py + 12, 4, 8); }
      else if (ch === '^') { c.fillStyle = '#dfe6f3'; c.strokeStyle = '#1b2233'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(px + i * 15, py + TS); c.lineTo(px + i * 15 + 7.5, py + 14); c.lineTo(px + i * 15 + 15, py + TS); c.closePath(); c.fill(); c.stroke(); } }
      else if (ch === '~') { const g = c.createLinearGradient(0, py, 0, py + TS); g.addColorStop(0, '#ffec6b'); g.addColorStop(0.4, '#ff6b3a'); g.addColorStop(1, '#7a1f1f'); c.fillStyle = g; c.beginPath(); c.moveTo(px, py + TS); for (let k = 0; k <= TS; k += 5) c.lineTo(px + k, py + 8 + Math.sin((px + k) / 12 + T * 5) * 5); c.lineTo(px + TS + 1, py + TS); c.fill(); if ((x + Math.floor(T * 3)) % 4 === 0) circ(px + 20, py - 6 - (T * 40 % 30), 3, 'rgba(255,160,80,.6)'); }
      else if (ch === 'C') { c.fillStyle = '#30323a'; c.fillRect(px, py, TS + 1, TS); c.fillStyle = '#ffd23f'; const o = (T * 60) % 15; for (let k = -15; k < TS; k += 15) { const xx = px + k + o; if (xx > px - 2 && xx < px + TS - 6) { c.beginPath(); c.moveTo(xx, py + 3); c.lineTo(xx + 7, py + 8); c.lineTo(xx, py + 13); c.fill(); } } circ(px + TS / 2, py + 30, 8, '#4b5568', '#111', 2); }
    }
    const on = (G.time % 2.4) < 1.3, warn = (G.time % 2.4) > 2.0;
    for (const l of G.lasers) { if (l.x < G.cam - 50 || l.x > G.cam + W + 50) continue; if (on) { c.fillStyle = 'rgba(255,60,60,.25)'; c.fillRect(l.x - 9, l.y, 18, TS); c.fillStyle = '#ff3b3b'; c.fillRect(l.x - 3 + Math.sin(T * 50) * 1, l.y, 6, TS); c.fillStyle = '#fff'; c.fillRect(l.x - 1, l.y, 2, TS); } else if (warn) { c.fillStyle = 'rgba(255,60,60,.25)'; c.fillRect(l.x - 1, l.y, 2, TS); } }
  }
  function drawBoss() {
    const b = G.boss; if (!b || !G.bossOn) return; c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); if (b.dead) c.rotate(b.y * 0.01);
    const fl = b.flash > 0; if (b.st === 'aim') c.translate(rand(-2, 2), 0);
    c.fillStyle = 'rgba(255,140,60,.7)'; if (b.st !== 'stun') { c.beginPath(); c.moveTo(-30, 50); c.lineTo(-22, 70 + Math.sin(T * 30) * 8); c.lineTo(-14, 50); c.fill(); c.beginPath(); c.moveTo(14, 50); c.lineTo(22, 70 + Math.cos(T * 30) * 8); c.lineTo(30, 50); c.fill(); }
    rr(-55, -45, 110, 96, 18, fl ? '#fff' : '#4b5568', '#111827', 4); rr(-40, -30, 80, 36, 8, '#0b0f19', '#111827', 3);
    const ey = b.st === 'stun' ? '#6b7280' : (b.hp <= b.hpMax / 2 ? '#ff3b3b' : '#ffd23f');
    if (b.st === 'stun') { text('×', -18, -11, 26, ey, 'center'); text('×', 18, -11, 26, ey, 'center'); } else { circ(-18, -12, 9, ey); circ(18, -12, 9, ey); circ(-18 + clamp((G.p.x - b.x) / 60, -4, 4), -12, 4, '#111'); circ(18 + clamp((G.p.x - b.x) / 60, -4, 4), -12, 4, '#111'); }
    rr(-26, 16, 52, 18, 4, '#1f2937', '#111827', 3); c.fillStyle = '#9ca3af'; for (let i = 0; i < 5; i++) c.fillRect(-22 + i * 10, 19, 5, 12);
    rr(-74, -18, 20, 54, 8, '#374151', '#111827', 3); rr(54, -18, 20, 54, 8, '#374151', '#111827', 3); rr(-12, -62, 24, 18, 4, '#b91c1c', '#111827', 3); text('$', 0, -53, 14, '#fff', 'center');
    c.restore();
    if (b.st === 'stun' && !b.dead) text(Lg('當機中！快攻擊', 'Crashed! Attack now!'), b.x + b.w / 2, b.y - 20, 18, '#ffd23f', 'center', true, '#111');
  }
  function drawPlay() {
    const p = G.p, sx = G.shake > 0 ? rand(-6, 6) * G.shake * 3 : 0, sy = G.shake > 0 ? rand(-6, 6) * G.shake * 3 : 0;
    drawBG(G.th, G.cam, T); c.save(); c.translate(-Math.round(G.cam) + sx, sy);
    drawTiles();
    for (const pl of G.plats) { rr(pl.x, pl.y, pl.w, pl.h, 6, '#9fb3cf', '#1b2233', 2.5); c.fillStyle = '#ffd23f'; c.fillRect(pl.x + 8, pl.y + 5, pl.w - 16, 3); }
    for (const it of G.items) {
      if (it.x < G.cam - 80 || it.x > G.cam + W + 80) continue;
      if (it.k === 'coin') drawChip(it.x, it.y, T + it.x * 0.01, 0.85);
      else if (it.k === 'share') { if (!it.got) drawShare(it.x, it.y, T, it.had); }
      else if (it.k === 'heart') { c.save(); c.translate(it.x, it.y + Math.sin(T * 3) * 3); c.fillStyle = '#ff5b8a'; c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-20, -6, -8, -18, 0, -6); c.bezierCurveTo(8, -18, 20, -6, 0, 10); c.fill(); c.strokeStyle = '#7a1f3a'; c.lineWidth = 2; c.stroke(); c.restore(); }
      else if (it.k === 'spring') { const k = it.t > 0 ? 0.5 : 1; rr(it.x - 18, it.y - 14 * k, 36, 6, 3, '#ff5b5b', '#111', 2); c.strokeStyle = '#9ca3af'; c.lineWidth = 3; c.beginPath(); for (let j = 0; j < 4; j++) { c.moveTo(it.x - 12, it.y - 10 * k + j * 4 * k + 4); c.lineTo(it.x + 12, it.y - 10 * k + j * 4 * k + 6); } c.stroke(); }
      else if (it.k === 'check') { c.fillStyle = '#9ca3af'; c.fillRect(it.x - 2, it.y - 80, 4, 80); const fy = it.on ? it.y - 80 : it.y - 40; c.fillStyle = it.on ? '#35e08a' : '#6b7280'; c.beginPath(); c.moveTo(it.x + 2, fy); c.lineTo(it.x + 34 + Math.sin(T * 6) * 3, fy + 10); c.lineTo(it.x + 2, fy + 20); c.fill(); }
      else if (it.k === 'goal') { rr(it.x - 34, it.y - 96, 68, 96, 8, '#1f2937', '#ffd23f', 4); rr(it.x - 22, it.y - 70, 44, 70, 4, '#7de3ff'); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(it.x - 22, it.y - 70, 10 + Math.sin(T * 3) * 4, 70); text(Lg('曜芯', 'YXT'), it.x, it.y - 84, 14, '#ffd23f', 'center'); text(Lg('終點', 'GOAL'), it.x, it.y - 112 + Math.sin(T * 4) * 3, 16, '#fff', 'center', true, '#111'); }
    }
    for (const e of G.en) { if (e.x < G.cam - 80 || e.x > G.cam + W + 80) continue; if (e.flash > 0) c.globalAlpha = 0.5; if (e.k === 'walk') drawWalker(G.th.walker, e.x, e.y, e.dir, T, e.w, e.h); else if (e.k === 'fly') drawDrone(e.x, e.y, T, e.w); else drawThrower(G.th.walker, e.x, e.y, e.dir, T, e.w, e.h); c.globalAlpha = 1; }
    drawBoss();
    for (const s of G.shots) { if (s.mine) drawChip(s.x, s.y, T * 3, 0.6); else if (s.wave) { c.fillStyle = 'rgba(255,220,120,.9)'; c.beginPath(); c.moveTo(s.x - 14, s.y + 12); c.lineTo(s.x, s.y - 14); c.lineTo(s.x + 14, s.y + 12); c.fill(); } else if (s.news) { c.save(); c.translate(s.x, s.y); c.rotate(T * 8); rr(-10, -8, 20, 16, 2, '#fff', '#111', 2); text(Lg('空', '↓'), 0, 0, 11, '#22c55e', 'center'); c.restore(); } else { circ(s.x, s.y, 9, '#ff5b5b', '#7a1f1f', 2); circ(s.x - 2, s.y - 2, 3, '#ffd0d0'); } }
    if (!(p.inv > 0 && Math.floor(T * 20) % 2 && !G.won)) drawHero(p.x + p.w / 2, p.y + p.h, p.dir, T, { run: p.ground && Math.abs(p.vx) > 40, air: !p.ground, squash: p.squash, throwing: p.throwT > 0, shield: p.shield });
    for (const q of G.parts) { c.globalAlpha = clamp(1 - q.t / q.life, 0, 1); c.fillStyle = q.col; c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); } c.globalAlpha = 1;
    for (const q of G.texts) { c.globalAlpha = clamp(1.4 - q.t, 0, 1); text(q.s, q.x, q.y, 18, q.col, 'left', true, '#111'); } c.globalAlpha = 1;
    c.restore();
    // HUD
    for (let i = 0; i < p.hpMax; i++) { c.save(); c.translate(30 + i * 34, 30); c.fillStyle = i < p.hp ? '#ff5b8a' : 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(0, 11); c.bezierCurveTo(-22, -6, -9, -20, 0, -7); c.bezierCurveTo(9, -20, 22, -6, 0, 11); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2.5; c.stroke(); c.restore(); }
    drawChip(34, 70, 0, 0.9); text('× ' + (SV.coins + G.coins), 56, 70, 22, '#fff', 'left', true, '#111');
    for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha = G.gotShares[i] ? 1 : 0.3; c.translate(W / 2 - 40 + i * 40, 30); c.beginPath(); c.moveTo(0, -14); c.lineTo(12, 0); c.lineTo(0, 14); c.lineTo(-12, 0); c.closePath(); c.fillStyle = '#7de3ff'; c.fill(); c.strokeStyle = '#0b3a55'; c.lineWidth = 2.5; c.stroke(); c.restore(); }
    text(Lg('第 ' + (G.i + 1) + ' 關　' + G.name, 'Stage ' + (G.i + 1) + '  ' + G.nameEn), W - 20, 28, 20, '#fff', 'right', true, '#111'); text(fmtTime(G.time), W - 20, 56, 18, '#ffd23f', 'right', true, '#111');
    button('Ⅱ', W - 60, 76, 40, 36, () => { state = 'pause'; stateT = 0; }, { size: 18, color: 'rgba(255,255,255,.85)' });
    if (G.bossOn && !G.boss.dead) { rr(W / 2 - 200, 60, 400, 18, 9, 'rgba(0,0,0,.6)', '#111', 2); rr(W / 2 - 198, 62, 396 * clamp(G.boss.hp / G.boss.hpMax, 0, 1), 14, 7, '#ef4444'); text(Lg('董事會巨型機器人', 'The Board\'s Mega Robot'), W / 2, 90, 15, '#fff', 'center', true, '#111'); }
    if (G.tipT > 0 && G.tip) { const tip = Lg(G.tip, G.tipEn); c.globalAlpha = clamp(G.tipT, 0, 1); rr(W / 2 - 330, H - 70, 660, 44, 12, 'rgba(0,0,0,.65)'); text(tip, W / 2, H - 48, 17, '#fff', 'center', false); c.globalAlpha = 1; }
  }
  const fmtTime = t => Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2);
  function starRow(x, y, n, size) { for (let i = 0; i < 3; i++) text('★', x + i * size * 1.1, y, size, i < n ? '#ffd23f' : 'rgba(255,255,255,.25)', 'center', true, '#111'); }
  function dim(a) { c.fillStyle = 'rgba(8,10,20,' + a + ')'; c.fillRect(0, 0, W, H); }
  function panel(x, y, w, h) { rr(x, y + 6, w, h, 18, 'rgba(0,0,0,.4)'); rr(x, y, w, h, 18, '#1b2336', '#f5b83d', 4); }

  /* ---------- 劇情 ---------- */
  const STORY = [
    ['雷老大', '我是雷老大，曜芯科技的創辦人。大家叫我「AI 教父」，因為全世界的 AI 都跑在我們設計的晶片上。', 'Boss Lei', 'I\'m Boss Lei, founder of Yaoxin Tech. People call me the "AI Godfather", because the world\'s AI runs on the chips we design.'],
    ['突發事件', '新晶片發表會的前七天，董事會突然被神祕財團收買，把我架空，還把我趕出了自己創辦的公司！', 'Breaking news', 'Seven days before our new chip launch, a mystery fund bought off the board. They stripped my power and threw me out of the company I founded!'],
    ['旁白', '沒有門禁卡、沒有專車，連股權都被拆成碎片，散落在各地……', 'Narrator', 'No badge, no company car, and his shares were split into fragments and scattered across the city…'],
    ['雷老大', '沒關係，我還有一身工程師連身服、一個風扇背包，還有滿口袋的晶片。走，把公司搶回來！', 'Boss Lei', 'No problem. I still have my engineer overalls, my fan backpack and a pocket full of chips. Let\'s take the company back!']
  ];
  function ending() {
    const n = totalShares(), all = LV.count * 3;
    if (n >= all) return [Lg('隱藏結局：全員教父', 'Secret Ending: Godfathers All'), Lg('你找回了 100% 的股權碎片！雷老大不只重返執行長，還把股份分給每一位工程師。發表會上，全場起立鼓掌。', 'You recovered 100% of the shares! Boss Lei is CEO again and gives shares to every engineer. The launch ends in a standing ovation.')];
    if (n >= all / 2) return [Lg('結局：奪回執行長', 'Ending: CEO Again'), Lg('你收集到過半的股權（' + n + ' / ' + all + '），董事會改選成功，雷老大回到舞台上，親手發表了新一代晶片。', 'You gathered a majority of the shares (' + n + ' / ' + all + '). The board is replaced and Boss Lei takes the stage to unveil the new chip himself.')];
    return [Lg('結局：重返公司，但……', 'Ending: Back, but…'), Lg('你打敗了機器人，可是只找回 ' + n + ' / ' + all + ' 份股權，還不到一半。雷老大暫時只能當顧問。回到各關把股權碎片找齊吧！', 'You beat the robot, but found only ' + n + ' / ' + all + ' shares, less than half. Boss Lei can only be an adviser for now. Replay the stages to find more shares!')];
  }

  /* ---------- 畫面：標題、劇情、地圖、商店、暫停、過關、結局 ---------- */
  function drawTitle() {
    drawBG(TH.roof, T * 40, T); dim(0.25);
    for (let x = -((T * 80) % 90); x < W; x += 90) { c.fillStyle = '#3b4256'; c.fillRect(x, H - 70, 91, 70); c.fillStyle = '#8c96ad'; c.fillRect(x, H - 70, 91, 9); }
    drawHero(W / 2 - 240, H - 70, 1, T, { run: true });
    drawChip(W / 2 - 150 + Math.sin(T * 2) * 10, H - 150, T, 1.3); drawShare(W / 2 - 80, H - 190, T, false);
    text(Lg('搶救', 'SAVE THE'), W / 2, 96, 44, '#ffd23f', 'center', true, '#111'); text(Lg('AI 教父大作戰', 'AI GODFATHER'), W / 2, 168, Lg(76, 70), '#fff', 'center', true, '#111');
    text(Lg('幫雷老大闖過六道關卡，奪回他創辦的曜芯科技！', 'Help Boss Lei fight through 6 stages and win back his company!'), W / 2, 232, 22, '#ffe9a8', 'center', true, '#111');
    button(SV.unlocked > 1 || lvSave(0).done ? Lg('▶ 繼續遊戲', '▶ Continue') : Lg('▶ 開始遊戲', '▶ Start'), W / 2 - 130, 280, 260, 60, () => { if (!SV.seenStory) { state = 'story'; storyI = 0; } else state = 'map'; stateT = 0; }, { size: 26 });
    button(Lg('劇情回顧', 'Story'), W / 2 - 130, 356, 124, 44, () => { state = 'story'; storyI = 0; stateT = 0; }, { size: 17, color: '#7de3ff' });
    button(SV.mute ? Lg('🔇 聲音關', '🔇 Off') : Lg('🔊 聲音開', '🔊 On'), W / 2 + 6, 356, 124, 44, () => { SV.mute = !SV.mute; save(); }, { size: 17, color: '#7de3ff' });
    if (root.SC) button(Lg('EN', '中文'), W - 104, 16, 88, 40, () => root.SC.toggleLang(), { size: 17, color: '#7de3ff' });
    text(Lg('鍵盤：← → 移動　空白鍵 跳躍　X 丟晶片　P 暫停', 'Keys: ← → move   Space jump   X throw chip   P pause'), W / 2, H - 24, 15, 'rgba(255,255,255,.85)', 'center', false);
  }
  function drawStory() {
    drawBG(storyI === 0 ? TH.fab : storyI === 1 ? TH.stock : storyI === 2 ? TH.market : TH.roof, stateT * 30, T); dim(0.45);
    drawHero(200, 330, 1, T, { run: storyI === 3, air: false });
    if (storyI === 1) { c.save(); c.translate(640, 250); c.scale(0.9, 0.9); rr(-55, -45, 110, 96, 18, '#4b5568', '#111827', 4); rr(-40, -30, 80, 36, 8, '#0b0f19'); circ(-18, -12, 9, '#ff3b3b'); circ(18, -12, 9, '#ff3b3b'); rr(-12, -62, 24, 18, 4, '#b91c1c', '#111827', 3); text('$', 0, -53, 14, '#fff', 'center'); c.restore(); }
    if (storyI === 2) for (let i = 0; i < 5; i++) drawShare(420 + i * 90, 200 + Math.sin(T * 2 + i) * 30, T + i, false);
    panel(90, 360, W - 180, 150); text(Lg(STORY[storyI][0], STORY[storyI][2]), 120, 392, 22, '#ffd23f'); wrapText(Lg(STORY[storyI][1], STORY[storyI][3]), 120, 430, W - 240, 20, '#fff', 30);
    button(storyI < STORY.length - 1 ? Lg('下一頁 ▶', 'Next ▶') : Lg('出發！', 'Let\'s go!'), W - 270, 462, 160, 40, nextStory, { size: 18 });
    button(Lg('跳過', 'Skip'), 110, 462, 90, 40, () => { SV.seenStory = true; save(); state = 'map'; }, { size: 16, color: '#9aa3b5' });
    if (pressed.ok || pressed.jump) nextStory();
  }
  function nextStory() { if (storyI < STORY.length - 1) storyI++; else { SV.seenStory = true; save(); state = 'map'; stateT = 0; } }
  const NODES = [[130, 380], [280, 250], [440, 380], [600, 240], [750, 370], [860, 190]];
  function drawMap() {
    drawBG(TH.dc, T * 10, T); dim(0.35);
    text(Lg('闖關地圖', 'Stage Map'), 40, 44, 34, '#fff', 'left', true, '#111'); drawChip(W - 250, 44, T, 1); text('× ' + SV.coins, W - 226, 44, 24, '#fff', 'left', true, '#111');
    drawShare(W - 130, 44, T, false); text(totalShares() + ' / ' + LV.count * 3, W - 106, 44, 22, '#7de3ff', 'left', true, '#111');
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 6; c.setLineDash([4, 14]); c.lineCap = 'round'; c.beginPath(); NODES.forEach((n, i) => i ? c.lineTo(n[0], n[1]) : c.moveTo(n[0], n[1])); c.stroke(); c.setLineDash([]);
    NODES.forEach((n, i) => {
      const open = i < SV.unlocked, sv = lvSave(i), hot = Math.hypot(mouse.x - n[0], mouse.y - n[1]) < 40, cur = open && !sv.done;
      circ(n[0], n[1] + 5, 38, 'rgba(0,0,0,.4)'); circ(n[0], n[1] + (hot && open ? 2 : 0), 38 + (cur ? Math.sin(T * 5) * 3 : 0), open ? (sv.done ? '#35e08a' : '#f5b83d') : '#4b5568', '#111', 4);
      text(open ? String(i + 1) : '🔒', n[0], n[1] + (hot && open ? 2 : 0), 30, open ? '#111' : '#9aa3b5', 'center'); text(Lg(LV.names[i], LV.namesEn[i]), n[0], n[1] + 62, 17, open ? '#fff' : '#9aa3b5', 'center', true, '#111');
      if (sv.done) starRow(n[0] - 22, n[1] - 54, sv.stars, 20);
      if (open) buttons.push({ x: n[0] - 40, y: n[1] - 40, w: 80, h: 80, fn: () => loadLevel(i) });
      if (cur) drawHero(n[0], n[1] - 40 + Math.sin(T * 4) * 3, 1, T, {});
    });
    button(Lg('🛒 升級商店', '🛒 Upgrades'), 40, H - 70, 170, 48, () => { state = 'shop'; stateT = 0; }, { size: 19 });
    button(Lg('回標題', 'Title'), 226, H - 70, 110, 48, () => { state = 'title'; }, { size: 17, color: '#9aa3b5' });
    if (lvSave(LV.count - 1).done) button(Lg('觀看結局', 'Ending'), 352, H - 70, 130, 48, () => { state = 'ending'; stateT = 0; }, { size: 17, color: '#7de3ff' });
    text(Lg('★ 過關　★ 收齊 3 個股權碎片　★ 全程不受傷', '★ Clear  ★ All 3 shares  ★ No damage'), W - 30, H - 46, 15, 'rgba(255,255,255,.85)', 'right', false);
  }
  function drawShop() {
    drawBG(TH.fab, T * 10, T); dim(0.5); panel(120, 40, W - 240, H - 80);
    text(Lg('升級商店', 'Upgrade Shop'), 160, 84, 30, '#ffd23f'); drawChip(W - 280, 84, T, 1); text('× ' + SV.coins, W - 256, 84, 24, '#fff');
    UPG.forEach((u, i) => {
      const y = 126 + i * 68, lv = upg(u.id), full = lv >= u.max, can = SV.coins >= u.cost && !full;
      rr(150, y, W - 300, 58, 12, '#141a29', '#26304a', 2); text(Lg(u.name, u.nameEn) + (u.max > 1 ? '　' + lv + ' / ' + u.max : ''), 172, y + 20, 20, '#fff'); text(Lg(u.desc, u.descEn), 172, y + 42, 15, '#9aa3b5', 'left', false);
      button(full ? Lg('已擁有', 'Owned') : '🪙 ' + u.cost, W - 290, y + 9, 120, 40, () => { SV.coins -= u.cost; SV.upg[u.id] = lv + 1; save(); SFX.share(); }, { size: 17, disabled: !can, color: full ? '#35e08a' : '#f5b83d' });
    });
    button(Lg('返回地圖', 'Back to map'), W / 2 - 80, H - 96, 160, 44, () => { state = 'map'; }, { size: 18, color: '#7de3ff' });
  }
  function drawPause() {
    drawPlay(); dim(0.6); panel(W / 2 - 190, 130, 380, 290); text(Lg('暫停', 'Paused'), W / 2, 176, 34, '#ffd23f', 'center');
    button(Lg('繼續', 'Resume'), W / 2 - 110, 210, 220, 48, () => { state = 'play'; }, { size: 20 });
    button(Lg('重新開始這一關', 'Restart stage'), W / 2 - 110, 270, 220, 44, () => loadLevel(G.i), { size: 17, color: '#7de3ff' });
    button(Lg('回到地圖', 'Stage map'), W / 2 - 110, 324, 220, 44, () => { state = 'map'; }, { size: 17, color: '#9aa3b5' });
    button(SV.mute ? Lg('🔇 聲音關', '🔇 Sound off') : Lg('🔊 聲音開', '🔊 Sound on'), W / 2 - 110, 378, 220, 30, () => { SV.mute = !SV.mute; save(); }, { size: 14, color: '#4b5568', tcol: '#fff' });
    if (root.SC) button(Lg('EN', '中文'), W / 2 + 120, 140, 60, 30, () => root.SC.toggleLang(), { size: 14, color: '#4b5568', tcol: '#fff' });
    if (pressed.pause || pressed.ok) state = 'play';
  }
  function drawClear() {
    drawPlay(); dim(0.55); const r = lastResult; panel(W / 2 - 240, 70, 480, 400);
    text(Lg('過關！', 'Stage Clear!'), W / 2, 118, 40, '#ffd23f', 'center'); const n = Math.min(r.stars, Math.floor(stateT / 0.35)); starRow(W / 2 - 62, 180, n, 56);
    text(Lg('時間　', 'Time  ') + fmtTime(r.time), W / 2, 244, 20, '#fff', 'center', false); text(Lg('算力晶片　+', 'Chips  +') + r.coins, W / 2, 276, 20, '#ffd23f', 'center', false);
    text(Lg('股權碎片　', 'Shares  ') + r.shares + ' / 3' + (r.newShares ? Lg('（新取得 ' + r.newShares + '）', ' (' + r.newShares + ' new)') : ''), W / 2, 308, 20, '#7de3ff', 'center', false);
    text(r.hits === 0 ? Lg('全程無傷，太強了！', 'No damage. Amazing!') : Lg('受傷或重來 ' + r.hits + ' 次', 'Hit or retried ' + r.hits + ' times'), W / 2, 340, 17, '#9aa3b5', 'center', false);
    button(r.last ? Lg('觀看結局 ▶', 'Ending ▶') : Lg('下一關 ▶', 'Next stage ▶'), W / 2 - 110, 372, 220, 50, () => { if (r.last) { state = 'ending'; stateT = 0; } else loadLevel(G.i + 1); }, { size: 21 });
    button(Lg('回到地圖', 'Map'), W / 2 - 220, 380, 100, 38, () => { state = 'map'; }, { size: 15, color: '#9aa3b5' });
    button(Lg('再玩一次', 'Retry'), W / 2 + 120, 380, 100, 38, () => loadLevel(G.i), { size: 15, color: '#7de3ff' });
    if (pressed.ok && stateT > 1) { if (r.last) { state = 'ending'; stateT = 0; } else loadLevel(G.i + 1); }
  }
  function drawEnding() {
    const e = ending(); drawBG(TH.roof, T * 20, T); dim(0.35);
    for (let i = 0; i < 40; i++) { const x = (i * 131 + T * 40 * (1 + i % 3)) % W, y = (i * 71 + T * 90 * (1 + i % 2)) % H; c.fillStyle = ['#ff5b5b', '#ffd23f', '#7de3ff', '#35e08a'][i % 4]; c.fillRect(x, y, 7, 7); }
    rr(W / 2 - 150, 250, 300, 30, 6, '#3b4256', '#111', 3); drawHero(W / 2, 250, 1, T, { air: Math.sin(T * 6) > 0.6 });
    text(e[0], W / 2, 80, 40, '#ffd23f', 'center', true, '#111'); panel(130, 310, W - 260, 150); wrapText(e[1], 160, 348, W - 320, 20, '#fff', 30);
    button(Lg('回到地圖', 'Stage map'), W / 2 - 90, 476, 180, 44, () => { SV.ended = true; save(); state = 'map'; }, { size: 18 });
    text(Lg('本遊戲人物、公司與情節純屬虛構。', 'All characters, companies and events are fictional.'), W / 2, 140, 15, 'rgba(255,255,255,.8)', 'center', false);
  }

  /* ---------- 主迴圈 ---------- */
  function step(dt) {
    T += dt; stateT += dt; buttons = [];
    if (pressed.mute) { SV.mute = !SV.mute; save(); }
    if (state === 'play') { updatePlay(dt); if (state === 'play' || state === 'clear') drawPlay(); else drawPause(); if (state === 'clear') drawClear(); }
    else if (state === 'pause') drawPause(); else if (state === 'clear') drawClear(); else if (state === 'title') { drawTitle(); if (pressed.ok) { if (!SV.seenStory) { state = 'story'; storyI = 0; } else state = 'map'; } }
    else if (state === 'story') drawStory(); else if (state === 'map') drawMap(); else if (state === 'shop') drawShop(); else if (state === 'ending') drawEnding();
    for (const k in pressed) delete pressed[k];
    const tc = document.getElementById('touch'); if (tc) tc.className = state === 'play' ? 'on' : '';
    document.body.setAttribute('data-state', state);
  }
  let last = 0;
  function frame(ts) { const dt = clamp((ts - last) / 1000 || 0, 0, 1 / 30); last = ts; step(dt); root.requestAnimationFrame(frame); }
  // App 套殼與背景：切到背景自動暫停、返回鍵逐層退出、過關通知原生端
  function releaseKeys() { for (const k in keys) keys[k] = false; }
  root.addEventListener('blur', releaseKeys);
  if (root.SC) {
    root.SC.onPause(() => { releaseKeys(); if (state === 'play') { state = 'pause'; stateT = 0; } });
    root.SC.onBack(() => {
      releaseKeys();
      if (state === 'play') { state = 'pause'; stateT = 0; return true; }
      if (state === 'pause') { state = 'play'; return true; }
      if (state === 'map') { state = 'title'; return true; }
      if (state === 'shop' || state === 'story' || state === 'ending' || state === 'clear') { state = 'map'; stateT = 0; return true; }
      return false;
    });
  }
  root.AIG = { step, keys, setKey, get state() { return state; }, get G() { return G; }, loadLevel, SV: () => SV };
  root.requestAnimationFrame(frame);
})(typeof window !== 'undefined' ? window : globalThis);
