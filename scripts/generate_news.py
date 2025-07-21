import datetime

def get_topic_by_weekday(weekday):
    topics = {
        0: "台股",
        1: "幣圈",
        2: "美股",
        3: "幣圈",
        4: "ETF",
        5: "黃金"
    }
    return topics.get(weekday, "財經")

def generate_article(index, topic, date_str, image_filename):
    content_map = {
        "台股": "台股今日表現震盪，投資人關注電子與航運類股表現。",
        "幣圈": "比特幣與以太幣今日走勢分歧，市場情緒仍偏保守。",
        "美股": "美股三大指數收紅，科技股領漲，投資人靜待財報季。",
        "ETF": "投資人偏好低波動ETF，資金持續流入高股息標的。",
        "黃金": "黃金價格小幅震盪，市場聚焦通膨數據與升息預期。"
    }
    content = content_map.get(topic, "今日市場表現整理如下。")
    return f"""title:{date_str} {topic}焦點
images:{image_filename}
fontSize:16px
date:{date_str}
content:<p>{content}</p>

---
"""

def main():
    today = datetime.date.today()
    weekday = today.weekday()  # 0 = Monday
    topic = get_topic_by_weekday(weekday)
    date_str = today.isoformat()

    # 圖片檔名遞增處理（假設昨天為 12.jpg）
    with open("last_image_id.txt", "r") as f:
        last_image_id = int(f.read().strip())
    next_image_id = last_image_id + 1
    image_filename = f"{next_image_id}.jpg"

    # 產生新文章
    new_article = generate_article(next_image_id, topic, date_str, image_filename)

    # 加入舊文章（保留歷史）
    try:
        with open("content.txt", "r", encoding="utf-8") as f:
            existing = f.read()
    except FileNotFoundError:
        existing = ""

    with open("content.txt", "w", encoding="utf-8") as f:
        f.write(new_article + existing)

    with open("last_image_id.txt", "w") as f:
        f.write(str(next_image_id))

if __name__ == "__main__":
    main()
