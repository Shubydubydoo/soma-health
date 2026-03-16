# 說說

跟 AI 練習聊天，發現你喜歡的對話感。

---

## 本地開發

```bash
npm install
cp .env.example .env.local
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

---

## 環境變數

複製 `.env.example` 為 `.env.local`，填入以下變數：

```
ANTHROPIC_API_KEY=    # 必填
RESEND_API_KEY=       # 選填，Email 報告功能
FROM_EMAIL=           # 選填，寄件地址
```

`.env.local` 已在 `.gitignore`，不會被推上 GitHub。

---

## 技術棧

- Next.js 14 (App Router)
- TypeScript
- Anthropic Claude API
