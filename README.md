# Soma Health

Evidence-based body composition tracker with AI-powered insights.


Built with React + Vite. AI features powered by Claude (Anthropic). Deployed on Vercel.

---

## Deploy to Vercel (5 minutes)

### 1. Push this folder to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo at github.com/new, then:
git remote add origin https://github.com/YOUR_USERNAME/soma-health.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Click **Add New Project** → Import your `soma-health` repo
3. Vercel auto-detects Vite — click **Deploy** (no settings needed)
4. Go to **Settings → Environment Variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from [console.anthropic.com](https://console.anthropic.com)
5. Go to **Deployments** → click the latest → **Redeploy**

Your app is live at `https://soma-health-xyz.vercel.app` 🎉

### Optional: Custom domain

In Vercel → **Settings → Domains** → add your own domain (e.g. `somahealth.com`).

---

## Local development

```bash
npm install
```

Create a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

App runs at http://localhost:5173. API proxy runs automatically via Vite dev server.

---

## Stack

- **Frontend**: React 18 + Vite
- **AI**: Claude claude-sonnet-4-20250514 via serverless proxy (`/api/claude.js`)
- **Storage**: localStorage (browser, per-user, private)
- **Hosting**: Vercel (free tier)
- **Data sources**: CDC NHANES, ACE, Janssen et al. 2000
