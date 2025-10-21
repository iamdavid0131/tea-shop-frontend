# Tea Shop Frontend (Cloudflare Pages + GAS)

## 必要環境變數（Cloudflare Pages 專案設定 > Environment Variables）
- `GAS_URL`：Apps Script Web App 的 `.../exec`
- `API_TOKEN`：與 GAS Script Properties 中的 `API_TOKEN` 一致

## 本地開發（含 Functions 模擬）
```bash
npm i
# 帶暫時綁定（只供本地用）
wrangler pages dev --binding GAS_URL=https://script.google.com/macros/s/xxx/exec --binding API_TOKEN=dev-secret
