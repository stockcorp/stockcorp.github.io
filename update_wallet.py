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
# 為了繞過反爬蟲，使用更真實的請求頭 (Headers)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7'
}


# 初始化 xAI 客戶端 (保留原有的程式碼)
client = OpenAI(
    api_key=os.getenv("XAI_API_KEY_BITCOIN"),
    base_url="https://api.x.ai/v1"
)

# -----------------
# Data Cleaning & Fallback (保持不變)
# -----------------
def clean_local(text, field_type):
    # ... (使用先前提供的最新版本 clean_local 函數，確保格式化正確)
    text = text.strip()
    if field_type == 'balance':
        match = re.match(r'([\d,]+)\s*BTC\s*\(([\$\d,]+)\)', text)
        if match:
            btc = match.group(1).replace(',', '')
            usd = match.group(2).replace(',', '').replace('$', '')
            try:
                return f"{int(float(btc)):,} BTC (${int(float(usd)):,})"
            except ValueError:
                 return f"{btc} BTC (${usd})"
        return 'N/A'
    elif field_type == 'percentage':
        return text.replace('%', '').strip() + '%'
    elif field_type in ['date_in', 'date_out']:
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
# Data Fetching (優化請求頭)
# -----------------
def fetch_top_100():
    """從目標網站抓取最新的前 100 大錢包數據。"""
    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
    )
    response = None
    print(f"嘗試從 {TARGET_URL} 抓取數據 (使用優化請求頭)...")
    
    # 嘗試抓取兩次
    for attempt in range(2):
        try:
            # 使用我們定義的 HEADERS
            response = scraper.get(TARGET_URL, headers=HEADERS, timeout=15)
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
    
    # --- 查找表格的邏輯保持不變 (使用上次修正的增強邏輯) ---
    table = soup.find('table', id='tblTop100Wealth')
    
    if not table:
        print("找不到 ID 為 'tblTop100Wealth' 的表格，嘗試使用替代選擇器...")
        for t in soup.find_all('table'):
            header_row = t.find('thead') or t.find('tr')
            if header_row and ('Rank' in header_row.text and 'Address' in header_row.text and 'Balance' in header_row.text):
                table = t
                print("成功找到包含關鍵標頭的表格。")
                break
    
    if not table:
        print("無法從抓取的 HTML 中找到包含錢包數據的表格。")
        # 由於 cloudscraper 失敗，我們嘗試使用 Grok API 進行最後的解析嘗試 (策略二)
        print("轉為使用 Grok API 解析原始 HTML 內容...")
        return parse_with_grok_api(response.text) # 新增的 Grok 解析嘗試

    # --- 數據提取邏輯保持不變 ---
    rows = table.find_all('tr')[1:]
    wallets = []
    
    for row in rows[:100]:
        # ... (數據提取和 clean_local 邏輯，與上一個回答的修正版相同)
        cells = row.find_all('td')
        if len(cells) < 12:
            continue
        
        rank = clean_local(cells[0].text.strip(), 'rank')
        address_cell = cells[1].find('a')
        address_text = cells[1].text.strip()
        owner_tag = cells[1].find('span', class_='a')
        owner = owner_tag['title'].strip() if owner_tag and owner_tag.has_attr('title') else ''
        
        if owner_tag:
             address = address_text.replace(owner_tag.text, '').strip()
        elif address_cell:
             address = address_cell.text.strip()
        else:
             address = address_text
             
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
        # ... (補齊 N/A 邏輯)
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
# 策略二：使用 Grok API 解析 HTML (僅在 BeautifulSoup 失敗時使用)
# -----------------
def parse_with_grok_api(html_content):
    """
    將完整的 HTML 內容傳遞給 Grok API 進行解析和結構化。
    """
    if not os.getenv("XAI_API_KEY_BITCOIN"):
        print("錯誤：未設置 XAI_API_KEY_BITCOIN 環境變數，無法使用 Grok API 解析。")
        return []
        
    print("嘗試使用 Grok API 從原始 HTML 中提取錢包數據...")
    
    # 簡化 HTML 內容，減少 Token 使用，只保留表格相關部分
    soup = BeautifulSoup(html_content, 'html.parser')
    # 假設表格內容在 body 內
    body_content = soup.find('body')
    simplified_html = str(body_content) if body_content else html_content[:20000] # 截斷以防超長
    
    # 設定 Grok API 的提取指令
    prompt = f"""
    請從以下 HTML 片段中提取比特幣前 100 大錢包的數據。
    請確保輸出結果為一個嚴格的 JSON 陣列 (JSON array)，每個物件的鍵值必須包含：
    'rank', 'address', 'balance', 'percentage', 'first_in', 'last_in', 'ins', 'first_out', 'last_out', 'outs', 'change', 'owner'。
    如果數據缺失，請使用 'N/A' 填充，並確保 'change' 欄位格式為 '7d:X / 30d:Y'。
    
    HTML 片段：
    ---
    {simplified_html}
    ---
    """
    
    try:
        response = client.chat.completions.create(
            model="grok-1.0", # 假設 Grok 的模型名稱
            messages=[
                {"role": "system", "content": "你是一個專業的數據提取機器人，專門將網頁 HTML 轉換為嚴格的 JSON 格式數據。"},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        # 嘗試解析 Grok 的輸出
        json_string = response.choices[0].message.content.strip()
        # Grok 返回的可能是 { "data": [...] } 或直接是 [...]
        try:
            grok_data = json.loads(json_string)
            if isinstance(grok_data, dict) and 'data' in grok_data:
                 wallets = grok_data['data']
            elif isinstance(grok_data, list):
                 wallets = grok_data
            else:
                 print("Grok API 返回的 JSON 格式不是預期的列表或包含列表的字典。")
                 return []
                 
            print(f"Grok API 成功提取了 {len(wallets)} 筆數據。")
            return wallets
            
        except json.JSONDecodeError:
            print("Grok API 返回的內容無法解析為有效的 JSON。")
            return []

    except Exception as e:
        print(f"呼叫 Grok API 失敗: {e}")
        return []


# -----------------
# Main Execution Block (保持不變)
# -----------------
def save_wallets(wallets, filename=WALLET_FILE):
    # ... (保存邏輯保持不變)
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

def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (直接覆蓋模式 - 反爬蟲增強版) ---")
    
    # 1. 抓取最新的網站數據 (失敗時會嘗試 Grok API 解析)
    latest_wallets = fetch_top_100()
    
    # 2. 判斷是否成功抓取
    if not latest_wallets or len(latest_wallets) < 10: # 如果抓取到很少的數據也視為失敗
        # 如果抓取失敗 (返回空列表或數據太少)，則使用本地 JSON 作為備用
        print("網站或 Grok 數據抓取失敗或數據不足，嘗試使用本地備用數據。")
        final_wallets = get_fallback_wallets(WALLET_FILE)
    else:
        # 如果抓取成功，則使用網站/Grok 數據
        final_wallets = latest_wallets

    # 3. 直接保存
    if final_wallets:
        save_wallets(final_wallets, WALLET_FILE)
    else:
        print("未獲取到任何有效數據 (網站、Grok 和本地備用皆失敗)，腳本結束。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
