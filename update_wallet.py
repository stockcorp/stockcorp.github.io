import requests # 改用標準 requests，通常更快
from bs4 import BeautifulSoup
import re
import os
import json
import time
from copy import deepcopy

# -----------------
# Configuration
# -----------------
WALLET_FILE = 'wallet.json'
# 新的目標 URL：CoinCarp 的比特幣富豪榜
TARGET_URL = 'https://www.coincarp.com/currencies/bitcoin/richlist/'

# 為了模擬瀏覽器，使用真實的請求頭
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7'
}

# -----------------
# Data Cleaning & Fallback (保持穩定版本)
# -----------------
def clean_local(text, field_type):
    """本地清理資料。由於 CoinCarp 提供的欄位較少，我們只處理可得的欄位。"""
    text = text.strip()
    if field_type == 'balance':
        # 匹配 CoinCarp 可能的格式: "348,779 BTC ($23,197,351,190)"
        match = re.search(r'([\d,]+\s*BTC)', text)
        if match:
             return match.group(0).strip() + text[text.find('('):].strip() if text.find('(') != -1 else match.group(0).strip()
        
        # 嘗試從純數字中提取 BTC 餘額
        match_btc = re.search(r'([\d,.]+)\s*BTC', text, re.IGNORECASE)
        if match_btc:
             btc_part = match_btc.group(1).replace(',', '').strip()
             # 簡單模擬 USD 估值 (這部分可能不準確，但符合原JSON格式)
             return f"{match_btc.group(1)} BTC (USD估值 N/A)"
        
        return 'N/A'
        
    elif field_type == 'percentage':
        # 匹配 CoinCarp 的百分比格式
        match = re.search(r'(\d+\.?\d*%)', text)
        return match.group(1).strip() if match else 'N/A'
        
    elif field_type in ['number', 'rank']:
        return re.sub(r'\D', '', text) or 'N/A'
    
    # 對於 CoinCarp 不提供的欄位 (如 first_in/out, change)，直接返回 N/A 模板
    return text if text else 'N/A'

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
# Data Fetching (CoinCarp 專用)
# -----------------
def fetch_top_100():
    """從 CoinCarp 網站抓取最新的前 100 大錢包數據。"""
    print(f"嘗試從 CoinCarp ({TARGET_URL}) 抓取數據...")
    response = None
    
    for attempt in range(2): 
        try:
            # 使用標準 requests 庫和 HEADERS
            response = requests.get(TARGET_URL, headers=HEADERS, timeout=10)
            print(f"嘗試 {attempt + 1} - Status code: {response.status_code}")
            response.raise_for_status() # 如果狀態碼不是 200，則拋出異常
            break
        except requests.exceptions.RequestException as e:
            print(f"抓取發生錯誤: {e}")
            time.sleep(5)

    if response is None or response.status_code != 200:
        print("無法取得 CoinCarp 網站內容。")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # CoinCarp 的表格查找策略：
    # 查找 class 包含 'richlist_table' 或 'table' 且包含關鍵標頭的表格
    table = None
    print("嘗試查找 CoinCarp 表格...")
    for t in soup.find_all('table'):
        header_row = t.find('thead') or t.find('tr')
        # 查找包含 Rank, Address, Balance 關鍵字的表格
        if header_row and ('Rank' in header_row.text and 'Address' in header_row.text and 'Balance' in header_row.text):
             table = t
             print("成功找到 CoinCarp 數據表格。")
             break
    
    if not table:
        print("無法從 CoinCarp HTML 中找到包含錢包數據的表格。")
        return []

    # --- 數據提取 ---
    rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]
    wallets = []
    
    for row in rows[:100]:
        cells = row.find_all('td')
        # CoinCarp 表格欄位較少，可能只有 4-6 欄
        if len(cells) < 4:
            continue
        
        # 欄位提取邏輯 (CoinCarp 結構)
        rank = clean_local(cells[0].text.strip(), 'rank')
        
        # Address 欄位
        address_cell_text = cells[1].text.strip()
        owner_tag = cells[1].find('span', class_='text-gray-500') # 假設 owner 是以灰色文字顯示
        owner = owner_tag.text.strip() if owner_tag else ''
        
        # 清理地址
        address = address_cell_text.replace(owner, '').strip()
        if address.startswith('...'): # 移除可能的前綴
             address = address.replace('...', '').strip()
             
        # Balance 欄位
        balance = clean_local(cells[2].text.strip(), 'balance')
        
        # Percentage 欄位
        percentage = clean_local(cells[3].text.strip(), 'percentage')
        
        # 由於 CoinCarp 不提供 First/Last In/Out 和 Change 等細節數據
        # 我們必須使用 N/A 填充，以符合您的 JSON 格式
        wallets.append({
            'rank': rank,
            'address': address,
            'balance': balance,
            'percentage': percentage,
            'first_in': 'N/A (CoinCarp無此數據)',
            'last_in': 'N/A (CoinCarp無此數據)',
            'ins': 'N/A',
            'first_out': 'N/A',
            'last_out': 'N/A',
            'outs': 'N/A',
            'change': '7d:N/A / 30d:N/A',
            'owner': owner
        })
    
    # 補足至 100 筆 N/A 資料 (如果 CoinCarp 的列表不滿 100)
    while len(wallets) < 100:
        wallets.append({
            'rank': str(len(wallets) + 1),
            'address': 'N/A',
            'balance': 'N/A',
            'percentage': 'N/A',
            'first_in': 'N/A (CoinCarp無此數據)',
            'last_in': 'N/A (CoinCarp無此數據)',
            'ins': 'N/A',
            'first_out': 'N/A',
            'last_out': 'N/A',
            'outs': 'N/A',
            'change': '7d:N/A / 30d:N/A',
            'owner': ''
        })
        
    print(f"成功從 CoinCarp 抓取 {len(wallets)} 筆有效數據。")
    return wallets

# -----------------
# Save Function (與上一個回答保持一致)
# -----------------
def save_wallets(wallets, filename=WALLET_FILE):
    """將最新的錢包列表寫回 JSON 檔案，直接覆蓋。"""
    if not wallets:
        print("警告：嘗試寫入空數據，已取消寫入。")
        return False
        
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(wallets, f, indent=4, ensure_ascii=False)
        print(f"成功將最新的 {len(wallets)} 筆數據寫入並覆蓋 {filename}。")
        return True
    except Exception as e:
        print(f"寫入檔案 {filename} 時發生錯誤: {e}")
        return False
        

# -----------------
# Main Execution Block (與上一個回答保持一致)
# -----------------
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (CoinCarp 網站模式) ---")
    
    # 1. 抓取最新的 CoinCarp 數據
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
        save_wallets(final_wallets, WALLET_FILE)
    else:
        print("未獲取到任何有效數據 (CoinCarp 和本地備用皆失敗)，腳本結束。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
