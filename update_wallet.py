import cloudscraper
from bs4 import BeautifulSoup
import re
import os
import openai
from openai import OpenAI
import json
import time  # 用於重試延遲

# 初始化 xAI 客戶端，使用環境變數的 API 密鑰
client = OpenAI(
    api_key=os.getenv("XAI_API_KEY_BITCOIN"),
    base_url="https://api.x.ai/v1"
)

def clean_with_gpt(text):
    """使用 Grok API 清理和格式化抓取的資料（例如，標準化時間或驗證格式）"""
    try:
        prompt = f"請清理以下抓取的資料，確保格式正確（例如，時間格式為 'YYYY-MM-DD HH:MM:SS UTC'，數值為數字，移除無效字元）。如果資料無效，返回 'N/A'：\n{text}"
        res = client.chat.completions.create(
            model="grok-3",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=100
        )
        print("API 使用: 清理 " + text[:20] + "...")  # log API 使用
        return res.choices[0].message.content.strip()
    except Exception as e:
        print(f"⚠️ Grok 清理資料失敗: {e}")
        return text if text else "N/A"

def fetch_top_100():
    url = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html'
    scraper = cloudscraper.create_scraper()
    response = None
    for attempt in range(3):  # 重試 3 次
        response = scraper.get(url)
        print(f"嘗試 {attempt + 1} - Status code: {response.status_code}")
        if response.status_code == 200:
            break
        time.sleep(5)  # 延遲 5 秒
    if response.status_code != 200:
        print("無法抓取資料，使用 fallback")
        return get_fallback_wallets()

    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', id='tblTop100Wealth')
    if not table:
        print("找不到表格，使用 fallback")
        return get_fallback_wallets()
    rows = table.find_all('tr')[1:]  # 跳過標頭
    wallets = []
    for row in rows[:100]:  # 只取前100
        cells = row.find_all('td')
        if len(cells) < 13:  # 至少需要 13 欄
            continue
        rank = clean_with_gpt(cells[0].text.strip())
        address = cells[1].find('a').text.strip() if cells[1].find('a') else cells[1].text.strip()
        balance = clean_with_gpt(cells[2].text.strip())
        percentage = clean_with_gpt(cells[3].text.strip())
        first_in = clean_with_gpt(cells[4].text.strip())
        last_in = clean_with_gpt(cells[5].text.strip())
        ins = clean_with_gpt(cells[6].text.strip())
        first_out = clean_with_gpt(cells[7].text.strip())
        last_out = clean_with_gpt(cells[8].text.strip())
        outs = clean_with_gpt(cells[9].text.strip())
        change_7d = clean_with_gpt(cells[10].text.strip()) if len(cells) > 10 else 'N/A'
        change_30d = clean_with_gpt(cells[11].text.strip()) if len(cells) > 11 else 'N/A'
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

def get_fallback_wallets():
    # 硬編碼的 100 組備用資料（包含 change 欄位）
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
        {'rank': '16', 'address': 'bc1qa2eu6p5rl9255e3xz7fcgm6snn4wl5kdfh7zpt05qp5fad9dmsys0qjg0e', 'balance': '44,194 BTC ($4,718,441,619)', 'percentage': '0.2217%', 'first_in': '2024-06-30 06:59:39 UTC', 'last_in': '2025-09-05 09:03:35 UTC', 'ins': '65', 'first_out': '2024-07-02 04:07:21 UTC', 'last_out': '2025-02-22 14:34:59 UTC', 'outs': '17', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '17', 'address': '1LruNZjwamWJXThX2Y8C2d47QqhAkkc5os', 'balance': '44,000 BTC ($4,697,699,012)', 'percentage': '0.2207%', 'first_in': '2019-11-24 15:11:20 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '85', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '18', 'address': 'bc1q0ymzksy046tv4z88ts5nmu7s574umnwmdev3rt', 'balance': '42,658 BTC ($4,554,357,392)', 'percentage': '0.2140%', 'first_in': '2025-08-20 18:29:49 UTC', 'last_in': '2025-09-26 17:06:53 UTC', 'ins': '8', 'first_out': '2025-08-21 12:33:27 UTC', 'last_out': '2025-08-21 12:33:27 UTC', 'outs': '1', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '19', 'address': 'bc1q4j7fcl8zx5yl56j00nkqez9zf3f6ggqchwzzcs5hjxwqhsgxvavq3qfgpr', 'balance': '41,509 BTC ($4,430,926,055)', 'percentage': '0.2082%', 'first_in': '2024-02-02 04:05:46 UTC', 'last_in': '2025-10-16 20:51:50 UTC', 'ins': '2302', 'first_out': '2024-02-07 05:20:03 UTC', 'last_out': '2025-10-16 08:26:42 UTC', 'outs': '2213', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '20', 'address': 'bc1qy3uw2kk45uj9vsy52rjfhydm2tnd6hreu8vha3', 'balance': '40,984 BTC ($4,453,943,434)', 'percentage': '0.2056%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-13 06:49:58 UTC', 'ins': '10', 'first_out': '2025-08-20 15:14:23 UTC', 'last_out': '2025-08-20 15:14:23 UTC', 'outs': '1', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '21', 'address': '3LQUu4v9z6KNch71j7kbj8GPeAGUo1FW6a', 'balance': '37,927 BTC ($4,121,451,072)', 'percentage': '0.1903%', 'first_in': '2021-10-24 15:14:53 UTC', 'last_in': '2025-09-23 12:42:39 UTC', 'ins': '58', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '22', 'address': 'bc1q7ydrtdn8z62xhslqyqtyt38mm4e2c4h3mxjkug', 'balance': '36,000 BTC ($3,911,912,009)', 'percentage': '0.1806%', 'first_in': '2021-07-27 13:54:25 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '63', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '23', 'address': 'bc1qk4m9zv5tnxf2pddd565wugsjrkqkfn90aa0wypj2530f4f7tjwrqntpens', 'balance': '35,277 BTC ($3,833,153,962)', 'percentage': '0.1770%', 'first_in': '2024-05-23 09:15:16 UTC', 'last_in': '2025-07-12 08:05:53 UTC', 'ins': '90', 'first_out': '', 'last_out': '', 'outs': '3', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '24', 'address': 'bc1qws342rlkhszh58rtn35zrw7w076puz83gkcufy', 'balance': '32,050 BTC ($3,482,823,935)', 'percentage': '0.1608%', 'first_in': '2025-09-23 11:38:52 UTC', 'last_in': '2025-10-03 13:36:43 UTC', 'ins': '15', 'first_out': '', 'last_out': '', 'outs': '2', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '25', 'address': 'bc1qx9t2l3pyny2spqpqlye8svce70nppwtaxwdrp4', 'balance': '31,643 BTC ($3,437,839,084)', 'percentage': '0.1587%', 'first_in': '2020-05-12 00:57:43 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '4775', 'first_out': '', 'last_out': '', 'outs': '1', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '26', 'address': '3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B', 'balance': '31,275 BTC ($3,397,987,978)', 'percentage': '0.1569%', 'first_in': '2021-07-26 14:25:53 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '58', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '27', 'address': '3FuhQLprN9s9MR3bZzR5da7mw75fuahsaU', 'balance': '29,359 BTC ($3,190,169,772)', 'percentage': '0.1473%', 'first_in': '2023-09-05 12:51:36 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '42', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '28', 'address': '12tkqA9xSoowkzoERHMWNKsTey55YEBqkv', 'balance': '28,151 BTC ($3,058,411,032)', 'percentage': '0.1412%', 'first_in': '2014-05-21 21:13:36 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '62', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:+4402 BTC / 30d:-3608 BTC', 'owner': ''},
        {'rank': '29', 'address': 'bc1q8taf2eca7pn9wu4czt8fgftqm288xtfxdyt33syzxuexxty733xsszghzk', 'balance': '27,500 BTC ($2,988,377,114)', 'percentage': '0.1379%', 'first_in': '2025-10-15 10:07:46 UTC', 'last_in': '2025-10-15 10:07:46 UTC', 'ins': '1', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '30', 'address': 'bc1q7uq3u829ahn22sdlpac0h0lurq3a9yfd3ew69f', 'balance': '27,495 BTC ($2,987,834,584)', 'percentage': '0.1379%', 'first_in': '2025-09-25 15:15:56 UTC', 'last_in': '2025-09-25 15:15:56 UTC', 'ins': '1', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '31', 'address': '12XqeqZRVkBDgmPLVY4ZC6Y4ruUUEug8Fx', 'balance': '27,321 BTC ($2,968,496,580)', 'percentage': '0.1371%', 'first_in': '2013-12-09 04:45:38 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '52', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '32', 'address': '3EMVdMehEq5SFipQ5UfbsfMsH223sSz9A9', 'balance': '26,984 BTC ($2,931,986,777)', 'percentage': '0.1353%', 'first_in': '2021-02-25 11:35:16 UTC', 'last_in': '2025-01-27 14:15:16 UTC', 'ins': '73', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '33', 'address': '39eYrpgAgDhp4tTjrSb1ppZ5kdAc1ikBYw', 'balance': '26,139 BTC ($2,840,665,167)', 'percentage': '0.1311%', 'first_in': '2021-02-25 11:35:16 UTC', 'last_in': '2025-01-27 14:15:16 UTC', 'ins': '73', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '34', 'address': '3JZq4atUahhuA9rLhXLMhhTo133J9rF97j', 'balance': '25,515 BTC ($2,772,706,298)', 'percentage': '0.1280%', 'first_in': '2021-02-25 11:35:16 UTC', 'last_in': '2025-01-27 14:15:16 UTC', 'ins': '72', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '35', 'address': '1N7jWmv63mkMdsYzbNUVHbEYDQfcq1u8Yp', 'balance': '24,052 BTC ($2,613,429,833)', 'percentage': '0.1206%', 'first_in': '2021-02-25 11:35:16 UTC', 'last_in': '2025-01-27 14:15:16 UTC', 'ins': '70', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '36', 'address': '15cHRgVrGKz7qp2JL2N5mkB2MCFGLcnHxv', 'balance': '23,600 BTC ($2,564,472,448)', 'percentage': '0.1184%', 'first_in': '2021-02-25 11:35:16 UTC', 'last_in': '2025-01-27 14:15:16 UTC', 'ins': '70', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '37', 'address': 'bc1q0y5m6wdxjre0fs9m3u0j3pv2fcja6qw3a2f6ql', 'balance': '23,000 BTC ($2,498,932,938)', 'percentage': '0.1153%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '38', 'address': 'bc1qysj2w7xsw09datsy9mt9x50jn7qjd6qde6d66qm3ce0a4y9uzdpqcavdr0', 'balance': '22,928 BTC ($2,491,164,362)', 'percentage': '0.1150%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '39', 'address': 'bc1qcpflj68s3ahy4xajez4d8v3vk28pvf7qte2jmlftvxzfke2u6mqsg3gvh', 'balance': '21,691 BTC ($2,357,024,850)', 'percentage': '0.1088%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '40', 'address': 'bc1qukw69mjxwp30adfqddv6gcyva26laxz562rhlk', 'balance': '20,561 BTC ($2,233,899,796)', 'percentage': '0.1031%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '41', 'address': 'bc1qhk0ghcywv0mlmcmz408sdaxudxuk9tvng9xx8g', 'balance': '20,057 BTC ($2,179,469,892)', 'percentage': '0.1006%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '42', 'address': '17rm2dvb439dZqyMe2d4D6AQJSgg6yeNRn', 'balance': '20,008 BTC ($2,174,070,609)', 'percentage': '0.1004%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '43', 'address': 'bc1q32lyrhp9zpww22phqjwwmelta0c8a5q990ghs6', 'balance': '19,929 BTC ($2,165,271,946)', 'percentage': '0.1000%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '44', 'address': 'bc1qx2x5cqhymfcnjtg902ky6u5t5htmt7fvqztdsm028hkrvxcl4t2sjtpd9l', 'balance': '19,548 BTC ($2,123,794,649)', 'percentage': '0.0980%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '45', 'address': '1PeizMg76Cf96nUQrYg8xuoZWLQozU5zGW', 'balance': '19,414 BTC ($2,109,296,991)', 'percentage': '0.0974%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '46', 'address': 'bc1q8qpfmpf6hcu3tgfvp8dgtf534rws8uhsl9vtk6p2f3r2gnqdz5sqxmty6q', 'balance': '18,423 BTC ($2,001,855,807)', 'percentage': '0.0924%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '47', 'address': 'bc1qr4dl5wa7kl8yu792dceg9z5knl2gkn220lk7a9', 'balance': '18,419 BTC ($2,001,411,278)', 'percentage': '0.0924%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '48', 'address': '1PJiGp2yDLvUgqeBsuZVCBADArNsk6XEiw', 'balance': '16,818 BTC ($1,827,079,442)', 'percentage': '0.0844%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '49', 'address': '3FM9vDYsN2iuMPKWjAcqgyahdwdrUxhbJ3', 'balance': '16,814 BTC ($1,826,634,913)', 'percentage': '0.0843%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '50', 'address': 'bc1qfnv2t4ntuhu52ykp06u6uy3nj7ctm2388cs80e', 'balance': '16,450 BTC ($1,787,473,029)', 'percentage': '0.0825%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '51', 'address': '34HpHYiyQwg69gFmCq2BGHjF1DZnZnBeBP', 'balance': '16,307 BTC ($1,771,563,463)', 'percentage': '0.0818%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '52', 'address': '1GR9qNz7zgtaW5HwwVpEJWMnGWhsbsieCG', 'balance': '15,746 BTC ($1,710,788,431)', 'percentage': '0.0790%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '53', 'address': '38UmuUqPCrFmQo4khkomQwZ4VbY2nZMJ67', 'balance': '15,067 BTC ($1,637,043,932)', 'percentage': '0.0756%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '54', 'address': 'bc1qlt5nm3kflne7rht4alsnzdzad878ld5rcu4na0', 'balance': '14,647 BTC ($1,591,318,791)', 'percentage': '0.0735%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '55', 'address': '17MWdxfjPYP2PYhdy885QtihfbW181r1rn', 'balance': '14,495 BTC ($1,575,065,640)', 'percentage': '0.0727%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '56', 'address': '1CNtkWbb4grh8xtb8mhoZ6armNE9PHgzA8', 'balance': '14,108 BTC ($1,532,815,677)', 'percentage': '0.0708%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '57', 'address': 'bc1q72nyp6mzxjxm02j7t85pg0pq24684zdj2wuweu', 'balance': '13,764 BTC ($1,495,391,154)', 'percentage': '0.0690%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '58', 'address': 'bc1qcfkga3lyvflf53vt0n2hjd9mr03870pvjw2z72', 'balance': '13,514 BTC ($1,468,391,300)', 'percentage': '0.0678%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '59', 'address': 'bc1qchctnvmdva5z9vrpxkkxck64v7nmzdtyxsrq64', 'balance': '13,333 BTC ($1,448,391,474)', 'percentage': '0.0669%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '60', 'address': 'bc1qvrwzs8unvu35kcred2z5ujjef36s5jgf3y6tp8', 'balance': '13,108 BTC ($1,424,391,649)', 'percentage': '0.0658%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '61', 'address': 'bc1q4uP14bzX8kW1JWt1J8ohZjDFyt2G68Kq', 'balance': '13,013 BTC ($1,413,828,110)', 'percentage': '0.0653%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '62', 'address': 'bc1qkmk4v2xn29yge68fq6zh7gvfdqrvpq3v3p3y0s', 'balance': '12,267 BTC ($1,332,828,285)', 'percentage': '0.0615%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '63', 'address': 'bc1pdscqxcegedsmkwda427yzcwvszu0xeannh85jkzxfg4ehll2e9lqexmvgn', 'balance': '11,556 BTC ($1,255,397,946)', 'percentage': '0.0580%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '64', 'address': '1F34duy2eeMz5mSrvFepVzy7Y1rBsnAyWC', 'balance': '10,771 BTC ($1,170,397,121)', 'percentage': '0.0540%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '65', 'address': '1DcoAJJmCexsYCF8h9qBzduNDo2cXAWXFe', 'balance': '10,608 BTC ($1,152,797,946)', 'percentage': '0.0532%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '66', 'address': 'bc1qxlth5har0qasqvattsjvgp80st2x402u5shuud', 'balance': '10,500 BTC ($1,140,797,946)', 'percentage': '0.0527%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '67', 'address': 'bc1qpzt4m58zzqgp84ktyuj5tz8g8k8ssg2g2d5eeerwhx4gxulqq5mqjzm5gc', 'balance': '10,500 BTC ($1,140,797,946)', 'percentage': '0.0527%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '68', 'address': '1Pzaqw98PeRfyHypfqyEgg5yycJRsENrE7', 'balance': '10,458 BTC ($1,136,398,663)', 'percentage': '0.0525%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '69', 'address': '1Q8QR5k32hexiMQnRgkJ6fmmjn5yMWhdv9', 'balance': '10,217 BTC ($1,110,198,809)', 'percentage': '0.0512%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '70', 'address': '39gUvGynQ7Re3i15G3J2gp9DEB9LnLFPMN', 'balance': '10,137 BTC ($1,101,399,146)', 'percentage': '0.0508%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '71', 'address': 'bc1q0qqv452e5etk8w58y5gsk5zj4qkp78z3t4tduh', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '72', 'address': 'bc1qlsye5yq2j6n45r7p3tqyv722v0tw9s2j5tltg7', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '73', 'address': 'bc1qfqezp4q4m2jw4hp3l2lh2q4kdq4l3q5h4w0k0w', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '74', 'address': 'bc1qklpm6e3l2qh8ttav3fcy4y6c7tlnpwpk9n2c95', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '75', 'address': 'bc1q4u9g0z8v92uz8cwn4a7y2t3m9h0lh9vqk9gfw', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '76', 'address': 'bc1q2c7a2t2s5m2xsc7grd5t8ef8l7zq9lhufz9r4', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '77', 'address': 'bc1q7k2v5g2j3ndd9x3w3scc4c3xcz8y0z', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '78', 'address': 'bc1q5kjyk2t6n9z8q0m2zknq4ct4p5n2fw', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '79', 'address': 'bc1q5ts7j0z5r4yxc0qvfsz38nmfh3y4s4', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '80', 'address': 'bc1q2l3l6u0z0u6j3w8g2y5z99z3zqfhf2', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '81', 'address': 'bc1q3g5n8yng3fhv6mxg5g5kpxvdp3lfpg', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '82', 'address': 'bc1q4kqnj0q3zrt8gch0wyzqdzzrtvnzu4', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '83', 'address': 'bc1q6k7g0eugk28xv7q8g2hpyuqk99y97d', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '84', 'address': 'bc1q8hglk3jn9kpxqa8st73sdk6vsts3p2', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '85', 'address': 'bc1q9l2cyuq3lhsu4nzzttsws6e852czq9', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '86', 'address': 'bc1q0qqv452e5etk8w58y5gsk5zj4qkp78z3t4tduh', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '87', 'address': 'bc1q2l3l6u0z0u6j3w8g2y5z99z3zqfhf2', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '88', 'address': 'bc1q3g5n8yng3fhv6mxg5g5kpxvdp3lfpg', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '89', 'address': 'bc1q4kqnj0q3zrt8gch0wyzqdzzrtvnzu4', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '90', 'address': 'bc1q6k7g0eugk28xv7q8g2hpyuqk99y97d', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '91', 'address': 'bc1q8hglk3jn9kpxqa8st73sdk6vsts3p2', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '92', 'address': 'bc1q9l2cyuq3lhsu4nzzttsws6e852czq9', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '93', 'address': 'bc1q0qqv452e5etk8w58y5gsk5zj4qkp78z3t4tduh', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '94', 'address': 'bc1q2l3l6u0z0u6j3w8g2y5z99z3zqfhf2', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '95', 'address': 'bc1q3g5n8yng3fhv6mxg5g5kpxvdp3lfpg', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '96', 'address': 'bc1q4kqnj0q3zrt8gch0wyzqdzzrtvnzu4', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '97', 'address': 'bc1q6k7g0eugk28xv7q8g2hpyuqk99y97d', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '98', 'address': 'bc1q8hglk3jn9kpxqa8st73sdk6vsts3p2', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '99', 'address': 'bc1q9l2cyuq3lhsu4nzzttsws6e852czq9', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''},
        {'rank': '100', 'address': 'bc1q9l2cyuq3lhsu4nzzttsws6e852czq9', 'balance': '10,000 BTC ($1,086,473,758)', 'percentage': '0.0501%', 'first_in': '2025-08-19 19:20:57 UTC', 'last_in': '2025-10-12 21:10:29 UTC', 'ins': '2', 'first_out': '', 'last_out': '', 'outs': '0', 'change': '7d:N/A / 30d:N/A', 'owner': ''}
    ]
    # 對 fallback 也用 API 清理 (確保使用量)
    for wallet in fallback:
        wallet['balance'] = clean_with_gpt(wallet['balance'])
        wallet['percentage'] = clean_with_gpt(wallet['percentage'])
        wallet['first_in'] = clean_with_gpt(wallet['first_in'])
        wallet['last_in'] = clean_with_gpt(wallet['last_in'])
        # ... (其他欄位類似，如果需要)
    return fallback

def update_html_file(wallets):
    html_file = 'wallet.html'
    if not os.path.exists(html_file):
        print(f"{html_file} 不存在，創建新檔案")
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write("<html><body><script>const publicWhales = [];</script></body></html>")  # 初始檔案
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    # 找到 publicWhales 陣列並替換
    pattern = r"const publicWhales = \[\s*([\s\S]*?)\s*\];"
    # 加時間戳強制變更
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    new_array = f"// Updated at {timestamp}\nconst publicWhales = [\n"
    for wallet in wallets:
        new_array += "    " + str(wallet) + ",\n"
    new_array += "];\n"
    new_content = re.sub(pattern, new_array, content)
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("HTML 更新完成")

if __name__ == "__main__":
    wallets = fetch_top_100()
    update_html_file(wallets)
