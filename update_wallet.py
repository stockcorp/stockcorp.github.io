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
        return []  # fallback to empty or hardcoded
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', id='tblTop100Wealth')
    if not table:
        print("找不到表格")
        return []
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
    if wallets:
        update_html_file(wallets)
    else:
        print("無新資料，保持原樣")
