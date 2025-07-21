import os
import shutil

# 打包完整修正版本，保證 generate_news.py 會寫入正確目錄、圖片與內容能部署
base_path = "/mnt/data/auto_news_package"
os.makedirs(base_path + "/img/content", exist_ok=True)
os.makedirs(base_path + "/.github/workflows", exist_ok=True)

# generate_news.py
generate_news_py = '''
import os
import openai
import feedparser
from datetime import datetime

openai.api_key = os.getenv("OPENAI_API_KEY")

CATEGORY_SOURCES = {
    "台股": ["https://www.cnyes.com/rss/news/cat/tw_stock", "https://tw.stock.yahoo.com/rss"],
    "幣圈": ["https://decrypt.co/feed", "https://cointelegraph.com/rss", "https://news.bitcoin.com/feed/"],
    "美股": ["https://www.marketwatch.com/rss/topstories", "https://www.cnbc.com/id/100003114/device/rss/rss.html"],
    "ETF": ["https://www.etftrends.com/feed/", "https://seekingalpha.com/market-outlook/etfs.xml"],
    "黃金": ["https://www.kitco.com/rss/", "https://www.gold.org/rss"]
}

def get_today_category():
    weekday = datetime.utcnow().weekday()
    return {0: "台股", 1: "幣圈", 2: "美股", 3: "幣圈", 4: "ETF", 5: "黃金"}.get(weekday, "台股")

def fetch_latest_article(category):
    for url in CATEGORY_SOURCES.get(category, []):
        feed = feedparser.parse(url)
        if feed.entries:
            entry = feed.entries[0]
            return {
                "title": entry.title,
                "summary": entry.get("summary", ""),
                "link": entry.link
            }
    return {"title": "找不到新聞", "summary": "", "link": ""}

def summarize_with_gpt(news):
    prompt = f"""你是一位財經新聞編輯，請根據以下新聞標題與摘要，撰寫一篇全新、自然、有條理、約 500～1000 字的中文財經新聞，避免抄襲，語氣自然易讀，可補充背景與分析觀點。

新聞標題：{news["title"]}
新聞摘要：{news["summary"]}

請開始撰寫：
"""
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo-16k",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()

def get_next_image_filename():
    try:
        with open("last_image_id.txt", "r") as f:
            last_id = int(f.read().strip())
    except:
        last_id = 12
    next_id = last_id + 1
    with open("last_image_id.txt", "w") as f:
        f.write(str(next_id))
    return f"img/content/{next_id}.jpg"

def main():
    category = get_today_category()
    print(f"▶️ 今日主題：{category}")
    raw_news = fetch_latest_article(category)
    article = summarize_with_gpt(raw_news)

    new_block = f"[{datetime.now().strftime('%Y-%m-%d')}][{category}]\\n{article}\\n原始連結：{raw_news['link']}\\n"

    with open("content.txt", "r", encoding="utf-8") as f:
        old = f.read() if os.path.exists("content.txt") else ""

    with open("content.txt", "w", encoding="utf-8") as f:
        f.write(new_block + "\\n" + old)

    img_path = get_next_image_filename()
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    with open(img_path, "wb") as f:
        f.write(b"PLACEHOLDER_IMAGE")  # 你可替換為真正圖片生成

    print(f"✅ 新聞與圖片已寫入：{img_path}")

if __name__ == "__main__":
    main()
'''

# GitHub Actions workflow yml
workflow_yml = '''
name: 每日自動更新新聞與圖片

on:
  schedule:
    - cron: '0 1 * * 1-6'  # 台灣時間早上 9 點
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install dependencies
      run: pip install openai feedparser

    - name: Run script
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      run: python3 generate_news.py

    - name: Commit and Push
      run: |
        git config --global user.name "github-actions"
        git config --global user.email "github-actions@users.noreply.github.com"
        git add content.txt last_image_id.txt img/content/*
        git commit -m "每日自動更新新聞與圖片 $(date '+%F %T')" || echo "Nothing to commit"
        git push https://x-access-token:${{ secrets.PERSONAL_TOKEN }}@github.com/${{ github.repository }} HEAD:main
'''

# 寫入檔案
with open(f"{base_path}/generate_news.py", "w", encoding="utf-8") as f:
    f.write(generate_news_py)

with open(f"{base_path}/.github/workflows/update-news.yml", "w", encoding="utf-8") as f:
    f.write(workflow_yml)

# 加入 .gitkeep 確保資料夾可部署
with open(f"{base_path}/img/content/.gitkeep", "w") as f:
    f.write("")

# 打包為 zip
shutil.make_archive("/mnt/data/auto_news_system", "zip", base_path)

"/mnt/data/auto_news_system.zip"
