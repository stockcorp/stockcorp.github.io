import os
import openai
import feedparser
import requests
import random
from datetime import datetime

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

def fetch_random_article(category):
    articles = []
    for url in CATEGORY_SOURCES.get(category, []):
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                articles.append({
                    "title": entry.title,
                    "summary": entry.get("summary", ""),
                    "link": entry.link
                })
        except Exception as e:
            print(f"❌ Error fetching {url}: {e}")
    return random.choice(articles) if articles else {
        "title": "找不到新聞", "summary": "請檢查來源或繳後重試。", "link": ""
    }

def extract_main_person(news):
    prompt = f"""以下是一篇財經新聞的標題與摘要，請找出是否提及明確的主角人物（例如總統、首相、財經名人等），並輸出該人物姓名。若沒有諁明人物，請只答「無」。\n\n標題：{news["title"]}\n摘要：{news["summary"]}\n\n請只輸出人物姓名或「無」："
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    return response.choices[0].message.content.strip()

def generate_chinese_title(raw_title):
    prompt = f"請將以下英文新聞標題翻譯成吸引人的中文標題，適合財經新聞，保持原意但更生動：{raw_title}"
    res = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return res.choices[0].message.content.strip()

def summarize_with_gpt(news, img_id):
    prompt = f"""...
新聞標題：{news["title"]}
新聞摘要：{news["summary"]}
請開始撰寫："""
    res = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=4096
    )
    article = res.choices[0].message.content.strip()
    for token in ["```html", "```"]:
        if article.startswith(token): article = article[len(token):]
        if article.endswith("```"): article = article[:-3]
    image_tag = f'<img src="/img/content/{img_id}">'
    if "<p>" in article:
        parts = article.split("</p>", 1)
        article = parts[0] + "</p>" + image_tag + (parts[1] if len(parts) > 1 else "")
    else:
        article = image_tag + article
    return article.replace("\n", "").replace("  ", " ").strip()

def generate_image(prompt_text, person_name=None):
    if person_name and person_name != "無":
        image_prompt = (
            f"{person_name} 的電影海報風格剪影圖，"
            f"以黑影方式呈現人物，背景具有戰略感與財經象徵，風格現代、專業、吸眺"
        )
    else:
        image_prompt = (
            f"生成與以下財經主題相關的專業高質感描繪圖，風格現代、科技、戰略：{prompt_text[:200]}"
        )
    try:
        res = client.images.generate(
            model="dall-e-3",
            prompt=image_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        image_url = res.data[0].url
        return requests.get(image_url).content
    except Exception as e:
        print(f"❌ 產圖失敗：{e}")
        return None

def get_next_image_id():
    try:
        with open("last_image_id.txt", "r") as f:
            last = int(f.read().strip())
    except:
        last = 12
    next_id = last + 1
    with open("last_image_id.txt", "w") as f:
        f.write(str(next_id))
    return next_id

def main():
    category = get_today_category()
    print(f"▶️ 今日分類：{category}")
    news = fetch_random_article(category)
    person = extract_main_person(news)
    img_id = get_next_image_id()
    img_name = f"{img_id}.jpg"
    img_alt = f"{img_id}-1.jpg"
    title = generate_chinese_title(news["title"])
    article = summarize_with_gpt(news, img_name)

    img_path = f"img/content/{img_name}"
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    image_data = generate_image(title, person)
    if image_data is None:
        print("❌ 圖片產生失敗，不更新")
        return
    with open(img_path, "wb") as f:
        f.write(image_data)

    today = datetime.now().strftime('%Y-%m-%d')
    block = f"""title: {title}
images: {img_name},{img_alt}
fontSize:16px
date:{today}
content: {article}<p>原始連結：<a href=\"{news['link']}\">點此查看</a></p>

---
"""
    if os.path.exists("content.txt"):
        with open("content.txt", "r", encoding="utf-8") as f:
            old = f.read()
    else:
        old = ""
    with open("content.txt", "w", encoding="utf-8") as f:
        f.write(block + "\n" + old)

    print(f"✅ 產出完成：{img_path}")

if __name__ == "__main__":
    main()
