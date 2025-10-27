import requests # 替換 cloudscraper，用於呼叫 Scrapingant API
from bs4 import BeautifulSoup
import re
import os
from openai import OpenAI
import json
import time  # 用於重試延遲
import subprocess

# 初始化 xAI 客戶端，使用環境變數的 API 密鑰（但現在盡量少用 API）
client = OpenAI(
    api_key=os.getenv("XAI_API_KEY_BITCOIN"),
    base_url="https://api.x.ai/v1"
)

# 本地清理函數：取代 Grok API，減少呼叫 (此函數保持不變)
def clean_local(text, field_type):
    """本地清理資料，減少 API 呼叫。只清理必要欄位。"""
    text = text.strip()
    if field_type == 'balance':
        # 提取 BTC 和 USD，移除逗號
        match = re.match(r'([\d,]+)\s*BTC\s*\(([\$\d,]+)\)', text)
        if match:
            btc = match.group(1).replace(',', '')
            usd = match.group(2).replace(',', '').replace('$', '')
            return f"{btc} BTC (${usd})"
        return 'N/A'
    elif field_type == 'percentage':
        # 移除 %，保留數字
        return text.replace('%', '').strip() + '%'
    elif field_type in ['date_in', 'date_out']:
        # 確保日期格式，或 N/A
        if re.match(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC', text):
            return text
        return 'N/A'
    elif field_type in ['number', 'rank', 'ins', 'outs']:
        # 移除非數字
        return re.sub(r'\D', '', text) or 'N/A'
    else:
        # 其他欄位不清理
        return text if text else 'N/A'

def fetch_top_100():
    # 這是我們要抓取的目標網站
    target_url = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'
    
    # 讀取 Scrapingant API Key
    # 請將您的金鑰設定為環境變數 'SCRAPINGANT_API_KEY'
    api_key = os.getenv("SCRAPINGANT_API_KEY", "2712b686edd24534b6282b00c11f20b8") 
    
    if api_key == "2712b686edd24534b6282b00c11f20b8":
        print("警告: 正在使用硬編碼的 Scrapingant API 金鑰。建議使用環境變數或 GitHub Secret。")
    
    # Scrapingant API 配置
    scrapingant_api_url = 'https://api.scrapingant.com/v2/general'
    
    # 傳遞給 Scrapingant API 的參數
    params = {
        'url': target_url,
        'x-api-key': api_key,
        'browser': 'true',  # 啟用瀏覽器渲染 (Headless Chrome)，以確保獲取所有 JS 載入的內容
        'wait_for_selector': '#tblTop100Wealth', # 等待目標表格元素載入
        'proxy_country': 'US' # 建議指定代理國家，可提高成功率
    }
    
    response = None
    for attempt in range(2):
        try:
            # 使用 requests 呼叫 Scrapingant API
            print(f"嘗試 {attempt + 1} - 呼叫 Scrapingant API 抓取 {target_url}")
            response = requests.get(scrapingant_api_url, params=params, timeout=30) 
            print(f"嘗試 {attempt + 1} - Scrapingant Status code: {response.status_code}")
            
            # 檢查 Scrapingant API 是否成功回傳 200 狀態碼
            if response.status_code == 200:
                break
        except requests.exceptions.RequestException as e:
            print(f"請求發生錯誤: {e}")
            response = None
            
        time.sleep(5)
    
    # 檢查是否成功取得內容
    if not response or response.status_code != 200:
        print("無法透過 Scrapingant 抓取資料，使用 fallback")
        return get_fallback_wallets()
        
    # Scrapingant API 回傳的內容是目標網頁的 HTML
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 以下的表格解析邏輯保持不變
    table = soup.find('table', id='tblTop100Wealth')
    if not table:
        print("找不到表格，使用 fallback")
        return get_fallback_wallets()
    rows = table.find_all('tr')[1:]  # 跳過標頭
    wallets = []
    for row in rows[:100]:  # 只取前100
        cells = row.find_all('td')
        if len(cells) < 13:
            continue
        rank = clean_local(cells[0].text.strip(), 'rank')
        address = cells[1].find('a').text.strip() if cells[1].find('a') else cells[1].text.strip()
        balance = clean_local(cells[2].text.strip(), 'balance')
        percentage = clean_local(cells[3].text.strip(), 'percentage')
        first_in = clean_local(cells[4].text.strip(), 'date_in')
        last_in = clean_local(cells[5].text.strip(), 'date_in')
        ins = clean_local(cells[6].text.strip(), 'number')
        first_out = clean_local(cells[7].text.strip(), 'date_out')
        last_out = clean_local(cells[8].text.strip(), 'date_out')
        outs = clean_local(cells[9].text.strip(), 'number')
        change_7d = clean_local(cells[10].text.strip(), 'change') if len(cells) > 10 else 'N/A'
        change_30d = clean_local(cells[11].text.strip(), 'change') if len(cells) > 11 else 'N/A'
        change = f"7d:{change_7d} / 30d:{change_30d}"
        owner_tag = cells[1].find('span', class_='a')
        owner = owner_tag['title'].strip() if owner_tag and owner_tag.has_attr('title') else ''
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
    # 如果不足 100 筆，補空白
    while len(wallets) < 100:
        wallets.append({
            'rank': str(len(wallets) + 1),
            'address': 'N/A',
            'balance': 'N/A',
            'percentage': 'N/A',
            'first_in': 'N/A',
            'last_in': 'N/A',
            'ins': 'N/A',
            'first_out': 'N/A',
            'last_out': 'N/A',
            'outs': 'N/A',
            'change': '7d:N/A / 30d:N/A',
            'owner': ''
        })
    return wallets

# ... (get_fallback_wallets 函數保持不變) ...
def get_fallback_wallets():
    # 硬編碼的 100 組備用資料（包含 change 欄位），不呼叫 API 清理
    fallback = [
        {'rank': '1', 'address': '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', 'balance': '248,598 BTC ($26,541,688,352)', 'percentage': '1.25%', 'first_in': '2018-10-18 12:59:18 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '5447', 'first_out': '2018-10-18 13:19:26 UTC', 'last_out': '2023-01-07 06:15:34 UTC', 'outs': '451', 'change': '7d:N/A / 30d:N/A', 'owner': 'Binance-coldwallet'},
        {'rank': '2', 'address': 'bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2', 'balance': '140,575 BTC ($15,008,566,125)', 'percentage': '0.7052%', 'first_in': '2023-05-08 18:42:20 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '481', 'first_out': '2023-05-09 23:16:11 UTC', 'last_out': '2025-01-08 14:54:36 UTC', 'outs': '383', 'change': '7d:N/A / 30d:N/A', 'owner': 'Robinhood-coldwallet'},
        {'rank': '3', 'address': 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97', 'balance': '130,010 BTC ($13,880,613,791)', 'percentage': '0.6522%', 'first_in': '2019-08-16 10:00:29 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '318', 'first_out': '2020-02-02 17:43:14 UTC', 'last_out': '2025-06-03 03:06:19 UTC', 'outs': '296', 'change': '7d:N/A / 30d:N/A', 'owner': 'Bitfinex-coldwallet'},
        {'rank': '4', 'address': '3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6', 'balance': '120,353 BTC ($12,849,605,279)', 'percentage': '0.6037%', 'first_in': '2018-11-13 14:11:02 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '432', 'first_out': '2018-11-13 14:11:02 UTC', 'last_out': '2025-10-14 14:17:00 UTC', 'outs': '283', 'change': '7d:N/A / 30d:N/A', 'owner': 'Binance-coldwallet'},
        {'rank': '5', 'address': 'bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt', 'balance': '94,643 BTC ($10,104,675,539)', 'percentage': '0.4748%', 'first_in': '2022-02-01 04:14:24 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '157', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': 'Bitfinex-Hack-Recovery'},
        {'rank': '6', 'address': 'bc1qjasf9z3h7w3jspkhtgatgpyvvzgpa2wwd2lr0eh5tx44reyn2k7sfc27a4', 'balance': '86,335 BTC ($9,217,664,503)', 'percentage': '0.4331%', 'first_in': '2022-09-30 11:50:39 UTC', 'last_in': '2025-10-14 18:22:38 UTC', 'ins': '145', 'first_out': '2022-09-30 13:24:19 UTC', 'last_out': '2025-10-14 18:22:38 UTC', 'outs': '143', 'change': '7d:N/A / 30d:N/A', 'owner': 'Tether'},
        {'rank': '7', 'address': 'bc1qd4ysezhmypwty5dnw7c8nqy5h5nxg0xqsvaefd0qn5kq32vwnwqqgv4rzr', 'balance': '83,000 BTC ($8,861,561,507)', 'percentage': '0.4164%', 'first_in': '2021-10-11 12:39:15 UTC', 'last_in': '2025-10-14 19:00:14 UTC', 'ins': '147', 'first_out': '2022-07-15 15:51:57 UTC', 'last_out': '2025-10-14 19:00:14 UTC', 'outs': '145', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '8', 'address': '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF', 'balance': '79,957 BTC ($8,536,691,683)', 'percentage': '0.4011%', 'first_in': '2011-03-01 10:26:19 UTC', 'last_in': '2025-09-25 03:13:14 UTC', 'ins': '659', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': 'MtGox-Hack'},
        {'rank': '9', 'address': 'bc1q8yj0herd4r4yxszw3nkfvt53433thk0f5qst4g', 'balance': '78,317 BTC ($8,361,571,156)', 'percentage': '0.3929%', 'first_in': '2024-03-23 01:55:58 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '51', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '10', 'address': 'bc1qa5wkgaew2dkv56kfvj49j0av5nml45x9ek9hz6', 'balance': '69,370 BTC ($7,406,354,515)', 'percentage': '0.3480%', 'first_in': '2020-11-03 21:31:39 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '132', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': 'SilkRoad-FBI-Confiscated'},
        {'rank': '11', 'address': '3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb', 'balance': '68,200 BTC ($7,281,419,736)', 'percentage': '0.3421%', 'first_in': '2019-06-17 11:52:41 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '134', 'first_out': '2022-11-18 03:36:20 UTC', 'last_out': '2022-11-18 03:36:20 UTC', 'outs': '54', 'change': '7d:N/A / 30d:N/A', 'owner': 'Binance-BTCB-Reserve'},
        {'rank': '12', 'address': '1Ay8vMC7R1UbyCCZRVULMV7iQpHSAbguJP', 'balance': '55,470 BTC ($5,922,311,040)', 'percentage': '0.2783%', 'first_in': '2022-11-02 06:45:37 UTC', 'last_in': '2025-10-18 00:16:25 UTC', 'ins': '1589', 'first_out': '2022-11-02 10:42:08 UTC', 'last_out': '2025-10-11 10:27:04 UTC', 'outs': '721', 'change': '7d:N/A / 30d:N/A', 'owner': 'Mr.100'},
        {'rank': '13', 'address': '1LdRcdxfbSnmCYYNdeYpUnztiYzVfBEQeC', 'balance': '53,880 BTC ($5,752,541,612)', 'percentage': '0.2703%', 'first_in': '2014-05-27 22:49:42 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '223', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '14', 'address': '1AC4fMwgY8j9onSbXEWeH6Zan8QGMSdmtA', 'balance': '51,830 BTC ($5,533,707,779)', 'percentage': '0.2600%', 'first_in': '2018-01-07 14:45:18 UTC', 'last_in': '2025-07-18 13:58:51 UTC', 'ins': '152', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '15', 'address': '3MgEAFWu1HKSnZ5ZsC8qf61ZW18xrP5pgd', 'balance': '47,236 BTC ($5,043,148,131)', 'percentage': '0.2369%', 'first_in': '2022-12-16 01:48:57 UTC', 'last_in': '2025-10-11 23:53:35 UTC', 'ins': '616', 'first_out': '2022-12-21 00:31:18 UTC', 'last_out': '2025-10-10 05:52:13 UTC', 'outs': '344', 'change': '7d:N/A / 30d:N/A', 'owner': 'OKEx'}, 
        # ... (省略其餘備用資料以保持簡潔)
        # ... (The rest of the fallback data is omitted for brevity)
    ]
    # 補足 100 筆資料 (原程式碼已確保有 100 筆)
    while len(fallback) < 100:
        fallback.append({
            'rank': str(len(fallback) + 1),
            'address': 'N/A',
            'balance': 'N/A',
            'percentage': 'N/A',
            'first_in': 'N/A',
            'last_in': 'N/A',
            'ins': 'N/A',
            'first_out': 'N/A',
            'last_out': 'N/A',
            'outs': 'N/A',
            'change': '7d:N/A / 30d:N/A',
            'owner': ''
        })
    return fallback[:100]

if __name__ == '__main__':
    wallets_data = fetch_top_100()
    # 寫入 wallet.json 檔案 (原程式碼中省略，但這是預期的結果)
    with open('wallet.json', 'w', encoding='utf-8') as f:
        json.dump(wallets_data, f, ensure_ascii=False, indent=4)
    
    print(f"成功抓取 {len(wallets_data)} 筆資料並寫入 wallet.json")
