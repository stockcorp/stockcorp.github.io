import cloudscraper
from bs4 import BeautifulSoup
import os
from openai import OpenAI
import json
from datetime import datetime

# ✅ 初始化 OpenAI 客戶端（新版 SDK）
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY_BITCOIN"))

def clean_with_gpt(text):
    """
    使用 ChatGPT API 清理與格式化抓取的資料
    - 標準化時間格式
    - 移除多餘符號
    - 若資料錯誤則回傳 N/A
    """
    try:
        prompt = f"請清理以下抓取的資料，確保格式正確（例如，時間格式為 'YYYY-MM-DD HH:MM:SS UTC'，數值為數字或百分比），移除無效字元；若資料無效，返回 'N/A'：\n{text}"
        res = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=100
        )
        return res.choices[0].message.content.strip()
    except Exception as e:
        print(f"⚠️ ChatGPT 清理資料失敗: {e}")
        return text if text else "N/A"

def fetch_top_100():
    """抓取 BitInfoCharts 上的比特幣前 100 大錢包"""
    url = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'
    scraper = cloudscraper.create_scraper()
    response = scraper.get(url)
    print(f"🌐 抓取狀態: {response.status_code}")

    if response.status_code != 200:
        print("⚠️ 無法抓取資料，改用 fallback")
        return get_fallback_wallets()

    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', id='tblTop100Wealth')

    if not table:
        print("⚠️ 找不到表格，改用 fallback")
        return get_fallback_wallets()

    rows = table.find_all('tr')[1:]  # 跳過標題列
    wallets = []

    for row in rows[:100]:  # 只取前 100
        cells = row.find_all('td')
        if len(cells) < 10:
            continue

        rank = clean_with_gpt(cells[0].text.strip())
        address = cells[1].find('a').text.strip() if cells[1].find('a') else cells[1].text.strip()
        balance = clean_with_gpt(cells[2].text.strip())
        percentage = clean_with_gpt(cells[3].text.strip())
        first_in = clean_with_gpt(cells[4].text.strip())
        last_in = clean_with_gpt(cells[5].text.strip())
        ins = clean_with_gpt(cells[6].text.strip())
        first_out = clean_with_gpt(cells[7].text.strip())
        last_out = clean_with_gpt(cells[8].text.strip())
        outs = clean_with_gpt(cells[9].text.strip())
        change_7d = clean_with_gpt(cells[10].text.strip()) if len(cells) > 10 else 'N/A'
        change_30d = clean_with_gpt(cells[11].text.strip()) if len(cells) > 11 else 'N/A'
        change = f"7d:{change_7d} / 30d:{change_30d}"

        owner = ''
        span = cells[1].find('span', class_='a')
        if span and 'title' in span.attrs:
            owner = span['title']

        wallets.append({
            'rank': rank,
            'address': address,
            'balance': balance,
            'percentage': percentage,
            'first_in': first_in,
            'last_in': last_in,
            'ins': ins,
            'first_out': first_out,
            'last_out': last_out,
            'outs': outs,
            'change': change,
            'owner': owner
        })

    print(f"✅ 抓取完成，共 {len(wallets)} 筆")
    return wallets

def get_fallback_wallets():
    """當網站無法連線或結構變動時使用備用資料"""
    return [
        {
            'rank': '1',
            'address': '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
            'balance': '248,598 BTC ($26,541,688,352)',
            'percentage': '1.25%',
            'first_in': '2018-10-18 12:59:18 UTC',
            'last_in': '2025-10-13 06:51:51 UTC',
            'ins': '5447',
            'first_out': '2018-10-18 13:19:26 UTC',
            'last_out': '2023-01-07 06:15:34 UTC',
            'outs': '451',
            'change': '7d:N/A / 30d:N/A',
            'owner': 'Binance-coldwallet'
        }
    ]

def generate_html(wallets):
    """產生簡潔的 HTML 頁面輸出"""
    date_now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    html = f"""
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>比特幣前100大錢包狀態</title>
        <style>
            body {{
                font-family: "Segoe UI", "Microsoft JhengHei", sans-serif;
                background: #fafafa;
                color: #333;
                margin: 30px;
            }}
            h1 {{
                text-align: center;
                color: #222;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 8px;
                text-align: center;
            }}
            th {{
                background-color: #222;
                color: white;
            }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            tr:hover {{ background-color: #f1f1f1; }}
            footer {{
                text-align: center;
                margin-top: 40px;
                color: #888;
            }}
        </style>
    </head>
    <body>
        <h1>比特幣前100大錢包狀態</h1>
        <p style="text-align:center;">最後更新時間：{date_now}</p>
        <table>
            <tr>
                <th>排名</th>
                <th>地址</th>
                <th>餘額</th>
                <th>佔比</th>
                <th>首次入帳</th>
                <th>最近入帳</th>
                <th>入帳次數</th>
                <th>首次出帳</th>
                <th>最近出帳</th>
                <th>出帳次數</th>
                <th>變化 (7日 / 30日)</th>
                <th>錢包歸屬</th>
            </tr>
    """

    for w in wallets:
        html += f"""
        <tr>
            <td>{w['rank']}</td>
            <td><a href="https://www.blockchain.com/btc/address/{w['address']}" target="_blank">{w['address']}</a></td>
            <td>{w['balance']}</td>
            <td>{w['percentage']}</td>
            <td>{w['first_in']}</td>
            <td>{w['last_in']}</td>
            <td>{w['ins']}</td>
            <td>{w['first_out']}</td>
            <td>{w['last_out']}</td>
            <td>{w['outs']}</td>
            <td>{w['change']}</td>
            <td>{w['owner']}</td>
        </tr>
        """

    html += """
        </table>
        <footer>自動生成 by GitHub Actions · Powered by ChatGPT</footer>
    </body>
    </html>
    """

    with open("wallet.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("💾 已輸出 wallet.html")

def main():
    wallets = fetch_top_100()
    generate_html(wallets)

if __name__ == "__main__":
    main()
