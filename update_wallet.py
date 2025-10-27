import cloudscraper
from bs4 import BeautifulSoup
import re
import os
from openai import OpenAI
import json
import time
import subprocess
from copy import deepcopy # 引入 deepcopy 用於安全地修改資料結構

# -----------------
# Configuration
# -----------------
WALLET_FILE = 'wallet.json'
TARGET_URL = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'

# 初始化 xAI 客戶端 (保留原有的程式碼，雖然我們盡量使用本地清理)
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
            # 格式化為統一字串，方便比較
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
        print("無法抓取資料，使用 fallback 數據。")
        return get_fallback_wallets() # 使用原有的 fallback 函數

    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', id='tblTop100Wealth')
    if not table:
        print("找不到表格，使用 fallback 數據。")
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
        # 使用空字串代替 'N/A' 讓後續的 deepcopy 和比較更精確
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
# Fallback Function (Keep existing)
# -----------------
def get_fallback_wallets():
    """在抓取失敗時提供硬編碼的備用數據。"""
    # 由於檔案太大，此處僅保留函數名，實際內容在原始檔案中已存在
    # ... (原有約 100 筆硬編碼的 fallback 資料)
    
    # 從本地的 json 文件讀取作為 fallback (更安全的做法)
    try:
        with open(WALLET_FILE, 'r', encoding='utf-8') as f:
            print(f"嘗試使用本地 {WALLET_FILE} 作為備用數據。")
            return json.load(f)
    except FileNotFoundError:
        print(f"本地 {WALLET_FILE} 也不存在，使用程式碼內建的硬編碼資料。")
        # 由於我沒有完整的硬編碼資料，這裡假設您原有的程式碼中包含了完整的 fallback 列表
        # 如果沒有，請確保這裡能返回一個包含 100 個錢包的列表，以便程式繼續執行。
        # 為了演示，我使用一個空列表並發出警告
        return []
        
# ----------------------------------------
# NEW FUNCTIONS: Load, Compare, Update, Save
# ----------------------------------------

def load_local_wallets(filename=WALLET_FILE):
    """讀取本地 JSON 檔案，如果不存在則返回空列表。"""
    if not os.path.exists(filename):
        print(f"本地檔案 {filename} 不存在，將從頭創建。")
        return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        print(f"錯誤：本地檔案 {filename} 格式不正確，將忽略舊資料。")
        return []
    except Exception as e:
        print(f"讀取本地檔案 {filename} 時發生錯誤: {e}")
        return []

def compare_and_update_wallets(new_wallets_list, old_wallets_list):
    """
    比較新舊資料，並將異動欄位更新到舊資料結構中。
    
    Args:
        new_wallets_list: 從網站抓取到的最新錢包列表 (list of dicts)。
        old_wallets_list: 從本地 JSON 讀取的舊錢包列表 (list of dicts)。
        
    Returns:
        (updated_wallets_list, changes_made_flag)
    """
    changes_made = False
    
    # 1. 將舊列表轉換為以 'address' 為鍵的字典，方便查找 O(1)
    old_wallets_map = {wallet.get('address'): deepcopy(wallet) for wallet in old_wallets_list if wallet.get('address') and wallet.get('address') != 'N/A'}
    
    # 2. 處理新數據的排序和更新
    updated_wallets_list = []
    
    # 定義需要檢查變動的欄位 (address 是唯一鍵，rank/owner/change可能變動)
    CHECK_FIELDS = ['rank', 'balance', 'percentage', 'last_in', 'last_out', 'ins', 'outs', 'change', 'owner']
    
    for new_wallet in new_wallets_list:
        address = new_wallet.get('address')
        
        # 排除無效地址的資料 (例如補齊的 N/A 資料)
        if not address or address == 'N/A':
            updated_wallets_list.append(new_wallet)
            continue
            
        old_wallet = old_wallets_map.get(address)

        if old_wallet:
            # 地址存在於舊資料中：比對欄位並更新
            current_wallet = old_wallet # 使用舊資料的 deepcopy 版本作為基礎
            
            for field in CHECK_FIELDS:
                new_value = new_wallet.get(field)
                old_value = old_wallet.get(field)
                
                # 只有當新值不為空/N/A 且與舊值不同時，才更新並標記異動
                if new_value and new_value != 'N/A' and new_value != old_value:
                    print(f"  -> 異動: 地址 {address} 的 '{field}' 欄位已更新: '{old_value}' -> '{new_value}'")
                    current_wallet[field] = new_value
                    changes_made = True
            
            # 確保 'first_in' 和 'first_out' 欄位不會被新的 N/A 覆蓋
            for field in ['first_in', 'first_out']:
                if new_wallet.get(field) and new_wallet.get(field) != 'N/A' and not current_wallet.get(field):
                     current_wallet[field] = new_wallet.get(field)
                     changes_made = True
                     
            updated_wallets_list.append(current_wallet)
            # 從 map 中移除，剩下的就是被移除的舊地址
            old_wallets_map.pop(address, None)
            
        else:
            # 新地址：直接加入並標記異動
            print(f"  -> 新增: 發現新地址 {address}，已加入列表。")
            updated_wallets_list.append(new_wallet)
            changes_made = True
    
    # 3. 檢查是否有舊地址被移除或排名大幅變動
    # 這裡我們已經根據最新的 100 筆列表進行了排序和更新。
    # 如果舊列表中的某些地址沒有出現在新列表的 Top 100 中，它們將被自然移除，這是正確的行為。
    
    # 如果新的列表長度與舊的列表長度不同，也視為異動
    if len(new_wallets_list) != len(old_wallets_list):
        changes_made = True
        
    # 如果新舊列表的順序不同，且順序是更新的核心，則也視為異動
    # (但我們主要比較欄位異動，排名異動已在 CHECK_FIELDS 中處理)
        
    return updated_wallets_list, changes_made


def save_wallets(wallets, filename=WALLET_FILE):
    """將更新後的錢包列表寫回 JSON 檔案。"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            # 確保 JSON 輸出易讀 (indent=4) 且使用 ensure_ascii=False 以顯示中文/特殊字元
            json.dump(wallets, f, indent=4, ensure_ascii=False)
        print(f"成功將最新數據寫入 {filename}。")
    except Exception as e:
        print(f"寫入檔案 {filename} 時發生錯誤: {e}")
        

# -----------------
# Main Execution Block
# -----------------
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 ---")
    
    # 1. 讀取舊的本地資料
    old_wallets_list = load_local_wallets(WALLET_FILE)
    
    # 2. 抓取最新的網站數據
    new_wallets_list = fetch_top_100()
    
    # 確保抓取到的數據非空
    if not new_wallets_list:
        print("無法取得任何數據 (包括 fallback)，腳本結束。")
        return
        
    # 3. 比對並更新資料
    print("開始比對新舊數據...")
    updated_wallets_list, changes_made = compare_and_update_wallets(new_wallets_list, old_wallets_list)
    
    # 4. 根據比對結果進行保存
    if changes_made:
        print("偵測到異動，正在更新本地 JSON 檔案...")
        save_wallets(updated_wallets_list, WALLET_FILE)
    elif updated_wallets_list:
        # 如果沒有異動，但這是第一次運行 (old_wallets_list 為空)，仍應保存
        if not old_wallets_list:
            print("第一次運行，正在保存抓取到的數據...")
            save_wallets(updated_wallets_list, WALLET_FILE)
        else:
            print("無數據異動，本地 JSON 檔案保持不變。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
