# CODEBUDDY.md

This file provides guidance when working with code in this repository.

## Project Overview

**AI Intelligence Hub** — a three-section intelligence dashboard that aggregates:

1. **OpenRouter Model Rankings** — Top 50 AI models ranked by recency from OpenRouter's API
2. **GitHub Trending AI Repos** — Hottest open-source AI/ML/LLM projects from GitHub
3. **Global AI News** — AI model news from 16 global RSS sources (EN + ZH)

Built as a lightweight Node.js server with a magazine-style SPA frontend.

## Quick Start

```bash
npm install              # Install fast-xml-parser (only dependency)
npm start                # Start on http://localhost:8088

# With proxy for Chinese sources (behind GFW):
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 npm start

# Static generation for GitHub Pages:
node scripts/generate-static.js
```

## Architecture

```
ai-news-hub/
├── package.json              # Deps: fast-xml-parser only
├── server.js                 # Node.js HTTP server + all data fetchers (363 lines)
├── index.html                # SPA frontend with 3-tab layout (1155 lines)
├── design.md                 # Design system documentation
├── CODEBUDDY.md              # This file
├── scripts/
│   └── generate-static.js    # Static data generator for GitHub Pages (278 lines)
├── data/
│   └── news.json             # Generated static data cache
└── public/
    └── index.html            # (sync of index.html)
```

---

### Server (`server.js`)

A single Node.js file with no Express dependency, using the built-in `http` module.

**Three data sections** fetched and cached in memory:

| Section | Source | Endpoint | Items |
|---------|--------|----------|-------|
| Models | `openrouter.ai/api/v1/models` | `/api/news` → `.models` | Top 50 models sorted by newest |
| GitHub | `api.github.com/search/repositories` | `/api/news` → `.github` | Top 25 AI/ML repos by stars |
| News | 16 RSS feeds (10 EN + 6 ZH) | `/api/news` → `.articles` | All articles sorted by date |

**Key functions:**
- `fetchOpenRouterModels()` — Fetches model list, sorts by `created` timestamp descending, returns top 50 with pricing/context/provider info
- `fetchGitHubTrending()` — Searches GitHub repos with AI/ML/LLM keywords, sorted by stars, returns top 25
- `fetchSource()` / `extractArticles()` / `stripHtml()` — RSS fetching and parsing (RSS 2.0 + Atom 1.0)
- `refreshCache()` — Runs all three fetches in parallel via `Promise.allSettled`, updates in-memory cache

**Cache:** In-memory, TTL = 5 minutes. Auto-refreshes on next API request after expiry.

**API response shape (`GET /api/news`):**
```json
{
  "articles": [...],
  "models": [{ rank, id, name, created, context_length, description, pricing, architecture, top_provider }],
  "github": [{ name, url, description, stars, forks, language, topics, updated_at, owner_avatar }],
  "lastFetched": 1717000000000,
  "errors": [{ source, error }],
  "totalSources": 18,
  "successfulSources": 16,
  "totalArticles": 200,
  "totalModels": 50,
  "totalGithub": 25
}
```

### Frontend (`index.html`)

A self-contained SPA with a 3-tab magazine-style layout.

**Tabs:**
1. **Model Rankings** (`#tabModels`) — Table with rank, model name/id, description, context length, pricing (in/out), provider. Top 3 have gold/silver/bronze rank styling.
2. **GitHub AI** (`#tabGithub`) — 2-column card grid showing repo name (with avatar), description, stars/forks count, language dot, topics, update recency.
3. **AI News** (`#tabNews`) — Same as original: 3-column article grid with search, language filter (All/EN/ZH), source filter pills, source status indicators.

**State management:** Single `state` object updated by `applyData(data)` from API response.
**Auto-refresh:** Polls `/api/news` every 60 seconds.
**Animations:** Fade-in stagger on article cards and GitHub cards.

## RSS Sources (16)

| Count | Language | Sources |
|-------|----------|---------|
| 10 | EN | ArXiv (cs.LG/CL/CV/AI), Hugging Face Blog, OpenAI Blog, Reddit (r/MachineLearning, r/LocalLLaMA), Google News AI Model Search, VentureBeat AI |
| 6 | ZH | 雷锋网 AI, 钛媒体, 动点科技, Google News 中文大模型动态, Google News AI开源模型动态 |

## How to Add Data

### New RSS source
Add entry to `SOURCES` in `server.js` (and `scripts/generate-static.js`):
```js
{ name: 'Source Name', url: 'https://example.com/feed.xml', lang: 'en' },
```

### New data section
1. Add fetch function in `server.js`
2. Include in `refreshCache()` with `Promise.allSettled`
3. Add to API response shape
4. Add rendering function + tab in `index.html`

## Environment Variables

- `PORT` — Server port (default: 8088)
- `HTTP_PROXY`, `HTTPS_PROXY` — Proxy for RSS/GitHub/OpenRouter fetches

## Key Behaviors

- **Cache**: 5-min TTL, auto-refresh on access after expiry
- **Auto-refresh**: Frontend polls every 60s
- **Error resilience**: Failed sources don't crash; errors reported in API response & UI
- **Proxy**: Required for Chinese RSS sources behind GFW (set env vars)
- **No persistence**: In-memory cache; restart clears it
- **Rate limits**: GitHub API unauthenticated = 60 req/hr; OpenRouter = free tier available
