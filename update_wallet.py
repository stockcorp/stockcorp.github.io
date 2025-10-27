import requests
import os
import json
import time
from openai import OpenAI # 用於 Grok API
# 移除了 BeautifulSoup 和 re，因為解析邏輯已轉移到 Grok

# -----------------
# Configuration & Initialization
# -----------------
WALLET_FILE = 'wallet.json'
TARGET_URL = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'
SCRAPINGANT_API_URL = 'https://api.scrapingant.com/v2/general'

# 初始化 xAI 客戶端，使用環境變數的 API 密鑰
client = OpenAI(
    api_key=os.getenv("XAI_API_KEY_BITCOIN"),
    base_url="https://api.x.ai/v1"
)

# -----------------
# Fallback (硬編碼資料，保持不變)
# -----------------
def get_fallback_wallets():
    """
    在抓取或解析失敗時使用備用資料。
    會優先讀取本地的 wallet.json，若無則使用硬編碼資料。
    """
    # 這裡放您的硬編碼備用資料，例如：
    fallback = [
        {'rank': '1', 'address': '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', 'balance': '248,598 BTC ($26,541,688,352)', 'percentage': '1.25%', 'first_in': '2018-10-18 12:59:18 UTC', 'last_in': '2025-10-13 06:51:51 UTC', 'ins': '5447', 'first_out': '2018-10-18 13:19:26 UTC', 'last_out': '2023-01-07 06:15:34 UTC', 'outs': '451', 'change': '7d:N/A / 30d:N/A', 'owner': 'Binance-coldwallet'},
        # ... (其餘 99 筆資料 - 假設您已補足)
    ]
    # 讀取本地 wallet.json 作為備用 (如果存在)
    try:
        if os.path.exists(WALLET_FILE):
             with open(WALLET_FILE, 'r', encoding='utf-8') as f:
                 print(f"**警告：無法取得最新數據，已使用本地 {WALLET_FILE} 作為備用。**")
                 return json.load(f)
    except Exception:
        pass
        
    # 如果本地檔案讀取失敗，則使用硬編碼資料並補足至 100 筆
    while len(fallback) < 100:
        fallback.append({
             'rank': str(len(fallback) + 1), 'address': 'N/A', 'balance': 'N/A', 'percentage': 'N/A', 
             'first_in': 'N/A', 'last_in': 'N/A', 'ins': 'N/A', 'first_out': 'N/A', 'last_out': 'N/A', 
             'outs': 'N/A', 'change': '7d:N/A / 30d:N/A', 'owner': ''
        })
    return fallback[:100]

# -----------------
# Core Function: Use Grok to Parse HTML and Generate JSON
# -----------------
def grok_parse_and_generate_json(html_content):
    """使用 Grok API 解析 HTML 內容並生成 JSON 數據"""
    print("-> 呼叫 Grok API 進行數據解析與 JSON 轉換...")
    # 提示 Grok 提取數據並確保輸出格式嚴格為 JSON
    prompt = f"""
    以下是從 {TARGET_URL} 抓取的網頁原始 HTML 內容。
    請僅從 HTML 中找到 ID 為 'tblTop100Wealth' 的表格。
    提取表格中**前 100 筆**資料，將每行數據轉換為 JSON 格式的物件。
    
    JSON 陣列中的每個物件必須包含以下鍵：
    ['rank', 'address', 'balance', 'percentage', 'first_in', 'last_in', 'ins', 'first_out', 'last_out', 'outs', 'change', 'owner']
    
    - 'owner' 欄位通常在地址旁邊的 <span> 標籤的 'title' 屬性中。
    - 'change' 欄位需要合併 7d 和 30d 的變動為一個字串 (例如: "7d:+0.01% / 30d:-0.05%")。
    - 請嚴格確保輸出內容是**純粹、完整的 JSON 陣列**，不要包含任何額外的註釋、解釋性文字或 Markdown 標記 (e.g., ```json)。
    
    原始 HTML 內容 (已截斷)：
    ---HTML START---
    {html_content[:15000]}
    ---HTML END---
    """
    
    try:
        # 使用 Grok API 進行轉換
        # 註：這裡假設 'grok-1.0' 是您的模型名稱
        response = client.chat.completions.create(
            model="grok-1.0",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0 # 低溫度確保結構化輸出
        )
        
        json_string = response.choices[0].message.content.strip()
        
        # 嘗試解析 Grok 的輸出
        wallets_data = json.loads(json_string)
        print("<- Grok API 轉換成功，獲得 JSON 數據。")
        return wallets_data
        
    except Exception as e:
        print(f"!!! Grok API 呼叫或 JSON 解析失敗: {e}")
        # 如果 Grok 失敗，則回傳空列表，讓主函數使用 fallback
        return []


# -----------------
# Data Fetching (使用 Scrapingant API 獲取 HTML)
# -----------------
def fetch_top_100():
    api_key = os.getenv("SCRAPINGANT_API_KEY", "2712b686edd24534b6282b00c11f20b8") 
    
    if not os.getenv("SCRAPINGANT_API_KEY"):
        print("警告: SCRAPINGANT_API_KEY 未透過 GitHub Secret 設定，正在使用硬編碼金鑰。")
    
    # 強化 Scrapingant 參數：使用 Residential Proxy
    params = {
        'url': TARGET_URL,
        'x-api-key': api_key,
        'browser': 'true',
        'wait_for_selector': '#tblTop100Wealth',
        'proxy_type': 'residential' # <--- 住宅代理（成功率更高，但消耗點數較多）
    }
    
    response = None
    for attempt in range(3):
        try:
            print(f"嘗試 {attempt + 1} - 呼叫 Scrapingant API 抓取 {TARGET_URL} (Residential Proxy)")
            response = requests.get(SCRAPINGANT_API_URL, params=params, timeout=45)
            print(f"嘗試 {attempt + 1} - Scrapingant Status code: {response.status_code}")
            
            if response.status_code == 200:
                print("Scrapingant 成功取得 HTML 內容。")
                # 將 HTML 內容交給 Grok 處理
                return grok_parse_and_generate_json(response.text)
                
            elif response.status_code == 403:
                print("Scrapingant 仍被阻擋 (403)。")
        except requests.exceptions.RequestException as e:
            print(f"請求發生錯誤: {e}")
            response = None
            
        time.sleep(10)
    
    print("!!! 無法透過 Scrapingant 取得 HTML，使用 fallback 數據。")
    return get_fallback_wallets()

# -----------------
# Main Execution Block (保持不變)
# -----------------
def save_wallets(wallets, filename=WALLET_FILE):
    if not wallets:
        print("警告：嘗試寫入空數據，已取消寫入。")
        return False
        
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(wallets, f, indent=4, ensure_ascii=False)
        print(f"成功將 {len(wallets)} 筆數據寫入並覆蓋 {filename}。")
        return True
    except Exception as e:
        print(f"寫入檔案 {filename} 時發生錯誤: {e}")
        return False
        
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (Scrapingant 抓取 + Grok 解析模式) ---")
    
    latest_wallets = fetch_top_100()
    
    if latest_wallets:
        save_wallets(latest_wallets, WALLET_FILE)
    else:
        print("未獲取到任何有效數據，腳本結束。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
