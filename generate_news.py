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

def generate_chinese_title(raw_title):
    prompt = f"請將以下英文新聞標題翻譯成吸引人的中文標題，適合財經新聞，保持原意但更生動：{raw_title}"
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()

def summarize_with_gpt(news):
    prompt = f"""你是一位財經新聞編輯，請根據以下新聞標題與摘要，撰寫一篇全新、自然、有條理、至少1200～2000字的中文財經新聞，避免抄襲，語氣自然易讀，可補充背景與分析觀點。用自己的話擴充內容，使其豐富不空洞，包括詳細的背景介紹、數據分析、專家觀點、潛在影響和投資建議。用 HTML 標籤（<h2>, <p>, <ol>, <li>, <strong> 等）組織內容，包含引言、正文分析、結論，並在結尾添加免責聲明：'<p><strong>注意</strong>：本文僅提供分析和資訊，不構成投資建議。投資者應根據自身風險偏好和市場條件進行決策。</p>'。確保內容詳細、邏輯流暢，避免空洞描述。

新聞標題：{news["title"]}
新聞摘要：{news["summary"]}

請開始撰寫：
"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=4096
    )
    article = response.choices[0].message.content.strip()
    article = article.replace("\n", "").replace("  ", " ").strip()
    return article

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
    chinese_title = generate_chinese_title(raw_news["title"])
    article = summarize_with_gpt(raw_news)

    img_path = get_next_image_filename()
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    image_data = generate_image(chinese_title, article)
    with open(img_path, "wb") as f:
        f.write(image_data)

    current_date = datetime.now().strftime('%Y-%m-%d')
    image_name = os.path.basename(img_path)
    image_alt = image_name.replace('.jpg', '-1.jpg')
    new_block = f"""title: {chinese_title}
images: {image_name},{image_alt}
fontSize:16px
date:{current_date}
content: {article}<p>原始連結：{raw_news['link']}</p>

---
"""

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
