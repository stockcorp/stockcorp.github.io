import cloudscraper
from bs4 import BeautifulSoup
import re
import os
from openai import OpenAI
import json
import time
import subprocess
from copy import deepcopy

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
            # 這裡使用 int(btc) / int(usd) 轉型是為了移除小數點後面的零，但如果網站數據本身就有小數點，可能會出錯。
            # 為了穩定性，我們嘗試格式化為一致的字串格式
            try:
                # 嘗試轉換為整數後格式化
                return f"{int(float(btc)):,} BTC (${int(float(usd)):,})"
            except ValueError:
                # 如果無法轉換，則使用原始字串 (但這個網站應該是整數)
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
    elif field_type == 'change':
        # 處理 Change 欄位，確保格式一致
        return text.strip() if text else 'N/A'
    else:
        # 其他欄位不清理
        return text if text else 'N/A'

# -----------------
# Fallback Function (使用本地 JSON 作為備用)
# -----------------
def get_fallback_wallets(filename=WALLET_FILE):
    """在抓取失敗時，從本地 JSON 讀取備用數據。"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                print(f"**警告：無法取得最新數據，已使用本地 {filename} 作為備用。**")
                return json.load(f)
        else:
            print(f"**嚴重警告：本地 {filename} 也不存在，返回空列表。**")
            return []
    except Exception as e:
        print(f"**錯誤：讀取本地備用檔案 {filename} 時發生錯誤: {e}，返回空列表。**")
        return []

# -----------------
# Data Fetching (FIXED)
# -----------------
def fetch_top_100():
    """從目標網站抓取最新的前 100 大錢包數據。"""
    scraper = cloudscraper.create_scraper()
    response = None
    print(f"嘗試從 {TARGET_URL} 抓取數據...")
    
    # 嘗試抓取兩次
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
        print("無法取得網站內容。")
        return [] # 這裡不立即 fallback，讓 main 決定

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # --- 修正點 1: 尋找表格 ---
    table = soup.find('table', id='tblTop100Wealth')
    
    # 如果找不到特定 ID 的表格，嘗試尋找 class="table" 的表格（可能網站結構變動）
    if not table:
        print("找不到 ID 為 'tblTop100Wealth' 的表格，嘗試使用替代選擇器...")
        # 尋找包含 Rank, Address, Balance 等關鍵字作為標頭的表格
        for t in soup.find_all('table'):
            header_row = t.find('thead') or t.find('tr')
            if header_row and ('Rank' in header_row.text and 'Address' in header_row.text and 'Balance' in header_row.text):
                table = t
                print("成功找到包含關鍵標頭的表格。")
                break
    
    if not table:
        print("無法從抓取的 HTML 中找到包含錢包數據的表格。")
        return [] # 找不到表格則返回空列表，讓 main 決定

    # --- 修正點 2: 提取數據 ---
    rows = table.find_all('tr')[1:]
    wallets = []
    
    for row in rows[:100]:
        cells = row.find_all('td')
        # 確保至少有 12 個欄位 (Rank 到 30d Change)
        if len(cells) < 12:
            continue
        
        # 抓取和清理欄位
        rank = clean_local(cells[0].text.strip(), 'rank')
        address_cell = cells[1].find('a')
        # 如果找不到 <a> 標籤，則使用 cell 的純文字，但要先移除 owner 資訊
        address_text = cells[1].text.strip()
        owner_tag = cells[1].find('span', class_='a')
        owner = owner_tag['title'].strip() if owner_tag and owner_tag.has_attr('title') else ''
        
        # 從 address_text 中移除 owner 資訊，只保留地址本身
        if owner_tag:
             address = address_text.replace(owner_tag.text, '').strip()
        elif address_cell:
             address = address_cell.text.strip()
        else:
             address = address_text # 作為最終備用
             
        # 修正 address 欄位可能包含換行和空格的問題
        address = address.split('\n')[0].strip()
             
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
    
    # 補足至 100 筆 N/A 資料
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
        
    print(f"成功從網站抓取 {len(wallets)} 筆有效數據。")
    return wallets

# ----------------------------------------
# Save Function (Keep simple)
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
# Main Execution Block (修正 fallback 邏輯)
# -----------------
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (直接覆蓋模式 - 修正版) ---")
    
    # 1. 抓取最新的網站數據
    latest_wallets = fetch_top_100()
    
    # 2. 判斷是否成功抓取
    if not latest_wallets:
        # 如果抓取失敗 (返回空列表)，則使用本地 JSON 作為備用
        print("網站數據抓取失敗，嘗試使用本地備用數據。")
        final_wallets = get_fallback_wallets(WALLET_FILE)
    else:
        # 如果抓取成功，則使用網站數據
        final_wallets = latest_wallets

    # 3. 直接保存
    if final_wallets:
        # 直接保存，不需要比對
        save_wallets(final_wallets, WALLET_FILE)
    else:
        print("未獲取到任何有效數據 (網站和本地備用皆失敗)，腳本結束。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
