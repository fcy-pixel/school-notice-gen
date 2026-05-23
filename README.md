# 學校通告生成器

Cloudflare Worker — 中華基督教會基慈小學通告生成工具

## 功能
- 填寫表單即可下載 `.docx` 格式的學校通告
- 內建通告模板，無需上傳
- Qwen AI 自動將草稿轉為正式通告用語

## 本地開發

```bash
npm install
# 建立本地環境變數（AI 功能）
echo "QWEN_API_KEY=your_key_here" > .dev.vars
npm run dev
```

## 部署至 Cloudflare

```bash
# 首次登入
npx wrangler login

# 設定 Qwen API Key（只需一次）
npx wrangler secret put QWEN_API_KEY

# 部署
npm run deploy
```

## 更新通告模板

1. 修改 `~/Desktop/學校通告模板.docx`
2. 執行以下指令重新生成 `src/template-b64.js`：
   ```bash
   python3 -c "
   import base64
   with open('學校通告模板.docx','rb') as f:
       b64 = base64.b64encode(f.read()).decode()
   with open('src/template-b64.js','w') as g:
       g.write(f'export const TEMPLATE_B64 = \"{b64}\";\n')
   print('Done')
   "
   ```
3. 重新部署：`npm run deploy`

## 佔位符列表

| 欄位 | 說明 |
|------|------|
| `{{學年}}` | 例：2025/26 |
| `{{通告編號}}` | 例：102A |
| `{{活動名稱}}` | 例：機械人比賽 |
| `{{活動簡介}}` | AI 可自動生成 |
| `{{活動日期}}` | 例：25/6/2026 (星期四) |
| `{{活動時間}}` | 例：上午9:00至下午1:00 |
| `{{活動地點}}` | 比賽場地 |
| `{{集合時間}}` | 例：上午8:30 |
| `{{集合地點}}` | 例：學校正門 |
| `{{解散時間及地點}}` | 例：約下午1:00於學校正門解散 |
| `{{領隊老師}}` | 例：陳大文老師 |
| `{{聯絡電話}}` | 例：2322 5122 |
| `{{發出日期}}` | 例：10-5-2026 |
| `{{回條截止日期}}` | 例：15-5-2026（表格用） |
| `{{回條截止（文字）}}` | 例：15/5(星期五)（通告文字用） |
| `{{備註}}` | 多行，AI 可自動格式化 |
