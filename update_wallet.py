import cloudscraper
from bs4 import BeautifulSoup
import re
import os
from openai import OpenAI
import json
import time
import subprocess
from copy import deepcopy # 雖然不再需要深層比對，但保留以防未來擴展

# -----------------
# Configuration
# -----------------
WALLET_FILE = 'wallet.json'
TARGET_URL = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'

# 初始化 xAI 客戶端 (保留原有的程式碼)
client = OpenAI(
    api_key=os.getenv("XAI_API_KEY_BITCOIN"),
    base_url="https://api.x.ai/v1"
)

# -----------------
# Data Cleaning (Keep existing)
# -----------------
def clean_local(text, field_type):
    """本地清理資料，減少 API 呼叫。只清理必要欄位。"""
    text = text.strip()
    if field_type == 'balance':
        # 提取 BTC 和 USD，移除逗號
        match = re.match(r'([\d,]+)\s*BTC\s*\(([\$\d,]+)\)', text)
        if match:
            btc = match.group(1).replace(',', '')
            usd = match.group(2).replace(',', '').replace('$', '')
            # 格式化為統一字串
            return f"{int(btc):,} BTC (${int(usd):,})" if btc.isdigit() and usd.isdigit() else f"{btc} BTC (${usd})"
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
    elif field_type == 'change':
        # 處理 Change 欄位，確保格式一致
        return text.strip() if text else 'N/A'
    else:
        # 其他欄位不清理
        return text if text else 'N/A'

# -----------------
# Data Fetching (Keep existing)
# -----------------
def fetch_top_100():
    """從目標網站抓取最新的前 100 大錢包數據。"""
    scraper = cloudscraper.create_scraper()
    response = None
    print(f"嘗試從 {TARGET_URL} 抓取數據...")
    for attempt in range(2):
        try:
            response = scraper.get(TARGET_URL, timeout=15)
            print(f"嘗試 {attempt + 1} - Status code: {response.status_code}")
            if response.status_code == 200:
                break
            time.sleep(5)
        except Exception as e:
            print(f"抓取發生錯誤: {e}")
            time.sleep(5)

    if response is None or response.status_code != 200:
        print("無法抓取資料，將使用本地 JSON 作為備用數據。")
        return get_fallback_wallets() # 失敗時呼叫 fallback

    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', id='tblTop100Wealth')
    if not table:
        print("找不到表格，將使用本地 JSON 作為備用數據。")
        return get_fallback_wallets()

    rows = table.find_all('tr')[1:]
    wallets = []
    for row in rows[:100]:
        cells = row.find_all('td')
        if len(cells) < 13:
            continue
        
        # 抓取和清理欄位
        rank = clean_local(cells[0].text.strip(), 'rank')
        address_cell = cells[1].find('a')
        address = address_cell.text.strip() if address_cell else cells[1].text.strip()
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
        
        # 重新格式化 change 欄位以確保一致性
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
    
    # 補足至 100 筆 N/A 資料 (保留原有邏輯)
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

# -----------------
# Fallback Function (使用本地 JSON 作為備用)
# -----------------
def get_fallback_wallets(filename=WALLET_FILE):
    """在抓取失敗時，從本地 JSON 讀取備用數據。"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                print(f"成功使用本地 {filename} 作為備用數據。")
                return json.load(f)
        else:
            print(f"本地 {filename} 也不存在，返回空列表。")
            return []
    except Exception as e:
        print(f"讀取本地備用檔案 {filename} 時發生錯誤: {e}")
        return []

# ----------------------------------------
# NEW/MODIFIED FUNCTION: Save (Keep simple)
# ----------------------------------------

def save_wallets(wallets, filename=WALLET_FILE):
    """將最新的錢包列表寫回 JSON 檔案，直接覆蓋。"""
    if not wallets:
        print("警告：嘗試寫入空數據，已取消寫入。")
        return False
        
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            # 確保 JSON 輸出易讀 (indent=4)
            json.dump(wallets, f, indent=4, ensure_ascii=False)
        print(f"成功將最新的 {len(wallets)} 筆數據寫入並覆蓋 {filename}。")
        return True
    except Exception as e:
        print(f"寫入檔案 {filename} 時發生錯誤: {e}")
        return False
        

# -----------------
# Main Execution Block (簡化為直接覆蓋)
# -----------------
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (直接覆蓋模式) ---")
    
    # 1. 抓取最新的網站數據 (失敗時會自動使用本地 JSON 作為備用)
    latest_wallets = fetch_top_100()
    
    # 2. 直接保存
    if latest_wallets:
        # 直接保存，不需要比對
        save_wallets(latest_wallets, WALLET_FILE)
    else:
        print("未獲取到任何有效數據 (網站和本地備用皆失敗)，腳本結束。")
    
    # 3. 如果在 GitHub Actions 中，需要判斷是否生成了新的 JSON 檔案
    #    這部分邏輯交給 `update-wallet.yml` 中的 Git 步驟處理

    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
