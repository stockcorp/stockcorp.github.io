# 產生各遊戲的中英雙語隱私權頁：python3 tools/privacy.py
import os
G = {
 'ai': ('搶救 AI 教父大作戰', 'Save the AI Godfather', '#0b0f19', False),
 'darkchess': ('暗棋破壞神', 'Dark Chess Destroyer', '#120c08', True),
 'xiangqi': ('象棋', 'Xiangqi', '#120c08', True),
}
T = '''<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title data-en="Privacy Policy | {en}">隱私權政策與廣告說明｜{zh}</title><meta name="robots" content="index,follow">
<script src="/shared/app.js?v=1.2"></script>
<style>body{{margin:0;background:{bg};color:#e8e2d6;font-family:-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}}.doc{{max-width:760px;margin:0 auto;padding:24px 20px 60px;line-height:1.8}}.doc h1{{font-size:24px;color:#f0c46a}}.doc h2{{font-size:18px;color:#ffe2b8;margin-top:22px}}a{{color:#f0c46a}}
html[lang=en] .zh,html:not([lang=en]) .en{{display:none}}.lb{{float:right;background:#2a2a33;color:#fff;border:1px solid #555;border-radius:10px;padding:5px 12px;cursor:pointer}}</style></head>
<body><div class="doc">
<p><a href="./" data-en="← Back to the game">← 回到遊戲</a><button class="lb" data-lang-toggle>EN</button></p>
<div class="zh">
<h1>隱私權政策與廣告說明</h1><p>最後更新：2026 年 11 月 18 日</p>
<h2>1. 關於本網站</h2><p>「{zh}」是一款免費的網頁遊戲，網站託管於 GitHub Pages。</p>
<h2>2. 我們收集哪些資料</h2><p>本遊戲不需要註冊，不收集姓名、電子郵件等個人資料。遊戲進度、設定、語言偏好與戰績只儲存在你瀏覽器的 localStorage，不會上傳；清除瀏覽器資料即可刪除。</p>
<h2>3. Google AdSense 廣告與 Cookie（網頁版）</h2><p>網頁版使用 Google AdSense 顯示廣告。Google 及其合作夥伴可能使用 Cookie 或類似技術，依你造訪本網站或其他網站的紀錄投放廣告。你可以到 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 廣告設定</a>管理或關閉個人化廣告，詳情請參考 <a href="https://policies.google.com/technologies/ads?hl=zh-TW" target="_blank" rel="noopener">Google 如何使用廣告技術</a>。</p>
{zhnet}<h2>{n1}. App 版本</h2><p>若本遊戲以 App 形式提供，App 內不載入 AdSense；App 若有廣告或其他第三方服務，以該 App 在商店頁面公布的隱私權政策為準。</p>
<h2>{n2}. 第三方服務</h2><p>GitHub Pages 可能依其隱私權政策記錄基本連線資訊（例如 IP 位址）。除上述服務外，本網站未使用其他分析或追蹤工具。</p>
<h2>{n3}. 兒童</h2><p>本遊戲並非專為 13 歲以下兒童設計，我們不會刻意收集兒童的個人資料。</p>
<h2>{n4}. 更新</h2><p>本政策如有更新會公布在本頁。</p>
</div>
<div class="en">
<h1>Privacy Policy and Advertising</h1><p>Last updated: November 18, 2026</p>
<h2>1. About this site</h2><p>"{en}" is a free browser game hosted on GitHub Pages.</p>
<h2>2. What we collect</h2><p>No account is needed and we do not collect names, email addresses or other personal information. Your progress, settings, language and stats are stored only in your browser's localStorage and are never uploaded. Clear your browser data to delete them.</p>
<h2>3. Google AdSense and cookies (web version)</h2><p>The web version shows ads through Google AdSense. Google and its partners may use cookies or similar technologies to serve ads based on your visits to this and other websites. You can manage or turn off personalized ads in <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ad Settings</a>. See <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">how Google uses advertising technology</a>.</p>
{ennet}<h2>{n1}. App versions</h2><p>If this game is offered as an app, AdSense is not loaded inside the app. Any ads or third-party services in the app are covered by the privacy policy published on its store page.</p>
<h2>{n2}. Third-party services</h2><p>GitHub Pages may log basic connection data (such as IP addresses) under its own privacy policy. Apart from the services above, this site uses no other analytics or tracking tools.</p>
<h2>{n3}. Children</h2><p>This game is not directed at children under 13, and we do not knowingly collect their personal information.</p>
<h2>{n4}. Changes</h2><p>Any updates to this policy will be posted on this page.</p>
</div>
</div></body></html>
'''
ZHNET = '<h2>4. 線上對戰</h2><p>使用線上對戰時，你的瀏覽器會連到 PeerJS 公用配對伺服器（0.peerjs.com）與 Google、Cloudflare 的 STUN 伺服器來建立點對點（WebRTC）連線。連線建立後，對局資料直接在你和對手的裝置之間傳送，雙方的 IP 位址會被對方的瀏覽器得知。我們不保存房號、對局或聊天表情紀錄。</p>\n'
ENNET = '<h2>4. Online play</h2><p>When you play online, your browser connects to the public PeerJS matchmaking server (0.peerjs.com) and to Google and Cloudflare STUN servers to set up a peer-to-peer (WebRTC) connection. Once connected, game data travels directly between you and your opponent, and each browser can see the other\'s IP address. We do not store room codes, games or emotes.</p>\n'
root = os.path.join(os.path.dirname(__file__), '..')
for d, (zh, en, bg, net) in G.items():
    n = [5, 6, 7, 8] if net else [4, 5, 6, 7]
    html = T.format(zh=zh, en=en, bg=bg, zhnet=ZHNET if net else '', ennet=ENNET if net else '', n1=n[0], n2=n[1], n3=n[2], n4=n[3])
    open(os.path.join(root, d, 'privacy.html'), 'w', encoding='utf-8').write(html)
    print('wrote', d)
