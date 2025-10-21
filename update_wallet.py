import requests
from bs4 import BeautifulSoup
import re
import os

def fetch_top_100():
    url = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers)
    print(f"Status code: {response.status_code}")
    if response.status_code != 200:
        print("無法抓取資料，使用 fallback")
        return get_fallback_wallets()  # 使用 fallback 資料
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', id='tblTop100Wealth')
    if not table:
        print("找不到表格，使用 fallback")
        return get_fallback_wallets()  # 使用 fallback 資料
    rows = table.find_all('tr')[1:]  # 跳過標頭
    wallets = []
    for row in rows[:100]:  # 只取前100
        cells = row.find_all('td')
        if len(cells) < 11:
            continue
        rank = cells[0].text.strip()
        address = cells[1].find('a').text.strip() if cells[1].find('a') else cells[1].text.strip()
        balance = cells[2].text.strip()
        percentage = cells[3].text.strip()
        first_in = cells[4].text.strip()
        last_in = cells[5].text.strip()
        ins = cells[6].text.strip()
        first_out = cells[7].text.strip()
        last_out = cells[8].text.strip()
        outs = cells[9].text.strip()
        owner = cells[1].find('span', class_='a')['title'].strip() if cells[1].find('span', class_='a') else ''
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
            'owner': owner
        })
    return wallets

def get_fallback_wallets():
    # 硬編碼的 fallback 資料（這裡只示範前幾筆，您可以擴充到 100 筆）
    return [
        {'rank': '1', 'address': '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', 'balance': '248,598 BTC ($26,541,688,352)', 'percentage': '1.25%', 'first_in': '2018-10-18 12:59:18 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '5447', 'first_out': '2018-10-18 13:19:26 UTC', 'last_out': '2023-01-07 06:15:34 UTC', 'outs': '451', 'owner': 'Binance-coldwallet'},
        {'rank': '2', 'address': 'bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2', 'balance': '140,575 BTC ($15,008,566,125)', 'percentage': '0.7052%', 'first_in': '2023-05-08 18:42:20 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '481', 'first_out': '2023-05-09 23:16:11 UTC', 'last_out': '2025-01-08 14:54:36 UTC', 'outs': '383', 'owner': 'Robinhood-coldwallet'},
        # ... (添加剩餘 98 筆資料，類似結構)
        {'rank': '100', 'address': 'bc1q9l2cyuq3lhsu4nzzttsws6e852czq9', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'owner': ''}
    ]

def update_html_file(wallets):
    html_file = 'wallet.html'
    if not os.path.exists(html_file):
        print(f"{html_file} 不存在")
        return
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    # 找到 publicWhales 陣列並替換
    pattern = r"const publicWhales = \[\s*([\s\S]*?)\s*\];"
    new_array = "const publicWhales = [\n"
    for wallet in wallets:
        new_array += f" {{ rank: {wallet['rank']}, address: \"{wallet['address']}\", balance: \"{wallet['balance']}\", percentage: \"{wallet['percentage']}\", first_in: \"{wallet['first_in']}\", last_in: \"{wallet['last_in']}\", ins: {wallet['ins']}, first_out: \"{wallet['first_out']}\", last_out: \"{wallet['last_out']}\", outs: {wallet['outs']}, owner: \"{wallet['owner']}\" }},\n"
    new_array += "];"
    updated_content = re.sub(pattern, new_array, content)
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    print("wallet.html 已更新")

if __name__ == "__main__":
    wallets = fetch_top_100()
    update_html_file(wallets)  # 無論 wallets 是否為空，都強制更新（如果失敗，wallets 會是 fallback）
