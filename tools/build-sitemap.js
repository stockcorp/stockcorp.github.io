// 依 shared/games.js 的遊戲清單產生 sitemap.xml（含中英 hreflang）
// 用法：node tools/build-sitemap.js　　GitHub Actions 會在遊戲清單或頁面變動時自動執行
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), SITE = 'https://stockcorp.github.io';
const ctx = { window: { SC_IS_APP: true }, document: { currentScript: null } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'shared/games.js'), 'utf8'), ctx);
const games = ctx.window.SC_GAMES;
if (!Array.isArray(games) || !games.length) throw new Error('SC_GAMES not found');
function lastmod(rel) {
  try { const d = cp.execSync('git log -1 --format=%cs -- "' + rel + '"', { cwd: ROOT }).toString().trim(); if (d) return d; } catch (e) { /* 沒有 git 就用今天 */ }
  return new Date().toISOString().slice(0, 10);
}
const urls = [];
// 根目錄是遊戲大廳
urls.push({ loc: SITE + '/', mod: lastmod('index.html'), pri: '1.0', freq: 'weekly', alt: true });
urls.push({ loc: SITE + '/leaderboard/', mod: lastmod('leaderboard'), pri: '0.8', freq: 'daily', alt: true });
if (fs.existsSync(path.join(ROOT, 'privacy.html'))) urls.push({ loc: SITE + '/privacy.html', mod: lastmod('privacy.html'), pri: '0.3', freq: 'yearly', alt: true });
games.forEach((g, i) => {
  const dir = g.url.replace(/^\//, ''), idx = dir + 'index.html';
  if (!fs.existsSync(path.join(ROOT, idx))) { console.warn('skip (missing):', idx); return; }
  urls.push({ loc: SITE + g.url, mod: lastmod(dir || 'index.html'), pri: '0.9', freq: 'weekly', alt: true });
  const pv = dir + 'privacy.html';
  if (fs.existsSync(path.join(ROOT, pv))) urls.push({ loc: SITE + '/' + pv, mod: lastmod(pv), pri: '0.3', freq: 'yearly', alt: true });
});
const alt = u => ['zh-Hant', 'en'].map(l => '    <xhtml:link rel="alternate" hreflang="' + l + '" href="' + u + '?lang=' + (l === 'en' ? 'en' : 'zh') + '"/>').join('\n') + '\n    <xhtml:link rel="alternate" hreflang="x-default" href="' + u + '"/>';
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- 由 tools/build-sitemap.js 依 shared/games.js 自動產生，請勿手動修改 -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  urls.map(u => '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + u.mod + '</lastmod>\n    <changefreq>' + u.freq + '</changefreq>\n    <priority>' + u.pri + '</priority>\n' + (u.alt ? alt(u.loc) + '\n' : '') + '  </url>').join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log('sitemap.xml:', urls.length, 'urls,', games.length, 'games');
