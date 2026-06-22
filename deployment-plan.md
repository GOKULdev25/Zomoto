# 🚀 Zomoto Deployment Plan

> **Backend → Railway** &nbsp;|&nbsp; **Frontend → Vercel**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Backend Deployment (Railway)](#3-backend-deployment-railway)
4. [Frontend Deployment (Vercel)](#4-frontend-deployment-vercel)
5. [Required Code Changes](#5-required-code-changes)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Post-Deployment Checklist](#7-post-deployment-checklist)
8. [Monitoring & Troubleshooting](#8-monitoring--troubleshooting)
9. [Cost Estimates](#9-cost-estimates)

---

## 1. Architecture Overview

```
┌─────────────────────┐         HTTPS          ┌───────────────────────┐
│   Vercel (Frontend)  │ ◄─────────────────────► │   Railway (Backend)    │
│                      │    /api/* → proxy to    │                        │
│  React + Vite + TS   │    Railway backend URL  │  FastAPI + Uvicorn     │
│  TailwindCSS         │                         │  Groq LLM (Llama 3.3) │
│                      │                         │  HuggingFace Dataset   │
└─────────────────────┘                         └───────────────────────┘
                                                          │
                                                          ▼
                                                ┌───────────────────┐
                                                │  Groq Cloud API    │
                                                │  (LLM Inference)   │
                                                └───────────────────┘
```

**Data flow:**
1. User visits Vercel-hosted frontend
2. Frontend sends API requests to `/api/*`
3. Vercel rewrites `/api/*` → Railway backend URL
4. Backend filters HuggingFace Zomato dataset, calls Groq LLM
5. Recommendations returned to frontend

---

## 2. Prerequisites

| Requirement | Details |
|-------------|---------|
| **Railway Account** | Sign up at [railway.app](https://railway.app) — GitHub-linked recommended |
| **Vercel Account** | Sign up at [vercel.com](https://vercel.com) — GitHub-linked recommended |
| **GitHub Repository** | Push your code to GitHub (Railway & Vercel both deploy from repos) |
| **Groq API Key** | Obtain from [console.groq.com](https://console.groq.com) |
| **Python 3.10+** | Backend requirement (Railway provides this) |
| **Node.js 18+** | Frontend build requirement (Vercel provides this) |

---

## 3. Backend Deployment (Railway)

### 3.1 Prepare the Backend

#### a) Create a `Procfile` in the project root (`e:\Zomoto\Procfile`)

```procfile
web: uvicorn app:app --host 0.0.0.0 --port $PORT
```

> Railway injects the `$PORT` environment variable. Uvicorn must bind to `0.0.0.0` and use this port.

#### b) Create a `runtime.txt` in the project root (optional but recommended)

```
python-3.12.0
```

#### c) Create a `railway.toml` in the project root (optional — for finer control)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

#### d) Ensure `requirements.txt` is clean

Your current `requirements.txt` includes all dependencies. Railway will auto-detect this and run `pip install -r requirements.txt`. Remove any unnecessary packages (e.g., `streamlit` is unused by the FastAPI backend) to reduce build time.

### 3.2 Deploy on Railway

1. **Login** to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `Zomoto` repository
4. Railway auto-detects Python → uses Nixpacks to build
5. Set the **Root Directory** to `/` (project root, since `app.py` is at root level)

### 3.3 Configure Environment Variables on Railway

Go to your Railway service → **Variables** tab → Add the following:

| Variable | Value | Notes |
|----------|-------|-------|
| `GROQ_API_KEY` | `gsk_your_actual_key` | **Required** — Get from Groq Console |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Default LLM model |
| `GROQ_TEMPERATURE` | `0.3` | LLM creativity setting |
| `HF_DATASET_NAME` | `ManikaSaini/zomato-restaurant-recommendation` | HuggingFace dataset |
| `PORT` | *(auto-set by Railway)* | Do NOT set manually |

### 3.4 Verify Backend Deployment

Once deployed, Railway assigns a public URL like:
```
https://zomoto-backend-production.up.railway.app
```

Test with:
```bash
# Health check
curl https://your-railway-url.up.railway.app/health

# API docs
# Visit: https://your-railway-url.up.railway.app/docs
```

> ⚠️ **First request will be slow** (~30–60s) because the HuggingFace dataset downloads and processes on startup. Subsequent requests use the in-memory cache.

---

## 4. Frontend Deployment (Vercel)

### 4.1 Prepare the Frontend

#### a) Create `frontend/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-railway-url.up.railway.app/:path*"
    }
  ]
}
```

> Replace `your-railway-url.up.railway.app` with your actual Railway backend URL after deploying the backend.

This replaces the Vite dev proxy — in production, Vercel handles the `/api/*` → Railway rewrite at the edge.

#### b) Update `frontend/src/api.ts` for production

The current code uses `baseURL: '/api'` which works perfectly — the Vercel rewrite handles routing to Railway in production just like the Vite proxy does in development. **No code change needed.**

### 4.2 Deploy on Vercel

1. **Login** to [vercel.com](https://vercel.com)
2. Click **"Add New…"** → **"Project"**
3. Import your GitHub repository
4. Configure the project:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (auto-detected) |
| **Output Directory** | `dist` (auto-detected for Vite) |
| **Install Command** | `npm install` (auto-detected) |

5. Click **Deploy**

### 4.3 Configure Environment Variables on Vercel (if needed)

Currently the frontend has no env-dependent configuration (API calls go through the `/api` rewrite). If you add environment variables later, prefix them with `VITE_` for Vite to expose them to the client.

### 4.4 Verify Frontend Deployment

Vercel assigns a URL like:
```
https://zomoto.vercel.app
```

Test:
1. Visit the URL — the React app should load
2. Try a recommendation — it should proxy to Railway and return results
3. Check browser DevTools → Network tab for any CORS or 502 errors

---

## 5. Required Code Changes

> ✅ **All changes below have been implemented.**

### 5.1 ✅ Update CORS origins in `app.py`

CORS now reads `FRONTEND_URL` from environment variable (set on Railway), so you don't need to hardcode Vercel URLs:

```python
CORS_ORIGINS = [
    "http://localhost:5173",   # Vite dev
    "http://localhost:3000",   # CRA dev
    "http://127.0.0.1:5173",
]

_vercel_url = os.getenv("FRONTEND_URL")
if _vercel_url:
    CORS_ORIGINS.append(_vercel_url.rstrip("/"))
```

> **Tip:** Set `FRONTEND_URL=https://your-app.vercel.app` in Railway environment variables after deploying the frontend.

### 5.2 ✅ Created `Procfile` (project root)

```procfile
web: uvicorn app:app --host 0.0.0.0 --port $PORT
```

### 5.3 ✅ Created `railway.toml` (project root)

Includes healthcheck config with 300s timeout (needed for slow HuggingFace dataset download on first boot).

### 5.4 ✅ Created `runtime.txt` (project root)

Pins Python to `3.12.0` for Railway/Nixpacks.

### 5.5 ✅ Created `frontend/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_RAILWAY_URL/:path*"
    }
  ]
}
```

> ⚠️ **Action Required:** Replace `YOUR_RAILWAY_URL` with your actual Railway URL after deploying the backend.

### 5.6 ✅ Updated `.env.example`

Added `FRONTEND_URL` variable documentation.

### 5.7 ✅ Backend PORT is already dynamic

```python
port = int(os.getenv("PORT", 8000))
```

---

## 6. Environment Variables Reference

### Railway (Backend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | ✅ Yes | — | Groq Cloud API key |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | LLM model to use |
| `GROQ_TEMPERATURE` | No | `0.3` | LLM temperature |
| `HF_DATASET_NAME` | No | `ManikaSaini/zomato-restaurant-recommendation` | Dataset identifier |
| `DATA_CACHE_PATH` | No | `data/restaurants.parquet` | Local cache path |
| `MAX_CANDIDATES_FOR_LLM` | No | `20` | Max candidates sent to LLM |
| `TOP_K_RECOMMENDATIONS` | No | `5` | Top-K results to return |
| `BUDGET_LOW_MAX` | No | `500` | Low budget threshold (INR) |
| `BUDGET_MEDIUM_MAX` | No | `1500` | Medium budget threshold (INR) |
| `FRONTEND_URL` | ✅ Yes | — | Your Vercel production URL (for CORS) |
| `PORT` | Auto | — | Injected by Railway — do NOT set manually |

### Vercel (Frontend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| *(none currently)* | — | — | Frontend uses `/api` rewrite, no env vars needed |

---

## 7. Post-Deployment Checklist

### Immediate Checks
- [ ] **Backend `/health` responds** with `{"status": "ok", "dataset_loaded": true, ...}`
- [ ] **Backend `/docs`** loads the Swagger UI
- [ ] **Frontend loads** without console errors
- [ ] **Recommendation flow works** end-to-end (submit form → get results)
- [ ] **CORS** — No blocked requests in browser DevTools

### Production Hardening
- [ ] **Remove `reload=True`** from the `if __name__` block (not needed in production; Railway uses `Procfile`)
- [ ] **Set up a custom domain** on Vercel (e.g., `zomoto.yourdomain.com`)
- [ ] **Set up a custom domain** on Railway for the API (e.g., `api.zomoto.yourdomain.com`)
- [ ] **Update `vercel.json`** rewrite destination if using a custom Railway domain
- [ ] **Enable Vercel Analytics** for frontend monitoring
- [ ] **Enable Railway Observability** for backend logging

### Security
- [ ] **Ensure `.env` is in `.gitignore`** (✅ already done)
- [ ] **Never commit API keys** to the repository
- [ ] **Rate limiting** — Consider adding FastAPI rate limiting middleware for production
- [ ] **HTTPS** — Both Railway and Vercel provide SSL automatically

---

## 8. Monitoring & Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `502 Bad Gateway` on Vercel | Backend not running or wrong Railway URL | Check Railway deployment status; verify `vercel.json` destination URL |
| `503 Service Unavailable` | Dataset failed to load or GROQ_API_KEY missing | Check Railway logs; verify env variables are set |
| Slow first request (~60s) | HuggingFace dataset downloading on cold start | Normal — dataset caches in memory after first load |
| `CORS error` in browser | Production origin not in `allow_origins` | Add your Vercel URL to CORS origins in `app.py` |
| `422 Unprocessable Entity` | Invalid request payload | Check frontend is sending correct field names |
| Railway build fails | Python version or dependency issue | Add `runtime.txt`, check `requirements.txt` |

### Viewing Logs

**Railway:**
- Dashboard → Your Service → **Deployments** → Click a deployment → **View Logs**
- Or use Railway CLI: `railway logs`

**Vercel:**
- Dashboard → Your Project → **Deployments** → **Functions** tab
- Runtime logs visible under **Logs** section
- Rewrite issues show in **Edge Network** logs

---

## 9. Cost Estimates

### Railway (Backend)

| Plan | Resources | Monthly Cost |
|------|-----------|--------------|
| **Trial** | 500 hrs execution, $5 credit | **Free** |
| **Hobby** | 8 GB RAM, shared vCPU | **$5/month** + usage |
| **Pro** | Unlimited, team features | **$20/month** + usage |

> **Recommendation:** Start with Hobby ($5/mo). The HuggingFace dataset loads into memory (~500 MB), so you'll need sufficient RAM. If the ~560 MB CSV is loaded into memory as a DataFrame, plan for **at least 2 GB RAM**.

### Vercel (Frontend)

| Plan | Deployments | Monthly Cost |
|------|-------------|--------------|
| **Hobby** | Unlimited deploys, 100 GB bandwidth | **Free** |
| **Pro** | Advanced analytics, team features | **$20/month** |

> **Recommendation:** Hobby (Free) is sufficient for most use cases. The frontend is a static Vite build — very lightweight.

### Groq API

| Plan | Tokens | Monthly Cost |
|------|--------|--------------|
| **Free** | 6,000 requests/min, 100K tokens/day | **Free** |
| **Developer** | Higher limits | **Pay-as-you-go** |

> **Recommendation:** Free tier is sufficient for development and light usage.

### Total Estimated Cost: **$5–10/month** (Hobby plans)

---

## Quick Start Summary

```bash
# 1. Push code to GitHub (if not already)
git add .
git commit -m "Add deployment configuration"
git push origin main

# 2. Deploy Backend on Railway
#    → Import repo → Set env vars → Deploy

# 3. Get Railway URL
#    → Copy the public URL (e.g., https://zomoto-production.up.railway.app)

# 4. Update frontend/vercel.json with Railway URL

# 5. Deploy Frontend on Vercel
#    → Import repo → Set root to "frontend" → Deploy

# 6. Test end-to-end
curl https://your-railway-url/health
# Visit https://your-vercel-url
```

---

*Last updated: June 23, 2026*
