# ✅ 自動新聞產生器（新聞擷取 + ChatGPT摘要 + 圖片生成）
# 提醒：這是簡化模板，真實版本請配合網站設定與 API Key 使用

import os
import openai
import datetime
import requests

def fetch_news_for_topic(topic):
    return f"{topic} 市場今日震盪，投資人關注政策與數據。"

def summarize_with_gpt(news_text):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    messages = [
        {"role": "system", "content": "你是專業財經記者，請將以下新聞內容重寫成 500~1000 字中文報導，語氣自然，避免抄襲。"},
        {"role": "user", "content": news_text}
    ]
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=messages,
        temperature=0.7,
        max_tokens=1024
    )
    return response.choices[0].message.content.strip()

def update_content_file(new_article):
    with open("content.txt", "r", encoding="utf-8") as f:
        existing = f.read()
    now = datetime.datetime.now().strftime("%Y-%m-%d")
    full_article = f"[{now}]\n{new_article}\n---\n" + existing
    with open("content.txt", "w", encoding="utf-8") as f:
        f.write(full_article)

def read_image_id():
    with open("last_image_id.txt", "r") as f:
        return int(f.read().strip())

def write_image_id(new_id):
    with open("last_image_id.txt", "w") as f:
        f.write(str(new_id))

def main():
    weekday = datetime.datetime.now().weekday()
    topics = ["台股", "幣圈", "美股", "幣圈", "ETF", "黃金"]
    topic = topics[weekday]
    raw_news = fetch_news_for_topic(topic)
    article = summarize_with_gpt(raw_news)
    update_content_file(article)

    img_id = read_image_id() + 1
    write_image_id(img_id)
    with open(f"img/content/{img_id}.jpg", "wb") as f:
        f.write(requests.get("https://picsum.photos/800/400").content)

if __name__ == "__main__":
    main()
