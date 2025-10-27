import cloudscraper
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
# 確保使用用戶指定的中文 URL
TARGET_URL = 'https://bitinfocharts.com/zh/top-100-richest-bitcoin-addresses.html'

# 為了繞過反爬蟲，使用更真實的請求頭 (Headers)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
}

# -----------------
# Data Cleaning & Fallback (保持穩定版本)
# -----------------
def clean_local(text, field_type):
    """本地清理資料，減少 API 呼叫。只清理必要欄位。"""
    text = text.strip()
    if field_type == 'balance':
        match = re.match(r'([\d,]+)\s*BTC\s*\(([\$\d,]+)\)', text)
        if match:
            btc = match.group(1).replace(',', '')
            usd = match.group(2).replace(',', '').replace('$', '')
            try:
                # 確保格式化後與原 json 接近
                return f"{int(float(btc)):,} BTC (${int(float(usd)):,})"
            except ValueError:
                 return f"{btc} BTC (${usd})"
        return 'N/A'
    elif field_type == 'percentage':
        return text.replace('%', '').strip() + '%'
    elif field_type in ['date_in', 'date_out']:
        # 確保日期格式，或 N/A
        if re.match(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC', text):
            return text
        return 'N/A'
    elif field_type in ['number', 'rank', 'ins', 'outs']:
        return re.sub(r'\D', '', text) or 'N/A'
    elif field_type == 'change':
        return text.strip() if text else 'N/A'
    else:
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
# Data Fetching (增強反爬蟲)
# -----------------
def fetch_top_100():
    """從目標網站抓取最新的前 100 大錢包數據。"""
    # 初始化 cloudscraper，模擬瀏覽器環境
    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
    )
    response = None
    print(f"嘗試從 {TARGET_URL} 抓取數據 (使用反爬蟲增強模式)...")
    
    for attempt in range(3): # 嘗試三次
        try:
            # 使用增強的 HEADERS 進行請求
            response = scraper.get(TARGET_URL, headers=HEADERS, timeout=20)
            print(f"嘗試 {attempt + 1} - Status code: {response.status_code}")
            if response.status_code == 200:
                break
            time.sleep(5)
        except Exception as e:
            print(f"抓取發生錯誤: {e}")
            time.sleep(5)

    if response is None or response.status_code != 200:
        print("無法取得網站內容。")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 策略 1: 嘗試使用特定的 ID 查找表格
    table = soup.find('table', id='tblTop100Wealth')
    
    # 策略 2: 如果找不到，嘗試使用更廣泛的選擇器
    if not table:
        print("找不到特定 ID 表格，嘗試使用關鍵字查找...")
        # 查找包含 '排名', '地址', '餘額' 關鍵字的表格 (中文版網站)
        for t in soup.find_all('table'):
            header_row = t.find('thead') or t.find('tr')
            if header_row and ('排名' in header_row.text and '地址' in header_row.text and '餘額' in header_row.text):
                table = t
                print("成功找到包含關鍵標頭的表格。")
                break
    
    if not table:
        print("無法從抓取的 HTML 中找到包含錢包數據的表格。")
        # 這裡不直接使用 Grok API，而是返回空列表，讓 Main 函數處理 Fallback
        return [] 

    # --- 數據提取 ---
    rows = table.find_all('tr')[1:]
    wallets = []
    
    for row in rows[:100]:
        cells = row.find_all('td')
        # 確保有足夠的欄位
        if len(cells) < 12:
            continue
        
        # 提取邏輯必須對應網站的欄位順序
        rank = clean_local(cells[0].text.strip(), 'rank')
        
        # 處理 Address 和 Owner 欄位
        address_text = cells[1].text.strip()
        owner_tag = cells[1].find('span', class_='a')
        owner = owner_tag['title'].strip() if owner_tag and owner_tag.has_attr('title') else ''
        
        # 從 address_text 中分離地址和 owner
        if owner_tag:
             # 如果有 owner tag，則移除其文字內容以分離地址
             address = address_text.replace(owner_tag.text, '').strip()
        else:
             address = address_text
             
        # 清理地址中可能的多餘換行或空格
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

# -----------------
# Save Function
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
# Main Execution Block
# -----------------
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (網站爬蟲增強模式) ---")
    
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
        save_wallets(final_wallets, WALLET_FILE)
    else:
        print("未獲取到任何有效數據 (網站和本地備用皆失敗)，腳本結束。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    # 您的環境中可能沒有設置 Grok API 密鑰，但這裡不需要它來進行爬蟲
    # 由於腳本中沒有 Grok 的執行邏輯，這裡不需要 try/except 處理
    main()
