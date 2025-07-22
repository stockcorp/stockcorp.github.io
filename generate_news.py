import os
import openai
import feedparser
import requests
from datetime import datetime

# 初始化 OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

CATEGORY_SOURCES = {
    "台股": ["https://www.cnyes.com/rss/news/cat/tw_stock", "https://tw.stock.yahoo.com/rss/sitemap.xml"],
    "幣圈": ["https://decrypt.co/feed", "https://cointelegraph.com/rss", "https://news.bitcoin.com/feed/"],
    "美股": ["https://www.marketwatch.com/rss/topstories", "https://www.cnbc.com/id/100003114/device/rss/rss.html"],
    "ETF": ["https://www.etftrends.com/feed/", "https://seekingalpha.com/tag/etf.rss"],
    "黃金": ["https://www.kitco.com/news/category/mining/rss", "https://www.kitco.com/rss/gold-live.xml"]
}

def get_today_category():
    weekday = datetime.utcnow().weekday()
    return {0: "台股", 1: "幣圈", 2: "美股", 3: "幣圈", 4: "ETF", 5: "黃金"}.get(weekday, "台股")

def fetch_latest_article(category):
    for url in CATEGORY_SOURCES.get(category, []):
        try:
            feed = feedparser.parse(url)
            if feed.entries:
                entry = feed.entries[0]
                return {
                    "title": entry.title,
                    "summary": entry.get("summary", ""),
                    "link": entry.link
                }
        except Exception as e:
            print(f"Error fetching {url}: {e}")
    return {"title": "找不到新聞", "summary": "請檢查來源或稍後重試。", "link": ""}

def summarize_with_gpt(news):
    prompt = f"""你是一位財經新聞編輯，請根據以下新聞標題與摘要，撰寫一篇全新、自然、有條理、約 500～1000 字的中文財經新聞，避免抄襲，語氣自然易讀，可補充背景與分析觀點。用 HTML 標籤（<h2>, <p>, <ol>, <li> 等）組織內容，包含引言、正文分析、結論和免責聲明。

新聞標題：{news["title"]}
新聞摘要：{news["summary"]}

請開始撰寫：
"""
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()

def generate_image(news_title, article_summary):
    image_prompt = f"生成一張與這篇中文財經新聞相關的專業插圖，風格現代、吸引人：{news_title} - {article_summary[:200]}"
    image_response = client.images.generate(
        model="dall-e-3",
        prompt=image_prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    image_url = image_response.data[0].url
    image_data = requests.get(image_url).content
    return image_data

def get_next_image_filename():
    try:
        with open("last_image_id.txt", "r") as f:
            last_id = int(f.read().strip())
    except FileNotFoundError:
        last_id = 12  # 從12開始，下一個是13
    next_id = last_id + 1
    with open("last_image_id.txt", "w") as f:
        f.write(str(next_id))
    return f"img/content/{next_id}.jpg"

def main():
    category = get_today_category()
    print(f"▶️ 今日主題：{category}")
    raw_news = fetch_latest_article(category)
    article = summarize_with_gpt(raw_news)

    img_path = get_next_image_filename()
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    image_data = generate_image(raw_news["title"], article)
    with open(img_path, "wb") as f:
        f.write(image_data)

    # 生成標準格式的新塊
    current_date = datetime.now().strftime('%Y-%m-%d')
    title = raw_news["title"][:50] + "..." if len(raw_news["title"]) > 50 else raw_news["title"]
    image_name = os.path.basename(img_path)
    new_block = f"""title: {title}
images: {image_name},{image_name.replace('.jpg', '-1.jpg')}
fontSize:16px
date:{current_date}
content:{article}
<p>原始連結：{raw_news['link']}</p>

---
"""

    # 追加到 content.txt
    if os.path.exists("content.txt"):
        with open("content.txt", "r", encoding="utf-8") as f:
            old = f.read()
    else:
        old = ""

    with open("content.txt", "w", encoding="utf-8") as f:
        f.write(new_block + "\n" + old)

    print(f"✅ 新聞與圖片已寫入：{img_path}")

if __name__ == "__main__":
    main()
