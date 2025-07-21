# StockCorp 自動新聞發布系統（V2）

本系統將每天自動執行以下流程：
1. 擷取今日新聞（台股、美股、幣圈、ETF、黃金）
2. 使用 OpenAI GPT 模型進行摘要重寫（非抄襲）
3. 自動生成對應主題圖片（.jpg）
4. 將內容插入至 content.txt 最上方
5. 將圖片儲存為 /img/content/X.jpg（自動遞增）
6. 每日透過 GitHub Actions 自動運行

---

## ✅ 如何部署：

1. 複製此專案內容至你的 GitHub Pages Repo
2. 到 GitHub → 專案設定 → Secrets → Actions → 新增密鑰：

| 名稱 | 值 |
|------|----|
| `OPENAI_API_KEY` | 你的 OpenAI API Key |

3. 確保存在 `.github/workflows/update-news.yml`
4. Push 後，GitHub 會每天早上自動產生一則新新聞與圖片

---

## 🔁 設定說明
- `content.txt`：保留所有歷史新聞，並新增在最上方
- `last_image_id.txt`：記錄最新圖片編號（預設為12）
