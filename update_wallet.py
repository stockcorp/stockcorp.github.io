import cloudscraper
from bs4 import BeautifulSoup
import json
import re
import time
import os

JSON_PATH = "wallet.json"
TARGET_URL = "https://bitinfocharts.com/top-100-richest-bitcoin-addresses.html"

def clean_text(text):
    """清理欄位字串"""
    return re.sub(r'\s+', ' ', text.strip())

def parse_wallet_table():
    """從目標網站抓取前100名錢包資料"""
    scraper = cloudscraper.create_scraper()
    for attempt in range(3):
        res = scraper.get(TARGET_URL)
        if res.status_code == 200:
            break
        time.sleep(3)
    if res.status_code != 200:
        raise Exception("無法抓取比特幣錢包資料")

    soup = BeautifulSoup(res.text, "html.parser")
    table = soup.find("table", id="tblTop100Wealth")
    if not table:
        raise Exception("找不到排行榜表格")

    wallets = []
    for row in table.find_all("tr")[1:101]:
        cells = row.find_all("td")
        if len(cells) < 10:
            continue
        address = cells[1].get_text(strip=True)
        wallets.append({
            "rank": clean_text(cells[0].text),
            "address": address,
            "balance": clean_text(cells[2].text),
            "percentage": clean_text(cells[3].text),
            "first_in": clean_text(cells[4].text),
            "last_in": clean_text(cells[5].text),
            "ins": clean_text(cells[6].text),
            "first_out": clean_text(cells[7].text),
            "last_out": clean_text(cells[8].text),
            "outs": clean_text(cells[9].text),
            "change": f"7d:{clean_text(cells[10].text)} / 30d:{clean_text(cells[11].text)}" if len(cells) > 11 else "7d:N/A / 30d:N/A",
            "owner": clean_text(cells[1].find("span")["title"]) if cells[1].find("span") and cells[1].find("span").has_attr("title") else ""
        })
    return wallets

def update_existing_data(existing, latest):
    """比對現有 JSON 與最新資料，只更新改變的欄位"""
    updated = []
    existing_map = {w["address"]: w for w in existing}

    for wallet in latest:
        addr = wallet["address"]
        if addr in existing_map:
            old = existing_map[addr]
            changed = False
            for key in ["balance", "percentage", "last_in", "last_out", "change"]:
                if wallet[key] != old.get(key):
                    old[key] = wallet[key]
                    changed = True
            if changed:
                print(f"更新錢包：{addr}")
            updated.append(old)
        else:
            print(f"新增新錢包：{addr}")
            updated.append(wallet)

    # 若舊資料有不在新列表中的錢包，則忽略（通常不會發生）
    for old in existing:
        if old["address"] not in {w["address"] for w in latest}:
            print(f"錢包已離開前100名：{old['address']}")

    # 根據 rank 排序
    updated.sort(key=lambda x: int(x["rank"]))
    return updated

def main():
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)
    except Exception:
        existing = []

    latest = parse_wallet_table()
    merged = update_existing_data(existing, latest)

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=4)

    print("✅ 更新完成，共保存", len(merged), "筆錢包資料")

if __name__ == "__main__":
    main()
