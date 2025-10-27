import requests
import os
import json
import time
from copy import deepcopy
from datetime import datetime, timezone

# -----------------
# Configuration & API Endpoints
# -----------------
WALLET_FILE = 'wallet.json'
# 使用 Blockchair API 獲取排名前 100 的地址和餘額
BLOCKCHAIR_RICH_LIST_API = 'https://api.blockchair.com/bitcoin/addresses?limit=100&sort=balance(desc)'
# 使用 BlockCypher API 獲取地址的詳細交易統計（免費層級）
BLOCKCYPHER_DETAIL_API = 'https://api.blockcypher.com/v1/btc/main/addrs/'
# 匯率 API (使用 CoinGecko 的公開免費 API 獲取當前價格)
COINGECKO_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'

# -----------------
# 輔助函數
# -----------------
def get_current_btc_price():
    """獲取比特幣當前的美元價格。"""
    try:
        response = requests.get(COINGECKO_PRICE_API, timeout=5)
        response.raise_for_status()
        data = response.json()
        return data['bitcoin']['usd']
    except Exception as e:
        print(f"無法獲取 BTC 價格，使用備用價格 100000.00: {e}")
        return 100000.00 # 備用價格

def get_fallback_wallets(filename=WALLET_FILE):
    """在 API 失敗時，從本地 JSON 讀取備用數據。"""
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
# 核心函數 1：獲取 Top 100 地址和餘額 (Blockchair)
# -----------------
def fetch_top_100_core_data():
    """
    從 Blockchair API 獲取比特幣 Top 100 地址、餘額、交易次數 (in/out total) 等核心數據。
    """
    print(f"嘗試從 Blockchair 獲取核心 Top 100 數據...")
    try:
        response = requests.get(BLOCKCHAIR_RICH_LIST_API, timeout=20)
        response.raise_for_status()
        raw_data = response.json()
        
        # Blockchair 的 'data' 鍵是地址列表
        core_wallets = []
        if 'data' in raw_data and isinstance(raw_data['data'], dict):
            addresses = raw_data['data']['addresses']
            
            for i, (address, data) in enumerate(addresses.items()):
                if i >= 100:
                    break
                
                # Blockchair 餘額是以 Satoshi (聰) 為單位，需除以 100,000,000
                balance_btc = data.get('balance', 0) / 100000000 
                
                core_wallets.append({
                    'rank': str(i + 1),
                    'address': address,
                    'balance_btc': balance_btc,
                    'transaction_count': data.get('transaction_count', 0), # 總交易次數
                    'first_seen': data.get('first_seen_receiving', None) # 首次接收時間
                })

            print(f"成功從 Blockchair 獲取 {len(core_wallets)} 筆核心數據。")
            return core_wallets
        
        return []

    except Exception as e:
        print(f"獲取 Blockchair 核心數據失敗: {e}")
        return []

# -----------------
# 核心函數 2：補全詳細交易數據 (BlockCypher)
# -----------------
def fetch_detail_with_blockcypher(core_wallets):
    """
    使用 BlockCypher API 補全每個地址的 ins/outs/last_tx 等數據。
    """
    print("開始使用 BlockCypher 補全詳細交易數據 (注意速率限制)...")
    
    # 創建一個新的列表來存儲完整的數據
    detailed_wallets = []
    
    for wallet in core_wallets:
        address = wallet['address']
        detail_url = f"{BLOCKCYPHER_DETAIL_API}{address}?limit=1" # 只查詢最近一筆交易
        
        try:
            response = requests.get(detail_url, timeout=10)
            response.raise_for_status()
            detail = response.json()
            
            # BlockCypher 數據提取
            total_received = detail.get('total_received', 0) / 100000000 # 總接收 BTC
            total_sent = detail.get('total_sent', 0) / 100000000 # 總發送 BTC
            n_tx = detail.get('n_tx', 0) # 總交易筆數
            
            # 從最後一筆交易中推測最後 in/out 時間
            last_tx_time = None
            if detail.get('txrefs'):
                # 假設 txrefs 中的第一筆是最近的
                last_tx_time = detail['txrefs'][0].get('confirmed') 
            
            # 由於免費 API 無法直接區分 last_in/last_out 和 first_in/first_out
            # 我們只能根據現有數據進行推測和填充
            
            # 簡化推測：
            # last_in: 使用最近確認時間
            # last_out: 如果有發送過交易，則使用最近確認時間
            
            
            # 將 API 數據合併到 wallet
            wallet.update({
                'ins': str(detail.get('n_unconfirmed_in', 0) + detail.get('final_n_tx', 0)), # 總接收次數
                'outs': str(detail.get('n_unconfirmed_out', 0) + detail.get('final_n_tx', 0)), # 總發送次數
                # 只能填充最近一次接收/發送時間，無法取得最早時間
                'last_in': last_tx_time.replace('T', ' ').replace('Z', ' UTC') if last_tx_time else 'N/A', 
                'last_out': last_tx_time.replace('T', ' ').replace('Z', ' UTC') if total_sent > 0 and last_tx_time else '', 
                # 首次時間無法獲取，使用 Blockchair 的 first_seen
                'first_in': wallet.get('first_seen', 'N/A').replace('T', ' ').replace('+00:00', ' UTC').split('.')[0] if wallet.get('first_seen') else 'N/A',
                'first_out': '' # 無法準確獲取
            })

            detailed_wallets.append(wallet)

        except Exception as e:
            print(f"補全地址 {address} 失敗 (可能觸發速率限制): {e}")
            detailed_wallets.append(wallet) # 即使失敗，也保留核心數據

        # 延遲 0.2 秒，避免觸發 BlockCypher 的免費層級速率限制 (通常是 6/秒)
        time.sleep(0.2) 
        
    return detailed_wallets

# -----------------
# 核心函數 3：格式化與儲存
# -----------------
def save_wallets(wallets, current_btc_price, filename=WALLET_FILE):
    """將最新的錢包列表寫回 JSON 檔案，並進行最終格式化。"""
    if not wallets:
        return False

    final_data = []
    total_btc_supply = 21000000.0 # 比特幣總供應量 (約數)

    for wallet in wallets:
        btc_balance = wallet.get('balance_btc', 0)
        
        # 計算並格式化 BTC 和 USD 餘額
        usd_balance = btc_balance * current_btc_price
        formatted_balance = f"{int(btc_balance):,} BTC (${int(usd_balance):,})"
        
        # 計算 percentage
        percentage = f"{(btc_balance / total_btc_supply) * 100:.4f}%"
        
        # 最終輸出結構
        final_data.append({
            'rank': wallet.get('rank', 'N/A'),
            'address': wallet.get('address', 'N/A'),
            'balance': formatted_balance,
            'percentage': percentage,
            # 填入補全的交易細節
            'first_in': wallet.get('first_in', 'N/A'),
            'last_in': wallet.get('last_in', 'N/A'),
            'ins': wallet.get('ins', 'N/A'),
            'first_out': wallet.get('first_out', ''),
            'last_out': wallet.get('last_out', ''),
            'outs': wallet.get('outs', 'N/A'),
            'change': '7d:N/A / 30d:N/A',  # 免費 API 無法提供，保留 N/A
            'owner': '' # 免費 API 無法提供所有者標籤，保留空字串
        })

    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=4, ensure_ascii=False)
        print(f"成功將最新的 {len(final_data)} 筆數據寫入並覆蓋 {filename}。")
        return True
    except Exception as e:
        print(f"寫入檔案 {filename} 時發生錯誤: {e}")
        return False
        
# -----------------
# Main Execution Block
# -----------------
def main():
    print("--- 比特幣 100 大錢包更新腳本啟動 (公開 API 組合模式) ---")
    
    # 0. 獲取當前 BTC 價格
    current_btc_price = get_current_btc_price()
    print(f"當前 BTC/USD 價格: ${int(current_btc_price):,}")
    
    # 1. 獲取核心 Top 100 數據
    core_wallets = fetch_top_100_core_data()
    
    if not core_wallets:
        final_wallets = get_fallback_wallets(WALLET_FILE)
    else:
        # 2. 利用 BlockCypher API 補全詳細交易數據
        detailed_wallets = fetch_detail_with_blockcypher(core_wallets)
        
        # 3. 格式化並保存
        save_wallets(detailed_wallets, current_btc_price, WALLET_FILE)
        return

    # 如果所有嘗試都失敗
    if final_wallets:
        print("使用本地備用數據，不進行保存更新。")
    else:
        print("未獲取到任何有效數據，腳本結束。")
    
    print("--- 腳本執行完畢 ---")

if __name__ == '__main__':
    main()
